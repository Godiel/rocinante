// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SquireSettings } from "../../bridge/generated/protocol";

const request = vi.hoisted(() => vi.fn());
vi.mock("../../bridge/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../bridge/core")>()),
  request,
}));

import { SquirePanel } from "./SquirePanel";
import { NO_SQUIRE } from "./useSquire";

const origin = "main";

function Panel({ settings }: { settings: SquireSettings }) {
  return (
    <SquirePanel
      settings={settings}
      proposals={[]}
      loaded
      origin={origin}
      onClose={() => {}}
      onProblem={() => {}}
    >
      <p>Lista de propuestas</p>
    </SquirePanel>
  );
}

beforeEach(() => request.mockReset());
afterEach(cleanup);

describe("the settings of the squire", () => {
  it("starts unconnected, asks for a provider and keeps the key out of sight", async () => {
    const user = userEvent.setup();
    request.mockResolvedValue({ ...NO_SQUIRE });
    const { rerender } = render(<Panel settings={NO_SQUIRE} />);

    expect(screen.getByText("Sin conectar.")).toBeInTheDocument();
    expect(screen.queryByText("Lista de propuestas")).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Inteligencia artificial"), "gemini");
    await user.type(screen.getByLabelText("Modelo"), "gemini-2.5-flash");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(request).toHaveBeenCalledWith("squire.configure", {
      provider: "gemini",
      model: "gemini-2.5-flash",
      endpoint: null,
      origin,
    });

    rerender(<Panel settings={{ ...NO_SQUIRE, provider: "gemini", model: "gemini-2.5-flash" }} />);
    // Still in the settings: the key comes next.
    expect(screen.getByRole("button", { name: "Propuestas" })).toBeInTheDocument();
    const key = screen.getByLabelText("Tu clave");
    expect(key).toHaveAttribute("type", "password");
    await user.type(key, "g-clave");
    await user.click(screen.getByRole("button", { name: "Guardar clave" }));
    expect(request).toHaveBeenCalledWith("squire.setKey", {
      provider: "gemini",
      key: "g-clave",
      origin,
    });
    await waitFor(() => expect(key).toHaveValue(""));
  });

  it("says where the text goes before the writer lets it read the work", async () => {
    const user = userEvent.setup();
    request.mockResolvedValue({ ...NO_SQUIRE });
    render(
      <Panel
        settings={{ ...NO_SQUIRE, provider: "anthropic", model: "claude-haiku-5-5", hasKey: true }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Ajustes" }));
    expect(screen.getByText(/irán a Anthropic \(Claude\), con tu clave/)).toBeInTheDocument();
    expect(screen.getByText("Guardada en el almacén del sistema.")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "El escudero lee esta obra" }));
    expect(request).toHaveBeenCalledWith("squire.enable", { enabled: true, origin });
  });

  it("tests the connection and says clearly what failed", async () => {
    const user = userEvent.setup();
    request.mockImplementation((method: string) =>
      Promise.resolve(
        method === "squire.test" ? { ok: false, reason: "squireRefused" } : NO_SQUIRE,
      ),
    );
    render(
      <Panel settings={{ ...NO_SQUIRE, provider: "openai", model: "gpt-5-mini", hasKey: true }} />,
    );

    await user.click(screen.getByRole("button", { name: "Ajustes" }));
    await user.click(screen.getByRole("button", { name: "Probar" }));
    expect(await screen.findByText(/rechazó la petición/)).toBeInTheDocument();
  });

  it("lists the models of Ollama, and explains how to start it when it does not answer", async () => {
    const user = userEvent.setup();
    request.mockImplementation((method: string) =>
      method === "squire.models" ? Promise.reject(new Error("no")) : Promise.resolve(NO_SQUIRE),
    );
    render(<Panel settings={NO_SQUIRE} />);

    await user.selectOptions(screen.getByLabelText("Inteligencia artificial"), "ollama");
    expect(await screen.findByText(/Instálalo desde ollama.com/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Tu clave")).not.toBeInTheDocument();
    expect(request).toHaveBeenCalledWith("squire.models", { provider: "ollama", endpoint: null });
  });

  it("shows the proposals once connected, and a problem calmly", () => {
    render(
      <Panel
        settings={{
          ...NO_SQUIRE,
          provider: "ollama",
          model: "llama3.1",
          enabled: true,
          status: "problem",
          problem: "squireUnavailable",
        }}
      />,
    );

    expect(screen.getByText("Lista de propuestas")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Ollama no responde/);
  });
});
