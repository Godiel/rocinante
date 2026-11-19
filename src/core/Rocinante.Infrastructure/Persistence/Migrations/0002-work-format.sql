-- Schema v2 of the .rocinante format: the format of the work (feature 002).
-- Lengths are millimetres, the body is points, the leading a multiple of the body.

-- Exactly one row, like project. Works from v1 get the default format: an A5 novel.
CREATE TABLE work_format (
    singleton         INTEGER PRIMARY KEY NOT NULL DEFAULT 1 CHECK (singleton = 1),
    page_size         TEXT NOT NULL CHECK (page_size IN ('pocket', 'a5', 'digest', 'trade', 'a4', 'letter', 'custom')),
    page_width        REAL NOT NULL CHECK (page_width BETWEEN 70 AND 300),
    page_height       REAL NOT NULL CHECK (page_height BETWEEN 70 AND 300),
    margin_top        REAL NOT NULL CHECK (margin_top BETWEEN 0 AND 300),
    margin_bottom     REAL NOT NULL CHECK (margin_bottom BETWEEN 0 AND 300),
    margin_inside     REAL NOT NULL CHECK (margin_inside BETWEEN 0 AND 300),
    margin_outside    REAL NOT NULL CHECK (margin_outside BETWEEN 0 AND 300),
    typeface          TEXT NOT NULL CHECK (typeface IN (
                          'eb_garamond', 'literata', 'crimson_pro', 'source_serif_4', 'libre_baskerville', 'courier_prime')),
    body_size         REAL NOT NULL CHECK (body_size BETWEEN 8 AND 16),
    leading           REAL NOT NULL CHECK (leading BETWEEN 1 AND 2),
    first_line_indent INTEGER NOT NULL CHECK (first_line_indent IN (0, 1)),
    justified         INTEGER NOT NULL CHECK (justified IN (0, 1)),
    drop_cap          INTEGER NOT NULL CHECK (drop_cap IN (0, 1)),
    -- The margins leave a text area of at least 40 × 60 mm.
    CHECK (page_width - margin_inside - margin_outside >= 40),
    CHECK (page_height - margin_top - margin_bottom >= 60)
) STRICT;

INSERT INTO work_format (
    page_size, page_width, page_height, margin_top, margin_bottom, margin_inside, margin_outside,
    typeface, body_size, leading, first_line_indent, justified, drop_cap)
VALUES ('a5', 148, 210, 18, 22, 20, 15, 'eb_garamond', 11, 1.35, 1, 1, 0);
