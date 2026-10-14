# Phase 03 — Auth & users API (F07, F08 backend)

## Context Links
- Spec §6 F07, F08; §9 API + middleware rules; research auth §1
- Phase 02 contracts: `src/shared/schemas/auth-schemas.ts`, `user-schemas.ts`

## Overview
- Priority: P1. Status: pending. Effort 8h. Depends: 02. Parallel with 04. Blocks 05, 06.
- Password hashing, sessions, global middleware chain, RBAC, lockout, must-change gate, users CRUD, audit helper, cron cleanup, create-admin script.

## Key Insights
- Hash format `pbkdf2$sha256$<N>$<salt b64>$<hash b64>`, N = `PBKDF2_ITERATIONS` = 100000 (phase-01 Spike C: free plan accepts it). Verify reads N from string; on successful login, if stored N < current constant → rehash (lets N rise later without resets).
- CPU budget: change-password does 2 derivations (verify old + hash new); never do more than 2 per request. Compare with `crypto.subtle.timingSafeEqual`.
- Unknown username still runs PBKDF2 against a dummy hash -> constant timing.
- Last-admin invariant mostly implied by "no self demote/lock", still enforced in SQL (conditional UPDATE + `meta.changes`).
- Query budget per authed request: 1 session+user SELECT, +1 UPDATE only when `last_seen_at` > 15 min old.

## Requirements
Endpoints (all JSON):
| Method | Path | Role | Notes |
|---|---|---|---|
| POST | /api/auth/login | anon | generic error 401 "Tên đăng nhập hoặc mật khẩu không đúng"; locked/inactive 423 "Tài khoản đang bị khóa" |
| POST | /api/auth/logout | all | delete session row, clear cookie |
| POST | /api/auth/change-password | all (allowed under gate) | current ok, new >=10, != old, confirm match; clears must_change; deletes other sessions |
| GET | /api/me | all (allowed under gate) | id, username, full_name, role, must_change_password |
| GET | /api/users?q=&page= | ADMIN | search username / full_name (normalized in JS on <=~20 rows is fine; SQL LIKE ok) |
| POST | /api/users | ADMIN | temp password (client may generate) -> must_change=1 |
| PUT | /api/users/:id | ADMIN | full_name, role, is_active; username immutable; role change/lock -> delete all sessions of user; block self demote/lock; keep >=1 active ADMIN |
| POST | /api/users/:id/reset-password | ADMIN | new temp pw, must_change=1, failed=0, locked_until=NULL, delete sessions; return pw once |
| DELETE | /api/users/:id | ADMIN | only if no created_by refs (officers/awards/import_batches) and no audit_logs.user_id rows, else 409 |

Middleware order (`app.ts`): error handler -> origin-check (non GET/HEAD/OPTIONS: `Origin` must equal request origin, require `content-type: application/json`) -> session-auth (skip `/api/auth/login`, `/api/health`) -> must-change gate -> per-route `requireRole(...)`.
Login: lockout 5 consecutive fails -> `locked_until = now+15m`, reset count; success resets count, sets last_login_at, creates session (32-byte token base64url, store SHA-256 hex, expires now+8h, user_agent truncated 200). Cookie `__Host-sid`, HttpOnly, Secure, SameSite=Strict, Path=/, Max-Age 28800.
Audit: LOGIN, LOGIN_FAILED (user_id if known, detail {username}), LOGOUT, PASSWORD_CHANGE, PASSWORD_RESET, LOCK, UNLOCK, CREATE/UPDATE/DELETE entity 'user' (never log passwords/hashes).
Cron: `DELETE FROM sessions WHERE expires_at < datetime('now')`.

## Architecture
Login flow: zod body -> SELECT user by username (NOCASE) -> locked? 423 -> verify hash -> fail: `db.batch([UPDATE counters, INSERT audit])` -> 401 | ok: `db.batch([UPDATE user, INSERT session, INSERT audit])` -> Set-Cookie -> `{me}`.
Session middleware: cookie -> sha256 -> `SELECT s.*, u.* FROM sessions s JOIN users u ... WHERE token_hash=? AND expires_at > now AND u.is_active=1` -> 401 if none -> sliding refresh if stale -> `c.set('user')`.

