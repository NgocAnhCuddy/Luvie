import React from 'react';

/* ══════════════════════════════════════════════
   🌸 BÁNH BÈO UI — admin/JS/banh-beo-ui.jsx
   Admin panel button pop + input gradient
   ══════════════════════════════════════════════ */
(function () {
  'use strict';

  // ❌ Đã xóa import động CSS và hàm injectCSS
  // CSS được import tĩnh từ main.jsx nên không cần load lại ở đây

  const TOOLTIPS_ADMIN = [
    'Gõ nhẹ thôi nha admin ơi 🥺',
    'Nhập câu hỏi hay vào đây nhe 💖',
    'Đừng typo nha, học sinh khổ lắm 😭',
    'Điền đầy đủ là app vui lắm 💕',
  ];
  let tipIdx = 0;
  function nextTip() { return TOOLTIPS_ADMIN[tipIdx++ % TOOLTIPS_ADMIN.length]; }

  /* ── Detect React-managed node ───────────────────────────────────── */
  function isReactManaged(el) {
    try {
      return Object.keys(el).some(
        k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance')
      );
    } catch { return false; }
  }

  /* ── Check contentEditable tổ tiên ── */
  function hasContentEditableAncestor(el) {
    let node = el.parentNode;
    while (node && node !== document.body) {
      if (node.contentEditable === 'true') return true;
      node = node.parentNode;
    }
    return false;
  }

  /* ── Button enhancement ── */
  function enhanceButton(btn) {
    if (btn.dataset.bbBtn) return;
    btn.dataset.bbBtn = '1';
    btn.classList.add('bb-btn');

    // Nút nào đã có transition riêng cho transform (khai báo qua style prop trong
    // React, vd transition:'all .18s' hoặc transition:'...,transform .15s') thì
    // đánh dấu quản lý riêng — wiggle/marshmallow ở banh-beo-ui.css sẽ bỏ qua các
    // nút này, vì 2 hệ thống cùng đổi transform sẽ đè lẫn nhau. Ripple hiệu ứng
    // (span con) vẫn áp dụng cho mọi nút vì nó không đụng transform của chính nút.
    const trans = btn.style.transition || '';
    if (/transform|^all\b/.test(trans)) {
      btn.dataset.bbManaged = '1';
    }

    btn.addEventListener('pointerdown', (e) => {
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.5;
      const ripple = document.createElement('span');
      ripple.className = 'bb-ripple';
      Object.assign(ripple.style, {
        width: size + 'px', height: size + 'px',
        left: (e.clientX - rect.left - size / 2) + 'px',
        top:  (e.clientY - rect.top  - size / 2) + 'px',
      });
      btn.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
    });

    btn.addEventListener('click', () => {
      if (btn.dataset.bbManaged) return; // đã có press animation riêng, không cần marshmallow
      btn.classList.remove('bb-clicking');
      void btn.offsetWidth;
      btn.classList.add('bb-clicking');
    });
    btn.addEventListener('animationend', (e) => {
      if (e.animationName === 'bb-marshmallow') btn.classList.remove('bb-clicking');
    });
  }

  /* ── Input enhancement ── */
  function enhanceInput(input) {
    if (input.dataset.bbInput) return;
    input.dataset.bbInput = '1';

    const tag = input.tagName.toLowerCase();
    if (!['input','textarea','select'].includes(tag)) return;
    if (input.type === 'hidden' || input.type === 'file') return;

    if (isReactManaged(input)) {
      input.classList.add('bb-input-direct');
      return;
    }

    const parent = input.parentNode;
    if (!parent || parent.classList.contains('bb-input-wrap')) return;
    if (hasContentEditableAncestor(input)) return;

    const cs = getComputedStyle(input);
    const radius = cs.borderRadius || '12px';

    const host = document.createElement('div');
    host.className = 'bb-tooltip-host';
    host.style.cssText = `display:${cs.display === 'block' ? 'block' : 'inline-block'};width:100%;`;

    const wrap = document.createElement('div');
    wrap.className = 'bb-input-wrap';
    wrap.style.setProperty('--bb-radius', radius);

    const tooltip = document.createElement('div');
    tooltip.className = 'bb-tooltip';
    tooltip.textContent = nextTip();

    parent.insertBefore(host, input);
    host.appendChild(wrap);
    host.appendChild(tooltip);
    wrap.appendChild(input);

    input.addEventListener('focus', () => {
      wrap.classList.add('bb-focused');
      host.classList.add('bb-tt-visible');
    });
    input.addEventListener('blur', () => {
      wrap.classList.remove('bb-focused');
      host.classList.remove('bb-tt-visible');
    });
  }

  /* ── Card animations ── */
  function cardEnter(el) {
    if (!el) return;
    el.classList.remove('bb-card-enter');
    void el.offsetWidth;
    el.classList.add('bb-card-enter');
    el.addEventListener('animationend', () => el.classList.remove('bb-card-enter'), { once: true });
  }
  function cardExit(el, onDone) {
    if (!el) return;
    el.classList.add('bb-card-exit');
    el.addEventListener('animationend', () => { el.remove(); if (onDone) onDone(); }, { once: true });
  }

  /* ── Observer (debounced + batched) ── */
  function scan(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('button:not([data-bb-btn])').forEach(enhanceButton);
    root.querySelectorAll(
      'input:not([data-bb-input]):not([type=hidden]):not([type=file]), textarea:not([data-bb-input]), select:not([data-bb-input])'
    ).forEach(enhanceInput);
  }

  let _debounceTimer = null;
  const _pending = new Set();

  const mo = new MutationObserver((muts) => {
    muts.forEach((m) => {
      m.addedNodes.forEach((n) => { if (n.nodeType === 1) _pending.add(n); });
    });
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => {
      _pending.forEach(scan);
      _pending.clear();
    }, 50);
  });

  function init() {
    scan(document.body);
    mo.observe(document.body, { childList: true, subtree: true });
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : setTimeout(init, 300);

  window.BbAdminUI = { enhanceButton, enhanceInput, cardEnter, cardExit, scan };
})();
