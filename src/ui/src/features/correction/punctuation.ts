/**
 * Rules of Spanish punctuation, each a pure function over the text of one paragraph. They only point:
 * nothing changes unless the writer takes the fix.
 */

export type PunctuationRule =
  | "unclosed"
  | "unopened"
  | "spaceBefore"
  | "spaceAfter"
  | "doubleSpace"
  | "lowercaseStart"
  | "dialogueDash";

export interface PunctuationIssue {
  rule: PunctuationRule;
  /** Where the problem is, in UTF-16 units of the paragraph's text. */
  start: number;
  length: number;
  message: string;
  /** What replaces that stretch to fix it, when the fix is clear. */
  fix?: string;
}

const PAIRS: readonly { open: string; close: string }[] = [
  { open: "¿", close: "?" },
  { open: "¡", close: "!" },
];

/** Opening signs without their closing one in the paragraph, and closing signs without an opening one. */
export function unmatchedSigns(text: string): PunctuationIssue[] {
  const issues: PunctuationIssue[] = [];
  for (const { open, close } of PAIRS) {
    const opened: number[] = [];
    for (let index = 0; index < text.length; index++) {
      if (text[index] === open) opened.push(index);
      else if (text[index] === close) {
        if (opened.length > 0) opened.pop();
        else
          issues.push({
            rule: "unopened",
            start: index,
            length: 1,
            message: `Falta el signo de apertura «${open}».`,
          });
      }
    }
    for (const index of opened)
      issues.push({
        rule: "unclosed",
        start: index,
        length: 1,
        message: `Este «${open}» no se cierra con «${close}».`,
      });
  }
  return issues;
}

/** Spaces before a sign that goes right after the word: a comma, a full stop, a closing sign. */
export function spaceBefore(text: string): PunctuationIssue[] {
  const issues: PunctuationIssue[] = [];
  for (const match of text.matchAll(/(?<=\S)[  ]+(?=[,.;:?!)»”])/gu)) {
    // An ellipsis written with dots may follow a space when it stands for words left out: «y luego ...».
    if (text.startsWith("...", match.index + match[0].length)) continue;
    issues.push({
      rule: "spaceBefore",
      start: match.index,
      length: match[0].length,
      message: `Sobra el espacio antes de «${text[match.index + match[0].length]}».`,
      fix: "",
    });
  }
  return issues;
}

/** A comma, a semicolon or a colon stuck to the next word. */
export function spaceAfter(text: string): PunctuationIssue[] {
  const issues: PunctuationIssue[] = [];
  for (const match of text.matchAll(/(?<=\p{L})[,;:](?=\p{L})/gu)) {
    issues.push({
      rule: "spaceAfter",
      start: match.index,
      length: 1,
      message: `Falta un espacio después de «${match[0]}».`,
      fix: `${match[0]} `,
    });
  }
  return issues;
}

/** Two or more spaces between words. */
export function doubleSpaces(text: string): PunctuationIssue[] {
  const issues: PunctuationIssue[] = [];
  for (const match of text.matchAll(/(?<=\S) {2,}(?=\S)/g)) {
    issues.push({
      rule: "doubleSpace",
      start: match.index,
      length: match[0].length,
      message: "Hay más de un espacio seguido.",
      fix: " ",
    });
  }
  return issues;
}

/** Words that end with a full stop and do not end a sentence. */
const ABBREVIATIONS = new Set([
  "sr",
  "sra",
  "srta",
  "sres",
  "dr",
  "dra",
  "ud",
  "uds",
  "vd",
  "vds",
  "d",
  "dña",
  "etc",
  "pág",
  "págs",
  "p",
  "pp",
  "ej",
  "núm",
  "art",
  "cap",
  "vol",
  "ed",
  "av",
  "avda",
  "prof",
  "lic",
  "fr",
  "sto",
  "sta",
  "s",
  "a",
  "c",
  "aprox",
  "cf",
  "vs",
]);

/** A sentence that starts with a small letter after a full stop. */
export function lowercaseStarts(text: string): PunctuationIssue[] {
  const issues: PunctuationIssue[] = [];
  for (const match of text.matchAll(/(\p{L}+)?\.([  ]+)(\p{Ll})/gu)) {
    const before = match[1]?.toLocaleLowerCase("es");
    // «etc. y otros», «Sr. García» or the dots of an ellipsis do not end a sentence.
    if (before && ABBREVIATIONS.has(before)) continue;
    if (match.index > 0 && text[match.index - 1] === ".") continue;
    if (!before && match.index > 0 && text[match.index - 1] === ".") continue;
    const at = match.index + match[0].length - 1;
    issues.push({
      rule: "lowercaseStart",
      start: at,
      length: 1,
      message: "La frase empieza en minúscula después de un punto.",
      fix: match[3]!.toLocaleUpperCase("es"),
    });
  }
  return issues;
}

/** A dialogue that starts with a hyphen or a short dash instead of the long dash. */
export function dialogueDash(text: string): PunctuationIssue[] {
  const match = /^(?:--?|–)[  ]*(?=[\p{L}¿¡«"])/u.exec(text);
  if (!match) return [];
  return [
    {
      rule: "dialogueDash",
      start: 0,
      length: match[0].length,
      message: "Los diálogos empiezan con raya (—), pegada a la primera palabra.",
      fix: "—",
    },
  ];
}

/** Every punctuation problem of a paragraph, in the order of the text. */
export function punctuationIssues(text: string): PunctuationIssue[] {
  return [
    ...unmatchedSigns(text),
    ...spaceBefore(text),
    ...spaceAfter(text),
    ...doubleSpaces(text),
    ...lowercaseStarts(text),
    ...dialogueDash(text),
  ].sort((a, b) => a.start - b.start || a.length - b.length);
}
