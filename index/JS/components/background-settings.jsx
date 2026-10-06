import React from 'react';

/* ══════════════════════════════════════════════════════════════════
   BACKGROUND-SETTINGS.JS  ·  Learnsy 🌸
   - Đổi nền gradient / upload ảnh
   - 3 chế độ blur: none / 50% / 85%
   - Sync Upstash Redis (qua /api/cache có sẵn) theo student.id
   - Fallback localStorage khi offline / chưa login
   Đặt file: index/JS/components/background-settings.js
══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─── Inject keyframe for spinner icon ─── */
  (function() {
    if (document.getElementById('learnsy-bg-spin-kf')) return;
    const s = document.createElement('style');
    s.id = 'learnsy-bg-spin-kf';
    s.textContent = '@keyframes bb-spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(s);
  })();

  /* ─── Upstash key prefix ─── */
  const UP_PREFIX = 'learnsy_bg:';
  const LS_KEY_BLUR_BACKUP = 'learnsy_bg_blur_before_dark';
  const SYNC_DEBOUNCE_MS = 800;

  function lsKey(id) { return 'learnsy_bg:' + (id || 'admin'); }

  /* defaultSettings nằm inline — không phụ thuộc globals.js */
  function defaultSettings() {
    return { presetId: 'default_light', blurMode: 'none', blurPct: 0, imageDataUrl: null };
  }

  /* blurMode preset → % độ mờ tương ứng (dùng khi settings cũ chưa có blurPct) */
  function blurModeToPct(mode) {
    if (mode === 'blur50')  return 50;
    if (mode === 'blur85')  return 85;
    if (mode === 'blur100') return 100;
    return 0; // 'none' | 'off'
  }
  /* % độ mờ → blurMode preset gần nhất (dùng để tô sáng nút preset khi kéo slider) */
  function pctToBlurMode(pct) {
    if (pct <= 0)   return 'none';
    if (pct === 50) return 'blur50';
    if (pct === 85) return 'blur85';
    if (pct >= 100) return 'blur100';
    return 'custom';
  }

  function lsLoad(id) {
    try {
      const r = localStorage.getItem(lsKey(id));
      if (!r) return defaultSettings();
      const parsed = JSON.parse(r);
      if (parsed.blurPct == null) parsed.blurPct = blurModeToPct(parsed.blurMode);
      return parsed;
    }
    catch { return defaultSettings(); }
  }

  function lsSave(id, s) {
    try { localStorage.setItem(lsKey(id), JSON.stringify(s)); } catch(e) {}
  }

  /* ── Hàng chờ đồng bộ offline ──
     Khi upSave thất bại (mất mạng, Upstash lỗi...) sau khi đã hết retry,
     lưu lại bản settings đó; lần mở app kế tiếp hoặc khi có mạng trở lại (sự kiện 'online')
     sẽ tự động thử gửi lên cloud lại, tránh mất thay đổi của user. */
  function pendingSyncKey(id) { return 'learnsy_bg_pending:' + (id || 'admin'); }
  function savePendingSync(id, s) {
    try { localStorage.setItem(pendingSyncKey(id), JSON.stringify(s)); } catch(e) {}
  }
  function loadPendingSync(id) {
    try { const r = localStorage.getItem(pendingSyncKey(id)); return r ? JSON.parse(r) : null; }
    catch { return null; }
  }
  function clearPendingSync(id) {
    try { localStorage.removeItem(pendingSyncKey(id)); } catch(e) {}
  }
  const BG_PRESETS = [
    { id:'default_light', label:'Hồng nhạt',  type:'gradient',
      value:'linear-gradient(135deg,#fff5f9 0%,#fce7f3 35%,#f0f4ff 70%,#fdf2fb 100%)' },
    { id:'default_dark',  label:'Tím đêm',    type:'gradient',
      value:'linear-gradient(135deg,#120009 0%,#1a0515 35%,#0d0020 70%,#160a1a 100%)' },
    { id:'sunset',        label:'Hoàng hôn',  type:'gradient',
      value:'linear-gradient(135deg,#ffecd2 0%,#fcb69f 35%,#ff9a9e 70%,#fecfef 100%)' },
    { id:'ocean',         label:'Đại dương',  type:'gradient',
      value:'linear-gradient(135deg,#a8edea 0%,#fed6e3 50%,#a8c8fa 100%)' },
    { id:'forest',        label:'Rừng xanh',  type:'gradient',
      value:'linear-gradient(135deg,#d4fc79 0%,#96e6a1 40%,#84fab0 100%)' },
    { id:'lavender',      label:'Tím oải',    type:'gradient',
      value:'linear-gradient(135deg,#e9d5ff 0%,#ddd6fe 40%,#c4b5fd 100%)' },
    { id:'peach',         label:'Đào phấn',   type:'gradient',
      value:'linear-gradient(135deg,#ffeaa7 0%,#fab1a0 50%,#fd79a8 100%)' },
    { id:'midnight',      label:'Đêm xanh',   type:'gradient',
      value:'linear-gradient(135deg,#0f0c29 0%,#302b63 50%,#24243e 100%)' },
    { id:'rose_gold',     label:'Vàng hồng',  type:'gradient',
      value:'linear-gradient(135deg,#f8b4d9 0%,#fcd3a4 50%,#fde68a 100%)' },
    { id:'aurora',        label:'Cực quang',  type:'gradient',
      value:'linear-gradient(135deg,#43e97b 0%,#38f9d7 25%,#667eea 75%,#764ba2 100%)' },
    { id:'custom_image',  label:'Ảnh của bạn',type:'image', value:'' },
  ];

  const BLUR_MODES = [
    { id:'none',   label:'Không mờ' },
    { id:'blur50', label:'Mờ 50%'   },
    { id:'blur85', label:'Mờ 85%'   },
    { id:'blur100',label:'Mờ 100%'  },
    { id:'off',    label:'Tắt nền'  },
  ];
  const MAX_BLUR_PX = 26; // px blur ở 100%

  /* ══════════════════════════════════════════
     UPSTASH HELPERS
  ══════════════════════════════════════════ */

  /* Upstash keys */
  function upKey(studentId)    { return UP_PREFIX + studentId; }
  function upImgKey(studentId) { return UP_PREFIX + 'img:' + studentId; }

  /* Resize ảnh xuống tối đa MAX_PX px (giữ tỉ lệ) rồi trả base64 JPEG */
  const MAX_PX = 1920;
  const IMG_QUALITY = 0.92;
  function resizeImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { naturalWidth: w, naturalHeight: h } = img;
        if (w > MAX_PX || h > MAX_PX) {
          if (w >= h) { h = Math.round(h * MAX_PX / w); w = MAX_PX; }
          else        { w = Math.round(w * MAX_PX / h); h = MAX_PX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', IMG_QUALITY));
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  async function upLoad(studentId) {
    try {
      const raw = await window.upstashCmd('GET', upKey(studentId));
      if (!raw) return null;
      const meta = JSON.parse(raw);
      // Nếu preset là custom_image → load ảnh từ key riêng
      if (meta.presetId === 'custom_image') {
        try {
          const imgRaw = await window.upstashCmd('GET', upImgKey(studentId));
          if (imgRaw) meta.imageDataUrl = imgRaw;
        } catch {}
      }
      return meta;
    } catch { return null; }
  }

  /* Thử lại tối đa RETRY_ATTEMPTS lần với backoff tăng dần trước khi báo lỗi.
     Ném lỗi ở lần cuối để caller (React) biết mà cập nhật syncBadge + giữ hàng chờ offline. */
  const RETRY_ATTEMPTS = 3;
  const RETRY_BASE_MS = 600;
  async function withRetry(fn) {
    let lastErr;
    for (let i = 0; i < RETRY_ATTEMPTS; i++) {
      try { return await fn(); }
      catch (e) {
        lastErr = e;
        if (i < RETRY_ATTEMPTS - 1) {
          await new Promise(r => setTimeout(r, RETRY_BASE_MS * Math.pow(2, i)));
        }
      }
    }
    throw lastErr;
  }

  async function upSave(studentId, s) {
    const TTL = 60 * 60 * 24 * 30; // 30 ngày
    // Lưu metadata (không kèm ảnh) — kèm blurPct để giữ đúng giá trị slider tuỳ chỉnh
    const meta = { presetId: s.presetId, blurMode: s.blurMode, blurPct: s.blurPct != null ? s.blurPct : blurModeToPct(s.blurMode) };
    await withRetry(() => window.upstashCmd('SET', upKey(studentId), JSON.stringify(meta), 'EX', TTL));
    // Lưu ảnh riêng nếu có
    if (s.presetId === 'custom_image' && s.imageDataUrl) {
      await withRetry(() => window.upstashCmd('SET', upImgKey(studentId), s.imageDataUrl, 'EX', TTL));
    }
    // Không DEL upImgKey khi đổi sang preset khác — chỉ xoá khi user bấm "Xoá ảnh"
  }

  /* ── Xoá overlay cũ nếu có, tạo lại đúng ── */
  (function() {
    const old = document.getElementById('learnsy-bg-overlay');
    if (old) old.remove();
  })();

  /* ══════════════════════════════════════════
     APPLY TO DOM
  ══════════════════════════════════════════ */
  function ensureOverlay() {
    let el = document.getElementById('learnsy-bg-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'learnsy-bg-overlay';
      // z-index:2 — trên mọi wrapper React (thường z:0~1) nhưng dưới sticky header (z:60)
      // isolation:isolate ngăn stacking context của parent cắt backdrop-filter
      el.style.cssText = [
        'position:fixed','inset:0','pointer-events:none',
        'z-index:2',
        'transition:backdrop-filter 0.35s ease,-webkit-backdrop-filter 0.35s ease,background 0.35s ease',
      ].join(';');
      document.body.appendChild(el);
    }
    return el;
  }

  /* Inject style đảm bảo #root luôn trên overlay */
  (function() {
    if (document.getElementById('learnsy-bg-root-style')) return;
    const s = document.createElement('style');
    s.id = 'learnsy-bg-root-style';
    s.textContent = '#root{isolation:isolate;position:relative;z-index:3!important;}';
    document.head.appendChild(s);
  })();

  function applyBackground(s, isDarkOverride) {
    const body = document.body;
    const overlay = ensureOverlay();
    const isDark = isDarkOverride !== undefined
      ? isDarkOverride
      : (body.classList.contains('dark') || document.documentElement.classList.contains('dark'));

    /* Dark mode luôn = tắt nền, kể cả khi settings (cloud/local) còn blurMode cũ */
    if (isDark && s.blurMode !== 'off') s = { ...s, blurMode: 'off', blurPct: 0 };

    /* ── Chế độ TẮT NỀN ── */
    if (s.blurMode === 'off') {
      body.style.setProperty('background', isDark ? '#12000e' : '#fff5f9', 'important');
      body.style.removeProperty('background-attachment');
      overlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2;';
      return;
    }

    /* ── Nền gradient / ảnh ── */
    // Các preset "sáng" — khi dark mode bật sẽ tự swap sang default_dark
    const LIGHT_PRESETS = new Set(['default_light','sunset','ocean','forest','lavender','peach','rose_gold','aurora']);
    let bgValue = '';
    if (s.presetId === 'custom_image' && s.imageDataUrl) {
      bgValue = 'url(' + s.imageDataUrl + ') center/cover no-repeat fixed';
    } else {
      // custom_image nhưng chưa có ảnh (tải lỗi/chưa sync) -> dùng preset mặc định, tránh nền rỗng
      let resolvedId = s.presetId === 'custom_image' ? 'default_light' : s.presetId;
      // Nếu dark mode bật + đang dùng preset sáng → dùng dark preset thay thế
      if (isDark && LIGHT_PRESETS.has(resolvedId)) resolvedId = 'default_dark';
      const preset = BG_PRESETS.find(p => p.id === resolvedId) || BG_PRESETS[0];
      bgValue = preset.value;
    }

    /* Kỹ thuật: đặt nền + blur lên chính overlay (background + filter:blur)
       thay vì backdrop-filter — tránh bị cắt bởi stacking context của wrapper React */
    const pct = s.blurMode === 'none' ? 0 : (s.blurPct != null ? s.blurPct : blurModeToPct(s.blurMode));
    const frac = Math.max(0, Math.min(100, pct)) / 100;
    const blurPx = Math.round(frac * MAX_BLUR_PX);
    const dimLight = frac > 0 ? `rgba(255,255,255,${(frac * 0.5).toFixed(3)})` : 'transparent';
    const dimDark  = `rgba(10,0,12,${(0.32 + frac * 0.4).toFixed(3)})`;

    // body trong suốt — nền thật đặt lên overlay để blur được
    body.style.setProperty('background', 'transparent', 'important');
    body.style.removeProperty('background-attachment');

    overlay.style.cssText = [
      'position:fixed','inset:0','pointer-events:none','z-index:2',
      'transition:filter 0.35s ease,background 0.35s ease',
      // nền thật
      s.presetId === 'custom_image' && s.imageDataUrl
        ? 'background:url(' + s.imageDataUrl + ') center/cover no-repeat'
        : 'background:' + bgValue,
      'background-attachment:fixed',
      // blur bằng filter (không bị stacking context chặn)
      blurPx > 0 ? 'filter:blur(' + blurPx + 'px)' : '',
      // scale nhẹ để che viền trắng do blur
      blurPx > 0 ? 'transform:scale(1.04)' : '',
    ].filter(Boolean).join(';') + ';';

    // Lớp dim màu phủ lên trên overlay (z:2.5 không có, dùng ::after giả) → dùng box-shadow inset thay thế
    overlay.style.boxShadow = 'inset 0 0 0 100vmax ' + (isDark ? dimDark : dimLight);
  }

  /* ── Dark mode helpers ── */
  function isDarkActive() {
    return document.body.classList.contains('dark') || document.documentElement.classList.contains('dark');
  }

  /* Lưu blurMode + blurPct hiện tại trước khi dark mode ghi đè */
  function saveBlurBackup(mode, pct) {
    try {
      const p = pct != null ? pct : blurModeToPct(mode);
      localStorage.setItem(LS_KEY_BLUR_BACKUP, JSON.stringify({ mode, pct: p }));
    } catch(e) {}
  }

  /* Lấy lại {mode,pct} đã lưu; mặc định none/0 nếu chưa có.
     Tương thích ngược với backup cũ (chuỗi thô, không phải JSON). */
  function loadBlurBackup() {
    try {
      const raw = localStorage.getItem(LS_KEY_BLUR_BACKUP);
      if (!raw) return { mode:'none', pct:0 };
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch {}
      // backup cũ là chuỗi mode thuần
      return { mode: raw, pct: blurModeToPct(raw) };
    } catch { return { mode:'none', pct:0 }; }
  }

  /* Hợp nhất settings local với dữ liệu tải từ cloud.
     blurPct backfill từ blurMode nếu bản cloud cũ chưa có field này. */
  function mergeRemote(local, remote) {
    return {
      ...local,
      presetId: remote.presetId,
      blurMode: remote.blurMode,
      blurPct: remote.blurPct != null ? remote.blurPct : blurModeToPct(remote.blurMode),
      imageDataUrl: remote.imageDataUrl || local.imageDataUrl || null,
    };
  }

  /* ── Shared studentId cache — được BgSettingsCard cập nhật khi mount ── */
  let _currentSyncId = 'admin';
  window.__setBgSyncId = function(id) {
    const prev = _currentSyncId;
    _currentSyncId = id || 'admin';
    // Khi studentId được set lần đầu → sync cloud ngay
    if (id && id !== 'admin' && id !== prev && window.upstashCmd) {
      upLoad(id).then(remote => {
        if (!remote) return;
        const local = lsLoad(id);
        const merged = mergeRemote(local, remote);
        lsSave(id, merged);
        applyBackground(merged);
        window.dispatchEvent(new CustomEvent('learnsy:bg-synced', { detail: merged }));
      });
    }
  };

  /* Re-apply khi dark mode thay đổi + tự chuyển/khôi phục blurMode */
  let _prevDark = isDarkActive();
  new MutationObserver(() => {
    const nowDark = isDarkActive();
    if (nowDark === _prevDark) return; // chỉ xử lý khi thực sự thay đổi
    _prevDark = nowDark;

    const s = lsLoad(_currentSyncId);
    if (nowDark) {
      // Bật dark → lưu blurMode+blurPct hiện tại rồi ép về 'off'
      if (s.blurMode !== 'off') saveBlurBackup(s.blurMode, s.blurPct);
      const next = { ...s, blurMode: 'off', blurPct: 0 };
      lsSave(_currentSyncId, next);
      applyBackground(next, true);
      // Thông báo cho React component biết để re-render
      window.dispatchEvent(new CustomEvent('learnsy:darkmode-bg-changed', { detail: next }));
    } else {
      // Tắt dark → khôi phục blurMode+blurPct đã lưu
      const restored = loadBlurBackup();
      const next = { ...s, blurMode: restored.mode, blurPct: restored.pct };
      lsSave(_currentSyncId, next);
      applyBackground(next, false);
      window.dispatchEvent(new CustomEvent('learnsy:darkmode-bg-changed', { detail: next }));
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  // Cũng observe body
  new MutationObserver(() => {
    const nowDark = isDarkActive();
    if (nowDark === _prevDark) return;
    _prevDark = nowDark;
    const s = lsLoad(_currentSyncId);
    if (nowDark) {
      if (s.blurMode !== 'off') saveBlurBackup(s.blurMode, s.blurPct);
      const next = { ...s, blurMode: 'off', blurPct: 0 };
      lsSave(_currentSyncId, next);
      applyBackground(next, true);
      window.dispatchEvent(new CustomEvent('learnsy:darkmode-bg-changed', { detail: next }));
    } else {
      const restored = loadBlurBackup();
      const next = { ...s, blurMode: restored.mode, blurPct: restored.pct };
      lsSave(_currentSyncId, next);
      applyBackground(next, false);
      window.dispatchEvent(new CustomEvent('learnsy:darkmode-bg-changed', { detail: next }));
    }
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  /* Init ngay khi script load — apply localStorage ngay, sau đó sync Upstash nền */
  function initApply() {
    applyBackground(lsLoad(_currentSyncId));
    if (window.upstashCmd && _currentSyncId !== 'admin') {
      upLoad(_currentSyncId).then(remote => {
        if (!remote) return;
        const local = lsLoad(_currentSyncId);
        const merged = mergeRemote(local, remote);
        lsSave(_currentSyncId, merged);
        applyBackground(merged);
        window.dispatchEvent(new CustomEvent('learnsy:bg-synced', { detail: merged }));
      });
    }
  }
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', initApply)
    : initApply();

  /* ══════════════════════════════════════════
     SVG ICON HELPERS
  ══════════════════════════════════════════ */
  const ICONS = {
    picture: () => React.createElement('svg', {viewBox:'0 0 24 24',width:20,height:20,fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round',style:{display:'block',flexShrink:0}},
      React.createElement('rect',{x:3,y:3,width:18,height:18,rx:2}),
      React.createElement('circle',{cx:8.5,cy:8.5,r:1.5}),
      React.createElement('polyline',{points:'21 15 16 10 5 21'})
    ),
    sun: () => React.createElement('svg', {viewBox:'0 0 24 24',width:18,height:18,fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round',style:{display:'block'}},
      React.createElement('circle',{cx:12,cy:12,r:5}),
      React.createElement('path',{d:'M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42'})
    ),
    cloudLight: () => React.createElement('svg', {viewBox:'0 0 24 24',width:18,height:18,fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round',style:{display:'block'}},
      React.createElement('path',{d:'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z'}),
      React.createElement('path',{d:'M22 10.5a4 4 0 0 0-4-4h-.5'})
    ),
    fog: () => React.createElement('svg', {viewBox:'0 0 24 24',width:18,height:18,fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round',style:{display:'block'}},
      React.createElement('path',{d:'M3 10h18M3 14h18M5 18h14M5 6h14'})
    ),
    cloud: (w=12,h=12) => React.createElement('svg', {viewBox:'0 0 24 24',width:w,height:h,fill:'none',stroke:'currentColor',strokeWidth:2.5,strokeLinecap:'round',strokeLinejoin:'round',style:{display:'block',flexShrink:0}},
      React.createElement('path',{d:'M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z'})
    ),
    warning: () => React.createElement('svg', {viewBox:'0 0 24 24',width:12,height:12,fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round',style:{display:'block',flexShrink:0}},
      React.createElement('path',{d:'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z'}),
      React.createElement('line',{x1:12,y1:9,x2:12,y2:13}),
      React.createElement('line',{x1:12,y1:17,x2:12.01,y2:17})
    ),
    spinner: () => React.createElement('svg', {viewBox:'0 0 24 24',width:16,height:16,fill:'none',stroke:'currentColor',strokeWidth:2.5,strokeLinecap:'round',style:{display:'block',flexShrink:0,animation:'bb-spin 0.8s linear infinite'}},
      React.createElement('circle',{cx:12,cy:12,r:10,strokeOpacity:.2}),
      React.createElement('path',{d:'M12 2a10 10 0 0 1 10 10'})
    ),
    camera: (w=14,h=14) => React.createElement('svg', {viewBox:'0 0 24 24',width:w,height:h,fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round',style:{display:'block',flexShrink:0}},
      React.createElement('path',{d:'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z'}),
      React.createElement('circle',{cx:12,cy:13,r:4})
    ),
    trash: () => React.createElement('svg', {viewBox:'0 0 24 24',width:14,height:14,fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round',style:{display:'block',flexShrink:0}},
      React.createElement('polyline',{points:'3 6 5 6 21 6'}),
      React.createElement('path',{d:'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2'}),
      React.createElement('line',{x1:10,y1:11,x2:10,y2:17}),
      React.createElement('line',{x1:14,y1:11,x2:14,y2:17})
    ),
    pin: () => React.createElement('svg', {viewBox:'0 0 24 24',width:11,height:11,fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round',style:{display:'block',flexShrink:0}},
      React.createElement('path',{d:'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z'}),
      React.createElement('circle',{cx:12,cy:10,r:3})
    ),
    off: () => React.createElement('svg', {viewBox:'0 0 24 24',width:18,height:18,fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round',style:{display:'block'}},
      React.createElement('circle',{cx:12,cy:12,r:10}),
      React.createElement('line',{x1:4.93,y1:4.93,x2:19.07,y2:19.07})
    ),
    sparkle: () => React.createElement('svg', {viewBox:'0 0 24 24',width:13,height:13,fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round',style:{display:'block',flexShrink:0}},
      React.createElement('path',{d:'M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275z'})
    ),
    palette: () => React.createElement('svg', {viewBox:'0 0 24 24',width:13,height:13,fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round',style:{display:'block',flexShrink:0}},
      React.createElement('circle',{cx:13.5,cy:6.5,r:.5,fill:'currentColor'}),
      React.createElement('circle',{cx:17.5,cy:10.5,r:.5,fill:'currentColor'}),
      React.createElement('circle',{cx:8.5,cy:7.5,r:.5,fill:'currentColor'}),
      React.createElement('circle',{cx:6.5,cy:12.5,r:.5,fill:'currentColor'}),
      React.createElement('path',{d:'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z'})
    ),
  };

  /* blur icon by id */
  function blurIcon(id) {
    if (id === 'blur50')  return ICONS.cloudLight();
    if (id === 'blur85')  return ICONS.fog();
    if (id === 'blur100') return ICONS.fog();
    if (id === 'off')     return ICONS.off();
    return ICONS.sun();
  }

  /* ══════════════════════════════════════════
     REACT COMPONENT
  ══════════════════════════════════════════ */
  function BgSettingsCard({ dark, studentId }) {
    const { useState, useEffect, useRef, useCallback } = React;

    const C = dark
      ? { fg:'#fce4f0', sub:'rgba(255,200,220,0.62)', card:'rgba(255,255,255,0.07)',
          border:'rgba(244,114,182,0.2)', accent:'#f472b6', accent2:'#c084fc', div:'rgba(255,255,255,0.07)' }
      : { fg:'#2d1420', sub:'#a06080', card:'rgba(255,255,255,0.82)',
          border:'rgba(255,182,210,0.35)', accent:'#f472b6', accent2:'#a855f7', div:'rgba(0,0,0,0.05)' };

    const syncId = studentId || 'admin';

    const [settings, setSettings] = useState(() => lsLoad(syncId));
    const [syncState, setSyncState] = useState('idle'); // 'idle'|'saving'|'saved'|'error'
    const [uploading, setUploading] = useState(false);
    const fileRef   = useRef(null);
    const syncTimer = useRef(null);
    const isDirty   = useRef(false); // true chỉ khi user tự thay đổi, không phải load từ cloud

    /* Đăng ký syncId với module-level var để MutationObserver dùng đúng key */
    useEffect(() => {
      if (window.__setBgSyncId) window.__setBgSyncId(syncId);
    }, [studentId]);

    /* Lắng nghe sự kiện dark mode tự động thay đổi blurMode (do MutationObserver phát hiện đổi class DOM) */
    useEffect(() => {
      const handler = e => {
        isDirty.current = true; // dark mode đổi blurMode → cần sync
        setSettings(e.detail);
      };
      window.addEventListener('learnsy:darkmode-bg-changed', handler);
      return () => window.removeEventListener('learnsy:darkmode-bg-changed', handler);
    }, []);

    /* Bắt buộc blurMode='off' bất cứ khi nào prop `dark` là true — không phụ thuộc vào
       MutationObserver bắt được thay đổi class DOM hay chưa. Điều này tránh trường hợp
       nút bị khoá về mặt hiển thị (isLocked dựa trên `dark`) nhưng settings.blurMode/blurPct
       trong state vẫn còn giá trị cũ (ví dụ 'blur50'/50%) — dẫn tới nền vẫn bị mờ dù đã
       bật Dark Mode, và thanh trượt vẫn hiện % cũ. Cũng tự chạy đúng ngay khi mount nếu
       dark=true ngay từ đầu (MutationObserver chỉ bắt được các lần *thay đổi*, không bắt
       được trạng thái ban đầu). */
    useEffect(() => {
      if (!dark) return;
      setSettings(s => {
        if (s.blurMode === 'off') return s; // đã đúng, không cần làm gì
        saveBlurBackup(s.blurMode, s.blurPct != null ? s.blurPct : blurModeToPct(s.blurMode));
        isDirty.current = true;
        const next = { ...s, blurMode: 'off', blurPct: 0 };
        lsSave(syncId, next);
        return next;
      });
    }, [dark]);

    /* Cờ theo dõi lần trước `dark` là gì — chỉ khôi phục khi thực sự CHUYỂN từ dark→light,
       tránh ghi đè giá trị 'off' hợp lệ mà user tự chọn trong lúc đang ở light mode. */
    const prevDarkProp = useRef(dark);
    useEffect(() => {
      const wasDark = prevDarkProp.current;
      prevDarkProp.current = dark;
      if (dark || !wasDark) return; // chỉ xử lý đúng lúc chuyển dark → light
      const restored = loadBlurBackup();
      setSettings(s => {
        if (s.blurMode !== 'off') return s; // user đã tự đổi trong lúc này rồi, đừng ghi đè
        isDirty.current = true;
        const next = { ...s, blurMode: restored.mode, blurPct: restored.pct };
        lsSave(syncId, next);
        return next;
      });
    }, [dark]);

    /* Lắng nghe sync cloud từ initApply (chạy lúc page load) */
    useEffect(() => {
      const handler = e => {
        isDirty.current = false;
        setSettings(e.detail);
      };
      window.addEventListener('learnsy:bg-synced', handler);
      return () => window.removeEventListener('learnsy:bg-synced', handler);
    }, []);

    /* Load từ Upstash khi mount — KHÔNG đánh dấu dirty */
    useEffect(() => {
      if (!window.upstashCmd) return;
      upLoad(syncId).then(remote => {
        if (!remote) return;
        isDirty.current = false; // đảm bảo load cloud không trigger sync
        setSettings(local => {
          const merged = mergeRemote(local, remote);
          lsSave(syncId, merged);
          applyBackground(merged); // apply ngay không chờ useEffect
          return merged;
        });
      });
    }, [studentId]);

    /* Apply localStorage + sync cloud — CHỈ khi user thay đổi (isDirty) */
    useEffect(() => {
      lsSave(syncId, settings);
      applyBackground(settings);

      if (!window.upstashCmd || !isDirty.current) return;
      isDirty.current = false;
      clearTimeout(syncTimer.current);
      setSyncState('saving');
      syncTimer.current = setTimeout(async () => {
        try {
          await upSave(syncId, settings);
          clearPendingSync(syncId);
          setSyncState('saved');
          setTimeout(() => setSyncState('idle'), 2000);
        } catch {
          // Sau khi hết retry vẫn lỗi (thường do mất mạng) → lưu lại để tự đồng bộ khi có mạng trở lại
          savePendingSync(syncId, settings);
          setSyncState('error');
          setTimeout(() => setSyncState('idle'), 3000);
        }
      }, SYNC_DEBOUNCE_MS);
    }, [settings, studentId]);

    /* Tự động đồng bộ lại khi mạng trở lại hoặc mở lại app, nếu còn thay đổi
       chưa lưu lên cloud thành công (ví dụ do offline lúc đang gõ) */
    useEffect(() => {
      if (!window.upstashCmd) return;
      const tryFlush = async () => {
        const pending = loadPendingSync(syncId);
        if (!pending) return;
        setSyncState('saving');
        try {
          await upSave(syncId, pending);
          clearPendingSync(syncId);
          setSyncState('saved');
          setTimeout(() => setSyncState('idle'), 2000);
        } catch {
          setSyncState('error');
          setTimeout(() => setSyncState('idle'), 3000);
        }
      };
      tryFlush(); // thử ngay lúc mount (vd: mở lại app sau khi mất mạng)
      window.addEventListener('online', tryFlush);
      return () => window.removeEventListener('online', tryFlush);
    }, [syncId]);

    /* Image upload — resize về max 900px trước khi lưu */
    const handleImageUpload = useCallback(e => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) { alert('Vui lòng chọn file ảnh!'); return; }
      if (file.size > 20 * 1024 * 1024) { alert('Ảnh tối đa 20MB!'); return; }
      setUploading(true);
      const reader = new FileReader();
      reader.onload = async ev => {
        try {
          const resized = await resizeImage(ev.target.result);
          isDirty.current = true;
          setSettings(s => ({ ...s, presetId: 'custom_image', imageDataUrl: resized }));
        } catch {
          isDirty.current = true;
          setSettings(s => ({ ...s, presetId: 'custom_image', imageDataUrl: ev.target.result }));
        }
        setUploading(false);
      };
      reader.onerror = () => { setUploading(false); alert('Không đọc được file!'); };
      reader.readAsDataURL(file);
      e.target.value = '';
    }, []);

    const pickPreset = useCallback(id => {
      if (id === 'custom_image') { fileRef.current?.click(); return; }
      isDirty.current = true;
      setSettings(s => ({ ...s, presetId: id }));
    }, []);

    const pickBlur = useCallback(mode => {
      if (dark) return;
      const pct = blurModeToPct(mode);
      saveBlurBackup(mode, pct);
      isDirty.current = true;
      setSettings(s => ({ ...s, blurMode: mode, blurPct: pct }));
    }, [dark]);

    /* Kéo thanh trượt tuỳ chỉnh — cập nhật % mờ liên tục (0-100), preset tự khớp mốc gần nhất */
    const pickBlurPct = useCallback(pct => {
      if (dark) return;
      const clamped = Math.max(0, Math.min(100, Math.round(pct)));
      const mode = pctToBlurMode(clamped);
      isDirty.current = true;
      setSettings(s => ({ ...s, blurMode: mode, blurPct: clamped }));
    }, [dark]);

    /* Chỉ lưu backup + đánh dấu cần sync khi user THẢ tay khỏi slider (tránh spam trong lúc kéo) */
    const commitBlurPct = useCallback(pct => {
      const clamped = Math.max(0, Math.min(100, Math.round(pct)));
      saveBlurBackup(pctToBlurMode(clamped), clamped);
    }, []);

    const removeImage = useCallback(async () => {
      isDirty.current = true;
      setSettings(s => ({ ...s, presetId: 'default_light', imageDataUrl: null }));
      if (window.upstashCmd) {
        try { await window.upstashCmd('DEL', upImgKey(syncId)); } catch {}
      }
    }, []);

    /* ── Sync badge ── */
    const syncBadge = (() => {
      if (!window.upstashCmd) return null;
      if (syncState === 'saving') return { icon: ICONS.spinner(), label:'Đang lưu...', color: C.sub };
      if (syncState === 'saved')  return { icon: ICONS.cloud(),   label:'Đã lưu cloud', color:'#10b981' };
      if (syncState === 'error')  return { icon: ICONS.warning(), label:'Lỗi đồng bộ',  color:'#ef4444' };
      if (syncState === 'idle')   return { icon: ICONS.cloud(),   label:'Cloud sync', color: C.sub };
      return null;
    })();

    /* ── Styles helpers ── */
    const divider = { height:1, background: C.div, margin:'12px 0' };
    const sectionLabel = {
      fontFamily:"'Baloo 2',cursive", fontSize:11, fontWeight:800,
      color: C.sub, letterSpacing:'0.8px', textTransform:'uppercase', marginBottom:8,
    };

    return React.createElement('div', {
      style: {
        background: C.card, borderRadius:24, padding:'16px 18px',
        border:`1.5px solid ${C.border}`,
        animation:'bb-fadeUp .38s ease both',
      }
    },

      /* ── Header ── */
      React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:10, marginBottom:10 } },
        React.createElement('span', { style:{ animation:'bb-float 4s ease-in-out infinite', display:'inline-flex', color:C.accent } }, ICONS.picture()),
        React.createElement('div', { style:{ flex:1 } },
          React.createElement('div', { style:{ fontFamily:"'Baloo 2',cursive", fontSize:14, fontWeight:700, color:C.fg } },
            'Tùy chỉnh nền'),
          React.createElement('div', { style:{ fontSize:11, color:C.sub } }, 'Đổi nền & làm mờ'),
        ),
        syncBadge && React.createElement('div', {
          style:{ display:'flex', alignItems:'center', gap:4, fontSize:10,
            fontWeight:700, color:syncBadge.color, transition:'color .3s' }
        },
          syncBadge.icon,
          React.createElement('span', null, syncBadge.label),
        ),
      ),

      React.createElement('div', { style: divider }),

      /* ── Blur modes ── */
      React.createElement('div', { style: { ...sectionLabel, display:'flex', alignItems:'center', gap:5 } },
        ICONS.sparkle(), 'Chế độ làm mờ',
        dark && React.createElement('span', {
          style:{
            marginLeft:'auto', fontSize:10, fontWeight:700,
            color: dark ? 'rgba(244,114,182,0.55)' : 'rgba(160,96,128,0.6)',
            display:'flex', alignItems:'center', gap:3,
            background: dark ? 'rgba(244,114,182,0.1)' : 'rgba(244,114,182,0.07)',
            padding:'2px 7px', borderRadius:8,
          }
        },
          React.createElement('svg', {viewBox:'0 0 24 24',width:10,height:10,fill:'none',stroke:'currentColor',strokeWidth:2.5,strokeLinecap:'round',strokeLinejoin:'round',style:{display:'block'}},
            React.createElement('rect',{x:3,y:11,width:18,height:11,rx:2,ry:2}),
            React.createElement('path',{d:'M7 11V7a5 5 0 0 1 10 0v4'})
          ),
          'Khoá khi Dark Mode'
        ),
      ),
      React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6, marginBottom:0 } },
        BLUR_MODES.map(m => {
          const isOff = m.id === 'off';
          const isLocked = dark && !isOff; // dark mode: chỉ cho phép 'off'
          const isSel = settings.blurMode === m.id
            || (settings.blurMode === 'custom' && pctToBlurMode(settings.blurPct) === m.id);
          return React.createElement('button', {
            key: m.id,
            onClick: () => !isLocked && pickBlur(m.id),
            title: isLocked ? 'Bị khoá khi Dark Mode đang bật' : m.label,
            style: {
              flex:1, padding:'8px 4px', borderRadius:18,
              cursor: isLocked ? 'not-allowed' : 'pointer',
              border: isSel
                ? '2px solid ' + C.accent
                : '1.5px solid ' + (dark ? 'rgba(255,255,255,0.1)' : 'rgba(244,114,182,0.2)'),
              background: isLocked
                ? (dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.03)')
                : isSel
                  ? (dark ? 'rgba(244,114,182,0.2)' : 'rgba(244,114,182,0.12)')
                  : (dark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.5)'),
              color: isLocked
                ? (dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)')
                : isSel ? C.accent : C.sub,
              fontFamily:'Nunito,sans-serif', fontWeight:800, fontSize:11,
              display:'flex', flexDirection:'column', alignItems:'center', gap:4,
              transition:'all .2s cubic-bezier(.34,1.56,.64,1)',
              transform: isSel ? 'scale(1.05)' : 'scale(1)',
              boxShadow: isSel ? '0 3px 12px ' + C.accent + '33' : 'none',
              opacity: isLocked ? 0.38 : 1,
              position:'relative',
            }
          },
            React.createElement('span', { style:{ display:'inline-flex' } }, blurIcon(m.id)),
            React.createElement('span', null, m.label),
            /* Icon khoá nhỏ trên góc */
            isLocked && React.createElement('div', {
              style:{
                position:'absolute', top:3, right:4,
                opacity:0.5,
              }
            },
              React.createElement('svg', {viewBox:'0 0 24 24',width:8,height:8,fill:'none',stroke:'currentColor',strokeWidth:2.5,strokeLinecap:'round',strokeLinejoin:'round'},
                React.createElement('rect',{x:3,y:11,width:18,height:11,rx:2,ry:2}),
                React.createElement('path',{d:'M7 11V7a5 5 0 0 1 10 0v4'})
              )
            ),
          );
        })
      ),

      /* ── Thanh trượt tuỳ chỉnh độ mờ ── */
      settings.blurMode !== 'off' && React.createElement('div', { style:{ marginTop:12 } },
        React.createElement('div', {
          style:{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }
        },
          React.createElement('span', { style:{ fontSize:11, fontWeight:700, color: dark ? 'rgba(255,255,255,0.2)' : C.sub } },
            'Tùy chỉnh độ mờ'),
          React.createElement('span', { style:{ fontSize:12, fontWeight:900, color: dark ? 'rgba(255,255,255,0.2)' : C.accent } },
            (settings.blurPct != null ? settings.blurPct : blurModeToPct(settings.blurMode)) + '%'),
        ),
        React.createElement('input', {
          type: 'range', min: 0, max: 100, step: 1,
          disabled: dark,
          value: settings.blurPct != null ? settings.blurPct : blurModeToPct(settings.blurMode),
          onChange: e => pickBlurPct(Number(e.target.value)),
          onMouseUp: e => commitBlurPct(Number(e.target.value)),
          onTouchEnd: e => commitBlurPct(Number(e.target.value)),
          style: {
            width:'100%', height:4, borderRadius:999, cursor: dark ? 'not-allowed' : 'pointer',
            accentColor: C.accent, opacity: dark ? 0.35 : 1,
          },
        }),
      ),

      React.createElement('div', { style: divider }),

      /* ── Preset grid ── */
      React.createElement('div', { style: { ...sectionLabel, display:'flex', alignItems:'center', gap:5 } },
        ICONS.palette(), 'Màu & hình nền'),
      React.createElement('div', {
        style:{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8 }
      },
        BG_PRESETS.map(p => {
          const isSel = settings.presetId === p.id;
          const isCustom = p.id === 'custom_image';

          let previewCSS = {};
          if (p.type === 'gradient') {
            previewCSS.background = p.value;
          } else if (isCustom && settings.imageDataUrl) {
            previewCSS.backgroundImage = `url(${settings.imageDataUrl})`;
            previewCSS.backgroundSize = 'cover';
            previewCSS.backgroundPosition = 'center';
          } else {
            previewCSS.background = dark ? 'rgba(255,255,255,0.08)' : 'rgba(244,114,182,0.08)';
          }

          return React.createElement('button', {
            key: p.id,
            title: p.label,
            onClick: () => pickPreset(p.id),
            style: {
              aspectRatio:'1', borderRadius:18, cursor:'pointer', padding:0,
              border: isSel
                ? `2.5px solid ${C.accent}`
                : `1.5px solid ${dark?'rgba(255,255,255,0.12)':'rgba(244,114,182,0.25)'}`,
              overflow:'hidden', position:'relative',
              transition:'all .2s cubic-bezier(.34,1.56,.64,1)',
              transform: isSel ? 'scale(1.1)' : 'scale(1)',
              boxShadow: isSel ? `0 4px 14px ${C.accent}55` : 'none',
              ...previewCSS,
            }
          },
            /* Upload icon khi chưa có ảnh */
            isCustom && !settings.imageDataUrl &&
              React.createElement('span', {
                style:{ display:'flex', alignItems:'center',
                  justifyContent:'center', width:'100%', height:'100%', color:C.accent }
              }, uploading ? ICONS.spinner() : ICONS.camera(20, 20)),

            /* Checkmark khi đang chọn */
            isSel && React.createElement('div', {
              style:{ position:'absolute', inset:0, display:'flex',
                alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.22)' }
            },
              React.createElement('svg', { viewBox:'0 0 24 24', width:18, height:18, fill:'none',
                stroke:'#fff', strokeWidth:3, strokeLinecap:'round', strokeLinejoin:'round' },
                React.createElement('polyline', { points:'20 6 9 17 4 12' })
              )
            ),

            /* Label khi hover/select */
            React.createElement('div', {
              style:{
                position:'absolute', bottom:0, left:0, right:0,
                background:'rgba(0,0,0,0.5)', color:'#fff',
                fontSize:7, fontWeight:700, padding:'2px',
                textAlign:'center', fontFamily:'Nunito,sans-serif',
                opacity: isSel ? 1 : 0, transition:'opacity .2s',
              }
            }, p.label),
          );
        })
      ),

      /* ── Custom image actions ── */
      settings.presetId === 'custom_image' && settings.imageDataUrl &&
        React.createElement('div', { style:{ display:'flex', gap:8, marginTop:10 } },
          React.createElement('button', {
            onClick: () => fileRef.current?.click(),
            style:{
              flex:1, padding:'9px', borderRadius:12, cursor:'pointer',
              background:dark?'rgba(244,114,182,0.15)':'rgba(244,114,182,0.1)',
              border:`1.5px solid ${C.accent}55`, color:C.accent,
              fontWeight:800, fontSize:12, fontFamily:'Nunito,sans-serif',
              display:'flex', alignItems:'center', justifyContent:'center', gap:5,
            }
          }, ICONS.camera(), ' Đổi ảnh'),
          React.createElement('button', {
            onClick: removeImage,
            style:{
              flex:1, padding:'9px', borderRadius:12, cursor:'pointer',
              background:dark?'rgba(239,68,68,0.12)':'rgba(239,68,68,0.08)',
              border:'1.5px solid rgba(239,68,68,0.35)', color:'#ef4444',
              fontWeight:800, fontSize:12, fontFamily:'Nunito,sans-serif',
              display:'flex', alignItems:'center', justifyContent:'center', gap:5,
            }
          }, ICONS.trash(), ' Xoá ảnh'),
        ),

      /* ── Note về ảnh & cloud ── */
      settings.presetId === 'custom_image' && studentId &&
        React.createElement('div', {
          style:{ marginTop:8, fontSize:10, color:C.sub, textAlign:'center',
            fontStyle:'italic', lineHeight:1.5, display:'flex', alignItems:'center',
            justifyContent:'center', gap:4 }
        }, ICONS.pin(), 'Ảnh & cài đặt đồng bộ cloud · Resize tự động 900px'),

      /* ── Hidden file input ── */
      React.createElement('input', {
        ref: fileRef, type:'file',
        accept:'image/jpeg,image/png,image/webp,image/gif,image/avif',
        style:{ display:'none' },
        onChange: handleImageUpload,
      }),
    );
  }

  /* ══ EXPORTS ══ */
  window.BgSettingsCard    = BgSettingsCard;
  window.applyBackground   = applyBackground;
  window.loadBgSettings    = lsLoad;
  window.BG_PRESETS        = BG_PRESETS;
  window.BLUR_MODES        = BLUR_MODES;
  window.saveBlurBackup    = saveBlurBackup;
  window.loadBlurBackup    = loadBlurBackup;

})();
