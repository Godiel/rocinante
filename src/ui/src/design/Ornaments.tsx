// Classical typographic ornaments, drawn for Rocinante. They take the colour of the text around
// them (currentColor) and are hidden from screen readers: they decorate, they do not inform.

interface OrnamentProps {
  /** Height in px; the width follows the drawing. */
  size?: number;
  className?: string;
}

/**
 * A hedera, the ivy leaf printers have set between sections since the fifteenth century: a
 * leaf turned on its side, with its vein and a curled stem.
 */
export function Fleuron({ size = 18, className }: OrnamentProps) {
  return (
    <svg
      className={className}
      width={size * 1.25}
      height={size}
      viewBox="0 0 30 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M6 12c3.2-6.4 9.6-9 17-7.6-1.4 1.6-2.2 3.6-2.2 7.6s.8 6 2.2 7.6C15.6 21 9.2 18.4 6 12Z"
        fill="currentColor"
      />
      <path d="M8.6 12h11.4" stroke="var(--color-paper)" strokeWidth="0.9" strokeLinecap="round" />
      <path
        d="M6 12C4.6 12 3 11.2 2.4 9.6c-.5-1.3.2-2.6 1.4-2.6 1 0 1.6.8 1.3 1.6"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A thin rule with a small lozenge in the middle, to close a passage or a screen. */
export function Rule({ size = 10, className }: OrnamentProps) {
  return (
    <svg
      className={className}
      width={size * 12}
      height={size}
      viewBox="0 0 120 10"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M0 5h52M68 5h52" stroke="currentColor" strokeWidth="0.6" />
      <path d="M60 1.5 63.5 5 60 8.5 56.5 5Z" fill="currentColor" />
    </svg>
  );
}
