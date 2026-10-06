import React from 'react';

/* ══════════════════════════════════════════════
   🧁 UX NŨNG — admin/JS/ux-nung.js
   Idle nag cho admin inputs + save praise
   ══════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── nag() — ưu tiên dùng showToast nếu có ──────────────────────────
     Tránh tạo floating div riêng cạnh tranh z-index với toast.js.
     Fallback standalone chỉ khi không có showToast (dev/offline).
  ──────────────────────────────────────────────────────────────────── */
  function nag(msg, duration = 3500) {
    if (typeof window.showDiToast === 'function') {
      window.showDiToast(msg, 'info', duration);
    } else if (typeof window.showToast === 'function') {
      window.showToast(msg, 'info', duration);
    }
  }

  /* ── Admin idle input nag ────────────────────────────────────────────
     Chỉ nag trên input đã được banh-beo-ui.js enhance (data-bb-input).
     Tránh nag trên input của học sinh, search bar, hidden inputs, etc.
  ──────────────────────────────────────────────────────────────────── */
  const ADMIN_IDLE_NAGS = [
    'Nhập câu hỏi đi admin ơi 🥺',
    'Học sinh đang chờ câu hỏi mới nè 💖',
    'Còn đây không? App nhớ admin lắm 😭',
    'Gõ phím thôi nào 💪✨',
  ];
  let nagIdx = 0, nagTimer = null;

  document.addEventListener('focusin', (e) => {
    const t = e.target;
    if (!['INPUT','TEXTAREA'].includes(t.tagName)) return;
    if (!t.dataset.bbInput) return; // chỉ nag input đã bb-enhanced
    clearTimeout(nagTimer);
    nagTimer = setTimeout(() => {
      if (!t.value.trim()) nag(ADMIN_IDLE_NAGS[nagIdx++ % ADMIN_IDLE_NAGS.length], 3000);
    }, 4000);
  });
  document.addEventListener('input', () => clearTimeout(nagTimer));
  document.addEventListener('focusout', () => clearTimeout(nagTimer));

  /* ── Save praise ── */
  const SAVE_PRAISE = [
    'Lưu rồi! Admin giỏi lắm 💕',
    'Xong rùi nèeee 💖',
    'Bài học mới ra lò rồi 🌟',
    'Học sinh sẽ mê lắm đó 🥰',
  ];
  let savePraiseIdx = 0;
  function praiseSave() {
    nag(SAVE_PRAISE[savePraiseIdx++ % SAVE_PRAISE.length], 3000);
    if (window.BbAdminSounds) window.BbAdminSounds.save();
  }

  /* ── Delete praise ── */
  function praiseDelete() {
    nag('Xóa rồi nha, bay lên trời rồi 🫧', 2500);
    if (window.BbAdminSounds) window.BbAdminSounds.delete();
  }

  /* ── Kết nối với app events ──────────────────────────────────────────
     learnsy:render-lessons  → app.js dispatch sau mỗi auto-save thành
     công. Chỉ praise nếu user vừa gõ trong 10 giây gần đây (tránh
     praise tự động khi mới mở trang).

     learnsy:delete-success  → dispatch từ app.js sau deleteLesson (cần
     thêm 1 dòng dispatch vào app.js — xem patch bên dưới).

     learnsy:student-saved   → dispatch từ student-manager sau doAdd /
     doUpdate thành công.

     learnsy:student-deleted → dispatch từ student-manager sau doDelete.
  ──────────────────────────────────────────────────────────────────── */
  let _lastInputTime = 0;
  // FIX 🟡 Gõ email/mật khẩu ở màn đăng nhập (hoặc ô tìm kiếm) cũng bị tính là "vừa soạn bài"
  // → ngay sau khi đăng nhập, danh sách bài học render lần đầu sẽ bật toast "Lưu rồi! Admin giỏi lắm 💕"
  // dù chưa lưu gì. Chỉ tính các ô nhập nội dung.
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t && ['password', 'email', 'search'].includes(t.type)) return;
    _lastInputTime = Date.now();
  });

  let _saveDebounce = null;
  window.addEventListener('learnsy:render-lessons', () => {
    // Không praise khi đang ở màn edit bài tập (#edit/...) — auto-save
    // chạy liên tục mỗi lần gõ nên toast bị spam, gây phiền khi soạn bài.
    if ((location.hash || '').startsWith('#edit/')) return;
    // Chỉ praise nếu user đang active (gõ trong 10 giây gần đây)
    if (Date.now() - _lastInputTime > 10_000) return;
    clearTimeout(_saveDebounce);
    _saveDebounce = setTimeout(praiseSave, 300);
  });

  window.addEventListener('learnsy:delete-success', praiseDelete);
  window.addEventListener('learnsy:student-saved', praiseSave);
  window.addEventListener('learnsy:student-deleted', praiseDelete);

  window.BbAdminUxNung = { nag, praiseSave, praiseDelete };
})();
