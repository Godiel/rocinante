import { Extension, Mark, Node } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

// A note's text lives in the core, never in the document: the text only carries an anchor with
// the note's id. A passage gets the noteAnchor mark; a point gets the notePoint node. The core
// reads both to know which notes are still anchored (see DocumentContent in the core).

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    noteAnchors: {
      /** Anchors a note over the selected passage, or at the cursor if nothing is selected. */
      anchorNote: (noteId: string, range?: { from: number; to: number }) => ReturnType;
      /** Removes every anchor of a note from the text. The text itself stays. */
      removeNoteAnchors: (noteId: string) => ReturnType;
    };
  }
}

/** Where a note is anchored in a document: a passage, or a point (from === to). */
export interface AnchorPlace {
  from: number;
  to: number;
}

const idAttribute = {
  noteId: {
    default: null as string | null,
    parseHTML: (element: HTMLElement) => element.dataset.noteId ?? null,
    renderHTML: (attributes: Record<string, unknown>) => ({ "data-note-id": attributes.noteId }),
  },
};

/** A note over a passage: a discreet underline that does not grow when typing at its edges. */
export const NoteAnchor = Mark.create({
  name: "noteAnchor",
  inclusive: false,
  excludes: "",
  spanning: true,

  addAttributes() {
    return idAttribute;
  },

  parseHTML() {
    return [{ tag: "span[data-note-anchor]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", { ...HTMLAttributes, "data-note-anchor": "", class: "note-anchor" }, 0];
  },
});

/** A note at a point: a small mark between two letters, with no text of its own. */
export const NotePoint = Node.create({
  name: "notePoint",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return idAttribute;
  },

  parseHTML() {
    return [{ tag: "span[data-note-point]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      { ...HTMLAttributes, "data-note-point": "", class: "note-point", "aria-label": "Nota" },
    ];
  },
});

/** The commands to place and remove anchors, for both kinds. */
export const NoteAnchors = Extension.create({
  name: "noteAnchors",

  addCommands() {
    return {
      anchorNote:
        (noteId, range) =>
        ({ state, chain }) => {
          const { from, to } = range ?? state.selection;
          return from === to
            ? chain().insertContentAt(from, { type: "notePoint", attrs: { noteId } }).run()
            : chain()
                .setTextSelection({ from, to })
                .setMark("noteAnchor", { noteId })
                .setTextSelection(to)
                .run();
        },
      removeNoteAnchors:
        (noteId) =>
        ({ tr, state, dispatch }) => {
          const places = anchorsOf(state.doc).get(noteId) ?? [];
          if (places.length === 0) return false;
          const markType = state.schema.marks.noteAnchor;
          // From the end backwards, so earlier positions stay valid while deleting points.
          for (const place of [...places].reverse()) {
            if (place.from === place.to) tr.delete(place.from, place.from + 1);
            else if (markType) tr.removeMark(place.from, place.to, markType.create({ noteId }));
          }
          if (dispatch) dispatch(tr);
          return true;
        },
    };
  },
});

/** Every anchor in a document, by note id. Points are reported with from === to. */
export function anchorsOf(doc: ProseMirrorNode): Map<string, AnchorPlace[]> {
  const anchors = new Map<string, AnchorPlace[]>();
  const add = (noteId: unknown, place: AnchorPlace) => {
    if (typeof noteId !== "string") return;
    const places = anchors.get(noteId) ?? [];
    const last = places.at(-1);
    // Adjacent text nodes under the same mark form one passage.
    if (last && last.from !== last.to && place.from !== place.to && last.to === place.from)
      last.to = place.to;
    else places.push(place);
    anchors.set(noteId, places);
  };
  doc.descendants((node, position) => {
    if (node.type.name === "notePoint") add(node.attrs.noteId, { from: position, to: position });
    for (const mark of node.marks) {
      if (mark.type.name === "noteAnchor")
        add(mark.attrs.noteId, { from: position, to: position + node.nodeSize });
    }
  });
  return anchors;
}
