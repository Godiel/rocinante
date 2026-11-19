-- Schema v1 of the .rocinante format. Documented in docs/format/README.md.
-- Times are Unix milliseconds (UTC); identifiers are UUID v7 in canonical text form.

CREATE TABLE meta (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
) STRICT;

-- Exactly one row: a file holds one project.
CREATE TABLE project (
    id         TEXT PRIMARY KEY NOT NULL,
    singleton  INTEGER NOT NULL DEFAULT 1 UNIQUE CHECK (singleton = 1),
    title      TEXT NOT NULL,
    created_at INTEGER NOT NULL
) STRICT;

-- Chapters and fragments. The index columns belong to Project, the text columns to Document.
CREATE TABLE document (
    id                  TEXT PRIMARY KEY NOT NULL,
    kind                TEXT NOT NULL CHECK (kind IN ('chapter', 'fragment')),
    title               TEXT NOT NULL,
    position            INTEGER NOT NULL CHECK (position >= 0),
    created_at          INTEGER NOT NULL,
    deleted_at          INTEGER,
    content             TEXT NOT NULL,
    revision            INTEGER NOT NULL CHECK (revision >= 0),
    updated_at          INTEGER NOT NULL,
    words               INTEGER NOT NULL CHECK (words >= 0),
    characters          INTEGER NOT NULL CHECK (characters >= 0),
    paragraphs          INTEGER NOT NULL CHECK (paragraphs >= 0),
    active_writing_ms   INTEGER NOT NULL CHECK (active_writing_ms >= 0),
    last_edit_at        INTEGER,
    unversioned_changes INTEGER NOT NULL CHECK (unversioned_changes IN (0, 1))
) STRICT;

CREATE INDEX document_by_place ON document (kind, position) WHERE deleted_at IS NULL;

CREATE TABLE document_version (
    id          TEXT PRIMARY KEY NOT NULL,
    document_id TEXT NOT NULL REFERENCES document (id) ON DELETE CASCADE,
    kind        TEXT NOT NULL CHECK (kind IN ('automatic', 'manual', 'before_restore')),
    name        TEXT,
    created_at  INTEGER NOT NULL,
    content     TEXT NOT NULL,
    words       INTEGER NOT NULL CHECK (words >= 0),
    characters  INTEGER NOT NULL CHECK (characters >= 0),
    paragraphs  INTEGER NOT NULL CHECK (paragraphs >= 0)
) STRICT;

CREATE INDEX document_version_by_document ON document_version (document_id, created_at);

-- Notes the writer leaves on a document. The text only holds an anchor with the note id.
CREATE TABLE note (
    id          TEXT PRIMARY KEY NOT NULL,
    document_id TEXT NOT NULL REFERENCES document (id) ON DELETE CASCADE,
    text        TEXT NOT NULL,
    anchored    INTEGER NOT NULL CHECK (anchored IN (0, 1)),
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
) STRICT;

CREATE INDEX note_by_document ON note (document_id, created_at);
