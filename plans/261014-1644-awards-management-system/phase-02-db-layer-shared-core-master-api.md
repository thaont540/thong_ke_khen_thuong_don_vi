# Phase 02 — DB layer + shared core + master data API

## Context Links
- `docs/schema-seed.sql` (schema v2 + seed), spec §7, §8, BR-07
- Spike results from phase 01 (`plans/reports/spike-261014-results.md`)

## Overview
- Priority: P1. Status: pending. Effort 6h. Depends: 01. Blocks: 03, 04.
- Migrations, Drizzle type mirror, shared zod contracts for ALL endpoints, normalize util, award-matrix rules, Hono app skeleton with every router mounted (stubs), error mapper, `GET /api/master`.

## Key Insights
- Seed = migration (`0002`) so prod, staging and vitest all get master data identically; no separate seed step.
- `awards` has no search column for decision numbers; SQLite `LIKE` is ASCII-only case-insensitive ("QĐ" vs "qđ" fails) -> add `decision_number_search TEXT NOT NULL` (normalized at write). Collective names (units 10 rows, teams 13 rows) are matched in JS, not SQL.
- `UNIQUE COLLATE NOCASE` only covers ASCII -> uniqueness of names (BR-06) also checked in app via normalized compare.
- Defining every zod schema now = API contract; lets 03∥04 and 05∥06 run in parallel.

## Requirements
- Migrations apply cleanly local/staging/vitest; all triggers + partial indexes present.
- `GET /api/master` (all roles; auth added in 03) returns units(+teams), ranks, positions, authorities, award_types, award_variants (active only for types/variants), sorted by `sort_order`. 7 reads in one `db.batch` (~70 rows).
- Shared `normalizeText(s)` = `s.normalize('NFC').toLowerCase().replace(/\s+/g,' ').trim()`.

## Architecture
Data flow: request -> Hono app (`app.ts`) -> router -> service (Drizzle / raw `env.DB.prepare` for batch+conditional SQL) -> D1. Errors -> `AppError` -> JSON `{error:{code,message,fields?}}`; D1 trigger messages (from spike A format) mapped to 422 `CONSTRAINT`; UNIQUE violations -> 409 `CONFLICT`.

Router mount table in `app.ts` (fixed now, later phases never edit mounts):
`/api/auth`,`/api/me` -> auth-routes (03) | `/api/master` -> master-data-routes (02) | `/api/users` -> users-routes (03) | `/api/units` -> units-routes (05) | `/api/officers` -> officer-lookup-routes (06, mounted FIRST: `/options`, `GET /:id`) then officers-admin-routes (05) | `/api/awards/import` -> awards-import-routes (07, mounted before awards) | `/api/awards` -> awards-routes (06).

## Related Code Files
Create:
- `migrations/0001_init_schema.sql` — DDL from schema-seed.sql §1–4, minus `PRAGMA`, plus `awards.decision_number_search`
- `migrations/0002_seed_master_data.sql` — seed §5 verbatim
- `src/worker/db/schema/master-data-tables.ts`, `user-session-tables.ts`, `officer-award-tables.ts`, `index.ts`
- `src/worker/db/create-db-client.ts` (`drizzle(env.DB,{schema})`)
- `src/worker/lib/app-error.ts`, `src/worker/lib/error-handler.ts` (incl. D1 error mapping), `src/worker/lib/sql-like-pattern.ts` (escape `\ % _`, `ESCAPE '\'`, truncate 50 chars), `src/worker/lib/pagination.ts` (page>=1, size<=50, default 10)
- `src/worker/app.ts` (expand), `src/worker/types/hono-env.ts` (Bindings + Variables {user, session})
- `src/worker/routes/master-data-routes.ts`, `src/worker/services/master-data-service.ts` (also exports lookup maps reused by awards/import)
- Stub routers (export `new Hono()`): `auth-routes.ts`, `users-routes.ts`, `units-routes.ts`, `officers-admin-routes.ts`, `officer-lookup-routes.ts`, `awards-routes.ts`, `awards-import-routes.ts`
- `src/shared/normalize-text.ts`, `src/shared/domain-enums.ts` (ROLE, SUBJECT, FORM, AUDIT_ACTION, UNIT_KIND), `src/shared/role-permissions.ts` (role -> allowed screens/actions; used by client menu+guards and as doc for server)
- `src/shared/award-type-rules.ts` (filter types by subject/form, default authority, requiresVariant; pure fn on master DTO)
- `src/shared/date-format.ts` (ISO <-> dd/mm/yyyy, strict validation)
- `src/shared/schemas/auth-schemas.ts`, `user-schemas.ts`, `unit-schemas.ts`, `officer-schemas.ts`, `award-schemas.ts`, `award-import-schemas.ts`, `list-query-schemas.ts`, `master-data-dto.ts`
- Tests: `test/worker/migrations-and-triggers.test.ts`, `test/worker/master-data-route.test.ts`, `test/shared/normalize-text.test.ts`, `test/shared/award-type-rules.test.ts`, `test/shared/date-format.test.ts`, `test/worker/helpers/test-fixtures.ts` (insert users/officers/awards via SQL; precomputed PBKDF2 hash constant)

