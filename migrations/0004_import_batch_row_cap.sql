-- Đợt import: không bao giờ lưu quá số dòng đã khai báo (total_rows <= 100). Trigger là chốt chặn
-- nguyên tử (cả db.batch bị rollback); service kiểm tra trước để trả thông báo thân thiện.
CREATE TRIGGER trg_import_batches_row_cap BEFORE UPDATE OF imported_rows ON import_batches
WHEN NEW.imported_rows > NEW.total_rows
BEGIN
  SELECT RAISE(ABORT, 'Vượt quá số dòng đã khai báo của đợt import');
END;

-- imported_rows = COUNT(*) theo đợt cho mỗi lô: cần index để không quét toàn bảng awards
CREATE INDEX ix_awards_import_batch ON awards(import_batch_id) WHERE import_batch_id IS NOT NULL;
