-- =====================================================================
-- Hệ thống quản lý thi đua, khen thưởng
-- Schema v2 + dữ liệu danh mục (master data)
-- v2: đăng nhập bằng tài khoản trong bảng users (bỏ Cloudflare Access), thêm bảng sessions
-- Dùng cho Cloudflare D1 (SQLite). Chạy:
--   npx wrangler d1 execute <ten-db> --file=khen-thuong-schema-seed.sql
-- Ghi chú:
--   * COLLATE NOCASE của SQLite chỉ không phân biệt hoa thường với chữ ASCII.
--     Với tiếng Việt, ứng dụng chuẩn hóa (NFC, lowercase, gộp khoảng trắng)
--     trước khi so khớp; các cột *_search lưu chuỗi đã chuẩn hóa để tìm kiếm.
--   * Ngày lưu dạng ISO 'YYYY-MM-DD'; thời điểm lưu UTC 'YYYY-MM-DD HH:MM:SS'.
-- =====================================================================

PRAGMA foreign_keys = ON;

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

-- =====================================================================
-- 5. DỮ LIỆU DANH MỤC
-- =====================================================================

-- Đơn vị: 8 phòng + 2 thủy đoàn
INSERT INTO units (id, code, name, kind, sort_order) VALUES
  (1,  'P1',  'Phòng 1',      'PHONG',     1),
  (2,  'P2',  'Phòng 2',      'PHONG',     2),
  (3,  'P3',  'Phòng 3',      'PHONG',     3),
  (4,  'P4',  'Phòng 4',      'PHONG',     4),
  (5,  'P5',  'Phòng 5',      'PHONG',     5),
  (6,  'P6',  'Phòng 6',      'PHONG',     6),
  (7,  'P7',  'Phòng 7',      'PHONG',     7),
  (8,  'P8',  'Phòng 8',      'PHONG',     8),
  (9,  'TD1', 'Thủy đoàn I',  'THUY_DOAN', 9),
  (10, 'TD2', 'Thủy đoàn II', 'THUY_DOAN', 10);

-- Đội: 11 đội thuộc Phòng 6, 2 đội thuộc Phòng 7
INSERT INTO teams (id, unit_id, code, name, sort_order) VALUES
  (1,  6, 'P6-CT1',  'Đội CSGT đường bộ cao tốc số 1', 1),
  (2,  6, 'P6-CT2',  'Đội CSGT đường bộ cao tốc số 2', 2),
  (3,  6, 'P6-CT3',  'Đội CSGT đường bộ cao tốc số 3', 3),
  (4,  6, 'P6-CT4',  'Đội CSGT đường bộ cao tốc số 4', 4),
  (5,  6, 'P6-CT5',  'Đội CSGT đường bộ cao tốc số 5', 5),
  (6,  6, 'P6-CT6',  'Đội CSGT đường bộ cao tốc số 6', 6),
  (7,  6, 'P6-CT7',  'Đội CSGT đường bộ cao tốc số 7', 7),
  (8,  6, 'P6-TMTH', 'Đội Tham mưu tổng hợp', 8),
  (9,  6, 'P6-HDKT', 'Đội Hướng dẫn kiểm tra hoạt động TTKS giao thông đường bộ, đường sắt', 9),
  (10, 6, 'P6-DS1',  'Đội CSGT đường sắt số 1', 10),
  (11, 6, 'P6-DS2',  'Đội CSGT đường sắt số 2', 11),
  (12, 7, 'P7-DD1',  'Đội Dẫn đoàn số 1', 1),
  (13, 7, 'P7-DD2',  'Đội Dẫn đoàn số 2', 2);

-- Cấp bậc
INSERT INTO ranks (id, code, name, rank_group, sort_order) VALUES
  (1,  'HA_SI',       'Hạ sĩ',        'HA_SI_QUAN', 1),
  (2,  'TRUNG_SI',    'Trung sĩ',     'HA_SI_QUAN', 2),
  (3,  'THUONG_SI',   'Thượng sĩ',    'HA_SI_QUAN', 3),
  (4,  'THIEU_UY',    'Thiếu úy',     'CAP_UY',     4),
  (5,  'TRUNG_UY',    'Trung úy',     'CAP_UY',     5),
  (6,  'THUONG_UY',   'Thượng úy',    'CAP_UY',     6),
  (7,  'DAI_UY',      'Đại úy',       'CAP_UY',     7),
  (8,  'THIEU_TA',    'Thiếu tá',     'CAP_TA',     8),
  (9,  'TRUNG_TA',    'Trung tá',     'CAP_TA',     9),
  (10, 'THUONG_TA',   'Thượng tá',    'CAP_TA',     10),
  (11, 'DAI_TA',      'Đại tá',       'CAP_TA',     11),
  (12, 'THIEU_TUONG', 'Thiếu tướng',  'CAP_TUONG',  12),
  (13, 'TRUNG_TUONG', 'Trung tướng',  'CAP_TUONG',  13),
  (14, 'THUONG_TUONG','Thượng tướng', 'CAP_TUONG',  14),
  (15, 'DAI_TUONG',   'Đại tướng',    'CAP_TUONG',  15);

