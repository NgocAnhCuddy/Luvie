import React from 'react';

/**
 * toast.js — Kawaii Toast Notification System ✿
 * Style: soft · pastel · kawaii · minimal
 * Version: 2.0.0
 *
 * Usage:
 *   <script src="/js/toast.js"></script>
 *   <div id="toastContainer"></div>
 *
 * ──────────────────────────────────────────────
 * PUBLIC API
 * ──────────────────────────────────────────────
 *
 * showToast(msg, type, duration)
 *   Show a toast notification.
 *   @param {string}  msg       — Message to display (plain text, XSS-safe)
 *   @param {string}  type      — 'success' | 'error' | 'warn' | 'info' | 'auto'
 *                                'auto' detects type from Vietnamese / English keywords
 *   @param {number}  duration  — Display time in ms (default: 3500)
 *
 * showToastWithUndo(msg, onUndo, onCommit, delay)
 *   Show a toast with an Undo button. Action commits after `delay` ms
 *   unless the user clicks "Hoàn tác".
 *   @param {string}   msg      — Message describing the action
 *   @param {Function} onUndo   — Called when user clicks Undo
 *   @param {Function} onCommit — Called when timer expires without undo
 *   @param {number}   delay    — ms before committing (default: 5000)
 *
 * removeToast(el)
 *   Manually dismiss a toast element.
 *   @param {HTMLElement} el   — The .toast-item element to remove
 *
 * ──────────────────────────────────────────────
 * ICON THEMES
 * ──────────────────────────────────────────────
 *   success — bunny face  : tall ears, rosy cheeks, checkmark grin
 *   warn    — bear face   : round ears inside triangle, worried brow
 *   error   — cat face    : pointy ears, X-eyes, teardrop
 *   info    — star face   : 4-point sparkle forehead, shiny eyes
 *   (undo)  — trash bin   : rounded lid + stripes, SVG only
 *
 * All icons are pure inline SVG — no emoji, no external assets,
 * no Unicode codepoints above U+00FF. Safe for Babel standalone.
 *
 * ──────────────────────────────────────────────
 * BEHAVIOUR NOTES
 * ──────────────────────────────────────────────
 *   - Max 2 toasts visible at a time. Oldest info/success removed first.
 *   - Duplicate messages (same text, < 500 ms apart) are suppressed.
 *   - Exact duplicate already on screen gets a bounce instead of new toast.
 *   - Progress bar animates from full → empty over `duration` ms.
 *   - Click anywhere on toast (except close btn) to dismiss early.
 *   - Dark mode: add class "dark" to <body>.
 *   - One UI theme: add class "theme-oneui" to <body>.
 *
 * ──────────────────────────────────────────────
 * DEPENDENCIES
 * ──────────────────────────────────────────────
 *   CSS  : toast.css  (Nunito font, pastel palette, animations)
 *   DOM  : requires <div id="toastContainer"> in the page
 */

'use strict';

