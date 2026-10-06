/**
 * ══════════════════════════════════════════════════════════════════
 *  /functions/api/score.js  —  Learnsy Score Service  (v7)
 *  Cloudflare Pages Function
 *
 *  POST   /api/score                      ← học sinh nộp bài (mỗi bài 1 dòng — làm lại thì GHI ĐÈ)
 *  GET    /api/score?studentId=xxx        ← lịch sử của học sinh
 *  GET    /api/score?lessonId=xxx[&summary=1]
 *  DELETE /api/score                      ← xóa lịch sử (soft-delete)
 *         body: { studentId, ids?: [] }   (ids trống = xóa hết của học sinh)
 *         body: { admin:true, ids?, lessonId?, all? }  + header x-admin-secret
 *
 *  Env vars: SUPA_URL, SUPA_KEY (khóa công khai), (khuyên dùng) SUPA_SERVICE_KEY (khóa bí mật, chỉ server), (tùy chọn) ADMIN_API_KEY
 *
 *  THAY ĐỔI SO VỚI v6:
 *   1. Điểm là số thực (7.75/10), không còn Math.round → không lệch.
 *   2. Không upsert (student_id,lesson_id) nữa: mỗi lần làm là 1 dòng,
 *      lịch sử thật sự được giữ. attempt_id chống gửi trùng (idempotent).
 *   3. Xóa là soft-delete (deleted_at) và MỌI truy vấn đều lọc
 *      deleted_at IS NULL → xóa rồi thì không bao giờ hiện lại.
 *   4. Không cache: Cache-Control: no-store trên mọi phản hồi.
 *   5. Kiểm tra học sinh tồn tại + đang hoạt động trước khi nhận điểm.
 *   6. Rate limit chuyển sang dựa trên DB (bộ nhớ Worker không bền).
 *
 *  YÊU CẦU DB: chạy file  supabase/migrations/2026_score_history.sql
 *
 *  v8 — tận dụng Upstash Redis (UPSTASH_URL / UPSTASH_TOKEN; không có thì chạy như v7):
 *   • Trạng thái học sinh (tồn tại/is_active) cache 120s  → bớt 1 request Supabase mỗi lần nộp
 *   • Rate-limit nộp bài bằng INCR+EXPIRE                → bớt 1 request Supabase
 *   • Chống nộp trùng: khóa NX theo attemptId + lưu kết quả 7 ngày → bớt 1 request Supabase,
 *     và hết race "kiểm tra rồi mới ghi"
 *   • Admin xem ?all=1 / ?lessonId=… cache 30s, tự vô hiệu khi có nộp mới/xóa (khóa phiên bản score:ver)
 *   Redis lỗi/timeout → tự quay về đường Supabase của v7 (fail-open), không chặn học sinh.
 * ══════════════════════════════════════════════════════════════════
 */

import { verifyToken } from './session.js';
import { redisCmdSafe, rateCount, shaKey, defer } from '../_lib/redis.js';
import { getStudentCached } from '../_lib/student-cache.js';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-secret',
};

const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PER_Q = 300;        // số câu tối đa lưu chi tiết
const MAX_LIMIT = 500;
const RATE_MAX  = 8;          // tối đa 8 lần nộp / học sinh / 60s
const RATE_WIN_MS = 60_000;
const ADMIN_VIEW_TTL_SEC = 30;        // cache danh sách kết quả cho admin
const ADMIN_VIEW_MAX_BYTES = 900_000; // không cache phản hồi quá lớn (giới hạn request Upstash)
const ATTEMPT_RESULT_TTL_SEC = 7 * 24 * 3600;
const ATTEMPT_LOCK_TTL_SEC = 30;

// ── Helpers ──────────────────────────────────────────────────────

const round2 = n => Math.round(n * 100) / 100;

/** Điểm thang 10, 2 chữ số thập phân (7.75), giới hạn 0..10. */
function calcDiem10(score, total) {
  if (!total || total <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, score / total));
  return Math.round(ratio * 1000) / 100;
}

