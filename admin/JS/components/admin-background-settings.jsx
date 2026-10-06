import React from 'react';

/* ══════════════════════════════════════════════════════════════════
   ADMIN-BACKGROUND-SETTINGS.JSX  ·  Learnsy Admin 🛠️
   - Độc lập hoàn toàn với background-settings.js (student)
   - localStorage key riêng: learnsy_admin_bg
   - Upstash key riêng: learnsy_bg:admin_panel (không trùng student)
   - Overlay ID riêng: learnsy-admin-bg-overlay
   - Exports riêng: AdminBgSettingsCard, adminApplyBackground, ...
   Đặt file: admin/JS/components/admin-background-settings.jsx
══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─── Inject keyframe for spinner icon ─── */
  (function() {
    if (document.getElementById('admin-bg-spin-kf')) return;
    const s = document.createElement('style');
    s.id = 'admin-bg-spin-kf';
    s.textContent = '@keyframes admin-bg-spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(s);
  })();

  /* ─── Constants ─── */
  const LS_KEY         = 'learnsy_admin_bg';
  const LS_BLUR_BACKUP = 'learnsy_admin_bg_blur_before_dark';
  const OVERLAY_ID     = 'learnsy-admin-bg-overlay';
  const ROOT_STYLE_ID  = 'learnsy-admin-bg-root-style';
  const SYNC_DEBOUNCE_MS = 800;

  /* ─── Upstash helpers — key cố định cho admin, không theo studentId ─── */
  const UP_KEY     = 'learnsy_bg:admin_panel';
  const UP_IMG_KEY = 'learnsy_bg:img:admin_panel';

  async function upLoad() {
    try {
      if (!window.upstashCmd) return null;
      const raw = await window.upstashCmd('GET', UP_KEY);
      if (!raw) return null;
      const meta = JSON.parse(raw);
      if (meta.presetId === 'custom_image') {
        try {
          const imgRaw = await window.upstashCmd('GET', UP_IMG_KEY);
          if (imgRaw) meta.imageDataUrl = imgRaw;
        } catch {}
      }
      return meta;
    } catch { return null; }
  }

  /* Thử lại tối đa RETRY_ATTEMPTS lần với backoff tăng dần trước khi báo lỗi.
     Ném lỗi ở lần cuối để caller (React) biết mà cập nhật syncBadge + lưu hàng chờ offline. */
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

  async function upSave(s) {
    if (!window.upstashCmd) return;
    const TTL = 60 * 60 * 24 * 30; // 30 ngày
    const meta = { presetId: s.presetId, blurMode: s.blurMode };
    await withRetry(() => window.upstashCmd('SET', UP_KEY, JSON.stringify(meta), 'EX', TTL));
    if (s.presetId === 'custom_image' && s.imageDataUrl) {
      await withRetry(() => window.upstashCmd('SET', UP_IMG_KEY, s.imageDataUrl, 'EX', TTL));
    } else {
      await withRetry(() => window.upstashCmd('DEL', UP_IMG_KEY));
    }
  }

  /* ─── localStorage helpers ─── */
  function adminDefaultSettings() {
    return { presetId: 'default_light', blurMode: 'none', imageDataUrl: null };
  }

  function lsLoad() {
    try {
      const r = localStorage.getItem(LS_KEY);
      return r ? JSON.parse(r) : adminDefaultSettings();
    } catch { return adminDefaultSettings(); }
  }

  function lsSave(s) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch(e) {}
  }

  /* ── Hàng chờ đồng bộ offline ──
     Khi upSave thất bại (mất mạng, Upstash lỗi...) sau khi đã hết retry,
     lưu lại bản settings đó; lần mở app kế tiếp hoặc khi có mạng trở lại (sự kiện 'online')
     sẽ tự động thử gửi lên cloud lại, tránh mất thay đổi của admin. */
  const LS_PENDING_SYNC = 'learnsy_admin_bg_pending';
  function savePendingSync(s) {
    try { localStorage.setItem(LS_PENDING_SYNC, JSON.stringify(s)); } catch(e) {}
  }
  function loadPendingSync() {
    try { const r = localStorage.getItem(LS_PENDING_SYNC); return r ? JSON.parse(r) : null; }
    catch { return null; }
  }
  function clearPendingSync() {
    try { localStorage.removeItem(LS_PENDING_SYNC); } catch(e) {}
  }

  /* ─── Presets — bộ preset phù hợp giao diện admin (tối/chuyên nghiệp hơn) ─── */
  const ADMIN_BG_PRESETS = [
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

  const ADMIN_BLUR_MODES = [
    { id:'none',   label:'Không mờ' },
    { id:'blur50', label:'Mờ 50%'   },
    { id:'blur85', label:'Mờ 85%'   },
    { id:'custom', label:'Tuỳ chỉnh'},
    { id:'off',    label:'Tắt nền'  },
  ];

  /* Parse mức mờ % từ blurMode. Hỗ trợ 'none'|'blur50'|'blur85'|'off'|'customNN' (NN=0-100) */
  function parseBlurPercent(blurMode) {
    if (blurMode === 'off' || blurMode === 'none') return 0;
    if (blurMode === 'blur50') return 50;
    if (blurMode === 'blur85') return 85;
    if (typeof blurMode === 'string' && blurMode.indexOf('custom') === 0) {
      const n = parseInt(blurMode.slice(6), 10);
      return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 50;
    }
    return 0;
  }
  function isCustomBlurMode(blurMode) {
    return typeof blurMode === 'string' && blurMode.indexOf('custom') === 0;
  }

  /* ─── Image resize ─── */
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

  /* ══════════════════════════════════════════
     OVERLAY & APPLY
  ══════════════════════════════════════════ */

  /* Xoá overlay cũ nếu có */
  (function() {
    const old = document.getElementById(OVERLAY_ID);
    if (old) old.remove();
  })();

  function ensureOverlay() {
    let el = document.getElementById(OVERLAY_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = OVERLAY_ID;
      el.style.cssText = [
        'position:fixed','inset:0','pointer-events:none',
        'z-index:2',
        'transition:filter 0.35s ease,background 0.35s ease',
      ].join(';');
      document.body.appendChild(el);
    }
    return el;
  }

  /* Inject style đảm bảo #root / #admin-root luôn trên overlay */
  (function() {
    if (document.getElementById(ROOT_STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = ROOT_STYLE_ID;
    s.textContent = '#root,#admin-root{isolation:isolate;position:relative;z-index:3!important;}';
    document.head.appendChild(s);
  })();

  function adminApplyBackground(s, isDarkOverride) {
    const body = document.body;
    const overlay = ensureOverlay();
    const isDark = isDarkOverride !== undefined
      ? isDarkOverride
      : (body.classList.contains('dark') || document.documentElement.classList.contains('dark'));

    /* ── Chế độ TẮT NỀN ── */
    if (s.blurMode === 'off') {
      body.style.setProperty('background', isDark ? '#0f0c29' : '#f8fafc', 'important');
      body.style.removeProperty('background-attachment');
      overlay.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:2;`;
      return;
    }

    let bgValue = '';
    if (s.presetId === 'custom_image' && s.imageDataUrl) {
      bgValue = 'url(' + s.imageDataUrl + ') center/cover no-repeat fixed';
    } else {
      const preset = ADMIN_BG_PRESETS.find(p => p.id === s.presetId) || ADMIN_BG_PRESETS[0];
      bgValue = preset.value;
    }

    /* Nội suy tuyến tính theo % (0–100) dựa trên 2 mốc gốc: 50%→(9px,0.18/0.42), 85%→(22px,0.45/0.72) */
    const pct = parseBlurPercent(s.blurMode);
    const blurPx = Math.round(pct * 22 / 85);
    const dimLightA = pct === 0 ? 0 : (0.18 + (pct - 50) * (0.45 - 0.18) / (85 - 50));
    const dimDarkA  = pct === 0 ? 0.28 : (0.42 + (pct - 50) * (0.72 - 0.42) / (85 - 50));
    const dimLight = pct === 0 ? 'transparent' : `rgba(255,255,255,${Math.max(0, Math.min(1, dimLightA)).toFixed(3)})`;
    const dimDark  = `rgba(10,0,20,${Math.max(0, Math.min(1, dimDarkA)).toFixed(3)})`;

    body.style.setProperty('background', 'transparent', 'important');
    body.style.removeProperty('background-attachment');

    overlay.style.cssText = [
      'position:fixed','inset:0','pointer-events:none','z-index:2',
      'transition:filter 0.35s ease,background 0.35s ease',
      s.presetId === 'custom_image' && s.imageDataUrl
        ? 'background:url(' + s.imageDataUrl + ') center/cover no-repeat'
        : 'background:' + bgValue,
      'background-attachment:fixed',
      blurPx > 0 ? 'filter:blur(' + blurPx + 'px)' : '',
      blurPx > 0 ? 'transform:scale(1.04)' : '',
    ].filter(Boolean).join(';') + ';';

    overlay.style.boxShadow = 'inset 0 0 0 100vmax ' + (isDark ? dimDark : dimLight);
  }

  /* ── Dark mode helpers ── */
  function isDarkActive() {
    return document.body.classList.contains('dark') || document.documentElement.classList.contains('dark');
  }

  function adminSaveBlurBackup(mode) {
    try { localStorage.setItem(LS_BLUR_BACKUP, mode); } catch(e) {}
  }

  function adminLoadBlurBackup() {
    try { return localStorage.getItem(LS_BLUR_BACKUP) || 'none'; } catch { return 'none'; }
  }

  /* ── MutationObserver cho dark mode ── */
  let _prevDark = isDarkActive();

  function _onDarkChange() {
    const nowDark = isDarkActive();
    if (nowDark === _prevDark) return;
    _prevDark = nowDark;

    const s = lsLoad();
    if (nowDark) {
      if (s.blurMode !== 'off') adminSaveBlurBackup(s.blurMode);
      const next = { ...s, blurMode: 'off' };
      lsSave(next);
      adminApplyBackground(next, true);
      window.dispatchEvent(new CustomEvent('learnsy:admin-darkmode-bg-changed', { detail: next }));
    } else {
      const restored = adminLoadBlurBackup();
      const next = { ...s, blurMode: restored };
      lsSave(next);
      adminApplyBackground(next, false);
      window.dispatchEvent(new CustomEvent('learnsy:admin-darkmode-bg-changed', { detail: next }));
    }
  }

  new MutationObserver(_onDarkChange).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(_onDarkChange).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  /* Init — apply localStorage ngay, sau đó sync Upstash nền */
  function initApply() {
    const s = lsLoad();
    const nowDark = isDarkActive();

    // Nếu dark mode đang bật khi load → đồng bộ blur giống _onDarkChange
    if (nowDark && s.blurMode !== 'off') {
      adminSaveBlurBackup(s.blurMode);
      const darkS = { ...s, blurMode: 'off' };
      lsSave(darkS);
      adminApplyBackground(darkS, true);
    } else {
      adminApplyBackground(s);
    }

    if (window.upstashCmd) {
      upLoad().then(remote => {
        if (!remote) return;
        const local = lsLoad();
        const nowDark2 = isDarkActive();

        // Nếu dark đang bật, không restore blur từ remote — chỉ lấy preset/image
        let blurMode = remote.blurMode;
        if (nowDark2 && blurMode !== 'off') {
          adminSaveBlurBackup(blurMode); // backup để restore khi tắt dark
          blurMode = 'off';
        }

        const merged = {
          ...local,
          presetId: remote.presetId,
          blurMode,
          imageDataUrl: remote.imageDataUrl || local.imageDataUrl || null,
        };
        lsSave(merged);
        adminApplyBackground(merged);
        window.dispatchEvent(new CustomEvent('learnsy:admin-bg-synced', { detail: merged }));
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
      React.createElement('path',{d:'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z'})
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
    spinner: () => React.createElement('svg', {viewBox:'0 0 24 24',width:16,height:16,fill:'none',stroke:'currentColor',strokeWidth:2.5,strokeLinecap:'round',style:{display:'block',flexShrink:0,animation:'admin-bg-spin 0.8s linear infinite'}},
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
    lock: () => React.createElement('svg', {viewBox:'0 0 24 24',width:10,height:10,fill:'none',stroke:'currentColor',strokeWidth:2.5,strokeLinecap:'round',strokeLinejoin:'round',style:{display:'block'}},
      React.createElement('rect',{x:3,y:11,width:18,height:11,rx:2,ry:2}),
      React.createElement('path',{d:'M7 11V7a5 5 0 0 1 10 0v4'})
    ),
  };

  function blurIcon(id) {
    if (id === 'blur50') return ICONS.cloudLight();
    if (id === 'blur85') return ICONS.fog();
    if (id === 'custom') return ICONS.sparkle();
    if (id === 'off')    return ICONS.off();
    return ICONS.sun();
  }

  /* ══════════════════════════════════════════
     REACT COMPONENT — AdminBgSettingsCard
  ══════════════════════════════════════════ */
  function AdminBgSettingsCard({ dark }) {
    const { useState, useEffect, useRef, useCallback } = React;

    /* Admin palette — xanh/tím/tối thay vì hồng */
    const C = dark
      ? { fg:'#e2e8f0', sub:'rgba(148,163,184,0.75)', card:'rgba(15,12,41,0.85)',
          border:'rgba(99,102,241,0.25)', accent:'#818cf8', accent2:'#c084fc', div:'rgba(255,255,255,0.07)' }
      : { fg:'#1e293b', sub:'#64748b', card:'rgba(255,255,255,0.88)',
          border:'rgba(99,102,241,0.2)', accent:'#6366f1', accent2:'#8b5cf6', div:'rgba(0,0,0,0.06)' };

    const [settings, setSettings] = useState(() => lsLoad());
    const [syncState, setSyncState] = useState('idle'); // 'idle'|'saving'|'saved'|'error'
    const [uploading, setUploading] = useState(false);
    const fileRef   = useRef(null);
    const syncTimer = useRef(null);
    const isDirty   = useRef(false);

    /* Lắng nghe dark mode auto-change (từ MutationObserver, cho các trường hợp thay đổi class DOM ngoài React) */
    useEffect(() => {
      const handler = e => {
        isDirty.current = true;
        setSettings(e.detail);
      };
      window.addEventListener('learnsy:admin-darkmode-bg-changed', handler);
      return () => window.removeEventListener('learnsy:admin-darkmode-bg-changed', handler);
    }, []);

    /* Bắt buộc blurMode='off' bất cứ khi nào prop `dark` là true — không phụ thuộc vào
       MutationObserver bắt được thay đổi class DOM hay chưa. Tránh trường hợp nút bị khoá
       về mặt hiển thị (isLocked dựa trên `dark`) nhưng settings.blurMode trong state vẫn
       còn giá trị cũ (vd 'blur50'/'custom65') → nền vẫn mờ dù Dark Mode đã bật.
       Cũng tự chạy đúng ngay khi mount nếu dark=true từ đầu (MutationObserver chỉ bắt được
       các lần *thay đổi*, không bắt được trạng thái ban đầu). */
    useEffect(() => {
      if (!dark) return;
      setSettings(s => {
        if (s.blurMode === 'off') return s; // đã đúng, không cần làm gì
        adminSaveBlurBackup(s.blurMode);
        isDirty.current = true;
        const next = { ...s, blurMode: 'off' };
        lsSave(next);
        return next;
      });
    }, [dark]);

    /* Chỉ khôi phục khi thực sự CHUYỂN từ dark→light, tránh ghi đè giá trị 'off'
       hợp lệ mà admin tự chọn trong lúc đang ở light mode. */
    const prevDarkProp = useRef(dark);
    useEffect(() => {
      const wasDark = prevDarkProp.current;
      prevDarkProp.current = dark;
      if (dark || !wasDark) return; // chỉ xử lý đúng lúc chuyển dark → light
      const restored = adminLoadBlurBackup();
      setSettings(s => {
        if (s.blurMode !== 'off') return s; // admin đã tự đổi trong lúc này rồi, đừng ghi đè
        isDirty.current = true;
        const next = { ...s, blurMode: restored };
        lsSave(next);
        return next;
      });
    }, [dark]);

    /* Lắng nghe sync cloud từ initApply (chạy lúc page load) */
    useEffect(() => {
      const handler = e => {
        isDirty.current = false;
        setSettings(e.detail);
      };
      window.addEventListener('learnsy:admin-bg-synced', handler);
      return () => window.removeEventListener('learnsy:admin-bg-synced', handler);
    }, []);

    /* Load từ Upstash khi mount */
    useEffect(() => {
      if (!window.upstashCmd) return;
      upLoad().then(remote => {
        if (!remote) return;
        isDirty.current = false;
        setSettings(local => {
          const merged = {
            ...local,
            presetId: remote.presetId,
            blurMode: remote.blurMode,
            imageDataUrl: remote.imageDataUrl || local.imageDataUrl || null,
          };
          lsSave(merged);
          adminApplyBackground(merged);
          return merged;
        });
      });
    }, []);

    /* Lưu localStorage + sync Upstash khi settings thay đổi */
    useEffect(() => {
      lsSave(settings);
      adminApplyBackground(settings);

      if (!window.upstashCmd || !isDirty.current) return;
      isDirty.current = false;
      clearTimeout(syncTimer.current);
      setSyncState('saving');
      syncTimer.current = setTimeout(async () => {
        try {
          await upSave(settings);
          clearPendingSync();
          setSyncState('saved');
          setTimeout(() => setSyncState('idle'), 2000);
        } catch {
          // Sau khi hết retry vẫn lỗi (thường do mất mạng) → lưu lại để tự đồng bộ khi có mạng trở lại
          savePendingSync(settings);
          setSyncState('error');
          setTimeout(() => setSyncState('idle'), 3000);
        }
      }, SYNC_DEBOUNCE_MS);
    }, [settings]);

    /* Tự động đồng bộ lại khi mạng trở lại hoặc mở lại app, nếu còn thay đổi
       chưa lưu lên cloud thành công (ví dụ do offline lúc đang chỉnh) */
    useEffect(() => {
      if (!window.upstashCmd) return;
      const tryFlush = async () => {
        const pending = loadPendingSync();
        if (!pending) return;
        setSyncState('saving');
        try {
          await upSave(pending);
          clearPendingSync();
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
    }, []);

    /* Image upload */
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
      const next = mode === 'custom' ? `custom${parseBlurPercent(settings.blurMode) || 65}` : mode;
      adminSaveBlurBackup(next);
      isDirty.current = true;
      setSettings(s => ({ ...s, blurMode: next }));
    }, [dark, settings.blurMode]);

    /* Kéo thanh trượt tuỳ chỉnh (0-100%) */
    const pickBlurCustomPercent = useCallback(pct => {
      if (dark) return;
      const next = `custom${pct}`;
      adminSaveBlurBackup(next);
      isDirty.current = true;
      setSettings(s => ({ ...s, blurMode: next }));
    }, [dark]);

    const removeImage = useCallback(() => {
      isDirty.current = true;
      setSettings(s => ({ ...s, presetId: 'default_light', imageDataUrl: null }));
    }, []);

    const divider = { height:1, background: C.div, margin:'12px 0' };
    const sectionLabel = {
      fontFamily:"'Baloo 2',cursive,sans-serif", fontSize:11, fontWeight:800,
      color: C.sub, letterSpacing:'0.8px', textTransform:'uppercase', marginBottom:8,
    };

    const syncBadge = (() => {
      if (!window.upstashCmd) return null;
      if (syncState === 'saving') return { icon: ICONS.spinner(), label:'Đang lưu...', color: C.sub };
      if (syncState === 'saved')  return { icon: ICONS.cloud(),   label:'Đã lưu cloud', color:'#10b981' };
      if (syncState === 'error')  return { icon: ICONS.warning(), label:'Lỗi đồng bộ',  color:'#ef4444' };
      if (syncState === 'idle')   return { icon: ICONS.cloud(),   label:'Cloud sync',   color: C.sub };
      return null;
    })();

    return React.createElement('div', {
      style: {
        background: C.card, borderRadius:24, padding:'16px 18px',
        border:`1.5px solid ${C.border}`,
        boxShadow: dark ? '0 4px 24px rgba(99,102,241,0.12)' : '0 4px 20px rgba(99,102,241,0.08)',
      }
    },

      /* ── Header ── */
      React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:10, marginBottom:10 } },
        React.createElement('span', { style:{ display:'inline-flex', color:C.accent } }, ICONS.picture()),
        React.createElement('div', { style:{ flex:1 } },
          React.createElement('div', { style:{ fontFamily:"'Baloo 2',cursive,sans-serif", fontSize:14, fontWeight:700, color:C.fg } },
            'Tùy chỉnh nền Admin'),
          React.createElement('div', { style:{ fontSize:11, color:C.sub } }, 'Đổi nền & làm mờ · Lưu riêng cho admin'),
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
            color: 'rgba(129,140,248,0.6)',
            display:'flex', alignItems:'center', gap:3,
            background: 'rgba(99,102,241,0.1)',
            padding:'2px 7px', borderRadius:8,
          }
        },
          ICONS.lock(), 'Khoá khi Dark Mode'
        ),
      ),
      React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6, marginBottom:0 } },
        ADMIN_BLUR_MODES.map(m => {
          const isOff = m.id === 'off';
          const isLocked = dark && !isOff;
          const isSel = m.id === 'custom'
            ? isCustomBlurMode(settings.blurMode)
            : settings.blurMode === m.id;
          return React.createElement('button', {
            key: m.id,
            onClick: () => !isLocked && pickBlur(m.id),
            title: isLocked ? 'Bị khoá khi Dark Mode đang bật' : m.label,
            style: {
              flex:1, padding:'8px 4px', borderRadius:18,
              cursor: isLocked ? 'not-allowed' : 'pointer',
              border: isSel
                ? '2px solid ' + C.accent
                : '1.5px solid ' + (dark ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.2)'),
              background: isLocked
                ? (dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.03)')
                : isSel
                  ? (dark ? 'rgba(129,140,248,0.2)' : 'rgba(99,102,241,0.12)')
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
            React.createElement('span', null,
              m.id === 'custom' && isSel ? `${parseBlurPercent(settings.blurMode)}%` : m.label),
            isLocked && React.createElement('div', {
              style:{ position:'absolute', top:3, right:4, opacity:0.5 }
            },
              React.createElement('svg', {viewBox:'0 0 24 24',width:8,height:8,fill:'none',stroke:'currentColor',strokeWidth:2.5,strokeLinecap:'round',strokeLinejoin:'round'},
                React.createElement('rect',{x:3,y:11,width:18,height:11,rx:2,ry:2}),
                React.createElement('path',{d:'M7 11V7a5 5 0 0 1 10 0v4'})
              )
            ),
          );
        })
      ),

      /* ── Thanh trượt mờ tuỳ chỉnh ── */
      isCustomBlurMode(settings.blurMode) && !dark && React.createElement('div', {
        style:{ marginTop:10, padding:'8px 10px', borderRadius:12,
          background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(99,102,241,0.06)',
          border:`1px solid ${C.border}` }
      },
        React.createElement('div', {
          style:{ display:'flex', justifyContent:'space-between', alignItems:'center',
            fontSize:10, fontWeight:700, color:C.sub, marginBottom:6 }
        },
          React.createElement('span', null, 'Mức làm mờ'),
          React.createElement('span', { style:{ color:C.accent, fontWeight:800 } },
            `${parseBlurPercent(settings.blurMode)}%`),
        ),
        React.createElement('input', {
          type:'range', min:0, max:100, step:1,
          value: parseBlurPercent(settings.blurMode),
          onChange: e => pickBlurCustomPercent(parseInt(e.target.value, 10)),
          style:{ width:'100%', accentColor: C.accent, cursor:'pointer' },
        }),
      ),

      React.createElement('div', { style: divider }),

      /* ── Preset grid ── */
      React.createElement('div', { style: { ...sectionLabel, display:'flex', alignItems:'center', gap:5 } },
        ICONS.palette(), 'Màu & hình nền'),
      React.createElement('div', {
        style:{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8 }
      },
        ADMIN_BG_PRESETS.map(p => {
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
            previewCSS.background = dark ? 'rgba(255,255,255,0.08)' : 'rgba(99,102,241,0.08)';
          }

          return React.createElement('button', {
            key: p.id,
            title: p.label,
            onClick: () => pickPreset(p.id),
            style: {
              aspectRatio:'1', borderRadius:18, cursor:'pointer', padding:0,
              border: isSel
                ? `2.5px solid ${C.accent}`
                : `1.5px solid ${dark?'rgba(255,255,255,0.12)':'rgba(99,102,241,0.2)'}`,
              overflow:'hidden', position:'relative',
              transition:'all .2s cubic-bezier(.34,1.56,.64,1)',
              transform: isSel ? 'scale(1.1)' : 'scale(1)',
              boxShadow: isSel ? `0 4px 14px ${C.accent}55` : 'none',
              ...previewCSS,
            }
          },
            isCustom && !settings.imageDataUrl &&
              React.createElement('span', {
                style:{ display:'flex', alignItems:'center',
                  justifyContent:'center', width:'100%', height:'100%', color:C.accent }
              }, uploading ? ICONS.spinner() : ICONS.camera(20, 20)),

            isSel && React.createElement('div', {
              style:{ position:'absolute', inset:0, display:'flex',
                alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.22)' }
            },
              React.createElement('svg', { viewBox:'0 0 24 24', width:18, height:18, fill:'none',
                stroke:'#fff', strokeWidth:3, strokeLinecap:'round', strokeLinejoin:'round' },
                React.createElement('polyline', { points:'20 6 9 17 4 12' })
              )
            ),

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
              background:dark?'rgba(129,140,248,0.15)':'rgba(99,102,241,0.1)',
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

      /* ── Note ── */
      React.createElement('div', {
        style:{ marginTop:8, fontSize:10, color:C.sub, textAlign:'center',
          fontStyle:'italic', lineHeight:1.5 }
      }, '🛠️ Key Upstash riêng · Không ảnh hưởng nền student'),

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
  window.AdminBgSettingsCard   = AdminBgSettingsCard;
  window.adminApplyBackground  = adminApplyBackground;
  window.adminLoadBgSettings   = lsLoad;
  window.ADMIN_BG_PRESETS      = ADMIN_BG_PRESETS;
  window.ADMIN_BLUR_MODES      = ADMIN_BLUR_MODES;
  window.adminParseBlurPercent = parseBlurPercent;

  console.log('[admin-background-settings] ✅ loaded!');
})();