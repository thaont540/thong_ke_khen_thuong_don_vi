-- CR 19/10/2026 (phase A): Cục CSGT, xếp loại cán bộ theo năm, năm sinh / số hiệu không bắt buộc.
-- D1: PRAGMA foreign_keys cannot be changed, so tables whose CHECK / NOT NULL must change are
-- rebuilt under defer_foreign_keys (checked at commit): copy rows to <t>_bak, drop the table,
-- create it again under its final name, copy rows back (this is what clears the deferred
-- violations; the create-new/rename variant does NOT, SQLite only counts inserts into the parent).
-- Every row id is preserved. Triggers that mention a rebuilt table are dropped first and recreated
-- verbatim afterwards; indexes of rebuilt tables are recreated verbatim.
PRAGMA defer_foreign_keys = ON;

DROP TRIGGER trg_units_no_delete_used;
DROP TRIGGER trg_teams_no_delete_used;
DROP TRIGGER trg_awards_check_ins;
DROP TRIGGER trg_awards_check_upd;

-- ---------------------------------------------------------------------
-- 1. units.kind += 'CUC'. DROP TABLE units runs an implicit DELETE whose ON DELETE CASCADE would
--    remove teams, so teams are parked in teams_bak and restored right after units is repopulated.
-- ---------------------------------------------------------------------
CREATE TABLE teams_bak AS SELECT * FROM teams;
CREATE TABLE units_bak AS SELECT * FROM units;
DROP TABLE units;

CREATE TABLE units (
  id           INTEGER PRIMARY KEY,
  code         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  name         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  kind         TEXT    NOT NULL CHECK (kind IN ('CUC', 'PHONG', 'THUY_DOAN')),
  description  TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO units (id, code, name, kind, description, sort_order, created_at, updated_at)
  SELECT id, code, name, kind, description, sort_order, created_at, updated_at FROM units_bak;
DROP TABLE units_bak;

INSERT OR IGNORE INTO teams SELECT * FROM teams_bak;
DROP TABLE teams_bak;

INSERT OR IGNORE INTO units (code, name, kind, description, sort_order)
VALUES ('C08', 'Cục Cảnh sát giao thông', 'CUC', 'Cục CSGT, đầu mối cấp trên các phòng, thủy đoàn', 0);

-- ---------------------------------------------------------------------
-- 2. award_types.form += 'XEP_LOAI'
-- ---------------------------------------------------------------------
CREATE TABLE award_types_bak AS SELECT * FROM award_types;
DROP TABLE award_types;

CREATE TABLE award_types (
  id                    INTEGER PRIMARY KEY,
  code                  TEXT    NOT NULL UNIQUE,
  name                  TEXT    NOT NULL UNIQUE,
  form                  TEXT    NOT NULL CHECK (form IN ('DANH_HIEU', 'KHEN_THUONG', 'XEP_LOAI')),
  subject_scope         TEXT    NOT NULL CHECK (subject_scope IN ('TAP_THE', 'CA_NHAN', 'CA_HAI')),
  default_authority_id  INTEGER NOT NULL REFERENCES authorities(id),
  requires_variant      INTEGER NOT NULL DEFAULT 0 CHECK (requires_variant IN (0, 1)),
  sort_order            INTEGER NOT NULL DEFAULT 0,
  is_active             INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
);
INSERT INTO award_types
  (id, code, name, form, subject_scope, default_authority_id, requires_variant, sort_order, is_active)
  SELECT id, code, name, form, subject_scope, default_authority_id, requires_variant, sort_order, is_active
  FROM award_types_bak;
DROP TABLE award_types_bak;

-- ---------------------------------------------------------------------
-- 3. officers.birth_year / badge_number nullable (CHECKs only bite when a value is present).
--    rating_id / officer_ratings are DEPRECATED (kept to avoid risky drops, no longer read or
--    written): the current rating is the latest-year XEP_LOAI award of the officer.
-- ---------------------------------------------------------------------
CREATE TABLE officers_bak AS SELECT * FROM officers;
DROP TABLE officers;

CREATE TABLE officers (
  id                INTEGER PRIMARY KEY,
  code              TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  full_name         TEXT    NOT NULL,
  full_name_search  TEXT    NOT NULL,
  birth_year        INTEGER CHECK (birth_year IS NULL OR birth_year BETWEEN 1950 AND 2010),
  badge_number      TEXT    CHECK (badge_number IS NULL OR badge_number GLOB '[0-9][0-9][0-9][0-9][0-9][0-9]'),
  rank_id           INTEGER NOT NULL REFERENCES ranks(id),
  position_id       INTEGER NOT NULL REFERENCES positions(id),
  unit_id           INTEGER NOT NULL REFERENCES units(id),
  team_id           INTEGER REFERENCES teams(id),
  created_by        INTEGER REFERENCES users(id),
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  deleted_at        TEXT,
  joined_month      TEXT
    CHECK (joined_month IS NULL OR (
      joined_month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'
      AND substr(joined_month, 6, 2) BETWEEN '01' AND '12')),
  rating_id         INTEGER REFERENCES officer_ratings(id)  -- deprecated, see above
);
INSERT INTO officers
  (id, code, full_name, full_name_search, birth_year, badge_number, rank_id, position_id, unit_id,
   team_id, created_by, created_at, updated_at, deleted_at, joined_month, rating_id)
  SELECT id, code, full_name, full_name_search, birth_year, badge_number, rank_id, position_id, unit_id,
         team_id, created_by, created_at, updated_at, deleted_at, joined_month, rating_id
  FROM officers_bak;
DROP TABLE officers_bak;

-- Số hiệu không trùng giữa các cán bộ chưa xóa; NULL không bị coi là trùng nhau.
CREATE UNIQUE INDEX ux_officers_badge ON officers(badge_number) WHERE deleted_at IS NULL;
CREATE INDEX ix_officers_unit_team ON officers(unit_id, team_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_officers_team_ins BEFORE INSERT ON officers
WHEN NEW.team_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM teams WHERE id = NEW.team_id AND unit_id = NEW.unit_id)
BEGIN SELECT RAISE(ABORT, 'Đội không thuộc đơn vị của cán bộ'); END;

CREATE TRIGGER trg_officers_team_upd BEFORE UPDATE OF unit_id, team_id ON officers
WHEN NEW.team_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM teams WHERE id = NEW.team_id AND unit_id = NEW.unit_id)
BEGIN SELECT RAISE(ABORT, 'Đội không thuộc đơn vị của cán bộ'); END;

