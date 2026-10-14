---
name: project-awards-system-plan-decisions
description: Awards management app (app_nghia) master plan location, phase parallelism contracts, and pending user decisions as of 2026-10-14
metadata:
  type: project
---

Master plan: plans/261014-1644-awards-management-system/ (9 phases; 03∥04, 05∥06 parallel via pre-mounted stub routers in src/worker/app.ts and lazy stub pages in src/client/app-router.tsx).

Pending user decisions (validation-questions.md): Workers Paid pre-approval for PBKDF2-100k CPU, data residency of officer PII on Cloudflare, custom domain + private GitHub repo, EDITOR edit scope, Cờ thi đua at team level, master data confirmation, .xls support, unit delete with soft-deleted refs.

**Why:** spec forbids lowering PBKDF2 iterations while free plan has 10ms CPU; residency is a go-live blocker.
**How to apply:** check whether these were answered before re-planning; don't re-ask resolved ones. Related: [[awards-system-spec-deviations]]
