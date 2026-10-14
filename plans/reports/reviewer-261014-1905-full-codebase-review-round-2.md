# Code Review Round 2 - full codebase (HEAD 2f3348f, develop)

Scope: worker (middleware, auth, awards, import, officers, units, users), migrations 0001-0004, client import/save paths, CI/deploy/backup workflows. Read-only; no files edited. Static analysis of code paths + existing test inventory (did not re-run suites; all reported green).

## Overall
No critical/high found. Round-1 fixes M1-M8/L1/L2 verified correct. Remaining: 3 medium (1 API-contract hole, 1 availability/enumeration, 1 CI gating), plus lows.

## Verification of previous fixes (all OK unless noted)

- login-attempt-guard.ts:25-47 - single conditional `UPDATE ... RETURNING`; precondition (active, not locked) and counter/lock transition in one statement => atomic. Burst of N parallel guesses: only first <=5 pass the WHERE, rest get null -> 423 without PBKDF2. Lock expiry: at lock count reset to 0 and `locked_until` set; after expiry WHERE passes (`<=`), first wrong attempt => count 1, stale `locked_until` stays non-null but `locksNow` requires count===0, so no false lock audit. Strings compare correctly (same `YYYY-MM-DD HH:MM:SS` format). Success path resets both. OK.
- change-password lockout: shares guard; on lock deletes all sessions; OK. Edge: user locked by attacker's login spam cannot change password until expiry (acceptable).
- Admin unlock of temp lock (users-service.ts:104-108): `patch.is_active === true && tempLocked` clears counters; reset-password also clears. OK.
- award_counters triggers (0003): checked insert / update-old(-1) / update-new(+1) / soft delete (old only) / restore (new only) / hard delete / officer cascade (UPDATE awards deleted_at fires old trigger per row). Edit with unchanged keys nets 0. Soft-deleted rows skipped on both sides. Team NULL -> 0 via COALESCE consistent between list filter and counter filter. Test award-counters.test.ts compares to live GROUP BY. OK. D1 `meta.changes` includes trigger writes: all uses are `> 0` / `=== 0` (never exact count); deleteOfficer correctly reads count in-batch. SQL `changes()` chain ignores trigger writes (SQLite semantics). OK.
- Migration 0004 trigger (BEFORE UPDATE OF imported_rows, `imported_rows > total_rows` abort): concurrent lots racing past the stale capacity pre-check roll back the whole `db.batch` (inserts included). Error string mapped in error-handler.ts:14. Index ix_awards_import_batch usable by `import_batch_id = ?`. OK.
- Optimistic concurrency: UPDATE guarded by `updated_at = before.updated_at` + audit `changes()>0`; officer-gone vs stale vs deleted disambiguated after. Edge OK except M1 below.
- Origin check (origin-check-middleware.ts): header-based body detection. Cross-origin form/fetch always carries Origin => 403 before body parsing; same-origin only passes. `Origin: null`, missing Origin, scheme/host mismatch all rejected. Body-less detection only affects defense-in-depth Content-Type rule; a body sent with no length/type headers (possible on H2) would still need a matching Origin, so no CSRF bypass. SameSite=Strict + `__Host-` cookie add a second layer. OK.
- Must-change gate: exact `METHOD path` allowlist, fails closed on trailing slash/case. Session user re-read from DB each request, so role change / deactivate effective immediately (sessions also deleted). OK.
- CSP (_headers): built index.html has one external module script, no inline script/eval; fonts bundled; `style-src 'unsafe-inline'` needed for React style props. Compatible. Note e2e runs on Vite dev so `_headers` is never exercised in CI (only unit-asserted).
- Backup workflow: gzip consumes plaintext, `age` public-key encrypt, plaintext .gz shredded, only `*.sql.gz.age` uploaded, fails if recipient missing. OK.
- SQL injection / LIKE: all values bound; LIKE escapes `\ % _`; interpolated SQL only uses constants/placeholders. Mass assignment: zod strips unknown keys. OK.

## Findings

### Medium

