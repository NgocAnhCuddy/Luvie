import React from 'react';

/* ══ PW-GATE.JSX — SVG-style, khớp với login.js ══════════════════════════ */
(function(){
const {useState, useEffect, useRef} = React;

function PwGate({lesson, onUnlock, onCancel, dark}){
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(false);
  const [shake, setShake] = useState(false);
  const [show, setShow] = useState(false);
  const inpRef = useRef();

  useEffect(() => {
    const timer = setTimeout(() => inpRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, []);

  const resetError = () => {
    setErr(true);
    setShake(true);
    setPw('');
    setTimeout(() => { setErr(false); setShake(false); }, 500);
    setTimeout(() => inpRef.current?.focus(), 80);
  };

  const try_ = async () => {
    if (!pw.trim()) return;

    // Hash SHA-256 rồi so sánh — lesson.password có thể là plaintext (cũ) hoặc hash (mới)
    const isProbablyHash = lesson.password
      && lesson.password.length === 64
      && /^[0-9a-f]+$/.test(lesson.password);

    if (isProbablyHash) {
      const hash = await (window._sha256
        ? window._sha256(pw.trim())
        : sha256Fallback(pw.trim())
      );
      if (hash === lesson.password) {
        onUnlock();
      } else {
        resetError();
      }
    } else {
      // Fallback: so sánh plaintext (backward compat với bài cũ chưa hash)
      if (pw === lesson.password) {
        onUnlock();
      } else {
        resetError();
      }
    }
  };

  // SHA-256 fallback nếu student-manager chưa load (chỉ dùng ở index.html)
  async function sha256Fallback(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ── Colors (sync với login.js) ──
  const bord  = dark ? 'rgba(255,100,150,0.15)' : '#F5D5E8';
  const bord2 = dark ? 'rgba(255,100,150,0.10)' : '#EFD0E5';
  const card  = dark ? 'rgba(38,16,24,0.97)' : 'rgba(255,255,255,0.96)';
  const tMain = dark ? '#F0DCE8' : '#3D1830';
  const tSub  = dark ? '#8A6080' : '#A07090';
  const inBg  = dark ? 'rgba(255,255,255,0.05)' : 'rgba(255,240,248,0.7)';
  const inBgF = dark ? 'rgba(255,255,255,0.09)' : '#fff';
  const lockBg = dark ? 'rgba(255,100,150,0.08)' : 'linear-gradient(135deg,#FFE4ED,#F0E6FF)';
  const blob1 = dark ? 'rgba(255,80,120,0.10)' : 'rgba(255,182,203,0.30)';
  const blob2 = dark ? 'rgba(160,100,255,0.08)' : 'rgba(196,181,253,0.25)';

  const inputBaseStyle = {
    width: '100%',
    padding: '12px 42px 12px 16px',
    border: `1.5px solid ${err ? '#EF4444' : bord}`,
    borderRadius: 18,
    fontSize: 15,
    fontWeight: 700,
    color: tMain,
    background: inBg,
    outline: 'none',
    fontFamily: "'Nunito',sans-serif",
    textAlign: 'center',
    letterSpacing: show ? 0 : 3,
    transition: 'border-color .2s, box-shadow .2s, background .2s',
    boxShadow: err ? '0 0 0 3px rgba(239,68,68,0.14)' : 'none',
  };

  const handleFocus = (e) => {
    e.target.style.borderColor = err ? '#EF4444' : '#F472B6';
    e.target.style.boxShadow = err
      ? '0 0 0 3px rgba(239,68,68,0.14)'
      : '0 0 0 3px rgba(244,114,182,0.15)';
    e.target.style.background = inBgF;
  };

  const handleBlur = (e) => {
    e.target.style.borderColor = err ? '#EF4444' : bord;
    e.target.style.boxShadow = err
      ? '0 0 0 3px rgba(239,68,68,0.14)'
      : 'none';
    e.target.style.background = inBg;
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, fontFamily: "'Nunito',sans-serif",
      background: dark ? 'rgba(12,4,18,0.92)' : 'rgba(255,240,248,0.88)',
      backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)',
    }}>

      {/* SVG blobs behind card */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <filter id="pg-bb"><feGaussianBlur stdDeviation="50" /></filter>
        </defs>
        <ellipse cx="20%" cy="25%" rx="25%" ry="20%" fill={blob1} filter="url(#pg-bb)" />
        <ellipse cx="80%" cy="75%" rx="22%" ry="18%" fill={blob2} filter="url(#pg-bb)" />
        {/* Decorative dots */}
        <circle cx="8%"  cy="45%" r="4"   fill={dark ? 'rgba(244,114,182,0.15)' : 'rgba(244,114,182,0.28)'} />
        <circle cx="92%" cy="30%" r="3"   fill={dark ? 'rgba(168,85,247,0.12)' : 'rgba(168,85,247,0.22)'} />
        <circle cx="88%" cy="65%" r="2"   fill={dark ? 'rgba(99,102,241,0.10)' : 'rgba(99,102,241,0.18)'} />
        <circle cx="5%"  cy="70%" r="2.5" fill={dark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.15)'} />
      </svg>

      {/* Card */}
      <div style={{
        position: 'relative', zIndex: 1,
        background: card,
        border: `1.5px solid ${bord}`,
        borderRadius: 28, padding: '28px 24px 22px',
        width: '100%', maxWidth: 320,
        textAlign: 'center',
        boxShadow: dark
          ? '0 20px 60px rgba(0,0,0,0.5)'
          : '0 8px 48px rgba(244,114,182,0.15)',
        animation: 'pop .28s ease both',
      }}>

        {/* Lock icon */}
        <div style={{
          width: 54, height: 54, borderRadius: 17, background: lockBg,
          border: `1.5px solid ${bord2}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 14px',
          boxShadow: '0 4px 16px rgba(244,114,182,0.12)',
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <defs>
              <linearGradient id="pg-lock" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F472B6" />
                <stop offset="100%" stopColor="#A855F7" />
              </linearGradient>
            </defs>
            <rect stroke="url(#pg-lock)" x="3" y="11" width="18" height="11" rx="2" />
            <path stroke="url(#pg-lock)" d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        {/* Title */}
        <div style={{ fontSize: 15, fontWeight: 900, color: tMain, marginBottom: 4, lineHeight: 1.3 }}>
          {lesson.title}
        </div>
        <div style={{ fontSize: 12, color: tSub, fontWeight: 600, marginBottom: 18 }}>
          Nhập mật khẩu để mở bài này
        </div>

        {/* Gradient divider */}
        <div style={{ height: 1, background: `linear-gradient(90deg,transparent,${bord},transparent)`, marginBottom: 18 }} />

        {/* Password input */}
        <div style={{ position: 'relative', marginBottom: err ? 10 : 14 }}>
          <input
            ref={inpRef}
            type={show ? 'text' : 'password'}
            value={pw}
            onChange={e => setPw(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && try_()}
            placeholder="Mật khẩu..."
            className={shake ? 'do-shake' : ''}
            style={inputBaseStyle}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
          {/* Show/hide toggle */}
          <button
            onClick={() => setShow(s => !s)}
            tabIndex={-1}
            style={{
              position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 4,
              color: tSub, display: 'flex', alignItems: 'center', lineHeight: 0,
            }}
            aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          >
            {show ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>

        {/* Error message */}
        {err && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            fontSize: 12, fontWeight: 700, color: '#EF4444',
            background: 'rgba(239,68,68,0.07)',
            border: '1px solid rgba(239,68,68,0.18)',
            borderRadius: 10, padding: '6px 12px', marginBottom: 12,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Sai mật khẩu rồi!
          </div>
        )}

        {/* Unlock button */}
        <button
          onClick={try_}
          disabled={!pw}
          style={{
            width: '100%', padding: '12px', borderRadius: 999, border: 'none',
            background: pw ? 'linear-gradient(135deg,#F472B6,#A855F7)' : 'rgba(168,85,247,0.22)',
            color: pw ? '#fff' : 'rgba(255,255,255,0.45)',
            fontSize: 14, fontWeight: 900, fontFamily: "'Nunito',sans-serif",
            cursor: pw ? 'pointer' : 'not-allowed',
            boxShadow: pw ? '0 4px 18px rgba(168,85,247,0.30)' : 'none',
            transition: 'all .2s', marginBottom: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Mở bài ✨
        </button>

        {/* Cancel button */}
        <button
          onClick={onCancel}
          style={{
            width: '100%', padding: '10px', borderRadius: 999,
            border: `1.5px solid ${bord}`,
            background: 'transparent',
            color: tSub, fontSize: 13, fontWeight: 800,
            fontFamily: "'Nunito',sans-serif", cursor: 'pointer',
            transition: 'all .2s',
          }}
          onMouseEnter={e => e.target.style.background = dark ? 'rgba(255,100,150,0.07)' : 'rgba(244,114,182,0.06)'}
          onMouseLeave={e => e.target.style.background = 'transparent'}
        >
          Quay lại
        </button>
      </div>

      <style>{`
        .do-shake{animation:shake .35s ease!important;}
        @keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-7px)}40%,80%{transform:translateX(7px)}}
      `}</style>
    </div>
  );
}

window.PwGate = PwGate;
console.log('[pw-gate] ✓ loaded (SVG-style)');
})();