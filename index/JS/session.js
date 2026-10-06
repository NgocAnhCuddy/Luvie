/* ══════════════════════════════════════════════════════════════════
   SESSION.JS · Learnsy · Quản lý phiên đăng nhập
   ─────────────────────────────────────────────────────────────────
   Quy tắc: tự đăng xuất khi KHÔNG hoạt động quá 72 giờ.

   Lưu trong localStorage: { user, lastActive, createdAt }
   - "Hoạt động" = mở app, chạm/bấm/gõ phím, quay lại tab, hoặc làm bài.
   - lastActive được ghi tối đa mỗi 60s để không spam localStorage.
   - Kiểm tra lúc mở app, lúc quay lại tab, và định kỳ mỗi 60s.
   - Nhiều tab: dùng chung 1 khóa nên đăng xuất ở tab này → tab kia
     nhận sự kiện 'storage' và đăng xuất theo.
   ══════════════════════════════════════════════════════════════════ */

export const SESSION_TTL_MS = 72 * 60 * 60 * 1000; // 72 giờ

const KEY = 'ls_session_v2';
const LEGACY_KEY = 'ls_student'; // khóa cũ, không có hạn
const TOUCH_THROTTLE_MS = 60 * 1000;

let _lastTouchWrite = 0;
let _timer = null;
let _onExpire = null;

function _read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function _write(sess) {
  try { localStorage.setItem(KEY, JSON.stringify(sess)); } catch { /* đầy/bị chặn */ }
}

// Khóa tiến độ lưu THEO THIẾT BỊ (không gắn user). Nếu không dọn khi đăng xuất,
// học sinh dùng sau trên cùng máy sẽ thấy tiến độ/điểm cao nhất của người trước.
// Dữ liệu thật vẫn còn trên server (vocab_progress, quiz_results).
const DEVICE_PROGRESS_PREFIXES = ['vmaster_', 'ivbest_', 'vocabsave_', 'quizstate_', 'ls_student_hist'];

function _wipeDeviceProgress() {
  try {
    const drop = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && DEVICE_PROGRESS_PREFIXES.some(p => k.startsWith(p))) drop.push(k);
    }
    drop.forEach(k => localStorage.removeItem(k));
  } catch { /* ignore */ }
}

/** Dọn mọi dấu vết đăng nhập của khóa cũ + khóa mới và tiến độ theo máy. */
function _wipeAll() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(LEGACY_KEY);
    sessionStorage.removeItem(LEGACY_KEY);
  } catch { /* ignore */ }
  _wipeDeviceProgress();
}

/**
 * Đọc phiên hiện tại.
 * - Còn hạn  → trả user (và gia hạn).
 * - Hết hạn  → xóa sạch, trả null.
 * - Có khóa cũ (chưa có hạn) → nâng cấp lên khóa mới, coi như vừa hoạt động.
 */
export function loadSession() {
  let sess = _read();

  if (!sess) {
    try {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        const user = JSON.parse(legacy);
        if (user && user.id) {
          const now = Date.now();
          sess = { user, lastActive: now, createdAt: now };
          _write(sess);
        }
        localStorage.removeItem(LEGACY_KEY);
      }
    } catch { /* ignore */ }
  }

  if (!sess || !sess.user || !sess.user.id) return null;

  const idle = Date.now() - Number(sess.lastActive || 0);
  if (!Number.isFinite(idle) || idle > SESSION_TTL_MS || idle < -SESSION_TTL_MS) {
    // idle âm rất lớn = đồng hồ máy bị chỉnh → coi là không hợp lệ
    _wipeAll();
    _flagExpired();   // để màn đăng nhập giải thích vì sao bị đăng xuất
    return null;
  }
  return sess.user;
}

// Cờ "phiên vừa hết hạn": học sinh mở lại app sau >72h chỉ thấy màn đăng nhập,
// không có gì giải thích. Ghi cờ này để màn đăng nhập hiện thông báo MỘT lần.
const EXPIRED_FLAG = 'ls_session_expired';
function _flagExpired() { try { localStorage.setItem(EXPIRED_FLAG, String(Date.now())); } catch { /* ignore */ } }

/** Trả true (và xóa cờ) nếu phiên vừa hết hạn từ lần mở trước. */
export function consumeExpiredFlag() {
  try {
    const v = localStorage.getItem(EXPIRED_FLAG);
    if (!v) return false;
    localStorage.removeItem(EXPIRED_FLAG);
    return true;
  } catch { return false; }
}

export function saveSession(user, token = null) {
  const now = Date.now();
  _write({ user, token, tokenAt: now, lastActive: now, createdAt: now });
  _lastTouchWrite = now;
}

/** Token ký do /api/session (null nếu phiên đời cũ chưa có token). */
export function getToken() {
  const sess = _read();
  return sess?.token || null;
}

