-- Anonymous lifetime quota for the history personality quiz.
-- Safe to run more than once.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS anonymous_visitors (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  test_limit INTEGER NOT NULL DEFAULT 10 CHECK (test_limit >= 0),
  tests_used INTEGER NOT NULL DEFAULT 0 CHECK (tests_used >= 0 AND tests_used <= test_limit),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS personality_test_attempts (
  id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL REFERENCES anonymous_visitors(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  test_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
  result_data TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE (visitor_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_personality_test_attempts_visitor_created
  ON personality_test_attempts (visitor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS anonymous_request_limits (
  visitor_id TEXT PRIMARY KEY REFERENCES anonymous_visitors(id) ON DELETE CASCADE,
  window_started_at INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0)
);

-- A completed attempt is the single atomic point at which a quota slot is consumed.
-- If the quota is exhausted or the visitor is blocked, SQLite aborts the insert and
-- rolls back the statement, so a failed request cannot leave a partial increment.
CREATE TRIGGER IF NOT EXISTS trg_attempts_consume_quota
BEFORE INSERT ON personality_test_attempts
WHEN NEW.status = 'completed'
  AND NOT EXISTS (
    SELECT 1 FROM personality_test_attempts
    WHERE visitor_id = NEW.visitor_id AND idempotency_key = NEW.idempotency_key
  )
BEGIN
  SELECT CASE
    WHEN (SELECT status FROM anonymous_visitors WHERE id = NEW.visitor_id) IS NULL
      THEN RAISE(ABORT, 'INVALID_ANONYMOUS_SESSION')
    WHEN (SELECT status FROM anonymous_visitors WHERE id = NEW.visitor_id) <> 'active'
      THEN RAISE(ABORT, 'TEST_QUOTA_EXHAUSTED')
    WHEN (SELECT tests_used >= test_limit FROM anonymous_visitors WHERE id = NEW.visitor_id)
      THEN RAISE(ABORT, 'TEST_QUOTA_EXHAUSTED')
  END;

  UPDATE anonymous_visitors
  SET tests_used = tests_used + 1,
      updated_at = CURRENT_TIMESTAMP,
      status = CASE WHEN tests_used + 1 >= test_limit THEN 'blocked' ELSE status END
  WHERE id = NEW.visitor_id;
END;
