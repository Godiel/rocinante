import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { nameFromSelection } from "../elements/panel";

interface Action {
  label: string;
  /** Full name and shortcut, for the tooltip and screen readers. */
  hint: string;
  isActive?: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
}

const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);
const mod = isMac ? "⌘" : "Ctrl";
const alt = isMac ? "⌥" : "Alt";

/** The formatting a writer reaches for while revising, in the order of the hand. */
function actions(onNote: () => void, onFootnote: () => void): Action[] {
  return [
    {
      label: "N",
      hint: `Negrita (${mod}+B)`,
      isActive: (e) => e.isActive("bold"),
      run: (e) => e.chain().focus().toggleBold().run(),
    },
    {
      label: "C",
      hint: `Cursiva (${mod}+I)`,
      isActive: (e) => e.isActive("italic"),
      run: (e) => e.chain().focus().toggleItalic().run(),
    },
    {
      label: "S",
      hint: `Subrayado (${mod}+U)`,
      isActive: (e) => e.isActive("underline"),
      run: (e) => e.chain().focus().toggleUnderline().run(),
    },
    {
      label: "Título",
      hint: `Título (${mod}+${alt}+1)`,
      isActive: (e) => e.isActive("heading"),
      run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      label: "Cita",
      hint: `Cita (${mod}+Mayús+B)`,
      isActive: (e) => e.isActive("blockquote"),
      run: (e) => e.chain().focus().toggleBlockquote().run(),
    },
    {
      label: "Lista",
      hint: `Lista (${mod}+Mayús+8)`,
      isActive: (e) => e.isActive("bulletList"),
      run: (e) => e.chain().focus().toggleBulletList().run(),
    },
    {
      label: "Sangría",
      hint: "Sangría (Tab; Mayús+Tab para quitarla)",
      run: (e) => e.chain().focus().indent().run(),
    },
    { label: "Nota", hint: `Nota (${mod}+${alt}+N)`, run: () => onNote() },
    { label: "Nota al pie", hint: `Nota al pie (${mod}+${alt}+F)`, run: () => onFootnote() },
  ];
}

interface BubbleToolbarProps {
  editor: Editor;
  onNote(): void;
  onFootnote(): void;
  /** Makes a ficha named after the selection; without it the menu does not offer one. */
  onCreateElement?(name: string): void;
  /** Marks what happens to a ficha at the paragraph of the selection; without it the menu does not offer it. */
  onMilestone?(): void;
}

/** A discreet row of formatting that appears over selected text and leaves when it is deselected. */
export function BubbleToolbar({
  editor,
  onNote,
  onFootnote,
  onCreateElement,
  onMilestone,
}: BubbleToolbarProps) {
  const list = actions(onNote, onFootnote);
  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => list.map((action) => action.isActive?.(current) ?? false),
  });

  return (
    <BubbleMenu
      editor={editor}
      className="bubble-toolbar"
      options={{ placement: "top", offset: 10 }}
    >
      <div role="toolbar" aria-label="Formato">
        {list.map((action, index) => (
          <button
            key={action.label}
            type="button"
            className={`bubble-button${active[index] ? " bubble-button-active" : ""}`}
            aria-label={action.hint}
            aria-pressed={action.isActive ? active[index] : undefined}
            title={action.hint}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => action.run(editor)}
          >
            {action.label}
          </button>
        ))}
        {onCreateElement && (
          <button
            type="button"
            className="bubble-button bubble-button-element"
            aria-label="Crear ficha con este nombre"
            title="Crear ficha con este nombre"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              const { from, to } = editor.state.selection;
              const name = nameFromSelection(editor.state.doc.textBetween(from, to, " "));
              if (name !== "") onCreateElement(name);
            }}
          >
            Crear ficha
          </button>
        )}
        {onMilestone && (
          <button
            type="button"
            className="bubble-button bubble-button-element"
            aria-label="Marcar un hito en este párrafo"
            title="Marcar un hito en este párrafo"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onMilestone}
          >
            Hito
          </button>
        )}
      </div>
    </BubbleMenu>
  );
}