function xepLoai(d) {
  if (d >= 9)   return { label: 'Xuất sắc',    emoji: '🏆', color: '#10b981' };
  if (d >= 8)   return { label: 'Giỏi',        emoji: '🥇', color: '#f59e0b' };
  if (d >= 6.5) return { label: 'Khá',         emoji: '🥈', color: '#a855f7' };
  if (d >= 5)   return { label: 'Trung bình',  emoji: '👍', color: '#f472b6' };
  return               { label: 'Cần cố gắng', emoji: '📚', color: '#ef4444' };
}

function sanitizeStr(val, maxLen = 200, fallback = '') {
  if (val == null) return fallback;
  return String(val).trim().slice(0, maxLen) || fallback;
}

/** Chỉ giữ các trường an toàn/nhỏ gọn của từng câu. */
function sanitizePerQ(perQ) {
  if (!Array.isArray(perQ)) return [];
  return perQ.slice(0, MAX_PER_Q).map(p => ({
    type:       sanitizeStr(p?.type, 20),
    ok:         !!p?.ok,
    partial:    !!p?.partial,
    qText:      sanitizeStr(p?.qText, 120),
    correctAns: sanitizeStr(p?.correctAns, 300),
    userAns:    sanitizeStr(p?.userAns, 300),
  }));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, ...NO_CACHE, 'Content-Type': 'application/json' },
  });
}

/** Trả thẳng chuỗi JSON đã dựng sẵn (dùng cho cache). */
function jsonRaw(bodyText, status = 200, cacheState = '') {
  const headers = { ...CORS, ...NO_CACHE, 'Content-Type': 'application/json' };
  if (cacheState) headers['X-Redis-Cache'] = cacheState;
  return new Response(bodyText, { status, headers });
}

/** Mọi lần có điểm mới / xóa điểm → đổi "phiên bản" để các view admin đã cache hết hiệu lực. */
const bumpScoreVersion = (env) => redisCmdSafe(env, ['INCR', 'score:ver']);