/** Cập nhật thông tin user (vd. đổi tên hiển thị) mà không reset createdAt. */
export function updateSessionUser(patch) {
  const sess = _read();
  if (!sess) return;
  _write({ ...sess, user: { ...sess.user, ...patch } });
}

export function clearSession() {
  _wipeAll();
}

/** Ghi nhận hoạt động (throttle 60s). */
export function touchSession(force = false) {
  const now = Date.now();
  if (!force && now - _lastTouchWrite < TOUCH_THROTTLE_MS) return;
  const sess = _read();
  if (!sess) return;
  _lastTouchWrite = now;
  _write({ ...sess, lastActive: now });
}

/** Còn bao nhiêu ms trước khi hết hạn (0 nếu đã hết / không có phiên). */
export function sessionRemainingMs() {
  const sess = _read();
  if (!sess) return 0;
  return Math.max(0, SESSION_TTL_MS - (Date.now() - Number(sess.lastActive || 0)));
}

function _check() {
  const sess = _read();
  if (!sess) return; // đã đăng xuất sẵn
  const idle = Date.now() - Number(sess.lastActive || 0);
  if (idle > SESSION_TTL_MS) {
    _wipeAll();
    if (_onExpire) _onExpire('expired');   // app hiện thông báo ngay, không cần cờ
  }
}

/**
 * Bắt đầu theo dõi phiên. onExpire('expired' | 'other-tab') được gọi khi
 * phải đăng xuất. Trả về hàm dừng theo dõi.
 */
export function startSessionWatcher(onExpire) {
  stopSessionWatcher();
  _onExpire = onExpire;

  const onActivity = () => touchSession();
  const onVisible = () => {
    if (document.visibilityState === 'visible') {
      _check();               // kiểm tra TRƯỚC, hết hạn thì không gia hạn nữa
      touchSession(true);
      refreshTokenIfNeeded(() => _onExpire && _onExpire('expired'));
    }
  };
  const onStorage = (e) => {
    // Tab khác đăng xuất / hết hạn
    if (e.key === KEY && e.newValue === null && _onExpire) _onExpire('other-tab');
  };

  const events = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
  events.forEach(ev => window.addEventListener(ev, onActivity, { passive: true }));
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);
  window.addEventListener('storage', onStorage);

  _timer = setInterval(() => { _check(); refreshTokenIfNeeded(() => _onExpire && _onExpire('expired')); }, 60 * 1000);
  _check();
  refreshTokenIfNeeded(() => _onExpire && _onExpire('expired'));

  const stop = () => {
    events.forEach(ev => window.removeEventListener(ev, onActivity));
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', onVisible);
    window.removeEventListener('storage', onStorage);
    if (_timer) { clearInterval(_timer); _timer = null; }
    _onExpire = null;
  };
  startSessionWatcher._stop = stop;
  return stop;
}

export function stopSessionWatcher() {
  if (startSessionWatcher._stop) {
    startSessionWatcher._stop();
    startSessionWatcher._stop = null;
  }
}

// ── Gia hạn token theo hoạt động ─────────────────────────────────
// Token server hạn 72h kể từ lúc cấp. Để đúng nghĩa "72h KHÔNG hoạt động",
// khi người dùng còn hoạt động ta đổi token mới định kỳ (mỗi ≥ 12h).
// Lỗi mạng / 5xx: giữ token cũ, thử lại sau. 401: tài khoản/phiên không còn
// hiệu lực → onExpire.
const REFRESH_MIN_AGE_MS = 12 * 60 * 60 * 1000;
let _refreshing = false;

export async function refreshTokenIfNeeded(onInvalid) {
  if (_refreshing) return;
  const sess = _read();
  if (!sess || !sess.token) return; // phiên đời cũ không token: không có gì để đổi
  const issuedAt = Number(sess.tokenAt || sess.createdAt || 0);
  if (Date.now() - issuedAt < REFRESH_MIN_AGE_MS) return;
  _refreshing = true;
  try {
    const res = await fetch('/api/session', {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + sess.token },
    });
    if (res.status === 401) { if (onInvalid) onInvalid(); return; }
    const data = await res.json().catch(() => null);
    if (res.ok && data && data.ok && data.token) {
      const cur = _read();
      if (cur) _write({ ...cur, token: data.token, tokenAt: Date.now() });
    }
  } catch { /* mất mạng: giữ token cũ */ }
  finally { _refreshing = false; }
}

/** Đọc user hiện tại không gia hạn (dùng cho save-result). */
export function peekUser() {
  const sess = _read();
  return sess?.user || null;
}

// Cho các file IIFE (không import được) dùng
if (typeof window !== 'undefined') {
  window.LearnsySession = {
    load: loadSession, save: saveSession, clear: clearSession,
    touch: touchSession, peekUser, updateUser: updateSessionUser, getToken,
    remainingMs: sessionRemainingMs, TTL_MS: SESSION_TTL_MS, consumeExpiredFlag,
  };
}
