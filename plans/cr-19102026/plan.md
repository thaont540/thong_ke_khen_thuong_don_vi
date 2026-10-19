---
title: "CR 19/10/2026: logo CSGT, Cục CSGT, xếp loại theo năm, import mẫu mới, văn bản quy định"
status: completed
priority: P1
branch: develop
created: 2026-10-19
---

# Plan

Nguồn: [cr-detail.md](cr-detail.md), file mẫu [mau-import-khen-thuong.xlsx](mau-import-khen-thuong.xlsx), [logo.bmp](logo.bmp). Quyết định: [clarifications.md](clarifications.md).

| # | Phase | Phụ thuộc | Status |
|---|---|---|---|
| A | Branding + Cục CSGT + Xếp loại theo năm + cán bộ không bắt buộc năm sinh/số hiệu (migration 0007) | – | done |
| C | Văn bản quy định (KV, migration 0008) | – (song song A) | done |
| B | Import theo mẫu mới (khớp/tự tạo cán bộ, xếp loại) | A | done |
| D | Tài liệu (spec, user guide, docs), review, deploy | A, B, C | done |

## A. Core
- Logo `logo.bmp` → PNG nền trong suốt (tách nền trắng) trong `public/`/assets; thay cờ ở sidebar, login, favicon. Tên hệ thống: "Hệ thống theo dõi thi đua, khen thưởng của Cục Cảnh sát giao thông" (sidebar, login, `<title>`).
- Migration 0007 (rebuild bảng có CHECK, giữ dữ liệu, tạo lại trigger/index, `PRAGMA defer_foreign_keys`):
  - units.kind thêm `CUC`; thêm đơn vị "Cục Cảnh sát giao thông" (mã C08, sort đầu).
  - positions: Cục trưởng, Phó Cục trưởng (level CUC hoặc DON_VI). authorities: "Cục trưởng Cục CSGT".
  - award_types.form thêm `XEP_LOAI`; 4 loại xếp loại (CA_NHAN, mặc định cấp quyết định Cục trưởng Cục CSGT); trigger chặn 2 xếp loại cùng cán bộ cùng năm (chưa xóa).
  - officers.birth_year, badge_number cho phép NULL (nếu có thì vẫn kiểm tra như cũ, số hiệu không trùng).
  - award_counters / thống kê hỗ trợ form mới.
  - officers.rating_id + officer_ratings: ngừng dùng (xếp loại hiện tại = bản ghi XEP_LOAI năm gần nhất).
- F01: lọc Hình thức thêm "Xếp loại cán bộ", dòng thống kê thêm số xếp loại. F03/F09: hình thức thứ 3 khi Cá nhân. F05: bỏ ô xếp loại trong form, hiện xếp loại năm gần nhất; năm sinh, số hiệu không bắt buộc. F06: loại đơn vị thêm "Cục". F02: quá trình gồm cả xếp loại.

## C. Văn bản quy định
- Bảng `regulation_documents` (số hiệu, trích yếu, loại, cơ quan ban hành, ngày ban hành, hiệu lực, ghi chú, file key/tên/kiểu/kích thước, created_by, deleted_at...). Lưu thân tệp ở Workers KV, binding `DOCS` (namespace `app-nghia-docs`, `app-nghia-docs-staging`) thay cho R2 (không cần thẻ); abstraction `src/worker/lib/document-file-store.ts`. KV nhất quán cuối cùng (download trả 404 thử lại), 25 MiB/giá trị, free 1.000 ghi/ngày.
- API: GET list (lọc/tìm/phân trang, mọi vai trò), GET :id/download (mọi vai trò), POST multipart, PUT, DELETE (ADMIN, EDITOR); giới hạn 20 MB, kiểu file cho phép; audit.
- UI: menu "Văn bản quy định", danh sách + form + tải về.

## B. Import mẫu mới
- Cột: Đối tượng, Họ và tên, Cấp bậc, Chức vụ, Đơn vị, Đội, Hình thức (Danh hiệu/Khen thưởng/Xếp loại cán bộ), Danh hiệu / khen thưởng, Năm, Số quyết định, Ngày quyết định, Cấp quyết định, Chi tiết giải thưởng, Ghi chú.
- Khớp cán bộ: họ tên (chuẩn hóa BR-07) + đơn vị (+ đội); 1 → dùng; 0 → tạo mới (cấp bậc, chức vụ bắt buộc); >1 → lỗi. Dòng cùng người mới trong file chỉ tạo 1 lần. Xem trước báo "Sẽ tạo cán bộ mới".
- File mẫu sinh từ danh mục: sheet Danh mục cập nhật (xếp loại, cấp bậc, chức vụ, bỏ mã cán bộ).