/* ══════════════════════════════════════════════════
   KAWAII SVG ICONS — cute animal / character faces
   All pure SVG paths, no emoji, no external assets.
   Safe for Babel standalone (no codepoints > U+00FF).

   success — bunny face with heart cheeks + checkmark ears
   warn    — bear face with worried brows inside triangle
   error   — cat face with X-eyes and teardrop
   info    — star-round face with sparkle forehead dot
   love    — heart face  : wide smile, heart eyes, blush (alias of success variant)
   loading — sleepy face : zzz dots, droopy eyes (unused by default, available for custom use)
══════════════════════════════════════════════════ */
const _kawaiiIcons = {

  /* ✿ SUCCESS — bunny face: round head, tall ears, rosy cheeks, check-grin */
  success: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- left ear -->
    <path d="M6.5 8 Q5.5 3 7.5 2 Q9 1.5 8.5 5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="currentColor" fill-opacity="0.15"/>
    <!-- right ear -->
    <path d="M13.5 8 Q14.5 3 12.5 2 Q11 1.5 11.5 5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="currentColor" fill-opacity="0.15"/>
    <!-- head -->
    <circle cx="10" cy="12" r="7" stroke="currentColor" stroke-width="1.6" fill="currentColor" fill-opacity="0.08"/>
    <!-- eyes — closed happy arcs -->
    <path d="M7.2 10.5 Q7.8 9.5 8.4 10.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"/>
    <path d="M11.6 10.5 Q12.2 9.5 12.8 10.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"/>
    <!-- rosy cheeks -->
    <ellipse cx="7" cy="12.5" rx="1.5" ry="0.9" fill="currentColor" fill-opacity="0.18"/>
    <ellipse cx="13" cy="12.5" rx="1.5" ry="0.9" fill="currentColor" fill-opacity="0.18"/>
    <!-- checkmark mouth / grin -->
    <path d="M7.5 14 L9.2 15.7 L13.5 11.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>`,

  /* △ WARN — bear face inside triangle: round ears, dot nose, worried brow */
  warn: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- triangle body -->
    <path d="M10 1.5 L19 18 L1 18 Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" fill="currentColor" fill-opacity="0.10"/>
    <!-- left ear (round bump above triangle edge) -->
    <circle cx="7.2" cy="10.5" r="1.4" fill="currentColor" fill-opacity="0.25" stroke="currentColor" stroke-width="1.1"/>
    <!-- right ear -->
    <circle cx="12.8" cy="10.5" r="1.4" fill="currentColor" fill-opacity="0.25" stroke="currentColor" stroke-width="1.1"/>
    <!-- worried brow left -->
    <path d="M7 12.2 Q7.5 11.6 8.3 12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" fill="none"/>
    <!-- worried brow right -->
    <path d="M11.7 12 Q12.5 11.6 13 12.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" fill="none"/>
    <!-- eyes — oval dots -->
    <ellipse cx="8" cy="13.2" rx="0.9" ry="1" fill="currentColor"/>
    <ellipse cx="12" cy="13.2" rx="0.9" ry="1" fill="currentColor"/>
    <!-- dot nose -->
    <circle cx="10" cy="14.8" r="0.7" fill="currentColor" fill-opacity="0.7"/>
    <!-- wavy worried mouth -->
    <path d="M8.2 16.2 Q9 15.4 10 16 Q11 16.6 11.8 15.8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" fill="none"/>
  </svg>`,

  /* ✕ ERROR — cat face: pointy ears, X-eyes, teardrop, sad mouth */
  error: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- head circle -->
    <circle cx="10" cy="11" r="7.5" stroke="currentColor" stroke-width="1.6" fill="currentColor" fill-opacity="0.08"/>
    <!-- left cat ear -->
    <path d="M4.5 6.5 L6 3 L8 5.5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="currentColor" fill-opacity="0.18"/>
    <!-- right cat ear -->
    <path d="M15.5 6.5 L14 3 L12 5.5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="currentColor" fill-opacity="0.18"/>
    <!-- X left eye -->
    <path d="M7 8.5 L8.4 9.9 M8.4 8.5 L7 9.9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <!-- X right eye -->
    <path d="M11.6 8.5 L13 9.9 M13 8.5 L11.6 9.9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <!-- dot nose -->
    <circle cx="10" cy="11.3" r="0.75" fill="currentColor" fill-opacity="0.7"/>
    <!-- teardrop under left eye -->
    <path d="M7.7 10.5 Q7.2 11.5 7.7 12.2 Q8.2 12.9 8.4 12.2 Q8.6 11.5 7.7 10.5 Z" fill="currentColor" fill-opacity="0.35"/>
    <!-- sad mouth -->
    <path d="M7.8 14 Q10 12.2 12.2 14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"/>
  </svg>`,

  /* ◎ INFO — star-round face: sparkle on forehead, big curious eyes, tiny smile */
  info: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- head -->
    <circle cx="10" cy="11.5" r="7.5" stroke="currentColor" stroke-width="1.6" fill="currentColor" fill-opacity="0.08"/>
    <!-- sparkle forehead: 4-point star -->
    <path d="M10 1.5 L10.5 3 L12 3.5 L10.5 4 L10 5.5 L9.5 4 L8 3.5 L9.5 3 Z" fill="currentColor" fill-opacity="0.75"/>
    <!-- left eye — big shiny circle -->
    <circle cx="7.5" cy="11" r="1.6" fill="currentColor" fill-opacity="0.85"/>
    <circle cx="7.9" cy="10.4" r="0.55" fill="white" fill-opacity="0.9"/>
    <!-- right eye -->
    <circle cx="12.5" cy="11" r="1.6" fill="currentColor" fill-opacity="0.85"/>
    <circle cx="12.9" cy="10.4" r="0.55" fill="white" fill-opacity="0.9"/>
    <!-- rosy cheeks -->
    <ellipse cx="6.2" cy="13.2" rx="1.5" ry="0.85" fill="currentColor" fill-opacity="0.16"/>
    <ellipse cx="13.8" cy="13.2" rx="1.5" ry="0.85" fill="currentColor" fill-opacity="0.16"/>
    <!-- small curious smile -->
    <path d="M8.2 14.5 Q10 16 11.8 14.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"/>
  </svg>`,

  /* ♡ LOVE — heart-eye face: two heart shapes as eyes, big grin, rosy cheeks
     Available as _kawaiiIcons.love for custom showToast calls.             */
  love: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- head -->
    <circle cx="10" cy="11" r="7.5" stroke="currentColor" stroke-width="1.6" fill="currentColor" fill-opacity="0.08"/>
    <!-- left heart eye -->
    <path d="M6 8.5 Q6 7 7.2 7 Q8 7 8 7.8 Q8 7 8.8 7 Q10 7 10 8.5 Q10 9.8 8 11 Q6 9.8 6 8.5 Z" fill="currentColor" fill-opacity="0.85"/>
    <!-- right heart eye -->
    <path d="M10 8.5 Q10 7 11.2 7 Q12 7 12 7.8 Q12 7 12.8 7 Q14 7 14 8.5 Q14 9.8 12 11 Q10 9.8 10 8.5 Z" fill="currentColor" fill-opacity="0.85"/>
    <!-- rosy cheeks -->
    <ellipse cx="6.5" cy="13" rx="1.6" ry="0.95" fill="currentColor" fill-opacity="0.18"/>
    <ellipse cx="13.5" cy="13" rx="1.6" ry="0.95" fill="currentColor" fill-opacity="0.18"/>
    <!-- big grin -->
    <path d="M7 13.5 Q10 16.5 13 13.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/>
    <!-- sparkle top-right -->
    <path d="M16 4 L16.3 5 L17.3 5 L16.5 5.6 L16.8 6.6 L16 6 L15.2 6.6 L15.5 5.6 L14.7 5 L15.7 5 Z" fill="currentColor" fill-opacity="0.5"/>
  </svg>`,

  /* Zzz LOADING / SLEEPY — droopy eyes, zzz bubbles above head
     Available as _kawaiiIcons.loading for pending / skeleton toast states. */
  loading: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- head -->
    <circle cx="10" cy="12" r="7" stroke="currentColor" stroke-width="1.6" fill="currentColor" fill-opacity="0.08"/>
    <!-- droopy left eye -->
    <path d="M7 10 Q7.7 11.2 8.4 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>
    <!-- droopy right eye -->
    <path d="M11.6 10 Q12.3 11.2 13 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>
    <!-- sleepy open mouth -->
    <ellipse cx="10" cy="14.5" rx="1.2" ry="0.9" stroke="currentColor" stroke-width="1.3" fill="currentColor" fill-opacity="0.1"/>
    <!-- zzz bubbles: small to large -->
    <circle cx="11.5" cy="4.5" r="0.7" fill="currentColor" fill-opacity="0.55"/>
    <circle cx="13"   cy="3"   r="0.9" fill="currentColor" fill-opacity="0.65"/>
    <circle cx="14.8" cy="1.8" r="1.1" fill="currentColor" fill-opacity="0.75"/>
  </svg>`
};

/* ══════════════════════════════════════════════════
   AUTO-DETECT KEYWORD TABLE
   Checked in order: error > warn > success > info (default).

   error   : lỗi · thất bại · không thể · error · failed · từ chối · sai · invalid
   warn    : cảnh báo · chú ý · warn · vui lòng · thiếu · chưa
   success : thành công · đã lưu · đã thêm · đã xóa · đã cập nhật · đã tạo
             đã bật · đã tắt · đã mở · đã đóng · đã gửi · đã reset
             đã sao chép · ok · hoàn tất · saved · success
   info    : (default — anything that doesn't match above)
══════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════
   showToast
   @param {string}  msg       Plain-text message. SVG tags are stripped automatically.
   @param {string}  [type]    'success' | 'error' | 'warn' | 'info' | 'auto'
                              Default 'auto' — detects type from Vietnamese/English keywords.
   @param {number}  [duration] Display time in milliseconds. Default 3500.
   @returns {void}
══════════════════════════════════════════════════ */
/* ══ DYNAMIC ISLAND CSS — inject once ══ */
(function _injectDiCSS(){
  if(document.getElementById('bb-di-toast-css'))return;
  const s=document.createElement('style');
  s.id='bb-di-toast-css';
  s.textContent=`
    @keyframes _di-in  {
      0%  { width:36px;  height:36px;  border-radius:50%;  opacity:0; transform:translateX(-50%) scaleY(.6); }
      20% { width:36px;  height:36px;  border-radius:50%;  opacity:1; transform:translateX(-50%) scaleY(1); }
      55% { width:252px; height:50px;  border-radius:25px; opacity:1; transform:translateX(-50%) scaleY(1); }
      100%{ width:272px; height:56px;  border-radius:28px; opacity:1; transform:translateX(-50%) scaleY(1); }
    }
    @keyframes _di-out {
      0%  { width:272px; height:56px;  border-radius:28px; opacity:1; transform:translateX(-50%) scaleY(1); }
      40% { width:252px; height:50px;  border-radius:25px; opacity:1; transform:translateX(-50%) scaleY(1); }
      75% { width:36px;  height:36px;  border-radius:50%;  opacity:1; transform:translateX(-50%) scaleY(1); }
      100%{ width:36px;  height:36px;  border-radius:50%;  opacity:0; transform:translateX(-50%) scaleY(.6); }
    }
    @keyframes _di-content-in {
      0%,40%{ opacity:0; transform:scale(.85) translateY(3px); }
      100%  { opacity:1; transform:scale(1) translateY(0); }
    }
    @keyframes _di-icon-pulse { 0%,100%{ transform:scale(1); } 50%{ transform:scale(1.18); } }
    @keyframes _di-glow       { 0%,100%{ opacity:.35; } 50%{ opacity:.8; } }
    ._di-pill {
      position:fixed; top:10px; left:50%;
      transform:translateX(-50%); transform-origin:center top;
      z-index:999999;
      background:linear-gradient(135deg,rgba(14,4,10,.97),rgba(26,8,18,.97));
      display:flex; align-items:center; justify-content:center;
      gap:9px; padding:0 14px; cursor:pointer; user-select:none; overflow:hidden;
      will-change:width,height,border-radius,opacity;
      box-shadow:0 0 0 1.5px rgba(255,255,255,.07), 0 8px 28px rgba(0,0,0,.55);
    }
    ._di-glow {
      position:absolute; left:13px; top:50%; transform:translateY(-50%);
      width:30px; height:30px; border-radius:50%;
      opacity:.15; filter:blur(7px); pointer-events:none;
      animation:_di-glow 1.2s ease-in-out infinite;
    }
    ._di-icon { flex-shrink:0; font-size:18px; position:relative; z-index:1; line-height:1;
      animation:_di-icon-pulse 1s ease-in-out infinite; }
    ._di-body { flex:1; min-width:0; position:relative; z-index:1;
      animation:_di-content-in .52s cubic-bezier(.34,1.3,.64,1) both; }
    ._di-label { font-size:9px; font-weight:800; letter-spacing:.7px; text-transform:uppercase;
      font-family:Nunito,sans-serif; margin-bottom:1px; }
    ._di-msg   { font-size:13px; font-weight:800; color:#fce4f0;
      font-family:'Baloo 2',cursive; overflow:hidden; text-overflow:ellipsis;
      white-space:nowrap; line-height:1.15; }
    ._di-dot   { flex-shrink:0; width:5px; height:5px; border-radius:50%;
      background:rgba(255,255,255,.22); position:relative; z-index:1; }
  `;
  document.head.appendChild(s);
})();

/* ══ TYPE → icon emoji + accent color ══ */
const _diConfig={
  success:{ emoji:'✅', color:'#34d399' },
  error:  { emoji:'❌', color:'#f87171' },
  warn:   { emoji:'⚠️', color:'#fbbf24' },
  info:   { emoji:'✨', color:'#a78bfa' },
};

/* ══ showDiToast — DOM-native Dynamic Island (không cần React) ══ */
let _diActive=null;
function showDiToast(msg, type='info', duration=3200){
  /* Nếu đang có pill → dismiss trước */
  if(_diActive){ _diDismiss(_diActive,true); }

  const cfg=_diConfig[type]||_diConfig.info;
  const pill=document.createElement('div');
  pill.className='_di-pill';
  pill.style.animation='_di-in .52s cubic-bezier(.34,1.3,.64,1) both';
  pill.style.boxShadow+=`, 0 0 18px ${cfg.color}38`;

  const glow=document.createElement('div');
  glow.className='_di-glow';
  glow.style.background=cfg.color;

  const icon=document.createElement('span');
  icon.className='_di-icon';
  icon.textContent=cfg.emoji;

  const body=document.createElement('div');
  body.className='_di-body';

  const lbl=document.createElement('div');
  lbl.className='_di-label';
  lbl.style.color=cfg.color;
  lbl.textContent='Learnsy';

  const txt=document.createElement('div');
  txt.className='_di-msg';
  txt.textContent=msg;

  const dot=document.createElement('div');
  dot.className='_di-dot';

  body.append(lbl,txt);
  pill.append(glow,icon,body,dot);
  document.body.appendChild(pill);

  pill.addEventListener('click',()=>_diDismiss(pill));
  _diActive=pill;

  const t=setTimeout(()=>_diDismiss(pill), duration);
  pill._diTimer=t;
}

function _diDismiss(pill, immediate=false){
  if(!pill||!pill.isConnected)return;
  if(pill._diTimer)clearTimeout(pill._diTimer);
  if(_diActive===pill)_diActive=null;
  if(immediate){ pill.remove(); return; }
  pill.style.animation='_di-out .42s cubic-bezier(.55,0,.45,1) both';
  setTimeout(()=>pill.remove(), 420);
}

/* ══ Expose globally ══ */
window.showDiToast=showDiToast;

function showToast(msg, type = 'auto', duration = 3500) {
  // Strip any SVG tags that may have leaked into msg
  msg = msg.replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/\s{2,}/g, ' ').trim();

  // Global debounce 500ms: chặn cùng nội dung hiện 2 lần liên tiếp
  if (!window._toastRecentMsgs) window._toastRecentMsgs = new Map();
  const _tnow = Date.now();
  if ((_tnow - (window._toastRecentMsgs.get(msg) || 0)) < 500) return;
  window._toastRecentMsgs.set(msg, _tnow);
  if (window._toastRecentMsgs.size > 20) {
    for (const [k, v] of window._toastRecentMsgs) {
      if (_tnow - v > 2000) window._toastRecentMsgs.delete(k);
    }
  }

  // Auto-detect type từ nội dung
  if (type === 'auto') {
    const m = msg.toLowerCase();
    if (/lỗi|thất bại|không thể|error|failed|từ chối|sai|invalid/.test(m))
      type = 'error';
    else if (/cảnh báo|chú ý|warn|vui lòng|thiếu|chưa/.test(m))
      type = 'warn';
    else if (/thành công|đã lưu|đã thêm|đã xóa|đã cập nhật|đã tạo|đã bật|đã tắt|đã mở|đã đóng|đã gửi|đã reset|đã sao chép|ok|hoàn tất|saved|success/.test(m))
      type = 'success';
    else
      type = 'info';
  }

  /* ── Nếu không có #toastContainer → dùng Dynamic Island ── */
  const container = document.getElementById('toastContainer');
  if (!container){ showDiToast(msg, type, duration); return; }

  const icon = _kawaiiIcons[type] || _kawaiiIcons.info;

  // Giới hạn 2 toast cùng lúc — xóa toast cũ nhất nếu đầy
  const MAX_TOASTS = 2;
  const existing = container.querySelectorAll('.toast-item');
  if (existing.length >= MAX_TOASTS) {
    let toRemove = null;
    for (const t of existing) {
      if (t.classList.contains('toast-info') || t.classList.contains('toast-success')) {
        toRemove = t; break;
      }
    }
    if (!toRemove) toRemove = existing[0];
    removeToast(toRemove);
  }

  // Deduplicate: không hiện toast giống hệt đang hiển thị
  for (const t of container.querySelectorAll('.toast-item')) {
    if (t.querySelector('.toast-msg')?.textContent === msg) {
      t.style.animation = 'none';
      t.offsetHeight; // reflow
      t.style.animation = '';
      t.style.transform = 'scale(1.06)';
      setTimeout(() => { if (t.isConnected) t.style.transform = ''; }, 220);
      return;
    }
  }

  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type}`;

  const iconSpan = document.createElement('span');
  iconSpan.className = 'toast-icon';
  iconSpan.innerHTML = icon; // Static internal SVG, safe

  const msgSpan = document.createElement('span');
  msgSpan.className = 'toast-msg';
  msgSpan.textContent = msg; // textContent prevents XSS

  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.innerHTML = `<svg width="9" height="9" viewBox="0 0 9 9" fill="none">
    <path d="M1.5 1.5 L7.5 7.5 M7.5 1.5 L1.5 7.5"
      stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`;
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.onclick = (e) => { e.stopPropagation(); removeToast(toast); };

  const progress = document.createElement('div');
  progress.className = 'toast-progress';
  progress.style.animationDuration = duration + 'ms';

  toast.append(iconSpan, msgSpan, closeBtn, progress);
  container.appendChild(toast);

  toast.addEventListener('click', (e) => {
    if (!e.target.closest('.toast-close')) removeToast(toast);
  });

  const timerId = setTimeout(() => removeToast(toast), duration);
  toast._timerId = timerId;
}

