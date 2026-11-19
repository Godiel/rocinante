import { describe, expect, it, vi } from "vitest";
import { registerPendingSave, savePendingNow } from "./pending-saves";

describe("saving what is pending", () => {
  it("asks every open editor and waits for all of them", async () => {
    const order: string[] = [];
    const slow = vi.fn(
      () =>
        new Promise<void>((resolve) =>
          setTimeout(() => {
            order.push("slow");
            resolve();
          }, 10),
        ),
    );
    const quick = vi.fn(() => {
      order.push("quick");
      return Promise.resolve();
    });
    const stopSlow = registerPendingSave(slow);
    const stopQuick = registerPendingSave(quick);

    await savePendingNow();
    order.push("done");

    expect(order).toEqual(["quick", "slow", "done"]);
    stopSlow();
    stopQuick();
  });

  it("forgets an editor that has left", async () => {
    const flush = vi.fn(() => Promise.resolve());
    registerPendingSave(flush)();

    await savePendingNow();

    expect(flush).not.toHaveBeenCalled();
  });
});
