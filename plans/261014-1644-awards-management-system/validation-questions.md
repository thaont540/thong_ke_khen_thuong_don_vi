# Validation questions (need user confirmation)

Grouped by priority. Each has options; [Recommended] marked.

## Answers (2026-10-14)
- Q1 → **Must stay on free plan.** Lower PBKDF2 iterations to largest value fitting 10ms CPU (deviation from spec §7/§9). See phase-01 Spike C + phase-03.
- Q4 → A: EDITOR edits/deletes all records (spec as-is).
- Q5 → A: allow Cờ thi đua at team level (no block).
- Q8 → A: block delete; message shows active counts + soft-deleted note.
- Q2 → allowed for now (demo data only); prod D1 created.
- Q3, Q6 still open (business/infra info; do not block dev, block go-live). Q7 → default A (keep .xls).

## Blocking (before phase 09 go-live; Q1 before phase 03 finishes)

**Q1. Workers Paid fallback.** Spec forbids lowering PBKDF2 iterations; free plan = 10ms CPU/request. Phase 01 spike measures real CPU on deployed Worker.
- A [Recommended] Pre-approve Workers Paid ($5/mo) now; switch automatically if p95 login CPU > 10ms or any error 1102. Also lifts D1 query cap 50 -> 1000/invocation.
- B Stay free; accept intermittent login failures (not acceptable for prod).
- C Change spec to lower iterations (spec forbids).

**Q2. Data residency** (spec §9 open issue). Officer names, birth years, badge numbers stored on Cloudflare D1.
- A [Recommended] Get written approval before prod deploy; dev/staging uses fake data only until then.
- B Not allowed -> plan pivots to on-prem (same schema, Hono on Node + SQLite); phases 01/09 change, others reusable.

**Q3. Hosting accounts.**
- Custom domain proxied by Cloudflare? Needed for WAF rate-limit rule on `/api/auth/login`. A [Recommended] yes (subdomain of unit domain). B no -> `*.workers.dev`, D1 lockout is only brute-force control.
- Private GitHub repo + who owns CF API token (CI deploy + weekly backup)? Backups contain PII -> encrypted with `age` before upload as artifact.

## Important (affects implementation; defaults chosen if no answer)

**Q4. EDITOR edit/delete scope (F09).** A [Recommended/default] all records, as spec; audit_logs keep before/after. B only records with `created_by = self` (adds 1 condition in awards write service + UI hiding).

**Q5. Cờ Thi đua của Chính phủ / Cờ thi đua của Bộ Công an at team level (BR-01).** A [default] allow (current spec, no block). B block in shared award rules (`team_id` must be NULL for these codes) - app-level, not trigger, cheap to change.

**Q6. Master data confirmation.** Default authority table (spec §2) + full medal variant list. Default: ship seed as-is; later changes = new migration `000N_update_master_data.sql` (data-only, no code). Need final list before prod seed ideally.

## Nice-to-have

**Q7. `.xls` support.** A [Recommended] keep (SheetJS reads xlsx/xls/csv at no extra cost). B xlsx+csv only.

**Q8. Delete unit/team referenced only by soft-deleted officers/awards.** FK + trigger block hard delete. A [Recommended] block, message shows active counts + "còn dữ liệu đã xóa (khôi phục được)". B purge soft-deleted rows first (loses restore ability).

## Decisions taken without asking (override if wrong)
- User hard-delete allowed only if no `created_by` refs AND no `audit_logs.user_id` rows (FK); else 409 "chỉ có thể khóa".
- Session cookie `__Host-sid`, Max-Age 8h refreshed when `last_seen_at` updated (every >15 min).
- Officer code: `CB` + zero-padded 3 digits, grows to 4+ digits after CB999; never reuses codes of soft-deleted officers.
- New team code auto-generated `<unitCode>-T<n>`; renaming keeps code.
- Dark mode = OS preference only (like mockup), no toggle.
