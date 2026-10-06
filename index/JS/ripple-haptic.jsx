import React from 'react';

/* ══ RIPPLE-HAPTIC.JSX ═══════════════════════════════════════════════════
   useSwipe({ onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown })
   Trả về props cần spread vào element: {...swipe}
   (Trước đây trùng lặp với swipe.jsx riêng — file đó đã xoá vì không ai
    import, useSwipe giờ chỉ định nghĩa duy nhất ở đây.)
   ════════════════════════════════════════════════════════════════════ */

function useSwipe({ onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold=50 }={}) {
  const startRef = { x: 0, y: 0 };
  let tracking = false;

  return {
    onTouchStart: function(e) {
      if(e.target.closest('[data-dots]')) return;
      // Không coi là vuốt đổi tab khi chạm bắt đầu trong: vùng đánh dấu data-no-swipe, ô nhập chữ,
      // hoặc bất kỳ vùng đang cuộn ngang được (banner vuốt, dải môn học...) — để chúng tự cuộn.
      if(e.target.closest('[data-no-swipe],input,textarea,select,[contenteditable="true"]')) return;
      for(var el = e.target; el && el !== e.currentTarget && el.nodeType === 1; el = el.parentElement) {
        if(el.scrollWidth > el.clientWidth + 1) {
          var ox = getComputedStyle(el).overflowX;
          if(ox === 'auto' || ox === 'scroll') return;
        }
      }
      const t = e.touches[0];
      startRef.x = t.clientX;
      startRef.y = t.clientY;
      tracking = true;
    },
    onTouchEnd: function(e) {
      if(!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - startRef.x;
      const dy = t.clientY - startRef.y;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      if(adx < threshold && ady < threshold) return;
      if(adx > ady){
        if(dx < -threshold && onSwipeLeft)  onSwipeLeft();
        if(dx >  threshold && onSwipeRight) onSwipeRight();
      } else {
        if(dy < -threshold && onSwipeUp)   onSwipeUp();
        if(dy >  threshold && onSwipeDown) onSwipeDown();
      }
    },
    onTouchMove: function(e) {
      // allow natural scroll
    },
  };
}

window.useSwipe = useSwipe;

/* ══ RIPPLE-HAPTIC.JS ══════════════════════════════════════════════════
   useRipple() — hiệu ứng ripple khi bấm nút
   haptic()    — rung phản hồi (nếu thiết bị hỗ trợ)
   ════════════════════════════════════════════════════════════════════ */

function haptic(t){
  try{
    if(navigator.vibrate){
      navigator.vibrate(t==='success'?[30]:t==='error'?[20,40,20]:[10]);
    }
  }catch(e){}
}

function useRipple(){
  return function ripple(e){
    try{
      const el=e.currentTarget;
      if(!el)return;
      const rect=el.getBoundingClientRect();
      const x=(e.clientX||rect.left+rect.width/2)-rect.left;
      const y=(e.clientY||rect.top+rect.height/2)-rect.top;
      const size=Math.max(rect.width,rect.height)*2;
      const span=document.createElement('span');
      span.style.cssText=[
        'position:absolute','border-radius:50%','pointer-events:none',
        'transform:scale(0)','background:rgba(255,255,255,0.35)',
        'animation:rippleAnim .55s ease-out forwards',
        `width:${size}px`,`height:${size}px`,
        `left:${x-size/2}px`,`top:${y-size/2}px`,
      ].join(';');
      const prev=el.style.position;
      const prevOv=el.style.overflow;
      el.style.position='relative';
      el.style.overflow='hidden';
      el.appendChild(span);
      setTimeout(()=>{
        span.remove();
        el.style.position=prev;
        el.style.overflow=prevOv;
      },600);
    }catch(e){}
  };
}

// FIX 🔴 useRipple/haptic chỉ là biến cục bộ của module (Vite) nên home-screen.jsx
// (gọi useRipple() trần) và quiz-player.jsx (typeof useRipple → luôn 'undefined' → ripple/rung bị tắt)
// không thấy được. Gán lên window như useSwipe.
window.useRipple = useRipple;
window.haptic = haptic;

/* Inject ripple keyframe once */
(function(){
  if(document.getElementById('_ripple_style'))return;
  const s=document.createElement('style');
  s.id='_ripple_style';
  s.textContent='@keyframes rippleAnim{to{transform:scale(1);opacity:0}}';
  document.head.appendChild(s);
})();
