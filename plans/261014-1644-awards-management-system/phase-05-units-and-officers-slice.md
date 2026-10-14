# Phase 05 — Units & officers slice (F05, F06): API + UI

## Context Links
- Spec §6 F05, F06; BR-04, BR-05, BR-06, BR-07; API §9 rows units/officers
- Contracts: `src/shared/schemas/unit-schemas.ts`, `officer-schemas.ts` (now owned by 05)

## Overview
- Priority: P1. Status: done. Effort 8h. Depends: 03, 04. Parallel with 06 and 07.
- ADMIN-only management of units (+inline teams) and officers, with soft delete cascade.

## Key Insights
- `GET /api/officers/options` and `GET /api/officers/:id` belong to 06 (`officer-lookup-routes.ts`) — 05 must NOT add them.
- Officer code atomically: `INSERT INTO officers(code,...) SELECT 'CB'||printf('%03d', COALESCE(MAX(CAST(substr(code,3) AS INTEGER)),0)+1), ... FROM officers` (includes soft-deleted -> never reuse); retry once on UNIQUE conflict.
- Name uniqueness (unit name/code, team name in unit) checked with `normalizeText` in app before write (NOCASE is ASCII-only); DB UNIQUE is backstop.
- BR-04 friendly message needs counts before delete; trigger is backstop. Soft-deleted rows also block (FK) -> message per Q8.
- Officer soft delete = one `db.batch`: UPDATE awards SET deleted_at (officer, not deleted) + UPDATE officer + audit.

## Requirements
| Method | Path | Role | Behaviour |
|---|---|---|---|
| GET | /api/units?q= | ADMIN | code, name, kind, description, team_count, officer_count, award_count (active rows; aggregate subqueries on 10 rows) |
| GET | /api/units/:id | ADMIN | unit + teams[{id,code,name,officer_count,award_count}] |
| POST | /api/units | ADMIN | unit + teams[] names; codes auto `<unitCode>-T<n>` |
| PUT | /api/units/:id | ADMIN | full teams list: items with id = rename, without id = insert, missing ids = delete (blocked if used: 409 "Không thể xóa … vì còn x cán bộ và y khen thưởng thuộc đội này") |
| DELETE | /api/units/:id | ADMIN | 409 "Chưa thể xóa đơn vị" + counts; else delete unit (teams cascade) |
| GET | /api/officers?unit_id&team_id&q&page&size | ADMIN | q matches full_name_search LIKE, badge_number prefix, code; includes award_count, rank, position, unit/team names; order unit sort, full_name |
| POST | /api/officers | ADMIN | badge unique among active (409 field error), team in unit |
| PUT | /api/officers/:id | ADMIN | same; does NOT touch existing awards (BR-02) |
| DELETE | /api/officers/:id | ADMIN | soft delete + soft delete its awards (BR-05); response includes deleted award count |
All writes: audit row (CREATE/UPDATE/DELETE, entity unit/team/officer, detail before/after JSON) in same batch. Unit mutations -> client invalidates `['master']`.

UI:
- F06 `units-page`: search, table (Mã, Tên + mô tả, Loại, Số đội, Số cán bộ, Số khen thưởng, Sửa/Xóa), view modal (fields + teams table + "Sửa đơn vị"), form modal with inline team list editor (add row, rename, remove; empty/dup name errors).
- F05 `officers-page`: unit/team filter (`unit-team-select`), search, 10/page, table columns per spec, name/"Xem" sets `?officer=<id>` (opens global F02 modal from 06), form modal (code read-only, rank/position selects from master, team first option "Không thuộc đội", BR-03 lock), delete confirm with họ tên, số hiệu, số khen thưởng. Handles `?edit=<id>` param (from F02 "Sửa thông tin") by opening edit modal.

## Related Code Files
Create/modify (owned by 05):
- `src/worker/routes/units-routes.ts`, `src/worker/routes/officers-admin-routes.ts`
- `src/worker/services/units-service.ts`, `units-team-sync-service.ts` (diff teams -> statements), `officers-service.ts`, `officer-code-generator.ts`
- `src/shared/schemas/unit-schemas.ts`, `officer-schemas.ts` (refine if needed)
- `src/client/pages/units/units-page.tsx`, `unit-detail-modal.tsx`, `unit-form-modal.tsx`, `team-list-editor.tsx`, `use-units-queries.ts`
- `src/client/pages/officers/officers-page.tsx`, `officers-table.tsx`, `officer-form-modal.tsx`, `officer-delete-dialog.tsx`, `use-officers-queries.ts`
- Tests: `test/worker/units-api.test.ts`, `officers-api.test.ts`, `rbac-matrix-units-officers.test.ts`, `test/client/units-page.test.tsx`, `officers-page.test.tsx`

## Implementation Steps
1. Units service + routes (list with counts, detail, create, update with team diff, delete with pre-check). All writes in one `db.batch` (<= 50 statements: teams <= ~40 guard -> 400 if exceeded).
2. Officers service + routes (list paged, create w/ code gen, update, soft delete cascade).
3. Audit details: before/after objects (only changed fields for UPDATE).
4. UI pages + modals; mutations invalidate `['master']`, `['units']`, `['officers']`, `['officer-options']`, `['awards']` (counts/names).
5. Tests.

## Test matrix
| Case | Covers |
|---|---|
| unit code dup case-insensitive ("p1" vs "P1"), name dup with VN case ("phòng 1") | BR-06, F06 |
| team dup name within unit 409; same name other unit ok | BR-06 |
| rename team keeps code + award history | F06 |
| remove used team -> 409 exact message; unused -> deleted | BR-04 |
| delete unit with officers/awards -> 409 counts; empty -> unit + teams gone | BR-04 |
| officer badge 5 digits / letters -> 400; dup active -> 409; dup of soft-deleted ok | BR-06 |
| code sequence CB001.. continues after soft delete (no reuse) | F05 |
| team not in unit -> 422 (trigger/app) | spec triggers |
| officer delete -> officer + all its awards soft-deleted, excluded from lists | BR-05 |
| officer update unit -> old awards keep unit/team | BR-02 |
| search "nguyễn  văn" matches; "%" literal | BR-07 |
| EDITOR/VIEWER -> 403 on all routes here | RBAC |
| UI: BR-03 lock; ?edit opens modal; delete dialog shows award count | F05 UI |

## Todo List
- [x] units API + team diff
- [x] officers API + code gen + soft delete cascade
- [x] audit rows
- [x] F06 UI
- [x] F05 UI (+ ?edit, ?officer integration)
- [x] tests

## Success Criteria
- All matrix tests green; every write produces exactly 1 audit row (per operation).
- Officers list query uses `ix_officers_unit_team` when filtered (verify `EXPLAIN QUERY PLAN` in test or manual).

## Risk Assessment
| Risk | L x I | Mitigation |
|---|---|---|
| Code generation race | Low x Low | single-statement insert + UNIQUE + retry |
| Team diff exceeds 50-query cap | Low x Med | guard team count; one statement per changed team only |
| Unit rename makes names stale elsewhere | Low x Low | names joined at read time, never denormalized |

## Rollback
- Revert Worker version; data changes reversible via soft delete restore SQL / Time Travel.

## Security Considerations
- `requireRole('ADMIN')` on every route; ids validated as positive ints; audit before/after.

## Next Steps
- 08 integration (F05 -> F02 modal flow needs 06 merged).
