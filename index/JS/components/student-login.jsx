import React from 'react';

/* ══════════════════════════════════════════════════════════════════
   STUDENT-LOGIN.JSX — Màn hình đăng nhập học sinh (Nâng cấp UI)
   Theme: Indigo/Violet (Học sinh) — Glassmorphism, mượt mà, hiện đại.
   
   Exports (window globals):
     window.StudentLoginScreen — Component: Màn hình đăng nhập
   
   Phụ thuộc:
     - React (window.React)
══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  try {
    const { useState, useRef, useEffect } = React;

    function StudentLoginScreen({ dark, onLogin, notice }) {
      const [username, setUsername] = useState('');
      const [pw, setPw] = useState('');
      const [show, setShow] = useState(false);
      const [loading, setLoading] = useState(false);
      const [err, setErr] = useState('');
      const [shake, setShake] = useState(false);
      const uRef = useRef();

      // Auto focus vào ô username khi mount
      useEffect(() => {
        const timer = setTimeout(() => uRef.current && uRef.current.focus(), 150);
        return () => clearTimeout(timer);
      }, []);

      // Inject CSS animations & focus states (chỉ inject 1 lần)
      useEffect(() => {
        if (document.getElementById('student-login-styles')) return;
        const style = document.createElement('style');
        style.id = 'student-login-styles';
        style.textContent = `
          @keyframes ls-shake {
            0%, 100% { transform: translateX(0); }
            20%, 60% { transform: translateX(-6px); }
            40%, 80% { transform: translateX(6px); }
          }
          @keyframes ls-float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-8px); }
          }
          @keyframes ls-fadeUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }          }
          @keyframes ls-pop {
            0% { opacity: 0; transform: scale(0.95); }
            100% { opacity: 1; transform: scale(1); }
          }
          @keyframes ls-shimmer {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
          .do-shake { animation: ls-shake .4s cubic-bezier(.36,.07,.19,.97) both; }
          .ls-float { animation: ls-float 4s ease-in-out infinite; }
          .ls-fadeUp { animation: ls-fadeUp .5s cubic-bezier(.16,1,.3,1) both; }
          .ls-pop { animation: ls-pop .4s cubic-bezier(.16,1,.3,1) both; }
          
          .ls-input-base {
            transition: all 0.22s cubic-bezier(.22,1,.36,1);
          }
          .ls-input-base:focus {
            outline: none;
            border-color: #6366f1 !important;
            box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.15) !important;
          }
        `;
        document.head.appendChild(style);
      }, []);

      const doShake = () => {
        setShake(true);
        setTimeout(() => setShake(false), 400);
      };

      const doLogin = async () => {
        if (loading) return;
        if (!username.trim() || !pw) {
          setErr('Nhập đầy đủ username và mật khẩu nhé!');
          doShake();
          return;
        }
        setLoading(true);
        setErr('');
        const res = await onLogin(username, pw);
        if (!res.ok) {
          setErr(res.msg || 'Đăng nhập thất bại!');
          doShake();
          setPw('');
        }
        setLoading(false);
      };

      // ── Theme Colors (Indigo/Violet for Students) ──
      const bgMain = dark
        ? 'radial-gradient(at 20% 20%, rgba(99, 102, 241, 0.15) 0px, transparent 50%), radial-gradient(at 80% 80%, rgba(139, 92, 246, 0.15) 0px, transparent 50%), #0f172a'
        : 'radial-gradient(at 20% 20%, rgba(199, 210, 254, 0.6) 0px, transparent 50%), radial-gradient(at 80% 80%, rgba(221, 214, 254, 0.6) 0px, transparent 50%), #f8fafc';
      const cardBg = dark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.75)';
      const cardBorder = dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.9)';
      const cardShadow = dark
        ? '0 25px 50px -12px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255,255,255,0.05)'
        : '0 25px 50px -12px rgba(99, 102, 241, 0.25), inset 0 1px 0 rgba(255,255,255,0.9)';

      const tMain = dark ? '#f1f5f9' : '#1e293b';
      const tSub = dark ? '#94a3b8' : '#64748b';
      const inBg = dark ? 'rgba(15, 23, 42, 0.6)' : 'rgba(241, 245, 249, 0.8)';
      const inBorder = dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(99, 102, 241, 0.15)';
      
      const primary = '#6366f1';
      const primaryHover = '#4f46e5';

      const canSubmit = !loading && username.trim() && pw;

      return (
        <div style={{
          minHeight: '100vh',
          background: bgMain,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: "'Nunito', sans-serif",
        }}>

          {/* ── Decorative floating dots (nhẹ nhàng hơn SVG blur) ── */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="ls-float" style={{
                position: 'absolute',
                width: `${10 + i * 4}px`,
                height: `${10 + i * 4}px`,
                borderRadius: '50%',
                background: dark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                top: `${15 + i * 12}%`,
                left: `${10 + i * 15}%`,
                animationDelay: `${i * 0.5}s`,
                animationDuration: `${3 + i}s`,
              }} />
            ))}
          </div>

          <div className="ls-fadeUp" style={{
            position: 'relative', zIndex: 1, width: '100%', maxWidth: 400
          }}>
            {/* ── Logo & Badge ── */}
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span className="ls-float">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="url(#logoGrad)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <defs>
                      <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#6366F1" />
                        <stop offset="100%" stopColor="#a855f7" />
                      </linearGradient>
                    </defs>
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                  </svg>
                </span>
                <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}>
                  <span style={{
                    fontFamily: "'Satisfy','Dancing Script','Brush Script MT',cursive", fontSize: 36, fontWeight: 400, letterSpacing: 0,
                    background: 'linear-gradient(100deg,#5cc791 0%,#a4ac71 38%,#ef8e59 72%,#e0907a 100%)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                    display: 'inline-block', padding: '0.06em 0.2em 0.12em 0.06em', lineHeight: 1.1,
                  }}>Luvie</span>
                </span>
              </div>
              
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800,
                color: primary,
                background: dark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.08)',
                border: `1.5px solid ${dark ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.2)'}`,
                borderRadius: 99, padding: '4px 14px',
                backdropFilter: 'blur(8px)',
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
                </svg>
                Khu vực học sinh
              </div>
            </div>

            {/* ── Glassmorphism Card ── */}
            <div className="ls-pop" style={{
              background: cardBg,
              backdropFilter: 'blur(24px) saturate(160%)',
              WebkitBackdropFilter: 'blur(24px) saturate(160%)',
              border: `1.5px solid ${cardBorder}`,
              borderRadius: 28,
              padding: '32px 28px 28px',
              boxShadow: cardShadow,
            }}>

              {/* Header Icon */}
              <div style={{ textAlign: 'center', marginBottom: 24 }}>                <div style={{
                  width: 60, height: 60, borderRadius: 24,
                  background: dark ? 'rgba(99, 102, 241, 0.15)' : 'linear-gradient(135deg, #e0e7ff, #f3e8ff)',
                  border: `1.5px solid ${dark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.15)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px',
                  boxShadow: '0 8px 20px rgba(99, 102, 241, 0.15)',
                }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={primary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                  </svg>
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: tMain, marginBottom: 4 }}>Chào mừng trở lại! 📚</div>
                <div style={{ fontSize: 13, color: tSub, fontWeight: 600 }}>Đăng nhập để bắt đầu luyện tập</div>
              </div>

              {/* Divider */}
              <div style={{
                height: 1, marginBottom: 24,
                background: `linear-gradient(90deg, transparent, ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(99, 102, 241, 0.2)'}, transparent)`
              }} />

              {/* Username Input */}
              <div style={{ marginBottom: 16 }}>
                <label style={{
                  display: 'block', fontSize: 11, fontWeight: 800, color: tSub,
                  letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 8
                }}>
                  Tên đăng nhập
                </label>
                <div style={{ position: 'relative' }}>
                  <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={tSub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                  </svg>
                  <input
                    ref={uRef}
                    type="text" value={username}
                    onChange={e => setUsername(e.target.value.replace(/\s/g, ''))}
                    onKeyDown={e => e.key === 'Enter' && doLogin()}
                    placeholder="Nhập username của bạn"
                    autoComplete="username" autoCapitalize="none"
                    className="ls-input-base"
                    style={{
                      width: '100%', padding: '13px 16px 13px 42px',
                      border: `1.5px solid ${err ? '#ef4444' : inBorder}`,
                      borderRadius: 18, fontSize: 14, fontWeight: 700, color: tMain,
                      background: inBg, fontFamily: "'Nunito', sans-serif",
                      boxSizing: 'border-box',                    }}
                  />
                </div>
              </div>

              {/* Password Input */}
              <div style={{ marginBottom: 20 }}>
                <label style={{
                  display: 'block', fontSize: 11, fontWeight: 800, color: tSub,
                  letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 8
                }}>
                  Mật khẩu
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={show ? 'text' : 'password'} value={pw}
                    onChange={e => setPw(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && doLogin()}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className={`ls-input-base ${shake ? 'do-shake' : ''}`}
                    style={{
                      width: '100%', padding: '13px 46px 13px 16px',
                      border: `1.5px solid ${err ? '#ef4444' : inBorder}`,
                      borderRadius: 18, fontSize: 14, fontWeight: 700, color: tMain,
                      background: inBg, fontFamily: "'Nunito', sans-serif",
                      boxSizing: 'border-box',
                    }}
                  />
                  <button onClick={() => setShow(s => !s)} tabIndex={-1} type="button" style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                    color: tSub, display: 'flex', alignItems: 'center', lineHeight: 0,
                    transition: 'color 0.2s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#6366f1'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = tSub; }}>
                    {show ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Thông báo phiên hết hạn (72h không hoạt động) */}
              {notice && !err && (
                <div className="ls-pop" style={{
                  display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, color: '#b45309',
                  background: 'rgba(245, 158, 11, 0.10)', border: '1px solid rgba(245, 158, 11, 0.30)',
                  borderRadius: 12, padding: '10px 14px', marginBottom: 16
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                  {notice}
                </div>
              )}

              {/* Error Message */}
              {err && (
                <div className="ls-pop" style={{
                  display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, color: '#ef4444',
                  background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: 12, padding: '10px 14px', marginBottom: 16
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {err}
                </div>
              )}

              {/* Login Button */}
              <button onClick={doLogin} disabled={!canSubmit} style={{
                width: '100%', padding: '14px', borderRadius: 18, border: 'none',
                background: canSubmit ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' : 'rgba(99, 102, 241, 0.2)',
                color: canSubmit ? '#fff' : 'rgba(255, 255, 255, 0.5)',
                fontSize: 15, fontWeight: 900, fontFamily: "'Nunito', sans-serif",
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                boxShadow: canSubmit ? '0 10px 25px -5px rgba(99, 102, 241, 0.5), 0 8px 10px -6px rgba(139, 92, 246, 0.4)' : 'none',
                transition: 'all 0.3s cubic-bezier(.22,1,.36,1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transform: canSubmit ? 'translateY(0)' : 'translateY(2px)',
              }}
                onMouseEnter={e => { if (canSubmit) { e.currentTarget.style.filter = 'brightness(1.08)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 14px 30px -5px rgba(99,102,241,0.6), 0 10px 14px -6px rgba(139,92,246,0.5)'; } }}
                onMouseLeave={e => { e.currentTarget.style.filter = 'none'; e.currentTarget.style.transform = canSubmit ? 'translateY(0)' : 'translateY(2px)'; e.currentTarget.style.boxShadow = canSubmit ? '0 10px 25px -5px rgba(99, 102, 241, 0.5), 0 8px 10px -6px rgba(139, 92, 246, 0.4)' : 'none'; }}>
                {loading ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'ls-spin 1s linear infinite' }}>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    Đăng nhập
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>

              {/* Footer note */}
              <div style={{
                textAlign: 'center', marginTop: 20, fontSize: 11.5, color: tSub, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: 0.8
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>                Tài khoản do giáo viên cấp phát
              </div>
            </div>

            {/* Brand footer */}
            <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: tSub, opacity: 0.6, fontWeight: 700 }}>
              Learnsy © 2026 · Nền tảng học tập trực tuyến
            </div>
          </div>

          {/* Inject keyframes for spinner (chỉ cần 1 lần) */}
          <style>{`@keyframes ls-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      );
    }

    /* ══ EXPORT GLOBALS ══ */
    window.StudentLoginScreen = StudentLoginScreen;
  } catch (e) {
    console.error('[student-login] INIT ERROR:', e);
  }
})();