-- ---------------------------------------------------------------------
-- 4. Recreate triggers dropped above (identical to 0001)
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_awards_check_ins BEFORE INSERT ON awards
BEGIN
  SELECT RAISE(ABORT, 'Đội không thuộc đơn vị')
  WHERE NEW.team_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM teams WHERE id = NEW.team_id AND unit_id = NEW.unit_id);
  SELECT RAISE(ABORT, 'Danh hiệu / khen thưởng không áp dụng cho đối tượng này')
  WHERE NOT EXISTS (SELECT 1 FROM award_types WHERE id = NEW.award_type_id
                    AND (subject_scope = 'CA_HAI' OR subject_scope = NEW.subject));
  SELECT RAISE(ABORT, 'Cần chọn loại cho hình thức khen thưởng này')
  WHERE NEW.award_variant_id IS NULL
    AND EXISTS (SELECT 1 FROM award_types WHERE id = NEW.award_type_id AND requires_variant = 1);
  SELECT RAISE(ABORT, 'Loại không thuộc hình thức khen thưởng đã chọn')
  WHERE NEW.award_variant_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM award_variants WHERE id = NEW.award_variant_id AND award_type_id = NEW.award_type_id);
END;

CREATE TRIGGER trg_awards_check_upd BEFORE UPDATE OF subject, unit_id, team_id, award_type_id, award_variant_id ON awards
BEGIN
  SELECT RAISE(ABORT, 'Đội không thuộc đơn vị')
  WHERE NEW.team_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM teams WHERE id = NEW.team_id AND unit_id = NEW.unit_id);
  SELECT RAISE(ABORT, 'Danh hiệu / khen thưởng không áp dụng cho đối tượng này')
  WHERE NOT EXISTS (SELECT 1 FROM award_types WHERE id = NEW.award_type_id
                    AND (subject_scope = 'CA_HAI' OR subject_scope = NEW.subject));
  SELECT RAISE(ABORT, 'Cần chọn loại cho hình thức khen thưởng này')
  WHERE NEW.award_variant_id IS NULL
    AND EXISTS (SELECT 1 FROM award_types WHERE id = NEW.award_type_id AND requires_variant = 1);
  SELECT RAISE(ABORT, 'Loại không thuộc hình thức khen thưởng đã chọn')
  WHERE NEW.award_variant_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM award_variants WHERE id = NEW.award_variant_id AND award_type_id = NEW.award_type_id);
