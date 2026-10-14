# Development rules (project)

Global rules apply (YAGNI/KISS/DRY, conventional commits, run lint + tests before push). Project specifics:

- File names: kebab-case, descriptive. Keep each code file under 200 lines; split by feature.
- Schema changes: the SQL migration in `migrations/` and the Drizzle schema (`src/worker/db/schema.ts`) change in the same PR. Drizzle is for typed queries only; no drizzle-kit.
- Migrations are raw SQL, never edited after merge. No `BEGIN/COMMIT` (D1 forbids them).
- Multi-statement writes use `db.batch()`; invariants live in SQL (triggers, conditional UPDATE + `meta.changes`). A batch counts each statement toward the free-plan 50-queries-per-invocation cap.
- Bound parameters max 100 per query: chunk bulk inserts and `IN (...)` lists.
- Never commit `.dev.vars` or secrets. Rerun `npm run cf-typegen` after editing `wrangler.jsonc`.
- Free Workers plan: 10 ms CPU per request; avoid heavy CPU work in request handlers.
