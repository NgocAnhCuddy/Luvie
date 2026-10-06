// ══════════════════════════════════════════════════════════════════
//  SAVE-RESULT.JSX  ·  Learnsy · Lưu / tải / xóa kết quả quiz  (v7)
//  Exports: window.saveQuizResult, window.flushPendingResults,
//           window.loadQuizHistory, window.deleteQuizHistory
//
//  v7 — thay đổi so với v6:
//   • Mỗi lần nộp bài = 1 bản ghi riêng (có attemptId chống gửi trùng),
//     không còn ghi đè lần trước.
//   • Điểm gửi lên là số thực (7.75), không làm tròn thành nguyên.
//   • Xóa lịch sử gọi server (DELETE /api/score) — không chỉ xóa cache.
//   • Danh tính học sinh lấy từ LearnsySession (một nguồn duy nhất).
//   • Hàng đợi offline: gửi lại từng bản ghi, bản nào xong thì gỡ bản đó.
//   • Đã gộp/loại score-client.jsx (trước đó định nghĩa trùng
//     window.saveQuizResult và đè lẫn nhau).
// ══════════════════════════════════════════════════════════════════

;(function () {
  'use strict';

  const API = '/api/score';
  const PENDING_KEY = 'learnsy_pending_results_v2';
  const MAX_PENDING = 50;
  const _inFlight = new Set();

  // ── Danh tính học sinh (từ phiên đăng nhập) ───────────────────
  function _getStudent() {
    const u = window.LearnsySession?.peekUser?.() || null;
    if (!u || !u.id) return { name: 'Ẩn danh', id: null };
    return {
      name: String(u.display_name || u.username || 'Ẩn danh').trim() || 'Ẩn danh',
      id: String(u.id),
    };
  }

  function _newAttemptId() {
    try { if (crypto?.randomUUID) return crypto.randomUUID(); } catch { /* fallthrough */ }
    return 'a_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }

  // ── Hàng đợi offline ──────────────────────────────────────────
  function _readQueue() {
    try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch { return []; }
  }
  function _writeQueue(arr) {
    try {
      if (arr.length > MAX_PENDING) arr = arr.slice(arr.length - MAX_PENDING);
      if (arr.length) localStorage.setItem(PENDING_KEY, JSON.stringify(arr));
      else localStorage.removeItem(PENDING_KEY);
    } catch { /* đầy bộ nhớ */ }
  }
  function _enqueue(payload) {
    const q = _readQueue();
    // attemptId là khóa duy nhất → không xếp trùng
    if (q.some(p => p.attemptId === payload.attemptId)) return;
    q.push({ ...payload, queuedAt: new Date().toISOString() });
    _writeQueue(q);
  }
  function _dequeue(attemptId) {
    _writeQueue(_readQueue().filter(p => p.attemptId !== attemptId));
  }

  // Lỗi "vĩnh viễn": gửi lại cũng vô ích (payload sai) → bỏ khỏi hàng đợi
  function _isPermanentFailure(status) {
    // 401: token hết hạn — giữ bản ghi trong hàng đợi, gửi lại sau khi đăng nhập lại
    return status >= 400 && status < 500 && status !== 408 && status !== 429 && status !== 401;
  }

  // Header xác thực: token ký do /api/session (cấp lúc đăng nhập)
  function _authHeaders(extra) {
    const h = { ...(extra || {}) };
    const t = window.LearnsySession?.getToken?.();
    if (t) h['Authorization'] = 'Bearer ' + t;
    return h;
  }

  // 401 = token hết hạn/không hợp lệ → báo cho app đăng xuất, đăng nhập lại
  function _handleUnauthorized(status) {
    if (status === 401) window.dispatchEvent(new CustomEvent('learnsy:unauthorized'));
  }

  async function _post(payload) {
    const res = await fetch(API, {
      method: 'POST',
      headers: _authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    _handleUnauthorized(res.status);
    const data = await res.json().catch(() => ({}));
    return { res, data };
  }

  // ════════════════════════════════════════════════════════════
  //  saveQuizResult(opts)
  //   opts: { lessonId, lessonTitle, score, total, perQ, attemptId,
  //           durationSec }
  //   score/total là số thực (do LearnsyScoring.gradeAll tính).
  // ════════════════════════════════════════════════════════════
  async function saveQuizResult(opts) {
    const {
      lessonId, lessonTitle, score, total,
      perQ = [], durationSec = null,
    } = opts || {};

    const { name: studentName, id: studentId } = _getStudent();

    if (!studentId) {
      // Chưa đăng nhập → không có ai để gắn điểm. Không lưu ẩn danh nữa
      // vì bản ghi ẩn danh không bao giờ hiện lại được ở lịch sử.
      console.warn('[saveQuizResult] Không có phiên đăng nhập, bỏ qua lưu điểm.');
      return { ok: false, error: 'not_logged_in' };
    }

    const sc = Number(score), tt = Number(total);
    if (!Number.isFinite(sc) || !Number.isFinite(tt) || tt <= 0) {
      return { ok: false, error: 'invalid_score' };
    }

    const attemptId = opts?.attemptId || _newAttemptId();
    if (_inFlight.has(attemptId)) return { ok: false, error: 'duplicate' };
    _inFlight.add(attemptId);

    const payload = {
      attemptId,
      lessonId: lessonId != null && lessonId !== '' ? String(lessonId) : null,
      lessonTitle: String(lessonTitle || 'Không rõ'),
      studentName,
      studentId,
      score: Math.round(sc * 100) / 100,
      total: Math.round(tt * 100) / 100,
      perQ: Array.isArray(perQ) ? perQ : [],
      durationSec: Number.isFinite(Number(durationSec)) ? Math.round(Number(durationSec)) : null,
    };

    try {
      const { res, data } = await _post(payload);
      if (res.ok && data.ok) {
        return {
          ok: true, id: data.id, duplicate: !!data.duplicate,
          diem10: data.diem10, pct: data.pct, rank: data.rank, message: data.message,
        };
      }
      console.warn('[saveQuizResult] API error:', res.status, data.error, data.detail ?? '');
      if (!_isPermanentFailure(res.status)) _enqueue(payload);
      return { ok: false, error: data.error || `HTTP ${res.status}`, queued: !_isPermanentFailure(res.status) };
    } catch (e) {
      // Mất mạng → xếp hàng, tự gửi lại khi có mạng
      console.warn('[saveQuizResult] Network error:', e?.message ?? e);
      _enqueue(payload);
      return { ok: false, error: 'network', queued: true };
    } finally {
      setTimeout(() => _inFlight.delete(attemptId), 3000);
    }
  }

  // ════════════════════════════════════════════════════════════
  //  flushPendingResults() — gửi lại từng bản ghi đang chờ
  // ════════════════════════════════════════════════════════════
  let _flushing = false;
  async function flushPendingResults() {
    if (_flushing) return 0;
    _flushing = true;
    let sent = 0;
    try {
      const me = _getStudent().id;
      for (const payload of _readQueue()) {
        // Chỉ gửi bản ghi của chính người đang đăng nhập
        if (!me || payload.studentId !== me) continue;
        try {
          const { res, data } = await _post(payload);
          if (res.ok && data.ok) { _dequeue(payload.attemptId); sent++; }
          else if (_isPermanentFailure(res.status)) _dequeue(payload.attemptId);
          // 5xx / 429: giữ lại, thử lần sau
        } catch { break; /* vẫn mất mạng → dừng, thử lại sau */ }
      }
    } finally {
      _flushing = false;
    }
    if (sent > 0) window.dispatchEvent(new CustomEvent('learnsy:results-synced', { detail: { sent } }));
    return sent;
  }

  // ════════════════════════════════════════════════════════════
  //  loadQuizHistory(studentId) → { ok, rows }
  //  Trả ok=false khi lỗi mạng/server để UI KHÔNG ghi đè cache bằng [].
  // ════════════════════════════════════════════════════════════
  async function loadQuizHistory(studentId) {
    if (!studentId) return { ok: true, rows: [] };
    try {
      const res = await fetch(`${API}?studentId=${encodeURIComponent(studentId)}&limit=200`, {
        cache: 'no-store',
        headers: _authHeaders({ 'Cache-Control': 'no-cache' }),
      });
      _handleUnauthorized(res.status);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        console.warn('[loadQuizHistory] API error:', res.status, data.error);
        return { ok: false, rows: [] };
      }
      const rows = (data.rows || []).map(r => ({
        id: r.id,
        ts: r.submitted_at || r.created_at,
        lessonId: r.lesson_id,
        lessonTitle: r.lesson_title,
        score: Number(r.score),
        total: Number(r.total),
        pct: Number(r.pct ?? (r.total > 0 ? Math.round(r.score / r.total * 100) : 0)),
        diem10: Number(r.diem10),
        xepLoai: r.xep_loai,
        qCount: r.question_count ?? null,
        perQ: r.per_q || [],
        rank: r.rank,
      }));
      return { ok: true, rows };
    } catch (e) {
      console.warn('[loadQuizHistory] Exception:', e?.message ?? e);
      return { ok: false, rows: [] };
    }
  }

  // ════════════════════════════════════════════════════════════
  //  deleteQuizHistory(studentId, ids?) → { ok, deleted }
  //  ids bỏ trống = xóa toàn bộ lịch sử của học sinh đó.
  // ════════════════════════════════════════════════════════════
  async function deleteQuizHistory(studentId, ids) {
    if (!studentId) return { ok: false, error: 'no_student' };
    try {
      const res = await fetch(API, {
        method: 'DELETE',
        headers: _authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ studentId, ids: Array.isArray(ids) && ids.length ? ids : undefined }),
      });
      _handleUnauthorized(res.status);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };
      return { ok: true, deleted: data.deleted ?? 0 };
    } catch (e) {
      return { ok: false, error: String(e?.message ?? e) };
    }
  }

  // ── Tự gửi lại khi có mạng / mở trang ─────────────────────────
  window.addEventListener('load', () => setTimeout(flushPendingResults, 3000));
  window.addEventListener('online', () => setTimeout(flushPendingResults, 500));

  // ── Export globals ────────────────────────────────────────────
  window.saveQuizResult = saveQuizResult;
  window.flushPendingResults = flushPendingResults;
  window.loadQuizHistory = loadQuizHistory;
  window.deleteQuizHistory = deleteQuizHistory;
})();
