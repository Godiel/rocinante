import { useCallback, useState } from "react";
import { request } from "../../bridge/core";
import { messageFor } from "../../app/messages";
import { savePendingNow } from "../../editor/pending-saves";
import { UndoNotice } from "../outline/UndoNotice";

interface SetAside {
  id: string;
  /** When it went, so a second deletion restarts the notice. */
  at: number;
}

/**
 * Deleting notes and bringing them back. A deleted note is set aside: its mark hides in the text and a notice
 * offers to undo it for a while; the next time the work opens it is gone for good.
 */
export function useNoteTrash(origin: string, onProblem: (message: string | null) => void) {
  const [setAside, setSetAside] = useState<SetAside | null>(null);

  const remove = useCallback(
    async (id: string) => {
      try {
        // What the writer just typed in the note is kept before it goes.
        await savePendingNow();
        await request("note.delete", { id, origin });
        setSetAside({ id, at: Date.now() });
        onProblem(null);
      } catch (error) {
        onProblem(messageFor(error));
      }
    },
    [origin, onProblem],
  );

  const restore = useCallback(
    async (id: string) => {
      setSetAside((current) => (current?.id === id ? null : current));
      try {
        await request("note.restore", { id, origin });
        onProblem(null);
      } catch (error) {
        onProblem(messageFor(error));
      }
    },
    [origin, onProblem],
  );

  const dismiss = useCallback(() => setSetAside(null), []);

  const notice = setAside && (
    <UndoNotice
      key={setAside.at}
      message="La nota se borró."
      onUndo={() => void restore(setAside.id)}
      onDismiss={dismiss}
    />
  );

  return { remove, restore, notice };
}
