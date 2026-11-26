-- Schema v4 of the .rocinante format: notes of the work (feature 005). A note may belong to no
-- document (a loose idea), has formatted content, can be resolved, set aside and linked with
-- elements. Documented in docs/format/README.md.

-- SQLite cannot make a column nullable, so the table is rebuilt and its rows copied, as the
-- SQLite documentation recommends. Notes written before keep their text; their content stays
-- null until they are edited, and the core reads them as one paragraph per line.
CREATE TABLE note_v4 (
    id           TEXT PRIMARY KEY NOT NULL,
    -- Null for a loose idea of the work.
    document_id  TEXT REFERENCES document (id) ON DELETE CASCADE,
    -- Plain text derived from content: what the writer searches and sees in a list.
    text         TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 10000),
    -- TipTap JSON; null for a note written before schema v4 and not edited since.
    content      TEXT,
    anchored     INTEGER NOT NULL CHECK (anchored IN (0, 1)),
    -- Place of the anchor among the anchors of the document's text, from its last save.
    anchor_order INTEGER CHECK (anchor_order >= 0),
    resolved_at  INTEGER,
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL,
    -- Set aside, waiting for an undo; deleted for good the next time the work is opened.
    deleted_at   INTEGER,
    -- A loose idea is never anchored, and only an anchored note has a place in the text.
    CHECK (document_id IS NOT NULL OR anchored = 0),
    CHECK (anchored = 1 OR anchor_order IS NULL)
) STRICT;

INSERT INTO note_v4 (id, document_id, text, content, anchored, anchor_order, resolved_at, created_at, updated_at, deleted_at)
SELECT id, document_id, text, NULL, anchored, NULL, NULL, created_at, updated_at, NULL FROM note;

DROP TABLE note;
ALTER TABLE note_v4 RENAME TO note;

CREATE INDEX note_by_document ON note (document_id, created_at);
CREATE INDEX note_by_creation ON note (created_at);

-- The elements a note is linked with, in the order the writer linked them.
CREATE TABLE note_element (
    note_id    TEXT NOT NULL REFERENCES note (id) ON DELETE CASCADE,
    element_id TEXT NOT NULL REFERENCES element (id) ON DELETE CASCADE,
    position   INTEGER NOT NULL CHECK (position >= 0),
    PRIMARY KEY (note_id, element_id)
) STRICT;

CREATE INDEX note_element_by_element ON note_element (element_id);
