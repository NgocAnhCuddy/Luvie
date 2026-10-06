import React from 'react';

/* ══ BABEL-LOADER.JSX ════════════════════════════════════════════════════
   Vite đã tích hợp sẵn transform JSX → không cần Babel runtime nữa
   
   File này giữ lại để:
   • Không gãy tham chiếu nếu file khác gọi window.loadModule / window.clearBabelCache
   • Log cảnh báo nếu ai đó vô tình gọi hàm cũ
   ════════════════════════════════════════════════════════════════════════ */

(function() {

  /* ── No-op: Vite đã compile sẵn JSX, không cần fetch + Babel.transform ── */
  window.loadModule = async function(src) {
    console.warn('[babel-loader] ⚠️ loadModule() không còn cần thiết khi dùng Vite.');
    console.warn('[babel-loader]    File được gọi:', src);
    console.warn('[babel-loader]    Hãy import trực tiếp thay vì load động.');
  };

  /* ── No-op: cache do Vite quản lý qua HMR ── */
  window.clearBabelCache = function() {
    console.warn('[babel-loader] clearBabelCache() không cần khi dùng Vite. HMR đã lo việc này.');
  };

})();