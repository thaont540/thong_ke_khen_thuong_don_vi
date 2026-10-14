# Phase 06 — Awards slice (F01, F02, F03, F09): API + UI

## Context Links
- Spec §2 (matrix, default authority, BR-01..BR-08), §3 F01/F02, §4 F03/F09, §7 indexes, §9 API
- Contracts: `src/shared/schemas/award-schemas.ts`, `list-query-schemas.ts` (owned by 06), `src/shared/award-type-rules.ts`

## Overview
- Priority: P1. Status: pending. Effort 14h. Depends: 03, 04. Parallel with 05. Blocks 07.
- Award list with filters/search/stats, officer detail modal, add/edit form with duplicate warning, soft delete, audit. Owns officer lookup endpoints.

## Key Insights
- Search q (BR-07) without new denormalized name column: normalize q in JS; match unit/team names in JS (23 rows from master) -> id lists; SQL: `a.officer_id IN (SELECT id FROM officers WHERE full_name_search LIKE ?)` OR `(a.subject='TAP_THE' AND a.team_id IN (…))` OR `(a.subject='TAP_THE' AND a.team_id IS NULL AND a.unit_id IN (…))` OR `a.decision_number_search LIKE ?`. Cost: scans active awards (<=50k rows) -> 2 queries (items + stats) ≈ 2 scans/search. Mitigate: min 2 chars, 400ms debounce, TanStack cache; FTS5 later if rows_read > 1M/day.
- Unfiltered list uses `ix_awards_list`; unit/team filter uses `ix_awards_unit_team`. Stats in one aggregate query (`COUNT(*)`, `SUM(form='DANH_HIEU')`, `SUM(subject='TAP_THE')`...) also gives `total`.
- BR-02 at write: CA_NHAN insert takes unit/team from officer via `INSERT ... SELECT ... FROM officers o WHERE o.id=? AND o.deleted_at IS NULL` (changes=0 -> 422). Update keeps stored unit/team if officer unchanged.
- Insert + audit atomic: `db.batch([insert, audit with last_insert_rowid()])` (verified spike B).
- BR-08 dup query reuses indexes: personal `(officer_id, year)`, collective `(unit_id, team_id IS ?, year)`; then compare type + variant; exclude self on update; only `deleted_at IS NULL`.

## Requirements
| Method | Path | Role | Behaviour |
|---|---|---|---|
| GET | /api/awards?unit_id&team_id&subject&form&q&page&size | all | `{items,total,stats:{total,danh_hieu,khen_thuong,tap_the,ca_nhan},page,size}`; order year DESC, id DESC; row DTO has display fields (officer name, rank, unit/team names, type/variant name, authority, decision no/date) |
| GET | /api/awards/:id | ADMIN, EDITOR | full record for edit form |
| POST | /api/awards | ADMIN, EDITOR | validate; dup -> 409 `{code:'DUPLICATE', duplicates:[{id,decision_number,year,type_name,subject_name}]}` unless `confirm_duplicate:true`; 201 `{id}` |
| PUT | /api/awards/:id | ADMIN, EDITOR | same + BR-02 edit rule + self excluded; audit before/after |
| DELETE | /api/awards/:id | ADMIN, EDITOR | soft delete; 404 if already deleted |
| GET | /api/officers/options?unit_id&team_id | ADMIN, EDITOR | compact list (id, code, full_name, rank, badge, unit_id, team_id) active only; no paging (<= few thousand rows, cached client-side) |
| GET | /api/officers/:id | all | officer info + all active awards year DESC (F02) |
Validation (server, shared zod + rules): type allowed for subject (matrix), variant required iff `requires_variant` and belongs to type, team in unit, CA_NHAN needs officer, TAP_THE forbids officer, authority exists. Edit scope per Q4 (default: any record).

UI:
- F01 list: filter bar (unit -> reload teams, team, subject, form, search), "Xóa bộ lọc", stats line, table per spec columns (STT continuous across pages, dates dd/mm/yyyy), 10/page pager, empty state w/ reset, Sửa/Xóa only ADMIN/EDITOR, personal name link sets `?officer=&award=`. Filters live in URL search params (preserved after edit/cancel; any filter change -> page 1).
- F02 modal host (global): initials avatar, info, "Khen thưởng đang xem" when `award` param (— for N/A fields), history (highlight current), empty text; buttons by role: Thêm khen thưởng -> `/awards/new?subject=CA_NHAN&unit=&team=&officer=`; Sửa thông tin (ADMIN) -> `/officers?edit=<id>`.
- F03/F09 form page: 4 groups, defaults (Cá nhân, Danh hiệu, current year), dependent selects (keep value if still valid else clear), officer select "Họ tên (cấp bậc, số hiệu)" filtered by unit/team, read-only officer info, medal variant only for Huân chương, authority auto-filled from default (user can change), errors under fields + focus first error. Buttons: Lưu khen thưởng (toast "Đã lưu khen thưởng cho …", reset, go `/` default filters), Lưu và thêm tiếp (keep all except officer), Xóa nội dung. Edit mode: title "Sửa khen thưởng", banner "Đang sửa bản ghi …", hide import tab + extra buttons, Lưu thay đổi -> toast "Đã cập nhật khen thưởng của …" back with filters; Hủy. Duplicate dialog "Có thể bị trùng" lists decision numbers; Vẫn lưu resends with confirm flag; Hủy keeps form.
- Delete confirm dialog (type name, year, subject name, decision no) -> toast "Đã xóa khen thưởng của …", stay on page (go to previous page if page becomes empty).
- Tabs container on `/awards/new`: Nhập thủ công | Import từ Excel (lazy `import-panel.tsx` stub, owned by 07).

