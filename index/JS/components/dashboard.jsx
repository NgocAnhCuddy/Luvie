import React from 'react';
import { NotesScreen } from './notes.jsx';

/* ══════════════════════════════════════════════════════════════════
   DASHBOARD.JS  ·  Learnsy · Student Dashboard v2 🌸
   Theme: Bánh Bèo Edition — kawaii pastel, bubbly & adorable ✨
   ~90kB · Thêm vào index/JS/components/dashboard.js
══════════════════════════════════════════════════════════════════ */

/* ══ LITE MODE — CSS override để tắt hiệu ứng nặng ══ */
function injectLiteCSS(enable){
  const ID='bb-lite-css';
  if(!enable){ const el=document.getElementById(ID); if(el)el.remove(); return; }
  if(document.getElementById(ID))return;
  const s=document.createElement('style');
  s.id=ID;
  s.textContent=`
    /* Tắt toàn bộ animation */
    *, *::before, *::after {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.08s !important;
    }
    /* Tắt backdrop-filter nặng */
    [style*="backdrop-filter"], [style*="backdropFilter"] {
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }
    /* Tắt box-shadow phức tạp */
    .bb-card-tap { box-shadow: none !important; }
    .bb-card-tap:hover { transform: none !important; }
    .bb-card-tap:active { transform: scale(0.97) !important; }
    /* Tắt shimmer, heartbeat, float, wiggle */
    .bb-btn-tap:active { transform: scale(0.94) !important; }
    @media(hover:hover){ .bb-btn-tap:hover { filter: none !important; } }
    /* Tắt blur trên nav/topbar */
    nav[style] { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
  `;
  document.head.appendChild(s);
}

/* ══ DEVICE PERFORMANCE DETECTOR ══ */
async function detectDevicePerformance(){
  const result={ score:100, reason:[] };

  /* 1. RAM — navigator.deviceMemory (Chrome/Android) */
  const ram=navigator.deviceMemory;
  if(ram!=null){
    if(ram<=1){ result.score-=40; result.reason.push(`RAM thấp (${ram}GB)`); }
    else if(ram<=2){ result.score-=20; result.reason.push(`RAM hạn chế (${ram}GB)`); }
  }

  /* 2. CPU cores */
  const cores=navigator.hardwareConcurrency;
  if(cores!=null){
    if(cores<=2){ result.score-=25; result.reason.push(`CPU yếu (${cores} core)`); }
    else if(cores<=4){ result.score-=10; }
  }

  /* 3. Network */
  const conn=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
  if(conn){
    if(conn.effectiveType==='2g'||conn.effectiveType==='slow-2g'){ result.score-=20; result.reason.push('Mạng chậm (2G)'); }
    else if(conn.effectiveType==='3g'){ result.score-=8; }
    if(conn.saveData){ result.score-=15; result.reason.push('Chế độ tiết kiệm dữ liệu'); }
  }

  /* 4. FPS test — đo 40 frame, trigger liteMode nếu fps 30-40 */
  await new Promise(res=>{
    let frames=0, start=performance.now(), last=start;
    function tick(now){
      frames++;
      last=now;
      if(frames<40) requestAnimationFrame(tick);
      else res(last-start);
    }
    requestAnimationFrame(tick);
  }).then(elapsed=>{
    const fps=Math.round(40/(elapsed/1000));
    result.fps=fps;
    if(fps<30){       result.score-=35; result.reason.push(`FPS thấp (~${fps}fps)`); }
    else if(fps<=40){ result.score-=18; result.reason.push(`FPS trung bình (~${fps}fps)`); }
    else if(fps<55){  result.score-=6; }
  }).catch(()=>{});

  /* Kết luận — isLow cũng bắt luôn fps 30-40 */
  result.isLow = result.score < 65 || (result.fps!=null && result.fps<=40);
  result.label = result.isLow
    ? 'Máy yếu — nên bật Lite Mode'
    : result.score < 80
      ? 'Máy trung bình — có thể bật Lite Mode'
      : 'Máy mạnh — không cần Lite Mode';
  return result;
}

/* ══ runLoginPerfCheck — gọi ngay khi user nhấn đăng nhập ══
   index.html dùng: await window.bbRunLoginPerfCheck()
   Trả về { liteMode: bool, fps: number, reason: string[] }
   Tự apply liteMode + lưu localStorage nếu máy yếu.         */
async function runLoginPerfCheck(){
  /* Không chạy lại nếu user đã tự set thủ công trong session này */
  if(sessionStorage.getItem('bb-perf-checked')==='1'){
    const stored=localStorage.getItem('bb-lite-mode')==='1';
    return{ liteMode:stored, fps:null, reason:[] };
  }
  const res=await detectDevicePerformance();
  sessionStorage.setItem('bb-perf-checked','1');
  if(res.isLow){
    localStorage.setItem('bb-lite-mode','1');
    /* Inject CSS ngay lập tức — trước khi React mount Dashboard */
    if(typeof injectLiteCSS==='function') injectLiteCSS(true);
  }
  return{ liteMode:res.isLow, fps:res.fps, reason:res.reason, score:res.score };
}
window.bbRunLoginPerfCheck=runLoginPerfCheck;

(function(){
const {useState,useEffect,useRef,useCallback,useMemo}=React;

/* ══ INJECT GLOBAL STYLES ══ */
(function injectGlobalCSS(){
  if(document.getElementById('bb-global-css'))return;
  const s=document.createElement('style');
  s.id='bb-global-css';
  s.textContent=`
    @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Baloo+2:wght@400;500;600;700;800&display=swap');

    @keyframes bb-spin { to { transform: rotate(360deg); } }
    @keyframes bb-bounce {
      0%,100% { transform: translateY(0) scale(1); }
      40% { transform: translateY(-8px) scale(1.06); }
      60% { transform: translateY(-4px) scale(1.02); }
    }
    @keyframes bb-float {
      0%,100% { transform: translateY(0px) rotate(-2deg); }
      50% { transform: translateY(-7px) rotate(2deg); }
    }
    @keyframes bb-wiggle {
      0%,100% { transform: rotate(0deg); }
      20% { transform: rotate(-9deg); }
      40% { transform: rotate(9deg); }
      60% { transform: rotate(-5deg); }
      80% { transform: rotate(5deg); }
    }
    @keyframes bb-pop {
      0% { transform: scale(0.7); opacity:0; }
      60% { transform: scale(1.12); opacity:1; }
      100% { transform: scale(1); opacity:1; }
    }
    @keyframes bb-fadeUp {
      from { opacity:0; transform: translateY(18px); }
      to   { opacity:1; transform: translateY(0); }
    }
    /* ── Tab swipe transitions (kiểu native app) ── */
    @keyframes bb-slide-in-right {
      from { opacity:0; transform: translate3d(28px,0,0); }
      to   { opacity:1; transform: translate3d(0,0,0); }
    }
    @keyframes bb-slide-in-left {
      from { opacity:0; transform: translate3d(-28px,0,0); }
      to   { opacity:1; transform: translate3d(0,0,0); }
    }
    @keyframes bb-shimmer {
      0% { background-position: -200% center; }
      100% { background-position: 200% center; }
    }
    @keyframes bb-heartbeat {
      0%,100% { transform: scale(1); }
      14% { transform: scale(1.2); }
      28% { transform: scale(1); }
      42% { transform: scale(1.14); }
      70% { transform: scale(1); }
    }
    @keyframes bb-sparkle-rotate {
      0% { transform: rotate(0deg) scale(1); }
      50% { transform: rotate(180deg) scale(1.22); }
      100% { transform: rotate(360deg) scale(1); }
    }
    @keyframes bb-confetti-fall {
      0% { transform: translateY(-10px) rotate(0deg); opacity:1; }
      100% { transform: translateY(60px) rotate(360deg); opacity:0; }
    }
    @keyframes bb-scanline {
      0%   { transform: translateY(-120%); opacity:0; }
      15%  { opacity:1; }
      85%  { opacity:1; }
      100% { transform: translateY(420%); opacity:0; }
    }
    @keyframes bb-pulse-ring {
      0% { box-shadow: 0 0 0 0 rgba(244,114,182,0.45); }
      70% { box-shadow: 0 0 0 12px rgba(244,114,182,0); }
      100% { box-shadow: 0 0 0 0 rgba(244,114,182,0); }
    }
    @keyframes bb-gradient-move {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    @keyframes bb-jelly {
      0%,100% { transform: scale(1,1); }
      25% { transform: scale(0.94,1.06); }
      50% { transform: scale(1.06,0.94); }
      75% { transform: scale(0.97,1.03); }
    }
    @keyframes bb-star-twinkle {
      0%,100% { opacity:1; transform:scale(1); }
      50% { opacity:0.35; transform:scale(0.65); }
    }

    /* ── HUD Effects ── */
    @keyframes hud-glitch-1 {
      0%,100% { clip-path:inset(0 0 100% 0); transform:translate(0,0); }
      20%     { clip-path:inset(15% 0 60% 0); transform:translate(-2px,0); }
      40%     { clip-path:inset(50% 0 25% 0); transform:translate(2px,0); }
      60%     { clip-path:inset(75% 0 5%  0); transform:translate(-1px,0); }
      80%     { clip-path:inset(90% 0 0   0); transform:translate(1px,0); }
    }
    @keyframes hud-glitch-2 {
      0%,100% { clip-path:inset(0 0 100% 0); transform:translate(0,0); }
      20%     { clip-path:inset(60% 0 15% 0); transform:translate(2px,0); }
      40%     { clip-path:inset(25% 0 50% 0); transform:translate(-2px,0); }
      60%     { clip-path:inset(5%  0 75% 0); transform:translate(1px,0); }
      80%     { clip-path:inset(0   0 90% 0); transform:translate(-1px,0); }
    }
    @keyframes hud-glitch-run {
      0%  { opacity:1; }
      8%  { opacity:1; }
      9%  { opacity:0; }
      10% { opacity:1; }
      90% { opacity:1; }
      91% { opacity:0; }
      92% { opacity:1; }
      100%{ opacity:1; }
    }
    @keyframes hud-cursor-blink {
      0%,49% { opacity:1; }
      50%,100%{ opacity:0; }
    }
    @keyframes hud-radar-sweep {
      from { stroke-dashoffset: var(--circ); opacity:0.85; }
      to   { stroke-dashoffset: 0;           opacity:0; }
    }
    @keyframes di-pill-in {
      0%   { width:36px; height:36px; border-radius:50%; opacity:0; transform:translateX(-50%) scaleY(0.6); }
      20%  { width:36px; height:36px; border-radius:50%; opacity:1; transform:translateX(-50%) scaleY(1); }
      55%  { width:260px; height:52px; border-radius:26px; opacity:1; transform:translateX(-50%) scaleY(1); }
      100% { width:280px; height:56px; border-radius:28px; opacity:1; transform:translateX(-50%) scaleY(1); }
    }
    @keyframes di-pill-out {
      0%   { width:280px; height:56px; border-radius:28px; opacity:1; transform:translateX(-50%) scaleY(1); }
      40%  { width:260px; height:52px; border-radius:26px; opacity:1; transform:translateX(-50%) scaleY(1); }
      75%  { width:36px;  height:36px; border-radius:50%; opacity:1; transform:translateX(-50%) scaleY(1); }
      100% { width:36px;  height:36px; border-radius:50%; opacity:0; transform:translateX(-50%) scaleY(0.6); }
    }
    @keyframes di-content-in {
      0%,40% { opacity:0; transform:scale(0.8) translateY(4px); }
      100%   { opacity:1; transform:scale(1) translateY(0); }
    }
    @keyframes di-icon-pulse {
      0%,100% { transform:scale(1); }
      50%     { transform:scale(1.18); }
    }
    @keyframes di-glow-pulse {
      0%,100% { opacity:0.5; }
      50%     { opacity:1; }
    }
    /* Nhấp nháy kiểu "kích hoạt" — chạy 1 lần khi achievement toast xuất hiện */
    @keyframes di-activate-flicker {
      0%   { opacity:1; filter:brightness(1); }
      6%   { opacity:0.15; filter:brightness(2.2); }
      12%  { opacity:1; filter:brightness(1); }
      18%  { opacity:0.2; filter:brightness(2.4); }
      26%  { opacity:1; filter:brightness(1); }
      34%  { opacity:0.4; filter:brightness(1.8); }
      42%  { opacity:1; filter:brightness(1); }
      100% { opacity:1; filter:brightness(1); }
    }
    /* Nhấp nháy nhẹ liên tục — giống hệt kiểu chữ "DEV ISLAND" trong learnsy-dev-island.jsx */
    @keyframes bb-blink {
      0%,100% { opacity:1; }
      50%     { opacity:.32; }
    }
    /* Khi "kích hoạt" (mở khoá thành tích) — TOÀN BỘ icon SVG trên trang nhấp nháy cùng lúc */
    body.bb-activate-all svg {
      animation: di-activate-flicker .65s steps(1,end) 1 both !important;
    }

    .bb-btn-tap { transition: transform 0.12s !important; }
    .bb-btn-tap:active { transform: scale(0.92) !important; }
    @media(hover:hover){ .bb-btn-tap:hover { filter: brightness(1.06); } }
    .bb-card-tap { transition: transform 0.15s cubic-bezier(.34,1.56,.64,1), box-shadow 0.15s !important; }
    .bb-card-tap:hover { transform: translateY(-2px) scale(1.01) !important; }
    .bb-card-tap:active { transform: scale(0.97) !important; }

    .bb-input::placeholder { color: rgba(244,114,182,0.42); font-family: Nunito,sans-serif; }
    .bb-input:focus {
      border-color: #f472b6 !important;
      box-shadow: 0 0 0 3px rgba(244,114,182,0.18) !important;
    }
    .bb-scroll-hide::-webkit-scrollbar { display:none; }
    .bb-scroll-hide { -ms-overflow-style:none; scrollbar-width:none; }

    .bb-tab-btn { all:unset; cursor:pointer; -webkit-tap-highlight-color:transparent; }
    .bb-tab-btn:active { transform:scale(0.93); }
    .bb-dm-btn { all:unset; cursor:pointer; }

    .bb-sticker {
      display:inline-flex; align-items:center; justify-content:center; gap:4px;
      border-radius:999px; font-weight:800; letter-spacing:0.3px;
      transition: transform 0.18s cubic-bezier(.34,1.56,.64,1);
      font-family: Nunito, sans-serif;
    }
    .bb-sticker:hover { transform: scale(1.09) rotate(2deg); }

    .bb-toggle-track {
      width:50px; height:28px; border-radius:99px; cursor:pointer;
      transition: background 0.25s, box-shadow 0.25s;
      position:relative; flex-shrink:0;
    }
    .bb-toggle-thumb {
      position:absolute; top:4px; width:20px; height:20px;
      border-radius:50%; background:#fff;
      transition: left 0.25s cubic-bezier(.34,1.56,.64,1);
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      display:flex; align-items:center; justify-content:center;
      font-size:11px; line-height:1;
    }

    .bb-section-title {
      font-family: 'Baloo 2', cursive;
      font-size:16px; font-weight:700; letter-spacing:0.2px;
    }
    .bb-hero-name {
      font-family: 'Baloo 2', cursive;
      font-size:22px; font-weight:800; line-height:1.2;
    }
    .bb-logo-text {
      font-family: 'Baloo 2', cursive;
      font-weight:800; letter-spacing:1px;
    }
    .bb-logo-wrap { display:inline-flex; flex-direction:column; align-items:flex-start; line-height:1; }
    .bb-logo-taNa {
      font-family:'Satisfy','Dancing Script','Brush Script MT',cursive; font-weight:400; letter-spacing:0;
      background:linear-gradient(100deg,#5cc791 0%,#a4ac71 38%,#ef8e59 72%,#e0907a 100%);
      -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
      display:inline-block; padding:.06em .2em .12em .06em; line-height:1.1;
    }
    .bb-logo-sub {
      font-size:7px; font-weight:800; letter-spacing:.2px; color:#B090C8;
      margin-top:1px; opacity:.75; white-space:nowrap;
    }
    .bb-score-big {
      font-family: 'Baloo 2', cursive;
      font-weight:800; line-height:1;
    }
  `;
  document.head.appendChild(s);
})();

/* ══ SVG ICON LIBRARY ══ */
const Icons={
  home:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em"><path d="M3 9.5L12 3l9 6.5V21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>),
  stats:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>),
  history:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/></svg>),
  settings:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>),
  sun:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>),
  moon:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>),
  book:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>),
  lock:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>),
  search:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>),
  shuffle:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>),
  check:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em"><polyline points="20 6 9 17 4 12"/></svg>),
  star:(<svg viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>),
  trophy:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em"><polyline points="8 21 12 21 16 21"/><line x1="12" y1="17" x2="12" y2="21"/><path d="M7 4H4a2 2 0 0 0-2 2v2c0 3.31 2.69 6 6 6"/><path d="M17 4h3a2 2 0 0 1 2 2v2c0 3.31-2.69 6-6 6"/><path d="M7 4h10v8a5 5 0 0 1-10 0V4z"/></svg>),
  fire:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>),
  trending:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>),
  target:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>),
  edit:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>),
  folder:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>),
  logout:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>),
  spinner:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="1em" height="1em" style={{animation:'bb-spin 1s linear infinite'}}><path d="M12 2a10 10 0 1 0 10 10"/></svg>),
  sad:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>),
  thumbsup:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>),
  medal:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em"><circle cx="12" cy="14" r="6"/><path d="M9 2h6l1 7H8L9 2z"/><line x1="12" y1="14" x2="12" y2="14"/></svg>),
  learnsy:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>),
  greetNight:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/><path d="M17 17l.01 0"/></svg>),
  greetMorning:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>),
  greetNoon:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em"><path d="M17 18a5 5 0 0 0-10 0"/><line x1="12" y1="9" x2="12" y2="2"/><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/><line x1="1" y1="18" x2="3" y2="18"/><line x1="21" y1="18" x2="23" y2="18"/><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/></svg>),
  greetAfternoon:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em"><path d="M3 15h18M5.5 15C5.5 11.41 8.41 8.5 12 8.5s6.5 2.91 6.5 6.5"/><circle cx="12" cy="6" r="2"/></svg>),
  greetEvening:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em"><rect x="2" y="7" width="20" height="15" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>),
  sparkle:(<svg viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em"><path d="M12 0L14.59 9.41 24 12l-9.41 2.59L12 24l-2.59-9.41L0 12l9.41-2.59z"/></svg>),
  heart:(<svg viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>),
  cloud:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>),
  gift:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>),
  smile:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em"><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>),
  zap:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>),
  ribbon:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>),
  dice:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em"><rect x="2" y="2" width="20" height="20" rx="3"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/><circle cx="16" cy="8" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="8" cy="16" r="1.2" fill="currentColor"/><circle cx="16" cy="16" r="1.2" fill="currentColor"/></svg>),
  feather:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/></svg>),
  cpu:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>),
  headphones:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>),
  chevronRight:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em"><polyline points="9 18 15 12 9 6"/></svg>),
};

/* ── Icon component ── */
function Icon({name,size=20,color,style={}}){
  const icon=Icons[name]||Icons.sparkle;
  return(
    <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',
      width:size,height:size,fontSize:size,color:color||'currentColor',flexShrink:0,...style}}>
      {icon}
    </span>
  );
}

/* ══ HUD: GlitchText ══
   Render text bình thường + 2 pseudo-layer glitch qua CSS.
   liteMode → bỏ qua, chỉ render text thẳng.                */
