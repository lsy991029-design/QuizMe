import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { characters, dimensions, questions, calculateResult, rankCharacters, scoreAnswers, sharedAxes, matchPercentFor, toPublicResult } from '../src/quiz.ts';
import { buildReport } from '../src/report.ts';
import { DRAFT_KEY, RESULT_KEY, DRAFT_TTL, freshDraft, isDraft, loadSession, makeShareUrl, readSharedResult } from '../src/session.ts';

const fixture = name => JSON.parse(readFileSync(new URL(`../../outputs/history-quiz-v0.3/data/${name}.json`, import.meta.url)));
const originalQuestions = fixture('questions').questions;
const reorderAnswers = answers => questions.map(question => answers[originalQuestions.findIndex(original => original.id === question.id)]);
const witnesses = fixture('reachability-witnesses').witnesses.map(witness => ({ ...witness, answers: reorderAnswers(witness.answers) }));
const audit = fixture('audit-report');


test('questions form six consecutive groups without dropping or duplicating a question', () => {
  assert.deepEqual(dimensions.map(axis => axis.id), ['decision', 'social', 'change', 'expression', 'focus', 'organization']);
  assert.equal(new Set(questions.map(question => question.id)).size, 24);
  assert.deepEqual(new Set(questions.map(question => question.id)), new Set(originalQuestions.map(question => question.id)));
  dimensions.forEach((axis, index) => assert.deepEqual(questions.slice(index * 4, index * 4 + 4).map(question => question.dimension), Array(4).fill(axis.id)));
});

test('all 100 audited answer sets match the reference vectors and people', () => {
  assert.equal(characters.length, 100);
  assert.equal(questions.length, 24);
  assert.equal(witnesses.length, 100);
  for (const witness of witnesses) {
    const result = calculateResult(witness.answers);
    assert.deepEqual(result.vector, witness.vector, witness.name);
    assert.equal(result.personId, witness.personId, witness.name);
  }
});

test('equal distances use stable person ID ordering', () => {
  const reference = audit.tieExample;
  const result = calculateResult(reorderAnswers(reference.answers));
  assert.deepEqual(result.vector, reference.vector);
  assert.equal(result.personId, reference.selectedId);
  assert.equal(result.tied, true);
  const ranked = rankCharacters(result.vector);
  assert.deepEqual(ranked.filter(item => item.distance === ranked[0].distance).map(item => item.person.id), reference.tiedIds);
});

test('same-letter patterns are balanced and do not claim a shared directional trait', () => {
  for (const letter of ['A', 'B', 'C', 'D']) {
    const result = calculateResult(Array(24).fill(letter));
    assert.deepEqual(result.vector, [6, 6, 6, 6, 6, 6]);
    assert.deepEqual(result.bands, Array(6).fill('balanced'));
    assert.deepEqual(sharedAxes(result), []);
    assert.equal(result.personId, 'H046');
  }
});

test('missing, sparse and malformed answers and vectors are rejected', () => {
  for (const answers of [null, [], Array(24), Array(23).fill('A'), Array(25).fill('A'), Array(24).fill(null), Array(24).fill(0), Array(24).fill('E')]) assert.throws(() => scoreAnswers(answers));
  for (const vector of [[], [1, 2, 3, 4, 5, NaN], [1, 2, 3, 4, 5, 13], [1, 2, 3, 4, 5, -1], [1, 2, 3, 4, 5, 1.5]]) assert.throws(() => rankCharacters(vector));
});

test('public links round trip and exclude raw answers and scores', () => {
  const result = calculateResult(witnesses[0].answers);
  const url = new URL(makeShareUrl(result, 'https://example.com/quiz?tracking=1#old'));
  assert.equal(url.search, '');
  assert.deepEqual(readSharedResult(url.hash), { present: true, result: toPublicResult(result) });
  const payload = JSON.parse(atob(url.hash.slice(7).replace(/-/g, '+').replace(/_/g, '/')));
  assert.equal(payload.length, 7);
  assert.equal(payload[6], result.matchPercent);
  const legacyPayload = payload.slice(0, 6);
  const legacy = readSharedResult('#share=' + btoa(JSON.stringify(legacyPayload)).replace(/=+$/, ''));
  assert.equal(legacy.result.personId, result.personId);
  assert.equal(legacy.result.matchPercent, undefined);
  for (const invalid of [-1, 101, 99.5, '90', null]) {
    assert.equal(readSharedResult('#share=' + btoa(JSON.stringify([...legacyPayload, invalid])).replace(/=+$/, '')).result, null);
  }
  assert.equal(JSON.stringify(payload).includes('answers'), false);
  assert.equal(JSON.stringify(payload).includes('vector'), false);
  for (const hash of ['#share=', '#share=bad!', '#unknown', '#share=' + 'a'.repeat(1601), '#share=' + btoa(JSON.stringify(['unknown', result.id, result.personId, '111111', result.createdAt, 0]))]) assert.deepEqual(readSharedResult(hash), { present: true, result: null });
  assert.deepEqual(readSharedResult(''), { present: false, result: null });
});

test('draft recovery handles expiry, unavailable storage and inconsistent completed results', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const store = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => store.get(key) ?? null } });
  try {
    const draft = freshDraft();
    store.set('history-quiz:v03:draft', JSON.stringify({ ...draft, answers: Array(24).fill('A'), index: 12 }));
    assert.equal(loadSession().draft.index, 0);
    assert.deepEqual(loadSession().draft.answers, Array(24).fill(null));
    assert.equal(isDraft(draft), true);
    assert.equal(isDraft({ ...draft, updatedAt: Date.now() - DRAFT_TTL - 1 }), false);
    store.set(DRAFT_KEY, JSON.stringify({ ...draft, answers: witnesses[0].answers, completed: true }));
    store.set(RESULT_KEY, JSON.stringify(calculateResult(witnesses[0].answers)));
    assert.equal(loadSession().draft.completed, true);
    store.set(RESULT_KEY, JSON.stringify(calculateResult(witnesses[1].answers)));
    assert.equal(loadSession().draft.completed, false);
    store.set(DRAFT_KEY, JSON.stringify({ ...draft, updatedAt: Date.now() - DRAFT_TTL - 1 }));
    assert.match(loadSession().notice, /过期/);
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('blocked'); } });
    assert.equal(loadSession().storageAvailable, false);
    assert.equal(loadSession().result, null);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});


test('report content covers every character and preserves shared summary without inventing raw scores', () => {
  assert.equal(matchPercentFor(Array(6).fill(0), Array(6).fill(0)), 100);
  assert.equal(matchPercentFor(Array(6).fill(0), Array(6).fill(12)), 0);
  for (const witness of witnesses) {
    const result = calculateResult(witness.answers);
    const report = buildReport(result);
    const shared = buildReport(toPublicResult(result));
    assert.equal(report.person.id, witness.personId);
    assert.equal(report.bars.length, 6);
    assert.equal(report.common.length, 3);
    assert.equal(new Set(report.messages).size, 3);
    assert.ok(report.match >= 0 && report.match <= 100);
    assert.equal(report.match, shared.match);
    assert.deepEqual(report.messages, shared.messages);
    assert.ok(shared.bars.every(bar => bar.value === null));
  }
  assert.ok(buildReport(calculateResult(Array(24).fill('A'))).common.every(item => !item.shared && item.band === 'balanced'));
});
