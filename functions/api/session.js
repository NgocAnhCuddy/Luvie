/**
 * ══════════════════════════════════════════════════════════════════
 *  /functions/api/session.js  —  Cấp token phiên cho học sinh
 *
 *  POST /api/session   body: { username, password }
 *     → gọi lại Edge Function `student-login` (giữ nguyên logic đăng nhập cũ)
 *     → nếu đúng: trả { ok:true, student, token, expiresAt }
 *
 *  Token = base64url(payload).base64url(HMAC-SHA256(payload))
 *  payload = { sid, iat, exp }  (exp = 72 giờ kể từ lần cấp)
 *  Client gửi token qua header  Authorization: Bearer <token>  khi gọi /api/score.
 *
 *  Env: SUPA_URL, SUPA_KEY, SESSION_SECRET (chuỗi ngẫu nhiên >= 32 ký tự,
 *       tạo bằng:  openssl rand -hex 32)
 *
 *  Vì sao cần: trước đây /api/score chỉ dựa vào studentId (UUID) nên ai biết
 *  UUID người khác đều xem/xóa được lịch sử của họ. Có token ký thì chỉ chủ
 *  tài khoản (đã đăng nhập bằng mật khẩu) mới thao tác được.
 * ══════════════════════════════════════════════════════════════════
 */

import { hasRedis, redisCmd, redisPipeline } from '../_lib/redis.js';
import { getStudentCached } from '../_lib/student-cache.js';

export const TOKEN_TTL_MS = 72 * 60 * 60 * 1000;

const NO_CACHE = { 'Cache-Control': 'no-store', 'Pragma': 'no-cache' };
const enc = new TextEncoder();

function b64url(bytes) {
  let s = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToBytes(str) {
  const pad = '='.repeat((4 - (str.length % 4)) % 4);
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

/** Tạo token cho học sinh `sid`. */
export async function signToken(sid, secret, now = Date.now()) {
  const payload = b64url(enc.encode(JSON.stringify({ sid: String(sid), iat: now, exp: now + TOKEN_TTL_MS })));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(payload));
  return `${payload}.${b64url(sig)}`;
}

/**
 * Xác minh token. Trả { ok:true, sid } hoặc { ok:false, reason }.
 * Dùng crypto.subtle.verify (so sánh hằng-thời-gian).
 */
export async function verifyToken(token, secret, now = Date.now()) {
  try {
    if (!token || typeof token !== 'string' || !secret) return { ok: false, reason: 'missing' };
    const parts = token.split('.');
    if (parts.length !== 2) return { ok: false, reason: 'format' };
    const [payload, sig] = parts;
    const valid = await crypto.subtle.verify(
      'HMAC', await hmacKey(secret), b64urlToBytes(sig), enc.encode(payload));
    if (!valid) return { ok: false, reason: 'signature' };
    const data = JSON.parse(new TextDecoder().decode(b64urlToBytes(payload)));
    if (!data || !data.sid || !Number.isFinite(data.exp)) return { ok: false, reason: 'payload' };
    if (now > data.exp) return { ok: false, reason: 'expired' };
    return { ok: true, sid: String(data.sid) };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}

// ── Giới hạn thử mật khẩu (chống dò mật khẩu) ─────────────────────
// Đếm số lần đăng nhập SAI theo (tên đăng nhập) và theo (IP) trong cửa sổ trượt,
// lưu ở Upstash để dùng chung giữa các instance Worker (RAM của Worker không bền).
// Nếu chưa cấu hình Upstash → bỏ qua (không chặn nhầm), chỉ ghi cảnh báo.
export const LOGIN_MAX_FAILS_USER = 5;    // 5 lần sai / tên đăng nhập
export const LOGIN_MAX_FAILS_IP = 60;     // 60 lần sai / IP (cả lớp thường chung 1 IP mạng trường)
export const LOGIN_WINDOW_SEC = 15 * 60;  // trong 15 phút

async function hashKey(s) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(String(s).toLowerCase()));
  return b64url(buf).slice(0, 24); // không lưu tên đăng nhập gốc trong khóa Redis
}

/** Trả { blocked, retryAfter } — chỉ ĐỌC bộ đếm, chưa tăng. */
export async function checkLoginLimit(env, username, ip) {
  if (!hasRedis(env)) return { blocked: false, unavailable: true };
  try {
    const ku = `loginfail:u:${await hashKey(username)}`;
    const ki = `loginfail:ip:${await hashKey(ip || 'unknown')}`;
    // 1 round-trip thay vì 2 lệnh GET nối tiếp
    const [ru, ri] = await redisPipeline(env, [['GET', ku], ['GET', ki]]);
    const [u, i] = [Number(ru) || 0, Number(ri) || 0];
    if (u >= LOGIN_MAX_FAILS_USER || i >= LOGIN_MAX_FAILS_IP) {
      const ttl = Number(await redisCmd(env, ['TTL', u >= LOGIN_MAX_FAILS_USER ? ku : ki])) || LOGIN_WINDOW_SEC;
      return { blocked: true, retryAfter: Math.max(1, ttl) };
    }
    return { blocked: false };
  } catch (e) {
    console.warn('[session] limiter lỗi, bỏ qua:', e?.message ?? e);
    return { blocked: false, unavailable: true }; // fail-open: lỗi Redis không được khóa học sinh ngoài cửa
  }
}

