import React from 'react';
import { createPortal } from 'react-dom';

(function () {
  'use strict';
  try {
    const { useState, useEffect, useCallback, useRef, useMemo } = React;

    const CL = { card: 'rgba(255,255,255,0.82)' };
    const CD = { card: 'rgba(255,255,255,0.07)' };

    const AVATAR_BUCKET = 'avatars';
    const AVATAR_PREFIX = 'avatars/'; // 🔧 file thực tế nằm trong sub-folder cùng tên bên trong bucket
    const AVATAR_SIZE   = 256;
    const AVATAR_TTL_MS = 3600 * 1000;
    const TARGET_BYTES  = 80 * 1024;

    /* ── Cache helpers ── */
    function readAvatarCache(userId) {
      const raw = localStorage.getItem('ls_avatar_' + userId);
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.url && parsed.exp && parsed.exp > Date.now()) return parsed.url;
      } catch (e) { /* ignore */ }
      localStorage.removeItem('ls_avatar_' + userId);
      return null;
    }

    function writeAvatarCache(userId, url) {
      localStorage.setItem('ls_avatar_' + userId, JSON.stringify({ url, exp: Date.now() + AVATAR_TTL_MS - 60000 }));
    }

    /* ── Multi-avatar: tối đa 3 ảnh ──
       - avatars/{uid}_{n}.jpg  : ảnh lưu ở slot n (1..3)
       - avatars/{uid}.jpg      : bản sao của ảnh ĐANG DÙNG → các nơi khác
                                  (danh sách HS, app Android…) không cần sửa */
    const SLOT_COUNT = 3;
    const EMPTY_META = { active: null, ok: [false, false, false], v: [0, 0, 0] };
    const mainPath = (uid) => AVATAR_PREFIX + uid + '.jpg';
    const slotPath = (uid, n) => AVATAR_PREFIX + uid + '_' + n + '.jpg';

    function publicUrl(path) {
      return window.supa.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
    }
    function slotUrl(uid, n, v) {
      return publicUrl(slotPath(uid, n)) + (v ? '?t=' + v : '');
    }

    function readMeta(uid) {
      try {
        const m = JSON.parse(localStorage.getItem('ls_avatar_meta_' + uid));
        if (m && m.exp > Date.now() && Array.isArray(m.ok) && Array.isArray(m.v)) return m;
      } catch (e) { /* ignore */ }
      return null;
    }
    function writeMeta(uid, meta) {
      try {
        localStorage.setItem('ls_avatar_meta_' + uid, JSON.stringify({ ...meta, exp: Date.now() + AVATAR_TTL_MS }));
      } catch (e) { /* ignore */ }
    }
    function probeImage(url) {
      return new Promise(res => {
        const i = new Image();
        i.onload = () => res(true);
        i.onerror = () => res(false);
        i.src = url;
      });
    }
    function upstashVal(r) {
      return r && typeof r === 'object' && 'result' in r ? r.result : r;
    }

    /* Encode canvas → JPEG ≤ TARGET_BYTES (giảm dần quality) */
    function encodeJpeg(cv) {
      return new Promise((resolve, reject) => {
        let quality = 0.92;
        const tryEncode = () => {
          cv.toBlob(blob => {
            if (!blob) { reject(new Error('canvas toBlob failed')); return; }
            if (blob.size <= TARGET_BYTES || quality <= 0.40) {
              resolve(blob);
            } else {
              quality = Math.max(quality - 0.05, 0.40);
              tryEncode();
            }
          }, 'image/jpeg', quality);
        };
        tryEncode();
      });
    }

    /* ══════════════════════════════════════════════════════════════════
       🔧 FIX #2 (perf): compressAvatar – pre-scale ảnh lớn trước khi crop
    ══════════════════════════════════════════════════════════════════ */
    function compressAvatar(file) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        const objUrl = URL.createObjectURL(file);

        img.onload = () => {
          URL.revokeObjectURL(objUrl);
          let { naturalWidth: sw, naturalHeight: sh } = img;

          /* 🔧 Pre-scale: nếu ảnh > 1024px cạnh nào, thu nhỏ trước để giảm tải canvas */
          const MAX_PRE = 1024;
          let drawImg = img;
          let dw = sw, dh = sh;

          if (sw > MAX_PRE || sh > MAX_PRE) {
            const ratio = Math.min(MAX_PRE / sw, MAX_PRE / sh);
            dw = Math.round(sw * ratio);
            dh = Math.round(sh * ratio);
            const tmpCv = document.createElement('canvas');
            tmpCv.width = dw;
            tmpCv.height = dh;
            tmpCv.getContext('2d').drawImage(img, 0, 0, dw, dh);
            drawImg = tmpCv;
            sw = dw;
            sh = dh;
          }

          /* Center-crop vuông */
          const side = Math.min(sw, sh);
          const sx = (sw - side) / 2;
          const sy = (sh - side) / 2;

          const cv = document.createElement('canvas');
          cv.width = AVATAR_SIZE;
          cv.height = AVATAR_SIZE;
          cv.getContext('2d').drawImage(drawImg, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

          encodeJpeg(cv).then(resolve, reject);
        };

        img.onerror = () => { URL.revokeObjectURL(objUrl); reject(new Error('image load failed')); };
        img.src = objUrl;
      });
    }

    /* ══════════════════════════════════════════════════════════════════
       🔧 FIX #1: useAvatar – mounted guard + cleanup async
       🔧 FIX #3: CustomEvent sync giữa các component
    ══════════════════════════════════════════════════════════════════ */
    const AVATAR_EVENT = 'ls_avatar_changed';

    function useAvatar(userId) {
      const [avatarUrl, setAvatarUrl] = useState(null);
      const [loading, setLoading] = useState(false);
      const [meta, setMeta] = useState(EMPTY_META);
      const mountedRef = useRef(true);
      const userIdRef = useRef(userId);
      const metaRef = useRef(meta);
      const avatarUrlRef = useRef(null);
      userIdRef.current = userId;
      metaRef.current = meta;
      avatarUrlRef.current = avatarUrl;

      useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
      }, []);

      /* Lắng nghe event đồng bộ từ component khác */
      useEffect(() => {
        if (!userId) return;
        const handler = (e) => {
          if (e.detail && e.detail.userId === userId) {
            setAvatarUrl(e.detail.url || null);
            if (e.detail.meta) setMeta(e.detail.meta);
          }
        };
        window.addEventListener(AVATAR_EVENT, handler);
        return () => window.removeEventListener(AVATAR_EVENT, handler);
      }, [userId]);

      /* Load on mount */
      useEffect(() => {
        if (!userId) return;
        let cancelled = false;

        const cached = readAvatarCache(userId);
        if (cached) { setAvatarUrl(cached); return; }

        (async () => {
          /* 🔧 FIX: bỏ list() — RLS/search prefix trên Supabase Storage không
             đáng tin cậy với tên file dạng UUID. Dùng thẳng getPublicUrl và để
             LetterAvatar tự fallback (onError) nếu ảnh không tồn tại. */
          try {
            const url = publicUrl(mainPath(userId));

            if (cancelled) return;

            setAvatarUrl(url);
            writeAvatarCache(userId, url);
            window.upstashCmd('SET', 'avatar:user:' + userId, url, 'EX', 2592000).catch(() => {});
          } catch (e) {
            console.warn('[avatar] Storage load error:', e);
          }
        })();

        return () => { cancelled = true; };
      }, [userId]);

      /* Load danh sách 3 slot + slot đang dùng */
      useEffect(() => {
        setMeta(EMPTY_META);
        if (!userId) return;
        let cancelled = false;

        const cached = readMeta(userId);
        if (cached) { setMeta(cached); return; }

        (async () => {
          try {
            const ok = await Promise.all(
              Array.from({ length: SLOT_COUNT }, (_, i) => probeImage(slotUrl(userId, i + 1)))
            );
            let active = null;
            try {
              const a = parseInt(upstashVal(await window.upstashCmd('GET', 'avatar:active:' + userId)), 10);
              if (a >= 1 && a <= SLOT_COUNT && ok[a - 1]) active = a;
            } catch (e) { /* ignore */ }
            if (cancelled) return;
            const m = { active, ok, v: [0, 0, 0] };
            setMeta(m);
            writeMeta(userId, m);
          } catch (e) {
            console.warn('[avatar] slots load error:', e);
          }
        })();

        return () => { cancelled = true; };
      }, [userId]);

      const slots = useMemo(() => {
        if (!userId) return [];
        return Array.from({ length: SLOT_COUNT }, (_, i) => ({
          n: i + 1,
          url: meta.ok[i] ? slotUrl(userId, i + 1, meta.v[i]) : null,
        }));
      }, [userId, meta]);

      /* Ghi trạng thái mới + bắn event đồng bộ */
      const commit = (uid, url, nextMeta) => {
        writeMeta(uid, nextMeta);
        if (url) writeAvatarCache(uid, url); else localStorage.removeItem('ls_avatar_' + uid);
        if (mountedRef.current && uid === userIdRef.current) {
          setMeta(nextMeta);
          setAvatarUrl(url);
        }
        window.dispatchEvent(new CustomEvent(AVATAR_EVENT, {
          detail: { userId: uid, url, meta: nextMeta }
        }));
      };

      /* Đặt ảnh blob làm ảnh đang dùng (ghi đè avatars/{uid}.jpg) */
      const activateBlob = async (uid, blob, slot) => {
        const { error } = await window.supa.storage
          .from(AVATAR_BUCKET)
          .upload(mainPath(uid), blob, { contentType: 'image/jpeg', upsert: true });
        if (error) throw error;
        const url = publicUrl(mainPath(uid)) + '?t=' + Date.now();
        await window.upstashCmd('SET', 'avatar:user:' + uid, url, 'EX', 2592000);
        await window.upstashCmd('SET', 'avatar:active:' + uid, String(slot)).catch(() => {});
        return url;
      };

      const fetchSlotBlob = async (uid, n, v) => {
        const base = slotUrl(uid, n, v);
        const res = await fetch(base + (base.includes('?') ? '&' : '?') + 'nc=' + Date.now());
        if (!res.ok) throw new Error('Không đọc được ảnh ở ô ' + n);
        return res.blob();
      };

      /* input: File (tự center-crop) hoặc Blob đã crop từ modal; slot: 1..3 */
      const uploadAvatar = useCallback(async (input, slotArg) => {
        if (!userId || !input) return { ok: false, msg: 'Thiếu thông tin' };
        const targetUserId = userId; // 🔧 chốt snapshot, tránh đổi userId giữa chừng
        const stale = () => targetUserId !== userIdRef.current || !mountedRef.current;
        setLoading(true);
        try {
          const blob = (typeof File !== 'undefined' && input instanceof File)
            ? await compressAvatar(input)
            : input;
          if (stale()) return { ok: false, msg: 'Cancelled' };

          const m = metaRef.current;
          let slot = slotArg || m.active;
          if (!slot) { const i = m.ok.indexOf(false); slot = i === -1 ? 1 : i + 1; }

          const { error: upErr } = await window.supa.storage
            .from(AVATAR_BUCKET)
            .upload(slotPath(targetUserId, slot), blob, { contentType: 'image/jpeg', upsert: true });
          if (upErr) throw upErr;
          if (stale()) return { ok: false, msg: 'Cancelled' };

          const url = await activateBlob(targetUserId, blob, slot);

          const ok = m.ok.slice(); ok[slot - 1] = true;
          const v = m.v.slice();   v[slot - 1] = Date.now();
          if (mountedRef.current) setLoading(false);
          commit(targetUserId, url, { active: slot, ok, v });

          return { ok: true, size: blob.size, slot };
        } catch (e) {
          if (mountedRef.current) setLoading(false);
          const msg = e.message || '';
          const friendly = msg.toLowerCase().includes('bucket')
            ? 'Lỗi storage: tạo bucket "avatars" trong Supabase nhé!'
            : msg || 'Upload thất bại, thử lại nhé!';
          return { ok: false, msg: friendly };
        }
      }, [userId]);

      /* Chuyển sang ảnh ở slot n */
      const switchAvatar = useCallback(async (n) => {
        const m = metaRef.current;
        if (!userId || !m.ok[n - 1]) return { ok: false, msg: 'Ô này chưa có ảnh' };
        if (m.active === n) return { ok: true };
        const uid = userId;
        setLoading(true);
        try {
          const blob = await fetchSlotBlob(uid, n, m.v[n - 1]);
          const url = await activateBlob(uid, blob, n);
          if (mountedRef.current) setLoading(false);
          commit(uid, url, { ...metaRef.current, active: n });
          return { ok: true };
        } catch (e) {
          if (mountedRef.current) setLoading(false);
          return { ok: false, msg: e.message || 'Không đổi được ảnh, thử lại nhé!' };
        }
      }, [userId]);

      /* slot: xóa ảnh ở slot đó; bỏ trống = xóa ảnh đang dùng.
         Xóa ảnh đang dùng → tự chuyển sang ảnh còn lại (nếu có). */
      const removeAvatar = useCallback(async (slotArg) => {
        if (!userId) return { ok: false };
        const uid = userId;
        const m = metaRef.current;
        const slot = typeof slotArg === 'number' ? slotArg : m.active;
        const ok = m.ok.slice();
        const v = m.v.slice();
        let active = m.active;
        let url = null;

        try {
          const sb = window.supa.storage.from(AVATAR_BUCKET);

          if (slot) {
            const { error } = await sb.remove([slotPath(uid, slot)]);
            if (error) console.warn('[avatar] Supabase remove:', error.message);
            ok[slot - 1] = false;
          }

          const removingActive = !slot || slot === m.active;
          if (removingActive) {
            const nextIdx = ok.indexOf(true);
            if (nextIdx !== -1) {
              /* còn ảnh khác → chuyển sang ảnh đó */
              const next = nextIdx + 1;
              const blob = await fetchSlotBlob(uid, next, v[nextIdx]);
              url = await activateBlob(uid, blob, next);
              active = next;
            } else {
              const { error } = await sb.remove([mainPath(uid)]);
              if (error) console.warn('[avatar] Supabase remove:', error.message);
              await window.upstashCmd('DEL', 'avatar:user:' + uid);
              await window.upstashCmd('DEL', 'avatar:active:' + uid).catch(() => {});
              active = null;
              url = null;
            }
          } else {
            url = mountedRef.current && uid === userIdRef.current ? avatarUrlRef.current : null;
          }
        } catch (e) {
          console.warn('[avatar] removeAvatar error:', e);
        }

        commit(uid, url, { active, ok, v });
        return { ok: true };
      }, [userId]);

      return { avatarUrl, loading, uploadAvatar, removeAvatar, switchAvatar, slots, activeSlot: meta.active };
    }

    /* ══════════════════════════════════════════════════════════════════
       LetterAvatar (giữ nguyên, thêm 🔧 FIX #5: a11y)
    ══════════════════════════════════════════════════════════════════ */
    function LetterAvatar({ name = '?', size = 64, dark, animate = false, avatarUrl = null }) {
      const [imgOk, setImgOk] = useState(!!avatarUrl);
      const [retryCount, setRetryCount] = useState(0);
      const [retryUrl, setRetryUrl] = useState(avatarUrl);
      const retryTimerRef = useRef(null);

      const MAX_RETRIES = 3;
      const RETRY_DELAYS = [600, 1500, 3000];

      useEffect(() => {
        setImgOk(!!avatarUrl);
        setRetryCount(0);
        setRetryUrl(avatarUrl);
        return () => { if (retryTimerRef.current) clearTimeout(retryTimerRef.current); };
      }, [avatarUrl]);

      const handleError = useCallback(() => {
        if (!avatarUrl) return;
        setRetryCount(c => {
          if (c >= MAX_RETRIES) { setImgOk(false); return c; }
          const delay = RETRY_DELAYS[c] || 3000;
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
          retryTimerRef.current = setTimeout(() => {
            const sep = avatarUrl.includes('?') ? '&' : '?';
            setRetryUrl(avatarUrl + sep + '_r=' + Date.now());
          }, delay);
          return c + 1;
        });
      }, [avatarUrl]);

      const initials = (name || '?').trim().split(' ').filter(Boolean)
        .slice(0, 2).map(w => w[0].toUpperCase()).join('');
      const hue = ((name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 37) % 360;
      const bg = 'hsl(' + hue + ',55%,' + (dark ? '38%' : '68%') + ')';

      const base = {
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        boxShadow: '0 4px 20px hsl(' + hue + ',55%,50%,0.45),inset 0 -3px 0 rgba(0,0,0,0.12)',
        animation: animate ? 'bb-heartbeat 2.5s ease-in-out infinite' : 'none',
        overflow: 'hidden', userSelect: 'none',
      };

      if (avatarUrl && imgOk) {
        return (
          <div style={{ ...base, background: bg }}>
            <img src={retryUrl} alt={name}
              onError={handleError}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        );
      }
      return (
        <div style={{
          ...base, background: bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.38, fontWeight: 900, color: '#fff', letterSpacing: '-1px',
          fontFamily: "'Baloo 2',cursive",
        }}>{initials}</div>
      );
    }

    /* ══════════════════════════════════════════════════════════════════
       AvatarCropModal — kéo để dời, thanh trượt / chụm 2 ngón / cuộn chuột để zoom
       Preview và ảnh xuất ra dùng chung 1 phép vẽ → thấy gì cắt nấy.
    ══════════════════════════════════════════════════════════════════ */
    function AvatarCropModal({ file, dark, onCancel, onConfirm }) {
      const STAGE = 280;      // kích thước khung (CSS px)
      const PREV_PX = 560;    // canvas preview (2x cho nét)
      const MAX_Z = 4;
      const MAX_PRE = 1024;

      const canvasRef = useRef(null);
      const srcRef = useRef(null);                 // { el, w, h }
      const stRef = useRef({ z: 1, cx: 0, cy: 0 }); // cx, cy: điểm ảnh nằm giữa khung
      const ptrsRef = useRef(new Map());
      const pinchRef = useRef(null);
      const [ready, setReady] = useState(false);
      const [zoom, setZoomState] = useState(1);
      const [err, setErr] = useState(null);
      const [busy, setBusy] = useState(false);

      const clamp = (x, a, b) => Math.min(Math.max(x, a), b);

      const halfView = () => {
        const { w, h } = srcRef.current;
        return Math.min(w, h) / (2 * stRef.current.z);
      };

      const fixPos = () => {
        const { w, h } = srcRef.current;
        const half = halfView();
        const st = stRef.current;
        st.cx = clamp(st.cx, half, w - half);
        st.cy = clamp(st.cy, half, h - half);
      };

      const drawTo = (cv, size) => {
        const src = srcRef.current;
        if (!src) return;
        const ctx = cv.getContext('2d');
        const half = halfView();
        const { cx, cy } = stRef.current;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(src.el, cx - half, cy - half, half * 2, half * 2, 0, 0, size, size);
      };

      const redraw = () => { if (canvasRef.current) drawTo(canvasRef.current, PREV_PX); };

      const setZ = (z) => {
        stRef.current.z = clamp(z, 1, MAX_Z);
        fixPos();
        redraw();
        setZoomState(stRef.current.z);
      };

      /* Load ảnh (pre-scale nếu > 1024px) */
      useEffect(() => {
        let dead = false;
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          if (dead) return;
          let el = img, w = img.naturalWidth, h = img.naturalHeight;
          if (w > MAX_PRE || h > MAX_PRE) {
            const r = Math.min(MAX_PRE / w, MAX_PRE / h);
            const cv = document.createElement('canvas');
            cv.width = Math.round(w * r);
            cv.height = Math.round(h * r);
            cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
            el = cv; w = cv.width; h = cv.height;
          }
          srcRef.current = { el, w, h };
          stRef.current = { z: 1, cx: w / 2, cy: h / 2 };
          setReady(true);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          if (!dead) setErr('Không đọc được ảnh này. Thử ảnh JPG hoặc PNG nhé!');
        };
        img.src = url;
        return () => { dead = true; };
      }, [file]);

      useEffect(() => { if (ready) redraw(); }, [ready]);

      /* Khóa scroll nền + phím Esc */
      useEffect(() => {
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
        window.addEventListener('keydown', onKey);
        return () => {
          document.body.style.overflow = prevOverflow;
          window.removeEventListener('keydown', onKey);
        };
      }, []);

      /* ── Pointer: 1 ngón = kéo, 2 ngón = chụm zoom ── */
      const dist = () => {
        const [a, b] = Array.from(ptrsRef.current.values());
        return Math.hypot(a.x - b.x, a.y - b.y) || 1;
      };
      const onPointerDown = (e) => {
        if (!ready) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        ptrsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (ptrsRef.current.size === 2) pinchRef.current = { d: dist(), z: stRef.current.z };
      };
      const onPointerMove = (e) => {
        const prev = ptrsRef.current.get(e.pointerId);
        if (!prev || !ready) return;
        const cur = { x: e.clientX, y: e.clientY };
        ptrsRef.current.set(e.pointerId, cur);
        if (ptrsRef.current.size === 1) {
          const pxPerImg = STAGE / (2 * halfView());
          stRef.current.cx -= (cur.x - prev.x) / pxPerImg;
          stRef.current.cy -= (cur.y - prev.y) / pxPerImg;
          fixPos();
          redraw();
        } else if (ptrsRef.current.size === 2 && pinchRef.current) {
          setZ(pinchRef.current.z * (dist() / pinchRef.current.d));
        }
      };
      const onPointerEnd = (e) => {
        ptrsRef.current.delete(e.pointerId);
        pinchRef.current = null;
      };
      const onWheel = (e) => { if (ready) setZ(stRef.current.z * (1 - e.deltaY * 0.0015)); };

      const confirm = async () => {
        if (!ready || busy) return;
        setBusy(true);
        try {
          const cv = document.createElement('canvas');
          cv.width = cv.height = AVATAR_SIZE;
          drawTo(cv, AVATAR_SIZE);
          const blob = await encodeJpeg(cv);
          onConfirm(blob);
        } catch (e) {
          setErr('Không xử lý được ảnh, thử lại nhé!');
          setBusy(false);
        }
      };

      const txt = dark ? '#f5f3ff' : '#3b0764';
      const sub = dark ? 'rgba(245,243,255,0.6)' : 'rgba(59,7,100,0.6)';

      return createPortal(
        <div role="dialog" aria-modal="true" aria-label="Cắt ảnh đại diện"
          onClick={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(15,5,30,0.62)', backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}>
          <div style={{
            width: 'min(100%, 340px)', borderRadius: 24, padding: '18px 18px 16px',
            background: dark ? '#1e1830' : '#ffffff',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
            fontFamily: 'Nunito,sans-serif', animation: 'bb-pop .2s ease both',
          }}>
            <div style={{ fontWeight: 900, fontSize: 16, color: txt }}>Cắt ảnh đại diện</div>

            <div
              onPointerDown={onPointerDown} onPointerMove={onPointerMove}
              onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd}
              onWheel={onWheel}
              style={{
                position: 'relative', width: STAGE, height: STAGE, borderRadius: 16,
                overflow: 'hidden', touchAction: 'none', cursor: ready ? 'grab' : 'default',
                background: dark ? '#0f0a1d' : '#f3e8ff', userSelect: 'none',
              }}>
              <canvas ref={canvasRef} width={PREV_PX} height={PREV_PX}
                style={{ width: STAGE, height: STAGE, display: 'block', opacity: ready ? 1 : 0 }} />
              {ready && (
                <>
                  <div style={{
                    position: 'absolute', inset: 0, pointerEvents: 'none',
                    background: 'radial-gradient(circle closest-side, transparent 99%, rgba(0,0,0,0.55) 100%)',
                  }} />
                  <div style={{
                    position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.9)', boxSizing: 'border-box',
                  }} />
                </>
              )}
              {!ready && !err && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 13, fontWeight: 700, color: sub,
                }}>Đang tải ảnh…</div>
              )}
            </div>

            <div style={{ width: STAGE, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span aria-hidden="true" style={{ color: sub, fontWeight: 900, fontSize: 16, lineHeight: 1 }}>−</span>
              <input type="range" min="1" max={MAX_Z} step="0.01" value={zoom}
                disabled={!ready || busy} aria-label="Thu phóng"
                onChange={(e) => setZ(parseFloat(e.target.value))}
                style={{ flex: 1, accentColor: '#a855f7' }} />
              <span aria-hidden="true" style={{ color: sub, fontWeight: 900, fontSize: 16, lineHeight: 1 }}>+</span>
            </div>

            <div style={{ fontSize: 12, fontWeight: 600, color: err ? '#ef4444' : sub, textAlign: 'center', minHeight: 16 }}>
              {err || 'Kéo để di chuyển, chụm hoặc kéo thanh trượt để phóng to'}
            </div>

            <div style={{ display: 'flex', gap: 10, width: '100%' }}>
              <button type="button" className="bb-btn-tap" onClick={onCancel} disabled={busy}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 99, cursor: 'pointer',
                  border: '1.5px solid ' + (dark ? 'rgba(255,255,255,0.18)' : 'rgba(168,85,247,0.35)'),
                  background: 'transparent', color: txt, fontWeight: 800, fontSize: 13,
                  fontFamily: 'Nunito,sans-serif',
                }}>Hủy</button>
              <button type="button" className="bb-btn-tap" onClick={confirm} disabled={!ready || busy}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 99, border: 'none',
                  cursor: ready && !busy ? 'pointer' : 'default',
                  background: 'linear-gradient(135deg,#f472b6,#a855f7)', color: '#fff',
                  fontWeight: 800, fontSize: 13, fontFamily: 'Nunito,sans-serif',
                  boxShadow: '0 3px 12px rgba(244,114,182,0.4)',
                  opacity: !ready || busy ? 0.6 : 1,
                }}>{busy ? 'Đang xử lý…' : 'Dùng ảnh này'}</button>
            </div>
          </div>
        </div>,
        document.body
      );
    }

    /* ══════════════════════════════════════════════════════════════════
       AvatarUploader
       🔧 FIX #1: timeout cleanup + mounted guard
       🔧 FIX #2: revokeObjectURL trong finally
       🔧 FIX #5: a11y keyboard
    ══════════════════════════════════════════════════════════════════ */
    function AvatarUploader({ student, dark, avatarUrl, loading, onUpload, onRemove, slots, activeSlot, onSwitch }) {
      const C = dark ? CD : CL;
      const fileRef = useRef();
      const [msg, setMsg] = useState(null);
      const [preview, setPreview] = useState(null);
      const [removing, setRemoving] = useState(false);
      const [cropReq, setCropReq] = useState(null); // { file, slot }
      const pickSlotRef = useRef(undefined);
      const mountedRef = useRef(true);
      const timersRef = useRef([]);

      useEffect(() => {
        mountedRef.current = true;
        return () => {
          mountedRef.current = false;
          timersRef.current.forEach(clearTimeout);
          timersRef.current = [];
        };
      }, []);

      /* Inject hover CSS — dùng ref-count vì style này dùng chung, có thể
         có nhiều AvatarUploader mount cùng lúc (danh sách học sinh) */
      useEffect(() => {
        let styleEl = document.getElementById('ls-av-style');
        if (!styleEl) {
          styleEl = document.createElement('style');
          styleEl.id = 'ls-av-style';
          styleEl.textContent = '.ls-av-overlay:hover{opacity:1!important}';
          styleEl.dataset.refCount = '0';
          document.head.appendChild(styleEl);
        }
        styleEl.dataset.refCount = String(Number(styleEl.dataset.refCount || '0') + 1);
        return () => {
          const el = document.getElementById('ls-av-style');
          if (!el) return;
          const next = Number(el.dataset.refCount || '1') - 1;
          if (next <= 0) {
            el.remove();
          } else {
            el.dataset.refCount = String(next);
          }
        };
      }, []);

      const safeSetMsg = (m) => { if (mountedRef.current) setMsg(m); };
      const safeTimeout = (fn, ms) => {
        const id = setTimeout(() => {
          timersRef.current = timersRef.current.filter(t => t !== id);
          if (mountedRef.current) fn();
        }, ms);
        timersRef.current.push(id);
      };

      /* 🔧 FIX #2 (v2): revoke blob URL qua cleanup effect, không phải finally —
         tránh thu hồi URL khi <img> có thể chưa kịp vẽ xong frame preview cũ */
      const prevPreviewRef = useRef(null);
      useEffect(() => {
        if (prevPreviewRef.current && prevPreviewRef.current !== preview) {
          URL.revokeObjectURL(prevPreviewRef.current);
        }
        prevPreviewRef.current = preview;
      }, [preview]);
      useEffect(() => {
        return () => { if (prevPreviewRef.current) URL.revokeObjectURL(prevPreviewRef.current); };
      }, []);

      /* Ô mặc định khi bấm "Đổi ảnh": thay ảnh đang dùng; chưa có thì ô trống đầu tiên */
      const defaultSlot = () => {
        if (!slots) return undefined;
        if (activeSlot) return activeSlot;
        const empty = slots.find(s => !s.url);
        return empty ? empty.n : 1;
      };

      const openPicker = (slot) => {
        if (busy || !fileRef.current) return;
        pickSlotRef.current = slot;
        fileRef.current.click();
      };

      const handleFile = (e) => {
        const f = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!f) return;
        if (!f.type.startsWith('image/')) { safeSetMsg({ ok: false, text: 'Chỉ chấp nhận file ảnh!' }); return; }
        if (f.size > 10 * 1024 * 1024) { safeSetMsg({ ok: false, text: 'Ảnh tối đa 10MB' }); return; }
        safeSetMsg(null);
        setCropReq({ file: f, slot: pickSlotRef.current });
      };

      const handleCropConfirm = async (blob) => {
        const slot = cropReq ? cropReq.slot : undefined;
        setCropReq(null);
        setPreview(URL.createObjectURL(blob));
        safeSetMsg(null);

        try {
          const result = await onUpload(blob, slot);
          if (!mountedRef.current) return;
          setPreview(null);
          if (result.ok) {
            const kb = result.size ? Math.round(result.size / 1024) : null;
            safeSetMsg({ ok: true, text: 'Cập nhật thành công!' + (kb ? ' (' + kb + ' KB)' : '') });
          } else {
            safeSetMsg({ ok: false, text: result.msg || 'Thất bại, thử lại nhé!' });
          }
        } catch (err) {
          if (!mountedRef.current) return;
          setPreview(null);
          safeSetMsg({ ok: false, text: 'Lỗi bất ngờ, thử lại nhé!' });
        }
        /* revoke được xử lý bởi effect ở trên khi preview đổi/unmount */

        safeTimeout(() => safeSetMsg(null), 3000);
      };

      const handleSwitch = async (n) => {
        if (busy || !onSwitch || n === activeSlot) return;
        safeSetMsg(null);
        const result = await onSwitch(n);
        if (!mountedRef.current) return;
        safeSetMsg(result && result.ok
          ? { ok: true, text: 'Đã đổi ảnh đại diện!' }
          : { ok: false, text: (result && result.msg) || 'Không đổi được ảnh, thử lại nhé!' });
        safeTimeout(() => safeSetMsg(null), 2500);
      };

      const handleRemove = async () => {
        setRemoving(true);
        safeSetMsg(null);
        await onRemove(activeSlot || undefined);
        if (!mountedRef.current) return;
        setRemoving(false);
        safeSetMsg({ ok: true, text: slots && slots.some(s => s.url) ? 'Đã xóa ảnh!' : 'Đã xóa ảnh đại diện!' });
        safeTimeout(() => safeSetMsg(null), 2500);
      };

      /* 🔧 FIX #5: keyboard handler */
      const handleKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openPicker(defaultSlot());
        }
      };

      const displayUrl = preview || avatarUrl;
      const busy = loading || removing;

      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '16px 0 8px' }}>

          {/* 🔧 FIX #5: thêm role, tabIndex, onKeyDown */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Đổi ảnh đại diện"
            onKeyDown={handleKeyDown}
            style={{ position: 'relative', cursor: 'pointer', outline: 'none' }}
            onClick={() => openPicker(defaultSlot())}
          >
            <LetterAvatar
              name={student?.display_name || student?.username}
              size={84} dark={dark} animate
              avatarUrl={displayUrl}
            />

            <div className="ls-av-overlay" style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'rgba(0,0,0,0.38)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: busy ? 1 : 0, transition: 'opacity .2s',
            }}>
              {busy
                ? <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff"
                    strokeWidth="2" strokeLinecap="round"
                    style={{ animation: 'bb-spin 1s linear infinite' }}>
                    <path d="M12 2a10 10 0 1 0 10 10" />
                  </svg>
                : <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
              }
            </div>

            {!busy && (
              <div style={{
                position: 'absolute', bottom: 2, right: 2,
                width: 26, height: 26, borderRadius: '50%',
                background: 'linear-gradient(135deg,#f472b6,#a855f7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(244,114,182,0.5)',
                border: '2px solid ' + C.card,
              }}>
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*"
            style={{ display: 'none' }} onChange={handleFile} />

          {slots && slots.length > 0 && (
            <div role="group" aria-label="Ảnh đại diện đã lưu"
              style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {slots.map(sl => {
                const isActive = activeSlot === sl.n;
                return (
                  <button key={sl.n} type="button" className="bb-btn-tap" disabled={busy}
                    aria-label={sl.url ? 'Dùng ảnh ' + sl.n : 'Thêm ảnh vào ô ' + sl.n}
                    aria-pressed={sl.url ? isActive : undefined}
                    onClick={() => (sl.url ? handleSwitch(sl.n) : openPicker(sl.n))}
                    style={{
                      width: 46, height: 46, padding: 0, borderRadius: '50%',
                      overflow: 'hidden', cursor: busy ? 'default' : 'pointer',
                      background: sl.url ? 'transparent' : 'rgba(168,85,247,0.08)',
                      border: isActive
                        ? '2.5px solid #a855f7'
                        : sl.url ? '2px solid rgba(168,85,247,0.25)' : '2px dashed rgba(168,85,247,0.45)',
                      boxShadow: isActive ? '0 0 0 3px rgba(168,85,247,0.22)' : 'none',
                      opacity: busy ? 0.6 : 1, transition: 'box-shadow .2s, border-color .2s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                    {sl.url
                      ? <img src={sl.url} alt="" draggable={false}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      : <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#a855f7"
                          strokeWidth="2.5" strokeLinecap="round">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>}
                  </button>
                );
              })}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="bb-btn-tap" disabled={busy}
              onClick={() => openPicker(defaultSlot())}
              style={{
                padding: '7px 16px', borderRadius: 99, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg,#f472b6,#a855f7)',
                color: '#fff', fontWeight: 800, fontSize: 12,
                boxShadow: '0 3px 12px rgba(244,114,182,0.4)',
                fontFamily: 'Nunito,sans-serif', opacity: busy ? 0.6 : 1,
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 16 12 12 8 16" />
                <line x1="12" y1="12" x2="12" y2="21" />
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
              </svg>
              {loading ? 'Đang tải...' : 'Đổi ảnh'}
            </button>

            {avatarUrl && !busy && (
              <button className="bb-btn-tap" onClick={handleRemove}
                style={{
                  padding: '7px 14px', borderRadius: 99,
                  border: '1.5px solid rgba(239,68,68,0.4)',
                  background: 'rgba(239,68,68,0.08)',
                  color: '#ef4444', fontWeight: 700, fontSize: 12,
                  cursor: 'pointer', fontFamily: 'Nunito,sans-serif',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#ef4444"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4h6v2" />
                </svg>
                Xóa
              </button>
            )}

            {removing && (
              <span style={{ fontSize: 11, color: '#ef4444', fontFamily: 'Nunito,sans-serif' }}>
                Đang xóa…
              </span>
            )}
          </div>

          {msg && (
            <div style={{
              fontSize: 12, fontWeight: 700, padding: '5px 14px', borderRadius: 99,
              background: msg.ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
              color: msg.ok ? '#10b981' : '#ef4444',
              border: '1px solid ' + (msg.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'),
              animation: 'bb-pop .2s ease both',
            }}>{msg.text}</div>
          )}

          {cropReq && (
            <AvatarCropModal file={cropReq.file} dark={dark}
              onCancel={() => setCropReq(null)}
              onConfirm={handleCropConfirm} />
          )}
        </div>
      );
    }

    window.useAvatar = useAvatar;
    window.LetterAvatar = LetterAvatar;
    window.AvatarUploader = AvatarUploader;

  } catch (e) {
    console.error('[avatar] INIT ERROR:', e);
  }
})();