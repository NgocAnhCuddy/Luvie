/**
 * Cloudflare Pages Function  /api/analytics
 *
 *  POST { event, lessonId, subject, score, total, pct }
 *    • chỉ nhận event trong danh sách cho phép, cùng-origin, body nhỏ
 *    • KHÔNG lưu điểm (điểm chính thức chỉ ở /api/score, có xác thực)
 *    • đếm sự kiện vào Upstash theo ngày (UTC) — INCR + EXPIRE NX trong MỘT request
 *    • nếu request kèm token phiên hợp lệ (Authorization: Bearer …) → PFADD vào
 *      HyperLogLog `analytics:active:<ngày>` để đếm SỐ HỌC SINH hoạt động mỗi ngày
 *      (xấp xỉ ~0.8%, tốn vài KB, không lưu danh sách học sinh)
 *    • luôn trả 204 nhanh, không bao giờ làm hỏng trải nghiệm học sinh
 *
 *  GET ?days=14   (header x-admin-secret = ADMIN_API_KEY)
 *    → { ok, days:[{ day, lesson_start, quiz_complete, active }] }  (mới → cũ)
 *    Dùng cho thẻ "Lượt học" trong Dashboard admin.
 */
import { verifyToken } from './session.js';
import { hasRedis, redisPipelineSafe } from '../_lib/redis.js';

const ALLOWED_EVENTS = new Set(['lesson_start', 'quiz_complete']);
const MAX_BODY = 2048;
const TTL_SEC = 60 * 60 * 24 * 90; // giữ số đếm 90 ngày
const MAX_DAYS = 90;

const noContent = () => new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
const bad = (status) => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  try { return new URL(origin).host === new URL(request.url).host; } catch { return false; }
}

function safeEqual(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Trả { event, day } hợp lệ hoặc null. Không tin bất kỳ số liệu nào từ client. */
export function parseEvent(raw, now = new Date()) {
  if (!raw || typeof raw !== 'object') return null;
  const event = String(raw.event || '');
  if (!ALLOWED_EVENTS.has(event)) return null;
  const day = now.toISOString().slice(0, 10); // ngày theo UTC của server
  return { event, day };
}

/** Lấy studentId từ token phiên (nếu có và hợp lệ). Không có/sai → null (vẫn đếm sự kiện). */
async function studentFromToken(request, env) {
  const secret = (env.SESSION_SECRET || '').trim();
  if (!secret) return null;
  const h = request.headers.get('Authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!token) return null;
  const v = await verifyToken(token, secret);
  return v.ok ? v.sid : null;
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return bad(403);
  const len = Number(request.headers.get('Content-Length') || 0);
  if (len > MAX_BODY) return bad(413);

  let raw = null;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return bad(413);
    raw = JSON.parse(text);
  } catch { return bad(400); }

  const ev = parseEvent(raw);
  if (!ev) return bad(400);

  // Đếm ngày (best effort): Upstash chưa cấu hình / lỗi thì bỏ qua âm thầm
  if (hasRedis(env)) {
    const key = `analytics:${ev.day}:${ev.event}`;
    const cmds = [['INCR', key], ['EXPIRE', key, TTL_SEC, 'NX']];
    const sid = await studentFromToken(request, env);
    if (sid) {
      const hk = `analytics:active:${ev.day}`;
      cmds.push(['PFADD', hk, sid], ['EXPIRE', hk, TTL_SEC, 'NX']);
    }
    await redisPipelineSafe(env, cmds);
  }
  return noContent();
}

export async function onRequestGet({ request, env }) {
  const adminKey = (env.ADMIN_API_KEY || '').trim();
  if (!adminKey || !safeEqual(request.headers.get('x-admin-secret'), adminKey)) {
    return json({ ok: false, error: 'Chỉ quản trị viên' }, 403);
  }
  if (!hasRedis(env)) return json({ ok: false, error: 'Chưa cấu hình Upstash' }, 503);

  const url = new URL(request.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '14', 10) || 14, 1), MAX_DAYS);

  const list = [];
  const now = Date.now();
  for (let i = 0; i < days; i++) list.push(new Date(now - i * 86400000).toISOString().slice(0, 10));

  const cmds = [];
  for (const d of list) {
    cmds.push(['GET', `analytics:${d}:lesson_start`], ['GET', `analytics:${d}:quiz_complete`], ['PFCOUNT', `analytics:active:${d}`]);
  }
  const res = await redisPipelineSafe(env, cmds);
  if (!res) return json({ ok: false, error: 'Upstash tạm thời không phản hồi' }, 502);

  const out = list.map((day, i) => ({
    day,
    lesson_start: Number(res[i * 3]) || 0,
    quiz_complete: Number(res[i * 3 + 1]) || 0,
    active: Number(res[i * 3 + 2]) || 0,
  }));
  return json({ ok: true, days: out });
}

export async function onRequestOptions() { return new Response(null, { status: 204 }); }
