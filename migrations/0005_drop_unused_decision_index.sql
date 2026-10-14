-- ix_awards_decision (decision_number) is never used: search is `decision_number_search LIKE '%..%'`
-- (leading wildcard, cannot use a b-tree) and no query compares decision_number by equality.
-- Dropping it saves one index write per award insert/update.
DROP INDEX IF EXISTS ix_awards_decision;