## Related Code Files
Create/modify (owned by 06):
- `src/worker/routes/awards-routes.ts`, `src/worker/routes/officer-lookup-routes.ts`
- `src/worker/services/awards-list-query-service.ts` (filters, search, items, stats), `award-search-filter-builder.ts`, `awards-write-service.ts` (create/update/delete + audit), `award-validation-service.ts` (matrix/variant/team rules on master lookups; reused by 07), `award-duplicate-check-service.ts` (single + bulk API; reused by 07), `officer-lookup-service.ts`
- `src/shared/schemas/award-schemas.ts`, `list-query-schemas.ts`
- `src/client/pages/awards/awards-list-page.tsx`, `awards-filter-bar.tsx`, `awards-stats-line.tsx`, `awards-table.tsx`, `award-delete-dialog.tsx`, `use-awards-queries.ts`, `use-award-list-search-params.ts`
- `src/client/pages/awards/award-form-page.tsx`, `award-form-subject-section.tsx`, `award-form-type-section.tsx`, `award-form-decision-section.tsx`, `award-form-detail-section.tsx`, `use-award-form-dependent-fields.ts`, `duplicate-warning-dialog.tsx`, `src/client/pages/awards/import/import-panel.tsx` (stub only -> 07)
- `src/client/officer-detail/officer-detail-modal-host.tsx`, `officer-detail-modal.tsx`, `officer-award-history-table.tsx`
- Tests: `test/worker/awards-list-and-search.test.ts`, `awards-write.test.ts`, `award-duplicate-check.test.ts`, `officer-lookup.test.ts`, `rbac-matrix-awards.test.ts`, `test/client/awards-list-page.test.tsx`, `award-form-page.test.tsx`, `officer-detail-modal.test.tsx`

## Implementation Steps
1. Validation + duplicate services (pure-ish, accept master lookups) — unit tests first.
2. Write service (create/update/delete) with BR-02 handling + audit in batch; `decision_number_search` set on write.
3. List query service + search builder; verify query plans for main filter combos.
4. Officer lookup routes (options, detail+history).
5. F01 page, F02 modal host, F03/F09 form page, dialogs.
6. Tests (matrix below).

## Test matrix
| Case | Covers |
|---|---|
| filters each + combined; team filter with unit "Tất cả"; page reset | F01 |
| stats match filtered set; STT continuous page 2 | F01 |
| order year DESC then newest id | F01 |
| q matches officer name (case/space/NFD), team name, unit name (unit-level only), decision "qđ" vs "QĐ", `%`/`_` literal | BR-07 |
| soft-deleted awards excluded everywhere | BR-05 |
| collective at unit level (team NULL) and team level incl. Đơn vị quyết thắng at team | BR-01 |
| personal award stores officer unit/team; officer moves -> old award unchanged; edit same officer keeps; change officer takes new | BR-02 |
| Tập thể + Chiến sĩ thi đua cơ sở -> 422; Huân chương w/o variant -> 422; variant of other type -> 422 | §2, triggers |
| dup personal same type+year -> 409 list; different variant -> no dup; confirm flag saves; deleted rec not dup; update excludes self; collective unit-level vs team-level not dup | BR-08 |
| VIEWER POST/PUT/DELETE -> 403; VIEWER GET /api/officers/:id ok; options -> 403 for VIEWER | RBAC §1 |
| every write -> 1 audit row, UPDATE has before/after | §9 audit |
| UI: dependent selects keep/clear; medal field toggle; authority default; Lưu và thêm tiếp keeps fields; dup dialog flows; edit banner + hidden buttons; F02 role buttons + highlight | F02/F03/F09 |

## Todo List
- [ ] validation + duplicate services
- [ ] write service + audit
- [ ] list/search/stats service
- [ ] officer lookup routes
- [ ] F01 UI, F02 modal, F03/F09 form, dialogs
- [ ] tests

## Success Criteria
- Matrix green. F01 page request <= 4 D1 queries; unfiltered list reads <= ~(offset+10) index rows + stats scan.
- Manual: mockup flows reproducible end-to-end locally for all 3 roles.

## Risk Assessment
| Risk | L x I | Mitigation |
|---|---|---|
| Search full scans exhaust 5M reads/day at 50k rows | Med x Med | debounce/min length/caching; monitor D1 analytics; FTS5 migration path |
| Form logic complexity (> 200 lines) | High x Low | split sections + dependent-fields hook |
| BR-02 edge when subject switches | Med x Med | explicit tests both directions |

## Rollback
- Revert Worker version; soft-deleted awards restorable via SQL (`UPDATE awards SET deleted_at=NULL WHERE id=?`).

## Security Considerations
- Role checks server-side per route; ids int-validated; text lengths enforced server-side; audit before/after (no PII beyond record).

## Next Steps
- 07 reuses `award-validation-service`, `award-duplicate-check-service`, `awards-write` statement builders.
