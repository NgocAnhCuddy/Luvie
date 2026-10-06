import React from 'react';

/* ══════════════════════════════════════════════
   💌 EASTER EGGS — admin/JS/easter-eggs.jsx
   "iu em" popup · logo x5 → mưa tim
   ══════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── "iu em" keyboard listener ── */
  let typedBuffer = '';
  const TARGET = 'iu em';

  document.addEventListener('keypress', (e) => {
    typedBuffer += e.key.toLowerCase();
    if (typedBuffer.length > TARGET.length + 2) {
      typedBuffer = typedBuffer.slice(-TARGET.length - 2);
    }
    if (typedBuffer.includes(TARGET)) {
      typedBuffer = '';
      showIuEmPopup();
    }
  });

  function showIuEmPopup() {
    if (document.getElementById('bb-iuem-popup-admin')) return;
    const overlay = document.createElement('div');
    overlay.id = 'bb-iuem-popup-admin';
    Object.assign(overlay.style, {
      position:'fixed', inset:'0',
      background:'rgba(10,2,25,0.55)',
      backdropFilter:'blur(10px)',
      display:'flex', alignItems:'center', justifyContent:'center',
      zIndex:'99999',
    });
    const box = document.createElement('div');
    Object.assign(box.style, {
      background:'linear-gradient(160deg,#FFF0F8,#F3E8FF)',
      border:'2.5px solid #F9A8D4',
      borderRadius:'28px', padding:'32px 36px',
      maxWidth:'300px', width:'90%', textAlign:'center',
      boxShadow:'0 24px 70px rgba(244,114,182,0.35)',
      animation:'pop .35s cubic-bezier(0.34,1.56,0.64,1) both',
      fontFamily:"'Nunito',sans-serif",
    });
    box.innerHTML = `
      <div style="font-size:52px;margin-bottom:12px;animation:float 2s ease-in-out infinite">🥰</div>
      <div style="font-size:20px;font-weight:900;color:#3D1830;margin-bottom:8px;line-height:1.3">
        Biết rồi mà,<br>nói hoài 😳💗
      </div>
      <div style="font-size:13px;font-weight:700;color:#A07090;margin-bottom:20px;line-height:1.6">
        Admin cũng được iu lắm đó nha~ 💕✨
      </div>
      <button id="bb-iuem-admin-close" style="
        padding:10px 28px;border-radius:999px;border:none;
        background:linear-gradient(135deg,#F472B6,#A855F7);
        color:white;font-size:14px;font-weight:800;
        cursor:pointer;font-family:'Nunito',sans-serif;
        box-shadow:0 4px 16px rgba(168,85,247,0.35)">
        Hiii Admin 💖
      </button>`;
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    /* Spawn hearts */
    spawnHearts(box, 10);
    if (window.BbAdminSounds) window.BbAdminSounds.save();

    const close = () => { overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 300); };
    document.getElementById('bb-iuem-admin-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  }

  /* ── Heart rain helper ── */
  const HEARTS = ['❤️','💕','💗','💖','💓','🩷'];
  function spawnHearts(fromEl, count) {
    const rect = fromEl
      ? fromEl.getBoundingClientRect()
      : { left: window.innerWidth/2, top: window.innerHeight/2, width:0, height:0 };
    const cx = rect.left + rect.width/2;
    const cy = rect.top  + rect.height/2;
    for (let i = 0; i < count; i++) {
      const h = document.createElement('span');
      h.textContent = HEARTS[Math.floor(Math.random()*HEARTS.length)];
      const rot = (Math.random()*80-40)+'deg';
      Object.assign(h.style, {
        position:'fixed',
        left: cx + (Math.random()*72-36) + 'px',
        top:  cy + (Math.random()*20-10) + 'px',
        fontSize: (14+Math.random()*10)+'px',
        pointerEvents:'none', zIndex:'99999',
        '--rot': rot,
        animation:`bb-heart-rise ${0.7+Math.random()*0.5}s ease-out ${Math.random()*0.35}s forwards`,
      });
      document.body.appendChild(h);
      h.addEventListener('animationend', () => h.remove());
    }
  }

  /* ── Logo x5 → heart rain ── */
  let logoClicks = 0, logoTimer = null;
  function attachLogo() {
    const logos = document.querySelectorAll('.logo-learnsy, [class*="logo"]');
    logos.forEach((logo) => {
      if (logo.dataset.bbEgg) return;
      logo.dataset.bbEgg = '1';
      logo.style.cursor = 'pointer';
      logo.addEventListener('click', () => {
        logoClicks++;
        clearTimeout(logoTimer);
        logoTimer = setTimeout(() => { logoClicks = 0; }, 2000);
        if (logoClicks >= 5) {
          logoClicks = 0;
          heartRain(40);
          if (window.BbAdminSounds) window.BbAdminSounds.publish();
        }
      });
    });
  }

  function heartRain(count) {
    for (let i = 0; i < count; i++) {
      const h = document.createElement('span');
      h.textContent = HEARTS[Math.floor(Math.random()*HEARTS.length)];
      Object.assign(h.style, {
        position:'fixed',
        left: Math.random()*100+'vw',
        top: '-30px',
        fontSize: (16+Math.random()*14)+'px',
        pointerEvents:'none', zIndex:'99999',
        animation:`cfDrop ${1.8+Math.random()*1.7}s ease-in ${Math.random()*1.5}s forwards`,
      });
      document.body.appendChild(h);
      h.addEventListener('animationend', () => h.remove());
    }
  }

  const mo = new MutationObserver(() => attachLogo());
  mo.observe(document.body, { childList: true, subtree: true });

  function init() { attachLogo(); }
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : setTimeout(init, 500);

  window.BbAdminEgg = { showIuEm: showIuEmPopup, heartRain };
})();