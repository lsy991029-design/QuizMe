import { calculateResult } from "./quiz.js";

const COOKIE_NAME = "history_quiz_visitor";
const COOKIE_MAX_AGE = 10 * 365 * 24 * 60 * 60;
const TEST_TYPE = "history-personality";
const MAX_BODY_BYTES = 64 * 1024;
const SUBMIT_REQUESTS_PER_MINUTE = 12;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

function error(code, status, message = code) {
  return json({ error: { code, message } }, status);
}

function parseCookies(header) {
  return Object.fromEntries((header || "").split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf("=");
    return index < 0 ? [part, ""] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
  }));
}

function encodeBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function createToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
}

async function hashToken(token) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function cookieHeader(token, requestUrl) {
  const secure = requestUrl.protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Max-Age=${COOKIE_MAX_AGE}; Path=/; HttpOnly; SameSite=Lax${secure}`;
}

function quotaFromRow(row) {
  const used = Number(row?.tests_used ?? 0);
  // Kept as a backwards-compatible response shape for existing clients. The
  // server no longer blocks submissions based on a lifetime test count.
  return { limit: null, used, remaining: null, canTest: true };
}

async function visitorFromCookie(request, db) {
  const token = parseCookies(request.headers.get("Cookie"))[COOKIE_NAME];
  if (!token) return null;
  const tokenHash = await hashToken(token);
  const row = await db.prepare("SELECT id, test_limit, tests_used, status FROM anonymous_visitors WHERE token_hash = ?1").bind(tokenHash).first();
  return row ? { ...row, token } : null;
}

async function createVisitor(db) {
  const token = createToken();
  const tokenHash = await hashToken(token);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO anonymous_visitors (id, token_hash, test_limit, tests_used, status, created_at, updated_at)
    VALUES (?1, ?2, 10, 0, 'active', ?3, ?3)`).bind(id, tokenHash, now).run();
  return { id, token, test_limit: 10, tests_used: 0, status: "active" };
}

async function session(request, db) {
  const existing = await visitorFromCookie(request, db);
  if (existing) return json(quotaFromRow(existing));
  const visitor = await createVisitor(db);
  return json(quotaFromRow(visitor), 200, { "set-cookie": cookieHeader(visitor.token, new URL(request.url)) });
}

async function requireVisitor(request, db) {
  const visitor = await visitorFromCookie(request, db);
  return visitor || null;
}

async function readBody(request) {
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_BODY_BYTES) throw new Error("INVALID_TEST_PAYLOAD");
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) throw new Error("INVALID_TEST_PAYLOAD");
  try { return JSON.parse(raw); } catch { throw new Error("INVALID_TEST_PAYLOAD"); }
}

function validIdempotencyKey(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validAnswers(value) {
  return Array.isArray(value) && value.length === 24 && value.every((answer) => ["A", "B", "C", "D"].includes(answer));
}

async function enforceSubmitRateLimit(db, visitorId) {
  const windowStartedAt = Math.floor(Date.now() / 60_000);
  await db.prepare(`INSERT INTO anonymous_request_limits (visitor_id, window_started_at, request_count)
    VALUES (?1, ?2, 1)
    ON CONFLICT(visitor_id) DO UPDATE SET
      request_count = CASE WHEN window_started_at = excluded.window_started_at THEN request_count + 1 ELSE 1 END,
      window_started_at = excluded.window_started_at`).bind(visitorId, windowStartedAt).run();
  const row = await db.prepare("SELECT request_count FROM anonymous_request_limits WHERE visitor_id = ?1").bind(visitorId).first();
  return Number(row?.request_count || 0) <= SUBMIT_REQUESTS_PER_MINUTE;
}

async function currentQuota(db, visitorId) {
  const row = await db.prepare("SELECT test_limit, tests_used, status FROM anonymous_visitors WHERE id = ?1").bind(visitorId).first();
  return quotaFromRow(row);
}

async function findAttempt(db, visitorId, idempotencyKey) {
  const row = await db.prepare("SELECT id, status, result_data FROM personality_test_attempts WHERE visitor_id = ?1 AND idempotency_key = ?2").bind(visitorId, idempotencyKey).first();
  if (!row) return null;
  let result = null;
  try { result = row.result_data ? JSON.parse(row.result_data) : null; } catch { result = null; }
  return { id: row.id, status: row.status, result };
}

async function submit(request, db) {
  const visitor = await requireVisitor(request, db);
  if (!visitor) return error("INVALID_ANONYMOUS_SESSION", 401, "匿名会话无效，请重新获取会话。");
  if (!(await enforceSubmitRateLimit(db, visitor.id))) return error("RATE_LIMITED", 429, "请求过于频繁，请稍后再试。");

  let body;
  try { body = await readBody(request); } catch { return error("INVALID_TEST_PAYLOAD", 400, "测试数据格式无效。"); }
  if (body?.testType !== TEST_TYPE || !validIdempotencyKey(body?.idempotencyKey) || !validAnswers(body?.answers)) {
    return error("INVALID_TEST_PAYLOAD", 400, "测试数据格式无效。");
  }

  const existing = await findAttempt(db, visitor.id, body.idempotencyKey);
  if (existing?.result) return json({ duplicate: true, result: existing.result, quota: await currentQuota(db, visitor.id) });
  if (existing) return error("DUPLICATE_REQUEST", 409, "该请求正在处理中，请稍后重试。");

  let result;
  try { result = calculateResult(body.answers); } catch { return error("INVALID_TEST_PAYLOAD", 400, "测试答案无效。"); }
  const attemptId = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await db.prepare(`INSERT INTO personality_test_attempts
      (id, visitor_id, idempotency_key, test_type, status, result_data, created_at, completed_at)
      VALUES (?1, ?2, ?3, ?4, 'completed', ?5, ?6, ?6)`)
      .bind(attemptId, visitor.id, body.idempotencyKey, TEST_TYPE, JSON.stringify(result), now).run();
  } catch (reason) {
    const duplicate = await findAttempt(db, visitor.id, body.idempotencyKey);
    if (duplicate?.result) return json({ duplicate: true, result: duplicate.result, quota: await currentQuota(db, visitor.id) });
    if (duplicate) return error("DUPLICATE_REQUEST", 409, "该请求正在处理中，请稍后重试。");
    return error("TEST_PROCESSING_FAILED", 500, "测试暂时无法完成，请稍后重试。");
  }
  return json({ duplicate: false, result, quota: await currentQuota(db, visitor.id) });
}