/* ══════════════════════════════════════════════════
   removeToast
   Animates a toast out then removes it from the DOM.
   Clears the auto-dismiss timer if still running.
   @param {HTMLElement} toast  The .toast-item element to dismiss.
   @returns {void}
══════════════════════════════════════════════════ */
function removeToast(toast) {
  if (!toast || !toast.parentElement) return;
  if (toast._timerId) clearTimeout(toast._timerId);
  toast.style.animation = 'kawaiiOut .25s cubic-bezier(.36,.07,.19,.97) forwards';
  setTimeout(() => toast.remove(), 240);
}

/* ══════════════════════════════════════════════════
   UNDO SYSTEM
   Internal queue: Map<id, { timer, onCommit, onUndo, el }>

   showToastWithUndo  — shows a warn toast with "Hoàn tác" button
   cancelUndo(id)     — called when user clicks Undo; fires onUndo callback
   commitUndo(id)     — called on timeout or close btn; fires onCommit callback

   @param {string}   msg       Action description shown in toast
   @param {Function} onUndo    Callback fired when user cancels the action
   @param {Function} onCommit  Callback fired when timer expires (action confirmed)
   @param {number}   [delay]   ms before committing. Default 5000.
══════════════════════════════════════════════════ */
const _undoQueue = new Map();

