import type { Extensions } from "@tiptap/core";
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
  ];
}

export { footnotesOf, type FootnoteEntry } from "./footnote";
export { anchorsOf, type AnchorPlace } from "./note-anchors";
export { MAX_INDENT } from "./indent";
