# Nhật ký thay đổi

Định dạng: theo ngày, nhóm theo loại. Nguồn: `git log` và kế hoạch `plans/261014-1644-awards-management-system/`.

## 2026-10-19

### Changed
- F04 Import Excel theo mẫu mới (CR 19/10/2026): bỏ cột "Mã cán bộ"; thêm Họ và tên, Cấp bậc, Chức vụ. Cá nhân xác định theo họ tên (BR-07) + đơn vị (+ đội): 1 cán bộ thì dùng, chưa có thì tự tạo cán bộ mới (cấp bậc, chức vụ bắt buộc, năm sinh và số hiệu để trống, mã tự sinh, audit CREATE `via: import`), trùng tên nhiều người thì báo lỗi. Cán bộ mới tạo cùng giao dịch `db.batch` với khen thưởng của lô, một người mới chỉ tạo một lần kể cả qua nhiều lô. Hình thức thêm "Xếp loại cán bộ" (chỉ cá nhân, mỗi cán bộ mỗi năm một xếp loại, trùng là lỗi cứng). Tập thể không được ghi họ tên, cấp bậc, chức vụ. Xem trước và dry run báo "Sẽ tạo cán bộ mới" (nhãn "mới", cột Hình thức), không tạo gì. File mẫu sinh từ danh mục: 4 dòng ví dụ, sheet Danh mục thêm xếp loại, cấp bậc, chức vụ, cấp quyết định và bỏ danh sách mã/họ tên cán bộ. File cũ có Mã cán bộ bị từ chối vì thiếu cột. `docs/import-template.xlsx` thay bằng mẫu mới.
- Văn bản quy định: lưu tệp bằng Cloudflare Workers KV thay vì R2 (không cần thẻ). `wrangler.jsonc`: `kv_namespaces` binding `DOCS` (prod + staging); lớp trừu tượng `src/worker/lib/document-file-store.ts`. API và giao diện giữ nguyên; tải về khi tệp chưa đọc được từ KV (nhất quán cuối cùng, tới ~60 giây) trả 404 "Tệp chưa sẵn sàng hoặc không tồn tại, vui lòng thử lại sau ít phút". Giới hạn 20 MB; KV free 1.000 lượt ghi mỗi ngày.
- Hướng dẫn sử dụng (`docs/user-guide/`) cập nhật theo CR 19/10/2026: tên và biểu tượng CSGT, Cục CSGT, xếp loại cán bộ theo năm (lọc F01, form F03, cột F05), import mẫu mới 14 cột (tự tạo cán bộ, nhãn "mới", dòng xếp loại), mục mới "Văn bản quy định" (F10). Trình sinh ảnh `scripts/user-guide/` thêm dữ liệu minh họa (lãnh đạo Cục, xếp loại, văn bản tải lên qua API), file import mẫu mới và 6 ảnh mới (40 đến 45): 45 ảnh, toàn bộ ảnh được chụp lại.

## 2026-10-15

- Sửa lỗi giao diện điện thoại: ở màn hình hẹp (≤ 760px) thanh menu ngang làm trang rộng hơn màn hình; cột lưới dùng `minmax(0, 1fr)`, menu cuộn trong dải riêng.

### Added
- Hướng dẫn sử dụng tiếng Việt cho người dùng cuối: `docs/user-guide/index.html` (vai trò và quyền, F01-F09, import Excel, FAQ) kèm 39 ảnh chụp có vòng số đánh dấu trong `docs/user-guide/images/`. Ảnh sinh tự động bằng `npm run docs:user-guide` (`scripts/user-guide/`): build + `vite preview` cổng 5181, D1 riêng `.wrangler/user-guide-state`, dữ liệu minh họa giả, Playwright.
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