**M1. `updated_at` optional on PUT bypasses optimistic concurrency** - src/shared/schemas/award-schemas.ts:28 (`.optional()`), src/worker/services/awards-write-service.ts:97-98 (`input.updated_at !== undefined && ...`).
Scenario: A and B load award; A saves; B (or any API client / older tab build / future UI code path that omits the token, e.g. `use-award-form-save.ts:61` falls back to no token when `editing.updated_at` falsy) PUTs without `updated_at` -> UPDATE binds the freshly read `before.updated_at`, so B silently overwrites A. The M-fix only protects clients that opt in.
Fix: separate `awardUpdateSchema` with `updated_at: z.string().min(1)` required for PUT (create schema omits it); client always sends it (disable Save until loaded).

**M2. Unauthenticated lockout DoS of any/sole admin + username enumeration via 423** - auth-login-service.ts:57-60, login-attempt-guard.ts, app.ts (no IP throttle).
Scenario: attacker sends 5 bad logins/15 min per known username (usernames are guessable: `admin`) -> account permanently locked, including the only ADMIN (unlock needs another admin; only recovery is `npm run create-admin`). Also known-user returns 423 (before password check) vs 401 for unknown user, so usernames are enumerable; inactive accounts are distinguishable too.
Fix: add Cloudflare WAF rate-limiting rule on `POST /api/auth/login` (per IP) and consider Turnstile after N failures; optionally per-(username, IP) bucket so one IP cannot lock a victim; document `create-admin` as break-glass in runbook. If enumeration matters, return same 401 body for locked and wrong-password (keep 423 for already-authenticated change-password).

**M3. Production deploy can be triggered from any branch; CF token exposed to untrusted-ish jobs** - .github/workflows/deploy.yml:68-72 (prod `if`), :23-25 (workflow-level `env`), :29-40 (`check` job).
Scenario: `workflow_dispatch` target=production on branch `feature/x` deploys that branch's code to prod (gated only by environment reviewers, whose config is not in repo). Workflow-level `env: CLOUDFLARE_API_TOKEN` is also present in `check` job during `npm ci` (arbitrary dependency install scripts) and in staging job; if the secret is repo-level, a develop push has a prod-capable token and the `production` reviewer gate protects nothing about the secret.
Fix: prod condition `github.ref == 'refs/heads/master' && (push || dispatch with target=production)`; move token to per-environment secrets (staging token scoped to staging account/DB, prod token only in `production` environment) and set `env` at step level of deploy steps only; set environment "deployment branches" = master.

### Low

