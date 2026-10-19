import { CONTENT_VERSION, isPublicResult, matchPercentFor, questions, rankCharacters, scoreAnswers, scoreBand, toPublicResult, type Answer, type PublicResult, type QuizResult } from './quiz.ts';

export const DRAFT_KEY = 'history-quiz:v03:grouped-v1:draft';
export const RESULT_KEY = 'history-quiz:v03:last-result';
export const DRAFT_TTL = 7 * 24 * 60 * 60 * 1000;
export type Draft = { version: string; answers: (Answer | null)[]; index: number; updatedAt: number; completed: boolean };
export const freshDraft = (): Draft => ({ version: CONTENT_VERSION, answers: questions.map(() => null), index: 0, updatedAt: Date.now(), completed: false });

export function isDraft(value: unknown): value is Draft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Draft;
  return draft.version === CONTENT_VERSION && Array.isArray(draft.answers) && draft.answers.length === 24
    && draft.answers.every(answer => answer === null || ['A', 'B', 'C', 'D'].includes(answer))
    && Number.isInteger(draft.index) && draft.index >= 0 && draft.index < 24
    && Number.isFinite(draft.updatedAt) && draft.updatedAt <= Date.now() && Date.now() - draft.updatedAt <= DRAFT_TTL
    && typeof draft.completed === 'boolean' && (!draft.completed || draft.answers.every(answer => answer !== null));
}

export function loadSession(): { draft: Draft; result: QuizResult | null; notice: string; storageAvailable: boolean } {
  const empty = { draft: freshDraft(), result: null, notice: '', storageAvailable: true };
  try {
    const rawDraft = localStorage.getItem(DRAFT_KEY);
    const rawResult = localStorage.getItem(RESULT_KEY);
    let draft = empty.draft;
    let notice = '';
    if (rawDraft) {
      const stored: unknown = JSON.parse(rawDraft);
      if (isDraft(stored)) draft = stored;
      else notice = '之前的答题进度已过期或版本已更新，请重新开始。';
    }
    let result: QuizResult | null = null;
    if (rawResult) {
      const stored: unknown = JSON.parse(rawResult);
      if (isPublicResult(stored) && typeof stored === 'object' && 'vector' in stored) {
        const candidate = stored as QuizResult;
        if (Array.isArray(candidate.vector) && candidate.vector.length === 6
          && candidate.vector.every((v, i) => Number.isInteger(v) && v >= 0 && v <= 12 && scoreBand(v) === candidate.bands[i])
          && rankCharacters(candidate.vector)[0].person.id === candidate.personId) {
          const ranked = rankCharacters(candidate.vector);
          if (candidate.tied === (ranked[0].distance === ranked[1].distance)) result = { ...candidate, matchPercent: matchPercentFor(candidate.vector, ranked[0].person.profile) };
        }
      }
    }
    if (draft.completed && (!result || scoreAnswers(draft.answers).some((value, index) => value !== result.vector[index]))) draft = { ...draft, completed: false };
    return { draft, result, notice, storageAvailable: true };
  } catch {
    return { ...empty, notice: '无法恢复本地进度，你仍可开始测试。', storageAvailable: false };
  }
}

export function makeShareUrl(result: PublicResult, base = window.location.href): string {
  const url = new URL(base);
  url.search = '';
  const summary = toPublicResult(result);
  const payload = [summary.version, summary.id, summary.personId, summary.bands.map(band => ['low', 'balanced', 'high'].indexOf(band)).join(''), summary.createdAt, summary.tied ? 1 : 0, ...(summary.matchPercent === undefined ? [] : [summary.matchPercent])];
  const encoded = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  url.hash = `share=${encoded}`;
  return url.href;
}

export function readSharedResult(hash: string): { present: boolean; result: PublicResult | null } {
  if (!hash.startsWith('#share=')) return { present: hash.length > 1, result: null };
  const encoded = hash.slice(7);
  if (encoded.length > 1600 || !/^[A-Za-z0-9_-]+$/.test(encoded)) return { present: true, result: null };
  try {
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const decoded: unknown = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')));
    if (!Array.isArray(decoded) || ![6, 7].includes(decoded.length) || typeof decoded[3] !== 'string' || !/^[012]{6}$/.test(decoded[3]) || ![0, 1].includes(decoded[5])) return { present: true, result: null };
    const candidate = { version: decoded[0], id: decoded[1], personId: decoded[2], bands: [...decoded[3]].map(value => ['low', 'balanced', 'high'][Number(value)]), createdAt: decoded[4], tied: decoded[5] === 1, ...(decoded.length === 7 ? { matchPercent: decoded[6] } : {}) };
    return { present: true, result: isPublicResult(candidate) ? toPublicResult(candidate) : null };
  } catch { return { present: true, result: null }; }
}

export function clearShareHash() {
  history.replaceState(null, '', window.location.pathname + window.location.search);
}
