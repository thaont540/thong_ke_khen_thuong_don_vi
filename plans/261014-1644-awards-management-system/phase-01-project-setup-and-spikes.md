# Phase 01 — Project setup + spikes

## Context Links
- Stack research: `plans/reports/researcher-261014-1644-cloudflare-worker-hono-d1-stack.md` (§1 setup, §3 tests, §5 limits)
- Auth/CPU research: `plans/reports/researcher-261014-1644-auth-excel-cpu-limits.md` (§1)
- Spec §9 NFR "Giới hạn CPU"

## Overview
- Priority: P1 (blocks everything). Status: pending. Effort 6h.
- Scaffold single-package repo, toolchain, test harness, staging deploy; run 4 go/no-go spikes before any feature code.

## Key Insights
- `wrangler dev` does NOT enforce CPU limit -> PBKDF2 bench must run on a deployed Worker.
- D1 migrations with `CREATE TRIGGER ... BEGIN ... END;` undocumented -> verify locally, remotely AND via vitest `readD1Migrations` (it splits SQL itself).
- D1 forbids `BEGIN/COMMIT`; `PRAGMA foreign_keys` likely rejected/ignored (D1 enforces FKs by default) -> drop that line.
- Atomic "insert + audit" relies on `last_insert_rowid()` inside `db.batch()` -> verify.
- Node 24.10 installed (react-router 8 needs >=22.22: OK).

## Requirements
- Functional: `npm run dev` serves SPA + `/api/health`; `npm test` runs worker + client suites; `npm run deploy:staging` deploys.
- Non-functional: pinned versions + committed lockfile; strict TS; Biome lint/format.

## Architecture
- One Worker: `assets.not_found_handling = single-page-application`, `run_worker_first: ["/api/*"]`; D1 binding `DB`; cron `0 17 * * *` (00:00 VN).
- wrangler envs: top-level = production, `env.staging` (own D1 db `app-nghia-staging`, workers.dev).
- Tests: `vitest.worker.config.ts` (`@cloudflare/vitest-plugin`, migrations applied in setup) + `vitest.client.config.ts` (jsdom).

## Related Code Files (create)
- `package.json`, `package-lock.json`, `.nvmrc` (24), `.gitignore` (node_modules, dist, .wrangler, .dev.vars, *.sql backups), `.dev.vars.example`
- `wrangler.jsonc`, `vite.config.ts`, `vitest.worker.config.ts`, `vitest.client.config.ts`, `biome.json`
- `tsconfig.json` (refs), `tsconfig.worker.json`, `tsconfig.client.json`, `tsconfig.node.json`
- `index.html`, `src/client/main.tsx` (placeholder), `src/worker/index.ts`, `src/worker/app.ts` (health only; expanded in 02)
- `migrations/0000_spike_trigger.sql` (spike only; deleted before 02 — never applied to prod)
- `src/worker/spike/pbkdf2-bench-route.ts` (temporary; deleted end of phase)
- `test/worker/apply-migrations-setup.ts`, `test/worker/spike-trigger-and-batch.test.ts`
- `.github/workflows/ci.yml` (typecheck, lint, test on push/PR)
- `docs/development-rules.md` (pointer to global rules + project specifics: file size <200 lines, kebab-case, migration+schema same PR)