export async function recordLoginFail(env, username, ip) {
  if (!hasRedis(env)) return;
  try {
    // INCR + EXPIRE NX cho cả 2 khóa trong MỘT request (trước đây tối đa 4 request nối tiếp)
    const ku = `loginfail:u:${await hashKey(username)}`;
    const ki = `loginfail:ip:${await hashKey(ip || 'unknown')}`;
    await redisPipeline(env, [
      ['INCR', ku], ['EXPIRE', ku, LOGIN_WINDOW_SEC, 'NX'],
      ['INCR', ki], ['EXPIRE', ki, LOGIN_WINDOW_SEC, 'NX'],
    ]);
  } catch { /* bỏ qua */ }
}

export async function clearLoginFails(env, username) {
  if (!hasRedis(env)) return;
  try { await redisCmd(env, ['DEL', `loginfail:u:${await hashKey(username)}`]); } catch { /* bỏ qua */ }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', ...NO_CACHE },
  });
}

/**
 * PUT /api/session  (header Authorization: Bearer <token còn hạn>)
 * Đổi token còn hạn lấy token mới 72h → phiên "72 giờ KHÔNG hoạt động".
 * Token đã hết hạn thì không đổi được (phải đăng nhập lại).
 * Kiểm tra tài khoản vẫn tồn tại và đang hoạt động trước khi cấp mới,
 * nên tài khoản bị xóa/khóa sẽ không tự gia hạn được nữa.
 */
async function handleRefresh(request, env, secret, ctx) {
  const h = request.headers.get('Authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  const v = await verifyToken(token, secret);
  if (!v.ok) return json({ ok: false, msg: v.reason === 'expired' ? 'Phiên đã hết hạn' : 'Chưa đăng nhập' }, 401);

  // Cache Redis 120s dùng chung với /api/score (admin khóa/xóa → DEL khóa stu:active:<id>)
  const lookup = await getStudentCached(env, ctx, v.sid, async () => {
    const r = await fetch(
      `${env.SUPA_URL}/rest/v1/students?select=id,display_name,username,is_active&id=eq.${encodeURIComponent(v.sid)}&limit=1`,
      { headers: { apikey: env.SUPA_KEY, Authorization: `Bearer ${env.SUPA_KEY}` } });
    if (!r.ok) return { ok: false, status: r.status, student: null };
    const rows = await r.json().catch(() => null);
    return { ok: true, student: Array.isArray(rows) ? (rows[0] || null) : null };
  });
  if (!lookup.ok) return json({ ok: false, msg: 'Không kiểm tra được tài khoản' }, 502); // lỗi tạm: client giữ token cũ
  const st = lookup.student;
  if (!st || st.is_active === false) return json({ ok: false, msg: 'Tài khoản không còn hiệu lực' }, 401);

  const now = Date.now();
  return json({ ok: true, token: await signToken(v.sid, secret, now), expiresAt: now + TOKEN_TTL_MS });
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();
  if (method !== 'POST' && method !== 'PUT') return json({ ok: false, msg: 'Method không hỗ trợ' }, 405);

  // Chỉ nhận từ chính trang này
  const origin = request.headers.get('Origin');
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(request.url).host) return json({ ok: false, msg: 'Origin không hợp lệ' }, 403);
    } catch { return json({ ok: false, msg: 'Origin không hợp lệ' }, 403); }
  }

  const secret = (env.SESSION_SECRET || '').trim();
  if (!env.SUPA_URL || !env.SUPA_KEY || secret.length < 32) {
    console.error('[session] Thiếu SUPA_URL / SUPA_KEY hoặc SESSION_SECRET (>=32 ký tự)');
    return json({ ok: false, msg: 'Máy chủ chưa được cấu hình đầy đủ' }, 500);
  }

  if (method === 'PUT') return handleRefresh(request, env, secret, context);

  let body;
  try { body = await request.json(); } catch { return json({ ok: false, msg: 'Body không hợp lệ' }, 400); }
  const username = String(body?.username ?? '').trim();
  const password = String(body?.password ?? '');
  if (!username || !password || username.length > 100 || password.length > 200) {
    return json({ ok: false, msg: 'Thiếu tên đăng nhập hoặc mật khẩu' }, 400);
  }

  // Chống dò mật khẩu: quá số lần sai thì chặn TRƯỚC khi hỏi Edge Function
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for') || 'unknown';
  const lim = await checkLoginLimit(env, username, ip);
  if (lim.blocked) {
    const mins = Math.ceil(lim.retryAfter / 60);
    return new Response(JSON.stringify({ ok: false, msg: `Sai quá nhiều lần. Thử lại sau ${mins} phút.` }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': String(lim.retryAfter), ...NO_CACHE },
    });
  }

  // Gọi lại Edge Function đăng nhập hiện có
  let upstream;
  try {
    const r = await fetch(`${env.SUPA_URL}/functions/v1/student-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': env.SUPA_KEY,
        'Authorization': `Bearer ${env.SUPA_KEY}`,
      },
      body: JSON.stringify({ username, password }),
    });
    upstream = await r.json().catch(() => null);
  } catch (e) {
    console.error('[session] gọi student-login lỗi:', e?.message ?? e);
    return json({ ok: false, msg: 'Lỗi kết nối, thử lại nhé!' }, 502);
  }

  if (!upstream || upstream.ok !== true || !upstream.student?.id) {
    await recordLoginFail(env, username, ip);
    // Chuyển nguyên thông báo lỗi (sai mật khẩu, bị khóa…) cho client
    return json({ ok: false, msg: upstream?.msg || 'Đăng nhập thất bại!' }, 401);
  }
  await clearLoginFails(env, username);

  const now = Date.now();
  const token = await signToken(upstream.student.id, secret, now);
  return json({ ok: true, student: upstream.student, token, expiresAt: now + TOKEN_TTL_MS });
}
