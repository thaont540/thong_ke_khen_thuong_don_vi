# Phase 08 — Testing & hardening

## Context Links
- Test matrices in phases 02–07; spec §9 NFRs (security, D1 limits, mobile, dark mode)

## Overview
- Priority: P1. Status: implemented (manual staging checklist + coverage measurement pending). Effort 8h. Depends: 05, 06, 07. Blocks 09.
- Close coverage gaps, cross-feature flows, E2E smoke, security review, D1 cost/perf checks, a11y/responsive pass.

## Key Insights
- Unit/integration tests already live per phase; this phase adds cross-slice flows + things only visible when everything is merged (F05 <-> F02, import -> list, role changes mid-session).
- E2E kept tiny (Playwright, Chromium only, against `vite preview`/local worker with seeded test DB) — 6 flows; no visual snapshot suite (YAGNI).

## Requirements
Test pyramid:
| Layer | Tool | Scope |
|---|---|---|
| Unit | vitest (node/workers) | shared normalize, rules, validators, password hash, date |
| Integration | @cloudflare/vitest-plugin + real D1 + migrations | every endpoint, triggers, RBAC matrix, audit rows |
| Component | vitest + jsdom + Testing Library | guards, forms, dialogs, import panel |
| E2E | Playwright | 6 smoke flows below |
| Manual (staging) | checklist | CPU/limits, mobile, dark mode, real Excel files |

E2E flows:
1. Admin first login -> forced change pw -> F01.
2. Admin creates unit w/ team, officer; editor adds personal award; duplicate dialog -> Vẫn lưu; list shows 2 rows.
3. Viewer: menu has 1 item; `/units` redirects with message; F02 modal only Đóng.
4. Editor edits award (change officer) -> unit/team follow new officer; deletes award -> stays on page.
5. Editor imports template file with 3 valid + 1 error + 1 dup -> imports 3, then with checkbox 4.
6. Admin locks editor -> editor's next request 401 -> login page shows locked message.

Hardening checklist:
- Coverage targets: worker services/routes >= 85% lines, shared >= 90%, client >= 70%.
- RBAC matrix complete for every §9 endpoint x {anon, VIEWER, EDITOR, ADMIN, must_change}.
- Security: Origin check on all writes; cookies flags; no stack traces in JSON errors; body size limit (Hono `bodyLimit` 256 KB global, 5 KB for auth); zod `.strict()` rejects unknown fields; LIKE escapes; audit never contains password/hash/token; CSP header present; dependency audit (`npm audit --omit=dev`).
- D1 cost: log `meta.rows_read` per route in tests with 50k seeded awards (fixture script); assert F01 unfiltered page < 200 rows read, F02 < 500; record search cost.
- File size rule: script `scripts/check-file-lines.mjs` fails CI if any `src/**` file > 200 lines.
- a11y: labels on all inputs, focus first invalid field, modal focus trap; responsive 375px check; dark mode check on all screens.

## Related Code Files
Create (owned by 08; tests only + 2 scripts):
- `playwright.config.ts`, `e2e/first-login-flow.spec.ts`, `e2e/award-crud-and-duplicate.spec.ts`, `e2e/viewer-permissions.spec.ts`, `e2e/award-edit-officer-change.spec.ts`, `e2e/excel-import-flow.spec.ts`, `e2e/user-lock-session-revoke.spec.ts`, `e2e/helpers/seed-e2e-database.ts`
- `test/worker/rbac-matrix-complete.test.ts` (asserts every route in app has a matrix row), `test/worker/d1-read-cost.test.ts`, `test/worker/security-headers-and-limits.test.ts`
- `scripts/seed-large-dataset.ts` (50k awards, local only), `scripts/check-file-lines.mjs`
Modify (bug fixes only, coordinated with owning slice files): any `src/**` file — sequential phase, no parallel conflict.
Modify: `.github/workflows/ci.yml` (add coverage + line check + e2e job)

## Implementation Steps
1. Gap analysis vs matrices in 02–07; add missing tests.
2. RBAC completeness test (enumerate Hono routes).
3. Large dataset seed + read-cost tests; tune queries/indexes if over budget (new migration if index needed).
4. Playwright setup + 6 flows; add CI job.
5. Security checklist + fixes; `bodyLimit`.
6. Manual staging checklist (mobile, dark, real Excel, CPU per route via Workers Logs).

## Todo List
- [x] gap tests (security/limits, counters consistency, 50k read-cost)
- [x] RBAC completeness
- [x] read-cost tests + tuning (migration 0003: award_counters, ix_awards_unit_list, ix_awards_unit_team incl. id)
- [x] Playwright 6 flows + CI (e2e job non-blocking)
- [x] security checklist
- [x] line-count CI check (`npm run check:file-lines`)
- [ ] manual staging checklist signed off

## Success Criteria
- CI green: typecheck, lint, line check, worker + client + e2e; coverage targets met.
- Staging: no 1102 (CPU) or D1 limit errors over a full manual run; login CPU within plan.
- Zero open High/Critical review findings.

## Risk Assessment
| Risk | L x I | Mitigation |
|---|---|---|
| Playwright on WSL2/CI flaky | Med x Low | Chromium only, retries 1, e2e job non-blocking first week |
| Read cost over budget at 50k rows | Med x Med | add FTS5 table migration for search (`awards_search_fts`) only if measured |

## Rollback
- Test-only changes; fixes reverted per commit.

## Security Considerations
- Reviewer agent security pass on auth/middleware/import; secrets scan (`git grep` for tokens) before 09.

## Next Steps
- 09 go-live.
