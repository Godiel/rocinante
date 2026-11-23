import { describe, expect, it } from "vitest";
import {
  base64ToBytes,
  bytesToBase64,
  encodeFitting,
  fitted,
  MAX_THUMBNAIL_BYTES,
  type Painter,
} from "./reduce-image";

/** A painter that writes `size(quality)` bytes, and only the types the system it pretends to be can write. */
function painter(
  writes: string[],
  size: (quality: number) => number,
): Painter & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    encode(_width, _height, type, quality) {
      asked.push(`${type}@${quality}`);
      const written = writes.includes(type) ? type : "image/png";
      return Promise.resolve(new Blob([new Uint8Array(size(quality))], { type: written }));
    },
  };
}

describe("reducing the image of an element", () => {
  it("fits the longer side and keeps the proportions, never enlarging", () => {
    expect(fitted(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitted(900, 3600, 256)).toEqual({ width: 64, height: 256 });
    expect(fitted(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitted(5000, 2, 256)).toEqual({ width: 256, height: 1 });
  });

  it("writes WebP where the system can", async () => {
    const webp = painter(["image/webp", "image/jpeg"], () => 1000);

    const reduced = await encodeFitting(webp, { width: 10, height: 10 }, MAX_THUMBNAIL_BYTES);

    expect(reduced.mediaType).toBe("image/webp");
    expect(reduced.bytes).toBe(1000);
    expect(webp.asked).toEqual(["image/webp@0.85"]);
  });

  it("falls back on JPEG where the system cannot write WebP", async () => {
    const webkit = painter(["image/jpeg"], () => 1000);

    const reduced = await encodeFitting(webkit, { width: 10, height: 10 }, MAX_THUMBNAIL_BYTES);

    expect(reduced.mediaType).toBe("image/jpeg");
    expect(webkit.asked).toEqual(["image/webp@0.85", "image/jpeg@0.85"]);
  });

  it("lowers the quality until the picture fits, and gives up below the lowest", async () => {
    const heavy = painter(["image/webp"], (quality) => (quality > 0.6 ? 300_000 : 150_000));

    const reduced = await encodeFitting(heavy, { width: 10, height: 10 }, MAX_THUMBNAIL_BYTES);
    expect(reduced.bytes).toBe(150_000);
    expect(heavy.asked).toEqual(["image/webp@0.85", "image/webp@0.7", "image/webp@0.5"]);

    await expect(
      encodeFitting(
        painter(["image/webp"], () => 300_000),
        { width: 10, height: 10 },
        MAX_THUMBNAIL_BYTES,
      ),
    ).rejects.toThrow();
  });

  it("carries bytes to base64 and back", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);

    expect(bytesToBase64(bytes)).toBe("AAEC+v8=");
    expect([...base64ToBytes("AAEC+v8=")]).toEqual([...bytes]);
    expect(bytesToBase64(new Uint8Array(100_000)).length).toBeGreaterThan(100_000);
  });
});
