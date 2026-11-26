import { useEffect, useState } from "react";
import { onNotification, request } from "../../bridge/core";
import type { BookDetails } from "../../bridge/generated/protocol";

/** The author, the credits and the cover of the open work, kept current from any window. */
export function useBook(): BookDetails | null {
  const [book, setBook] = useState<BookDetails | null>(null);

  useEffect(() => {
    let current = true;
    void request("book.get").then(
      (details) => {
        if (current) setBook(details);
      },
      () => {},
    );
    const stop = onNotification("book.changed", (change) => setBook(change.book));
    return () => {
      current = false;
      void stop.then((unlisten) => unlisten());
    };
  }, []);

  return book;
}