function showToastWithUndo(msg, onUndo, onCommit, delay = 5000) {
  const id = Date.now();
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const el = document.createElement('div');
  el.className = 'toast-item toast-warn';
  el.id = `toast-undo-${id}`;

  // Build pieces safely
  const iconSpan = document.createElement('span');
  iconSpan.className = 'toast-icon';
  // Trash bin — cute rounded style with lid handle and stripes
  iconSpan.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- lid handle -->
    <path d="M8.5 3.5 Q8.5 2.5 10 2.5 Q11.5 2.5 11.5 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"/>
    <!-- lid -->
    <rect x="4" y="4" width="12" height="2.5" rx="1.25" fill="currentColor" fill-opacity="0.3" stroke="currentColor" stroke-width="1.4"/>
    <!-- bin body -->
    <path d="M5.5 6.5 L6.5 16.5 Q6.6 17.5 7.5 17.5 H12.5 Q13.4 17.5 13.5 16.5 L14.5 6.5 Z"
      fill="currentColor" fill-opacity="0.12" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
    <!-- cute stripes inside -->
    <path d="M9 9 V15" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity="0.6"/>
    <path d="M11 9 V15" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity="0.6"/>
  </svg>`;

  const msgSpan = document.createElement('span');
  msgSpan.className = 'toast-msg';
  msgSpan.textContent = msg;

  const undoBtn = document.createElement('button');
  undoBtn.className = 'toast-undo-btn';
  undoBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <polyline points="4.5 7 2 4.5 4.5 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M10 10 V6 A4 4 0 0 0 2 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
  </svg> Hoàn tác`;
  undoBtn.onclick = () => cancelUndo(id);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.innerHTML = `<svg width="9" height="9" viewBox="0 0 9 9" fill="none">
    <path d="M1.5 1.5 L7.5 7.5 M7.5 1.5 L1.5 7.5"
      stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`;
  closeBtn.setAttribute('aria-label', 'Đóng / Xác nhận');
  closeBtn.onclick = () => commitUndo(id);

  const progress = document.createElement('div');
  progress.className = 'toast-progress';
  progress.style.animationDuration = delay + 'ms';

  el.append(iconSpan, msgSpan, undoBtn, closeBtn, progress);
  container.appendChild(el);

  const timer = setTimeout(() => commitUndo(id), delay);
  _undoQueue.set(id, { timer, onCommit, onUndo, el });
}

