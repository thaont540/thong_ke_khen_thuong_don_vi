# Runbook sao lưu và khôi phục D1

Dữ liệu chứa thông tin cán bộ (PII). Hiện chỉ là dữ liệu demo, nhưng làm đúng quy trình ngay từ đầu.
Tên DB: prod `app-nghia`, staging `app-nghia-staging`. Thêm `--env staging` cho staging khi dùng lệnh `DB` binding; lệnh theo tên DB không cần.

## 1. Các lớp bảo vệ

| Lớp | Phạm vi | Ghi chú |
|---|---|---|
| D1 Time Travel | 7 ngày (gói free), khôi phục về bất kỳ thời điểm | Nhanh nhất, ghi đè DB hiện tại |
| Export hàng tuần (GitHub Actions) | 90 ngày, mã hóa age | Khôi phục vào DB mới |
| Xóa mềm (`deleted_at`) | Không giới hạn | Hoàn tác từng bản ghi/đợt import bằng SQL |

## 2. Time Travel

```bash
# Xem bookmark hiện tại (ghi lại trước khi thao tác rủi ro)
npx wrangler d1 time-travel info app-nghia

# Về một thời điểm (UTC, ISO 8601) hoặc UNIX timestamp
npx wrangler d1 time-travel restore app-nghia --timestamp=2026-10-14T10:00:00Z
# hoặc về bookmark
npx wrangler d1 time-travel restore app-nghia --bookmark=<bookmark>
```

- Lệnh in bookmark **trước khi restore**: giữ lại để hoàn tác chính restore.
- Restore ghi đè toàn bộ DB, mất mọi thay đổi sau thời điểm đó. Báo người dùng ngừng thao tác trước.
- Nếu migration mới gây lỗi: `npx wrangler rollback` (code) + restore về trước migration.

## 3. Khôi phục từ export mã hóa (vào DB mới)

1. GitHub > Actions > `backup-d1-weekly` > chọn run > tải artifact `d1-backup-<run_id>` (file `*.sql.gz.age`).
2. Giải mã bằng khóa riêng (offline), giải nén:
   ```bash
   age -d -i age-backup.key -o backup.sql.gz app-nghia-YYYYMMDD-HHMM.sql.gz.age
   gunzip backup.sql.gz
   ```
3. Thử trước ở local, so số dòng:
   ```bash
   npx wrangler d1 execute DB --local --file backup.sql
   npx wrangler d1 execute DB --local --command "SELECT (SELECT COUNT(*) FROM awards) a, (SELECT COUNT(*) FROM officers) o, (SELECT COUNT(*) FROM users) u"
   ```
   (Dùng thư mục state sạch: xóa `.wrangler/state` trước.)
4. Khôi phục thật vào DB mới:
   ```bash
   npx wrangler d1 create app-nghia-restore
   npx wrangler d1 execute app-nghia-restore --remote --file backup.sql
   ```
5. Đổi binding: sửa `database_name`/`database_id` của `DB` trong `wrangler.jsonc` sang DB mới, `npm run deploy:prod` (migration đã có sẵn trong dump nên `d1_migrations` khớp, lệnh apply không làm gì thêm).
6. Đăng nhập kiểm tra, đối chiếu số lượng, giữ DB cũ ít nhất 7 ngày rồi xóa.
7. Xóa file `backup.sql*` plaintext sau khi xong (`shred -u`).

Diễn tập khôi phục (bước 2-3) mỗi tháng một lần và sau lần chạy backup đầu tiên.

## 4. Hoàn tác một đợt import

Mỗi dòng import mang `import_batch_id`. Xem đợt:

```sql
SELECT id, file_name, total_rows, imported_rows, error_rows, created_at
FROM import_batches ORDER BY id DESC LIMIT 10;
```

Xóa mềm cả đợt (trigger tự giảm `award_counters`):

```sql
UPDATE awards
SET deleted_at = datetime('now'), updated_at = datetime('now')
WHERE import_batch_id = :batch_id AND deleted_at IS NULL;
```

Chạy: `npx wrangler d1 execute app-nghia --remote --command "UPDATE awards SET ... WHERE import_batch_id = 12 AND deleted_at IS NULL"` (thay số thật, tối đa 100 dòng/đợt).
Cán bộ không được tạo bởi import; không cần xử lý. Ghi một dòng `audit_logs` (action `DELETE`, entity `award`, detail JSON có `import_batch_id`) để có dấu vết.

## 5. Khôi phục bản ghi đã xóa mềm

**Khen thưởng**

```sql
SELECT id, officer_id, award_type_id, year, decision_number, deleted_at
FROM awards WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 20;

UPDATE awards SET deleted_at = NULL, updated_at = datetime('now') WHERE id = :award_id;
```

Trigger kiểm tra lại ràng buộc và tăng `award_counters`. Bản ghi của cán bộ đang bị xóa thì khôi phục cán bộ trước.

**Cán bộ** (xóa cán bộ cũng xóa mềm mọi khen thưởng của họ cùng lúc `deleted_at`):

```sql
-- Kiểm tra số hiệu chưa bị cán bộ khác dùng (ux_officers_badge)
SELECT id FROM officers WHERE deleted_at IS NULL
  AND badge_number = (SELECT badge_number FROM officers WHERE id = :officer_id);

UPDATE officers SET deleted_at = NULL, updated_at = datetime('now') WHERE id = :officer_id;
UPDATE awards SET deleted_at = NULL, updated_at = datetime('now')
WHERE officer_id = :officer_id
  AND deleted_at = (SELECT MAX(deleted_at) FROM awards WHERE officer_id = :officer_id);
```

Câu cuối chỉ khôi phục các khen thưởng bị xóa cùng đợt xóa cán bộ; nếu muốn chắc, đối chiếu thủ công bằng `audit_logs` (entity `officer`, action `DELETE`).
Đơn vị/đội khi xóa là xóa cứng và bị chặn khi còn dữ liệu tham chiếu (kể cả bản ghi đã xóa mềm), nên không có quy trình khôi phục riêng; dùng Time Travel nếu lỡ xóa.

## 5b. Kiểm tra và dựng lại bộ đếm `award_counters`

Bộ đếm do trigger duy trì; có thể lệch nếu khôi phục một phần dữ liệu hoặc chạy SQL tay. Kiểm tra (kết quả rỗng = đúng):

```bash
npx wrangler d1 execute app-nghia --remote --file scripts/check-award-counter-drift.sql
```

Có dòng trả về thì dựng lại từ bảng `awards` (an toàn, chạy lại được):

```bash
npx wrangler d1 execute app-nghia --remote --file scripts/recompute-award-counters.sql
```

Cả hai script có test (`test/worker/award-counters.test.ts`).

## 6. Sự cố thường gặp

| Triệu chứng | Xử lý |
|---|---|
| Backup workflow đỏ | Xem log; kiểm tra token còn hạn, secret `BACKUP_AGE_RECIPIENT` có đủ, chạy lại bằng Run workflow |
| Không giải mã được | Dùng đúng khóa riêng ứng với khóa công khai lúc backup; nếu mất khóa riêng, backup cũ không đọc được, đặt khóa mới và đổi secret |
| `time-travel restore` quá 7 ngày | Dùng export hàng tuần (mục 3) |
