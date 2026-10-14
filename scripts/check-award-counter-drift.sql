-- Drift check for award_counters: an EMPTY result means the counters equal a live GROUP BY.
--   npx wrangler d1 execute DB --remote --file scripts/check-award-counter-drift.sql
-- Rows returned = drift; fix with scripts/recompute-award-counters.sql.
WITH live AS (
  SELECT unit_id, COALESCE(team_id, 0) AS team_id, award_type_id, subject, COUNT(*) AS n
  FROM awards WHERE deleted_at IS NULL GROUP BY 1, 2, 3, 4
)
SELECT c.unit_id, c.team_id, c.award_type_id, c.subject, c.n AS counter, COALESCE(l.n, 0) AS live
FROM award_counters c
LEFT JOIN live l ON l.unit_id = c.unit_id AND l.team_id = c.team_id
  AND l.award_type_id = c.award_type_id AND l.subject = c.subject
WHERE c.n <> COALESCE(l.n, 0)
UNION ALL
SELECT l.unit_id, l.team_id, l.award_type_id, l.subject, 0, l.n
FROM live l
LEFT JOIN award_counters c ON c.unit_id = l.unit_id AND c.team_id = l.team_id
  AND c.award_type_id = l.award_type_id AND c.subject = l.subject
WHERE c.unit_id IS NULL;
