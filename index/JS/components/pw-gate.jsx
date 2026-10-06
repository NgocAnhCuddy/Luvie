import React from 'react';

/* ══════════════════════════════════════════════════════════════════
   PW-GATE.JSX  ·  Learnsy · Password Gate Modal
   Exports (window globals):
     window.PwGate — Component: Modal nhập mật khẩu để mở bài học bị khóa

   Phụ thuộc:
     - React (window.React)
══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  try {
    const { useState } = React;

    function PwGate({ lesson, onUnlock, onCancel, dark }) {
      const [pw, setPw] = useState('');
      const [err, setErr] = useState(false);

      const try_ = () => {
        if (pw === lesson.password) {
          onUnlock();
        } else {
          setErr(true);
          setTimeout(() => setErr(false), 600);
        }
      };

      return (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(10,2,25,0.9)', backdropFilter: 'blur(20px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: 20
        }}>
          <div style={{
            background: 'linear-gradient(160deg,#FFF5F9,#F0E6FF)',
            border: '1.5px solid #F5D5E8', borderRadius: 28,
            padding: '28px 24px', maxWidth: 300, width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(168,85,247,0.15)',
            animation: 'pop .28s ease both'
          }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🔒</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#3D1830', marginBottom: 4 }}>
              {lesson.title}
            </div>
            <div style={{ fontSize: 12, color: '#A07090', marginBottom: 16 }}>
              Nhập mật khẩu để mở bài này
            </div>            
            <input 
              value={pw} 
              onChange={e => setPw(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && try_()}
              type="password"
              className={err ? 'do-shake' : ''}
              placeholder="Mật khẩu..."
              style={{
                width: '100%', padding: '12px 16px',
                border: `1.5px solid ${err ? '#EF4444' : '#E8DCFF'}`,
                borderRadius: 18, fontSize: 15, fontWeight: 700,
                color: '#3D1830', background: '#FAF5FF',
                outline: 'none', textAlign: 'center',
                letterSpacing: 3, marginBottom: 10,
                fontFamily: "'Nunito', sans-serif",
                boxSizing: 'border-box',
                transition: 'border-color 0.2s'
              }} 
            />
            
            <button 
              onClick={try_} 
              style={{
                width: '100%', padding: 13, borderRadius: 999, border: 'none',
                background: 'linear-gradient(135deg,#F472B6,#A855F7)',
                color: '#fff', fontSize: 14, fontWeight: 900,
                cursor: 'pointer', marginBottom: 8,
                boxShadow: '0 4px 15px rgba(168,85,247,0.3)',
                transition: 'all 0.18s',
                fontFamily: "'Nunito', sans-serif"
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(168,85,247,0.42)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(168,85,247,0.3)'; }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
              onMouseUp={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            >
              Mở bài ✨
            </button>
            
            <button 
              onClick={onCancel} 
              style={{
                width: '100%', padding: 10, borderRadius: 999,
                border: '1.5px solid #F5D5E8', background: 'transparent',
                color: '#A07090', fontSize: 13, fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.15s',
                fontFamily: "'Nunito', sans-serif"
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#FFF0F5'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.96)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              Quay lại
            </button>
          </div>
                    {/* Inject CSS animation cho hiệu ứng rung lắc */}
          <style>{`
            .do-shake { animation: pw-shake .35s ease !important; }
            @keyframes pw-shake {
              0%, 100% { transform: translateX(0); }
              20%, 60% { transform: translateX(-6px); }
              40%, 80% { transform: translateX(6px); }
            }
          `}</style>
        </div>
      );
    }

    /* ══ EXPORT GLOBALS ══ */
    window.PwGate = PwGate;
  } catch (e) {
    console.error('[pw-gate] INIT ERROR:', e);
  }
})();