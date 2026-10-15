---
title: "Cán bộ: tháng năm vào ngành, xếp loại, thâm niên"
status: completed
priority: P2
branch: develop
created: 2026-10-15
---

# Plan

Bổ sung 3 thông tin cán bộ (F05, F02). Quyết định: [clarifications.md](clarifications.md).

## Thiết kế
- Migration `0006_officer_join_month_and_rating.sql`:
  - bảng danh mục `officer_ratings` (id, code, name, sort_order, is_active), seed 4 mức: HTXSNV "Hoàn thành xuất sắc nhiệm vụ", HTTNV "Hoàn thành tốt nhiệm vụ", HTNV "Hoàn thành nhiệm vụ", KHTNV "Không hoàn thành nhiệm vụ".
  - `officers.joined_month TEXT NULL` dạng `YYYY-MM` (CHECK GLOB + tháng 01–12), `officers.rating_id INTEGER NULL REFERENCES officer_ratings(id)`.
- Thâm niên KHÔNG lưu: `seniority = năm hiện tại (giờ VN) − năm vào ngành`, hàm dùng chung `src/shared/officer-seniority.ts`; trống khi chưa có tháng năm vào ngành.
- Validation (shared zod + server): tháng năm vào ngành không ở tương lai (so tháng hiện tại giờ VN), năm ≥ năm sinh + 16; rating_id phải tồn tại và đang hoạt động.
- API: `GET /api/master` thêm `officer_ratings`; officer DTO (list, detail, create/update) thêm `joined_month`, `rating_id` (+ `rating_name` khi đọc). Audit trước/sau tự có.
- UI:
  - F05 form: ô "Tháng năm vào ngành" (`type="month"`), ô chọn "Xếp loại" (mục đầu "Chưa xếp loại").
  - F05 bảng: thêm cột Vào ngành (mm/yyyy), Thâm niên ("N năm"), Xếp loại.
  - F02 modal: thêm 3 dòng vào phần Thông tin cán bộ; F03 khối thông tin cán bộ thêm Thâm niên.
  - Trống hiện "—".
- Tests: migration/constraint, validation (tương lai, < năm sinh+16, rating không tồn tại), seniority (biên năm, giờ VN), API CRUD + master, client form/table/modal.
- Docs: spec §6 F05 + F02 + §7 bảng officers + §8 danh mục; system-architecture, changelog, roadmap.

## Phases
| # | Việc | Status |
|---|---|---|
| 1 | Migration + shared schema/seniority + API | done |
| 2 | UI F05/F02/F03 | done |
| 3 | Tests, docs, review | done |
