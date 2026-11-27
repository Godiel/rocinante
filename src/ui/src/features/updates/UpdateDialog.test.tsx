// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Update } from "@tauri-apps/plugin-updater";

const check = vi.hoisted(() => vi.fn());
const relaunch = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock("@tauri-apps/plugin-updater", () => ({ check }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch }));

import { UpdateDialog } from "./UpdateDialog";
import { UPDATE_CHECK_DELAY_MS, useUpdate } from "./useUpdate";

type Progress = (event: {
  event: string;
  data: { contentLength?: number; chunkLength: number };
}) => void;

function fakeUpdate(
  install: (progress: Progress) => Promise<void> = () => Promise.resolve(),
): Update {
  return {
    version: "1.1.0",
    body: "Exportar a PDF más rápido.",
    downloadAndInstall: vi.fn(install),
  } as unknown as Update;
}

beforeEach(() => {
  check.mockReset();
  relaunch.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("a new version of Rocinante", () => {
  it("is looked for once the work is open, only if the writer allows it, and quietly if it fails", async () => {
    vi.useFakeTimers();
    const update = fakeUpdate();
    check.mockResolvedValue(update);

    const { result, rerender } = renderHook(({ allowed }) => useUpdate(allowed), {
      initialProps: { allowed: false },
    });
    await act(() => vi.advanceTimersByTimeAsync(UPDATE_CHECK_DELAY_MS * 2));
    expect(check).not.toHaveBeenCalled();

    rerender({ allowed: true });
    expect(check).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(UPDATE_CHECK_DELAY_MS));
    expect(check).toHaveBeenCalledOnce();
    expect(result.current).toBe(update);

    rerender({ allowed: false });
    expect(result.current).toBeNull();

    check.mockRejectedValue(new Error("sin conexión"));
    const offline = renderHook(() => useUpdate(true));
    await act(() => vi.advanceTimersByTimeAsync(UPDATE_CHECK_DELAY_MS));
    expect(offline.result.current).toBeNull();
  });

  it("saves, installs and restarts when the writer says so", async () => {
    const user = userEvent.setup();
    const update = fakeUpdate(async (progress) => {
      progress({ event: "Started", data: { contentLength: 100, chunkLength: 0 } });
      progress({ event: "Progress", data: { chunkLength: 100 } });
    });
    const beforeRestart = vi.fn(() => Promise.resolve());
    render(
      <UpdateDialog
        update={update}
        checking
        onChecking={() => {}}
        beforeRestart={beforeRestart}
        onClose={() => {}}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Rocinante 1.1.0" })).toHaveTextContent(
      "Exportar a PDF más rápido.",
    );
    await user.click(screen.getByRole("button", { name: "Actualizar y reiniciar" }));

    expect(beforeRestart).toHaveBeenCalled();
    expect(update.downloadAndInstall).toHaveBeenCalled();
    expect(relaunch).toHaveBeenCalled();
  });

  it("says calmly that nothing was installed when the signature does not match", async () => {
    const user = userEvent.setup();
    const update = fakeUpdate(() => Promise.reject(new Error("signature mismatch")));
    render(
      <UpdateDialog
        update={update}
        checking
        onChecking={() => {}}
        beforeRestart={() => Promise.resolve()}
        onClose={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Actualizar y reiniciar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/no se ha instalado nada/);
    expect(relaunch).not.toHaveBeenCalled();
  });

  it("can be left for later, and the writer can stop looking for new versions", async () => {
    const user = userEvent.setup();
    const onChecking = vi.fn();
    const onClose = vi.fn();
    render(
      <UpdateDialog
        update={fakeUpdate()}
        checking
        onChecking={onChecking}
        beforeRestart={() => Promise.resolve()}
        onClose={onClose}
      />,
    );

    await user.click(
      screen.getByRole("checkbox", { name: "Buscar versiones nuevas al abrir una obra" }),
    );
    expect(onChecking).toHaveBeenCalledWith(false);
    await user.click(screen.getByRole("button", { name: "Ahora no" }));
    expect(onClose).toHaveBeenCalled();
  });
});
