import { describe as group, expect, it } from "vitest";
import { describe, withoutText } from "./diagnostics";

group("what reaches the log", () => {
  it("never carries quoted text, which could be the writer's", () => {
    expect(
      withoutText(
        'RangeError: Invalid content for node paragraph: <"En un lugar de la Mancha", hard_break>',
      ),
    ).toBe('RangeError: Invalid content for node paragraph: <"…", hard_break>');
    expect(withoutText("No se pudo abrir «Don Quijote». “Capítulo I”")).toBe(
      "No se pudo abrir «…». “…”",
    );
    expect(withoutText('escaped "dijo \\"basta\\" y calló" end')).toBe('escaped "…" end');
  });

  it("says what failed and where, cut to a reasonable length", () => {
    const error = new TypeError('Cannot read "secreto"');
    error.stack = `TypeError: Cannot read "secreto"\n    at WritingView (WritingView.tsx:120:14)\n${"    at x\n".repeat(2000)}`;

    const { message, detail } = describe(error);

    expect(message).toBe('TypeError: Cannot read "…"');
    expect(detail).toContain("at WritingView (WritingView.tsx:120:14)");
    expect(detail).not.toContain("secreto");
    expect(detail!.length).toBeLessThanOrEqual(8000);
  });

  it("describes what is not an Error too", () => {
    expect(describe("plain failure")).toEqual({ message: "plain failure", detail: null });
    expect(describe(undefined).message).toBe("undefined");
  });
});