-- Chức vụ
INSERT INTO positions (id, code, name, level, sort_order) VALUES
  (1, 'TRUONG_PHONG',      'Trưởng phòng',          'DON_VI', 1),
  (2, 'PHO_TRUONG_PHONG',  'Phó Trưởng phòng',      'DON_VI', 2),
  (3, 'THUY_DOAN_TRUONG',  'Thủy đoàn trưởng',      'DON_VI', 3),
  (4, 'PHO_THUY_DOAN_TRUONG', 'Phó Thủy đoàn trưởng', 'DON_VI', 4),
  (5, 'DOI_TRUONG',        'Đội trưởng',            'DOI',    5),
  (6, 'PHO_DOI_TRUONG',    'Phó Đội trưởng',        'DOI',    6),
  (7, 'CAN_BO',            'Cán bộ',                'CAN_BO', 7);

-- Cấp quyết định
INSERT INTO authorities (id, code, name, sort_order) VALUES
  (1, 'CTN', 'Chủ tịch nước',        1),
  (2, 'TTG', 'Thủ tướng Chính phủ',  2),
  (3, 'BCA', 'Bộ trưởng Bộ Công an', 3),
  (4, 'DV',  'Thủ trưởng đơn vị',    4);

-- Danh hiệu thi đua và hình thức khen thưởng
INSERT INTO award_types (id, code, name, form, subject_scope, default_authority_id, requires_variant, sort_order) VALUES
  -- Danh hiệu tập thể
  (1,  'CO_TD_CP',        'Cờ Thi đua của Chính phủ',        'DANH_HIEU',   'TAP_THE', 2, 0, 1),
  (2,  'CO_TD_BCA',       'Cờ thi đua của Bộ Công an',       'DANH_HIEU',   'TAP_THE', 3, 0, 2),
  (3,  'DV_QUYET_THANG',  'Đơn vị quyết thắng',              'DANH_HIEU',   'TAP_THE', 4, 0, 3),
  (4,  'DV_TIEN_TIEN',    'Đơn vị tiên tiến',                'DANH_HIEU',   'TAP_THE', 4, 0, 4),
  -- Danh hiệu cá nhân
  (5,  'CSTD_TOAN_QUOC',  'Chiến sĩ thi đua toàn quốc',      'DANH_HIEU',   'CA_NHAN', 2, 0, 5),
  (6,  'CSTD_TOAN_LL',    'Chiến sĩ thi đua toàn lực lượng', 'DANH_HIEU',   'CA_NHAN', 3, 0, 6),
  (7,  'CSTD_CO_SO',      'Chiến sĩ thi đua cơ sở',          'DANH_HIEU',   'CA_NHAN', 4, 0, 7),
  (8,  'CS_TIEN_TIEN',    'Chiến sĩ tiên tiến',              'DANH_HIEU',   'CA_NHAN', 4, 0, 8),
  -- Hình thức khen thưởng (tập thể và cá nhân)
  (9,  'HUAN_CHUONG',     'Huân chương',                     'KHEN_THUONG', 'CA_HAI',  1, 1, 9),
  (10, 'BK_TTG',          'Bằng khen Thủ tướng Chính phủ',   'KHEN_THUONG', 'CA_HAI',  2, 0, 10),
  (11, 'BK_BCA',          'Bằng khen Bộ Công an',            'KHEN_THUONG', 'CA_HAI',  3, 0, 11),
  (12, 'GIAY_KHEN',       'Giấy khen',                       'KHEN_THUONG', 'CA_HAI',  4, 0, 12);

-- Loại huân chương (cần nghiệp vụ xác nhận và bổ sung)
INSERT INTO award_variants (id, award_type_id, code, name, sort_order) VALUES
  (1, 9, 'HC_BVTQ_1', 'Huân chương Bảo vệ Tổ quốc hạng Nhất', 1),
  (2, 9, 'HC_BVTQ_2', 'Huân chương Bảo vệ Tổ quốc hạng Nhì',  2),
  (3, 9, 'HC_BVTQ_3', 'Huân chương Bảo vệ Tổ quốc hạng Ba',   3),
  (4, 9, 'HC_CC_1',   'Huân chương Chiến công hạng Nhất',     4),
  (5, 9, 'HC_CC_2',   'Huân chương Chiến công hạng Nhì',      5),
  (6, 9, 'HC_CC_3',   'Huân chương Chiến công hạng Ba',       6);

-- Tài khoản Quản trị đầu tiên KHÔNG tạo trong file này, vì cần băm mật khẩu.
-- Sau khi chạy file, tạo bằng script của dự án, ví dụ:
--   npm run create-admin -- --username admin --name "Quản trị hệ thống"
-- Script sinh mật khẩu tạm, băm PBKDF2 rồi INSERT với must_change_password = 1.
