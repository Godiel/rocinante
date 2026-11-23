import { StarterKit } from "@tiptap/starter-kit";

/** Only paragraphs, cursive and bold: a ficha is notes about the work, not the work. */
export function descriptionExtensions() {
  return [
    StarterKit.configure({
      heading: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      listKeymap: false,
      blockquote: false,
      code: false,
      codeBlock: false,
      strike: false,
      underline: false,
      link: false,
      horizontalRule: false,
    }),
  ];
}