END;

CREATE TRIGGER trg_units_no_delete_used BEFORE DELETE ON units
WHEN EXISTS (SELECT 1 FROM officers WHERE unit_id = OLD.id) OR EXISTS (SELECT 1 FROM awards WHERE unit_id = OLD.id)
BEGIN SELECT RAISE(ABORT, 'Đơn vị còn cán bộ hoặc khen thưởng'); END;

CREATE TRIGGER trg_teams_no_delete_used BEFORE DELETE ON teams
WHEN EXISTS (SELECT 1 FROM officers WHERE team_id = OLD.id) OR EXISTS (SELECT 1 FROM awards WHERE team_id = OLD.id)
BEGIN SELECT RAISE(ABORT, 'Đội còn cán bộ hoặc khen thưởng'); END;

-- ---------------------------------------------------------------------
-- 5. Mỗi cán bộ mỗi năm tối đa 1 xếp loại (bản ghi chưa xóa): insert, đổi loại/cán bộ/năm, khôi phục.
--    Uses ix_awards_officer (officer_id, year).
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_awards_xep_loai_ins BEFORE INSERT ON awards
WHEN NEW.deleted_at IS NULL
  AND EXISTS (SELECT 1 FROM award_types WHERE id = NEW.award_type_id AND form = 'XEP_LOAI')
BEGIN
  SELECT RAISE(ABORT, 'Cán bộ đã có xếp loại năm này')
  WHERE EXISTS (SELECT 1 FROM awards a JOIN award_types t ON t.id = a.award_type_id
                WHERE a.officer_id = NEW.officer_id AND a.year = NEW.year
                  AND a.deleted_at IS NULL AND t.form = 'XEP_LOAI');
END;

CREATE TRIGGER trg_awards_xep_loai_upd BEFORE UPDATE OF award_type_id, officer_id, year, deleted_at ON awards
WHEN NEW.deleted_at IS NULL
  AND EXISTS (SELECT 1 FROM award_types WHERE id = NEW.award_type_id AND form = 'XEP_LOAI')
BEGIN
  SELECT RAISE(ABORT, 'Cán bộ đã có xếp loại năm này')
  WHERE EXISTS (SELECT 1 FROM awards a JOIN award_types t ON t.id = a.award_type_id
                WHERE a.officer_id = NEW.officer_id AND a.year = NEW.year AND a.id <> NEW.id
                  AND a.deleted_at IS NULL AND t.form = 'XEP_LOAI');
END;

-- ---------------------------------------------------------------------
-- 6. Master data
-- ---------------------------------------------------------------------
UPDATE positions SET sort_order = sort_order + 2;
INSERT INTO positions (code, name, level, sort_order) VALUES
  ('CUC_TRUONG',     'Cục trưởng',     'DON_VI', 1),
  ('PHO_CUC_TRUONG', 'Phó Cục trưởng', 'DON_VI', 2);

UPDATE authorities SET sort_order = sort_order + 1 WHERE sort_order >= 4;
INSERT INTO authorities (code, name, sort_order) VALUES ('CUC_TRUONG', 'Cục trưởng Cục CSGT', 4);

INSERT INTO award_types (code, name, form, subject_scope, default_authority_id, requires_variant, sort_order)
SELECT v.code, v.name, 'XEP_LOAI', 'CA_NHAN', a.id, 0, v.sort_order
FROM (SELECT 'XL_HTXSNV' AS code, 'Hoàn thành xuất sắc nhiệm vụ' AS name, 13 AS sort_order
      UNION ALL SELECT 'XL_HTTNV', 'Hoàn thành tốt nhiệm vụ', 14
      UNION ALL SELECT 'XL_HTNV', 'Hoàn thành nhiệm vụ', 15
      UNION ALL SELECT 'XL_KHTNV', 'Không hoàn thành nhiệm vụ', 16) v
JOIN authorities a ON a.code = 'CUC_TRUONG';
