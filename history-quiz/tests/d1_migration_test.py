#!/usr/bin/env python3
import concurrent.futures
import sqlite3
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MIGRATION = (ROOT / "migrations" / "0001_anonymous_quota.sql").read_text()
MIGRATION_2 = (ROOT / "migrations" / "0002_increase_anonymous_quota_to_10.sql").read_text()


def connection(path, apply_upgrade=True):
    db = sqlite3.connect(path, timeout=10, isolation_level=None)
    db.execute("PRAGMA foreign_keys = ON")
    db.executescript(MIGRATION)
    if apply_upgrade:
        db.executescript(MIGRATION_2)
    return db


def insert_attempt(path, visitor_id, key):
    db = connection(path)
    try:
        db.execute("BEGIN IMMEDIATE")
        db.execute(
            "INSERT INTO personality_test_attempts "
            "(id, visitor_id, idempotency_key, test_type, status, result_data, created_at, completed_at) "
            "VALUES (?, ?, ?, 'history-personality', 'completed', '{}', datetime('now'), datetime('now'))",
            (key, visitor_id, key),
        )
        db.commit()
        return True
    except sqlite3.DatabaseError:
        db.rollback()
        return False
    finally:
        db.close()


with tempfile.TemporaryDirectory() as directory:
    db_path = str(Path(directory) / "quota.sqlite")
    db = connection(db_path, apply_upgrade=False)
    db.execute(
        "INSERT INTO anonymous_visitors (id, token_hash, test_limit, created_at, updated_at) VALUES (?, ?, 3, datetime('now'), datetime('now'))",
        ("visitor-a", "hash-a"),
    )
    db.execute(
        "INSERT INTO anonymous_visitors (id, token_hash, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))",
        ("visitor-b", "hash-b"),
    )
    db.close()

    db = connection(db_path)
    assert db.execute("SELECT test_limit FROM anonymous_visitors WHERE id = 'visitor-a'").fetchone()[0] == 10
    db.execute(
        "INSERT INTO personality_test_attempts (id, visitor_id, idempotency_key, test_type, status, result_data, created_at) "
        "VALUES ('failed-1', 'visitor-a', 'failed-key', 'history-personality', 'failed', NULL, datetime('now'))"
    )
    assert db.execute("SELECT tests_used FROM anonymous_visitors WHERE id = 'visitor-a'").fetchone()[0] == 0
    db.close()

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
        outcomes = list(pool.map(lambda i: insert_attempt(db_path, "visitor-a", f"key-{i}"), range(20)))
    assert sum(outcomes) == 10, outcomes

    db = connection(db_path)
    assert db.execute("SELECT tests_used FROM anonymous_visitors WHERE id = 'visitor-a'").fetchone()[0] == 10
    assert db.execute("SELECT COUNT(*) FROM personality_test_attempts WHERE visitor_id = 'visitor-a' AND status = 'completed'").fetchone()[0] == 10
    assert db.execute("SELECT tests_used FROM anonymous_visitors WHERE id = 'visitor-b'").fetchone()[0] == 0
    duplicate_key = db.execute("SELECT idempotency_key FROM personality_test_attempts WHERE visitor_id = 'visitor-a' LIMIT 1").fetchone()[0]
    try:
        db.execute(
            "INSERT INTO personality_test_attempts (id, visitor_id, idempotency_key, test_type, status, result_data, created_at) "
            "VALUES ('duplicate', 'visitor-a', ?, 'history-personality', 'completed', '{}', datetime('now'))",
            (duplicate_key,),
        )
    except sqlite3.DatabaseError as error:
        assert "UNIQUE" in str(error).upper()
    else:
        raise AssertionError("duplicate idempotency key unexpectedly inserted")
    try:
        db.execute(
            "INSERT INTO personality_test_attempts (id, visitor_id, idempotency_key, test_type, status, result_data, created_at) "
            "VALUES ('fourth', 'visitor-a', 'fourth-key', 'history-personality', 'completed', '{}', datetime('now'))"
        )
    except sqlite3.DatabaseError as error:
        assert "TEST_QUOTA_EXHAUSTED" in str(error)
    else:
        raise AssertionError("fourth completed attempt unexpectedly succeeded")
    db.close()

print("D1 quota migration and SQLite concurrency checks passed")