function cancelUndo(id) {
  const entry = _undoQueue.get(id);
  if (!entry) return;
  clearTimeout(entry.timer);
  removeToast(entry.el);
  _undoQueue.delete(id);
  if (entry.onUndo) entry.onUndo();
  showToast('Đã hoàn tác!', 'success');
}

function commitUndo(id) {
  const entry = _undoQueue.get(id);
  if (!entry) return;
  clearTimeout(entry.timer);
  removeToast(entry.el);
  _undoQueue.delete(id);
  if (entry.onCommit) entry.onCommit();
}

/* ══ Expose globally ══ */
window.showToast = showToast;
window.showToastWithUndo = showToastWithUndo;

/* ══════════════════════════════════════════════════
   USAGE EXAMPLES
   ──────────────────────────────────────────────────

   // Basic — auto-detect type from message text:
   showToast('Đã lưu thành công!');
   showToast('Lỗi kết nối máy chủ!');
   showToast('Vui lòng điền đầy đủ thông tin');

   // Explicit type:
   showToast('Quiz đã được tạo', 'success');
   showToast('File quá lớn', 'error');
   showToast('Chú ý: dữ liệu chưa lưu', 'warn');
   showToast('Phiên bản mới đã ra mắt', 'info');

   // Custom duration (ms):
   showToast('Sao chép thành công!', 'success', 2000);

   // Undo toast — commits after 5s if not cancelled:
   showToastWithUndo(
     'Đã xóa câu hỏi số 3',
     () => restoreQuestion(3),
     () => deleteFromDB(3),
     5000
   );

   ──────────────────────────────────────────────────
   CHANGELOG
   ──────────────────────────────────────────────────
   v2.0.0
     + Redesigned icons: bunny (success), bear (warn),
       cat (error), star face (info) — pure SVG paths
     + Added bonus icons: love (heart eyes), loading (sleepy zzz)
     + Expanded JSDoc, keyword table, usage examples
     - No emoji, no external assets, Babel standalone safe

   v1.0.0
     + Initial release: kawaii face icons (circle/triangle variants)
     + showToast with auto-detect, debounce, dedup, max-2 limit per screen
     + showToastWithUndo with commit/cancel callbacks
     + Progress bar, close button, dark mode, One UI theme support

   ──────────────────────────────────────────────────
   ACCESSIBILITY NOTES
   ──────────────────────────────────────────────────
   - Toast messages use textContent (not innerHTML) — XSS-safe.
   - Close button has aria-label="Close" for screen readers.
   - Undo close button has aria-label="Đóng / Xác nhận".
   - Recommended: add role="status" aria-live="polite" to #toastContainer
     so screen readers announce new toasts automatically:
     <div id="toastContainer" role="status" aria-live="polite"></div>
══════════════════════════════════════════════════ */