async function supaFetch(env, path, method = 'GET', body = null, prefer = null) {
  const url = `${env.SUPA_URL}/rest/v1${path}`;
  // Khóa riêng cho server (service_role / sb_secret_...) để có quyền UPDATE khi ghi đè điểm.
  // KHÔNG dùng SUPA_KEY cho việc này: /api/config trả SUPA_KEY xuống trình duyệt, nên SUPA_KEY
  // chỉ được là khóa công khai (anon / sb_publishable_...). Chưa đặt SUPA_SERVICE_KEY → dùng SUPA_KEY như cũ.
  const dbKey = env.SUPA_SERVICE_KEY || env.SUPA_KEY;
  const headers = {
    'apikey':        dbKey,
    'Authorization': `Bearer ${dbKey}`,
    'Content-Type':  'application/json',
  };
  if (prefer) headers['Prefer'] = prefer;

  const opts = { method, headers };
  if (body != null) opts.body = JSON.stringify(body);

  const res  = await fetch(url, opts);
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

/** So sánh hằng-thời-gian để tránh timing attack với admin secret. */
function safeEqual(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function isAdmin(request, env) {
  const key = (env.ADMIN_API_KEY || '').trim();
  if (!key) return false;
  return safeEqual(request.headers.get('x-admin-secret'), key);
}

/**
 * Xác thực học sinh bằng token (Authorization: Bearer ...).
 * Trả { ok:true } nếu token hợp lệ và thuộc đúng `studentId`.
 * Nếu SESSION_SECRET chưa được đặt → chế độ chuyển tiếp: cho qua (như trước),
 * kèm cảnh báo trong log. Đặt SESSION_SECRET để bắt buộc token.
 */
async function authStudent(request, env, studentId) {
  const secret = (env.SESSION_SECRET || '').trim();
  if (!secret) {
    console.warn('[score] SESSION_SECRET chưa đặt: API điểm đang KHÔNG yêu cầu token.');
    return { ok: true, legacy: true };
  }
  const h = request.headers.get('Authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  const v = await verifyToken(token, secret);
  if (!v.ok) return { ok: false, status: 401, error: v.reason === 'expired' ? 'Phiên đã hết hạn' : 'Chưa đăng nhập' };
  if (String(studentId) !== v.sid) return { ok: false, status: 403, error: 'Không có quyền với tài khoản này' };
  return { ok: true, sid: v.sid };
}

/** Thêm diem10 + rank cho mỗi dòng (kể cả dữ liệu cũ thiếu cột). */
function normalizeRow(r) {
  const d10 = r.diem10 != null ? Number(r.diem10) : calcDiem10(Number(r.score), Number(r.total));
  const pct = r.pct != null ? Number(r.pct)
    : (Number(r.total) > 0 ? Math.round(Number(r.score) / Number(r.total) * 100) : 0);
  return { ...r, score: Number(r.score), total: Number(r.total), diem10: d10, pct, rank: xepLoai(d10) };
}

// ════════════════════════════════════════════════════════════════
//  POST — nộp bài
// ════════════════════════════════════════════════════════════════
async function handlePost(request, env, ctx) {
  let body;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'Body không hợp lệ (cần JSON)' }, 400); }

  const {
    attemptId = null, lessonId, lessonTitle,
    studentName = 'Ẩn danh', studentId = null,
    score, total, perQ = [], durationSec = null,
  } = body || {};

  // ── Validate ────────────────────────────────────────────────
  const errs = [];
  if (!lessonId)                                        errs.push('lessonId');
  if (!studentId || !UUID_RE.test(String(studentId)))   errs.push('studentId');
  const sc = Number(score), tt = Number(total);
  if (!Number.isFinite(sc) || sc < 0)                   errs.push('score');
  if (!Number.isFinite(tt) || tt <= 0)                  errs.push('total');
  if (Number.isFinite(sc) && Number.isFinite(tt) && sc > tt + 1e-9) errs.push('score>total');
  if (errs.length) {
    return json({ ok: false, error: `Thiếu hoặc sai trường: ${errs.join(', ')}` }, 400);
  }
  if (attemptId && !/^[A-Za-z0-9_-]{8,64}$/.test(String(attemptId))) {
    return json({ ok: false, error: 'attemptId không hợp lệ' }, 400);
  }

  const sid = String(studentId);

  const auth = await authStudent(request, env, sid);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);

  // ── Học sinh phải tồn tại và đang hoạt động ─────────────────
  // Cache Redis 120s; admin khóa/xóa/sửa học sinh sẽ DEL khóa này (student-manager.jsx)
  const stu = await getStudentCached(env, ctx, sid, async () => {
    const r = await supaFetch(env,
      `/students?select=id,display_name,username,is_active&id=eq.${encodeURIComponent(sid)}&limit=1`);
    if (!r.ok) {
      console.error('[score] students lookup lỗi:', r.status, r.data);
      return { ok: false, status: r.status, student: null };
    }
    return { ok: true, student: Array.isArray(r.data) ? (r.data[0] || null) : null };
  });
  if (!stu.ok) return json({ ok: false, error: 'Không kiểm tra được tài khoản' }, 502);
  const student = stu.student;
  if (!student)              return json({ ok: false, error: 'Tài khoản không tồn tại' }, 403);
  if (student.is_active === false) return json({ ok: false, error: 'Tài khoản đã bị khóa' }, 403);

  // ── Idempotent: attemptId đã lưu rồi → trả lại kết quả cũ ────
  // Ưu tiên Redis (kết quả lưu 7 ngày). Redis không dùng được → tra DB như v7.
  const resKey  = attemptId ? `attempt:res:${sid}:${attemptId}` : null;
  const lockKey = attemptId ? `attempt:lock:${sid}:${attemptId}` : null;
  let redisUp = false;
  if (attemptId) {
    const cached = await redisCmdSafe(env, ['GET', resKey]);
    redisUp = cached !== undefined;
    if (typeof cached === 'string') {
      try { return json({ ...JSON.parse(cached), ok: true, duplicate: true }); }
      catch { /* khóa hỏng → đi tiếp */ }
    }
  }
  const dbDuplicate = async () => {
    const dup = await supaFetch(env,
      `/quiz_results?select=*&student_id=eq.${encodeURIComponent(sid)}&attempt_id=eq.${encodeURIComponent(attemptId)}&limit=1`);
    if (dup.ok && Array.isArray(dup.data) && dup.data[0]) {
      const r = normalizeRow(dup.data[0]);
      // Trường hợp đã bị xóa mềm: vẫn coi là "đã nhận", KHÔNG hồi sinh
      return json({
        ok: true, duplicate: true, id: r.id,
        diem10: r.diem10, pct: r.pct, score: r.score, total: r.total, rank: r.rank,
        submittedAt: r.submitted_at,
        message: `${r.rank.emoji} ${r.diem10}/10 — ${r.rank.label}`,
      });
    }
    return null;
  };
  if (attemptId && !redisUp) {
    const dup = await dbDuplicate();
    if (dup) return dup;
  }

  // ── Rate limit: Redis (INCR + EXPIRE NX), lỗi thì dựa trên DB ──
  const rlCount = await rateCount(env, `rl:score:${sid}`, Math.round(RATE_WIN_MS / 1000));
  if (rlCount !== undefined) {
    if (rlCount > RATE_MAX) return json({ ok: false, error: 'Nộp bài quá nhanh, vui lòng thử lại sau.' }, 429);
  } else {
    const since = new Date(Date.now() - RATE_WIN_MS).toISOString();
    const rl = await supaFetch(env,
      `/quiz_results?select=id&student_id=eq.${encodeURIComponent(sid)}&submitted_at=gte.${encodeURIComponent(since)}&limit=${RATE_MAX + 1}`);
    if (rl.ok && Array.isArray(rl.data) && rl.data.length >= RATE_MAX) {
      return json({ ok: false, error: 'Nộp bài quá nhanh, vui lòng thử lại sau.' }, 429);
    }
  }

  // ── Tính điểm (tin server, không tin diem10/pct do client gửi) ─
  const scoreN = round2(sc);
  const totalN = round2(tt);
  const diem10 = calcDiem10(scoreN, totalN);
  const pct    = Math.round(Math.min(1, scoreN / totalN) * 100);
  const rank   = xepLoai(diem10);
  const perQClean = sanitizePerQ(perQ);
  const submittedAt = new Date().toISOString();

  // ── Khóa chống nộp song song cùng attemptId (SET NX) ─────────
  let lockHeld = false;
  if (attemptId && redisUp) {
    const got = await redisCmdSafe(env, ['SET', lockKey, '1', 'NX', 'EX', ATTEMPT_LOCK_TTL_SEC]);
    if (got === null) {
      // Có request khác đang/đã xử lý cùng attemptId. Nếu đã vào DB → trả kết quả thật.
      const dup = await dbDuplicate();
      if (dup) return dup;
      // Chưa thấy trong DB: đang xử lý dở (hoặc vừa lỗi). 429 → client giữ trong hàng đợi và gửi lại sau.
      return new Response(JSON.stringify({ ok: false, error: 'Đang xử lý bài nộp, thử lại sau giây lát.' }), {
        status: 429,
        headers: { ...CORS, ...NO_CACHE, 'Content-Type': 'application/json', 'Retry-After': '3' },
      });
    }
    lockHeld = got === 'OK';
  }

  const payload = {
    attempt_id:     attemptId ? String(attemptId) : null,
    student_name:   sanitizeStr(student.display_name || student.username || studentName, 100, 'Ẩn danh'),
    student_id:     sid,
    lesson_id:      sanitizeStr(lessonId, 200),
    lesson_title:   sanitizeStr(lessonTitle, 200, 'Không rõ'),
    score:          scoreN,
    total:          totalN,
    diem10,
    pct,
    xep_loai:       rank.label,
    per_q:          perQClean,
    question_count: perQClean.length || null,
    duration_sec:   Number.isFinite(Number(durationSec)) ? Math.max(0, Math.round(Number(durationSec))) : null,
    submitted_at:   submittedAt,
  };

  // GHI ĐÈ: mỗi học sinh chỉ giữ 1 dòng cho mỗi bài (lần làm mới nhất).
  // Có dòng cũ (chưa xóa) của cùng bài → PATCH dòng mới nhất bằng kết quả mới,
  // các dòng trùng cũ hơn (nếu còn sót) bị xóa mềm. Chưa có → INSERT.
  const lessonKey = payload.lesson_id;
  const existing = await supaFetch(env,
    `/quiz_results?select=id&student_id=eq.${encodeURIComponent(sid)}&lesson_id=eq.${encodeURIComponent(lessonKey)}&deleted_at=is.null&order=submitted_at.desc&limit=50`);
  const oldRows = existing.ok && Array.isArray(existing.data) ? existing.data : [];

  let ok, data, status;
  let overwritten = false;
  if (oldRows.length) {
    const keepId = oldRows[0].id;
    ({ ok, data, status } = await supaFetch(
      env, `/quiz_results?id=eq.${encodeURIComponent(keepId)}`, 'PATCH', payload, 'return=representation'));
    // PATCH bị RLS chặn (khóa anon không có quyền UPDATE) vẫn trả 200 nhưng KHÔNG sửa dòng nào:
    // phải kiểm tra số dòng thật sự được cập nhật, nếu 0 thì lưu thành dòng mới để không mất điểm.
    const updatedN = ok && Array.isArray(data) ? data.length : 0;
    if (!ok || updatedN === 0) {
      console.warn('[score] Không ghi đè được dòng cũ (status ' + status + ', cập nhật ' + updatedN + ' dòng; nghi RLS chặn UPDATE / chưa đặt SUPA_SERVICE_KEY) → lưu dòng mới', ok ? '' : JSON.stringify(data));
      ({ ok, data, status } = await supaFetch(
        env, '/quiz_results', 'POST', payload, 'return=representation'));
    } else if (ok) {
      overwritten = true;
      if (oldRows.length > 1) {
        const extraIds = oldRows.slice(1).map(r => r.id).join(',');
        const del = await supaFetch(
          env, `/quiz_results?id=in.(${extraIds})`, 'PATCH', { deleted_at: submittedAt }, 'return=minimal');
        if (!del.ok) console.warn('[score] dọn dòng trùng lỗi:', del.status, del.data);
      }
    }
  } else {
    // INSERT thuần (không merge-duplicates)
    ({ ok, data, status } = await supaFetch(
      env, '/quiz_results', 'POST', payload, 'return=representation'));
  }

  if (!ok) {
    // Race: 2 request cùng attempt_id → unique violation (23505) → coi như thành công
    const code = data && typeof data === 'object' ? data.code : null;
    if (code === '23505' && attemptId) {
      return json({ ok: true, duplicate: true, diem10, pct, score: scoreN, total: totalN, rank, submittedAt,
        message: `${rank.emoji} ${diem10}/10 — ${rank.label}` });
    }
    console.error('[score] Supabase ghi điểm lỗi:', status, JSON.stringify(data));
    if (lockHeld) await defer(ctx, redisCmdSafe(env, ['DEL', lockKey])); // nhả khóa để client gửi lại được
    return json({
      ok: false, error: 'Lưu kết quả thất bại',
      detail: typeof data === 'object' ? data?.message ?? data : data,
    }, 502);
  }

  const saved = Array.isArray(data) ? data[0] : data;
  const out = {
    ok: true, id: saved?.id ?? null, overwritten,
    diem10, pct, score: scoreN, total: totalN, rank, submittedAt,
    message: `${rank.emoji} ${diem10}/10 — ${rank.label}`,
  };
  if (attemptId && redisUp) {
    const { ok: _ok, ...stored } = out;
    await defer(ctx, redisCmdSafe(env, ['SET', resKey, JSON.stringify(stored), 'EX', ATTEMPT_RESULT_TTL_SEC]));
  }
  await defer(ctx, bumpScoreVersion(env)); // view admin đã cache hết hiệu lực
  return json(out);
}