function GlitchText({children,color,style={},liteMode}){
  if(liteMode){
    return(
      <span style={{fontFamily:"'Baloo 2',cursive",fontWeight:800,color,...style}}>
        {children}
      </span>
    );
  }
  /* Dùng inline span xếp chồng — không cần pseudo vì JSX không hỗ trợ ::before/::after */
  const base={
    position:'absolute',top:0,left:0,width:'100%',
    fontFamily:"'Baloo 2',cursive",fontWeight:800,
    overflow:'hidden',whiteSpace:'nowrap',
    pointerEvents:'none',
  };
  return(
    <span style={{position:'relative',display:'inline-block',fontFamily:"'Baloo 2',cursive",fontWeight:800,color,...style}}>
      {/* base text */}
      <span style={{visibility:'visible'}}>{children}</span>
      {/* glitch layer 1 — lệch đỏ */}
      <span aria-hidden="true" style={{
        ...base,color:'rgba(255,80,120,0.55)',
        animation:'hud-glitch-1 4s steps(1) infinite',
        mixBlendMode:'screen',
      }}>{children}</span>
      {/* glitch layer 2 — lệch lam */}
      <span aria-hidden="true" style={{
        ...base,color:'rgba(120,160,255,0.45)',
        animation:'hud-glitch-2 4s steps(1) 0.15s infinite',
        mixBlendMode:'screen',
      }}>{children}</span>
    </span>
  );
}

/* ══ HUD: SearchInput với cursor nhấp nháy ══ */
function HudSearchInput({value,onChange,dark,liteMode}){
  const [focused,setFocused]=useState(false);
  const C=dark?CD:CL;
  const showCursor=!focused&&!value; /* chỉ show khi rỗng + không focus */
  return(
    <div style={{position:'relative'}}>
      <span style={{position:'absolute',left:13,top:'50%',transform:'translateY(-50%)',
        pointerEvents:'none',display:'flex',alignItems:'center'}}>
        <Icon name='search' size={15}
          color={dark?'rgba(244,114,182,0.45)':'rgba(200,100,140,0.45)'}/>
      </span>
      <input value={value} onChange={onChange}
        onFocus={()=>setFocused(true)}
        onBlur={()=>setFocused(false)}
        placeholder={showCursor?'':undefined}
        className="bb-input"
        style={{
          width:'100%',padding:'10px 14px 10px 36px',borderRadius:18,
          border:`1.5px solid ${dark?'rgba(244,114,182,0.22)':'rgba(244,114,182,0.28)'}`,
          background:C.inputBg,color:C.fg,fontSize:13,outline:'none',
          fontFamily:'Nunito,sans-serif',fontWeight:600,
          boxSizing:'border-box',transition:'border-color .2s,box-shadow .2s',
        }}/>
      {/* Fake placeholder + cursor khi rỗng chưa focus */}
      {showCursor&&(
        <span style={{
          position:'absolute',left:36,top:'50%',transform:'translateY(-50%)',
          pointerEvents:'none',display:'flex',alignItems:'center',gap:0,
          color:'rgba(244,114,182,0.42)',fontSize:13,fontFamily:'Nunito,sans-serif',fontWeight:600,
        }}>
          Tìm bài học cute
          {!liteMode&&(
            <span style={{
              display:'inline-block',width:1.5,height:13,
              background:'rgba(244,114,182,0.7)',marginLeft:1,borderRadius:1,
              animation:'hud-cursor-blink 1s step-start infinite',
            }}/>
          )}
          <span style={{opacity:0.5}}>...</span>
        </span>
      )}
    </div>
  );
}
const CL={
  fg:'#2d1420',
  sub:'#a06080',
  card:'rgba(255,255,255,0.78)',
  cardBlur:'blur(8px)',
  cardBorder:'rgba(255,182,210,0.4)',
  inputBg:'rgba(255,255,255,0.9)',
  navBg:'rgba(255,245,250,0.9)',
  accent:'#f472b6',
  accent2:'#a855f7',
  danger:'#ef4444',
  tagBg:'rgba(244,114,182,0.12)',
};
const CD={
  fg:'#fce4f0',
  sub:'rgba(255,200,220,0.62)',
  card:'rgba(255,255,255,0.06)',
  cardBlur:'blur(8px)',
  cardBorder:'rgba(244,114,182,0.22)',
  inputBg:'rgba(255,255,255,0.08)',
  navBg:'rgba(20,6,15,0.86)',
  accent:'#f472b6',
  accent2:'#c084fc',
  danger:'#f87171',
  tagBg:'rgba(244,114,182,0.14)',
};

/* ══ HELPERS ══ */
const fmtDate=ts=>{
  if(!ts)return'—';
  return new Date(ts).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'});
};
const fmtTime=ts=>{
  if(!ts)return'';
  return new Date(ts).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'});
};
const pctColor=p=>{
  if(p>=90)return'#10b981';
  if(p>=70)return'#f59e0b';
  if(p>=50)return'#f472b6';
  return'#ef4444';
};
const pctLabel=p=>{
  if(p>=90)return'Xuất sắc';
  if(p>=70)return'Giỏi lắm';
  if(p>=50)return'Cố lên nha';
  return'Thử lại nhé';
};
const rankBadge=pct=>{
  if(pct>=95)return{icon:'trophy',label:'Vàng',  color:'#f59e0b',glow:'rgba(245,158,11,0.4)', gradient:'linear-gradient(135deg,#fde68a,#f59e0b,#d97706)'};
  if(pct>=80)return{icon:'medal', label:'Bạc',   color:'#94a3b8',glow:'rgba(148,163,184,0.4)',gradient:'linear-gradient(135deg,#e2e8f0,#94a3b8,#64748b)'};
  if(pct>=60)return{icon:'ribbon',label:'Đồng',  color:'#cd7c4b',glow:'rgba(205,124,75,0.4)', gradient:'linear-gradient(135deg,#fed7aa,#cd7c4b,#92400e)'};
  return       {icon:'star',  label:'Tập sự',color:'#34d399',glow:'rgba(52,211,153,0.4)',  gradient:'linear-gradient(135deg,#a7f3d0,#34d399,#059669)'};
};
const toScore=pct=>+(pct/10).toFixed(1);
const fmtScore=pct=>{const s=toScore(pct);return s%1===0?String(s|0):s.toFixed(1);};

/* ══ ACRYLIC 3D AVATAR CARD ══
   Thẻ mica trong suốt, viền neon phát sáng khi dark mode, tilt 3D theo con trỏ/chạm.
   Bọc quanh LetterAvatar hiện có — không đổi logic upload/avatar.js. */
