-- Schema v8 of the .rocinante format: the book the work is exported as (feature 011). Documented in
-- docs/format/README.md.

-- Exactly one row: the author as it goes on the cover, the credits (null for the default) and the cover image,
-- a JPEG reduced by the UI, for EPUB. The cover version is kept after removing it so a new one never repeats it.
CREATE TABLE book (
    singleton          INTEGER PRIMARY KEY NOT NULL DEFAULT 1 CHECK (singleton = 1),
    author             TEXT NOT NULL DEFAULT '' CHECK (length(author) <= 200),
    credits            TEXT CHECK (credits IS NULL OR length(credits) BETWEEN 1 AND 2000),
    cover              BLOB,
    cover_version      INTEGER CHECK (cover_version IS NULL OR cover_version >= 1),
    last_cover_version INTEGER NOT NULL DEFAULT 0 CHECK (last_cover_version >= 0),
    CHECK ((cover IS NULL) = (cover_version IS NULL))
) STRICT;

INSERT INTO book (singleton) VALUES (1);
