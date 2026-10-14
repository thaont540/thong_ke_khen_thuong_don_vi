# Nhật ký thay đổi

Định dạng: theo ngày, nhóm theo loại. Nguồn: `git log` và kế hoạch `plans/261014-1644-awards-management-system/`.

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
