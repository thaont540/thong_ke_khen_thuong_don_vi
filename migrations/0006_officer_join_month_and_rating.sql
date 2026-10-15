-- Xếp loại cán bộ (danh mục 4 mức chuẩn) + tháng năm vào ngành.
-- Thâm niên KHÔNG lưu: tính khi hiển thị = năm hiện tại (giờ VN) - năm vào ngành.
CREATE TABLE officer_ratings (
  id          INTEGER PRIMARY KEY,
  code        TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  name        TEXT    NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
);

INSERT INTO officer_ratings (id, code, name, sort_order) VALUES
  (1, 'HTXSNV',  'Hoàn thành xuất sắc nhiệm vụ', 1),
  (2, 'HTTNV',   'Hoàn thành tốt nhiệm vụ',      2),
  (3, 'HTNV',    'Hoàn thành nhiệm vụ',          3),
  (4, 'KHTNV',   'Không hoàn thành nhiệm vụ',    4);

-- 'YYYY-MM', tháng 01-12; NULL = chưa khai báo.
ALTER TABLE officers ADD COLUMN joined_month TEXT
  CHECK (joined_month IS NULL OR (
    joined_month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'
    AND substr(joined_month, 6, 2) BETWEEN '01' AND '12'));
ALTER TABLE officers ADD COLUMN rating_id INTEGER REFERENCES officer_ratings(id);
