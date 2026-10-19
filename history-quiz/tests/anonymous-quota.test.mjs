import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { characters, questions, calculateResult } from '../worker/quiz.js';
import { handleApiRequest } from '../worker/api.js';

class MemoryD1 {
  visitors = new Map();
  attempts = new Map();
  limits = new Map();
  prepare(sql) { return new MemoryStatement(this, sql); }
}

class MemoryStatement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.args = []; }
  bind(...args) { this.args = args; return this; }
  async first() {
    if (this.sql.includes('WHERE token_hash')) return [...this.db.visitors.values()].find((row) => row.token_hash === this.args[0]) || null;
    if (this.sql.includes('FROM anonymous_visitors WHERE id')) return this.db.visitors.get(this.args[0]) || null;
    if (this.sql.includes('FROM anonymous_request_limits')) return this.db.limits.get(this.args[0]) || null;
    if (this.sql.includes('FROM personality_test_attempts WHERE visitor_id')) return [...this.db.attempts.values()].find((row) => row.visitor_id === this.args[0] && row.idempotency_key === this.args[1]) || null;
    if (this.sql.includes('FROM personality_test_attempts WHERE id')) return this.db.attempts.get(this.args[0])?.visitor_id === this.args[1] ? this.db.attempts.get(this.args[0]) : null;
    return null;
  }
  async all() {
    if (this.sql.includes('FROM personality_test_attempts')) return { results: [...this.db.attempts.values()].filter((row) => row.visitor_id === this.args[0]) };
    return { results: [] };
  }
  async run() {
    if (this.sql.includes('INSERT INTO anonymous_visitors')) {
      const [id, tokenHash, now] = this.args;
      this.db.visitors.set(id, { id, token_hash: tokenHash, test_limit: 10, tests_used: 0, status: 'active', created_at: now, updated_at: now });
      return { success: true };
    }
    if (this.sql.includes('INSERT INTO anonymous_request_limits')) {
      const [visitorId, window] = this.args;
      const previous = this.db.limits.get(visitorId);
      this.db.limits.set(visitorId, { visitor_id: visitorId, window_started_at: window, request_count: previous?.window_started_at === window ? previous.request_count + 1 : 1 });
      return { success: true };
    }
    if (this.sql.includes('INSERT INTO personality_test_attempts')) {
      const [id, visitorId, idempotencyKey, testType, resultData, now] = this.args;
      if (this.db.attempts.has(id)) throw new Error('UNIQUE constraint failed');
      if ([...this.db.attempts.values()].some((row) => row.visitor_id === visitorId && row.idempotency_key === idempotencyKey)) throw new Error('UNIQUE constraint failed');
      this.db.attempts.set(id, { id, visitor_id: visitorId, idempotency_key: idempotencyKey, test_type: testType, status: 'completed', result_data: resultData, created_at: now, completed_at: now });
      return { success: true };
    }
    return { success: true };
  }
}

async function readJson(response) { return response.json(); }

async function createSession(db) {
  const response = await handleApiRequest(new Request('https://quiz.example/api/anonymous/session', { method: 'POST' }), { DB: db });
  const cookie = response.headers.get('set-cookie').split(';')[0];
  return { cookie, body: await readJson(response) };
}

test('server scoring uses the current 24-question and 100-person content', () => {
  assert.equal(questions.length, 24);
  assert.equal(characters.length, 100);
  const result = calculateResult(Array(24).fill('A'));
  assert.equal(result.vector.length, 6);
  assert.ok(result.personId.startsWith('H'));
});

test('D1 migration removes the lifetime quota trigger while preserving identity records', () => {
  execFileSync('python3', ['tests/d1_migration_test.py'], { stdio: 'inherit' });
});

test('API keeps anonymous ownership and idempotency without a lifetime quota', async () => {
  const db = new MemoryD1();
  const first = await createSession(db);
  assert.equal(first.body.remaining, null);
  const answers = Array(24).fill('A');
  // Eleven successful submissions prove the old ten-test lifetime gate is gone
  // while staying within the independent request-rate protection window.
  const keys = Array.from({ length: 11 }, () => crypto.randomUUID());
  for (const [index, key] of keys.entries()) {
    const response = await handleApiRequest(new Request('https://quiz.example/api/tests/submit', {
      method: 'POST', headers: { cookie: first.cookie, 'content-type': 'application/json' }, body: JSON.stringify({ testType: 'history-personality', idempotencyKey: key, answers }),
    }), { DB: db });
    const body = await readJson(response);
    assert.equal(response.status, 200);
    assert.equal(body.quota.canTest, true);
  }
  const duplicate = await handleApiRequest(new Request('https://quiz.example/api/tests/submit', {
    method: 'POST', headers: { cookie: first.cookie, 'content-type': 'application/json' }, body: JSON.stringify({ testType: 'history-personality', idempotencyKey: keys[0], answers }),
  }), { DB: db });
  assert.equal(duplicate.status, 200);
  assert.equal((await readJson(duplicate)).duplicate, true);

  const other = await createSession(db);
  const independent = await handleApiRequest(new Request('https://quiz.example/api/tests/submit', {
    method: 'POST', headers: { cookie: other.cookie, 'content-type': 'application/json' }, body: JSON.stringify({ testType: 'history-personality', idempotencyKey: crypto.randomUUID(), answers }),
  }), { DB: db });
  assert.equal(independent.status, 200);
  const invalidCookie = await handleApiRequest(new Request('https://quiz.example/api/tests/quota', { headers: { cookie: 'history_quiz_visitor=forged' } }), { DB: db });
  assert.equal(invalidCookie.status, 401);
});
