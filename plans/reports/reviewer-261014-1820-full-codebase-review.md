# Code Review: awards management app (full codebase, read-only)

Date 2026-10-14. Branch develop @ 5cdb357. Scope: src/worker/**, src/shared/**, src/client/** (auth, guards, award form, import), migrations 0001/0002, scripts/create-admin.ts, public/_headers.
Baseline: `npx tsc -b` clean; `npm test` 354 worker + 94 client pass. `biome check` reports 2 errors (in a test file under concurrent edit, not reviewed). No source edited.

## Overall
Solid. Parameterized SQL everywhere, hashed session tokens, `__Host-` cookie, per-request role/active read from DB, `changes()`-chained audit in `db.batch`, last-admin guard in SQL, BR-02 snapshot in INSERT...SELECT, trigger backstops, Origin+JSON CSRF gate, `_headers` CSP. No critical findings. Main gaps: login lockout is bypassable by burst concurrency, unauthenticated write amplification on D1 free quota, admin cannot clear a temporary lock, F01 stats query cost at spec scale, a few non-atomic/TOCTOU spots.

## Critical
None.

## High
None confirmed. (H-candidate downgraded: see M1.)

## Medium

### M1. Lockout bypass via concurrent login burst (TOCTOU)
`src/worker/services/auth-login-service.ts:44-62,106-156`
Lock state is read once (L44-56), then PBKDF2 verify (L58), failure recorded after (L60). N parallel requests all read `failed_login_count=0`/no lock, all pass the check, each tests a different password; the lock engages only after 5 commits, but all in-flight attempts are already verified. Effective guesses per lock window = burst size, not 5.
Fix: reserve the attempt before verifying, atomically: `UPDATE users SET failed_login_count = failed_login_count+1, locked_until = CASE ... END WHERE id=? AND (locked_until IS NULL OR locked_until <= ?) ` and check `meta.changes`; on success reset to 0 (current success batch already does). Still keep the Cloudflare rate rule (spec §9) and note it is infra, not in repo (grep: no rate-limit config/doc shipped; only plan mentions).

### M2. Unauthenticated login attempts amplify D1 writes (free-quota DoS)
`auth-login-service.ts:106-156`
Every failed login (also unknown username) does `INSERT audit_logs` (+UPDATE users, +LOCK audit). Attacker needs no session: 100k row-writes/day free cap exhausted by ~30-50k bad logins, then all writes (awards, sessions, logins) fail app-wide. Also unbounded audit_logs growth.
Fix: skip audit row for unknown usernames or only audit first failure + LOCK per window; keep CF rate rule documented as mandatory deploy step. Related: locked/inactive early return (L54-56) skips PBKDF2 -> 423 vs 401 reveals existing locked/disabled usernames and gives timing oracle (spec mandates the 423 message, so accept but rate-limit).

### M3. Admin cannot clear a temporary (failed-login) lock
`src/worker/services/users-service.ts:125,133`; `src/client/pages/users/users-table.tsx:61-78`
Row shows badge "Tạm khóa" (is_active=1, locked_until future) but the toggle button reads "Khóa" (is_active true). `PUT {is_active:true}` on an already-active user is a no-op: `reactivating` is only true when `before.is_active !== 1`, so `locked_until`/`failed_login_count` are never cleared. Only workaround: reset password (which unlocks, forces new password) or wait 15 min. Spec F08 "Khóa hoặc Mở khóa" implies unlock.
Scenario: attacker locks `admin` repeatedly (see M1/M2 note); legit admin cannot unlock a second admin without resetting their password.
Fix: add explicit unlock (e.g. `unlock: true` in userUpdateSchema or treat `is_active:true` with `locked_until>now` as unlock; write UNLOCK audit); UI: show "Mở khóa" when `is_locked`.

### M4. F01 list issues full-set COUNT/SUM on every page request
`src/worker/services/awards-list-query-service.ts:46-53`
Stats query scans the whole filtered set joined to award_types on every page click/refetch. Unfiltered at spec scale (50k awards) = ~50k+ rows read per request, x2 with search (LIKE is a full scan anyway). D1 free = 5M reads/day -> ~50-100 list views/day exhaust it. Spec §9: "Mọi truy vấn danh sách phải dùng index và LIMIT".
Fix: fetch stats only when filters change (separate endpoint/param, client-cached across pages); or denormalize `form` onto awards (or use ix_awards_type GROUP BY award_type_id,subject index-only) so stats are index scans; at minimum skip stats when `page>1`.
Also `team_id` filter without `unit_id` cannot use `ix_awards_unit_team` (leading column unit_id): falls back to ix_awards_list scan.

### M5. Import `batch_id` can be reused without row cap; batch row created outside the atomic batch
`src/worker/services/award-import-service.ts:39,52-58`; `award-import-batch-store.ts:24-37`
(a) `total_rows` (<=1000) is client-asserted; server never enforces cumulative rows per batch. Owner (ADMIN/EDITOR) can POST unlimited 30-row lots to one `batch_id` for 2h (each lot passes validation). Bounded by role + body limit (256KB OK, `bodyLimit` correctly after role check) but defeats spec 1000-row limit server-side and is a D1 write-quota lever.
(b) `createImportBatch` is a separate `.run()` before the `d1.batch` of inserts: if the batch fails (D1 error, trigger abort) an orphan `import_batches` row (imported_rows=0) stays; retry makes another.
Fix: enforce `SELECT SUM` cap (imported_rows+lot <= total_rows <= 1000) in the closing statement/pre-check; create the batch row inside the same `db.batch` as first lot (INSERT then `last_insert_rowid()` for awards via subselect) or accept and document orphan.

### M6. Import commit retry after partial failure duplicates data when "include duplicates" ticked
`src/client/pages/awards/import/use-import-workflow.ts:119-139`
On a mid-run failure UI returns to `ready` with `partial` info but keeps all rows and `includeDuplicates`. Clicking commit again re-sends every row (new batch id): already-saved rows now match DB duplicates -> skipped if box unticked (safe), but re-inserted if ticked (the scenario where the user wanted dup rows). Also the per-row result of the failed lot is lost.
Fix: after a failure, drop rows whose lot already returned `imported`, or force re-run of dry-run before re-enabling commit.

### M7. Browser freeze on sparse sheets with huge `!ref`
`src/client/pages/awards/import/excel-file-reader.ts:41-52`
`sheetRows` loops the entire declared range (r*c). A <5MB .xlsx with formatting to row 1048576 (common) makes ~1M x N iterations + `encode_cell`, freezing the tab before the 1000-row check runs.
Fix: pass `sheetRows: IMPORT_MAX_ROWS + 2` to `XLSX.read`, and/or clamp `range.e.r`/`range.e.c` (cols <= 12-30), stop after N consecutive blank rows.

### M8. change-password is an unthrottled current-password oracle
`src/worker/services/change-password-service.ts:21-26`
Wrong current password returns 400 without touching `failed_login_count`. Anyone holding a stolen/left-open session (or a must-change account with a known temp pw) can brute-force the current password at unlimited rate (no lock, no audit). Impact limited (already authenticated as that user) but undermines lockout for password reuse elsewhere.
Fix: count failures against the same counter / lock, audit LOGIN_FAILED-style.

## Low

- L1. `awards-write-service.ts:94-139` updateAward: `before` read, then UPDATE not conditional on state; concurrent edits give lost update and audit `before` can be stale. Officer swap path (L105-110) does a separate officer SELECT, unlike create which guards inside INSERT...SELECT; officer deleted between SELECT and UPDATE leaves award pointing at soft-deleted officer. Fix: `UPDATE ... WHERE id=? AND updated_at = ?` (optimistic) and `AND EXISTS(officer active)` for CA_NHAN.
- L2. `award-import-service.ts:62-72` + `award-import-batch-store.ts:62-67`: IMPORT audit lists `savedRowNumbers` incl. rows later flagged OFFICER_GONE, and is written even when 0 inserts changed rows; no per-award audit rows (acceptable per-lot, but `saved_ids_count` can be wrong). `error_rows` accumulates again if a client re-posts the same lot.
- L3. `units-service.ts:87-97` updateUnit audit not `onlyIfPreviousChanged`; unit deleted concurrently -> audit row for nothing then 404. Team name swap (A<->B) in one PUT hits UNIQUE(unit_id,name) on the sequential renames -> generic 409 "Tên hoặc mã đội bị trùng".
- L4. `officers-service.ts:136-158` deleteOfficer: already-soft-deleted by a concurrent request returns `ok` with 0 awards, no audit (TOCTOU after `findActiveOfficer`). `officer-code-generator.ts:6-11` MAX(CAST(substr(code,3))) scans all officers on every insert (fine <5k).
- L5. `officer-lookup-service.ts:10` `OPTIONS_CAP=5000` silently truncates picker/import lookup list; beyond that officers vanish from F03 and import returns "Không tìm thấy cán bộ" client-side (server still authoritative). Surface a warning or paginate.
- L6. No `bodyLimit` on any route except import; `parseJsonBody` buffers whole body before zod (login is unauthenticated). Workers cap bodies, so low. Add `bodyLimit` (e.g. 64KB) app-wide.
- L7. `users-routes.ts:35`/`resetPassword`: temp password response lacks `Cache-Control: no-store`. POST not cached by default, hygiene only. Same for /api/awards etc. (no cache header; dynamic JSON not cached by CF default).
- L8. `login` does not revoke the browser's pre-existing session cookie/session row (old token stays valid until expiry); no absolute session lifetime (sliding extends forever while active). Spec only requires 8h idle; note.
- L9. `auth-login-service.ts:139` audit detail stores attempted username (<=32 chars); users often paste password into username field. Consider not storing for unknown users.
- L10. `award-validation-service`/`getMasterData` filter `award_types.is_active=1`: editing an award whose type/variant was later deactivated fails with UNKNOWN_TYPE (422). Edge only when catalog is deactivated.
- L11. `users-service.ts:213-242` deleteUser blocked by any `audit_logs.user_id` row; every user that ever logged in has LOGIN rows, so "delete account without data" only works for never-logged-in users. Matches intent loosely; message tells admin to lock instead.
- L12. Unused imports in `awards-write-service.ts` (`normalizeText`, `DuplicateKey`, `Bind`): lint noise.
- L13. CSP in `public/_headers` allows `style-src 'unsafe-inline'` (React inline style attrs). API responses carry no `X-Content-Type-Options` (JSON only; low).

## Verified OK (per focus list)
- Session: 32B random token, base64url; only SHA-256 stored; cookie `__Host-sid; HttpOnly; Secure; SameSite=Strict; Path=/`; 8h sliding with 15-min write throttle; expiry + `is_active` enforced in the single SELECT; cron cleanup.
- Invalidation: change-password drops other sessions; reset-password, lock, role change delete all sessions (changes()-chained, races with last-admin guard leave sessions/audit intact); role/is_active/must_change read live each request.
- Gate: `mustChangePasswordGate` exact `METHOD path` allow-list (me, change-password, logout); trailing-slash variants fail closed. Origin check covers every non-safe `/api/*` incl. login; requires JSON content-type if body present.
- RBAC: all write routes behind `requireRole`; users/units/officers-admin `use("*", ADMIN)`; `/options` + `GET /awards/:id` + writes = ADMIN/EDITOR; F02 `/officers/:id` all roles; mount order (lookup before admin) correct. No route VIEWER/EDITOR can write beyond spec. EDITOR sees only compact officer options (no birth_year/position).
- Mass assignment: zod strips unknown keys; `created_by`/import_batch_id/unit for CA_NHAN set server-side (INSERT...SELECT from officer, BR-02). `unit_id` ignored for CA_NHAN on create/update.
- SQL: all binds; LIKE patterns escaped (`\ % _`) with `ESCAPE '\'`, length-capped 50; IN lists bound; no string concat of input.
- BR-02 create/update (same officer keeps snapshot; other officer takes current), BR-05 cascade in one batch, BR-06 (partial unique badge, unit code/name via normalizeText, team unique), BR-08 (variant via `IS ?`, team NULL vs unit-level separate, excludeId on edit, LIMIT 20), last-admin invariant (update + delete guarded in SQL), audit before/after on award update, trigger + `mapD1Error` backstops, error handler never leaks stack/SQL (generic 500).
- Import messages match spec §5 table exactly; server re-validates every row, dry_run never writes, `batch_id` ownership + 2h TTL, 30-row lots, 256KB body limit, role check before parse, VIEWER blocked.
- Client: route guards + API enforcement, `safeNextPath` rejects `//` and external targets, query cache cleared on login/401/logout, 403/PASSWORD_CHANGE_REQUIRED handled without toast loop.
- create-admin script: password never on CLI, temp SQL file 0600 and deleted, hash via worker lib.

## Edge cases from scouting
- BR-04 decision (soft-deleted refs block delete) means a unit whose only data was soft-deleted officers can never be deleted; no restore UI. Intentional per clarifications.
- `GET /api/awards/import` falls through to `/:id` (404/403), harmless.
- `awards` `trg_awards_check_upd` fires on UPDATE OF subject/unit/team/type/variant only; officer_id changes covered by CHECK. OK.
- Spec §9 states rate-limit rule on /api/auth/login: not representable in repo; confirm it is created at deploy (phase-09) since M1/M2 depend on it.

## Recommended actions (priority)
1. M1 atomic attempt reservation; confirm CF rate-limit rule is deployed (also mitigates M2).
2. M3 explicit unlock path (API + UI label).
3. M2 stop auditing unknown-user failures / throttle audit writes.
4. M4 move/cache F01 stats; fix team-only filter index.
5. M5 server-side cumulative cap + batch creation inside batch; M6/M7 client fixes.
6. M8 throttle change-password current check. Then lows as time allows.

## Metrics
- Type check: clean. Tests: 448 pass. Biome: 2 errors in test file (concurrent edits; not reviewed). Coverage not measured.

## Unresolved questions
- Is the Cloudflare rate-limit rule for /api/auth/login created/documented in deploy runbook (not visible in repo)?
- Is `error_rows`/`total_rows` expected to be authoritative on import_batches (client-supplied today)?
- Should an admin be able to clear a failed-login lock without resetting the password (spec F08 ambiguous)?

**Status:** DONE_WITH_CONCERNS
**Summary:** No critical/high issues; 8 medium and 13 low findings. Medium: M1 lockout burst bypass, M2 unauthenticated D1 write amplification, M3 no unlock for temp-lock, M4 F01 stats cost at scale, M5 import batch not capped/atomic, M6 retry duplicates after partial import, M7 sparse-sheet browser freeze, M8 change-password oracle.
