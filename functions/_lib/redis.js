/**
 * ══════════════════════════════════════════════════════════════════
 *  functions/_lib/redis.js — client Upstash Redis (REST) dùng chung
 *
 *  Trước đây mỗi Function tự viết lại hàm redis() (verify, verify-full,
 *  session, analytics…). Gom về một chỗ, thêm:
 *    • timeout ngắn (mặc định 1.5s) — Redis chậm không được kéo theo cả API
 *    • pipeline (/pipeline) — nhiều lệnh, MỘT round-trip
 *    • bản "an toàn" (…Safe): không bao giờ throw
 *
 *  Quy ước giá trị trả về của redisCmdSafe / redisPipelineSafe:
 *    undefined  → Redis KHÔNG dùng được (chưa cấu hình, lỗi mạng, timeout…)
 *    null       → Redis dùng được nhưng khóa không tồn tại (nil)
 *    còn lại    → kết quả thật
 *  Nhờ vậy caller phân biệt được "cache miss" và "Redis đang sập" để fail-open.
 *
 *  Env: UPSTASH_URL (https://xxx.upstash.io), UPSTASH_TOKEN
 *  Lưu ý: thư mục _lib không export onRequest* nên không thành route.
 * ══════════════════════════════════════════════════════════════════
 */

const DEFAULT_TIMEOUT_MS = 1500;
const enc = new TextEncoder();

export function hasRedis(env) {
  return !!(env && env.UPSTASH_URL && env.UPSTASH_TOKEN);
}

async function post(env, path, body, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(String(env.UPSTASH_URL).replace(/\/+$/, '') + path, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.UPSTASH_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error('Upstash HTTP ' + res.status + (data && data.error ? ': ' + data.error : ''));
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/** Chạy 1 lệnh. Trả null nếu chưa cấu hình; THROW nếu lỗi. */
export async function redisCmd(env, cmd, timeoutMs) {
  if (!hasRedis(env)) return null;
  const d = await post(env, '', cmd, timeoutMs);
  if (d && d.error) throw new Error(d.error);
  return d ? d.result : null;
}

/** Chạy nhiều lệnh trong 1 request. Trả mảng kết quả theo thứ tự; THROW nếu lỗi. */
export async function redisPipeline(env, cmds, timeoutMs) {
  if (!hasRedis(env)) return null;
  const d = await post(env, '/pipeline', cmds, timeoutMs);
  if (!Array.isArray(d)) throw new Error('Upstash pipeline: phản hồi không hợp lệ');
  return d.map((x) => {
    if (x && x.error) throw new Error(x.error);
    return x ? x.result : null;
  });
}

/** Như redisCmd nhưng không throw: undefined = Redis không dùng được. */
export async function redisCmdSafe(env, cmd, timeoutMs) {
  if (!hasRedis(env)) return undefined;
  try { return await redisCmd(env, cmd, timeoutMs); }
  catch (e) { console.warn('[redis]', cmd && cmd[0], 'lỗi:', e?.message ?? e); return undefined; }
}

/** Như redisPipeline nhưng không throw: undefined = Redis không dùng được. */
export async function redisPipelineSafe(env, cmds, timeoutMs) {
  if (!hasRedis(env)) return undefined;
  try { return await redisPipeline(env, cmds, timeoutMs); }
  catch (e) { console.warn('[redis] pipeline lỗi:', e?.message ?? e); return undefined; }
}

/**
 * Bộ đếm cửa sổ cố định: INCR + EXPIRE NX trong MỘT request.
 * Trả số đếm hiện tại (số nguyên) hoặc undefined nếu Redis không dùng được.
 */
export async function rateCount(env, key, windowSec) {
  const r = await redisPipelineSafe(env, [['INCR', key], ['EXPIRE', key, windowSec, 'NX']]);
  if (!r) return undefined;
  const n = Number(r[0]);
  return Number.isFinite(n) ? n : undefined;
}

/** SHA-256 → base64url, cắt còn `len` ký tự (dùng làm khóa, không lộ dữ liệu gốc). */
export async function shaKey(text, len = 24) {
  const buf = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(String(text))));
  let s = '';
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').slice(0, len);
}

/**
 * Việc nền (ghi cache, tăng bộ đếm…) KHÔNG làm chậm phản hồi:
 *  • có ctx.waitUntil (Cloudflare Pages) → chạy nền, trả undefined ngay
 *  • không có (test/dev) → trả promise để caller `await`
 * Dùng:  await defer(ctx, redisCmdSafe(env, [...]));
 */
export function defer(ctx, promise) {
  const safe = Promise.resolve(promise).catch(() => {});
  if (ctx && typeof ctx.waitUntil === 'function') { ctx.waitUntil(safe); return undefined; }
  return safe;
}