## Implementation Steps
1. Write 0001 from schema-seed DDL; add `decision_number_search`; keep all CHECKs, triggers, partial indexes. Apply local.
2. 0002 = seed inserts verbatim.
3. Drizzle mirror (3 files <200 lines). Add drift test: for each table, `PRAGMA table_info` columns == Drizzle column names.
4. Shared utils + zod schemas. Field rules from spec: award year 1990–2100, decision_number <=50, achievement <=2000, note <=500, decision_date ISO; officer birth_year 1950–2010, badge `^\d{6}$`, full_name collapse spaces; username `^[a-z0-9._]{3,32}$`i; password min 10; list query `page,size,unit_id,team_id,subject,form,q`. Award create/update schema = discriminated union on `subject` + `confirm_duplicate?: boolean`.
5. Error handler + app skeleton + stub routers; JSON 404 for `/api/*`.
6. Master route + service; `Cache-Control: no-store` (client caches via TanStack, invalidated on unit change).
7. Tests (see matrix).

## Test matrix
| Test | Covers |
|---|---|
| each trigger: team-not-in-unit (officer ins/upd, award ins/upd), subject_scope violation, variant required, variant-type mismatch | BR-01, spec §7 triggers |
| delete unit/team with officer or award -> abort; empty -> ok + teams cascade | BR-04 |
| partial unique badge: duplicate active fails; dup with soft-deleted ok | BR-06 |
| seed counts 10/13/12/6/4/15/7 | §8 |
| normalize: case, multi-space, NFD input == NFC | BR-07 |
| award-type-rules: Tập thể+Danh hiệu -> 4 items; Cá nhân+Danh hiệu -> 4; Khen thưởng -> 4 both; defaults per §2 | §2 matrix |
| date-format: `15/09/2026`, `2026-09-15`, rejects `31/02/2026` | F03/F04 |
| GET /api/master shape + sort | API §9 |
| Drizzle drift test | schema sync |

## Todo List
- [ ] 0001 + 0002 migrations
- [ ] Drizzle schema + drift test
- [ ] shared utils + all zod schemas
- [ ] app skeleton, error mapper, stub routers
- [ ] master API + tests

## Success Criteria
- `wrangler d1 migrations apply --local` + staging succeed; `npm run test:worker` green incl. all trigger tests.
- `GET /api/master` returns seeded data in < 10 queries.
- Every endpoint in spec §9 has request/response zod schema in `src/shared/schemas`.

## Risk Assessment
| Risk | L x I | Mitigation |
|---|---|---|
| SQL vs Drizzle drift | Med x Med | drift test; rule "migration + schema same PR" |
| D1 error text format changes | Low x Med | map by substring of our own RAISE messages; fallback generic 422 |
| Schema change after prod | Low x High | forward-only migrations; never edit applied migration |

## Rollback
- Pre-prod: drop local/staging DB and re-apply. Post-prod: new forward migration only; data via D1 Time Travel.

## Security Considerations
- All SQL parameter-bound; LIKE patterns escaped; max 100 bound params per statement respected by helpers.

## Next Steps
- 03 and 04 start in parallel. Ownership hand-off: `user-schemas`/`auth-schemas` -> 03; `unit-schemas`/`officer-schemas` -> 05; `award-schemas`/`list-query-schemas` -> 06; `award-import-schemas` -> 07.
