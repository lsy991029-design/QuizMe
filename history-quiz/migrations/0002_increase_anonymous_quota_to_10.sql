-- Increase the anonymous lifetime quota for existing visitors from 3 to 10.
-- Safe to run more than once.
PRAGMA foreign_keys = ON;

UPDATE anonymous_visitors
SET test_limit = 10,
    status = CASE WHEN tests_used >= 10 THEN 'blocked' ELSE 'active' END,
    updated_at = CURRENT_TIMESTAMP
WHERE test_limit < 10;
