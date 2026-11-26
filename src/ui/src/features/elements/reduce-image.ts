/**
 * The image of an element is reduced here, by the WebView, before it goes into the work: the core takes no
 * image library. It becomes a picture of at most 1600 px on its longer side and a 256 px thumbnail for the
 * card, in WebP or, where the system cannot write WebP, in JPEG.
 */

export const FULL_SIDE = 1600;
export const THUMBNAIL_SIDE = 256;

/** What the core accepts once reduced. */
export const MAX_FULL_BYTES = 2 * 1024 * 1024;
export const MAX_THUMBNAIL_BYTES = 200 * 1024;

/** Tried in order until the picture fits: most pictures fit at the first. */
const QUALITIES = [0.85, 0.7, 0.5, 0.35];

export interface Reduced {
  /** Base64, as the contract carries it. */
  data: string;
  mediaType: "image/webp" | "image/jpeg";
  bytes: number;
}

/** Width and height that fit inside `side` × `side` keeping the proportions; never larger than the original. */
export function fitted(
  width: number,
  height: number,
  side: number,
): { width: number; height: number } {
  const scale = Math.min(1, side / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Draws pictures and writes them as files. Injected so the choice of format can be tested without a GPU. */
export interface Painter {
  /** Draws the picture at the given size and writes it; the type of the blob is what the system could write. */
  encode(width: number, height: number, type: string, quality: number): Promise<Blob>;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

export function base64ToBytes(data: string): Uint8Array<ArrayBuffer> {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/**
 * The picture at one size: WebP if the system writes it, JPEG otherwise (or JPEG when `jpeg` asks for it), at
 * the best quality that keeps it under `maxBytes`. Fails if not even the lowest quality fits.
 */
export async function encodeFitting(
  painter: Painter,
  size: { width: number; height: number },
  maxBytes: number,
  jpeg = false,
): Promise<Reduced> {
  let type: "image/webp" | "image/jpeg" = jpeg ? "image/jpeg" : "image/webp";
  for (const quality of QUALITIES) {
    let blob = await painter.encode(size.width, size.height, type, quality);
    if (blob.type !== type) {
      // WebKit may give PNG back when asked for WebP: from then on, JPEG.
      type = "image/jpeg";
      blob = await painter.encode(size.width, size.height, type, quality);
    }
    if (blob.size <= maxBytes) {
      return {
        data: bytesToBase64(new Uint8Array(await blob.arrayBuffer())),
        mediaType: type,
        bytes: blob.size,
      };
    }
  }
  throw new Error("The picture does not fit even at the lowest quality.");
}

/** A painter over a decoded picture, drawing on a canvas of the page. */
export function canvasPainter(picture: ImageBitmap): Painter {
  return {
    encode(width, height, type, quality) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return Promise.reject(new Error("No 2D canvas."));
      context.imageSmoothingQuality = "high";
      context.drawImage(picture, 0, 0, width, height);
      return new Promise((resolve, reject) =>
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("The canvas wrote nothing."))),
          type,
          quality,
        ),
      );
    },
  };
}

/** Reduces an image the writer chose (as the core read it) to the picture and the thumbnail of an element. */
export async function reduceImage(
  chosen: { data: string; mediaType: string },
  decode: (blob: Blob) => Promise<ImageBitmap> = (blob) => createImageBitmap(blob),
): Promise<{ image: Reduced; thumbnail: Reduced }> {
  const picture = await decode(new Blob([base64ToBytes(chosen.data)], { type: chosen.mediaType }));
  try {
    const painter = canvasPainter(picture);
    return {
      image: await encodeFitting(
        painter,
        fitted(picture.width, picture.height, FULL_SIDE),
        MAX_FULL_BYTES,
      ),
      thumbnail: await encodeFitting(
        painter,
        fitted(picture.width, picture.height, THUMBNAIL_SIDE),
        MAX_THUMBNAIL_BYTES,
      ),
    };
  } finally {
    picture.close();
  }
}

/** The longest side of the cover of a book, as readers of EPUB recommend. */
export const COVER_SIDE = 2560;

/** Reduces the image the writer chose for the cover of the book: a JPEG, which every reader shows. */
export async function reduceCover(
  chosen: { data: string; mediaType: string },
  decode: (blob: Blob) => Promise<ImageBitmap> = (blob) => createImageBitmap(blob),
): Promise<Reduced> {
  const picture = await decode(new Blob([base64ToBytes(chosen.data)], { type: chosen.mediaType }));
  try {
    return await encodeFitting(
      canvasPainter(picture),
      fitted(picture.width, picture.height, COVER_SIDE),
      MAX_FULL_BYTES,
      true,
    );
  } finally {
    picture.close();
  }
}
