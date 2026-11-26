-- Schema v7 of the .rocinante format: the threads of fate (feature 010). Documented in docs/format/README.md.

-- The chapters a relationship holds between, both included. Null: from the start, or to the end, of the work.
ALTER TABLE relationship ADD COLUMN starts_at TEXT REFERENCES document (id) ON DELETE SET NULL;
ALTER TABLE relationship ADD COLUMN ends_at TEXT REFERENCES document (id) ON DELETE SET NULL;

-- Something that happens to an element at a paragraph of a chapter. The paragraph is kept as it was last found,
-- with its place, to find it again as the text changes; lost when no paragraph is it any longer.
CREATE TABLE milestone (
    id          TEXT PRIMARY KEY NOT NULL,
    element_id  TEXT NOT NULL REFERENCES element (id) ON DELETE CASCADE,
    document_id TEXT NOT NULL REFERENCES document (id) ON DELETE CASCADE,
    paragraph   TEXT NOT NULL CHECK (length(paragraph) <= 20000),
    block       INTEGER NOT NULL CHECK (block >= 0),
    text        TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 300),
    lost        INTEGER NOT NULL CHECK (lost IN (0, 1)),
    created_at  INTEGER NOT NULL
) STRICT;

CREATE INDEX milestone_by_document ON milestone (document_id, block);

-- The elements shown in the threads, in order. Until the writer chooses (threads_chosen = 0), the core shows
-- the characters mentioned the most.
ALTER TABLE project ADD COLUMN threads_chosen INTEGER NOT NULL DEFAULT 0 CHECK (threads_chosen IN (0, 1));

CREATE TABLE thread_choice (
    element_id TEXT PRIMARY KEY NOT NULL REFERENCES element (id) ON DELETE CASCADE,
    position   INTEGER NOT NULL CHECK (position >= 0)
) STRICT;

-- The squire also proposes milestones. A CHECK cannot change in SQLite, so the proposals move to a new table.
CREATE TABLE proposal_v7 (
    id                TEXT PRIMARY KEY NOT NULL,
    document_id       TEXT NOT NULL REFERENCES document (id) ON DELETE CASCADE,
    paragraph         TEXT NOT NULL CHECK (length(paragraph) BETWEEN 1 AND 100),
    passage           TEXT NOT NULL CHECK (length(passage) <= 2000),
    created_at        INTEGER NOT NULL,
    kind              TEXT NOT NULL CHECK (kind IN ('element', 'relationship', 'attribute', 'milestone')),
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
    milestone_element TEXT,
    milestone_text    TEXT,
    CHECK ((kind = 'element') = (element_name IS NOT NULL AND element_kind IS NOT NULL)),
    CHECK ((kind = 'relationship') = (relation_from IS NOT NULL AND relation_to IS NOT NULL AND relation_forward IS NOT NULL)),
    CHECK ((kind = 'attribute') = (detail_element IS NOT NULL AND detail_name IS NOT NULL AND detail_value IS NOT NULL)),
    CHECK ((kind = 'milestone') = (milestone_element IS NOT NULL AND milestone_text IS NOT NULL))
) STRICT;

INSERT INTO proposal_v7 (
    id, document_id, paragraph, passage, created_at, kind, proposal_key, state, element_name, element_kind,
    element_other, relation_from, relation_to, relation_forward, relation_inverse, detail_element, detail_name,
    detail_value)
SELECT
    id, document_id, paragraph, passage, created_at, kind, proposal_key, state, element_name, element_kind,
    element_other, relation_from, relation_to, relation_forward, relation_inverse, detail_element, detail_name,
    detail_value
FROM proposal;

DROP TABLE proposal;
ALTER TABLE proposal_v7 RENAME TO proposal;

CREATE INDEX proposal_waiting ON proposal (state, created_at);
CREATE INDEX proposal_by_paragraph ON proposal (document_id, paragraph);
