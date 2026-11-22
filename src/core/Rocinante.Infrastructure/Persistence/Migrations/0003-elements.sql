-- Schema v3 of the .rocinante format: the elements of the work, their relationships and the board (feature 004).
-- Documented in docs/format/README.md. Lengths are characters; board positions are board units.

-- Characters, places, plots and other things. Their card sits at (board_x, board_y).
CREATE TABLE element (
    id                 TEXT PRIMARY KEY NOT NULL,
    kind               TEXT NOT NULL CHECK (kind IN ('character', 'place', 'plot', 'other')),
    other_kind         TEXT CHECK (other_kind IS NULL OR length(other_kind) BETWEEN 1 AND 60),
    name               TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
    description        TEXT NOT NULL,
    board_x            REAL NOT NULL CHECK (abs(board_x) <= 1000000),
    board_y            REAL NOT NULL CHECK (abs(board_y) <= 1000000),
    -- The version of the latest image, kept after removing it so a new image never repeats a version.
    last_image_version INTEGER NOT NULL DEFAULT 0 CHECK (last_image_version >= 0),
    created_at         INTEGER NOT NULL,
    deleted_at         INTEGER,
    -- Only an element of kind other names its kind.
    CHECK ((kind = 'other') = (other_kind IS NOT NULL))
) STRICT;

CREATE TABLE element_alias (
    element_id TEXT NOT NULL REFERENCES element (id) ON DELETE CASCADE,
    position   INTEGER NOT NULL CHECK (position >= 0),
    alias      TEXT NOT NULL CHECK (length(alias) BETWEEN 1 AND 200),
    PRIMARY KEY (element_id, position)
) STRICT;

CREATE TABLE element_attribute (
    element_id TEXT NOT NULL REFERENCES element (id) ON DELETE CASCADE,
    position   INTEGER NOT NULL CHECK (position >= 0),
    name       TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
    value      TEXT NOT NULL CHECK (length(value) <= 5000),
    PRIMARY KEY (element_id, position)
) STRICT;

-- The image of an element, already reduced by the UI, and its thumbnail for the card. At most one per element.
CREATE TABLE element_image (
    element_id     TEXT PRIMARY KEY NOT NULL REFERENCES element (id) ON DELETE CASCADE,
    version        INTEGER NOT NULL CHECK (version >= 1),
    image          BLOB NOT NULL,
    image_type     TEXT NOT NULL CHECK (image_type IN ('image/webp', 'image/jpeg')),
    thumbnail      BLOB NOT NULL,
    thumbnail_type TEXT NOT NULL CHECK (thumbnail_type IN ('image/webp', 'image/jpeg'))
) STRICT;

-- Kinds of relationship the writer wrote in this work. Without an inverse a kind is symmetric.
-- The common kinds live in the UI and are only named in relationship.kind as builtin:<name>.
CREATE TABLE relationship_kind (
    id      TEXT PRIMARY KEY NOT NULL,
    forward TEXT NOT NULL CHECK (length(forward) BETWEEN 1 AND 60),
    inverse TEXT CHECK (inverse IS NULL OR length(inverse) BETWEEN 1 AND 60)
) STRICT;

-- Two elements joined by a kind: builtin:<name> or own:<relationship_kind.id>.
CREATE TABLE relationship (
    id      TEXT PRIMARY KEY NOT NULL,
    from_id TEXT NOT NULL REFERENCES element (id) ON DELETE CASCADE,
    to_id   TEXT NOT NULL REFERENCES element (id) ON DELETE CASCADE,
    kind    TEXT NOT NULL CHECK (kind GLOB 'builtin:*' OR kind GLOB 'own:*'),
    CHECK (from_id <> to_id)
) STRICT;

CREATE INDEX relationship_by_from ON relationship (from_id);
CREATE INDEX relationship_by_to ON relationship (to_id);
