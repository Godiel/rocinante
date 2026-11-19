import { describe, expect, it } from "vitest";
import type { WorkFormat } from "../../bridge/generated/protocol";
import { TYPEFACES } from "../../design/typefaces";
import { workClasses, workStyle } from "./work-style";

const novel: WorkFormat = {
  pageSize: "a5",
  pageWidth: 148,
  pageHeight: 210,
  margins: { top: 18, bottom: 22, inside: 20, outside: 15 },
  typeface: "ebGaramond",
  bodySize: 11,
  leading: 1.35,
  firstLineIndent: true,
  justified: true,
  dropCap: false,
};

describe("the work on the continuous paper", () => {
  it("shows the default body of a book at the size of the writing surface", () => {
    expect(workStyle(novel)).toMatchObject({ "--work-size": "19.00px" });
  });

  it("keeps other bodies in proportion", () => {
    expect(workStyle({ ...novel, bodySize: 12 })).toMatchObject({ "--work-size": "20.73px" });
    expect(workStyle({ ...novel, bodySize: 8 })).toMatchObject({ "--work-size": "13.82px" });
  });

  it("sets the typeface, the leading and the width of a character for the column", () => {
    expect(workStyle({ ...novel, typeface: "courierPrime", leading: 1.6 })).toEqual({
      "--work-font": TYPEFACES.courierPrime.family,
      "--work-size": "19.00px",
      "--work-leading": "1.6",
      "--work-char": "0.6",
    });
  });

  it("turns the paragraph settings into classes", () => {
    expect(workClasses(novel)).toBe("work-justified work-indented");
    expect(workClasses({ ...novel, justified: false, firstLineIndent: false, dropCap: true })).toBe(
      "work-ragged work-spaced work-drop-cap",
    );
  });

  it("knows every typeface of the contract", () => {
    for (const typeface of Object.values(TYPEFACES)) {
      expect(typeface.charWidth).toBeGreaterThan(0.3);
      expect(typeface.family).toContain(
        typeface.label.includes(" ") ? `"${typeface.label}"` : typeface.label,
      );
    }
  });
});