function AcrylicAvatarCard({name,avatarUrl,dark,size=58,liteMode,verified=true}){
  const ref=useRef(null);
  const [tilt,setTilt]=useState({rx:0,ry:0,mx:50,my:50});
  const resetTilt=useCallback(()=>setTilt({rx:0,ry:0,mx:50,my:50}),[]);

  const handleMove=useCallback((clientX,clientY)=>{
    if(liteMode||!ref.current)return;
    const r=ref.current.getBoundingClientRect();
    const px=(clientX-r.left)/r.width;
    const py=(clientY-r.top)/r.height;
    const ry=(px-0.5)*18;   // rotateY
    const rx=(0.5-py)*14;   // rotateX
    setTilt({rx,ry,mx:px*100,my:py*100});
  },[liteMode]);

  const glowColor=dark?'rgba(244,114,182,0.55)':'rgba(168,85,247,0.35)';
  const cardBg=dark
    ?'linear-gradient(135deg,rgba(255,255,255,0.10),rgba(244,114,182,0.06) 40%,rgba(168,85,247,0.10))'
    :'linear-gradient(135deg,rgba(255,255,255,0.75),rgba(252,231,243,0.55) 40%,rgba(233,213,255,0.65))';
  const borderColor=dark?'rgba(244,114,182,0.45)':'rgba(168,85,247,0.3)';

  return(
    <div
      ref={ref}
      onMouseMove={e=>handleMove(e.clientX,e.clientY)}
      onMouseLeave={resetTilt}
      onTouchMove={e=>{const t=e.touches[0];if(t)handleMove(t.clientX,t.clientY);}}
      onTouchEnd={resetTilt}
      style={{
        position:'relative',flexShrink:0,
        width:size+22,height:size+22,
        perspective:600,
      }}
    >
      <div style={{
        position:'relative',width:'100%',height:'100%',borderRadius:22,
        transformStyle:'preserve-3d',
        transform:`rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
        transition: liteMode ? 'none' : 'transform .25s cubic-bezier(.2,.8,.2,1)',
        background:cardBg,
        backdropFilter: liteMode?'none':'blur(6px)',
        WebkitBackdropFilter: liteMode?'none':'blur(6px)',
        border:`1.4px solid ${borderColor}`,
        boxShadow: dark
          ? `0 0 18px ${glowColor}, 0 0 4px rgba(244,114,182,0.5), 0 6px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.18)`
          : `0 6px 20px rgba(168,85,247,0.18), inset 0 1px 0 rgba(255,255,255,0.6)`,
        display:'flex',alignItems:'center',justifyContent:'center',
        overflow:'hidden',
      }}>
        {!liteMode&&(
          <div style={{
            position:'absolute',inset:0,pointerEvents:'none',borderRadius:22,
            background:`radial-gradient(circle at ${tilt.mx}% ${tilt.my}%, rgba(255,255,255,${dark?0.28:0.5}) 0%, transparent 55%)`,
            mixBlendMode:dark?'screen':'overlay',
          }}/>
        )}
        {dark&&(
          <div style={{
            position:'absolute',inset:-1,borderRadius:22,pointerEvents:'none',
            boxShadow:'0 0 12px rgba(244,114,182,0.35), 0 0 22px rgba(168,85,247,0.25)',
            opacity:liteMode?0.4:0.85,
          }}/>
        )}
        {verified&&(
          <div style={{
            position:'absolute',top:3,right:3,width:14,height:14,borderRadius:'50%',
            background:'linear-gradient(135deg,#fde68a,#f59e0b)',
            display:'flex',alignItems:'center',justifyContent:'center',
            boxShadow:'0 2px 6px rgba(245,158,11,0.5)',zIndex:2,
          }}>
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#78350f" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        )}
        <div style={{transform:'translateZ(16px)',position:'relative'}}>
          <LetterAvatar name={name} size={size} dark={dark} animate avatarUrl={avatarUrl}/>
        </div>
      </div>
    </div>
  );
}

/* ══ ID CARD FULL MODAL — thẻ acrylic 3D full-size, phong cách hologram ══
   Bấm vào avatar ở hero để mở. Ảnh thật (nếu có) được phủ filter neon/wireframe;
   nếu không có ảnh, fallback ra LetterAvatar phóng to bên trong khung hologram. */
function IdCardFullModal({student,avatarUrl,dark,liteMode,avgPct,streak,badge,totalDone,onClose}){
  const cardRef=useRef(null);
  const [tilt,setTilt]=useState({rx:0,ry:0,mx:50,my:50});
  const resetTilt=useCallback(()=>setTilt({rx:6,ry:0,mx:50,my:35}),[]);
  useEffect(()=>{resetTilt();},[resetTilt]);

  const handleMove=useCallback((clientX,clientY)=>{
    if(liteMode||!cardRef.current)return;
    const r=cardRef.current.getBoundingClientRect();
    const px=(clientX-r.left)/r.width;
    const py=(clientY-r.top)/r.height;
    setTilt({rx:(0.5-py)*14,ry:(px-0.5)*20,mx:px*100,my:py*100});
  },[liteMode]);

  const name=student?.display_name||student?.username||'Học sinh';

  return(
    <div style={{
      position:'fixed',inset:0,zIndex:6000,
      background:'radial-gradient(circle at 50% 30%, rgba(40,10,30,0.92), rgba(0,0,0,0.96))',
      display:'flex',alignItems:'center',justifyContent:'center',
      animation:'bb-fadeUp .2s ease both',padding:24,
    }} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>

      {/* Nút đóng */}
      <button onClick={onClose} style={{
        position:'absolute',top:20,right:20,width:36,height:36,borderRadius:'50%',
        background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',
        display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',zIndex:2,
        transition:'all .15s',
      }}
        onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,0.2)';e.currentTarget.style.transform='scale(1.08)';}}
        onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.1)';e.currentTarget.style.transform='scale(1)';}}
        onMouseDown={e=>e.currentTarget.style.transform='scale(0.9)'}
        onMouseUp={e=>e.currentTarget.style.transform='scale(1.08)'}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>

      {/* Sparkle trang trí góc */}
      <div style={{position:'absolute',bottom:'12%',right:'8%',opacity:0.6,animation:liteMode?'none':'bb-sparkle-rotate 4s linear infinite'}}>
        <Icon name="sparkle" size={26} color="#fff"/>
      </div>

      <div style={{perspective:900,width:'100%',maxWidth:300}}>
        <div
          ref={cardRef}
          onMouseMove={e=>handleMove(e.clientX,e.clientY)}
          onMouseLeave={resetTilt}
          onTouchMove={e=>{const t=e.touches[0];if(t)handleMove(t.clientX,t.clientY);}}
          onTouchEnd={resetTilt}
          style={{
            position:'relative',width:'100%',aspectRatio:'0.62',borderRadius:26,
            transformStyle:'preserve-3d',
            transform:`rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
            transition:liteMode?'none':'transform .3s cubic-bezier(.2,.8,.2,1)',
            background:'linear-gradient(150deg,rgba(255,255,255,0.10),rgba(244,114,182,0.05) 45%,rgba(168,85,247,0.10))',
            backdropFilter:liteMode?'none':'blur(10px)',
            WebkitBackdropFilter:liteMode?'none':'blur(10px)',
            border:'1.5px solid rgba(255,180,220,0.35)',
            boxShadow:`0 0 30px rgba(244,114,182,0.45), 0 0 60px rgba(168,85,247,0.25), 0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.25)`,
            overflow:'hidden',padding:'20px 18px',
            animation:'bb-fadeUp .3s cubic-bezier(.34,1.56,.64,1) both',
          }}
        >
          {/* Sheen theo con trỏ */}
          {!liteMode&&(
            <div style={{
              position:'absolute',inset:0,pointerEvents:'none',
              background:`radial-gradient(circle at ${tilt.mx}% ${tilt.my}%, rgba(255,255,255,0.22) 0%, transparent 50%)`,
              mixBlendMode:'screen',
            }}/>
          )}
          {/* Viền sáng chạy quanh mép — mô phỏng cạnh mica bắt đèn */}
          <div style={{position:'absolute',inset:0,borderRadius:26,pointerEvents:'none',
            background:'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.18) 48%, transparent 62%)',
            opacity:liteMode?0.3:0.8}}/>

          {/* ── Header: avatar nhỏ + tên + verified ── */}
          <div style={{display:'flex',alignItems:'center',gap:10,position:'relative',transform:'translateZ(20px)'}}>
            <div style={{width:38,height:38,borderRadius:'50%',flexShrink:0,overflow:'hidden',
              border:'1.5px solid rgba(255,255,255,0.5)',boxShadow:'0 0 10px rgba(244,114,182,0.6)'}}>
              <LetterAvatar name={name} size={38} dark={true} animate avatarUrl={avatarUrl}/>
            </div>
            <div style={{flex:1,minWidth:0,color:'#fff',fontFamily:"'Baloo 2',cursive",fontSize:17,fontWeight:800,
              overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',textShadow:'0 0 12px rgba(244,114,182,0.6)'}}>
              {name}
            </div>
            <div style={{width:26,height:26,borderRadius:'50%',flexShrink:0,
              background:'linear-gradient(135deg,#fde68a,#f59e0b)',
              display:'flex',alignItems:'center',justifyContent:'center',
              boxShadow:'0 0 10px rgba(245,158,11,0.7)'}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#78350f" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          </div>

          {/* ── Portrait lớn hologram wireframe ── */}
          <div style={{
            position:'relative',marginTop:16,borderRadius:22,overflow:'hidden',
            height:'52%',transform:'translateZ(14px)',
            background:'radial-gradient(circle at 50% 35%, rgba(244,114,182,0.14), rgba(0,0,0,0.35))',
            border:'1px solid rgba(255,150,200,0.25)',
          }}>
            {avatarUrl?(
              <img src={avatarUrl} alt={name} style={{
                width:'100%',height:'100%',objectFit:'cover',
                filter:liteMode
                  ?'saturate(1.4) contrast(1.1)'
                  :'saturate(0) contrast(1.3) brightness(1.05) drop-shadow(0 0 10px rgba(244,114,182,0.6))',
                mixBlendMode:liteMode?'normal':'luminosity',
                opacity:liteMode?1:0.92,
              }}/>
            ):(
              <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <div style={{transform:'scale(2.1)'}}>
                  <LetterAvatar name={name} size={64} dark={true} animate avatarUrl={avatarUrl}/>
                </div>
              </div>
            )}
            {/* Overlay lưới hologram + gradient màu neon quét qua ảnh */}
            {!liteMode&&(
              <>
                <div style={{position:'absolute',inset:0,pointerEvents:'none',mixBlendMode:'color',
                  background:'linear-gradient(135deg,#f472b6,#a855f7 50%,#22d3ee)'}}/>
                <div style={{position:'absolute',inset:0,pointerEvents:'none',opacity:0.25,
                  backgroundImage:'repeating-linear-gradient(0deg, rgba(255,255,255,0.5) 0 1px, transparent 1px 8px), repeating-linear-gradient(90deg, rgba(255,255,255,0.5) 0 1px, transparent 1px 8px)'}}/>
                <div style={{position:'absolute',left:0,right:0,height:'26%',pointerEvents:'none',
                  background:'linear-gradient(180deg, transparent, rgba(255,255,255,0.35), transparent)',
                  animation:'bb-scanline 2.6s ease-in-out infinite'}}/>
              </>
            )}
          </div>

          {/* ── Stats dưới thẻ ── */}
          <div style={{marginTop:14,position:'relative',transform:'translateZ(18px)',color:'rgba(255,255,255,0.85)'}}>
            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
              <span className="bb-sticker" style={{
                background:badge.gradient,color:'#fff',padding:'3px 10px',fontSize:10,
                boxShadow:`0 2px 8px ${badge.glow}`,display:'inline-flex',alignItems:'center',gap:4,
              }}>
                <Icon name={badge.icon} size={11} color="#fff"/>{badge.label}
              </span>
              {streak>0&&(
                <span className="bb-sticker" style={{
                  background:'linear-gradient(135deg,#fde68a,#fbbf24)',color:'#92400e',
                  padding:'3px 10px',fontSize:10,boxShadow:'0 2px 8px rgba(251,191,36,0.4)',
                  display:'inline-flex',alignItems:'center',gap:4,
                }}>
                  <Icon name="fire" size={11} color="#92400e"/>{streak} ngày
                </span>
              )}
            </div>
            <div style={{fontSize:10,letterSpacing:0.4,lineHeight:1.7,color:'rgba(255,255,255,0.55)',fontFamily:'monospace'}}>
              ID: {(student?.username||'guest').toUpperCase().slice(0,14)}<br/>
              ĐIỂM TB: {avgPct}/100 · ĐÃ HỌC: {totalDone} BÀI<br/>
              STATUS: ĐÃ XÁC THỰC
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* useAvatar, LetterAvatar, AvatarUploader — lazy từ window (avatar.js) */
const _avatarNoop=()=>({avatarUrl:null,loading:false,
  uploadAvatar:async()=>({ok:false,msg:'avatar.js chưa load'}),
  removeAvatar:async()=>{}});
const useAvatar      =(...a)=>(window.useAvatar||_avatarNoop)(...a);
const LetterAvatar   =(p)=>window.LetterAvatar
  ?React.createElement(window.LetterAvatar,p)
  :React.createElement('div',{style:{width:p.size||64,height:p.size||64,borderRadius:'50%',background:'rgba(244,114,182,0.2)'}});
const AvatarUploader =(p)=>window.AvatarUploader
  ?React.createElement(window.AvatarUploader,p)
  :null;

/* ══ DECORATIVE FLOATING EMOJIS ══ */
function FloatingDecos({dark}){
  /* Tiny SVG shapes instead of emoji for consistent cross-platform rendering */
  const decos=[
    {svg:<svg viewBox="0 0 24 24" width="18" height="18" fill="#f472b6"><path d="M12 2C9.5 2 8 4.5 8 6.5c0 3 4 7 4 7s4-4 4-7C16 4.5 14.5 2 12 2z"/></svg>,t:'8%',l:'5%',del:0,dur:5},
    {svg:<svg viewBox="0 0 24 24" width="14" height="14" fill="#f9a8d4"><path d="M12 0l2.59 9.41L24 12l-9.41 2.59L12 24l-2.59-9.41L0 12l9.41-2.59z"/></svg>,t:'15%',r:'8%',del:1.2,dur:4.5},
    {svg:<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#f472b6" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,t:'55%',l:'3%',del:0.7,dur:6},
    {svg:<svg viewBox="0 0 24 24" width="13" height="13" fill="#c084fc"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>,t:'35%',r:'4%',del:2,dur:5.5},
    {svg:<svg viewBox="0 0 24 24" width="12" height="12" fill="#fbbf24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,t:'72%',l:'6%',del:1.5,dur:4},
    {svg:<svg viewBox="0 0 24 24" width="15" height="15" fill="#34d399"><path d="M12 0l2.59 9.41L24 12l-9.41 2.59L12 24l-2.59-9.41L0 12l9.41-2.59z"/></svg>,t:'82%',r:'5%',del:0.3,dur:5.8},
  ];
  return(
    <>
      {decos.map((d,i)=>(
        <div key={i} style={{
          position:'fixed',top:d.t,left:d.l,right:d.r,
          pointerEvents:'none',zIndex:0,userSelect:'none',
          opacity:dark?0.12:0.22,
          animation:`bb-float ${d.dur}s ease-in-out ${d.del}s infinite`,
        }}>{d.svg}</div>
      ))}
    </>
  );
}

/* ══ SCORE BADGE — kawaii ring ══ */
function ScoreSVG({pct=0,size=56,dark,showMax=true,liteMode}){
  const color=pctColor(pct);
  const r=size/2-4;
  const circ=2*Math.PI*r;
  const dash=circ*(pct/100);
  const fs=size*0.28;
  const subFs=size*0.13;
  /* Radar sweep — chỉ mount 1 lần, tự fade sau 900ms */
  const [showSweep,setShowSweep]=useState(!liteMode);
  useEffect(()=>{
    if(liteMode)return;
    const t=setTimeout(()=>setShowSweep(false),900);
    return()=>clearTimeout(t);
  },[liteMode]);
  return(
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{display:'block',flexShrink:0}}>
      <circle cx={size/2} cy={size/2} r={r+2} fill={color} opacity="0.07"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={dark?'rgba(255,255,255,0.1)':'rgba(0,0,0,0.06)'} strokeWidth={4}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={4}
        strokeDasharray={`${dash} ${circ-dash}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{transition:'stroke-dasharray .7s cubic-bezier(.34,1.56,.64,1)',filter:`drop-shadow(0 0 3px ${color}66)`}}/>
      {/* ── Radar sweep — quét 1 vòng rồi tắt ── */}
      {showSweep&&(
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth={2} strokeLinecap="round"
          strokeDasharray={`${circ*0.22} ${circ*0.78}`}
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{
            '--circ':`${circ}`,
            opacity:0.7,
            animation:'hud-radar-sweep 0.85s cubic-bezier(.4,0,.6,1) both',
            filter:`drop-shadow(0 0 4px ${color})`,
          }}/>
      )}
      <text x={size/2} y={size/2-(showMax?subFs*0.55:0)}
        textAnchor="middle" dominantBaseline="middle"
        fill={color} fontFamily="'Baloo 2',cursive" fontWeight="800" fontSize={fs}>{fmtScore(pct)}</text>
      {showMax&&(
        <text x={size/2} y={size/2+fs*0.5}
          textAnchor="middle" dominantBaseline="middle"
          fill={dark?'rgba(255,255,255,0.3)':'rgba(0,0,0,0.28)'}
          fontFamily="Nunito,sans-serif" fontWeight="700" fontSize={subFs}>/10</text>
      )}
    </svg>
  );
}

/* ── Score Badge Inline — pill ── */
function ScoreBadgeInline({pct,dark,fontSize=13}){
  const color=pctColor(pct);
  const w=fontSize*3.6,h=fontSize*1.8,rx=h/2;
  return(
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{display:'inline-block',verticalAlign:'middle',flexShrink:0}}>
      <rect x={0} y={0} width={w} height={h} rx={rx} fill={color+'1e'} stroke={color+'55'} strokeWidth={1.2}/>
      <text x={w/2} y={h/2} textAnchor="middle" dominantBaseline="middle"
        fill={color} fontFamily="'Baloo 2',cursive" fontWeight="800" fontSize={fontSize}>{fmtScore(pct)}/10</text>
    </svg>
  );
}

/* ── Kawaii Stat Card ── */
function StatCard({label,value,sub,color,dark,icon,delay=0}){
  const C=dark?CD:CL;
  return(
    <div className="bb-card-tap" style={{
      background:C.card,backdropFilter:C.cardBlur,WebkitBackdropFilter:C.cardBlur,borderRadius:24,padding:'14px 16px',
      display:'flex',alignItems:'center',gap:12,
      border:`1.5px solid ${color}30`,
      boxShadow:dark?`0 4px 20px ${color}20`:`0 4px 20px rgba(0,0,0,0.06),0 0 0 1px ${color}15`,
      flex:'1 1 calc(50% - 6px)',minWidth:138,
      animation:`bb-fadeUp .4s ease ${delay}s both`,
    }}>
      <div style={{
        width:46,height:46,borderRadius:18,flexShrink:0,
        background:`linear-gradient(135deg,${color}28,${color}15)`,
        display:'flex',alignItems:'center',justifyContent:'center',
        boxShadow:`0 2px 8px ${color}30`,
      }}>
        <Icon name={icon||'star'} size={22} color={color}/>
      </div>
      <div style={{minWidth:0}}>
        <div style={{fontSize:22,fontWeight:900,color,lineHeight:1,fontFamily:"'Baloo 2',cursive"}}>{value}</div>
        <div style={{fontSize:11,fontWeight:700,color:C.sub,marginTop:2}}>{label}</div>
        {sub&&<div style={{fontSize:10,color:C.sub,opacity:.7,marginTop:1}}>{sub}</div>}
      </div>
    </div>
  );
}

/* ── Sparkline chart ── */
function Sparkline({data,color='#f472b6',width=120,height=44}){
  if(!data||data.length<2)return null;
  const max=Math.max(...data,1),min=Math.min(...data,0),range=max-min||1;
  const pts=data.map((v,i)=>{
    const x=i/(data.length-1)*width;
    const y=height-(v-min)/range*(height-8)-4;
    return`${x},${y}`;
  });
  const ptsStr=pts.join(' ');
  const last=pts[pts.length-1].split(',');
  const areaPath=`M ${pts[0]} ${pts.slice(1).map(p=>`L ${p}`).join(' ')} L ${width},${height} L 0,${height} Z`;
  return(
    <svg width={width} height={height} style={{overflow:'visible'}}>
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#sparkGrad)"/>
      <polyline points={ptsStr} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={last[0]} cy={last[1]} r="5" fill={color} style={{filter:`drop-shadow(0 0 4px ${color}88)`}}/>
      <circle cx={last[0]} cy={last[1]} r="9" fill={color} opacity="0.14"/>
    </svg>
  );
}

/* ── Progress Ring ── */
function Ring({pct=0,size=80,stroke=8,color='#f472b6',dark}){
  const r=size/2-stroke;
  const circ=2*Math.PI*r;
  const dash=circ*(pct/100);
  return(
    <svg width={size} height={size} style={{transform:'rotate(-90deg)'}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={dark?'rgba(255,255,255,0.1)':'rgba(0,0,0,0.06)'} strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ-dash}`} strokeLinecap="round"
        style={{transition:'stroke-dasharray .7s cubic-bezier(.34,1.56,.64,1)',filter:`drop-shadow(0 0 3px ${color}66)`}}/>
    </svg>
  );
}

/* ── Progress Bar ── */
function ProgressBar({pct,color,dark}){
  return(
    <div style={{height:10,borderRadius:99,background:dark?'rgba(255,255,255,0.1)':'rgba(0,0,0,0.06)',overflow:'hidden'}}>
      <div style={{
        height:'100%',width:`${pct}%`,borderRadius:99,
        background:`linear-gradient(90deg,${color}bb,${color})`,
        transition:'width .7s cubic-bezier(.34,1.56,.64,1)',
        boxShadow:`0 2px 8px ${color}55`,
        position:'relative',overflow:'hidden',
      }}>
        <div style={{
          position:'absolute',inset:0,
          background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.38),transparent)',
          backgroundSize:'200% 100%',
          animation:'bb-shimmer 2s linear infinite',
        }}/>
      </div>
    </div>
  );
}

/* ── Kawaii Toggle ── */
function Toggle({val,onChange}){
  return(
    <div className="bb-toggle-track"
      onClick={()=>onChange(!val)}
      style={{background:val?'linear-gradient(135deg,#f472b6,#a855f7)':'rgba(128,128,128,0.2)',
        boxShadow:val?'0 2px 12px rgba(244,114,182,0.5)':'none'}}>
      <div className="bb-toggle-thumb" style={{left:val?26:4}}>
        {val?(<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#f472b6" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>):''}
      </div>
    </div>
  );
}

/* ── Section Header ── */
function SectionHeader({title,dark,emoji,icon,color='#f472b6'}){
  const C=dark?CD:CL;
  return(
    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
      <div style={{width:32,height:32,borderRadius:10,background:`${color}20`,
        display:'flex',alignItems:'center',justifyContent:'center'}}>
        {icon
          ?<Icon name={icon} size={16} color={color}/>
          :<span style={{fontSize:16}}>{emoji}</span>
        }
      </div>
      <div className="bb-section-title" style={{color:C.fg}}>{title}</div>
    </div>
  );
}

/* ══ TAB BAR ══ */
/* SVG tab icons — inline, no emoji */
const TabIcons={
  home:(col)=>(<svg viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><path d="M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10.5z"/><polyline points="9 22 9 13 15 13 15 22"/></svg>),
  stats:(col)=>(<svg viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="7" width="4" height="14" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/></svg>),
  history:(col)=>(<svg viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/></svg>),
  notes:(col)=>(<svg viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><path d="M4 4h12l4 4v12H4z"/><path d="M16 4v4h4"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>),
  files:(col)=>(<svg viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>),
  settings:(col)=>(<svg viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>),
};

/* Swipe-to-change-tab dùng window.useSwipe (swipe.jsx) có sẵn trên site */

function TabBar({tab,setTab,dark,liteMode,flickerFx}){
  const C=dark?CD:CL;
  const tabs=[
    {id:'home',    label:'Trang chủ'},
    {id:'stats',   label:'Thống kê'},
    {id:'history', label:'Lịch sử'},
    {id:'notes',   label:'Ghi chú'},
    {id:'files',   label:'Tài liệu'},
    {id:'settings',label:'Cài đặt'},
  ];
  return(
    <nav style={{
      position:'fixed',bottom:0,left:0,right:0,zIndex:200,
      background:C.navBg,backdropFilter:'blur(24px)',
      borderTop:`1px solid ${dark?'rgba(244,114,182,0.2)':'rgba(244,114,182,0.18)'}`,
      display:'flex',padding:'6px 4px',paddingBottom:'max(8px,env(safe-area-inset-bottom))',
      maxWidth:760,margin:'0 auto',
      boxShadow:dark?'0 -4px 24px rgba(244,114,182,0.1)':'0 -4px 24px rgba(244,114,182,0.08)',
    }}>
      {tabs.map((t,idx)=>{
        const active=tab===t.id;
        const col=active?C.accent:(dark?'rgba(255,180,210,0.38)':'rgba(160,96,128,0.45)');
        return(
          <button key={t.id} className="bb-tab-btn" onClick={()=>setTab(t.id)}
            style={{
              flex:1,minWidth:0,display:'flex',flexDirection:'column',alignItems:'center',gap:3,
              padding:'6px 1px',borderRadius:20,
              transition:'all .25s cubic-bezier(.34,1.56,.64,1)',
              background:active?(dark?'rgba(244,114,182,0.14)':'rgba(244,114,182,0.11)'):'transparent',
              transform:active?'scale(1.05)':'scale(1)',
            }}>
            <div style={{
              width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',
              transition:'all .25s',
              animation:active?'bb-bounce .6s ease':'none',
              filter:active?`drop-shadow(0 0 4px ${C.accent}88)`:'none',
            }}>
              <span style={{
                display:'inline-flex',
                animation:(liteMode||!flickerFx)?'none':`bb-blink 1.5s ease-in-out ${idx*0.15}s infinite`,
              }}>
                {TabIcons[t.id](col)}
              </span>
            </div>
            <span style={{
              fontSize:10,fontWeight:800,letterSpacing:0,transition:'color .2s',whiteSpace:'nowrap',
              color:active?C.accent:C.sub,
              display:'inline-block',
              animation:(liteMode||!flickerFx)?'none':`bb-blink 1.5s ease-in-out ${idx*0.15}s infinite`,
            }}>{t.label}</span>
            {active&&<div style={{width:4,height:4,borderRadius:'50%',background:C.accent,boxShadow:`0 0 6px ${C.accent}`}}/>}
          </button>
        );
      })}
    </nav>
  );
}

/* ══ ACTION BANNER CAROUSEL — nhóm banner vuốt ngang kiểu widget Samsung ══ */
function ActionBanner({icon,title,sub,gradient,shadow,onClick,delay}){
  return(
    <button onClick={onClick} className="bb-btn-tap"
      style={{
        width:'100%',display:'flex',alignItems:'center',gap:14,
        padding:'16px 18px',borderRadius:22,border:'none',cursor:'pointer',
        textAlign:'left',fontFamily:'Nunito,sans-serif',
        background:gradient,boxShadow:shadow,
        animation:`bb-fadeUp .35s ease ${delay}s both`,
      }}>
      <div style={{
        width:44,height:44,borderRadius:20,flexShrink:0,
        background:'rgba(255,255,255,0.22)',backdropFilter:'blur(6px)',
        display:'flex',alignItems:'center',justifyContent:'center',
      }}>
        <Icon name={icon} size={22} color="#fff"/>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:15,fontWeight:900,color:'#fff'}}>{title}</div>
        <div style={{fontSize:11.5,color:'rgba(255,255,255,0.85)',fontWeight:600,marginTop:1}}>
          {sub}
        </div>
      </div>
      <Icon name="chevronRight" size={20} color="rgba(255,255,255,0.9)"/>
    </button>
  );
}

function BannerCarousel({dark,pages}){
  const trackRef=useRef(null);
  const [page,setPage]=useState(0);
  const n=pages.length;

  const onScroll=useCallback(()=>{
    const el=trackRef.current;
    if(!el)return;
    const idx=Math.round(el.scrollLeft/el.clientWidth);
    setPage(p=>p===idx?p:Math.max(0,Math.min(n-1,idx)));
  },[n]);

  const goTo=useCallback((i)=>{
    const el=trackRef.current;
    if(!el)return;
    el.scrollTo({left:i*el.clientWidth,behavior:'smooth'});
  },[]);

  if(n===0)return null;

  return(
    <div style={{padding:'8px 0 8px'}}>
      <div ref={trackRef} onScroll={onScroll} className="bb-scroll-hide" data-no-swipe="1"
        style={{
          display:'flex',overflowX:'auto',scrollSnapType:'x mandatory',
          WebkitOverflowScrolling:'touch',
        }}>
        {pages.map((p,i)=>(
          <div key={i} style={{flex:'0 0 100%',scrollSnapAlign:'start',padding:'0 14px'}}>
            <ActionBanner {...p}/>
          </div>
        ))}
      </div>
      {n>1&&(
        <div style={{display:'flex',justifyContent:'center',gap:6,marginTop:8}}>
          {pages.map((_,i)=>(
            <button key={i} onClick={()=>goTo(i)} aria-label={`Trang ${i+1}`}
              style={{
                width:page===i?16:6,height:6,borderRadius:99,border:'none',
                padding:0,cursor:'pointer',
                background:page===i?'#a855f7':(dark?'rgba(168,85,247,0.3)':'rgba(168,85,247,0.25)'),
                transition:'width .25s cubic-bezier(.34,1.56,.64,1), background .25s',
              }}/>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══ TAB HOME ══ */
function TabHome({student,lessons,loading,fetchError,onPlay,shuffleQ,shuffleA,setShuffleQ,setShuffleA,history,dark,setTab,avatarUrl,liteMode,flickerFx,onGoListening,onGoVocab,onGoPractice,practiceCount}){
  const C=dark?CD:CL;
  const [search,setSearch]=useState('');
  const [subject,setSubject]=useState('all');
  const [showIdCard,setShowIdCard]=useState(false);
  const subjects=useMemo(()=>['all',...new Set(lessons.map(l=>l.subject||'Tiếng Anh'))]  ,[lessons]);
  const filtered=useMemo(()=>lessons.filter(l=>{
    const q=search.toLowerCase();
    return(!q||l.title.toLowerCase().includes(q))&&(subject==='all'||l.subject===subject);
  }),[lessons,search,subject]);

  const avgPct=history.length?Math.round(history.reduce((a,h)=>a+h.pct,0)/history.length):0;
  const streak=useMemo(()=>{
    if(!history.length)return 0;
    const days=[...new Set(history.map(h=>new Date(h.ts).toDateString()))];
    const today=new Date().toDateString();
    let s=days[0]===today?1:0;
    if(!s)return 0;
    for(let i=1;i<days.length;i++){
      const a=new Date(days[i-1]),b=new Date(days[i]);
      if((a-b)/(1000*60*60*24)===1)s++;else break;
    }
    return s;
  },[history]);

  const greet=(()=>{
    const h=new Date().getHours();
    if(h<5) return{text:'Khuya rồi nè',icon:'greetNight',sub:'Đi ngủ thôi bé ơi~'};
    if(h<11)return{text:'Chào buổi sáng',icon:'greetMorning',sub:'Ngày mới tươi đẹp nè!'};
    if(h<13)return{text:'Buổi trưa rồi',icon:'greetNoon',sub:'Ăn cơm chưa bé?'};
    if(h<18)return{text:'Buổi chiều xinh',icon:'greetAfternoon',sub:'Học tiếp nào~'};
    return{text:'Tối rồi nè',icon:'greetEvening',sub:'Chăm chỉ ghê á!'};
  })();

  const badge=rankBadge(avgPct);

  return(
    <div style={{paddingBottom:90}}>

      {/* ── Hero Banner ── */}
      <div style={{
        margin:'12px 14px 0',borderRadius:28,padding:'20px',
        background:dark
          ?'linear-gradient(135deg,rgba(244,114,182,0.18),rgba(168,85,247,0.14))'
          :'linear-gradient(135deg,#fce7f3,#f5d0fe,#e9d5ff)',
        border:`1.5px solid ${dark?'rgba(244,114,182,0.22)':'rgba(244,114,182,0.25)'}`,
        boxShadow:dark?'0 10px 34px rgba(244,114,182,0.14)':'0 10px 34px rgba(244,114,182,0.16)',
        animation:'bb-fadeUp .3s ease both',position:'relative',overflow:'hidden',
      }}>
        <div style={{position:'absolute',top:-20,right:-20,width:80,height:80,
          borderRadius:'50%',background:dark?'rgba(244,114,182,0.1)':'rgba(244,114,182,0.14)',pointerEvents:'none'}}/>
        <div style={{position:'absolute',bottom:-15,left:30,width:50,height:50,
          borderRadius:'50%',background:dark?'rgba(168,85,247,0.1)':'rgba(168,85,247,0.12)',pointerEvents:'none'}}/>

        <div style={{display:'flex',alignItems:'center',gap:14,position:'relative'}}>
          <div onClick={()=>setShowIdCard(true)} style={{cursor:'pointer'}}>
            <AcrylicAvatarCard name={student?.display_name||student?.username} size={58} dark={dark} liteMode={liteMode} avatarUrl={avatarUrl}/>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:11,color:C.accent,fontWeight:700,display:'flex',alignItems:'center',gap:4,marginBottom:2}}>
              <span style={{animation:'bb-wiggle 3s ease-in-out infinite',display:'inline-flex',color:C.accent}}>
                <Icon name={greet.icon} size={14} color={C.accent}/>
              </span>
              {greet.text}
            </div>
            <div className="bb-hero-name" style={{color:C.fg,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {student?.display_name||student?.username||'Học sinh'}
            </div>
            <div style={{fontSize:11,color:C.sub,marginTop:2}}>{greet.sub}</div>
            <div style={{display:'flex',gap:6,marginTop:8,flexWrap:'wrap'}}>
              {streak>0&&(
                <span className="bb-sticker" style={{
                  background:'linear-gradient(135deg,#fde68a,#fbbf24)',
                  color:'#92400e',padding:'3px 10px',fontSize:11,
                  boxShadow:'0 2px 8px rgba(251,191,36,0.4)',
                  display:'inline-flex',alignItems:'center',gap:4,
                }}>
                  <Icon name="fire" size={12} color="#92400e"/> {streak} ngày
                </span>
              )}
              {history.length>0&&(
                <span className="bb-sticker" style={{
                  background:badge.gradient,color:'#fff',
                  padding:'3px 10px',fontSize:11,boxShadow:`0 2px 8px ${badge.glow}`,
                  display:'inline-flex',alignItems:'center',gap:4,
                }}>
                  <Icon name={badge.icon} size={12} color="#fff"/>
                  {badge.label}
                </span>
              )}
            </div>
          </div>
          {history.length>0&&(
            <div style={{flexShrink:0,textAlign:'center',cursor:'pointer'}} onClick={()=>setTab('stats')}>
              <ScoreSVG pct={avgPct} size={58} dark={dark} liteMode={liteMode}/>
              <div style={{fontSize:9,color:C.sub,marginTop:2}}>Điểm TB</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Quick Stats ── */}
      {history.length>0&&(
        <div style={{display:'flex',gap:8,padding:'10px 14px 4px',overflowX:'auto'}} className="bb-scroll-hide">
          {[
            {label:'Bài đã làm',value:history.length,icon:'book',  color:'#a855f7',delay:0.05},
            {label:'Điểm TB',   value:<ScoreBadgeInline pct={avgPct} dark={dark} fontSize={14}/>,icon:'star',   color:'#f472b6',delay:0.1},
            {label:'Cao nhất',  value:<ScoreBadgeInline pct={Math.max(...history.map(h=>h.pct))} dark={dark} fontSize={14}/>,icon:'trophy', color:'#10b981',delay:0.15},
          ].map((s,i)=>(
            <div key={i} onClick={()=>setTab('stats')} className="bb-card-tap"
              style={{
                cursor:'pointer',background:C.card,backdropFilter:C.cardBlur,WebkitBackdropFilter:C.cardBlur,borderRadius:20,
                padding:'10px 14px',textAlign:'center',flexShrink:0,
                border:`1.5px solid ${s.color}25`,minWidth:96,
                boxShadow:`0 4px 16px ${s.color}18`,
                animation:`bb-fadeUp .35s ease ${s.delay}s both`,
              }}>
              <div style={{display:'flex',justifyContent:'center',marginBottom:2,
                animation:'bb-float 3s ease-in-out infinite',color:s.color}}>
                <Icon name={s.icon} size={20} color={s.color}/>
              </div>
              <div style={{fontSize:17,fontWeight:900,color:s.color,fontFamily:"'Baloo 2',cursive"}}>{s.value}</div>
              <div style={{fontSize:10,color:C.sub,fontWeight:700}}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Search ── */}
      <div style={{padding:'10px 14px 6px'}}>
        <HudSearchInput value={search} onChange={e=>setSearch(e.target.value)} dark={dark} liteMode={liteMode}/>
      </div>

      {/* ── Action Banners — nhóm vuốt ngang kiểu widget Samsung ── */}
      <BannerCarousel dark={dark} pages={[
        {
          icon:'headphones',title:'Luyện nghe',
          sub:'Điền từ + nhận định Đúng/Sai/NM',
          gradient:'linear-gradient(120deg,#6366f1,#8b5cf6 55%,#a855f7)',
          shadow:dark
            ?'0 10px 28px rgba(139,92,246,0.35), inset 0 1px 0 rgba(255,255,255,0.08)'
            :'0 10px 28px rgba(139,92,246,0.28), inset 0 1px 0 rgba(255,255,255,0.25)',
          onClick:()=>onGoListening&&onGoListening(),
          delay:0.05,
        },
        {
          icon:'book',title:'Từ vựng',
          sub:'Học từ mới + kiểm tra viết',
          gradient:'linear-gradient(120deg,#F472B6,#FB7185 55%,#FDBA74)',
          shadow:dark
            ?'0 10px 28px rgba(244,114,182,0.32), inset 0 1px 0 rgba(255,255,255,0.08)'
            :'0 10px 28px rgba(244,114,182,0.26), inset 0 1px 0 rgba(255,255,255,0.25)',
          onClick:()=>onGoVocab&&onGoVocab(),
          delay:0.08,
        },
        /* Ôn tập riêng — chỉ hiện khi có ít nhất 1 bài practice đã publish
           (khớp cơ chế 'tab ẩn' bên app: PRACTICE chỉ nằm trong visibleTabs khi
           practiceLessons không rỗng) */
        ...(onGoPractice?[{
          icon:'sparkle',title:'Ôn tập riêng',
          sub:`${practiceCount} bài dành riêng cho bạn`,
          gradient:'linear-gradient(120deg,#F472B6 10%,#A855F7 90%)',
          shadow:dark
            ?'0 10px 28px rgba(244,114,182,0.32), inset 0 1px 0 rgba(255,255,255,0.08)'
            :'0 10px 28px rgba(244,114,182,0.26), inset 0 1px 0 rgba(255,255,255,0.25)',
          onClick:()=>onGoPractice&&onGoPractice(),
          delay:0.11,
        }]:[]),
      ]}/>

      {/* ── Subject Pills ── */}
      {subjects.length>2&&(
        <div style={{display:'flex',gap:6,padding:'4px 14px 8px',overflowX:'auto'}} className="bb-scroll-hide">
          {subjects.map(s=>(
            <button key={s} className="bb-btn-tap" onClick={()=>setSubject(s)}
              style={{
                padding:'5px 14px',borderRadius:99,cursor:'pointer',
                fontSize:11,fontWeight:800,flexShrink:0,fontFamily:'Nunito,sans-serif',
                background:subject===s?'linear-gradient(135deg,#f472b6,#a855f7)':(dark?'rgba(30,8,22,0.72)':'rgba(255,255,255,0.78)'),
                color:subject===s?'#fff':(dark?'rgba(255,200,220,0.85)':'#be4e8a'),
                boxShadow:subject===s?'0 3px 12px rgba(244,114,182,0.4)':(dark?'0 2px 8px rgba(0,0,0,0.25)':'0 2px 8px rgba(244,114,182,0.1)'),
                backdropFilter:'blur(8px)',
                WebkitBackdropFilter:'blur(8px)',
                border:subject===s?'none':`1px solid ${dark?'rgba(244,114,182,0.18)':'rgba(244,114,182,0.25)'}`,
                transition:'all .2s cubic-bezier(.34,1.56,.64,1)',
                transform:subject===s?'scale(1.06)':'scale(1)',
              }}>
              {s==='all'?'Tất cả':s}
            </button>
          ))}
        </div>
      )}

      {/* ── Shuffle Toggles ── */}
      <div style={{display:'flex',gap:8,padding:'0 14px 10px'}}>
        {[
          {label:'Xáo câu hỏi',val:shuffleQ,set:setShuffleQ,icon:'shuffle'},
          {label:'Xáo đáp án',val:shuffleA,set:setShuffleA,icon:'zap'},
        ].map((t,i)=>(
          <button key={i} className="bb-btn-tap" onClick={()=>t.set(v=>!v)}
            style={{
              flex:1,padding:'8px 10px',borderRadius:22,
              border:`1.5px solid ${t.val?'#a855f7':(dark?'rgba(168,85,247,0.25)':'rgba(168,85,247,0.22)')}`,
              background:t.val?(dark?'rgba(168,85,247,0.22)':'rgba(168,85,247,0.13)'):(dark?'rgba(30,8,22,0.72)':'rgba(255,255,255,0.78)'),
              backdropFilter:'blur(8px)',WebkitBackdropFilter:'blur(8px)',
              color:t.val?'#a855f7':C.sub,fontWeight:700,fontSize:11,cursor:'pointer',
              transition:'all .2s cubic-bezier(.34,1.56,.64,1)',
              display:'flex',alignItems:'center',justifyContent:'center',gap:5,
              boxShadow:t.val?'0 3px 12px rgba(168,85,247,0.3)':(dark?'0 2px 8px rgba(0,0,0,0.25)':'0 2px 8px rgba(168,85,247,0.08)'),
              fontFamily:'Nunito,sans-serif',
            }}>
            <span style={{animation:t.val?'bb-spin 3s linear infinite':'none',display:'inline-flex'}}>
              <Icon name={t.icon} size={13} color={t.val?'#a855f7':C.sub}/>
            </span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Lesson List ── */}
      {loading?(
        <div style={{textAlign:'center',padding:50,color:C.sub,display:'flex',flexDirection:'column',alignItems:'center',gap:10}}>
          <span style={{display:'inline-flex',animation:'bb-spin 1.2s linear infinite',color:'#f472b6'}}>
            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#f472b6" strokeWidth="2" strokeLinecap="round"><path d="M12 2a10 10 0 1 0 10 10"/><circle cx="18" cy="5" r="1.5" fill="#f472b6"/></svg>
          </span>
          <span style={{fontSize:13,fontWeight:700}}>Đang tải bài học...</span>
        </div>
      ):fetchError?(
        <div style={{textAlign:'center',padding:50,display:'flex',flexDirection:'column',alignItems:'center',gap:8,borderRadius:22,border:`1.5px solid ${C.cardBorder}`}}>
          <span style={{display:'inline-flex',color:'#f472b6',opacity:0.6}}><Icon name="sad" size={40} color="#f472b6"/></span>
          <div style={{fontSize:14,color:C.sub,fontWeight:700}}>Không tải được bài học</div>
          <div style={{fontSize:12,color:C.sub}}>Thử lại nhé bé ơi~</div>
        </div>
      ):(
        <div style={{padding:'0 14px',display:'flex',flexDirection:'column',gap:10}}>
          {filtered.length===0&&(
            <div style={{textAlign:'center',padding:36,color:C.sub,display:'flex',flexDirection:'column',alignItems:'center',gap:8,borderRadius:22,border:`1.5px solid ${C.cardBorder}`}}>
              <Icon name="search" size={36} color="rgba(244,114,182,0.4)"/>
              <div style={{fontSize:13,fontWeight:700}}>Không tìm thấy bài nào</div>
            </div>
          )}
          {filtered.map((l,i)=>{
            const done=history.find(h=>h.lessonTitle===l.title);
            const col=done?pctColor(done.pct):'#f472b6';
            return(
              <div key={l.id} onClick={()=>onPlay(l)} className="bb-card-tap"
                style={{
                  background:C.card,backdropFilter:C.cardBlur,WebkitBackdropFilter:C.cardBlur,borderRadius:24,padding:'14px 16px',cursor:'pointer',
                  border:`1.5px solid ${done?(col+'40'):(dark?'rgba(244,114,182,0.18)':'rgba(244,114,182,0.2)')}`,
                  boxShadow:done?`0 4px 20px ${col}18`:'0 3px 14px rgba(244,114,182,0.08)',
                  display:'flex',alignItems:'center',gap:12,
                  animation:`bb-fadeUp .25s ease ${(i%8)*35}ms both`,
                }}>
                <div style={{
                  width:46,height:46,borderRadius:18,flexShrink:0,
                  background:done?`linear-gradient(135deg,${col}30,${col}18)`:(dark?'rgba(244,114,182,0.12)':'rgba(244,114,182,0.12)'),
                  display:'flex',alignItems:'center',justifyContent:'center',
                  boxShadow:done?`0 2px 10px ${col}25`:'none',
                  animation:(liteMode||!flickerFx)?'none':`bb-blink 1.5s ease-in-out ${(i%8)*0.15}s infinite`,
                }}>
                  {l.password
                    ?<Icon name="lock" size={20} color={dark?'rgba(255,180,210,0.6)':'#be4e8a'}/>
                    :done
                      ?<Icon name="check" size={20} color={col}/>
                      :<Icon name="book" size={20} color="#f472b6"/>
                  }
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:800,fontSize:14,color:C.fg,fontFamily:"'Baloo 2',cursive",
                    overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
                    animation:(liteMode||!flickerFx)?'none':`bb-blink 1.5s ease-in-out ${(i%8)*0.15}s infinite`,
                  }}>
                    <GlitchText color={C.fg} liteMode={liteMode} style={{fontSize:14}}>{l.title}</GlitchText>
                  </div>
                  <div style={{fontSize:11,color:C.sub,marginTop:2,display:'flex',alignItems:'center',gap:5,flexWrap:'wrap'}}>
                    <span>{l.subject||'Tiếng Anh'}</span>
                    <span>·</span>
                    <span>{l.questionCount||0} câu</span>
                    {done&&<span style={{color:col}}>· <ScoreBadgeInline pct={done.pct} dark={dark} fontSize={10}/></span>}
                  </div>
                </div>
                {done?(
                  <div style={{textAlign:'center',flexShrink:0}}>
                    <ScoreSVG pct={done.pct} size={52} dark={dark} liteMode={liteMode}/>
                    <div style={{fontSize:9,color:C.sub,marginTop:1}}>{fmtDate(done.ts)}</div>
                  </div>
                ):(
                  <div style={{
                    fontSize:11,fontWeight:800,color:'#fff',
                    background:'linear-gradient(135deg,#f472b6,#a855f7)',
                    padding:'4px 10px',borderRadius:99,flexShrink:0,
                    boxShadow:'0 2px 8px rgba(244,114,182,0.4)',
                  }}>Học!</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Thẻ ID Acrylic 3D (full portrait) ── */}
      {showIdCard&&(
        <IdCardFullModal
          student={student} avatarUrl={avatarUrl} dark={dark} liteMode={liteMode}
          avgPct={avgPct} streak={streak} badge={badge} totalDone={history.length}
          onClose={()=>setShowIdCard(false)}
        />
      )}
    </div>
  );
}

/* ══ TAB STATS ══ */
function TabStats({history,dark}){
  const C=dark?CD:CL;
  if(!history.length)return(
    <div style={{padding:'14px 14px 100px'}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
        <Icon name="stats" size={18} color={C.accent}/>
        <span className="bb-section-title" style={{color:C.fg}}>Thống kê</span>
      </div>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
        gap:14,padding:'48px 32px',textAlign:'center',animation:'bb-fadeUp .3s ease both',
        borderRadius:24,border:`1.5px solid ${C.cardBorder}`}}>
        <span style={{display:'inline-flex',color:'rgba(244,114,182,0.5)',animation:'bb-float 3s ease-in-out infinite'}}>
          <Icon name="stats" size={56} color="rgba(244,114,182,0.5)"/>
        </span>
        <div style={{fontSize:20,fontWeight:900,color:C.fg,fontFamily:"'Baloo 2',cursive"}}>Chưa có dữ liệu</div>
        <div style={{fontSize:13,color:C.sub}}>Làm bài quiz để xem thống kê nhé!</div>
      </div>
    </div>
  );

  const avgPct=Math.round(history.reduce((a,h)=>a+h.pct,0)/history.length);
  const best=Math.max(...history.map(h=>h.pct));
  const total=history.reduce((a,h)=>a+(h.total||0),0);
  const correct=history.reduce((a,h)=>a+(h.score||0),0);
  const badge=rankBadge(best);
  const chart=[...history].reverse().slice(0,8).map(h=>h.pct);
  const bySubject={};
  history.forEach(h=>{
    const s=h.subject||'Tiếng Anh';
    if(!bySubject[s])bySubject[s]={count:0,total:0};
    bySubject[s].count++;bySubject[s].total+=h.pct;
  });

  return(
    <div style={{padding:'14px 14px 100px',display:'flex',flexDirection:'column',gap:14}}>

      {/* ── Rank Card ── */}
      <div style={{
        borderRadius:28,padding:'20px',
        background:dark?`linear-gradient(135deg,rgba(244,114,182,0.15),rgba(168,85,247,0.12))`:'linear-gradient(135deg,#fce7f3,#ede9fe)',
        border:`1.5px solid ${badge.color}40`,boxShadow:`0 8px 32px ${badge.glow}`,
        animation:'bb-fadeUp .3s ease both',position:'relative',overflow:'hidden',
      }}>
        <div style={{position:'absolute',top:-30,right:-30,width:100,height:100,
          borderRadius:'50%',background:`${badge.color}15`,pointerEvents:'none'}}/>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <div style={{position:'relative',flexShrink:0}}>
            <Ring pct={avgPct} size={88} stroke={9} color={pctColor(avgPct)} dark={dark}/>
            <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
              <div className="bb-score-big" style={{fontSize:20,color:pctColor(avgPct)}}>{fmtScore(avgPct)}</div>
              <div style={{fontSize:9,color:C.sub}}>/10</div>
            </div>
          </div>
          <div style={{flex:1}}>
            <div style={{animation:'bb-bounce 2s ease-in-out infinite',display:'inline-flex',lineHeight:1,color:badge.color}}>
              <Icon name={badge.icon} size={36} color={badge.color}/>
            </div>
            <div style={{fontSize:18,fontWeight:900,color:badge.color,fontFamily:"'Baloo 2',cursive"}}>{badge.label}</div>
            <div style={{fontSize:12,color:C.sub,marginTop:3}}>
              Cao nhất: <span style={{fontWeight:800,color:pctColor(best)}}>{fmtScore(best)}/10</span>
            </div>
            <div style={{fontSize:11,color:C.sub}}>Đã làm <b style={{color:C.fg}}>{history.length}</b> bài</div>
            <div style={{marginTop:8}}><ProgressBar pct={avgPct} color={pctColor(avgPct)} dark={dark}/></div>
          </div>
        </div>
      </div>

      {/* ── Trend ── */}
      {chart.length>=2&&(
        <div style={{background:C.card,backdropFilter:C.cardBlur,WebkitBackdropFilter:C.cardBlur,borderRadius:24,padding:'16px',
          border:`1.5px solid ${dark?'rgba(244,114,182,0.18)':'rgba(244,114,182,0.18)'}`,
          animation:'bb-fadeUp .35s ease both'}}>
          <SectionHeader icon="trending" title="Xu hướng điểm số" dark={dark} color='#f472b6'/>
          <Sparkline data={chart} color='#f472b6' width={Math.min(window.innerWidth-80,680)} height={52}/>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:6}}>
            <span style={{fontSize:10,color:C.sub}}>Cũ nhất</span>
            <span style={{fontSize:10,color:C.sub}}>Gần nhất</span>
          </div>
        </div>
      )}

      {/* ── Stat Grid ── */}
      <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
        <StatCard icon='check'   label='Câu đúng'    value={correct} sub={`trên ${total} câu`} color='#10b981' dark={dark} delay={0.05}/>
        <StatCard icon='book'    label='Bài đã làm'  value={history.length}                    color='#a855f7' dark={dark} delay={0.1}/>
        <StatCard icon='target'  label='Tỉ lệ đúng'  value={total?fmtScore(Math.round(correct/total*100))+'/10':'—'} color='#f59e0b' dark={dark} delay={0.15}/>
        <StatCard icon='trophy'  label='Tốt nhất'    value={fmtScore(best)+'/10'} sub={pctLabel(best)} color={pctColor(best)} dark={dark} delay={0.2}/>
      </div>

      {/* ── By Subject ── */}
      {Object.keys(bySubject).length>0&&(
        <div style={{background:C.card,backdropFilter:C.cardBlur,WebkitBackdropFilter:C.cardBlur,borderRadius:24,padding:'16px',
          border:`1.5px solid ${dark?'rgba(244,114,182,0.15)':'rgba(244,114,182,0.15)'}`,
          animation:'bb-fadeUp .45s ease both'}}>
          <SectionHeader icon='folder' title="Theo môn học" dark={dark} color='#f472b6'/>
          {Object.entries(bySubject).map(([s,d])=>{
            const avg=Math.round(d.total/d.count);
            return(
              <div key={s} style={{marginBottom:14}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:5,alignItems:'center'}}>
                  <span style={{fontSize:13,fontWeight:800,color:C.fg,fontFamily:"'Baloo 2',cursive"}}>{s}</span>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <span style={{fontSize:11,color:C.sub}}>{d.count} bài</span>
                    <ScoreBadgeInline pct={avg} dark={dark} fontSize={11}/>
                  </div>
                </div>
                <ProgressBar pct={avg} color={pctColor(avg)} dark={dark}/>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Achievements ── */}
      <div style={{background:C.card,backdropFilter:C.cardBlur,WebkitBackdropFilter:C.cardBlur,borderRadius:24,padding:'16px',
        border:`1.5px solid ${dark?'rgba(244,114,182,0.15)':'rgba(244,114,182,0.15)'}`,
        animation:'bb-fadeUp .5s ease both'}}>
        <SectionHeader icon='ribbon' title="Thành tích" dark={dark} color='#f472b6'/>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {[
            {cond:history.length>=1, label:'Bắt đầu rồi!', icon:'check',   color:'#34d399'},
            {cond:history.length>=5, label:'Siêng năng',   icon:'book',    color:'#a855f7'},
            {cond:history.length>=10,label:'Chăm chỉ',     icon:'star',    color:'#f59e0b'},
            {cond:history.length>=20,label:'Thần đồng',    icon:'zap',     color:'#06b6d4'},
            {cond:best>=70,          label:'Giỏi lắm',     icon:'trending',color:'#f472b6'},
            {cond:best>=90,          label:'Xuất sắc!',    icon:'trophy',  color:'#f59e0b'},
            {cond:correct/Math.max(total,1)>=0.8,label:'Chính xác',icon:'target',color:'#10b981'},
          ].map((a,i)=>(
            <span key={i} className="bb-sticker" style={{
              background:a.cond?`linear-gradient(135deg,${a.color}30,${a.color}18)`:(dark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.04)'),
              border:`1.5px solid ${a.cond?a.color+'55':'rgba(128,128,128,0.15)'}`,
              color:a.cond?a.color:C.sub,padding:'5px 12px',fontSize:11,fontWeight:700,
              opacity:a.cond?1:0.42,
              animation:a.cond?`bb-pop .4s ease ${i*0.08}s both`:'none',
              display:'inline-flex',alignItems:'center',gap:5,
            }}>
              <Icon name={a.icon} size={12} color={a.cond?a.color:C.sub}/> {a.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══ TAB HISTORY ══ */
function TabHistory({history,onHistDetail,onClearHistory,dark,historyLoading}){
  const C=dark?CD:CL;
  const [confirmClear,setConfirmClear]=useState(false);
  const [clearing,setClearing]=useState(false);
  const [delId,setDelId]=useState(null);       // id đang chờ xác nhận xóa 1 dòng
  const doClearAll=async()=>{
    if(clearing)return;
    setClearing(true);
    await onClearHistory();
    setClearing(false);setConfirmClear(false);
  };
  const doDeleteOne=async(id)=>{
    if(clearing)return;
    setClearing(true);
    await onClearHistory([id]);
    setClearing(false);setDelId(null);
  };
  if(!history.length)return(
    <div style={{padding:'14px 14px 100px'}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
        <Icon name="history" size={18} color={C.accent}/>
        <span className="bb-section-title" style={{color:C.fg}}>Lịch sử</span>
      </div>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
        gap:14,padding:'48px 32px',textAlign:'center',animation:'bb-fadeUp .3s ease both',
        borderRadius:24,border:`1.5px solid ${C.cardBorder}`}}>
        <span style={{display:'inline-flex',color:'rgba(244,114,182,0.5)',animation:'bb-float 3s ease-in-out infinite'}}>
          <Icon name="history" size={52} color="rgba(244,114,182,0.5)"/>
        </span>
        <div style={{fontSize:20,fontWeight:900,color:C.fg,fontFamily:"'Baloo 2',cursive"}}>Chưa có lịch sử</div>
        <div style={{fontSize:13,color:C.sub}}>Làm bài quiz để lưu kết quả nhé~</div>
      </div>
    </div>
  );
  return(
    <div style={{padding:'14px 14px 100px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <Icon name="history" size={18} color={C.accent}/>
          <span className="bb-section-title" style={{color:C.fg}}>Lịch sử ({history.length})</span>
        </div>
        {!confirmClear?(
          <button className="bb-btn-tap" onClick={()=>setConfirmClear(true)}
            style={{fontSize:11,color:C.danger,fontWeight:700,
              border:`1px solid ${C.danger}44`,background:`${C.danger}11`,
              cursor:'pointer',padding:'5px 12px',borderRadius:99,fontFamily:'Nunito,sans-serif'}}>
            Xoá tất cả
          </button>
        ):(
          <div style={{display:'flex',gap:6,animation:'bb-pop .2s ease both'}}>
            <button className="bb-btn-tap" disabled={clearing} onClick={doClearAll}
              style={{fontSize:11,color:'#fff',fontWeight:800,border:'none',
                background:'linear-gradient(135deg,#ef4444,#dc2626)',cursor:'pointer',
                padding:'5px 12px',borderRadius:99,boxShadow:'0 2px 8px rgba(239,68,68,0.4)',
                fontFamily:'Nunito,sans-serif'}}>
              {clearing?'Đang xóa…':'Xác nhận'}
            </button>
            <button className="bb-btn-tap" disabled={clearing} onClick={()=>setConfirmClear(false)}
              style={{fontSize:11,color:C.sub,fontWeight:700,border:'none',
                background:dark?'rgba(255,255,255,0.1)':'rgba(0,0,0,0.07)',
                cursor:'pointer',padding:'5px 12px',borderRadius:99,fontFamily:'Nunito,sans-serif'}}>
              Huỷ
            </button>
          </div>
        )}
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {history.map((h,i)=>{
          const col=pctColor(h.pct);
          const resultIcon=h.pct>=90?'trophy':h.pct>=70?'star':h.pct>=50?'thumbsup':'sad';
          return(
            <div key={h.id||h.attemptId||(String(h.ts)+'_'+i)} onClick={()=>onHistDetail&&onHistDetail(h)} className="bb-card-tap"
              style={{
                background:C.card,backdropFilter:C.cardBlur,WebkitBackdropFilter:C.cardBlur,borderRadius:24,padding:'14px 16px',cursor:'pointer',
                border:`1.5px solid ${col}30`,boxShadow:`0 3px 14px ${col}12`,
                display:'flex',alignItems:'center',gap:12,
                animation:`bb-fadeUp .25s ease ${(i%10)*25}ms both`,
              }}>
              <ScoreSVG pct={h.pct} size={52} dark={dark}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:800,fontSize:14,color:C.fg,fontFamily:"'Baloo 2',cursive",
                  overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {h.lessonTitle||'Bài quiz'}
                </div>
                <div style={{fontSize:11,color:C.sub,marginTop:2}}>
                  {fmtScore(h.pct)}/10 · {Math.round(h.score*100)/100}/{Math.round(h.total*100)/100} điểm · {pctLabel(h.pct)}
                </div>
                <div style={{fontSize:10,color:C.sub,opacity:.7,marginTop:1}}>{fmtDate(h.ts)} {fmtTime(h.ts)}</div>
              </div>
              <span style={{display:'inline-flex',animation:'bb-float 3s ease-in-out infinite',color:col}}>
                <Icon name={resultIcon} size={22} color={col}/>
              </span>
              {h.id&&typeof h.id==='string'&&!String(h.id).startsWith('a_')&&(delId===h.id?(
                <div style={{display:'flex',gap:4}} onClick={e=>e.stopPropagation()}>
                  <button className="bb-btn-tap" disabled={clearing} onClick={()=>doDeleteOne(h.id)}
                    style={{fontSize:10,color:'#fff',fontWeight:800,border:'none',background:'#ef4444',cursor:'pointer',padding:'4px 9px',borderRadius:99,fontFamily:'Nunito,sans-serif'}}>Xóa</button>
                  <button className="bb-btn-tap" onClick={()=>setDelId(null)}
                    style={{fontSize:10,color:C.sub,fontWeight:700,border:'none',background:dark?'rgba(255,255,255,0.1)':'rgba(0,0,0,0.07)',cursor:'pointer',padding:'4px 9px',borderRadius:99,fontFamily:'Nunito,sans-serif'}}>Hủy</button>
                </div>
              ):(
                <button className="bb-btn-tap" aria-label="Xóa lần làm này" onClick={e=>{e.stopPropagation();setDelId(h.id);}}
                  style={{border:'none',background:'transparent',cursor:'pointer',color:C.sub,opacity:.55,padding:4,fontSize:16,lineHeight:1}}>×</button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* AvatarUploader → avatar.js */

/* ══ TAB SETTINGS ══ */
function TabSettings({student,dark,setDark,shuffleQ,shuffleA,setShuffleQ,setShuffleA,onLogout,history,avatarUrl,avatarLoading,onAvatarUpload,onAvatarRemove,studentId,liteMode,setLiteMode,flickerFx,setFlickerFx}){
  const C=dark?CD:CL;
  const [logoutConfirm,setLogoutConfirm]=useState(false);
  const [detectState,setDetectState]=useState(null);
  const avgPct=history.length?Math.round(history.reduce((a,h)=>a+h.pct,0)/history.length):0;
  const badge=rankBadge(avgPct);

  async function handleAutoDetect(){
    setDetectState('detecting');
    const res=await detectDevicePerformance();
    setDetectState(res);
    if(res.isLow&&!liteMode){ setLiteMode(true); }
    else if(!res.isLow&&liteMode&&res.score>=80){ setLiteMode(false); }
  }

  function ToggleRow({icon,label,sub,val,onChange}){
    return(
      <div style={{display:'flex',alignItems:'center',gap:12,padding:'13px 0',
        borderBottom:`1px solid ${dark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.05)'}`}}>
        <span style={{display:'inline-flex',flexShrink:0,color:val?C.accent:C.sub,
          animation:'bb-float 4s ease-in-out infinite',transition:'color .2s'}}>
          <Icon name={icon} size={20} color={val?C.accent:C.sub}/>
        </span>
        <div style={{flex:1}}>
          <div style={{fontSize:14,fontWeight:700,color:C.fg,fontFamily:"'Baloo 2',cursive"}}>{label}</div>
          {sub&&<div style={{fontSize:11,color:C.sub}}>{sub}</div>}
        </div>
        <Toggle val={val} onChange={onChange}/>
      </div>
    );
  }

  return(
    <div style={{padding:'14px 14px 100px',display:'flex',flexDirection:'column',gap:14}}>

      {/* ── Profile Card ── */}
      <div style={{
        borderRadius:28,padding:'20px',
        background:dark?'linear-gradient(135deg,rgba(244,114,182,0.15),rgba(168,85,247,0.12))':'linear-gradient(135deg,#fce7f3,#ede9fe)',
        border:'1.5px solid rgba(244,114,182,0.3)',
        boxShadow:'0 8px 32px rgba(244,114,182,0.15)',
        animation:'bb-fadeUp .3s ease both',position:'relative',overflow:'hidden',
      }}>
        <div style={{position:'absolute',top:-20,right:-20,width:80,height:80,
          borderRadius:'50%',background:'rgba(244,114,182,0.12)',pointerEvents:'none'}}/>

        {/* Avatar uploader (centered) */}
        <AvatarUploader
          student={student} dark={dark}
          avatarUrl={avatarUrl} loading={avatarLoading}
          onUpload={onAvatarUpload} onRemove={onAvatarRemove}
        />

        <div style={{textAlign:'center',marginTop:4}}>
          <div className="bb-hero-name" style={{color:C.fg,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
            {student?.display_name||student?.username||'Hoc sinh'}
          </div>
          <div style={{fontSize:12,color:C.sub,marginTop:1}}>@{student?.username}</div>
          <div style={{marginTop:8,display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',justifyContent:'center'}}>
            <span className="bb-sticker" style={{
              background:badge.gradient,color:'#fff',
              padding:'3px 12px',fontSize:12,boxShadow:'0 3px 12px '+badge.glow,
              display:'inline-flex',alignItems:'center',gap:4,
            }}>
              <Icon name={badge.icon} size={13} color="#fff"/>
              {badge.label}
            </span>
            {history.length>0&&<span style={{fontSize:12,color:C.sub}}>TB <b style={{color:pctColor(avgPct)}}>{fmtScore(avgPct)}/10</b></span>}
          </div>
        </div>

        {history.length>0&&(
          <div style={{display:'flex',gap:10,marginTop:14}}>
            {[
              {label:'Bai lam',  value:history.length,                                      icon:'book',  color:'#a855f7'},
              {label:'Diem TB',  value:fmtScore(avgPct),                                    icon:'star',  color:'#f472b6'},
              {label:'Cao nhat', value:fmtScore(Math.max(...history.map(h=>h.pct))),        icon:'trophy',color:'#f59e0b'},
            ].map((s,i)=>(
              <div key={i} style={{flex:1,textAlign:'center',
                background:dark?'rgba(255,255,255,0.08)':'rgba(255,255,255,0.6)',
                borderRadius:18,padding:'8px 4px',border:'1px solid rgba(244,114,182,0.2)'}}>
                <div style={{display:'flex',justifyContent:'center',marginBottom:2}}>
                  <Icon name={s.icon} size={16} color={s.color}/>
                </div>
                <div style={{fontSize:16,fontWeight:900,color:C.accent,fontFamily:"'Baloo 2',cursive"}}>{s.value}</div>
                <div style={{fontSize:9,color:C.sub,fontWeight:700}}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Settings Card ── */}
      <div style={{background:C.card,backdropFilter:C.cardBlur,WebkitBackdropFilter:C.cardBlur,borderRadius:24,padding:'4px 18px',
        border:`1.5px solid ${dark?'rgba(244,114,182,0.15)':'rgba(244,114,182,0.18)'}`,
        animation:'bb-fadeUp .35s ease both'}}>
        <ToggleRow icon='moon'    label='Chế độ tối'   sub='Bảo vệ mắt ban đêm'   val={dark}    onChange={setDark}/>
        <ToggleRow icon='shuffle' label='Xáo câu hỏi'  sub='Trộn thứ tự câu hỏi'  val={shuffleQ} onChange={setShuffleQ}/>
        <ToggleRow icon='dice'    label='Xáo đáp án'   sub='Trộn thứ tự đáp án'   val={shuffleA} onChange={setShuffleA}/>
        <ToggleRow icon='feather'  label='Chế độ Lite'  sub='Giảm hiệu ứng, máy chạy mượt hơn' val={liteMode||false} onChange={setLiteMode}/>
        <ToggleRow icon='zap'  label='Hiệu ứng nhấp nháy'  sub='Icon & chữ nhấp nháy nhẹ (tab, thẻ bài, thành tích)' val={flickerFx!==false} onChange={setFlickerFx}/>
      </div>

      {/* ── Lite Mode Card ── */}
      <div style={{background:C.card,backdropFilter:C.cardBlur,WebkitBackdropFilter:C.cardBlur,borderRadius:24,padding:'16px 18px',
        border:`1.5px solid ${liteMode?'rgba(52,211,153,0.4)':(dark?'rgba(244,114,182,0.15)':'rgba(244,114,182,0.15)')}`,
        boxShadow:liteMode?'0 4px 20px rgba(52,211,153,0.15)':'none',
        animation:'bb-fadeUp .38s ease both'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
          <div style={{width:32,height:32,borderRadius:10,
            background:liteMode?'rgba(52,211,153,0.2)':'rgba(244,114,182,0.1)',
            display:'flex',alignItems:'center',justifyContent:'center'}}>
            <Icon name="cpu" size={16} color={liteMode?'#10b981':'#f472b6'}/>
          </div>
          <div className="bb-section-title" style={{color:C.fg}}>Hiệu năng thiết bị</div>
          {liteMode&&<span style={{fontSize:10,fontWeight:800,color:'#10b981',
            background:'rgba(52,211,153,0.15)',border:'1px solid rgba(52,211,153,0.3)',
            borderRadius:99,padding:'2px 8px'}}>LITE ON</span>}
        </div>
        <p style={{fontSize:12,color:C.sub,marginBottom:12,lineHeight:1.55}}>
          {liteMode
            ?'Chế độ Lite đang bật — animations và hiệu ứng nặng đã được tắt để máy chạy mượt hơn.'
            :'Bật chế độ Lite nếu máy bị giật lag. Hoặc dùng nút "Phát hiện tự động" để Learnsy tự kiểm tra.'}
        </p>
        {/* Kết quả detect */}
        {detectState&&detectState!=='detecting'&&(
          <div style={{borderRadius:18,padding:'10px 14px',marginBottom:12,
            background:detectState.isLow
              ?'rgba(239,68,68,0.08)':detectState.score<80
                ?'rgba(245,158,11,0.08)':'rgba(52,211,153,0.08)',
            border:`1px solid ${detectState.isLow
              ?'rgba(239,68,68,0.3)':detectState.score<80
                ?'rgba(245,158,11,0.3)':'rgba(52,211,153,0.3)'}`,
          }}>
            <div style={{fontSize:12,fontWeight:800,color:detectState.isLow?'#ef4444':detectState.score<80?'#f59e0b':'#10b981',marginBottom:4}}>
              {detectState.label}
            </div>
            <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
              <span style={{fontSize:11,color:C.sub}}>Điểm: <b style={{color:C.fg}}>{detectState.score}/100</b></span>
              {detectState.fps&&<span style={{fontSize:11,color:C.sub}}>FPS: <b style={{color:C.fg}}>~{detectState.fps}</b></span>}
              {navigator.deviceMemory&&<span style={{fontSize:11,color:C.sub}}>RAM: <b style={{color:C.fg}}>{navigator.deviceMemory}GB</b></span>}
              {navigator.hardwareConcurrency&&<span style={{fontSize:11,color:C.sub}}>CPU: <b style={{color:C.fg}}>{navigator.hardwareConcurrency} core</b></span>}
            </div>
            {detectState.reason.length>0&&(
              <div style={{marginTop:4,fontSize:11,color:C.sub}}>
                {detectState.reason.join(' · ')}
              </div>
            )}
          </div>
        )}
        <button className="bb-btn-tap" onClick={handleAutoDetect}
          disabled={detectState==='detecting'}
          style={{
            width:'100%',padding:'11px 0',borderRadius:18,cursor:'pointer',
            border:`1.5px solid ${dark?'rgba(168,85,247,0.35)':'rgba(168,85,247,0.3)'}`,
            background:detectState==='detecting'
              ?(dark?'rgba(168,85,247,0.08)':'rgba(168,85,247,0.05)')
              :'linear-gradient(135deg,rgba(168,85,247,0.12),rgba(244,114,182,0.08))',
            color:'#a855f7',fontWeight:800,fontSize:13,
            display:'flex',alignItems:'center',justifyContent:'center',gap:8,
            fontFamily:'Nunito,sans-serif',transition:'all .2s',
            opacity:detectState==='detecting'?0.65:1,
          }}>
          {detectState==='detecting'
            ?<><span style={{display:'inline-flex',animation:'bb-spin 1s linear infinite'}}><Icon name="spinner" size={15} color="#a855f7"/></span> Đang đo...</>
            :<><Icon name="cpu" size={15} color="#a855f7"/> Phát hiện tự động</>
          }
        </button>
      </div>

      {window.BgSettingsCard&&React.createElement(window.BgSettingsCard,{dark,studentId})}

      {/* ── Sparkle Settings Card — quản lý bởi learnsy-sparkle-settings.jsx ── */}
      {window.SparkleSettingsCard&&React.createElement(window.SparkleSettingsCard,{dark})}

      {/* ── Dev Island Settings Card — quản lý bởi learnsy-dev-island.jsx ── */}
      {window.DevIslandSettingsCard&&React.createElement(window.DevIslandSettingsCard,{dark})}

      {/* ── About Card ── */}
      <div style={{background:C.card,backdropFilter:C.cardBlur,WebkitBackdropFilter:C.cardBlur,borderRadius:24,padding:'16px 18px',
        border:`1.5px solid ${dark?'rgba(244,114,182,0.15)':'rgba(244,114,182,0.15)'}`,
        animation:'bb-fadeUp .4s ease both'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:48,height:48,borderRadius:20,flexShrink:0,
            background:'linear-gradient(135deg,#fce7f3,#ede9fe)',
            display:'flex',alignItems:'center',justifyContent:'center',
            border:'1.5px solid rgba(244,114,182,0.25)'}}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#bbLgAbout)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <defs><linearGradient id="bbLgAbout" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#f472b6"/><stop offset="100%" stopColor="#6366f1"/></linearGradient></defs>
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
          </div>
          <div>
            <div className="bb-logo-taNa" style={{fontSize:24}}>Luvie</div>
            <div style={{fontSize:11,color:C.sub}}>v24.5</div>
            <div style={{fontSize:10,color:C.accent,marginTop:2,fontWeight:700,display:'flex',alignItems:'center',gap:3}}>
              Made with <Icon name="heart" size={10} color={C.accent}/> for you~
            </div>
          </div>
        </div>
      </div>

      {/* ── Logout ── */}
      <div>
        {!logoutConfirm?(
          <button className="bb-btn-tap" onClick={()=>setLogoutConfirm(true)}
            style={{
              width:'100%',padding:'14px',borderRadius:22,
              border:`1.5px solid ${C.danger}44`,background:`${C.danger}0d`,
              color:C.danger,fontWeight:800,fontSize:14,cursor:'pointer',
              display:'flex',alignItems:'center',justifyContent:'center',gap:8,
              fontFamily:'Nunito,sans-serif',transition:'all .2s',
            }}>
            <Icon name='logout' size={17} color={C.danger}/> Đăng xuất
          </button>
        ):(
          <div style={{background:`${C.danger}10`,borderRadius:22,padding:'18px',
            border:`1.5px solid ${C.danger}35`,animation:'bb-pop .2s ease both'}}>
            <div style={{fontSize:14,fontWeight:800,color:C.danger,marginBottom:12,textAlign:'center',
              display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
              <Icon name="sad" size={18} color={C.danger}/>
              Bạn chắc chắn muốn đăng xuất?
            </div>
            <div style={{display:'flex',gap:10}}>
              <button className="bb-btn-tap" onClick={onLogout}
                style={{flex:1,padding:'12px',borderRadius:18,border:'none',
                  background:'linear-gradient(135deg,#ef4444,#dc2626)',color:'#fff',
                  fontWeight:800,fontSize:14,cursor:'pointer',
                  boxShadow:'0 3px 12px rgba(239,68,68,0.35)',fontFamily:'Nunito,sans-serif'}}>
                Đăng xuất
              </button>
              <button className="bb-btn-tap" onClick={()=>setLogoutConfirm(false)}
                style={{flex:1,padding:'12px',borderRadius:18,border:'none',
                  background:dark?'rgba(255,255,255,0.1)':'rgba(0,0,0,0.07)',
                  color:C.fg,fontWeight:800,fontSize:14,cursor:'pointer',fontFamily:'Nunito,sans-serif'}}>
                Huỷ
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══ DASHBOARD SHELL ══ (biến 'Dashboard' legacy đã gỡ — DashboardEnhanced phía dưới luôn ghi đè window.Dashboard nên bản cũ là code chết) ══ */

/* ══ RE-EXPORT HELPERS (must be inside IIFE — these reference local vars) ══ */
window.bbScoreSVG        = ScoreSVG;
window.bbScoreBadge      = ScoreBadgeInline;
window.bbLetterAvatar    = LetterAvatar;
window.bbProgressBar     = ProgressBar;
window.bbRing            = Ring;
window.bbSparkline       = Sparkline;
window.bbStatCard        = StatCard;
window.bbToggle          = Toggle;
window.bbIcon            = Icon;
window.bbPctColor        = pctColor;
window.bbPctLabel        = pctLabel;
window.bbRankBadge       = rankBadge;
window.bbFmtScore        = fmtScore;
window.bbFmtDate         = fmtDate;
window.bbFloatingDecos   = FloatingDecos;
window.bbSectionHeader   = SectionHeader;
window.bbTabBar          = TabBar;
window.bbTabHome         = TabHome;
window.bbTabHistory      = TabHistory;
window.bbTabStats        = TabStats;
window.bbTabSettings     = TabSettings;
/* window.bbTabFiles được gán bởi components/files-tab.jsx (load trước dashboard.jsx) */
window.bbInjectLiteCSS   = injectLiteCSS;
window.bbDetectPerf      = detectDevicePerformance;
window.bbGlitchText      = GlitchText;
window._bbCL             = CL;
window._bbCD             = CD;
})();

/* ══════════════════════════════════════════════════════════════════
   EXTENSIONS — Bánh Bèo Edition v2 Extra Features 🎀
   Appended components: Confetti, WeekHeatmap, DailyGoal,
   MotivationalQuote, AchievementToast, LessonPreviewModal
══════════════════════════════════════════════════════════════════ */
(function(){
const {useState,useEffect,useRef,useCallback,useMemo}=React;
const CL=window._bbCL;
const CD=window._bbCD;
const Icon        =(p)=>window.bbIcon?window.bbIcon(p):null;
const pctColor    =window.bbPctColor||(()=>'#10B981');
const pctLabel    =window.bbPctLabel||(()=>'');
const fmtScore    =window.bbFmtScore||(v=>v);
const fmtDate     =window.bbFmtDate||(()=>'');
const ProgressBar =(p)=>window.bbProgressBar?React.createElement(window.bbProgressBar,p):null;
const useAvatar   =(...a)=>(window.useAvatar||window.bbLetterAvatar||function(){return{};})(...a);
const LetterAvatar=(p)=>window.LetterAvatar?React.createElement(window.LetterAvatar,p):null;
const rankBadge   =window.bbRankBadge||(()=>null);
const FloatingDecos=(p)=>window.bbFloatingDecos?React.createElement(window.bbFloatingDecos,p):null;
const SectionHeader=(p)=>window.bbSectionHeader?React.createElement(window.bbSectionHeader,p):null;
const TabBar      =(p)=>window.bbTabBar?React.createElement(window.bbTabBar,p):null;
const TabHome     =(p)=>window.bbTabHome?React.createElement(window.bbTabHome,p):null;
const TabHistory  =(p)=>window.bbTabHistory?React.createElement(window.bbTabHistory,p):null;
const TabStats    =(p)=>window.bbTabStats?React.createElement(window.bbTabStats,p):null;
const TabSettings =(p)=>window.bbTabSettings?React.createElement(window.bbTabSettings,p):null;
const TabFiles    =(p)=>window.bbTabFiles?React.createElement(window.bbTabFiles,p):null;
const GlitchText  =(p)=>window.bbGlitchText?React.createElement(window.bbGlitchText,p):(p.children||null);

/* ══ CONFETTI BURST — kawaii hearts & stars ══ */
(function(){
  if(document.getElementById('bb-confetti-css'))return;
  const s=document.createElement('style');
  s.id='bb-confetti-css';
  s.textContent=`
    @keyframes bb-confetti-piece {
      0%   { transform: translateY(0) rotate(0deg) scale(1);   opacity: 1; }
      60%  { opacity: 1; }
      100% { transform: translateY(var(--fall-y)) translateX(var(--drift-x)) rotate(var(--rot)) scale(0.4); opacity: 0; }
    }
    .bb-confetti-piece {
      position: fixed; pointer-events: none; z-index: 9999;
      animation: bb-confetti-piece var(--dur) cubic-bezier(.25,.46,.45,.94) forwards;
    }
  `;
  document.head.appendChild(s);
})();

function burstConfetti(x, y, count=18){
  const colors=['#f472b6','#a855f7','#f59e0b','#34d399','#06b6d4','#f9a8d4','#c084fc'];
  const shapes=[
    (c)=>`<svg width="13" height="13" viewBox="0 0 24 24"><path fill="${c}" d="M12 0l2.59 9.41L24 12l-9.41 2.59L12 24l-2.59-9.41L0 12l9.41-2.59z"/></svg>`,
    (c)=>`<svg width="13" height="13" viewBox="0 0 24 24"><polygon fill="${c}" points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    (c)=>`<svg width="11" height="11" viewBox="0 0 24 24"><circle fill="${c}" cx="12" cy="12" r="10"/></svg>`,
    (c)=>`<svg width="11" height="11" viewBox="0 0 24 24"><rect fill="${c}" x="3" y="3" width="18" height="18" rx="3"/></svg>`,
    (c)=>`<svg width="12" height="12" viewBox="0 0 24 24"><polygon fill="${c}" points="12 2 22 22 2 22"/></svg>`,
    (c)=>`<svg width="10" height="14" viewBox="0 0 16 22"><rect fill="${c}" x="4" y="0" width="8" height="14" rx="2"/><path fill="${c}" d="M0 14l8 8 8-8z"/></svg>`,
  ];
  for(let i=0;i<count;i++){
    const el=document.createElement('div');
    el.className='bb-confetti-piece';
    const c=colors[Math.floor(Math.random()*colors.length)];
    el.innerHTML=shapes[Math.floor(Math.random()*shapes.length)](c);
    el.style.lineHeight='1';
    const angle=(Math.random()*360)*(Math.PI/180);
    const dist=60+Math.random()*100;
    el.style.cssText=`
      left:${x}px; top:${y}px;
      width:${12+Math.random()*10}px;
      --fall-y:${Math.sin(angle)*dist}px;
      --drift-x:${Math.cos(angle)*dist}px;
      --rot:${-180+Math.random()*360}deg;
      --dur:${0.6+Math.random()*0.8}s;
    `;
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),(0.6+Math.random()*0.8+0.1)*1000);
  }
}

window.bbBurstConfetti=burstConfetti;

/* ══ WEEK HEATMAP — 7-day activity grid ══ */
function WeekHeatmap({history,dark}){
  const C=dark?CD:CL;
  const today=new Date();
  const days=Array.from({length:7},(_,i)=>{
    const d=new Date(today);
    d.setDate(today.getDate()-6+i);
    return d;
  });
  const dayLabels=['CN','T2','T3','T4','T5','T6','T7'];

  const countByDay={};
  history.forEach(h=>{
    const k=new Date(h.ts).toDateString();
    countByDay[k]=(countByDay[k]||0)+1;
  });

  return(
    <div style={{
      background:C.card,backdropFilter:C.cardBlur,WebkitBackdropFilter:C.cardBlur,borderRadius:24,padding:'16px',
      border:`1.5px solid ${dark?'rgba(244,114,182,0.15)':'rgba(244,114,182,0.15)'}`,
      animation:'bb-fadeUp .55s ease both',
    }}>
      <SectionHeader icon='history' title="Hoạt động 7 ngày qua" dark={dark} color='#f472b6'/>
      <div style={{display:'flex',gap:6,justifyContent:'space-between'}}>
        {days.map((d,i)=>{
          const k=d.toDateString();
          const cnt=countByDay[k]||0;
          const isToday=i===6;
          const intensity=cnt===0?0:cnt===1?0.35:cnt<=3?0.6:0.9;
          const bg=cnt===0
            ?(dark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.05)')
            :`rgba(244,114,182,${intensity})`;
          return(
            <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
              <div style={{
                width:'100%',aspectRatio:'1',borderRadius:10,
                background:bg,
                border:isToday?`2px solid #f472b6`:`1.5px solid ${cnt>0?'rgba(244,114,182,0.4)':'transparent'}`,
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:cnt>0?14:10,
                boxShadow:cnt>0?`0 2px 8px rgba(244,114,182,${intensity*0.5})`:'none',
                transition:'all .3s',
              }}>
                {cnt>0
                  ?<span style={{display:'inline-flex',alignItems:'center',justifyContent:'center'}}>
                    {cnt>2
                      ?<svg viewBox="0 0 24 24" width="13" height="13" fill="#fff"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      :cnt>1
                        ?<svg viewBox="0 0 24 24" width="11" height="11" fill="#fff"><path d="M12 0l2.59 9.41L24 12l-9.41 2.59L12 24l-2.59-9.41L0 12l9.41-2.59z"/></svg>
                        :<svg viewBox="0 0 24 24" width="7" height="7" fill="#fff"><circle cx="12" cy="12" r="9"/></svg>
                    }
                  </span>
                  :<span style={{opacity:0.3,display:'inline-flex'}}><svg viewBox="0 0 24 24" width="5" height="5" fill="currentColor"><circle cx="12" cy="12" r="9"/></svg></span>
                }
              </div>
              <span style={{
                fontSize:9,fontWeight:700,
                color:isToday?C.accent:C.sub,
              }}>{dayLabels[d.getDay()]}</span>
            </div>
          );
        })}
      </div>
      <div style={{marginTop:8,fontSize:11,color:C.sub,textAlign:'center'}}>
        {history.filter(h=>{
          const d=new Date(h.ts);
          return(today-d)<7*24*60*60*1000;
        }).length} bài trong tuần này
      </div>
    </div>
  );
}

/* ══ DAILY GOAL WIDGET ══ */
function DailyGoalWidget({history,dark,goal=3}){
  const C=dark?CD:CL;
  const today=new Date().toDateString();
  const todayCount=history.filter(h=>new Date(h.ts).toDateString()===today).length;
  const pct=Math.min(Math.round(todayCount/goal*100),100);
  const done=todayCount>=goal;

  const motivations=[
    'Cố lên bé ơi~','Bé học giỏi lắm!','Thêm một chút nữa thôi',
    'Học là sức mạnh!','Tuyệt vời lắm nè','Bé xịn ghê á',
  ];
  const mot=motivations[Math.floor(Date.now()/3600000)%motivations.length];

  return(
    <div style={{
      background:done
        ?`linear-gradient(135deg,rgba(16,185,129,0.18),rgba(52,211,153,0.12))`
        :(dark?'rgba(255,255,255,0.07)':'rgba(255,255,255,0.8)'),
      borderRadius:24,padding:'16px',
      border:`1.5px solid ${done?'rgba(16,185,129,0.4)':(dark?'rgba(244,114,182,0.18)':'rgba(244,114,182,0.2)')}`,
      boxShadow:done?'0 4px 20px rgba(16,185,129,0.2)':'none',
      animation:'bb-fadeUp .4s ease both',
      position:'relative',overflow:'hidden',
    }}>
      {done&&<div style={{position:'absolute',inset:0,pointerEvents:'none',
        background:'radial-gradient(circle at 80% 20%,rgba(52,211,153,0.1),transparent 60%)'}}/>}
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <div style={{
          width:52,height:52,borderRadius:20,flexShrink:0,position:'relative',
          background:done?'linear-gradient(135deg,#34d399,#10b981)':'rgba(244,114,182,0.12)',
          display:'flex',alignItems:'center',justifyContent:'center',
          boxShadow:done?'0 4px 16px rgba(52,211,153,0.4)':'none',
          animation:done?'bb-jelly 0.6s ease':'none',
        }}>
          <Icon name={done?'check':'target'} size={26} color={done?'#fff':'#f472b6'}/>
        </div>
        <div style={{flex:1}}>
          <div style={{
            fontFamily:"'Baloo 2',cursive",fontSize:15,fontWeight:800,
            color:done?'#10b981':C.fg,
          }}>
            {done?'Hoàn thành mục tiêu hôm nay!':'Mục tiêu hôm nay'}
          </div>
          <div style={{fontSize:11,color:C.sub,marginTop:1}}>
            {todayCount}/{goal} bài · {done?'Xuất sắc!':mot}
          </div>
          <div style={{marginTop:8}}>
            <ProgressBar pct={pct} color={done?'#10b981':'#f472b6'} dark={dark}/>
          </div>
        </div>
        <div style={{
          fontFamily:"'Baloo 2',cursive",fontSize:22,fontWeight:900,
          color:done?'#10b981':'#f472b6',flexShrink:0,
        }}>{todayCount}<span style={{fontSize:13,color:C.sub}}>/{goal}</span></div>
      </div>
    </div>
  );
}

/* ══ MOTIVATIONAL QUOTE ══ */
function MotivationalQuote({dark,studentName}){
  const C=dark?CD:CL;
  const name=(studentName||'bé').split(' ').slice(-1)[0];
  const quotes=[
    {text:`${name} ơi, mỗi ngày học một chút là tiến bộ rồi!`,author:'Learnsy'},
    {text:`Học không bao giờ là muộn, đặc biệt với ${name} xinh xắn!`,author:'Learnsy'},
    {text:`Cố gắng hôm nay để ${name} tự hào ngày mai!`,author:'Learnsy'},
    {text:`${name} làm được mà! Tin tưởng bản thân đi nào~`,author:'Learnsy'},
    {text:`Mỗi câu đúng là một bước tiến của ${name}!`,author:'Learnsy'},
    {text:`${name} học giỏi, ${name} xinh đẹp, ${name} làm được!`,author:'Learnsy'},
    {text:`Hôm nay ${name} học gì mới chưa? Bắt đầu thôi nào!`,author:'Learnsy'},
    {text:`Kiên nhẫn là chìa khóa, ${name} đang nắm nó rồi!`,author:'Learnsy'},
  ];
  const q=quotes[Math.floor(new Date().getDate())%quotes.length];

  return(
    <div style={{
      borderRadius:22,padding:'14px 18px',
      background:dark
        ?'linear-gradient(135deg,rgba(168,85,247,0.12),rgba(244,114,182,0.1))'
        :'linear-gradient(135deg,#f5f3ff,#fce7f3)',
      border:`1.5px solid ${dark?'rgba(168,85,247,0.2)':'rgba(168,85,247,0.2)'}`,
      animation:'bb-fadeUp .6s ease both',
      position:'relative',
    }}>
      <div style={{
        position:'absolute',top:10,left:14,fontSize:28,opacity:0.18,
        fontFamily:'Georgia,serif',lineHeight:1,color:'#a855f7',userSelect:'none',
      }}>"</div>
      <div style={{
        fontSize:13,fontWeight:700,color:C.fg,lineHeight:1.5,
        fontStyle:'italic',paddingLeft:18,fontFamily:'Nunito,sans-serif',
      }}>{q.text}</div>
      <div style={{fontSize:10,color:C.sub,marginTop:6,paddingLeft:18}}>— {q.author}</div>
      <div style={{
        position:'absolute',bottom:-2,right:10,fontSize:10,
        animation:'bb-star-twinkle 2s ease-in-out infinite',
        display:'inline-flex',
      }}><svg viewBox="0 0 24 24" width="10" height="10" fill="#a855f7"><path d="M12 0l2.59 9.41L24 12l-9.41 2.59L12 24l-2.59-9.41L0 12l9.41-2.59z"/></svg></div>
    </div>
  );
}

/* ══ ACHIEVEMENT TOAST — pop-up when unlocking ══ */
function AchievementToast({achievement,onClose,dark,liteMode,flickerFx}){
  const [leaving,setLeaving]=useState(false);

  useEffect(()=>{
    const leaveTimer=setTimeout(()=>setLeaving(true),3000);
    const closeTimer=setTimeout(onClose,3500);
    return()=>{clearTimeout(leaveTimer);clearTimeout(closeTimer);};
  },[onClose]);

  const handleTap=()=>{
    setLeaving(true);
    setTimeout(onClose,500);
  };

  /* Màu nền pill: luôn tối (dark island style) bất kể light/dark mode */
  const pillBg='linear-gradient(135deg,rgba(18,6,14,0.97) 0%,rgba(30,10,22,0.97) 100%)';
  const glowColor=achievement.color||'#f472b6';

  return(
    <div
      onClick={handleTap}
      style={{
        position:'fixed',
        top:10,
        left:'50%',
        zIndex:9999,
        /* Dynamic Island pill shape — animated via keyframes */
        width:280,
        height:56,
        borderRadius:28,
        transform:'translateX(-50%)',
        transformOrigin:'center top',
        background:pillBg,
        boxShadow:`0 0 0 1.5px rgba(255,255,255,0.08), 0 8px 28px rgba(0,0,0,0.55), 0 0 20px ${glowColor}44`,
        display:'flex',
        alignItems:'center',
        justifyContent:'center',
        gap:10,
        padding:'0 16px',
        cursor:'pointer',
        userSelect:'none',
        overflow:'hidden',
        animation: leaving
          ? 'di-pill-out 0.45s cubic-bezier(.55,.0,.45,1) both'
          : 'di-pill-in  0.55s cubic-bezier(.34,1.3,.64,1) both',
        willChange:'width,height,border-radius,opacity',
      }}
    >
      {/* Glow halo behind icon */}
      <div style={{
        position:'absolute',left:14,top:'50%',
        transform:'translateY(-50%)',
        width:32,height:32,borderRadius:'50%',
        background:glowColor,
        opacity:0.18,
        filter:'blur(8px)',
        animation:'di-glow-pulse 1.2s ease-in-out infinite',
        pointerEvents:'none',
      }}/>

      {/* Icon — nhấp nháy kiểu "kích hoạt" 1 lần rồi mới pulse đều */}
      <div style={{
        flexShrink:0,
        display:'inline-flex',
        animation: (liteMode||!flickerFx)
          ? 'di-icon-pulse 1s ease-in-out infinite'
          : 'di-activate-flicker .65s steps(1,end) 1 both, di-icon-pulse 1s ease-in-out infinite .65s',
        position:'relative',zIndex:1,
      }}>
        <Icon name={achievement.icon} size={24} color={glowColor}/>
      </div>

      {/* Text content — fades in after pill expands */}
      <div style={{
        flex:1,minWidth:0,
        animation:'di-content-in 0.55s cubic-bezier(.34,1.3,.64,1) both',
        position:'relative',zIndex:1,
      }}>
        <div style={{
          fontSize:9.5,fontWeight:800,color:glowColor,
          letterSpacing:'0.7px',textTransform:'uppercase',
          display:'flex',alignItems:'center',gap:3,
          marginBottom:1,
          fontFamily:'Nunito,sans-serif',
        }}>
          <span style={{
            display:'inline-flex',
            animation: (liteMode||!flickerFx)?'none':'di-activate-flicker .5s steps(1,end) 1 both',
          }}>
            <Icon name="ribbon" size={10} color={glowColor}/>
          </span>
          Thành tích mới!
          {!liteMode&&flickerFx&&(
            <span style={{
              display:'inline-block',width:1.5,height:9,marginLeft:1,
              background:glowColor,borderRadius:1,
              animation:'hud-cursor-blink .55s step-start infinite',
            }}/>
          )}
        </div>
        <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',lineHeight:1.15}}>
          <GlitchText color={'#fce4f0'} liteMode={liteMode||!flickerFx} style={{fontSize:14}}>
            {achievement.label}
          </GlitchText>
        </div>
      </div>

      {/* Tap-to-dismiss dot */}
      <div style={{
        flexShrink:0,width:6,height:6,borderRadius:'50%',
        background:`rgba(255,255,255,0.25)`,
        position:'relative',zIndex:1,
      }}/>
    </div>
  );
}

/* ══ LESSON PREVIEW CARD — expanded info before play ══ */
function LessonPreviewModal({lesson,history,onPlay,onPlayMode,onClose,dark}){
  const C=dark?CD:CL;
  if(!lesson)return null;
  const attempts=history.filter(h=>h.lessonTitle===lesson.title);
  const best=attempts.length?Math.max(...attempts.map(h=>h.pct)):null;
  const last=attempts[0];

  return(
    <div style={{
      position:'fixed',inset:0,zIndex:5000,
      background:'rgba(0,0,0,0.55)',backdropFilter:'blur(8px)',
      display:'flex',alignItems:'flex-end',justifyContent:'center',
      animation:'bb-fadeUp .15s ease both',
    }} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{
        width:'100%',maxWidth:760,
        background:dark?'#1a0515':'#fff5f9',
        borderRadius:'24px 24px 0 0',
        padding:'24px 20px 40px',
        animation:'bb-fadeUp .25s cubic-bezier(.34,1.56,.64,1) both',
        maxHeight:'85vh',overflowY:'auto',
      }}>
        {/* Handle bar */}
        <div style={{width:40,height:4,borderRadius:99,background:dark?'rgba(255,255,255,0.2)':'rgba(0,0,0,0.12)',
          margin:'0 auto 20px'}}/>

        <div style={{display:'flex',gap:14,marginBottom:18}}>
          <div style={{
            width:56,height:56,borderRadius:22,flexShrink:0,fontSize:28,
            background:dark?'rgba(244,114,182,0.15)':'rgba(244,114,182,0.12)',
            display:'flex',alignItems:'center',justifyContent:'center',
            border:`1.5px solid rgba(244,114,182,0.3)`,
          }}>
            {lesson.password?<Icon name='lock' size={26} color='#be4e8a'/>:best!==null?<Icon name='check' size={26} color={pctColor(best)}/>:<Icon name='book' size={26} color='#f472b6'/>}
          </div>
          <div style={{flex:1}}>
            <div style={{fontFamily:"'Baloo 2',cursive",fontSize:18,fontWeight:800,color:C.fg,lineHeight:1.2}}>
              {lesson.title}
            </div>
            <div style={{fontSize:12,color:C.sub,marginTop:4}}>
              {lesson.subject||'Tiếng Anh'} · {lesson.questionCount||0} câu hỏi
            </div>
          </div>
        </div>

        {/* Stats row */}
        {attempts.length>0&&(
          <div style={{display:'flex',gap:10,marginBottom:18}}>
            {[
              {label:'Lần thử',value:attempts.length,icon:'shuffle',color:'#a855f7'},
              {label:'Điểm cao nhất',value:fmtScore(best)+'/10',icon:'trophy',color:'#f59e0b'},
              {label:'Lần cuối',value:fmtDate(last?.ts),icon:'history',color:'#06b6d4'},
            ].map((s,i)=>(
              <div key={i} style={{flex:1,textAlign:'center',
                background:dark?'rgba(255,255,255,0.07)':'rgba(255,255,255,0.8)',
                borderRadius:18,padding:'10px 6px',
                border:`1px solid ${s.color}22`}}>
                <div style={{display:'flex',justifyContent:'center',marginBottom:2}}>
                  <Icon name={s.icon} size={16} color={s.color}/>
                </div>
                <div style={{fontSize:13,fontWeight:900,color:s.color,fontFamily:"'Baloo 2',cursive"}}>{s.value}</div>
                <div style={{fontSize:9,color:C.sub,fontWeight:700}}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Progress bar if done */}
        {best!==null&&(
          <div style={{marginBottom:18}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
              <span style={{fontSize:12,color:C.sub,fontWeight:700}}>Kết quả tốt nhất</span>
              <span style={{fontSize:12,fontWeight:800,color:pctColor(best)}}>{pctLabel(best)}</span>
            </div>
            <ProgressBar pct={best} color={pctColor(best)} dark={dark}/>
          </div>
        )}

        {/* Cách học vui / cấp tốc (chỉ hiện khi bài có câu trắc nghiệm hoặc đúng-sai) */}
        {onPlayMode&&(lesson.questions||[]).some(q=>q.type==='multiple'||q.type==='multi_select'||q.type==='true_false')&&(
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
            {[
              {mode:'fun',emoji:'🎮',title:'Học vui',sub:'Combo, XP, vuốt Đúng/Sai',bg:'linear-gradient(135deg,rgba(244,114,182,0.18),rgba(168,85,247,0.18))',bd:'rgba(168,85,247,0.4)'},
              {mode:'express',emoji:'⚡',title:'Học cấp tốc',sub:'Lướt đáp án + luyện bấm giờ',bg:'linear-gradient(135deg,rgba(251,191,36,0.2),rgba(249,115,22,0.18))',bd:'rgba(249,115,22,0.45)'},
            ].map(m=>(
              <button key={m.mode} onClick={()=>onPlayMode(lesson,m.mode)} className="bb-btn-tap"
                style={{padding:'12px 10px',borderRadius:20,border:`1.5px solid ${m.bd}`,background:m.bg,cursor:'pointer',fontFamily:'Nunito,sans-serif',textAlign:'center'}}>
                <div style={{fontSize:22}}>{m.emoji}</div>
                <div style={{fontSize:14,fontWeight:900,color:C.fg,marginTop:2}}>{m.title}</div>
                <div style={{fontSize:10.5,color:C.sub,fontWeight:700,marginTop:2}}>{m.sub}</div>
              </button>
            ))}
          </div>
        )}

        {/* Buttons */}
        <div style={{display:'flex',gap:10}}>
          <button onClick={onClose} className="bb-btn-tap"
            style={{
              flex:1,padding:'14px',borderRadius:20,border:`1.5px solid ${dark?'rgba(255,255,255,0.12)':'rgba(0,0,0,0.1)'}`,
              background:'transparent',color:C.sub,fontWeight:800,fontSize:14,cursor:'pointer',
              fontFamily:'Nunito,sans-serif',
            }}>
            Để sau
          </button>
          <button onClick={()=>{onClose();onPlay(lesson);}} className="bb-btn-tap"
            style={{
              flex:2,padding:'14px',borderRadius:20,border:'none',
              background:'linear-gradient(135deg,#f472b6,#a855f7)',
              color:'#fff',fontWeight:800,fontSize:14,cursor:'pointer',
              boxShadow:'0 4px 20px rgba(244,114,182,0.45)',
              fontFamily:'Nunito,sans-serif',
              display:'flex',alignItems:'center',justifyContent:'center',gap:8,
            }}>
            <span style={{display:'inline-flex',animation:'bb-wiggle 2s ease-in-out infinite'}}><Icon name='zap' size={16} color='#fff'/></span>
            {best!==null?'Học lại nào!':'Bắt đầu học!'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══ RE-EXPORT enhanced window globals ══ */
window.bbWeekHeatmap     = WeekHeatmap;
window.bbDailyGoal       = DailyGoalWidget;
window.bbMotivationalQ   = MotivationalQuote;
window.bbAchievementToast= AchievementToast;
window.bbLessonPreview   = LessonPreviewModal;

/* ══ DASHBOARD ENHANCED — drops in as a replacement for window.Dashboard ══
   Includes all original tabs PLUS:
     · WeekHeatmap in Stats tab
     · DailyGoalWidget + MotivationalQuote in Home tab
     · AchievementToast on new quiz completion
     · LessonPreviewModal before entering a quiz
     · Confetti burst on achievement unlock
══════════════════════════════════════════════════════════════════ */
function DashboardEnhanced(props){
  const {student,lessons,loading,fetchError,history,dark,setDark,
    onPlay,onClearHistory,onHistDetail,shuffleQ,shuffleA,setShuffleQ,setShuffleA,onLogout,onGoListening,onGoVocab,onGoPractice,practiceCount,onPlayMode}=props;

  // pct ưu tiên giá trị đã chuẩn hóa (server/gradeAll), chỉ tự tính khi thiếu.
  // Đồng thời loại bản ghi hỏng (không phải số) để thống kê không bị NaN.
  const normHistory=useMemo(()=>(history||[])
    .filter(h=>h&&Number.isFinite(Number(h.score))&&Number.isFinite(Number(h.total))&&Number(h.total)>0)
    .map(h=>{
      const score=Number(h.score),total=Number(h.total);
      const pct=Number.isFinite(Number(h.pct))?Number(h.pct):Math.round(Math.min(1,score/total)*100);
      return{...h,score,total,pct};
    }),[history]);

  const [tab,setTabRaw]=useState('home');
  const TAB_ORDER=['home','stats','history','notes','files','settings'];
  const prevTabIdxRef=useRef(0);
  const [tabDir,setTabDir]=useState('right'); // hướng animation cho tab mới vào
  const setTab=useCallback((next)=>{
    setTabRaw(prev=>{
      if(next===prev)return prev;
      const from=TAB_ORDER.indexOf(prev), to=TAB_ORDER.indexOf(next);
      setTabDir(to>from?'right':'left');
      prevTabIdxRef.current=to;
      return next;
    });
  },[]);
  const [achievementQueue,setAchievementQueue]=useState([]);
  const [previewLesson,setPreviewLesson]=useState(null);
  const [showExpSheet,setShowExpSheet]=useState(false);
  const [expSel,setExpSel]=useState({});
  const [liteMode,setLiteModeRaw]=useState(()=>localStorage.getItem('bb-lite-mode')==='1');
  const [flickerFx,setFlickerFxRaw]=useState(()=>localStorage.getItem('bb-flicker-fx')!=='0');
  function setFlickerFx(val){ setFlickerFxRaw(val); localStorage.setItem('bb-flicker-fx',val?'1':'0'); }
  const prevHistLen=useRef(normHistory.length);
  const C=dark?CD:CL;

  /* ── Khi có thành tích mới (achievementQueue tăng) — nhấp nháy TOÀN BỘ icon trên trang ── */
  const prevAchQLen=useRef(0);
  useEffect(()=>{
    if(achievementQueue.length>prevAchQLen.current&&!liteMode&&flickerFx){
      document.body.classList.add('bb-activate-all');
      const t=setTimeout(()=>document.body.classList.remove('bb-activate-all'),700);
      prevAchQLen.current=achievementQueue.length;
      return()=>clearTimeout(t);
    }
    prevAchQLen.current=achievementQueue.length;
  },[achievementQueue.length,liteMode,flickerFx]);


  function setLiteMode(val){
    setLiteModeRaw(val);
    localStorage.setItem('bb-lite-mode',val?'1':'0');
    injectLiteCSS(val);
  }

  /* ── Auto perf check ──
     TRƯỚC: chỉ trigger khi `student` chuyển từ null → có giá trị (tức
     vừa login). Với phiên đã đăng nhập sẵn (student đọc thẳng từ
     localStorage ngay lúc app mount, xem index/JS/app.jsx), giá trị đã
     "có" ngay từ frame đầu tiên nên điều kiện wasNull không bao giờ
     đúng — bài FPS-test không bao giờ chạy, liteMode không bao giờ tự
     bật cho nhóm người dùng này dù máy yếu. Đây là phần lớn traffic
     thực tế (đa số người vào lại web đã đăng nhập từ trước), nên đây là
     nguyên nhân chính khiến toàn trang vẫn giật trên máy yếu dù cơ chế
     lite-mode đã được xây sẵn.
     SAU: chỉ cần có student (đăng nhập, dù cũ hay mới) — hàm
     runLoginPerfCheck() bên trong đã tự chặn bằng sessionStorage
     ('bb-perf-checked') nên vẫn chỉ chạy FPS-test đúng 1 lần/tab, gọi
     lại nhiều lần không tốn thêm chi phí. */
  const perfCheckedRef=useRef(false);
  useEffect(()=>{
    const hasStudent=!!(student?.id||student?.username);
    if(!hasStudent||perfCheckedRef.current)return;
    perfCheckedRef.current=true;
    if(sessionStorage.getItem('bb-perf-checked')==='1')return;
    runLoginPerfCheck().then(r=>{ if(r.liteMode&&!liteMode) setLiteMode(true); });
  },[student]); // eslint-disable-line

  // ── Sync display_name từ Supabase (khớp với student-manager) ──
  const [liveStudent,setLiveStudent]=useState(student);
  const fetchStudentInfo=useCallback(async()=>{
    if(!student?.id&&!student?.username)return;
    try{
      // maybeSingle: tài khoản đã bị admin XÓA → data=null (không ném lỗi)
      const cols='id,username,display_name,class_name,is_active';
      const q=student?.id
        ?window.supa.from('students').select(cols).eq('id',student.id).maybeSingle()
        :window.supa.from('students').select(cols).eq('username',student.username).maybeSingle();
      const{data,error}=await q;
      if(error)return;                       // lỗi mạng: KHÔNG đăng xuất nhầm
      if(!data){                             // tài khoản không còn tồn tại
        onLogout&&onLogout('deleted');
        return;
      }
      if(data.is_active===false){            // bị khóa
        onLogout&&onLogout('locked');
        return;
      }
      setLiveStudent(s=>({...s,...data}));
      try{window.LearnsySession?.updateUser?.({display_name:data.display_name,class_name:data.class_name});}catch{}
    }catch(e){}
  },[student?.id,student?.username,onLogout]);
  useEffect(()=>{
    fetchStudentInfo();
    const onVis=()=>{if(document.visibilityState==='visible')fetchStudentInfo();};
    window.addEventListener('learnsy:student-saved',fetchStudentInfo);
    document.addEventListener('visibilitychange',onVis);
    return()=>{
      window.removeEventListener('learnsy:student-saved',fetchStudentInfo);
      document.removeEventListener('visibilitychange',onVis);
    };
  },[fetchStudentInfo]);
  const eff=liveStudent||student;

  // Avatar
  const userId=eff?.id||eff?.username;
  const {avatarUrl,loading:avatarLoading,uploadAvatar,removeAvatar}=useAvatar(userId);

  useEffect(()=>{
    const saved=localStorage.getItem('bb-lite-mode')==='1';
    if(saved) injectLiteCSS(true);
  },[]);

  /* ── Background — quản lý bởi background-settings.js ── */
  useEffect(()=>{
    if(window.applyBackground&&window.loadBgSettings){
      window.applyBackground(window.loadBgSettings());
    }
  },[dark]);

  /* ── Sparkle particles (Plavsky) — quản lý bởi learnsy-sparkle-settings.jsx ── */
  useEffect(()=>{
    window.bbApplySparkle&&window.bbApplySparkle(dark);
  },[dark]);

  /* ── Achievement detection ── */
  useEffect(()=>{
    if(normHistory.length<=prevHistLen.current){ prevHistLen.current=normHistory.length; return; }
    prevHistLen.current=normHistory.length;
    const n=normHistory.length;
    const best=Math.max(...normHistory.map(h=>h.pct));
    const checks=[
      {cond:n===1,   icon:'check',   label:'Bắt đầu hành trình!', color:'#34d399'},
      {cond:n===5,   icon:'book',    label:'5 bài siêng năng!',   color:'#a855f7'},
      {cond:n===10,  icon:'star',    label:'10 bài chăm chỉ!',    color:'#f59e0b'},
      {cond:n===20,  icon:'zap',     label:'Thần đồng 20 bài!',   color:'#06b6d4'},
      {cond:n===50,  icon:'trending',label:'50 bài siêu anh hùng!',color:'#f472b6'},
      {cond:best>=70,icon:'thumbsup',label:'Đạt điểm Giỏi!',     color:'#f472b6'},
      {cond:best>=90,icon:'trophy',  label:'Điểm Xuất sắc!',     color:'#f59e0b'},
    ];
    const unlocked=checks.filter(c=>c.cond);
    if(unlocked.length){
      setAchievementQueue(q=>[...q,...unlocked]);
      setTimeout(()=>window.bbBurstConfetti&&window.bbBurstConfetti(window.innerWidth/2,120,24),300);
    }
  },[normHistory]);

  /* ── Intercept play → show preview first ── */
  function handlePlay(lesson){ setPreviewLesson(lesson); }
  function confirmPlay(lesson){ setPreviewLesson(null); onPlay(lesson); }
  function confirmPlayMode(lesson,mode){ setPreviewLesson(null); onPlayMode&&onPlayMode(lesson,mode); }

  const tabTitles={home:'Trang chủ',stats:'Thống kê',history:'Lịch sử',notes:'Sổ ghi chú',files:'Tài liệu',settings:'Cài đặt'};
  const swipeEnabled=!showExpSheet&&!previewLesson;
  const swipe=(window.useSwipe?window.useSwipe:function(){return{};})({
    onSwipeLeft:function(){
      if(!swipeEnabled)return;
      const i=TAB_ORDER.indexOf(tab);
      if(i<TAB_ORDER.length-1) setTab(TAB_ORDER[i+1]);
    },
    onSwipeRight:function(){
      if(!swipeEnabled)return;
      const i=TAB_ORDER.indexOf(tab);
      if(i>0) setTab(TAB_ORDER[i-1]);
    },
    threshold:56,
  });

  return(
    <div style={{maxWidth:760,margin:'0 auto',minHeight:'100vh',color:C.fg,position:'relative',fontFamily:'Nunito,sans-serif',WebkitOverflowScrolling:'touch',overflowX:'hidden'}}>
      {!liteMode&&<FloatingDecos dark={dark}/>}

      {/* ── Top Bar ── */}
      <div style={{
        position:'sticky',top:0,zIndex:100,
        background:dark?'rgba(18,0,12,0.93)':'rgba(255,245,250,0.93)',
        backdropFilter:'blur(20px)',
        borderBottom:`1px solid ${dark?'rgba(244,114,182,0.2)':'rgba(244,114,182,0.18)'}`,
        padding:'11px 18px',display:'flex',alignItems:'center',justifyContent:'space-between',
        boxShadow:dark?'0 2px 20px rgba(244,114,182,0.1)':'0 2px 20px rgba(244,114,182,0.08)',
      }}>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <span style={{animation:'bb-float 2.8s ease-in-out infinite',display:'inline-flex'}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="url(#bbLgH)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <defs><linearGradient id="bbLgH" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#f472b6"/><stop offset="100%" stopColor="#6366f1"/></linearGradient></defs>
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
          </span>
          <span className="bb-logo-wrap">
            <span className="bb-logo-taNa" style={{fontSize:26}}>Luvie</span>
            <span className="bb-logo-sub">v24.5</span>
          </span>
          <span style={{animation:'bb-sparkle-rotate 3s linear infinite',display:'inline-flex',opacity:0.85}}>
            <svg width="12" height="12" viewBox="0 0 20 20" fill="#6366f1"><path d="M10 0 L11.5 8.5 L20 10 L11.5 11.5 L10 20 L8.5 11.5 L0 10 L8.5 8.5 Z"/></svg>
          </span>
        </div>
        <div style={{fontSize:13,fontWeight:700,color:C.sub}}>{tabTitles[tab]}</div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <button className="bb-dm-btn" onClick={()=>{
              const sel={};(lessons||[]).forEach((_,i)=>{sel[i]=true;});
              setExpSel(sel);setShowExpSheet(true);
            }}
            style={{
              width:38,height:38,borderRadius:12,
              background:dark?'rgba(244,114,182,0.1)':'rgba(244,114,182,0.08)',
              border:`1.5px solid ${dark?'rgba(244,114,182,0.25)':'rgba(244,114,182,0.22)'}`,
              display:'flex',alignItems:'center',justifyContent:'center',
              transition:'all .25s cubic-bezier(.34,1.56,.64,1)',
            }}>
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#f472b6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
          <button className="bb-dm-btn" onClick={()=>setDark(d=>!d)}
            style={{
              width:38,height:38,borderRadius:12,
              background:dark?'rgba(245,158,11,0.15)':'rgba(168,85,247,0.1)',
              border:`1.5px solid ${dark?'rgba(245,158,11,0.3)':'rgba(168,85,247,0.25)'}`,
              display:'flex',alignItems:'center',justifyContent:'center',
              transition:'all .25s cubic-bezier(.34,1.56,.64,1)',
            }}>
            {dark
              ?<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              :<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            }
          </button>
        </div>
      </div>

      {/* ── Content (vuốt trái/phải để đổi tab, giống app native) ── */}
      <div
        {...swipe}
        style={{overflowX:'hidden'}}>
        <div key={tab} style={{
          position:'relative',zIndex:1,
          animation:liteMode?'none':`${tabDir==='right'?'bb-slide-in-right':'bb-slide-in-left'} .22s cubic-bezier(.22,.9,.32,1) both`,
          willChange:liteMode?'auto':'transform',
        }}>

        {tab==='home'&&(
          <>
            <TabHome {...{student:eff,lessons,loading,fetchError,onPlay:handlePlay,
              shuffleQ,shuffleA,setShuffleQ,setShuffleA,history:normHistory,dark,setTab,avatarUrl,liteMode,flickerFx,onGoListening,onGoVocab,onGoPractice,practiceCount}}/>
            {normHistory.length>0&&(
              <div style={{padding:'0 14px 100px',display:'flex',flexDirection:'column',gap:10}}>
                <DailyGoalWidget history={normHistory} dark={dark}/>
                <MotivationalQuote dark={dark} studentName={eff?.display_name||eff?.username}/>
              </div>
            )}
            {normHistory.length===0&&<div style={{paddingBottom:90}}/>}
          </>
        )}

        {tab==='stats'&&(
          <>
            <TabStats history={normHistory} dark={dark}/>
            {normHistory.length>0&&(
              <div style={{padding:'0 14px 100px'}}>
                <WeekHeatmap history={normHistory} dark={dark}/>
              </div>
            )}
          </>
        )}

        {tab==='history'&&(
          <TabHistory history={normHistory} onHistDetail={onHistDetail}
            onClearHistory={onClearHistory} dark={dark} historyLoading={props.historyLoading}/>
        )}

        {tab==='notes'&&(
          <NotesScreen embedded dark={dark} student={eff}/>
        )}

        {tab==='files'&&(
          <TabFiles dark={dark} liteMode={liteMode} flickerFx={flickerFx}/>
        )}

        {tab==='settings'&&(
          <TabSettings {...{student:eff,dark,setDark,shuffleQ,shuffleA,
            setShuffleQ,setShuffleA,onLogout,history:normHistory,
            avatarUrl,avatarLoading,onAvatarUpload:uploadAvatar,onAvatarRemove:removeAvatar,studentId:userId,liteMode,setLiteMode,
            flickerFx,setFlickerFx}}/>
        )}
        </div>
      </div>

      <TabBar tab={tab} setTab={setTab} dark={dark} liteMode={liteMode} flickerFx={flickerFx}/>

      {/* ── Export Sheet ── */}
      {showExpSheet&&(
        <>
          <div onClick={()=>setShowExpSheet(false)} style={{position:'fixed',inset:0,background:'rgba(10,2,25,0.72)',zIndex:8800,backdropFilter:'blur(4px)',WebkitBackdropFilter:'blur(4px)'}}/>
          <div style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:760,zIndex:8801,borderRadius:'28px 28px 0 0',padding:'20px 20px 36px',background:'linear-gradient(160deg,#1E0845,#120330)',borderTop:'1.5px solid rgba(255,150,200,0.2)',boxShadow:'0 -12px 60px rgba(168,85,247,0.3)'}}>
            <div style={{width:36,height:4,borderRadius:99,background:'rgba(255,255,255,0.15)',margin:'0 auto 18px'}}/>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F472B6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span style={{fontSize:15,fontWeight:900,color:'#F0DCE8',flex:1}}>Tải bài về máy</span>
              <button onClick={()=>setShowExpSheet(false)} style={{background:'none',border:'none',cursor:'pointer',padding:4,color:'#8A6080',display:'flex',borderRadius:999,transition:'all .15s'}}
                onMouseEnter={e=>{e.currentTarget.style.color='#F472B6';e.currentTarget.style.background='rgba(244,114,182,0.12)';}}
                onMouseLeave={e=>{e.currentTarget.style.color='#8A6080';e.currentTarget.style.background='none';}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <p style={{fontSize:12,color:'#8A6080',marginBottom:14,lineHeight:1.6}}>File HTML hoạt động offline, không cần internet.</p>
            <div style={{display:'flex',gap:7,marginBottom:12}}>
              <button onClick={()=>{const s={};(lessons||[]).forEach((_,i)=>{s[i]=true;});setExpSel(s);}}
                style={{padding:'5px 13px',borderRadius:999,border:'1.5px solid rgba(244,114,182,0.3)',background:'rgba(244,114,182,0.08)',color:'#F9A8D4',fontSize:11,fontWeight:800,cursor:'pointer',fontFamily:'Nunito,sans-serif',transition:'all .15s'}}
                onMouseEnter={e=>{e.currentTarget.style.background='rgba(244,114,182,0.18)';e.currentTarget.style.transform='translateY(-1px)';}}
                onMouseLeave={e=>{e.currentTarget.style.background='rgba(244,114,182,0.08)';e.currentTarget.style.transform='translateY(0)';}}
                onMouseDown={e=>e.currentTarget.style.transform='scale(0.95)'}
                onMouseUp={e=>e.currentTarget.style.transform='translateY(-1px)'}>Chọn tất cả</button>
              <button onClick={()=>setExpSel({})}
                style={{padding:'5px 13px',borderRadius:999,border:'1.5px solid rgba(168,85,247,0.3)',background:'rgba(168,85,247,0.08)',color:'#C084FC',fontSize:11,fontWeight:800,cursor:'pointer',fontFamily:'Nunito,sans-serif',transition:'all .15s'}}
                onMouseEnter={e=>{e.currentTarget.style.background='rgba(168,85,247,0.18)';e.currentTarget.style.transform='translateY(-1px)';}}
                onMouseLeave={e=>{e.currentTarget.style.background='rgba(168,85,247,0.08)';e.currentTarget.style.transform='translateY(0)';}}
                onMouseDown={e=>e.currentTarget.style.transform='scale(0.95)'}
                onMouseUp={e=>e.currentTarget.style.transform='translateY(-1px)'}>Bỏ chọn</button>
            </div>
            <div style={{maxHeight:'38vh',overflowY:'auto',display:'flex',flexDirection:'column',gap:6,marginBottom:16,paddingRight:2}}>
              {(lessons||[]).map((l,i)=>(
                <div key={i} onClick={()=>setExpSel(s=>({...s,[i]:!s[i]}))}
                  style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:18,border:`1.5px solid ${expSel[i]?'rgba(168,85,247,0.6)':'rgba(255,150,200,0.15)'}`,background:expSel[i]?'rgba(168,85,247,0.1)':'rgba(255,255,255,0.04)',cursor:'pointer',transition:'all .15s'}}>
                  <div style={{width:18,height:18,borderRadius:6,border:`1.5px solid ${expSel[i]?'#A855F7':'rgba(255,255,255,0.2)'}`,background:expSel[i]?'linear-gradient(135deg,#F472B6,#A855F7)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all .15s'}}>
                    {expSel[i]&&<svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1.5 6 4.5 9 10.5 3"/></svg>}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:800,color:'#F0DCE8',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{l.password?'🔒 ':''}{l.title||'Chưa đặt tên'}</div>
                    <div style={{fontSize:11,color:'#8A6080',marginTop:2}}>{(l.questions||[]).length} câu hỏi</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>{
                const selected=(lessons||[]).filter((_,i)=>expSel[i]);
                if(!selected.length){alert('Chọn ít nhất 1 bài nhé!');return;}
                if(typeof window.buildExportLiteHTML==='function'){
                  const html=window.buildExportLiteHTML(selected);
                  const blob=new Blob([html],{type:'text/html;charset=utf-8'});
                  const url=URL.createObjectURL(blob);
                  const a=document.createElement('a');
                  const name=selected.length===1?(selected[0].title||'learnsy-quiz'):'learnsy-'+selected.length+'bai';
                  a.href=url;a.download=name.replace(/[<>:"/\|?*]/g,'').trim()+'.html';
                  document.body.appendChild(a);a.click();
                  setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},1000);
                  setShowExpSheet(false);
                }
              }} style={{flex:1,padding:'11px 0',borderRadius:999,border:'1.5px solid rgba(255,150,200,0.3)',background:'transparent',color:'#F9A8D4',fontSize:13,fontWeight:800,cursor:'pointer',fontFamily:'Nunito,sans-serif',transition:'all .15s'}}
                onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,150,200,0.1)';e.currentTarget.style.transform='translateY(-1px)';}}
                onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.transform='translateY(0)';}}
                onMouseDown={e=>e.currentTarget.style.transform='scale(0.96)'}
                onMouseUp={e=>e.currentTarget.style.transform='translateY(-1px)'}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:-2,marginRight:4}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Lite
              </button>
              <button onClick={()=>{
                const selected=(lessons||[]).filter((_,i)=>expSel[i]);
                if(!selected.length){alert('Chọn ít nhất 1 bài nhé!');return;}
                if(typeof window.buildExportHTML==='function'){
                  const html=window.buildExportHTML(selected);
                  const blob=new Blob([html],{type:'text/html;charset=utf-8'});
                  const url=URL.createObjectURL(blob);
                  const a=document.createElement('a');
                  const name=selected.length===1?(selected[0].title||'learnsy-quiz'):'learnsy-'+selected.length+'bai';
                  a.href=url;a.download=name.replace(/[<>:"/\|?*]/g,'').trim()+'.html';
                  document.body.appendChild(a);a.click();
                  setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},1000);
                  setShowExpSheet(false);
                }
              }} style={{flex:1,padding:'11px 0',borderRadius:999,border:'none',background:'linear-gradient(135deg,#F472B6,#A855F7)',color:'#fff',fontSize:13,fontWeight:800,cursor:'pointer',fontFamily:'Nunito,sans-serif',boxShadow:'0 4px 18px rgba(168,85,247,0.35)',transition:'all .18s'}}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 6px 24px rgba(168,85,247,0.48)';}}
                onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 4px 18px rgba(168,85,247,0.35)';}}
                onMouseDown={e=>e.currentTarget.style.transform='scale(0.96)'}
                onMouseUp={e=>e.currentTarget.style.transform='translateY(-2px)'}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:-2,marginRight:4}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Full (âm thanh)
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Achievement Toast ── */}
      {achievementQueue.length>0&&(
        <AchievementToast
          achievement={achievementQueue[0]}
          dark={dark}
          liteMode={liteMode}
          flickerFx={flickerFx}
          onClose={()=>setAchievementQueue(q=>q.slice(1))}
        />
      )}

      {/* ── Lesson Preview Modal ── */}
      {previewLesson&&(
        <LessonPreviewModal
          lesson={previewLesson}
          history={normHistory}
          onPlay={confirmPlay}
          onPlayMode={onPlayMode?confirmPlayMode:undefined}
          onClose={()=>setPreviewLesson(null)}
          dark={dark}
        />
      )}
    </div>
  );
}

/* ── Export ── */
/* DashboardEnhanced là phiên bản đầy đủ tính năng.
   Để dùng, thay window.Dashboard = DashboardEnhanced trong index.html,
   hoặc dùng trực tiếp: ReactDOM.render(<DashboardEnhanced .../>, ...) */
window.DashboardEnhanced = DashboardEnhanced;
window.Dashboard         = DashboardEnhanced; /* auto-upgrade */

/* ══ CHANGELOG / WHATSNEW BANNER ══ */
function WhatsNewBanner({dark,onDismiss}){
  const C=dark?CD:CL;
  const items=[
    {icon:'target',  text:'Mục tiêu học hàng ngày'},
    {icon:'history', text:'Heatmap hoạt động 7 ngày'},
    {icon:'ribbon',  text:'Thành tích tự động mở khoá'},
    {icon:'book',    text:'Preview bài học trước khi vào'},
    {icon:'star',    text:'Hiệu ứng sparkle khi đạt thành tích'},
  ];
  return(
    <div style={{
      margin:'12px 14px 0',borderRadius:24,overflow:'hidden',
      border:`1.5px solid rgba(168,85,247,0.3)`,
      animation:'bb-fadeUp .3s ease both',
    }}>
      <div style={{
        background:'linear-gradient(135deg,#a855f7,#f472b6)',
        padding:'10px 14px',
        display:'flex',alignItems:'center',justifyContent:'space-between',
      }}>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <span style={{display:'inline-flex',animation:'bb-sparkle-rotate 3s linear infinite',color:'#fff'}}>
            <Icon name="sparkle" size={16} color="#fff"/>
          </span>
          <span style={{fontFamily:"'Baloo 2',cursive",fontSize:14,fontWeight:800,color:'#fff'}}>
            Cập nhật mới · Dashboard v3
          </span>
        </div>
        <button onClick={onDismiss}
          style={{background:'rgba(255,255,255,0.2)',border:'none',cursor:'pointer',
            color:'#fff',fontSize:12,fontWeight:700,padding:'2px 8px',borderRadius:99,
            fontFamily:'Nunito,sans-serif',display:'inline-flex',alignItems:'center',gap:4,transition:'all .15s'}}
          onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,0.32)';e.currentTarget.style.transform='translateY(-1px)';}}
          onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.2)';e.currentTarget.style.transform='translateY(0)';}}
          onMouseDown={e=>e.currentTarget.style.transform='scale(0.94)'}
          onMouseUp={e=>e.currentTarget.style.transform='translateY(-1px)'}>
          <Icon name="check" size={12} color="#fff"/> Đã hiểu
        </button>
      </div>
      <div style={{
        background:dark?'rgba(168,85,247,0.12)':'rgba(245,243,255,0.9)',
        padding:'10px 14px',display:'flex',flexDirection:'column',gap:5,
      }}>
        {items.map((it,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:8,
            animation:`bb-fadeUp .25s ease ${i*0.07}s both`}}>
            <span style={{display:'inline-flex',flexShrink:0,color:'#a855f7'}}>
              <Icon name={it.icon} size={14} color='#a855f7'/>
            </span>
            <span style={{fontSize:12,fontWeight:700,color:C.sub}}>{it.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
window.bbWhatsNew=WhatsNewBanner;

})(); /* ══ END EXTENSIONS IIFE ══ */

/* ══ END OF DASHBOARD.JS · Learnsy Bánh Bèo Edition ══ */
