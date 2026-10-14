# Phase 09 — Deployment, backup, docs

## Context Links
- Spec §9 NFR (backup weekly via GitHub Actions + D1 Time Travel 7 days, WAF rate rule, HTTPS)
- Research auth §1 (WAF needs custom proxied domain); validation Q1–Q3

## Overview
- Priority: P1. Status: in progress. Effort 5h. Depends: 08 + answers to Q1, Q2, Q3.
- Production deploy pipeline, first admin, WAF rule, encrypted weekly D1 export, runbooks, project docs.

## Key Insights
- Order: migrations BEFORE code deploy (`d1 migrations apply --remote` then `wrangler deploy`); migrations must stay backward compatible with the previous Worker version (additive only).
- Worker rollback = `wrangler rollback` (instant); D1 has no down-migrations -> data rollback via Time Travel (`wrangler d1 time-travel restore`, 7 days on free) or weekly export.
- Exports contain PII -> encrypt with `age` public key (secret holds only public key; private key kept offline by unit admin) before uploading as Actions artifact (retention 90 days).
- WAF rate-limit rule (free: 1 rule) only if custom domain (Q3); else rely on D1 lockout.

## Requirements
- `deploy.yml`: manual `workflow_dispatch` (input env staging|production) + required approval for production environment; steps: install, typecheck, test, build, migrations apply, deploy, smoke `GET /api/health`.
- `backup-d1-weekly.yml`: cron weekly (Sun 18:00 UTC) + manual; `wrangler d1 export app-nghia --remote --output=backup.sql` -> gzip -> `age -r $AGE_PUBLIC_KEY` -> upload artifact; fail notification (default GitHub email).
- Production setup: create D1 prod, apply migrations (0001, 0002), `npm run create-admin -- --env prod`, verify login/force change; custom domain route (if Q3 yes); WAF rule: path `/api/auth/login` POST, 10 req / 10 s per IP -> block 10 s (free tier constraints).
- Secrets: GitHub `CLOUDFLARE_API_TOKEN` (Workers Scripts:Edit, D1:Edit, scoped to account), `CLOUDFLARE_ACCOUNT_ID`, `AGE_PUBLIC_KEY`.
- Observability: `observability.enabled: true` (Workers Logs) for CPU/error monitoring; check D1 analytics weekly first month.

## Related Code Files
Create (owned by 09):
- `.github/workflows/deploy.yml`, `.github/workflows/backup-d1-weekly.yml`
- `docs/deployment-guide.md` (setup from zero, deploy, create-admin, custom domain + WAF, secrets)
- `docs/backup-and-restore-runbook.md` (Time Travel restore, restore from export into new DB + swap binding, undo bad import by batch id, restore soft-deleted officer/award SQL)
- `docs/system-architecture.md`, `docs/code-standards.md`, `docs/project-changelog.md`, `docs/development-roadmap.md` (per documentation-management rules)
- `README.md` (quick start)
Modify: `wrangler.jsonc` (routes/custom domain, observability), `package.json` scripts if needed

## Implementation Steps
1. Confirm Q2–Q3 answers (Q1 answered: free plan). Verify login/change-password CPU p95 < 10ms on prod via Workers Logs.
2. Deploy workflow + GitHub environments (staging, production w/ reviewers).
3. Backup workflow; run once manually; test restore into scratch local DB (`wrangler d1 execute --local --file`) and verify row counts.
4. Prod provisioning + create-admin + smoke test all roles (create EDITOR/VIEWER test accounts, then lock them).
5. Custom domain + WAF rule (if applicable); verify 429/block after burst.
6. Write docs; update roadmap/changelog.

## Todo List
- [ ] Q1–Q3 resolved (Q1, Q2 done; Q3 domain open)
- [x] deploy workflow written (master -> prod, develop -> staging)
- [ ] GitHub secrets + environments (user)
- [x] backup workflow written
- [ ] first backup run + restore drill (needs secrets)
- [x] prod D1 + migrations 0001-0004 + first admin (2026-10-14); staging role smoke test OK
- [ ] custom domain + WAF
- [x] docs + runbooks + README

## Success Criteria
- Prod URL serves app over HTTPS only; first admin logged in and changed password.
- Backup artifact exists, decrypts, restores locally with matching counts.
- Rollback drill: deploy previous version via `wrangler rollback` on staging in < 2 min.
- Docs let a new maintainer deploy from scratch.

## Risk Assessment
| Risk | L x I | Mitigation |
|---|---|---|
| Data residency not approved (Q2) | Med x High | no prod deploy until written approval; on-prem pivot plan |
| API token leak | Low x High | scoped token, GitHub env secrets, rotate yearly |
| Migration breaks running version | Low x High | additive-only migrations; staging first; Time Travel restore |
| Backup silently failing | Med x Med | workflow failure email; monthly restore drill in runbook |

## Rollback
- Code: `wrangler rollback`. Data: Time Travel to timestamp before incident, or restore latest export. WAF rule: disable in dashboard.

## Security Considerations
- Backups encrypted; private key offline; repo private; least-privilege token; HTTPS only (workers.dev / custom domain always HTTPS; enable "Always Use HTTPS" on zone).

## Next Steps
- Post-launch: monitor CPU/D1 reads 2 weeks; revisit FTS5 if search cost high; resolve remaining master data items (Q6).
