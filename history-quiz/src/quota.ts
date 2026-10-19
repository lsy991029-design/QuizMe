import { calculateResult, type Answer, type QuizResult } from './quiz';

export type QuotaSnapshot = {
  limit: number;
  used: number;
  remaining: number;
  canTest: boolean;
};

export class QuotaApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'QuotaApiError';
    this.code = code;
    this.status = status;
  }
}

type ApiErrorBody = { error?: { code?: string; message?: string } };
const DEV_QUOTA_KEY = 'history-quiz:dev-anonymous-quota:v2';
const DEV_ATTEMPTS_KEY = 'history-quiz:dev-anonymous-attempts:v1';

function devQuota(): QuotaSnapshot {
  try {
    const stored = JSON.parse(localStorage.getItem(DEV_QUOTA_KEY) || '{"limit":10,"used":0}');
    const limit = 10;
    const used = Math.max(0, Math.min(limit, Number(stored.used) || 0));
    return { limit, used, remaining: limit - used, canTest: used < limit };
  } catch {
    return { limit: 10, used: 0, remaining: 10, canTest: true };
  }
}

function setDevQuota(quota: QuotaSnapshot) {
  try { localStorage.setItem(DEV_QUOTA_KEY, JSON.stringify({ limit: quota.limit, used: quota.used })); } catch { /* local preview only */ }
}

function devAttempts(): Record<string, QuizResult> {
  try { return JSON.parse(localStorage.getItem(DEV_ATTEMPTS_KEY) || '{}') as Record<string, QuizResult>; } catch { return {}; }
}

function localDevEnabled() {
  return import.meta.env.DEV;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { ...init, credentials: 'include', headers: { ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers } });
  } catch {
    throw new QuotaApiError('NETWORK_ERROR', '暂时无法连接测试次数服务，请重试。', 0);
  }
  let body: T | ApiErrorBody | null = null;
  try { body = await response.json() as T | ApiErrorBody; } catch { body = null; }
  if (!response.ok) {
    const error = body && typeof body === 'object' && 'error' in body ? body.error : null;
    throw new QuotaApiError(error?.code || 'REQUEST_FAILED', error?.message || '测试服务暂时无法响应，请重试。', response.status);
  }
  return body as T;
}

export function createAnonymousSession(): Promise<QuotaSnapshot> {
  if (localDevEnabled()) return Promise.resolve(devQuota());
  return request<QuotaSnapshot>('/api/anonymous/session', { method: 'POST' });
}

export function getQuota(): Promise<QuotaSnapshot> {
  if (localDevEnabled()) return Promise.resolve(devQuota());
  return request<QuotaSnapshot>('/api/tests/quota');
}

export type SubmitTestResponse = {
  duplicate: boolean;
  result: QuizResult;
  quota: QuotaSnapshot;
};

export function submitTest(input: { idempotencyKey: string; answers: Answer[] }): Promise<SubmitTestResponse> {
  if (localDevEnabled()) {
    const existing = devAttempts()[input.idempotencyKey];
    if (existing) return Promise.resolve({ duplicate: true, result: existing, quota: devQuota() });
    const quota = devQuota();
    if (!quota.canTest) return Promise.reject(new QuotaApiError('TEST_QUOTA_EXHAUSTED', '本匿名身份的测试次数已用完。', 409));
    const result = calculateResult(input.answers);
    const next = { ...quota, used: quota.used + 1, remaining: quota.remaining - 1, canTest: quota.used + 1 < quota.limit };
    setDevQuota(next);
    try { localStorage.setItem(DEV_ATTEMPTS_KEY, JSON.stringify({ ...devAttempts(), [input.idempotencyKey]: result })); } catch { /* local preview only */ }
    return Promise.resolve({ duplicate: false, result, quota: next });
  }
  return request<SubmitTestResponse>('/api/tests/submit', {
    method: 'POST',
    body: JSON.stringify({ ...input, testType: 'history-personality' }),
  });
}
