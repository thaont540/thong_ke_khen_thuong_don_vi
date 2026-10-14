# Clarifications

## Session 2026-10-14
- Q: Workers Paid if PBKDF2 100k exceeds free 10ms CPU? → A: Must stay on free plan; lower iterations to largest value that fits.
- Q: EDITOR edit/delete scope (F09)? → A: All records, as spec.
- Q: Cờ Thi đua CP / Cờ thi đua BCA allowed at team level? → A: Allow, no block.
- Q: Delete unit/team referenced only by soft-deleted rows? → A: Block delete.
- Q: Store officer data on Cloudflare D1 (data residency)? → A: Yes for now; current data is demo only. Prod D1 `app-nghia` created 2026-10-14.
