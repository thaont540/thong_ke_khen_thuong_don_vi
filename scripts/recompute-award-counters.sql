-- Rebuilds award_counters from awards (same GROUP BY as migration 0003).
-- Run when scripts/check-award-counter-drift.sql returns rows (partial restore, manual SQL):
--   npx wrangler d1 execute DB --remote --file scripts/recompute-award-counters.sql
DELETE FROM award_counters;
INSERT INTO award_counters (unit_id, team_id, award_type_id, subject, n)
SELECT unit_id, COALESCE(team_id, 0), award_type_id, subject, COUNT(*)
FROM awards WHERE deleted_at IS NULL
GROUP BY unit_id, COALESCE(team_id, 0), award_type_id, subject;