async function listTests(request, db) {
  const visitor = await requireVisitor(request, db);
  if (!visitor) return error("INVALID_ANONYMOUS_SESSION", 401, "匿名会话无效，请重新获取会话。");
  const rows = await db.prepare(`SELECT id, test_type, status, result_data, created_at, completed_at
    FROM personality_test_attempts WHERE visitor_id = ?1 ORDER BY created_at DESC`).bind(visitor.id).all();
  const tests = (rows.results || []).map((row) => ({
    id: row.id,
    testType: row.test_type,
    status: row.status,
    result: row.result_data ? JSON.parse(row.result_data) : null,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  }));
  return json({ tests, quota: quotaFromRow(visitor) });
}

async function getTest(request, db, id) {
  const visitor = await requireVisitor(request, db);
  if (!visitor) return error("INVALID_ANONYMOUS_SESSION", 401, "匿名会话无效，请重新获取会话。");
  const row = await db.prepare(`SELECT id, test_type, status, result_data, created_at, completed_at
    FROM personality_test_attempts WHERE id = ?1 AND visitor_id = ?2`).bind(id, visitor.id).first();
  if (!row) return error("TEST_NOT_FOUND", 404, "测试结果不存在。");
  return json({ id: row.id, testType: row.test_type, status: row.status, result: row.result_data ? JSON.parse(row.result_data) : null, createdAt: row.created_at, completedAt: row.completed_at });
}

function originAllowed(request) {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function handleApiRequest(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return null;
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": url.origin, "access-control-allow-credentials": "true", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type" } });
  if (!originAllowed(request)) return error("INVALID_ORIGIN", 403, "请求来源无效。");
  if (!env.DB) return error("DATABASE_UNAVAILABLE", 503, "测试次数服务暂不可用，请稍后重试。");

  try {
    if (url.pathname === "/api/anonymous/session" && request.method === "POST") return await session(request, env.DB);
    if (url.pathname === "/api/tests/quota" && request.method === "GET") {
      const visitor = await requireVisitor(request, env.DB);
      return visitor ? json(quotaFromRow(visitor)) : error("INVALID_ANONYMOUS_SESSION", 401, "匿名会话无效，请重新获取会话。");
    }
    if (url.pathname === "/api/tests/submit" && request.method === "POST") return await submit(request, env.DB);
    if (["/api/tests", "/api/tests/"].includes(url.pathname) && request.method === "GET") return await listTests(request, env.DB);
    if (url.pathname.startsWith("/api/tests/") && request.method === "GET") return await getTest(request, env.DB, url.pathname.slice("/api/tests/".length));
    return error("NOT_FOUND", 404, "接口不存在。");
  } catch {
    return error("TEST_PROCESSING_FAILED", 500, "测试服务暂时无法完成请求，请稍后重试。");
  }
}

export { COOKIE_NAME, TEST_TYPE };
