# Nhật ký thay đổi

Định dạng: theo ngày, nhóm theo loại. Nguồn: `git log` và kế hoạch `plans/261014-1644-awards-management-system/`.

## 2026-10-15

### Added
- Cán bộ: tháng năm vào ngành (`officers.joined_month`), xếp loại (`officers.rating_id`, danh mục `officer_ratings` 4 mức) và thâm niên tính khi hiển thị (năm hiện tại giờ VN trừ năm vào ngành). Migration 0006; `GET /api/master` thêm `officer_ratings`; DTO cán bộ thêm `joined_month`, `rating_id`, `rating_name`. F05 có thêm 2 ô nhập và 3 cột, F02 thêm 3 dòng thông tin, F03 hiện thâm niên. Validation: không ở tương lai, năm vào ngành >= năm sinh + 16, xếp loại phải tồn tại và đang hoạt động.

## 2026-10-14

### Added
- Phase 01: khung dự án Worker + React (Vite), CI (`ci.yml`), spike kỹ thuật (trigger D1, `db.batch`, PBKDF2 CPU, cron) - `21ae37d`.
- Phase 02: migration schema (0001) và seed danh mục (0002), schema Zod dùng chung, API `/api/master` - `97a120b`.
- Phase 03/04: đăng nhập, phiên, đổi mật khẩu, quản lý người dùng (F07, F08), khung giao diện và design system - `be63d58`.
- Phase 05/06: quản lý đơn vị, cán bộ, danh sách và chi tiết khen thưởng, thêm/sửa/xóa mềm (F01-F03, F05, F06, F09) - `509ce02`.
- Phase 07: import khen thưởng từ Excel với validator dùng chung FE/BE (F04) - `18f0856`.
- Phase 08: test API hardening, e2e Playwright, ma trận RBAC đầy đủ, test chi phí đọc D1 - `15151fb`.
- Phase 09: workflow `deploy.yml` (staging/production), `backup-d1-weekly.yml` (export mã hóa age), tài liệu triển khai, backup, kiến trúc, quy chuẩn, roadmap, README.
- Migration 0003 `award_counters` (thống kê bằng bảng đếm, index danh sách theo đơn vị). Migration 0004 trigger giới hạn số dòng đợt import.

### Security / Fixed (review vòng 2)
- PUT `/api/awards/:id` bắt buộc `updated_at` (khóa lạc quan không còn bị bỏ qua).
- Đăng nhập: tài khoản khóa/vô hiệu chỉ báo 423 khi đúng mật khẩu, sai báo 401 chung và không kéo dài khóa; giới hạn 10 lần/phút theo IP (binding `LOGIN_LIMITER`, 429).
- Phiên tối đa 7 ngày; `Cache-Control: no-store` cho mọi `/api/*`.
- Import: từ chối file bị cắt bớt dòng, `row_number` trùng trong lô; tìm kiếm không vượt giới hạn 100 tham số D1; mã cán bộ thử lại tối đa 5 lần; mã đội không trùng sau khi đổi mã đơn vị; xóa cán bộ đã bị xóa trả 404.
- Migration 0005 bỏ index không dùng `ix_awards_decision`; script kiểm tra/dựng lại `award_counters`.
- Workflow: deploy production chỉ từ `master`, secrets chỉ trong job deploy, concurrency theo môi trường, bỏ qua có cảnh báo khi thiếu secret; CI `permissions: contents: read`, ghim action theo SHA, e2e bắt buộc.

### Changed
- Giới hạn import Excel: 5 MB và 100 dòng mỗi file (trước đây 1000 dòng) - `21f264e`.
- Logo sidebar dùng quốc kỳ Việt Nam - `bca5ea0`.
- `pageSchema` dùng chung thành generic theo kiểu item - `972faf4`.
- Giữ PBKDF2 100000 vòng trên gói free sau khi đo (p95 ~72ms CPU, không 1102).

### Fixed
- Cho phép POST/DELETE không body đi qua kiểm tra Origin - `b855c85`.
- Kiểu dáng ô nhập mật khẩu đồng nhất với ô text - `eb329cf`.
- Đợt sửa theo review (commit e88f526): chặn dò mật khẩu song song bằng đặt trước lượt thử (`login-attempt-guard.ts`), khóa tạm/mở khóa người dùng, kiểm soát đồng thời khi sửa khen thưởng, chặn đợt import vượt số dòng.

### Docs
- `CLAUDE.md` quy tắc commit - `6cd3fc6`; spec và kế hoạch - `8825dda`.
