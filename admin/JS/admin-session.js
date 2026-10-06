/* ══════════════════════════════════════════════════════════════════
   ADMIN-SESSION.JS · Phiên đăng nhập admin — tự thoát sau 72h không dùng
   ─────────────────────────────────────────────────────────────────
   Trước đây admin lưu cờ 'learnsy_admin_auth' = '1' vĩnh viễn nên máy
   dùng chung/máy bị mất vẫn mở được trang quản trị mãi mãi.
   Nay lưu mốc thời gian hoạt động cuối; quá 72h → yêu cầu đăng nhập lại.
   Tương thích ngược: cờ cũ '1' được nâng cấp thành phiên mới (1 lần).
   ══════════════════════════════════════════════════════════════════ */

export const ADMIN_TTL_MS = 72 * 60 * 60 * 1000;
const KEY = 'learnsy_admin_auth';       // giữ nguyên tên khóa cũ
const THROTTLE_MS = 60 * 1000;

let _lastWrite = 0;
let _stop = null;

function _read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    if (raw === '1') {                  // cờ đời cũ → nâng cấp
      const now = Date.now();
      const sess = { lastActive: now, createdAt: now };
      localStorage.setItem(KEY, JSON.stringify(sess));
      return sess;
    }
    const sess = JSON.parse(raw);
    return sess && typeof sess === 'object' ? sess : null;
  } catch { return null; }
}

export function isAdminAuthed() {
  const s = _read();
  if (!s) return false;
  const idle = Date.now() - Number(s.lastActive || 0);
  if (!Number.isFinite(idle) || idle > ADMIN_TTL_MS || idle < -ADMIN_TTL_MS) {
    try { localStorage.removeItem(KEY); } catch {}
    return false;
  }
  return true;
}

export function adminLogin() {
  const now = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify({ lastActive: now, createdAt: now })); } catch {}
  _lastWrite = now;
}

export function adminLogout() {
  try { localStorage.removeItem(KEY); } catch {}
}

function touch(force = false) {
  const now = Date.now();
  if (!force && now - _lastWrite < THROTTLE_MS) return;
  const s = _read();
  if (!s) return;
  _lastWrite = now;
  try { localStorage.setItem(KEY, JSON.stringify({ ...s, lastActive: now })); } catch {}
}

/** Theo dõi hoạt động; gọi onExpire() khi phải đăng xuất. Trả về hàm dừng. */
export function watchAdminSession(onExpire) {
  if (_stop) _stop();
  const onAct = () => touch();
  const check = () => {
    const s = _read();
    if (!s) return;
    if (Date.now() - Number(s.lastActive || 0) > ADMIN_TTL_MS) {
      adminLogout();
      onExpire('expired');
    }
  };
  const onVis = () => { if (document.visibilityState === 'visible') { check(); touch(true); } };
  const onStorage = (e) => { if (e.key === KEY && e.newValue === null) onExpire('other-tab'); };

  const evs = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
  evs.forEach(ev => window.addEventListener(ev, onAct, { passive: true }));
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('focus', onVis);
  window.addEventListener('storage', onStorage);
  const timer = setInterval(check, 60 * 1000);
  check(); touch(true);

  _stop = () => {
    evs.forEach(ev => window.removeEventListener(ev, onAct));
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('focus', onVis);
    window.removeEventListener('storage', onStorage);
    clearInterval(timer);
    _stop = null;
  };
  return _stop;
}
