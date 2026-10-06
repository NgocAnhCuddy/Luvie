import React from 'react';

/* ══════════════════════════════════════════════
   🎨 THEMES — admin/JS/themes.jsx
   Nút 🎨 nằm trong header, cạnh nút dark-mode
   Dropdown mở xuống, dot fan ra
   ══════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── CSS (nội tuyến) ── */
  const STYLE = `
    #bb-theme-hdr-btn {
      display: flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; border-radius: 999px;
      border: 1.5px solid var(--bb-theme-border, #E8DCFF);
      background: var(--bb-theme-bg, #F0E6FF);
      cursor: pointer; flex-shrink: 0;
      transition: transform .18s, background .15s;
      position: relative;
    }
    #bb-theme-hdr-btn:hover { transform: scale(1.08); }

    /* swatch nhỏ bên trong nút */
    #bb-theme-hdr-swatch {
      width: 14px; height: 14px; border-radius: 50%;
      border: 1.5px solid rgba(255,255,255,0.5);
      pointer-events: none;
      transition: background .25s;
    }

    /* Dropdown panel */
    #bb-theme-panel {
      position: fixed;
      z-index: 9999;
      background: rgba(255,245,249,0.92);
      backdrop-filter: blur(14px);
      border: 1.5px solid #F5D5E8;
      border-radius: 18px;
      padding: 10px 12px;
      box-shadow: 0 8px 32px rgba(168,85,247,0.18);
      display: flex; flex-direction: column; gap: 6px;
      opacity: 0; transform: translateY(-6px) scale(0.96);
      transition: opacity .18s ease, transform .18s cubic-bezier(0.34,1.56,0.64,1);
      pointer-events: none;
    }
    #bb-theme-panel.open {
      opacity: 1; transform: translateY(0) scale(1);
      pointer-events: all;
    }
    body.dark #bb-theme-panel {
      background: rgba(30,10,25,0.92);
      border-color: #421526;
    }
    body.dark #bb-theme-hdr-btn {
      --bb-theme-border: #421526;
      --bb-theme-bg: #2A1040;
    }

    .bb-theme-row {
      display: flex; align-items: center; gap: 9px;
      cursor: pointer; padding: 4px 6px; border-radius: 10px;
      transition: background .12s;
    }
    .bb-theme-row:hover { background: rgba(168,85,247,0.08); }
    .bb-theme-row.active { background: rgba(168,85,247,0.13); }

    .bb-theme-dot {
      width: 20px; height: 20px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.45);
      flex-shrink: 0; position: relative;
    }
    .bb-theme-row.active .bb-theme-dot::after {
      content: '✓';
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 11px; font-weight: 900;
    }
    .bb-theme-lbl {
      font-family: 'Nunito', sans-serif;
      font-size: 12px; font-weight: 800;
      color: #3D1830; white-space: nowrap;
    }
    body.dark .bb-theme-lbl { color: #F0DCE8; }
  `;
  if (!document.getElementById('bb-theme-style')) {
    const s = document.createElement('style');
    s.id = 'bb-theme-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  // ❌ Đã xóa hàm injectCSS và lời gọi injectCSS('admin/CSS/themes.css')
  // CSS themes.css đã được import tĩnh trong main.jsx, không cần load thủ công

  /* ── Theme data ── */
  const THEMES = [
    { id: 'default',  color: 'linear-gradient(135deg,#F472B6,#A855F7)', dot: '#D946EF', label: 'Mặc định 🌸' },
    { id: 'princess', color: 'linear-gradient(135deg,#E91E8C,#D4A017)',  dot: '#E91E8C', label: 'Princess 👑' },
    { id: 'minty',    color: 'linear-gradient(135deg,#10B981,#06B6D4)',  dot: '#10B981', label: 'Minty Chill 🍃' },
    { id: 'galaxy',   color: 'linear-gradient(135deg,#E879F9,#818CF8)',  dot: '#818CF8', label: 'Galaxy 🌌' },
  ];
  const STORAGE_KEY = 'bb_admin_theme';
  let current = localStorage.getItem(STORAGE_KEY) || 'default';
  const ALL_CLASSES = THEMES.map(t => 'theme-' + t.id);

  function applyTheme(id) {
    document.body.classList.remove(...ALL_CLASSES);
    if (id !== 'default') document.body.classList.add('theme-' + id);
    current = id;
    localStorage.setItem(STORAGE_KEY, id);
    // update swatch
    const sw = document.getElementById('bb-theme-hdr-swatch');
    const th = THEMES.find(t => t.id === id) || THEMES[0];
    if (sw) sw.style.background = th.dot;
    // update active rows
    document.querySelectorAll('.bb-theme-row').forEach(r => {
      r.classList.toggle('active', r.dataset.theme === id);
    });
    const msgs = { princess:'Công chúa rồi nè 👑💗', minty:'Mát mẻ ghê 🍃✨', galaxy:'Vũ trụ đây 🌌💫', default:'Về màu gốc rồi 🌸' };
    if (window.BbAdminUxNung) window.BbAdminUxNung.nag(msgs[id] || msgs.default, 2200);
  }

  /* ── Dropdown panel ── */
  let panel = null;
  let panelOpen = false;

  function buildPanel() {
    if (document.getElementById('bb-theme-panel')) return;
    panel = document.createElement('div');
    panel.id = 'bb-theme-panel';
    THEMES.forEach(t => {
      const row = document.createElement('div');
      row.className = 'bb-theme-row' + (t.id === current ? ' active' : '');
      row.dataset.theme = t.id;

      const dot = document.createElement('div');
      dot.className = 'bb-theme-dot';
      dot.style.background = t.color;

      const lbl = document.createElement('span');
      lbl.className = 'bb-theme-lbl';
      lbl.textContent = t.label;

      row.appendChild(dot);
      row.appendChild(lbl);
      row.addEventListener('click', () => {
        applyTheme(t.id);
        setTimeout(closePanel, 220);
      });
      panel.appendChild(row);
    });
    document.body.appendChild(panel);
  }

  function openPanel(anchor) {
    buildPanel();
    panel = document.getElementById('bb-theme-panel');
    if (!panel) return;
    // position below anchor
    const rect = anchor.getBoundingClientRect();
    panel.style.top  = (rect.bottom + 6) + 'px';
    panel.style.right = (window.innerWidth - rect.right) + 'px';
    panel.style.left = 'auto';
    panelOpen = true;
    panel.classList.add('open');
  }

  function closePanel() {
    panelOpen = false;
    document.getElementById('bb-theme-panel')?.classList.remove('open');
  }

  function togglePanel(anchor) {
    if (panelOpen) closePanel();
    else openPanel(anchor);
  }

  document.addEventListener('click', (e) => {
    if (panelOpen && !e.target.closest('#bb-theme-panel') && !e.target.closest('#bb-theme-hdr-btn'))
      closePanel();
  });

  /* ── Inject header button ── */
  const BTN_ID = 'bb-theme-hdr-btn';

  function injectBtn() {
    if (document.getElementById(BTN_ID)) return; // đã có rồi
    const dmBtn = document.querySelector('.dm-btn');
    if (!dmBtn) return;

    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.title = 'Đổi theme 🎨';

    const swatch = document.createElement('div');
    swatch.id = 'bb-theme-hdr-swatch';
    const th = THEMES.find(t => t.id === current) || THEMES[0];
    swatch.style.background = th.dot;

    btn.appendChild(swatch);
    btn.addEventListener('click', (e) => { e.stopPropagation(); togglePanel(btn); });

    // Chèn vào trước .dm-btn
    dmBtn.parentNode.insertBefore(btn, dmBtn);
  }

  /* ── MutationObserver: re-inject sau React re-render ── */
  let _injectTimer = null;
  const obs = new MutationObserver(() => {
    if (document.getElementById(BTN_ID)) return; // còn đó, bỏ qua
    clearTimeout(_injectTimer);
    _injectTimer = setTimeout(injectBtn, 50);
  });
  obs.observe(document.body, { childList: true, subtree: true });

  /* ── Init ── */
  function init() {
    applyTheme(current);
    setTimeout(injectBtn, 1000);
  }
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();

  window.BbAdminThemes = { apply: applyTheme, current: () => current, toggle: () => {
    const btn = document.getElementById(BTN_ID);
    if (btn) togglePanel(btn);
  }};
})();
