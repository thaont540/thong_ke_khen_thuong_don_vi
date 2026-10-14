---
title: "Hệ thống quản lý thi đua, khen thưởng (F01–F09)"
description: "Single Cloudflare Worker (Hono API + React SPA + D1) for award records, officers, units, users, Excel import."
status: pending
priority: P1
effort: 75h
branch: main (repo not initialised yet; created in phase 01)
tags: [cloudflare-workers, hono, d1, react, drizzle, zod, auth, excel-import]
created: 2026-10-14
---

# Plan overview

Spec: `docs/spec.md` (authoritative). Schema: `docs/schema-seed.sql`. UI: `docs/mockup.html`.
Research: `plans/reports/researcher-261014-1644-cloudflare-worker-hono-d1-stack.md`, `plans/reports/researcher-261014-1644-auth-excel-cpu-limits.md`.

| # | Phase | Effort | Depends on | Status |
|---|-------|--------|-----------|--------|
| 01 | [Project setup + spikes](phase-01-project-setup-and-spikes.md) | 6h | – | done |
| 02 | [DB layer + shared core + master API](phase-02-db-layer-shared-core-master-api.md) | 6h | 01 | pending |
| 03 | [Auth & users API (F07, F08 backend)](phase-03-auth-and-users-api.md) | 8h | 02 | pending |
| 04 | [Frontend shell, design system, auth/user screens](phase-04-frontend-shell-design-system.md) | 10h | 02 | pending |
| 05 | [Units & officers slice (F05, F06)](phase-05-units-and-officers-slice.md) | 8h | 03, 04 | pending |
| 06 | [Awards slice (F01, F02, F03, F09)](phase-06-awards-slice.md) | 14h | 03, 04 | pending |
| 07 | [Excel import slice (F04)](phase-07-excel-import-slice.md) | 10h | 06 | pending |
| 08 | [Testing & hardening](phase-08-testing-and-hardening.md) | 8h | 05, 06, 07 | pending |
| 09 | [Deployment, backup, docs](phase-09-deployment-backup-docs.md) | 5h | 08 | pending |

## Dependency graph

```
01 ─> 02 ─┬─> 03 ─┬─> 05 ───────────┐
          │       │                 ├─> 08 ─> 09
          └─> 04 ─┴─> 06 ─> 07 ─────┘
Parallel: {03 ∥ 04}, {05 ∥ 06}. 05 ∥ 07 also OK (no shared files).
```

## Cross-phase contracts (enable parallel work)
- `src/worker/app.ts` created in 02 with ALL routers mounted (stub files); 03 adds global middleware; later phases only fill their own router files.
- `src/shared/schemas/*` (zod) all created in 02 = API contract; afterwards each file owned by its feature phase.
- `src/client/app-router.tsx` created in 04 with lazy page stubs; 05/06/07 fill only their own page dirs.
- F02 modal is global, driven by URL `?officer=<id>&award=<id>` (owned by 06). F05 opens it by setting params. F02 "Sửa thông tin" navigates `/officers?edit=<id>` (handled by 05).

## Key decisions
- Raw-SQL wrangler migrations (0001 schema, 0002 master seed); Drizzle = typed queries only, no drizzle-kit.
- All multi-statement writes via `db.batch()` (atomic); invariants in SQL (triggers, conditional UPDATE + `meta.changes`).
- Pins: TS 5.9.x (not 7), vitest 4.1.x, react-router 8.4 (fallback 7.x), vite 8 + plugin-react 6, hono 4.13, zod 4, drizzle-orm 0.45.4, SheetJS 0.20.3 tarball.
- Dark mode follows OS (`prefers-color-scheme`) exactly like mockup; no toggle (YAGNI). Font self-hosted via @fontsource.
- **Free plan only (user decision 2026-10-14):** spike showed free plan accepts 100k PBKDF2 (p95 72ms CPU, 60/60 burst OK, no 1102) -> keep spec 100000 (= workerd cap). N stored in hash string so it can be lowered later if 1102 appears. See `plans/reports/spike-261014-results.md`.
- Spec deviations (minor): `awards.decision_number_search` column; import endpoint adds `dry_run` + `batch_id` params.

## Validation questions (details + options: [validation-questions.md](validation-questions.md))
1. ~~Workers Paid~~ → answered: stay free, lower iterations.
2. Data residency: is officer PII on Cloudflare allowed? (spec open issue; blocks prod go-live)
3. Hosting: custom domain on CF zone (needed for WAF login rate-limit) + private GitHub repo for CI/backup?
4. EDITOR scope → answered: all records.
5. Cờ thi đua at team level → answered: allow.
6. Confirm default authority table + full medal variant list before prod seed.
7. Keep `.xls` import support?
8. Unit/team delete w/ soft-deleted refs → answered: block.
