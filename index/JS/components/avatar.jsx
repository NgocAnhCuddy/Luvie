import React from 'react';

(function () {
  'use strict';
  try {
    const { useState, useEffect, useCallback, useRef } = React;

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

          const megapixels = (sw * sh) / 1_000_000;
          let quality = megapixels < 1 ? 0.92 : 0.82;

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
      const mountedRef = useRef(true);

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
            const path = AVATAR_PREFIX + userId + '.jpg';
            const { data: urlData } = window.supa.storage
              .from(AVATAR_BUCKET)
              .getPublicUrl(path);
            const publicUrl = urlData.publicUrl;

            if (cancelled) return;

            setAvatarUrl(publicUrl);
            writeAvatarCache(userId, publicUrl);
            window.upstashCmd('SET', 'avatar:user:' + userId, publicUrl, 'EX', 2592000).catch(() => {});
          } catch (e) {
            console.warn('[avatar] Storage load error:', e);
          }
        })();

        return () => { cancelled = true; };
      }, [userId]);

      const uploadAvatar = useCallback(async (file) => {
        if (!userId || !file) return { ok: false, msg: 'Thiếu thông tin' };
        const targetUserId = userId; // 🔧 chốt snapshot, tránh đổi userId giữa chừng
        setLoading(true);
        try {
          const blob = await compressAvatar(file);
          /* nếu userId đã đổi khi nén xong -> hủy, không ghi vào user mới/cũ nhầm */
          if (targetUserId !== userId) return { ok: false, msg: 'Cancelled' };
          if (!mountedRef.current) return { ok: false, msg: 'Cancelled' };

          const path = AVATAR_PREFIX + targetUserId + '.jpg';
          const { error: upErr } = await window.supa.storage
            .from(AVATAR_BUCKET)
            .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
          if (upErr) throw upErr;
          if (targetUserId !== userId) return { ok: false, msg: 'Cancelled' };
          if (!mountedRef.current) return { ok: false, msg: 'Cancelled' };

          const { data: urlData } = window.supa.storage
            .from(AVATAR_BUCKET)
            .getPublicUrl(path);
          const publicUrl = urlData.publicUrl + '?t=' + Date.now();

          await window.upstashCmd('SET', 'avatar:user:' + targetUserId, publicUrl, 'EX', 2592000);
          writeAvatarCache(targetUserId, publicUrl);

          /* set state UI chỉ khi vẫn còn đang xem đúng user đó */
          if (mountedRef.current && targetUserId === userId) {
            setAvatarUrl(publicUrl);
            setLoading(false);
          } else if (mountedRef.current) {
            setLoading(false);
          }

          /* Bắn event đồng bộ — luôn bắn để các component khác (vd. danh sách
             học sinh) hiển thị đúng user vừa đổi, dù mình đã chuyển màn hình */
          window.dispatchEvent(new CustomEvent(AVATAR_EVENT, {
            detail: { userId: targetUserId, url: publicUrl }
          }));

          return { ok: true, size: blob.size };
        } catch (e) {
          if (mountedRef.current) setLoading(false);
          const msg = e.message || '';
          const friendly = msg.toLowerCase().includes('bucket')
            ? 'Lỗi storage: tạo bucket "avatars" trong Supabase nhé!'
            : msg || 'Upload thất bại, thử lại nhé!';
          return { ok: false, msg: friendly };
        }
      }, [userId]);

      const removeAvatar = useCallback(async () => {
        if (!userId) return { ok: false };
        try {
          const path = AVATAR_PREFIX + userId + '.jpg';
          const { error } = await window.supa.storage
            .from(AVATAR_BUCKET)
            .remove([path]);
          if (error) console.warn('[avatar] Supabase remove:', error.message);
          await window.upstashCmd('DEL', 'avatar:user:' + userId);
        } catch (e) {
          console.warn('[avatar] removeAvatar error:', e);
        }

        localStorage.removeItem('ls_avatar_' + userId);
        if (mountedRef.current) setAvatarUrl(null);

        window.dispatchEvent(new CustomEvent(AVATAR_EVENT, {
          detail: { userId, url: null }
        }));

        return { ok: true };
      }, [userId]);

      return { avatarUrl, loading, uploadAvatar, removeAvatar };
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
       AvatarUploader
       🔧 FIX #1: timeout cleanup + mounted guard
       🔧 FIX #2: revokeObjectURL trong finally
       🔧 FIX #5: a11y keyboard
    ══════════════════════════════════════════════════════════════════ */
    function AvatarUploader({ student, dark, avatarUrl, loading, onUpload, onRemove }) {
      const C = dark ? CD : CL;
      const fileRef = useRef();
      const [msg, setMsg] = useState(null);
      const [preview, setPreview] = useState(null);
      const [removing, setRemoving] = useState(false);
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

      const handleFile = async (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        if (!f.type.startsWith('image/')) { safeSetMsg({ ok: false, text: 'Chỉ chấp nhận file ảnh!' }); return; }
        if (f.size > 10 * 1024 * 1024) { safeSetMsg({ ok: false, text: 'Ảnh tối đa 10MB' }); return; }

        const prev = URL.createObjectURL(f);
        setPreview(prev);
        safeSetMsg(null);

        try {
          const result = await onUpload(f);
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
        e.target.value = '';
      };

      const handleRemove = async () => {
        setRemoving(true);
        safeSetMsg(null);
        await onRemove();
        if (!mountedRef.current) return;
        setRemoving(false);
        safeSetMsg({ ok: true, text: 'Đã xóa ảnh đại diện!' });
        safeTimeout(() => safeSetMsg(null), 2500);
      };

      /* 🔧 FIX #5: keyboard handler */
      const handleKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!busy && fileRef.current) fileRef.current.click();
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
            onClick={() => !busy && fileRef.current && fileRef.current.click()}
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

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="bb-btn-tap" disabled={busy}
              onClick={() => fileRef.current && fileRef.current.click()}
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