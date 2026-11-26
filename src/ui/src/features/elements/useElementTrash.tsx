import { useCallback, useState } from "react";
import { request } from "../../bridge/core";
import { messageFor } from "../../app/messages";
import { savePendingNow } from "../../editor/pending-saves";
import { UndoNotice } from "../outline/UndoNotice";

interface Trashed {
  id: string;
  name: string;
  /** When it went, so a second deletion restarts the notice. */
  at: number;
}

/**
 * Sending fichas to the trash and bringing them back. A ficha goes with its relationships and keeps its place on
 * the board; a notice offers to undo it for a while.
 */
export function useElementTrash(origin: string, onProblem: (message: string | null) => void) {
  const [trashed, setTrashed] = useState<Trashed | null>(null);

  const trash = useCallback(
    async (id: string, name: string) => {
      try {
        // What the writer just typed in the ficha is kept before it goes.
        await savePendingNow();
        await request("element.delete", { id, origin });
        setTrashed({ id, name, at: Date.now() });
        onProblem(null);
      } catch (error) {
        onProblem(messageFor(error));
      }
    },
    [origin, onProblem],
  );

  const restore = useCallback(
    async (id: string) => {
      setTrashed((current) => (current?.id === id ? null : current));
      try {
        await request("element.restore", { id, origin });
        onProblem(null);
      } catch (error) {
        onProblem(messageFor(error));
      }
    },
    [origin, onProblem],
  );

  const dismiss = useCallback(() => setTrashed(null), []);

  const notice = trashed && (
    <UndoNotice
      key={trashed.at}
      message={`«${trashed.name}» está en la papelera.`}
      onUndo={() => void restore(trashed.id)}
      onDismiss={dismiss}
    />
  );

  return { trash, restore, notice };
}