- L-a Session has no absolute lifetime: session-service.ts:62-72 slides expiry forever while used (stolen cookie persists). Add `created_at + 7d` cap in lookup.
- L-b API JSON lacks `Cache-Control: no-store` (api-hardening-middleware.ts comment claims "nothing cacheable" but `secureHeaders` doesn't set it; only login and /me do). Lists of users/officers (PII) could be stored by shared proxies/browsers heuristically-less but still best practice; add `c.header("Cache-Control","no-store")` in `apiSecurityHeaders` wrapper.
- L-c Excel reader silent truncation: excel-file-reader.ts:42,86-103. `sheetRows` caps at 102 raw rows; row-count error only fires when non-blank rows > 100. A sheet with blank rows interleaved in first 102 and data below passes with rows after row 102 silently dropped. `!fullref` is set by SheetJS only when truncated; fail whenever it exists and declared data rows > SHEET_ROWS_CAP-1 (or show a warning).
- L-d D1 100-bound-parameter limit: award-search-filter-builder.ts:60-70 binds one param per matching team/unit name in `IN (...)`; fine at ~23 rows today, 500 if >~90 teams match a short term (e.g. "a"). Cap lists (slice 80) or fall back to subquery on names.
- L-e Officer code race retried once only: officers-service.ts:62-69. 3+ concurrent creates (MAX+1 collisions) => second collision surfaces as 500. Loop up to 3-5.
- L-f Team code collision after unit rename: units-team-sync-service.ts:30-34/100 generates `<newUnitCode>-T<n>` with suffix from the unit's own teams; if another unit once used that code prefix (teams keep old codes), UNIQUE(teams.code) fails and user sees generic "Tên hoặc mã đội bị trùng". Pick suffix with a global `MAX` lookup or retry.
- L-g Import `row_number` is client-supplied and not unique (award-import-schemas.ts:23): duplicate numbers collapse `findIntraFileDuplicates` keys and `results.find` in award-import-service.ts:96 maps outcomes to the wrong row. Only affects the caller's own batch; add `superRefine` uniqueness.
- L-h Unused index `ix_awards_decision` (0001:181): search uses `decision_number_search LIKE '%..%'`; index never used, costs a write per award. Drop in next migration (additive-only rule: new migration, fine).
- L-i Counter drift undetected: if counters ever diverge (manual SQL, restore of partial dump) `n - 1` on a missing row is a silent no-op. Add a cron/health check comparing `award_counters` to GROUP BY, or a documented rebuild SQL in runbook.
- L-j deploy.yml:17-19 concurrency group includes `inputs.target || 'auto'`, so a push deploy and a dispatch deploy to the same env run concurrently; use `group: deploy-<env>`.
- L-k ci.yml: `e2e` still `continue-on-error: true` (comment says first week only, now 6/6 green); no `permissions: contents: read`; actions pinned by tag not SHA; deploy `check` job repeats ci.yml tests (double CI per push).
- L-l officers-service.ts:~125-150 deleteOfficer returns 200 `{deleted_awards:0}` when officer already deleted concurrently (batch is no-op, no audit). Check `results[2].meta.changes` and 404.

## Edge cases scouted, no issue
- Officer soft delete + award create race: insert is `INSERT..SELECT FROM officers WHERE deleted_at IS NULL` in same batch; count read in-batch. Safe.
- Last-admin invariant: guard inside UPDATE/DELETE statements (`OTHER_ACTIVE_ADMIN`), changes()-chained audit + session delete; two admins deactivating each other serialize correctly.
- Import atomicity: lot inserts + audit + counter update in one batch; retry skips already-answered rows client-side; BR-08 checked per lot against DB so cross-lot duplicates caught server-side.
- F01 stats: counters path used only when q blank (`normalizeText(q)===""` matches `toLikePattern` null), live scan with search; list/stat filters identical.
- Spec check: BR-02 (same officer keeps unit/team, other officer takes current), BR-05, BR-06, BR-08 (variant-aware, excludeId on edit, LIMIT 20) match code.

## Positive
Atomic SQL-level guards (login, last admin, import cap, optimistic update) rather than read-then-write; trigger backstops mirrored by friendly messages; PII-free audit; encrypted backups; fail-closed gate; good test inventory (counters vs live GROUP BY, origin, RBAC matrices, query plan, read cost).

## Metrics
Type coverage / coverage %: not measured this round. Lint/typecheck: reported clean by requester.

## Unresolved questions
1. Is `production` GitHub environment configured with required reviewers and branch restriction (not verifiable from repo)? Are CF secrets repo-level or environment-level?
2. Should locked-account response stay distinguishable (423) per spec, or accept generic 401 to stop enumeration?
3. Is a Cloudflare WAF rate-limit rule on /api/auth/login already set up outside the repo?

**Status:** DONE_WITH_CONCERNS
**Summary:** No critical/high; round-1 fixes verified correct. 3 medium + 12 low.

Findings by severity:
- medium: src/shared/schemas/award-schemas.ts:28 + src/worker/services/awards-write-service.ts:97 - optional `updated_at` bypasses optimistic concurrency
- medium: src/worker/services/auth-login-service.ts:57 - unauthenticated lockout DoS (sole admin) + 423 username enumeration, no IP throttle
- medium: .github/workflows/deploy.yml:68,23 - prod deployable via dispatch from any branch; CF token at workflow-level env incl. `check` job
- low: src/worker/services/session-service.ts:62 - no absolute session lifetime
- low: src/worker/middleware/api-hardening-middleware.ts:17 - no `Cache-Control: no-store` on API despite comment
- low: src/client/pages/awards/import/excel-file-reader.ts:86 - silent truncation past sheetRows cap with blank rows
- low: src/worker/services/award-search-filter-builder.ts:60 - D1 100-bind-param limit with many matching teams/units
- low: src/worker/services/officers-service.ts:62 - officer code race retried once only
- low: src/worker/services/units-team-sync-service.ts:100 - team code collision after unit rename
- low: src/shared/schemas/award-import-schemas.ts:23 - row_number not unique, result mapping ambiguity
- low: migrations/0001_init_schema.sql:181 - unused ix_awards_decision
- low: migrations/0003_award_counters.sql - no drift detection/rebuild path
- low: .github/workflows/deploy.yml:17 - concurrency group allows parallel deploys to same env
- low: .github/workflows/ci.yml - e2e continue-on-error stale, no permissions block, tag-pinned actions
- low: src/worker/services/officers-service.ts:125 - deleteOfficer returns 200 on concurrent already-deleted
