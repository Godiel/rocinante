-- Schema v5 of the .rocinante format: names the writer chose not to see suggested as fichas (feature 007).
-- Documented in docs/format/README.md.

-- Each name is kept as it is compared: its words folded (no case or accents, the ñ kept) and joined by a
-- space, as MentionFinder.Key gives it.
CREATE TABLE dismissed_name (
    name         TEXT PRIMARY KEY NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
    dismissed_at INTEGER NOT NULL
) STRICT;
