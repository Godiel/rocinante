import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useRef } from "react";
import type { TipTapDocument } from "../../bridge/generated/protocol";
import { descriptionExtensions } from "./description-extensions";

export interface DescriptionEditorProps {
  content: TipTapDocument;
  label: string;
  /** Whether the writer has changes on their way: a change from another window waits until they arrive. */
  dirty: boolean;
  onChange(content: TipTapDocument): void;
}

/**
 * The long text of a ficha. It keeps its own keys: the shortcuts of the work (Ctrl+S, F5, F6, F11…) leave it
 * alone, marked by `data-own-keys`.
 */
export function DescriptionEditor({ content, label, dirty, onChange }: DescriptionEditorProps) {
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    extensions: descriptionExtensions(),
    content,
    editorProps: { attributes: { "aria-label": label, "aria-multiline": "true", role: "textbox" } },
    onUpdate: ({ editor: changed }) => latest.current(changed.getJSON() as TipTapDocument),
  });

  // What another window wrote shows here, unless the writer is in the middle of it.
  useEffect(() => {
    if (!editor || dirty || editor.isFocused) return;
    if (JSON.stringify(editor.getJSON()) === JSON.stringify(content)) return;
    editor.commands.setContent(content, { emitUpdate: false });
  }, [editor, content, dirty]);

  return (
    <div className="element-description" data-own-keys="">
      <EditorContent editor={editor} />
    </div>
  );
}
