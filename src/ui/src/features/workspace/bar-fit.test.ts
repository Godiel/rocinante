import { describe, expect, it } from "vitest";
import { MORE, fitting } from "./bar-fit";

const items = [
  { id: "ambience", priority: 6 },
  { id: "pages", priority: 9 },
  { id: "counter", priority: 2 },
  { id: "export", priority: "bar" as const },
  { id: "close", priority: "menu" as const },
];
const widths = { ambience: 80, pages: 70, counter: 90, export: 75, [MORE]: 40 };
const ids = (list: { id: string }[]) => list.map((item) => item.id);

describe("the bar of the work", () => {
  it("keeps everything in the bar while it is not measured", () => {
    const { inBar, inMenu } = fitting(items, widths, null, 10);
    expect(ids(inBar)).toEqual(["ambience", "pages", "counter", "export"]);
    expect(ids(inMenu)).toEqual(["close"]);
  });

  it("keeps in the bar what fits with the menu, in order, and sends the lowest priority away first", () => {
    // Everything: 90 + 80 + 100 + 85 + 50 (the menu) = 405.
    expect(ids(fitting(items, widths, 405, 10).inBar)).toEqual([
      "ambience",
      "pages",
      "counter",
      "export",
    ]);
    const narrow = fitting(items, widths, 320, 10);
    expect(ids(narrow.inBar)).toEqual(["ambience", "pages", "export"]);
    expect(ids(narrow.inMenu)).toEqual(["counter", "close"]);
    expect(ids(fitting(items, widths, 100, 10).inBar)).toEqual(["export"]);
  });
});
