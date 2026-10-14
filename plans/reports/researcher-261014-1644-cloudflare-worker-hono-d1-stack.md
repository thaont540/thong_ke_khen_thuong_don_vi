# Research: Single Cloudflare Worker = React(Vite) SPA + Hono API + D1 (TS)
Date 2026-10-14. Skills: tkm:research activated (sk:find-skills/docs-seeker not in catalog -> WebFetch on official CF/Drizzle docs + npm registry).

## 1. Project setup
### Options
| | @cloudflare/vite-plugin | Plain `assets` + separate vite build |
|---|---|---|
| Dev | one `vite dev`, Worker runs in workerd w/ HMR, local D1 shared | 2 procs (vite + wrangler dev), proxy needed |
| Build/deploy | `vite build` -> `wrangler deploy` | manual 2 builds |
| Risk | CF-official, current React guide uses it; v1.x, ships weekly | zero plugin risk, more glue |
| Verdict | **RECOMMENDED** | fallback only |
Plugin peers: vite ^6.1|^7|^8, wrangler ^4.151 (pin matched). Node >=22.22 needed (react-router 8), vite needs 22.12+.

### wrangler.jsonc (official React guide shape, + D1 + cron)
```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "app-nghia",
  "compatibility_date": "2026-10-14",
  "compatibility_flags": ["nodejs_compat"],
  "main": "./src/worker/index.ts",
  "upload_source_maps": true,
  "assets": {
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*"]
  },
  "d1_databases": [{ "binding": "DB", "database_name": "app-nghia", "database_id": "<id>", "migrations_dir": "migrations" }],
  "triggers": { "crons": ["0 17 * * *"] }   // UTC
}
```
- `assets.directory` auto-set by plugin (client build output); only set manually w/o plugin.
- `run_worker_first: ["/api/*"]` = explicit; needs wrangler>=4.20 / plugin>=1.7 (OK). Negation `!/api/health` serves asset instead.
- Without run_worker_first, compat date >=2025-04-01 serves browser navigations to /api/x as index.html (Sec-Fetch-Mode: navigate) – only fetch() hits Worker. Explicit array avoids confusion.
- Worker invoked only on /api/* => static asset requests free + don't burn the 100k/day Worker request quota (assets requests are free/unlimited per CF pricing; not re-verified on limits page).
- Unmatched non-/api paths -> index.html (200). Make Hono 404 JSON for unknown `/api/*` yourself.

### vite.config.ts (from CF guide)
```ts
plugins: [react(), cloudflare()],   // guide shows cloudflare({viteEnvironment:{name:"worker"}}) + environments.worker.build.sourcemap
```
Order: react() before cloudflare().

### Layout (single package, KISS)
```
migrations/0001_init.sql ...        # hand-written, wrangler d1 migrations
src/worker/{index.ts, routes/, db/schema.ts, middleware/, cron/}
src/client/{main.tsx, pages/, lib/api.ts}
src/shared/{schemas.ts (zod), types.ts}   # imported by both
test/{worker/, client/, apply-migrations.ts}
scripts/{create-admin.mjs}
wrangler.jsonc vite.config.ts vitest.config.ts tsconfig.{json,worker,client}.json
```
Keep Hono type export `export type AppType = typeof app` + `hono/client` (hc) for typed fetch optional (YAGNI unless wanted). Zod schemas in shared/ reused by `@hono/zod-validator` and react-hook-form resolver = DRY win.
`wrangler types` generates `worker-configuration.d.ts` (Env) – prefer over hand-written Env; @cloudflare/workers-types now `5.20261014.1` but `wrangler types` is the CF-recommended path.

### Versions (npm registry, 2026-10-14)
| pkg | ver | note |
|---|---|---|
| hono | 4.13.13 | |
| @hono/zod-validator | 0.9.1 | peers zod ^3.25\|\|^4, hono>=4.11.2 |
| drizzle-orm | 0.45.4 | `latest`; 1.0 only beta tags -> stay 0.45 |
| drizzle-kit | 0.31.11 | optional here (see §2) |
| zod | 4.6.7 | |
| react / react-dom | 19.3.0 | |
| react-router | 8.4.0 | node>=22.22; v7->8 jump: check changelog; v8 `react-router` single pkg (no react-router-dom) |
| @tanstack/react-query | 5.104.2 | |
| react-hook-form | 7.90.0 | |
| @hookform/resolvers | 5.9.1 | zod4 support |
| vite | 8.3.4 | |
| @vitejs/plugin-react | 6.1.2 | requires vite ^8 |
| @cloudflare/vite-plugin | 1.64.0 | |
| wrangler | 4.151.0 | |
| vitest | 5.0.4 (plugin accepts ^4.1\|\|^5) | CF docs still say vitest@^4.1; **pin 4.1.x for safety or verify 5** |
| @cloudflare/vitest-plugin | 1.4.2 | **replaces** @cloudflare/vitest-pool-workers (0.23.0, deprecated, no updates) |
| @testing-library/react 16.3.3, jsdom 30.1.2 | | |
| typescript | 7.0.2 (latest tag) | native compiler; tooling compat unverified -> consider 5.9/6.x pin; verify vite/vitest/wrangler types ok |
Caret-lock all; commit lockfile.

## 2. D1 + Drizzle
- Strategy (RECOMMENDED): raw SQL in `migrations/NNNN_name.sql`, applied with `wrangler d1 migrations apply <db> --local|--remote`. Tracked in `d1_migrations` table. Drizzle schema = **types only**; never run drizzle-kit generate/push. Drop drizzle-kit dep entirely (YAGNI) unless you want `drizzle-kit introspect/pull` once to bootstrap schema.ts from the existing DB (nice shortcut: `drizzle-kit pull` against local sqlite file).
- Trade-off: schema drift risk (SQL vs schema.ts). Mitigate: a test that applies migrations then does a smoke select per table / column via Drizzle; code review rule "migration + schema.ts same PR".
- Triggers in migration file: D1 executes file via SQLite; CREATE TRIGGER ... BEGIN ... END; works (known in practice; CF migrations page silent on triggers -> **verify with a local apply early**). Do not put BEGIN/COMMIT in files. FK violations in table rebuilds: `PRAGMA defer_foreign_keys = true`.
- Partial indexes: plain `CREATE INDEX ... WHERE` in SQL; invisible to Drizzle, fine (queries unaffected).
- Drizzle sqlite schema mirror:
```ts
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  role: text("role", { enum: ["admin","user"] }).notNull().default("user"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});
```
Use `drizzle(env.DB)` per request (cheap). Columns handled by triggers: don't declare insert defaults that fight them; use `.$defaultFn` sparingly.
- Atomic writes: D1 has no interactive tx. `db.batch([...])` (Drizzle) / `DB.batch()` = one implicit SQL transaction, sequential, all-or-nothing rollback on any failure (CF D1 docs). Results returned in order. Limits apply per statement, 30s total. Drizzle `db.transaction()` on D1 binding fails (BEGIN not allowed; drizzle issues #2463/#4212, old; recheck on 0.45 once). Consequence: no read-then-write logic inside batch -> push invariants into SQL (triggers, CHECK, `INSERT ... SELECT ... WHERE`, `UPDATE ... WHERE stock>=n` + check `meta.changes`) – fits your trigger-based schema well.
- Drizzle batch doc page I fetched was Neon-only; D1 batch support is real (`db.batch`) but I verified via secondary sources + CF docs.

## 3. Testing
- Use `@cloudflare/vitest-plugin` (renamed 2026-08-19; codemod `npx @cloudflare/codemods vitest:pool-workers-to-vitest-plugin`). Old API `defineWorkersConfig`/`SELF` gone from docs: `SELF` -> `exports.default.fetch()` from `cloudflare:workers`; `env` also from `cloudflare:workers`.
- Config (CF docs):
```ts
import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";
export default defineConfig({
  plugins: [cloudflareTest(async () => {
    const migrations = await readD1Migrations(path.join(__dirname, "migrations"));
    return { wrangler: { configPath: "./wrangler.jsonc" },
             miniflare: { bindings: { TEST_MIGRATIONS: migrations } } };
  })],
  test: { setupFiles: ["./test/apply-migrations.ts"] },
});
```
```ts
// test/apply-migrations.ts  (import path of applyD1Migrations: docs show `cloudflare:test`; verify)
import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
```
- Tests: `app.request("/api/x", {headers..}, env)` (Hono, fast, pass real `env` w/ D1) OR `exports.default.fetch(url)` (full worker incl. cron-less fetch). Prefer `app.request` for routes; one or two `exports.default.fetch` smoke tests. Note: exports doesn't expose Assets; assets tests need `startDevWorker()`.
- Storage isolation per test file/test; migrations applied per setup. Triggers run for real in miniflare SQLite -> test them.
- Type: test/tsconfig types `["@cloudflare/vitest-plugin/types"]`; declare `ProvidedEnv extends Env`.
- Frontend: separate `vitest.client.config.ts` (jsdom, @testing-library/react, user-event, @vitejs/plugin-react); workers pool can't run jsdom. Use vitest `projects` in one config (project A = workers, B = jsdom) or two npm scripts. Simpler: 2 scripts `test:worker`, `test:client`.
- Gotcha: vitest 5 vs CF docs' 4.1 – plugin peers allow both; pick 4.1.x if anything flaky.

## 4. Cron
```ts
const app = new Hono<{Bindings: Env}>();
export default {
  fetch: app.fetch,
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runJob(env));
  },
} satisfies ExportedHandler<Env>;
```
- wrangler `"triggers": {"crons":[...]}`; UTC; omit key => existing deployed triggers kept; `[]` removes all. Free: 5 cron triggers/account.
- Local test: `curl "http://localhost:8787/cdn-cgi/local/scheduled?cron=0+17+*+*+*"` (vite dev port 5173 w/ plugin; check plugin exposes the route - docs say yes). Also unit-test `runJob(env)` directly w/ D1.
- Cron invocation is subject to same CPU/query caps -> chunk work.

## 5. Free plan limits that bite
| limit | free |
|---|---|
| CPU/request | 10 ms (CPU only, I/O wait excluded). Hash cost matters! |
| Subrequests/request | 50 (D1 queries counted separately below) |
| D1 queries/invocation | **50** (paid 1000). batch statements count each |
| Bound params/query | 100 -> chunk bulk inserts (~100/cols rows), `IN (...)` lists |
| Row/string/blob | 2 MB; SQL stmt 100 KB; query 30 s (whole batch) |
| D1 rows read / written per day | 5,000,000 / 100,000 (UTC reset). Reads = rows *scanned* -> index; each index write adds a row written |
| D1 storage | 5 GB acct, 500 MB/db |
| Worker requests/day | 100,000 (assets-only reqs not billed; /api/* only count) |
| Worker size | 64 MiB; assets 20k files, 25 MiB/file |
- Password hashing: bcrypt/scrypt/PBKDF2 high iterations blow 10 ms CPU. Web Crypto PBKDF2 runs native (cheaper CPU accounting but still risky >~100k iters); options: low-ish PBKDF2-SHA256 (CF itself documents PBKDF2 via crypto.subtle), or accept occasional 1102 errors. Benchmark in `wrangler dev` is NOT representative; test on deploy. Alternative: JWT/cookie session minimal verification (HMAC cheap). Biggest design risk on free plan. [unverified numbers; measure]
- Batch statement-count limit on free is not explicitly documented; 50 queries/invocation cap is the binding limit (batch of N = N queries - verify).
- `batch()` also reduces round-trips (latency), not query count.

## 6. Local dev
- `npm run dev` (vite+plugin): Worker in workerd, D1 local sqlite persisted in `.wrangler/state` (wrangler>=3). Share state between CLI and dev: use same persist dir; vite plugin persists to `.wrangler/state` by default; `wrangler d1 ... --local` uses same default. If mismatch, pass `--persist-to`.
- Flow: `wrangler d1 migrations apply app-nghia --local` -> seed -> dev. Add `preview_database_id`/`database_id` placeholder for local; `wrangler d1 create` for remote, paste id.
- Seed: `wrangler d1 execute app-nghia --local --file=seed.sql`; remote adds `--remote`. 
- First admin: SQL can't hash. Script `scripts/create-admin.mjs`: reads email/password from argv/env, hashes with SAME algo/params as Worker (share `src/shared`/`worker/lib/password.ts` via `tsx`, Node has `crypto.webcrypto.subtle` -> identical PBKDF2 code works), prints SQL, then `wrangler d1 execute app-nghia --remote --command "INSERT INTO users(...) VALUES(...)"`. Beware shell history/quoting; prefer `--file` w/ temp SQL deleted after. Alt: one-time `POST /api/setup` guarded by "no users exist" + secret env – more attack surface; reject.
- Secrets: `.dev.vars` (gitignored) local; `wrangler secret put` prod.
- Deploy: `vite build && wrangler d1 migrations apply --remote && wrangler deploy`. Migrations before code.

## Ranked recommendation
1. Vite plugin + `assets` SPA + run_worker_first ["/api/*"]; Hono; raw-SQL wrangler migrations; Drizzle query-only; `db.batch` + SQL-side invariants; @cloudflare/vitest-plugin + app.request; jsdom separate. 
2. Same but no Vite plugin (2-proc dev) – only if plugin issues.
3. drizzle-kit-managed migrations – rejected (no triggers/partial idx, drift).
Adoption risk: vite-plugin/vitest-plugin young & fast-moving (1.x, rename Aug 2026) -> pin, lock; Drizzle 0.x (1.0 in beta) -> pin 0.45; TS 7 & react-router 8 & vitest 5 are new majors -> verify or pin prior majors.

## Limitations / unresolved
- Did not run an actual scaffold; versions from npm metadata, not compat-tested together.
- Triggers via `wrangler d1 migrations apply` unverified in docs -> spike first.
- `applyD1Migrations` import path (`cloudflare:test` vs `@cloudflare/vitest-plugin`) after rename unclear.
- Free-plan batch statement cap and whether batch stmts each count toward 50 queries: not found.
- PBKDF2 iteration count that fits 10 ms CPU: unmeasured.
- Does vite dev expose `/cdn-cgi/local/scheduled`? Docs imply yes.
- Drizzle `db.transaction()` on D1 in 0.45: only old issues found.
- Whether static asset requests are fully free on Free plan (pricing page not fetched).
- Sources: developers.cloudflare.com (workers limits, d1 limits/pricing/migrations/worker-api/local-dev, vite-plugin, React guide, SPA routing, cron triggers, vitest-integration + migrate-to-vitest-plugin), orm.drizzle.team D1 page, github drizzle #2463, npm registry.
