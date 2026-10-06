import React from 'react';

/* ══ ADMIN LOGIN SCREEN — SVG-style layout + Supabase Auth (no forgot password) ════════════ */
(function(){
const {useState, useRef, useEffect, useCallback} = React;

function LoginScreen({onAuth, dark}){
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [shake, setShake] = useState(false);
  const emailRef = useRef();

  useEffect(() => {
    const timer = setTimeout(() => emailRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, []);

  // clear error when user types
  useEffect(() => {
    if (err) setErr('');
  }, [email, pw]);

  const doShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  }, []);

  const doLogin = async () => {
    if (loading) return;
    if (!email.trim() || !pw) {
      setErr('Vui lòng nhập đầy đủ email và mật khẩu!');
      doShake();
      return;
    }
    setLoading(true);
    setErr('');
    try {
      const { data, error } = await window.supa.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: pw,
      });
      if (error) {
        const msgs = {
          'Invalid login credentials': 'Email hoặc mật khẩu không đúng 🔐',
          'Email not confirmed': 'Email chưa được xác nhận!',
          'Too many requests': 'Thử quá nhiều lần, đợi chút nhé ⏳',
        };
        setErr(msgs[error.message] || error.message);
        doShake();
        setPw('');
      } else if (data.session) {
        onAuth();
      }
    } catch (e) {
      setErr('Lỗi kết nối, thử lại nhé!');
      doShake();
    }
    setLoading(false);
  };

  // ── Colors (Indigo/Violet) ──
  const bg    = dark
    ? 'radial-gradient(at 20% 20%, rgba(99,102,241,0.15) 0px, transparent 50%), radial-gradient(at 80% 80%, rgba(139,92,246,0.15) 0px, transparent 50%), #0f172a'
    : 'radial-gradient(at 20% 20%, rgba(199,210,254,0.6) 0px, transparent 50%), radial-gradient(at 80% 80%, rgba(221,214,254,0.6) 0px, transparent 50%), #f8fafc';
  const card  = dark ? 'rgba(30,41,59,0.7)'        : 'rgba(255,255,255,0.75)';
  const bord  = dark ? 'rgba(255,255,255,0.08)'     : 'rgba(255,255,255,0.9)';
  const bord2 = dark ? 'rgba(255,255,255,0.06)'     : 'rgba(99,102,241,0.15)';
  const tMain = dark ? '#f1f5f9'                    : '#1e293b';
  const tSub  = dark ? '#94a3b8'                    : '#64748b';
  const inBg  = dark ? 'rgba(15,23,42,0.6)'         : 'rgba(241,245,249,0.8)';
  const inBgF = dark ? 'rgba(15,23,42,0.8)'         : '#fff';
  const lockBg = dark ? 'rgba(99,102,241,0.12)'     : 'linear-gradient(135deg,#e0e7ff,#ede9fe)';

  const canSubmit = !loading && email.trim() && pw;

  // ── Shared input style ──
  const inputBaseStyle = (hasError) => ({
    width: '100%',
    padding: '11px 42px 11px 14px',
    border: `1.5px solid ${hasError ? '#EF4444' : bord}`,
    borderRadius: 18,
    fontSize: 14,
    fontWeight: 700,
    color: tMain,
    background: inBg,
    outline: 'none',
    fontFamily: "'Nunito',sans-serif",
    transition: 'border-color .2s, box-shadow .2s, background .2s',
    boxShadow: hasError ? '0 0 0 3px rgba(239,68,68,0.12)' : 'none',
  });

  const inputFocusStyle = (e) => {
    e.target.style.borderColor = '#6366f1';
    e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)';
    e.target.style.background = inBgF;
  };

  const inputBlurStyle = (e, hasError) => {
    e.target.style.borderColor = hasError ? '#EF4444' : bord;
    e.target.style.boxShadow = hasError ? '0 0 0 3px rgba(239,68,68,0.12)' : 'none';
    e.target.style.background = inBg;
  };

  // ── SVG Icons (enhanced) ──
  const IconBook = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <defs>
        <linearGradient id="ls-lg1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      <path stroke="url(#ls-lg1)" d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path stroke="url(#ls-lg1)" d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );

  const IconSparkle = () => (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="#6366f1" opacity=".7">
      <path d="M10 0 L11.5 8.5 L20 10 L11.5 11.5 L10 20 L8.5 11.5 L0 10 L8.5 8.5 Z" />
    </svg>
  );

  const IconLockShield = () => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <defs>
        <linearGradient id="ls-lg2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <path stroke="url(#ls-lg2)" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path stroke="url(#ls-lg2)" d="M9 12l2 2 4-4" />
    </svg>
  );

  const IconEyeOpen = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );

  const IconEyeClosed = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );

  const IconError = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );

  const IconArrowRight = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  );

  const IconSpinner = () => (
    <span className="spin" style={{ display: 'inline-flex' }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
    </span>
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: "'Nunito',sans-serif",
    }}>

      {/* ── Decorative floating dots ── */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: `${10 + i * 4}px`,
            height: `${10 + i * 4}px`,
            borderRadius: '50%',
            background: dark ? 'rgba(139,92,246,0.15)' : 'rgba(99,102,241,0.15)',
            top: `${15 + i * 12}%`,
            left: `${10 + i * 15}%`,
            animation: `ls-float ${3 + i}s ease-in-out ${i * 0.5}s infinite`,
          }} />
        ))}
      </div>
      <style>{`@keyframes ls-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}`}</style>

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 360, animation: 'fadeUp .28s ease both' }}>

        {/* ── Logo ── */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span className="logo-fl"><IconBook /></span>
            <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}>
              <span className="logo-learnsy" style={{ fontSize: 38 }}>Luvie</span>
            </span>
            <span className="logo-flb"><IconSparkle /></span>
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 900, color: '#6366f1',
            background: dark ? 'rgba(99,102,241,0.12)' : '#e0e7ff',
            border: `1.5px solid ${dark ? 'rgba(99,102,241,0.20)' : '#c7d2fe'}`,
            borderRadius: 99, padding: '3px 12px',
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Khu vực Admin
          </div>
        </div>

        {/* ── Card ── */}
        <div style={{
          background: card, border: `1.5px solid ${bord}`, borderRadius: 28,
          padding: '26px 24px 22px',
          boxShadow: dark ? '0 25px 50px -12px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,255,255,0.05)' : '0 25px 50px -12px rgba(99,102,241,0.25),inset 0 1px 0 rgba(255,255,255,0.9)',
          animation: 'pop .28s ease both',
        }}>

          {/* Lock icon + heading */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{
              width: 54, height: 54, borderRadius: 17, background: lockBg,
              border: `1.5px solid ${bord2}`, display: 'flex', alignItems: 'center',
              justifyContent: 'center', margin: '0 auto 12px',
              boxShadow: '0 4px 16px rgba(99,102,241,0.15)',
            }}>
              <IconLockShield />
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, color: tMain, marginBottom: 3 }}>Xin chào, giáo viên! 👋</div>
            <div style={{ fontSize: 12, color: tSub, fontWeight: 600 }}>Nhập thông tin để vào trang quản trị</div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: `linear-gradient(90deg,transparent,${bord},transparent)`, marginBottom: 20 }} />

          {/* Email */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 900, color: tSub, letterSpacing: '.8', textTransform: 'uppercase', marginBottom: 5 }}>
              Email
            </label>
            <input
              ref={emailRef}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doLogin()}
              placeholder="admin@truong.edu.vn"
              autoComplete="email"
              style={inputBaseStyle(!!err)}
              onFocus={inputFocusStyle}
              onBlur={e => inputBlurStyle(e, !!err)}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 900, color: tSub, letterSpacing: '.8', textTransform: 'uppercase', marginBottom: 5 }}>
              Mật khẩu
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={show ? 'text' : 'password'}
                value={pw}
                onChange={e => setPw(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doLogin()}
                placeholder="••••••••"
                autoComplete="current-password"
                className={shake ? 'do-shake' : ''}
                style={inputBaseStyle(!!err)}
                onFocus={inputFocusStyle}
                onBlur={e => inputBlurStyle(e, !!err)}
              />
              <button
                onClick={() => setShow(s => !s)}
                tabIndex={-1}
                style={{
                  position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                  color: tSub, display: 'flex', alignItems: 'center', lineHeight: 0,
                  transition: 'color .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#6366f1'; }}
                onMouseLeave={e => { e.currentTarget.style.color = tSub; }}
                aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {show ? <IconEyeClosed /> : <IconEyeOpen />}
              </button>
            </div>
          </div>

          {/* Error */}
          {err && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#EF4444',
              background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 10, padding: '7px 12px', marginBottom: 12,
            }}>
              <IconError />
              {err}
            </div>
          )}

          {/* Button */}
          <button
            onClick={doLogin}
            disabled={!canSubmit}
            style={{
              width: '100%', padding: '13px', borderRadius: 999, border: 'none',
              background: canSubmit ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'rgba(99,102,241,0.22)',
              color: canSubmit ? '#fff' : 'rgba(255,255,255,0.45)',
              fontSize: 14, fontWeight: 900, fontFamily: "'Nunito',sans-serif",
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              boxShadow: canSubmit ? '0 10px 25px -5px rgba(99,102,241,0.5),0 8px 10px -6px rgba(139,92,246,0.4)' : 'none',
              transition: 'all .2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
            onMouseEnter={e => { if (canSubmit) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 14px 30px -5px rgba(99,102,241,0.6),0 10px 14px -6px rgba(139,92,246,0.5)'; } }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = canSubmit ? '0 10px 25px -5px rgba(99,102,241,0.5),0 8px 10px -6px rgba(139,92,246,0.4)' : 'none'; }}
            onMouseDown={e => { if (canSubmit) e.currentTarget.style.transform = 'scale(0.97)'; }}
            onMouseUp={e => { if (canSubmit) e.currentTarget.style.transform = 'translateY(-2px)'; }}
          >
            {loading ? (
              <>
                <IconSpinner />
                Đang đăng nhập...
              </>
            ) : (
              <>
                <IconArrowRight />
                Đăng nhập
              </>
            )}
          </button>

          {/* Footer */}
          <div style={{
            textAlign: 'center', marginTop: 14, fontSize: 10, color: tSub, fontWeight: 600, opacity: .8,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Xác thực qua Supabase Auth
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: tSub, opacity: .6, fontWeight: 600 }}>
          Learnsy Admin · Chỉ dành cho Admin 
        </div>
      </div>
    </div>
  );
}

window.LoginScreen = LoginScreen;
})();