## Related Code Files
Create (owned by 03):
- `src/worker/lib/password-hash.ts` (hash/verify, webcrypto only, runs in Node too)
- `src/worker/lib/session-token.ts`, `src/worker/lib/session-cookie.ts`
- `src/worker/lib/audit-log-statement.ts` (returns prepared stmt for inclusion in batches; `entity_id` param or `last_insert_rowid()`)
- `src/worker/middleware/origin-check-middleware.ts`, `session-auth-middleware.ts`, `must-change-password-gate.ts`, `require-role-middleware.ts`
- `src/worker/services/auth-login-service.ts`, `src/worker/services/session-service.ts`, `src/worker/services/users-service.ts`
- `src/worker/cron/cleanup-expired-sessions.ts`
- `scripts/create-admin.ts` (tsx; args `--username --name [--env staging|prod|local]`; generates 16-char temp pw, hashes with same lib, writes temp SQL file in OS tmp, runs `wrangler d1 execute --file`, deletes file, prints pw once)
- Tests: `test/worker/auth-login.test.ts`, `auth-session-and-gate.test.ts`, `auth-change-password.test.ts`, `origin-check.test.ts`, `users-admin.test.ts`, `rbac-matrix.test.ts` (table-driven over every §9 endpoint x role; extended by later phases only by appending rows in their own `rbac-matrix-<feature>.test.ts`), `cron-cleanup.test.ts`, `test/shared/password-hash.test.ts`
Modify: `src/worker/app.ts` (middleware chain), `src/worker/index.ts` (scheduled), `src/worker/routes/auth-routes.ts`, `users-routes.ts`, `package.json` (script `create-admin`)

## Implementation Steps
1. password-hash + tests (round trip, wrong pw, tampered salt, format parse, iterations read from string).
2. token/cookie libs; session service (create, lookup, refresh, delete one/all/all-except).
3. Middlewares; wire in app.ts; JSON 401/403 bodies `{error:{code:'UNAUTHENTICATED'|'FORBIDDEN'|'PASSWORD_CHANGE_REQUIRED'}}`.
4. Auth routes (login/logout/change-password/me) with audit in same batch.
5. Users routes + service with conditional SQL guards.
6. Cron handler + `scheduled` export.
7. create-admin script; test against `--local`.
8. RBAC matrix test scaffold.

## Test matrix (F07/F08)
| Case | Expect |
|---|---|
| login ok | 200, cookie flags exact, session row hashed (not raw token) |
| wrong pw / unknown user | 401 same message; unknown user still ~same latency path |
| 5th fail | locked_until set; 6th with correct pw -> 423 |
| lock expired | login ok, count reset |
| is_active=0 | 423 |
| must_change user calls /api/awards | 403 PASSWORD_CHANGE_REQUIRED; /api/me ok |
| change-password: short/same/mismatch | 400 field errors; success kills other sessions, keeps current |
| logout | row deleted, cookie cleared, next call 401 |
| expired session (>8h) | 401; last_seen updated only after 15 min |
| POST without/foreign Origin | 403 |
| users: self demote/lock | 409; role change -> target sessions deleted |
| reset password | must_change=1, unlocked, sessions deleted, pw returned once |
| delete user with created_by refs | 409; fresh user -> 200 |
| RBAC: EDITOR/VIEWER on /api/users | 403; no session -> 401 |
| cron | expired sessions removed, active kept |

## Todo List
- [ ] password hash lib + tests
- [ ] session token/cookie/service
- [ ] 4 middlewares wired
- [ ] auth routes + audit
- [ ] users routes + guards
- [ ] cron cleanup
- [ ] create-admin script
- [ ] tests incl. RBAC matrix

## Success Criteria
- All tests above green; `npm run create-admin -- --env local` creates admin able to log in and forced to change pw.
- Login request <= 4 D1 queries; authed request <= 2 extra queries.
- Staging login CPU within plan limit (from spike decision).

## Risk Assessment
| Risk | L x I | Mitigation |
|---|---|---|
| CPU limit on login | High x High | N from Spike C; test asserts ≤ 2 derivations/request; monitor `exceededCpu` in Workers Logs |
| `__Host-` cookie on http localhost | Low x Low | browsers treat localhost secure; fallback name `sid` in dev via env var |
| Lockout DoS on admin account | Med x Med | 15m only; WAF rate rule (Q3); 2+ admins recommended |
| Script leaks pw in shell history | Low x Med | pw generated in script, SQL via temp file deleted |

## Rollback
- Revert Worker version (`wrangler rollback`); sessions table can be truncated safely (forces re-login).

## Security Considerations
- No raw tokens or hashes in logs/audit; generic login error; constant-time compare; Origin check + SameSite=Strict; must-change gate; every write audited.

## Next Steps
- 05, 06 (once 04 done). Phase 08 adds abuse tests.
