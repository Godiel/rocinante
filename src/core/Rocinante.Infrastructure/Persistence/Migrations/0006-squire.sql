-- Schema v6 of the .rocinante format: the squire (feature 009). Documented in docs/format/README.md.

-- Whether the squire may read this work. Off until the writer turns it on, work by work.
ALTER TABLE project ADD COLUMN squire_enabled INTEGER NOT NULL DEFAULT 0 CHECK (squire_enabled IN (0, 1));

-- What the squire deduced from a paragraph, waiting for the writer, taken or dropped. Exactly one of the
-- element, the relationship or the attribute is set.
CREATE TABLE proposal (
    id                TEXT PRIMARY KEY NOT NULL,
    document_id       TEXT NOT NULL REFERENCES document (id) ON DELETE CASCADE,
    -- The fingerprint (SHA-256) of the paragraph it comes from.
    paragraph         TEXT NOT NULL CHECK (length(paragraph) BETWEEN 1 AND 100),
    passage           TEXT NOT NULL CHECK (length(passage) <= 2000),
    created_at        INTEGER NOT NULL,
    kind              TEXT NOT NULL CHECK (kind IN ('element', 'relationship', 'attribute')),
    -- What makes two proposals the same: the kind and the names, folded.
    proposal_key      TEXT NOT NULL,
    state             TEXT NOT NULL CHECK (state IN ('pending', 'accepted', 'dismissed')),
    element_name      TEXT,
    element_kind      TEXT CHECK (element_kind IS NULL OR element_kind IN ('character', 'place', 'plot', 'other')),
    element_other     TEXT,
    relation_from     TEXT,
    relation_to       TEXT,
    relation_forward  TEXT,
    relation_inverse  TEXT,
    detail_element    TEXT,
    detail_name       TEXT,
    detail_value      TEXT,
    CHECK ((kind = 'element') = (element_name IS NOT NULL AND element_kind IS NOT NULL)),
    CHECK ((kind = 'relationship') = (relation_from IS NOT NULL AND relation_to IS NOT NULL AND relation_forward IS NOT NULL)),
    CHECK ((kind = 'attribute') = (detail_element IS NOT NULL AND detail_name IS NOT NULL AND detail_value IS NOT NULL))
) STRICT;

CREATE INDEX proposal_waiting ON proposal (state, created_at);
CREATE INDEX proposal_by_paragraph ON proposal (document_id, paragraph);

-- The paragraphs the squire already read, by their fingerprint: unchanged, they are not sent again.
CREATE TABLE squire_paragraph (
    document_id TEXT NOT NULL REFERENCES document (id) ON DELETE CASCADE,
    paragraph   TEXT NOT NULL CHECK (length(paragraph) BETWEEN 1 AND 100),
    read_at     INTEGER NOT NULL,
    PRIMARY KEY (document_id, paragraph)
) STRICT;