// ════════════════════════════════════════════════════════════════
//  GET — lấy kết quả
// ════════════════════════════════════════════════════════════════
async function handleGet(request, env, ctx) {
  const url       = new URL(request.url);
  const lessonId  = url.searchParams.get('lessonId')  || '';
  const studentId = url.searchParams.get('studentId') || '';
  const summary   = url.searchParams.get('summary') === '1';
  const limit     = Math.min(Math.max(Number(url.searchParams.get('limit')  || 100), 1), MAX_LIMIT);
  const offset    = Math.max(Number(url.searchParams.get('offset') || 0), 0);

  // Admin: liệt kê kết quả gần đây của mọi học sinh (không cần lessonId/studentId)
  const adminList = url.searchParams.get('all') === '1';
  if (adminList && !isAdmin(request, env)) {
    return json({ ok: false, error: 'Chỉ quản trị viên' }, 403);
  }
  if (!lessonId && !studentId && !adminList) {
    return json({ ok: false, error: 'Cần lessonId hoặc studentId' }, 400);
  }
  if (studentId && !UUID_RE.test(studentId)) {
    return json({ ok: false, error: 'studentId không hợp lệ' }, 400);
  }
  // Xem lịch sử của một học sinh: phải là chính học sinh đó (hoặc admin)
  if (studentId && !isAdmin(request, env)) {
    const auth = await authStudent(request, env, studentId);
    if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
  }
  // Xem theo bài (mọi học sinh) là dữ liệu tổng hợp → chỉ admin
  if (!studentId && lessonId && (env.SESSION_SECRET || '').trim() && !isAdmin(request, env)) {
    return json({ ok: false, error: 'Chỉ quản trị viên' }, 403);
  }

  // ── Cache Redis cho view tổng hợp (admin: ?all=1 hoặc ?lessonId=…) ──
  // Mọi kiểm tra quyền ở trên đã xong nên cache không thể làm lộ dữ liệu.
  // Khóa kèm số phiên bản score:ver → có nộp mới / xóa là tự bỏ cache cũ.
  let cacheKey = null;
  if (!studentId) {
    const ver = await redisCmdSafe(env, ['GET', 'score:ver']);
    if (ver !== undefined) {
      cacheKey = `score:view:${ver || 0}:` + await shaKey(
        `${adminList ? 1 : 0}|${lessonId}|${summary ? 1 : 0}|${limit}|${offset}`);
      const hit = await redisCmdSafe(env, ['GET', cacheKey]);
      if (typeof hit === 'string') return jsonRaw(hit, 200, 'HIT');
    }
  }
  const finish = async (obj) => {
    const text = JSON.stringify(obj);
    if (cacheKey && text.length <= ADMIN_VIEW_MAX_BYTES) {
      await defer(ctx, redisCmdSafe(env, ['SET', cacheKey, text, 'EX', ADMIN_VIEW_TTL_SEC]));
    }
    return jsonRaw(text, 200, cacheKey ? 'MISS' : '');
  };

  // deleted_at IS NULL: bản ghi đã xóa KHÔNG BAO GIỜ trả về
  let path = '/quiz_results?select=*&deleted_at=is.null';
  if (lessonId)  path += `&lesson_id=eq.${encodeURIComponent(lessonId)}`;
  if (studentId) path += `&student_id=eq.${encodeURIComponent(studentId)}`;
  path += `&order=submitted_at.desc&limit=${limit}&offset=${offset}`;

  const { ok, data, status } = await supaFetch(env, path);
  if (!ok) {
    console.error('[score] Supabase GET error:', status, data);
    return json({ ok: false, error: 'Truy vấn thất bại', detail: data }, 502);
  }

  const rows = (Array.isArray(data) ? data : []).map(normalizeRow);

  if (summary && rows.length > 0) {
    const d = rows.map(r => r.diem10);
    const avg = round2(d.reduce((a, b) => a + b, 0) / d.length);
    const dist = { '9-10': 0, '7-8.9': 0, '5-6.9': 0, '<5': 0 };
    d.forEach(x => {
      if (x >= 9) dist['9-10']++;
      else if (x >= 7) dist['7-8.9']++;
      else if (x >= 5) dist['5-6.9']++;
      else dist['<5']++;
    });
    const top5 = [...rows].sort((a, b) => b.diem10 - a.diem10).slice(0, 5)
      .map(({ student_name, diem10, score, total, submitted_at }) =>
        ({ student_name, diem10, score, total, submitted_at }));
    return finish({
      ok: true, lessonId, count: rows.length,
      avgDiem10: avg, maxDiem10: Math.max(...d), minDiem10: Math.min(...d),
      dist, top5, rows,
    });
  }

  return finish({ ok: true, count: rows.length, rows });
}