## Implementation Steps
1. `git init`, default branch `main`; add `.gitignore` first.
2. Install pinned deps: hono 4.13.x, @hono/zod-validator 0.9.x, zod 4.6.x, drizzle-orm 0.45.4, react/react-dom 19.3, react-router 8.4, @tanstack/react-query 5.104, react-hook-form 7.90, @hookform/resolvers 5.9, @fontsource/be-vietnam-pro; dev: vite 8.3, @vitejs/plugin-react 6.1, @cloudflare/vite-plugin 1.64, wrangler 4.151, vitest 4.1.x, @cloudflare/vitest-plugin 1.4.x, jsdom, @testing-library/react + user-event + jest-dom, typescript 5.9.x, @biomejs/biome, tsx. Use `--save-exact`.
3. `wrangler.jsonc` per research §1 + `env.staging`; `npx wrangler types` -> `worker-configuration.d.ts` (committed; regenerate script `cf-typegen`).
4. Scripts: `dev`, `build` (`vite build`), `typecheck` (`tsc -b`), `lint` (`biome check`), `test:worker`, `test:client`, `test`, `db:migrate:local|staging|prod`, `deploy:staging`, `deploy:prod` (build -> migrations apply --remote -> wrangler deploy), `create-admin` (phase 03).
5. Spike A (triggers): `0000_spike_trigger.sql` = 2 tables + 1 `BEFORE INSERT` trigger with `RAISE(ABORT,'Đội không thuộc đơn vị')` + 1 partial index. Apply `--local`, staging `--remote`, and in vitest. Assert trigger fires and error message text reachable in thrown error (record exact D1 error format for 02's error mapper).
6. Spike B (batch): in vitest + staging: `db.batch([insert, insert audit using last_insert_rowid()])`; failing 2nd stmt rolls back 1st; count batch statements toward 50-query cap (run batch of 49/51 stmts on staging free plan).
7. Spike C (PBKDF2 CPU): temp route `GET /api/__bench/pbkdf2?iter=N` guarded by header `x-bench-token` == secret `BENCH_TOKEN`. Deploy staging, sweep N ∈ {10k, 20k, 30k, 50k, 75k, 100k}, 30 calls each, plus a `?double=1` mode (2 derivations, = change-password cost). Read CPU time via `wrangler tail --format json` / Workers Logs (`observability.enabled: true`). Record p50/p95, any 1102 errors.
8. Spike D (vite plugin dev): confirm `/cdn-cgi/local/scheduled` reachable in `vite dev` (else document `wrangler dev` for cron testing).
9. Write results into `plans/reports/spike-261014-results.md`; pick `PBKDF2_ITERATIONS` = largest N with p95 CPU of double mode ≤ 8ms (margin under 10ms), round down to 5k; record in report + `src/worker/auth/password-config.ts` (phase 03). If even 10k fails, escalate to user. Delete bench route + spike migration; reset staging D1 (`wrangler d1 delete` + recreate) so 0001 starts clean.
10. CI workflow green on first commit.

## Todo List
- [ ] git init + .gitignore
- [ ] deps pinned, lockfile committed
- [ ] wrangler.jsonc (prod + staging), D1 dbs created
- [ ] tsconfig split, biome, vite config
- [ ] vitest worker + client configs, one sample test each
- [ ] Spike A triggers (local/remote/vitest)
- [ ] Spike B batch atomicity + last_insert_rowid + query cap
- [ ] Spike C PBKDF2 CPU on deployed staging
- [ ] Spike D cron trigger in vite dev
- [ ] spike report + cleanup
- [ ] CI workflow

## Success Criteria
- `npm run dev` -> browser shows placeholder; `curl /api/health` -> `{"ok":true}`; unknown `/api/x` -> JSON 404.
- `npm test` passes both projects; `npm run typecheck` + `lint` clean.
- Spike report has numbers: PBKDF2 p95 CPU ms, trigger OK in 3 envs, batch rollback OK, batch stmt counting rule.
- Go/no-go recorded for Workers plan.

## Risk Assessment
| Risk | L x I | Mitigation |
|---|---|---|
| PBKDF2 100k > 10ms CPU | High x High | User chose free plan: lower N per Spike C; compensate w/ lockout, 10-char min, WAF rule |
| Triggers break in wrangler/vitest splitter | Med x High | Fallback: move checks to app layer + keep triggers in a separate migration applied via `d1 execute`; document |
| vite-plugin / vitest-plugin young, breaking | Med x Med | exact pins; fallback 2-process dev (research option 2) |
| vitest 4.1 vs plugin mismatch | Low x Med | pin per CF docs |

## Rollback
- Nothing deployed to prod. Staging Worker/DB disposable (`wrangler delete --env staging`).

## Security Considerations
- Bench route protected by secret + deleted before phase end; `BENCH_TOKEN` secret removed.
- `.dev.vars` never committed; CF API token only in GitHub secrets.

## Next Steps
- Phase 02. Iteration count from Spike C feeds phase 03.
