import type { Extensions } from "@tiptap/core";
import { Placeholder } from "@tiptap/extensions";
import { StarterKit } from "@tiptap/starter-kit";
import { Footnote } from "./footnote";
import { Indent } from "./indent";
import { NoteAnchor, NoteAnchors, NotePoint } from "./note-anchors";
import { SceneBreak } from "./scene-break";

/**
 * The editor of the work: the MIT core of TipTap for basic formatting, plus Rocinante's own
 * extensions. Code, strike-through, links and horizontal rules are left out: a novel has no use
 * for them, and the scene break replaces the rule.
 */
/** What an empty chapter says on its first line. */
export const EMPTY_INVITATION = "Empieza a escribir…";

export function bookExtensions(): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      code: false,
      codeBlock: false,
      strike: false,
      link: false,
      horizontalRule: false,
    }),
    Indent,
    SceneBreak,
    Footnote,
    NoteAnchor,
    NotePoint,
    NoteAnchors,
    // An empty chapter says where to write: a faint invitation on its first line.
    Placeholder.configure({ placeholder: EMPTY_INVITATION, showOnlyCurrent: false }),
  ];
}

export { footnotesOf, type FootnoteEntry } from "./footnote";
export { anchorsOf, type AnchorPlace } from "./note-anchors";
export { MAX_INDENT } from "./indent";
