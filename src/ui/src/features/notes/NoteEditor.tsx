import { Extension } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useRef } from "react";
import type { TipTapDocument } from "../../bridge/generated/protocol";
import { descriptionExtensions } from "../elements/description-extensions";
import "./notes.css";

export interface NoteEditorProps {
  content: TipTapDocument;
  label: string;
  /** Whether the writer has changes on their way: a change from another window waits until they arrive. */
  dirty?: boolean;
  autoFocus?: boolean;
  /** Ctrl+Enter or ⌘+Enter, to keep the note. */
  onSubmit?(): void;
  onChange(content: TipTapDocument, text: string): void;
}

/**
 * The text of a note: paragraphs, cursive and bold, as the description of a ficha. It keeps its own keys:
 * the shortcuts of the work (Ctrl+S, F5, F6, F11…) leave it alone, marked by `data-own-keys`.
 */
export function NoteEditor({
  content,
  label,
  dirty = false,
  autoFocus = false,
  onSubmit,
  onChange,
}: NoteEditorProps) {
  const latest = useRef({ onChange, onSubmit });
  useEffect(() => {
    latest.current = { onChange, onSubmit };
  }, [onChange, onSubmit]);

  const editor = useEditor({
    extensions: [
      ...descriptionExtensions(),
      // Before the line break of the starter kit, which also answers to Ctrl+Enter.
      Extension.create({
        name: "noteSubmit",
        priority: 1000,
        addKeyboardShortcuts: () => ({
          "Mod-Enter": () => {
            if (!latest.current.onSubmit) return false;
            latest.current.onSubmit();
            return true;
          },
        }),
      }),
    ],
    content,
    autofocus: autoFocus ? "end" : false,
    editorProps: { attributes: { "aria-label": label, "aria-multiline": "true", role: "textbox" } },
    onUpdate: ({ editor: changed }) =>
      latest.current.onChange(
        changed.getJSON() as TipTapDocument,
        changed.getText({ blockSeparator: "\n" }),
      ),
  });

  // What another window wrote shows here, unless the writer is in the middle of it.
  useEffect(() => {
    if (!editor || dirty || editor.isFocused) return;
    if (JSON.stringify(editor.getJSON()) === JSON.stringify(content)) return;
    editor.commands.setContent(content, { emitUpdate: false });
  }, [editor, content, dirty]);

  return (
    <div className="note-editor" data-own-keys="">
      <EditorContent editor={editor} />
    </div>
  );
}
