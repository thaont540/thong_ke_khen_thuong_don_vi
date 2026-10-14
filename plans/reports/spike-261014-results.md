# Phase 01 spike results (local + remote staging, 2026-10-14)
Date 2026-10-14. Stack: wrangler 4.151.0, @cloudflare/vite-plugin 1.64.0, @cloudflare/vitest-plugin 1.4.2, vitest 4.1.11.

## Spike A: trigger + partial index
- `migrations/0000_spike_trigger.sql` (4 tables, partial unique index, BEFORE INSERT trigger with `WHEN ... BEGIN SELECT RAISE(ABORT,'...'); END;`).
- `wrangler d1 migrations apply DB --local`: OK ("7 commands executed": trigger parsed as one statement).
- vitest (`readD1Migrations` splitter + `applyD1Migrations`): OK, trigger fires, partial unique index ignores soft-deleted rows.
- Exact error from D1 binding (vitest/miniflare), `err.message`:
  `D1_ERROR: Đội không thuộc đơn vị: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_TRIGGER)`
  (`err.cause.message` = same without `D1_ERROR: `). Error mapper: match with `includes("<RAISE text>")`; UNIQUE violations contain `UNIQUE constraint failed`.
- `wrangler d1 execute --local` CLI prints `Đội không thuộc đơn vị: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_TRIGGER)`.
- Remote staging: PENDING.

## Spike B: db.batch
- vitest: `batch([insert, insert audit using last_insert_rowid()])` OK; audit.record_id equals `meta.last_row_id` of stmt 1.
- Failing 2nd statement (trigger abort) rejects the batch with the same D1_ERROR message and rolls back stmt 1 (count 0).
- Staging: 49/51-statement cap test PENDING.

## Spike C: PBKDF2 CPU
- Route `src/worker/spike/pbkdf2-bench-route.ts` at `/api/__bench/pbkdf2?iter=N&double=1`, header `x-bench-token` vs `env.BENCH_TOKEN` (403 otherwise; iter validated 1..1e6). Covered by vitest.
- Local run (vite dev, workerd): iter=100000 double=1 -> wallMs 32 (wall only, not CPU, not representative).
- Remote CPU measurement: PENDING (deploy staging, `wrangler secret put BENCH_TOKEN --env staging`, sweep, read CPU via wrangler tail/Workers Logs).

## Spike D: cron under `vite dev`
- `curl "localhost:5173/cdn-cgi/local/scheduled?cron=0+17+*+*+*"` -> HTTP 200, scheduled handler ran (log `scheduled run: cron=0 17 * * *`). `wrangler dev --test-scheduled` not needed.

## Other findings
- All planned pins exist; no deviations (vitest 4.1.11, typescript 5.9.3, biome 2.5.15, tsx 4.23.15; unpinned-in-plan: jsdom 30.1.2, jest-dom 7.0.1, user-event 14.6.8, testing-library/react 16.3.3).
- jsdom 30.1.2 engines `^22.22.2 || ^24.15.0`; local Node 24.10.0 gives EBADENGINE warning but client tests pass. CI uses `.nvmrc` (24).
- `vite build` outputs worker to `dist/app_nghia`, client to `dist/client`; for staging use `CLOUDFLARE_ENV=staging vite build` (script `deploy:staging` does this; untested remotely).
- `TEST_MIGRATIONS`/`BENCH_TOKEN` typed in `test/worker/env.d.ts`.
- D1 ids: staging f9bcb8d3-..., prod 6c30470a-... set in wrangler.jsonc.

## Remote results (staging, Workers free plan, APAC D1)
### Spike A remote
- `0000` migration w/ trigger applied via `wrangler d1 migrations apply --remote` OK. Trigger fires on remote D1: `Đội không thuộc đơn vị: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_TRIGGER) [code: 7500]`.

### Spike B remote (statement/query caps)
- Single `db.batch` with 49, 51, 100, 500 statements: all OK.
- 49 / 51 / 60 sequential D1 calls in one request: all OK. Free-plan cap is not 50 any more (or batch counts as 1 call). Import lot of 30 rows in ONE batch is safe.

### Spike C remote (PBKDF2-SHA256, cpuTime from `wrangler tail`, ms, 15 req each)
| N | single p50/p95/max | double p50/p95/max |
|---|---|---|
| 10k | 5/10/12 | 7/12/21 |
| 20k | 5/8/9 | 9/16/16 |
| 30k | 8/12/15 | 14/22/24 |
| 50k | 10/17/18 | 25/37/44 |
| 75k | 19/28/36 | 31/55/58 |
| 100k | 20/35/36 | 41/69/71 |
- Burst: 60 concurrent `100k double` -> 60/60 HTTP 200, outcome `ok`, p50 43 / p95 72 / max 78 ms CPU. No 1102 / exceededCpu.
- Iteration cap confirmed: 100000 OK, 100001 throws (workerd limit).
- Baseline overhead ~5 ms even at 10k -> rule "double p95 <= 8ms" unattainable at any N.

### Decision
- Free plan does NOT enforce 10 ms per request at this volume (CF allows bursts). Keep spec value **PBKDF2_ITERATIONS = 100000** on free plan (satisfies both spec §7 and user's "free only").
- Safeguards: iterations stored in hash string (can lower later w/o reset); max 2 derivations/request; monitor `outcome=exceededCpu` in Workers Logs; if 1102 appears in prod -> lower N (e.g. 20k) via constant + rehash-on-login.
- Cleanup done: bench route, spike migration, spike tests, BENCH_TOKEN secret removed; staging D1 spike tables + d1_migrations rows dropped.
