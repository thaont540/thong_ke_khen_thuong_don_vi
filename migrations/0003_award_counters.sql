-- Đếm số khen thưởng đang hoạt động theo (loại, đối tượng, đơn vị, đội) để F01 lấy thống kê
-- mà không phải quét toàn bộ bảng awards (D1 tính phí theo số dòng đọc). team_id = 0: cấp đơn vị.
CREATE TABLE award_counters (
  unit_id       INTEGER NOT NULL,
  team_id       INTEGER NOT NULL DEFAULT 0,
  award_type_id INTEGER NOT NULL,
  subject       TEXT    NOT NULL,
  n             INTEGER NOT NULL,
  PRIMARY KEY (unit_id, team_id, award_type_id, subject)
) WITHOUT ROWID;

INSERT INTO award_counters (unit_id, team_id, award_type_id, subject, n)
SELECT unit_id, COALESCE(team_id, 0), award_type_id, subject, COUNT(*)
FROM awards WHERE deleted_at IS NULL
GROUP BY unit_id, COALESCE(team_id, 0), award_type_id, subject;

CREATE TRIGGER trg_award_counters_ins AFTER INSERT ON awards
WHEN NEW.deleted_at IS NULL
BEGIN
  INSERT INTO award_counters (unit_id, team_id, award_type_id, subject, n)
  VALUES (NEW.unit_id, COALESCE(NEW.team_id, 0), NEW.award_type_id, NEW.subject, 1)
  ON CONFLICT (unit_id, team_id, award_type_id, subject) DO UPDATE SET n = n + 1;
END;

CREATE TRIGGER trg_award_counters_upd_old
AFTER UPDATE OF deleted_at, award_type_id, subject, unit_id, team_id ON awards
WHEN OLD.deleted_at IS NULL
BEGIN
  UPDATE award_counters SET n = n - 1
  WHERE award_type_id = OLD.award_type_id AND subject = OLD.subject
    AND unit_id = OLD.unit_id AND team_id = COALESCE(OLD.team_id, 0);
END;

CREATE TRIGGER trg_award_counters_upd_new
AFTER UPDATE OF deleted_at, award_type_id, subject, unit_id, team_id ON awards
WHEN NEW.deleted_at IS NULL
BEGIN
  INSERT INTO award_counters (unit_id, team_id, award_type_id, subject, n)
  VALUES (NEW.unit_id, COALESCE(NEW.team_id, 0), NEW.award_type_id, NEW.subject, 1)
  ON CONFLICT (unit_id, team_id, award_type_id, subject) DO UPDATE SET n = n + 1;
END;

CREATE TRIGGER trg_award_counters_del AFTER DELETE ON awards
WHEN OLD.deleted_at IS NULL
BEGIN
  UPDATE award_counters SET n = n - 1
  WHERE award_type_id = OLD.award_type_id AND subject = OLD.subject
    AND unit_id = OLD.unit_id AND team_id = COALESCE(OLD.team_id, 0);
END;

-- F01 lọc theo đơn vị (không chọn đội): đi theo thứ tự năm giảm dần, không phải sắp xếp lại
CREATE INDEX ix_awards_unit_list ON awards(unit_id, year DESC, id DESC) WHERE deleted_at IS NULL;

-- Lọc theo đơn vị + đội: thêm id DESC để đi đúng thứ tự ORDER BY, planner không chọn nhầm ix_awards_unit_list
DROP INDEX ix_awards_unit_team;
CREATE INDEX ix_awards_unit_team ON awards(unit_id, team_id, year DESC, id DESC) WHERE deleted_at IS NULL;