// ════════════════════════════════════════════════════════════════
//  DELETE — xóa lịch sử (soft-delete)
// ════════════════════════════════════════════════════════════════
async function handleDelete(request, env, ctx) {
  let body;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'Body không hợp lệ (cần JSON)' }, 400); }

  const { studentId = null, ids = null, lessonId = null, all = false } = body || {};
  const admin = isAdmin(request, env);
  const now = new Date().toISOString();

  const cleanIds = Array.isArray(ids)
    ? ids.map(String).filter(x => /^[A-Za-z0-9_-]{1,64}$/.test(x)).slice(0, 500)
    : [];
  if (Array.isArray(ids) && ids.length && !cleanIds.length) {
    return json({ ok: false, error: 'ids không hợp lệ' }, 400);
  }

  let filter = 'deleted_at=is.null';

  if (admin && !studentId) {
    // Admin xóa theo bài / theo id / toàn bộ
    if (cleanIds.length)      filter += `&id=in.(${cleanIds.join(',')})`;
    else if (lessonId)        filter += `&lesson_id=eq.${encodeURIComponent(String(lessonId))}`;
    else if (all === true)    { /* xóa tất cả bản ghi chưa xóa */ }
    else return json({ ok: false, error: 'Cần ids, lessonId hoặc all:true' }, 400);
  } else {
    // Học sinh chỉ xóa được lịch sử CỦA CHÍNH MÌNH
    if (!studentId || !UUID_RE.test(String(studentId))) {
      return json({ ok: false, error: 'studentId không hợp lệ' }, 400);
    }
    const auth = await authStudent(request, env, String(studentId));
    if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
    filter += `&student_id=eq.${encodeURIComponent(String(studentId))}`;
    if (cleanIds.length) filter += `&id=in.(${cleanIds.join(',')})`;
  }

  const { ok, data, status } = await supaFetch(
    env, `/quiz_results?${filter}`, 'PATCH',
    { deleted_at: now }, 'return=representation');

  if (!ok) {
    console.error('[score] soft-delete lỗi:', status, data);
    return json({ ok: false, error: 'Xóa thất bại', detail: data }, 502);
  }
  // Chờ INCR xong (không defer): admin bấm xóa rồi tải lại ngay phải thấy dữ liệu mới
  await bumpScoreVersion(env);
  return json({ ok: true, deleted: Array.isArray(data) ? data.length : 0 });
}

