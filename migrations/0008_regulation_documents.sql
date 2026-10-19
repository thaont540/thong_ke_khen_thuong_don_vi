-- Văn bản quy định (thư viện văn bản thi đua, khen thưởng). File nằm ở R2 (binding DOCS),
-- bảng này chỉ giữ metadata + khóa object. Xóa mềm: object R2 bị xóa cùng lúc để tiết kiệm dung lượng.
CREATE TABLE regulation_documents (
  id                 INTEGER PRIMARY KEY,
  doc_number         TEXT    NOT NULL CHECK (length(doc_number) BETWEEN 1 AND 100),
  doc_number_search  TEXT    NOT NULL,
  title              TEXT    NOT NULL CHECK (length(title) BETWEEN 1 AND 1000),
  title_search       TEXT    NOT NULL,
  doc_type           TEXT    NOT NULL CHECK (doc_type IN ('LUAT', 'NGHI_DINH', 'THONG_TU',
                                                          'QUYET_DINH', 'HUONG_DAN', 'KHAC')),
  issuer             TEXT    NOT NULL CHECK (length(issuer) BETWEEN 1 AND 200),
  issued_date        TEXT    NOT NULL CHECK (issued_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  status             TEXT    NOT NULL DEFAULT 'CON_HIEU_LUC' CHECK (status IN ('CON_HIEU_LUC', 'HET_HIEU_LUC')),
  note               TEXT    CHECK (note IS NULL OR length(note) <= 1000),
  file_key           TEXT    NOT NULL UNIQUE,
  file_name          TEXT    NOT NULL,
  content_type       TEXT    NOT NULL,
  size_bytes         INTEGER NOT NULL CHECK (size_bytes > 0),
  created_by         INTEGER REFERENCES users(id),
  created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT    NOT NULL DEFAULT (datetime('now')),
  deleted_at         TEXT
);

CREATE INDEX ix_regulation_documents_list ON regulation_documents(issued_date DESC, id DESC)
  WHERE deleted_at IS NULL;
