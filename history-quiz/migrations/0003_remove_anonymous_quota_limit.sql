-- Remove the lifetime test-count gate while preserving anonymous identities
-- and historical test records.
PRAGMA foreign_keys = ON;

DROP TRIGGER IF EXISTS trg_attempts_consume_quota;

-- Visitors previously blocked at the old limit can submit again. Keep the
-- legacy counters for historical reporting, but no longer treat their status
-- as an authorization decision.
UPDATE anonymous_visitors
SET status = 'active',
    updated_at = CURRENT_TIMESTAMP
WHERE status = 'blocked';