/**
 * Chặn request ghi (POST/DELETE) đến từ trang web khác (CSRF/cross-site).
 * Trình duyệt luôn gửi Origin cho request ghi cross-origin; nếu có Origin thì
 * phải cùng host với trang. Request không có Origin (curl, server-to-server)
 * vẫn phải qua các lớp kiểm tra khác (admin secret / tài khoản hợp lệ).
 */
function sameOriginOk(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  try { return new URL(origin).host === new URL(request.url).host; }
  catch { return false; }
}

// ════════════════════════════════════════════════════════════════
//  Entry point
// ════════════════════════════════════════════════════════════════
export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  if (!env.SUPA_URL || !env.SUPA_KEY) {
    console.error('[score] Thiếu env SUPA_URL / SUPA_KEY');
    return json({ ok: false, error: 'Cấu hình server chưa đầy đủ' }, 500);
  }

  if ((method === 'POST' || method === 'DELETE') && !sameOriginOk(request)) {
    return json({ ok: false, error: 'Origin không hợp lệ' }, 403);
  }

  try {
    if (method === 'POST')   return await handlePost(request, env, context);
    if (method === 'GET')    return await handleGet(request, env, context);
    if (method === 'DELETE') return await handleDelete(request, env, context);
    return json({ ok: false, error: `Method ${method} không hỗ trợ` }, 405);
  } catch (err) {
    console.error('[score] Unhandled exception:', err?.message ?? err);
    return json({ ok: false, error: 'Lỗi server nội bộ' }, 500);
  }
}
