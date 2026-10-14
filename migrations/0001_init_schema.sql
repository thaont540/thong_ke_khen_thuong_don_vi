-- Schema v2 (from docs/schema-seed.sql §1-4). D1: no PRAGMA foreign_keys (enforced by default), no BEGIN/COMMIT.
-- Deviation from spec: awards.decision_number_search (normalized at write) for Unicode-safe search.
-- ---------------------------------------------------------------------
-- 1. DANH MỤC
-- ---------------------------------------------------------------------

-- Đơn vị cấp phòng / thủy đoàn
CREATE TABLE units (
  id           INTEGER PRIMARY KEY,
  code         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  name         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  kind         TEXT    NOT NULL CHECK (kind IN ('PHONG', 'THUY_DOAN')),
  description  TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Đội trực thuộc đơn vị
CREATE TABLE teams (
  id           INTEGER PRIMARY KEY,
  unit_id      INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  code         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  name         TEXT    NOT NULL COLLATE NOCASE,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (unit_id, name)
);

-- Cấp bậc
CREATE TABLE ranks (
  id           INTEGER PRIMARY KEY,
  code         TEXT    NOT NULL UNIQUE,
  name         TEXT    NOT NULL UNIQUE,
  rank_group   TEXT    NOT NULL CHECK (rank_group IN ('HA_SI_QUAN', 'CAP_UY', 'CAP_TA', 'CAP_TUONG')),
  sort_order   INTEGER NOT NULL DEFAULT 0
);

-- Chức vụ
CREATE TABLE positions (
  id           INTEGER PRIMARY KEY,
  code         TEXT    NOT NULL UNIQUE,
  name         TEXT    NOT NULL UNIQUE,
  level        TEXT    NOT NULL CHECK (level IN ('DON_VI', 'DOI', 'CAN_BO')),
  sort_order   INTEGER NOT NULL DEFAULT 0
);

-- Cấp quyết định khen thưởng
CREATE TABLE authorities (
  id           INTEGER PRIMARY KEY,
  code         TEXT    NOT NULL UNIQUE,
  name         TEXT    NOT NULL UNIQUE,
  sort_order   INTEGER NOT NULL DEFAULT 0
);

-- Danh mục danh hiệu thi đua và hình thức khen thưởng
CREATE TABLE award_types (
  id                    INTEGER PRIMARY KEY,
  code                  TEXT    NOT NULL UNIQUE,
  name                  TEXT    NOT NULL UNIQUE,
  form                  TEXT    NOT NULL CHECK (form IN ('DANH_HIEU', 'KHEN_THUONG')),
  subject_scope         TEXT    NOT NULL CHECK (subject_scope IN ('TAP_THE', 'CA_NHAN', 'CA_HAI')),
  default_authority_id  INTEGER NOT NULL REFERENCES authorities(id),
  requires_variant      INTEGER NOT NULL DEFAULT 0 CHECK (requires_variant IN (0, 1)),
  sort_order            INTEGER NOT NULL DEFAULT 0,
  is_active             INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
);

-- Loại cụ thể của một hình thức (hiện dùng cho Huân chương)
CREATE TABLE award_variants (
  id             INTEGER PRIMARY KEY,
  award_type_id  INTEGER NOT NULL REFERENCES award_types(id),
  code           TEXT    NOT NULL UNIQUE,
  name           TEXT    NOT NULL UNIQUE,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  is_active      INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
);

-- ---------------------------------------------------------------------
-- 2. NGƯỜI DÙNG
-- ---------------------------------------------------------------------

-- Tài khoản đăng nhập. Vai trò:
--   ADMIN  : toàn bộ chức năng (F01–F08)
--   EDITOR : xem F01/F02, thêm khen thưởng F03 và import F04
--   VIEWER : chỉ xem F01/F02
CREATE TABLE users (
  id                    INTEGER PRIMARY KEY,
  username              TEXT    NOT NULL UNIQUE COLLATE NOCASE
                                CHECK (length(username) BETWEEN 3 AND 32),
  full_name             TEXT    NOT NULL,
  role                  TEXT    NOT NULL CHECK (role IN ('ADMIN', 'EDITOR', 'VIEWER')),
  -- 'pbkdf2$sha256$<số vòng lặp>$<salt base64>$<hash base64>'
  password_hash         TEXT    NOT NULL,
  must_change_password  INTEGER NOT NULL DEFAULT 1 CHECK (must_change_password IN (0, 1)),
  failed_login_count    INTEGER NOT NULL DEFAULT 0,
  locked_until          TEXT,                       -- khóa tạm do đăng nhập sai
  last_login_at         TEXT,
  is_active             INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Phiên đăng nhập. Cookie giữ token gốc, bảng chỉ lưu SHA-256 của token.
CREATE TABLE sessions (
  token_hash    TEXT    PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at    TEXT    NOT NULL,
  last_seen_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  user_agent    TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX ix_sessions_user    ON sessions(user_id);
CREATE INDEX ix_sessions_expires ON sessions(expires_at);   -- Cron Trigger dọn phiên hết hạn hằng ngày

-- ---------------------------------------------------------------------
-- 3. NGHIỆP VỤ
-- ---------------------------------------------------------------------

-- Cán bộ
CREATE TABLE officers (
  id                INTEGER PRIMARY KEY,
  code              TEXT    NOT NULL UNIQUE COLLATE NOCASE,         -- CB001, tự sinh
  full_name         TEXT    NOT NULL,
  full_name_search  TEXT    NOT NULL,                               -- họ tên đã chuẩn hóa
  birth_year        INTEGER NOT NULL CHECK (birth_year BETWEEN 1950 AND 2010),
  badge_number      TEXT    NOT NULL CHECK (badge_number GLOB '[0-9][0-9][0-9][0-9][0-9][0-9]'),
  rank_id           INTEGER NOT NULL REFERENCES ranks(id),
  position_id       INTEGER NOT NULL REFERENCES positions(id),
  unit_id           INTEGER NOT NULL REFERENCES units(id),
  team_id           INTEGER REFERENCES teams(id),
  created_by        INTEGER REFERENCES users(id),
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  deleted_at        TEXT
);
-- Số hiệu không trùng giữa các cán bộ chưa bị xóa
CREATE UNIQUE INDEX ux_officers_badge ON officers(badge_number) WHERE deleted_at IS NULL;
CREATE INDEX ix_officers_unit_team ON officers(unit_id, team_id) WHERE deleted_at IS NULL;

-- Đợt import Excel
CREATE TABLE import_batches (
  id             INTEGER PRIMARY KEY,
  file_name      TEXT    NOT NULL,
  total_rows     INTEGER NOT NULL,
  imported_rows  INTEGER NOT NULL,
  error_rows     INTEGER NOT NULL,
  created_by     INTEGER REFERENCES users(id),
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Bản ghi danh hiệu / khen thưởng
CREATE TABLE awards (
  id                INTEGER PRIMARY KEY,
  subject           TEXT    NOT NULL CHECK (subject IN ('TAP_THE', 'CA_NHAN')),
  officer_id        INTEGER REFERENCES officers(id),
  unit_id           INTEGER NOT NULL REFERENCES units(id),   -- đơn vị tại thời điểm khen
  team_id           INTEGER REFERENCES teams(id),           -- đội tại thời điểm khen, NULL = cấp đơn vị
  award_type_id     INTEGER NOT NULL REFERENCES award_types(id),
  award_variant_id  INTEGER REFERENCES award_variants(id),
  year              INTEGER NOT NULL CHECK (year BETWEEN 1990 AND 2100),
  decision_number   TEXT    NOT NULL CHECK (length(decision_number) <= 50),
  decision_number_search TEXT NOT NULL,                          -- số quyết định đã chuẩn hóa (NFC, lowercase)
  decision_date     TEXT    NOT NULL CHECK (decision_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  authority_id      INTEGER NOT NULL REFERENCES authorities(id),
  achievement       TEXT    NOT NULL CHECK (length(achievement) <= 2000),
  note              TEXT    CHECK (note IS NULL OR length(note) <= 500),
  import_batch_id   INTEGER REFERENCES import_batches(id),
  created_by        INTEGER REFERENCES users(id),
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  deleted_at        TEXT,
  -- Cá nhân thì phải có cán bộ, tập thể thì không
  CHECK ((subject = 'CA_NHAN' AND officer_id IS NOT NULL) OR (subject = 'TAP_THE' AND officer_id IS NULL))
);
CREATE INDEX ix_awards_list      ON awards(year DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX ix_awards_unit_team ON awards(unit_id, team_id, year DESC) WHERE deleted_at IS NULL;
CREATE INDEX ix_awards_officer   ON awards(officer_id, year DESC) WHERE deleted_at IS NULL;
CREATE INDEX ix_awards_type      ON awards(award_type_id, subject) WHERE deleted_at IS NULL;
CREATE INDEX ix_awards_decision  ON awards(decision_number) WHERE deleted_at IS NULL;

-- Nhật ký thao tác
CREATE TABLE audit_logs (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id),
  action      TEXT    NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'IMPORT',
                                                 'LOGIN', 'LOGIN_FAILED', 'LOGOUT',
                                                 'PASSWORD_CHANGE', 'PASSWORD_RESET', 'LOCK', 'UNLOCK')),
  entity      TEXT    NOT NULL,          -- 'award', 'officer', 'unit', 'team', 'user'
  entity_id   INTEGER,
  detail      TEXT,                      -- JSON: giá trị trước / sau
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX ix_audit_entity ON audit_logs(entity, entity_id);

-- ---------------------------------------------------------------------
-- 4. RÀNG BUỘC CHÉO BẢNG (trigger)
-- ---------------------------------------------------------------------

-- Đội của cán bộ phải thuộc đơn vị của cán bộ
CREATE TRIGGER trg_officers_team_ins BEFORE INSERT ON officers
WHEN NEW.team_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM teams WHERE id = NEW.team_id AND unit_id = NEW.unit_id)
BEGIN SELECT RAISE(ABORT, 'Đội không thuộc đơn vị của cán bộ'); END;

CREATE TRIGGER trg_officers_team_upd BEFORE UPDATE OF unit_id, team_id ON officers
WHEN NEW.team_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM teams WHERE id = NEW.team_id AND unit_id = NEW.unit_id)
BEGIN SELECT RAISE(ABORT, 'Đội không thuộc đơn vị của cán bộ'); END;

-- Kiểm tra bản ghi khen thưởng: đội thuộc đơn vị, danh hiệu đúng đối tượng, loại huân chương
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

-- Không cho xóa đơn vị / đội còn cán bộ hoặc khen thưởng (BR-04)
CREATE TRIGGER trg_units_no_delete_used BEFORE DELETE ON units
WHEN EXISTS (SELECT 1 FROM officers WHERE unit_id = OLD.id) OR EXISTS (SELECT 1 FROM awards WHERE unit_id = OLD.id)
BEGIN SELECT RAISE(ABORT, 'Đơn vị còn cán bộ hoặc khen thưởng'); END;

CREATE TRIGGER trg_teams_no_delete_used BEFORE DELETE ON teams
WHEN EXISTS (SELECT 1 FROM officers WHERE team_id = OLD.id) OR EXISTS (SELECT 1 FROM awards WHERE team_id = OLD.id)
BEGIN SELECT RAISE(ABORT, 'Đội còn cán bộ hoặc khen thưởng'); END;
