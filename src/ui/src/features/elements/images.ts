import { useEffect, useState } from "react";
import { request } from "../../bridge/core";
import type { ElementImageInfo, ImageSize } from "../../bridge/generated/protocol";

/**
 * Images of elements, asked for the first time they are shown and kept by id, version and size. A version
 * never repeats, so a kept image is never taken for a newer one.
 */
const cache = new Map<string, Promise<string>>();

function keyOf(id: string, version: number, size: ImageSize): string {
  return `${id}:${version}:${size}`;
}

/** The image as a `data:` URL, ready for an `<img>`. */
export function imageUrl(id: string, version: number, size: ImageSize): Promise<string> {
  const key = keyOf(id, version, size);
  let url = cache.get(key);
  if (!url) {
    url = request("element.image", { id, size }).then(
      ({ data, mediaType }) => `data:${mediaType};base64,${data}`,
    );
    // A failed request is asked for again next time.
    url.catch(() => cache.delete(key));
    cache.set(key, url);
  }
  return url;
}

/** Forgets every kept image, as when the work closes. */
export function forgetImages(): void {
  cache.clear();
}

/** The image of an element for an `<img>`, or null while it loads or if it has none. */
export function useElementImage(
  id: string,
  image: ElementImageInfo | null,
  size: ImageSize,
): string | null {
  const version = image?.version ?? null;
  const [shown, setShown] = useState<{ key: string; url: string } | null>(null);

  useEffect(() => {
    if (version === null) return;
    let current = true;
    const key = keyOf(id, version, size);
    imageUrl(id, version, size).then(
      (url) => {
        if (current) setShown({ key, url });
      },
      () => {},
    );
    return () => {
      current = false;
    };
  }, [id, version, size]);

  return version !== null && shown?.key === keyOf(id, version, size) ? shown.url : null;
}
