// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CoreNotifications, ProjectState, StartState } from "../bridge/generated/protocol";

const request = vi.hoisted(() => vi.fn());
const listeners = vi.hoisted(() => new Map<string, (params: unknown) => void>());
vi.mock("../bridge/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../bridge/core")>()),
  request,
  ensureCompatibleCore: () => Promise.resolve(),
  onNotification: (method: string, handler: (params: unknown) => void) => {
    listeners.set(method, handler);
    return Promise.resolve(() => listeners.delete(method));
  },
}));
// The writing view has its own tests in block 9; here it only needs to say what it shows.
vi.mock("../features/editor/WritingView", () => ({
  WritingView: ({ project }: { project: ProjectState }) => <p>Escribiendo en {project.title}</p>,
}));

import { messages } from "./messages";
import { App } from "./App";

const project: ProjectState = {
  id: "0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6b",
  path: "C:\\Obras\\Don Quijote.rocinante",
  title: "Don Quijote",
  createdAt: "2026-03-14T09:00:00+00:00",
  index: { chapters: [], fragments: [], trash: [] },
  work: { words: 0, characters: 0, paragraphs: 0 },
};

const start = (overrides: Partial<StartState> = {}): StartState => ({
  project: null,
  place: null,
  problem: null,
  recent: [],
  preferences: {
    theme: "paper",
    outline: "docked",
    counterVisible: true,
    typewriterScrolling: true,
  },
  defaultFolder: "C:\\Users\\autor\\Documents\\Rocinante",
  ...overrides,
});

const pickers = { chooseFolder: vi.fn(), chooseProject: vi.fn() };

function announce<N extends keyof CoreNotifications>(method: N, params: CoreNotifications[N]) {
  act(() => listeners.get(method)?.(params));
}

function startWith(state: StartState) {
  request.mockImplementation((method: string) =>
    Promise.resolve(method === "app.start" ? state : null),
  );
  render(<App origin="main" pickers={pickers} />);
}

describe("app window", () => {
  beforeEach(() => {
    request.mockReset();
    listeners.clear();
    delete document.documentElement.dataset.theme;
  });

  afterEach(() => {
    cleanup();
  });

  it("starts on the welcome screen when there is nothing to reopen", async () => {
    startWith(start());

    expect(await screen.findByRole("button", { name: "Nuevo proyecto" })).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith("app.start", { origin: "main" });
  });

  it("goes straight to writing when the core reopened a project", async () => {
    startWith(start({ project }));

    expect(await screen.findByText("Escribiendo en Don Quijote")).toBeInTheDocument();
  });

  it("explains on the welcome screen why the last project did not reopen", async () => {
    startWith(start({ problem: { path: project.path, reason: "notFound" } }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      `No se pudo abrir «Don Quijote». ${messages.notFound}`,
    );
  });

  it("follows the core: a project opened in any window is shown here, and closing returns home", async () => {
    startWith(start());
    await screen.findByRole("button", { name: "Nuevo proyecto" });

    announce("project.opened", { project, origin: "window-1" });
    expect(await screen.findByText("Escribiendo en Don Quijote")).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith("place.get");

    announce("project.closed", { origin: "window-1" });
    expect(await screen.findByRole("button", { name: "Nuevo proyecto" })).toBeInTheDocument();
  });

  it("paints the theme of the writer's preferences and follows changes", async () => {
    startWith(start({ preferences: { ...start().preferences, theme: "candlelight" } }));
    await screen.findByRole("button", { name: "Nuevo proyecto" });

    expect(document.documentElement.dataset.theme).toBe("candlelight");
    expect(document.documentElement.style.getPropertyValue("--color-paper")).toBe("#1E1913");

    announce("preferences.changed", { preferences: start().preferences, origin: "window-1" });
    expect(document.documentElement.dataset.theme).toBe("paper");
  });

  it("keeps the recent list up to date", async () => {
    startWith(start());
    await screen.findByRole("button", { name: "Nuevo proyecto" });

    announce("recent.changed", {
      recent: [
        {
          path: project.path,
          title: "Don Quijote",
          lastOpenedAt: new Date().toISOString(),
          exists: true,
        },
      ],
      origin: "window-1",
    });

    expect(screen.getByRole("button", { name: /Don Quijote/ })).toBeInTheDocument();
  });

  it("says so in Spanish when the core cannot be reached", async () => {
    request.mockImplementation(() => Promise.reject(new Error("relay gone")));
    render(<App origin="main" pickers={pickers} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Algo no ha ido bien");
  });
});
