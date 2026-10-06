import React from 'react';

/* ══════════════════════════════════════════════════════════════════
   LISTENING-PRACTICE.JSX - v2.3 (fix + improvement)
   - Sửa rò rỉ timeout trong handleRateChange
   - Tối ưu splitPassage dùng split capturing group, loại bỏ infinite loop
   - Thêm trạng thái pulse khi phát lại
   [v2.2]
   - splitPassage: trim chunk trước khi test regex → không bỏ sót blank có khoảng trắng thừa
   - Fallback blank: dùng capturing group giữ dấu câu gốc (.!?), sửa câu bị dính nhau ở nhánh else
   - useEffect: ép kiểu Array.isArray() an toàn cho answers/wordBox/statements
   - isBad: hiển thị đỏ + tooltip khi ô trống (val === '')
   - speak: regex ▁{3,} trong TTS plain text
   [v2.3]
   - Fix: tooltip z-index, aria-label cho inputs, shimmer dùng chung
   - Fix: chặn double‑speak khi bấm play liên tục nhờ speakPendingRef
   - Tối ưu key cho passage parts
══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';
  try {
    const { useState, useEffect, useMemo, useRef, useCallback } = React;

    const stripHTML = s => (s || '').replace(/<[^>]*>/g, '');
    const norm = s => (s || '').trim().toLowerCase();

    // render nhận định T/F/NM có hỗ trợ gạch chân (đồng bộ với listening-panel admin):
    // phần text được bọc <u>...</u> trong câu sẽ hiển thị gạch chân thật, không lộ ký tự thẻ
    const renderUnderline = str => {
      const text = str || '';
      const segs = text.split(/(<u>|<\/u>)/g);
      let underline = false, key = 0;
      const out = [];
      segs.forEach(seg => {
        if (seg === '<u>') { underline = true; return; }
        if (seg === '</u>') { underline = false; return; }
        if (seg === '') return;
        out.push(underline ? <u key={key++}>{seg}</u> : <span key={key++}>{seg}</span>);
      });
      return out;
    };

    // xáo trộn mảng (Fisher-Yates) — dùng để tự tráo thứ tự nhận định T/F/NM khi mở bài
    const shuffleArr = arr => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };


    /* ────────────────────────────────────────────────
       🔊 MINI AUDIO ENGINE — đồng bộ cảm giác với quiz-player
       Tự chứa (Web Audio API), không phụ thuộc file ngoài.
       Dùng chung cờ mute 'qp_muted' với quiz-player để đồng bộ
       lựa chọn của học sinh trên toàn app.
    ──────────────────────────────────────────────── */
    const _AC = (() => {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        let ctx = null;
        const get = () => {
          if (!ctx) ctx = new Ctx();
          if (ctx.state === 'suspended') ctx.resume();
          return ctx;
        };
        return { get };
      } catch { return null; }
    })();

    let _muted = false;
    try { _muted = localStorage.getItem('qp_muted') === '1'; } catch {}

    const _sfxPlay = (notes, masterVol) => {
      if (!_AC || _muted) return;
      try {
        const ctx = _AC.get();
        const mv = masterVol !== undefined ? masterVol : 0.22;
        notes.forEach(({ f, d, t, v, delay, ramp }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const comp = ctx.createDynamicsCompressor();
          osc.connect(gain); gain.connect(comp); comp.connect(ctx.destination);
          osc.type = t || 'sine';
          osc.frequency.value = f;
          const start = ctx.currentTime + (delay || 0);
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime((v !== undefined ? v : 1) * mv, start + 0.008);
          if (ramp === 'slide') {
            osc.frequency.setValueAtTime(f, start);
            osc.frequency.linearRampToValueAtTime(f * 1.08, start + d);
          }
          gain.gain.exponentialRampToValueAtTime(0.0001, start + d);
          osc.start(start);
          osc.stop(start + d + 0.01);
        });
      } catch {}
    };

    /* Nộp bài — chime ngắn */
    const _sfxSubmit = () => _sfxPlay([
      { f: 440, d: 0.08, t: 'triangle', v: 0.6 },
      { f: 550, d: 0.10, t: 'triangle', v: 0.7, delay: 0.07 },
      { f: 660, d: 0.12, t: 'sine', v: 0.8, delay: 0.15 },
    ], 0.24);

    /* Đạt điểm cao — fanfare chiến thắng */
    const _sfxFanfare = () => _sfxPlay([
      { f: 523, d: 0.12, t: 'triangle', v: 0.9 },
      { f: 659, d: 0.12, t: 'triangle', v: 0.9, delay: 0.11 },
      { f: 784, d: 0.12, t: 'triangle', v: 0.9, delay: 0.22 },
      { f: 1047, d: 0.18, t: 'sine', v: 1.0, delay: 0.33 },
      { f: 784, d: 0.09, t: 'triangle', v: 0.7, delay: 0.52 },
      { f: 1047, d: 0.09, t: 'sine', v: 0.8, delay: 0.62 },
      { f: 1319, d: 0.26, t: 'sine', v: 1.0, delay: 0.72, ramp: 'slide' },
      { f: 659, d: 0.26, t: 'triangle', v: 0.4, delay: 0.72 },
    ], 0.30);

    /* Điểm thấp — giai điệu buồn nhẹ */
    const _sfxSad = () => _sfxPlay([
      { f: 440, d: 0.14, t: 'sawtooth', v: 0.6 },
      { f: 370, d: 0.18, t: 'sawtooth', v: 0.7, delay: 0.12 },
      { f: 294, d: 0.24, t: 'triangle', v: 0.5, delay: 0.26 },
      { f: 220, d: 0.30, t: 'triangle', v: 0.4, delay: 0.44 },
    ], 0.26);

    /* ── Helper: tách đoạn văn – dùng split với capturing group ── */
    function splitPassage(text, blankCount) {
      const raw = stripHTML(text);
      // Dùng split để tách và giữ lại các delimiter (___ hoặc ▁▁▁)
      const parts = raw.split(/(_{3,}|▁{3,})/);
      const result = [];
      let blankIndex = 0;
      for (let i = 0; i < parts.length; i++) {
        const chunk = parts[i];
        if (!chunk) continue;
        const trimmed = chunk.trim();
        // Nếu chunk khớp với blank pattern (sau khi trim khoảng trắng thừa)
        if (/^_{3,}$/.test(trimmed) || /^▁{3,}$/.test(trimmed)) {
          if (blankIndex < blankCount) {
            result.push({ type: 'blank', index: blankIndex++ });
          } else {
            result.push({ type: 'text', content: chunk });
          }
        } else {
          result.push({ type: 'text', content: chunk });
        }
      }
      if (blankIndex === 0 && blankCount > 0) {
        const sentParts = raw.split(/([.!?]\s+)/);
        const newResult = [];
        let cnt = 0;
        for (let i = 0; i < sentParts.length; i++) {
          const chunk = sentParts[i];
          if (!chunk) continue;
          if (/^[.!?]\s+$/.test(chunk)) {
            newResult.push({ type: 'text', content: chunk });
            continue;
          }
          if (cnt < blankCount) {
            const words = chunk.trim().split(' ').filter(Boolean);
            if (words.length > 4) {
              const mid = Math.floor(words.length / 2);
              newResult.push({ type: 'text', content: words.slice(0, mid).join(' ') + ' ' });
              newResult.push({ type: 'blank', index: cnt++ });
              newResult.push({ type: 'text', content: ' ' + words.slice(mid).join(' ') });
            } else {
              newResult.push({ type: 'text', content: chunk + ' ' });
              newResult.push({ type: 'blank', index: cnt++ });
            }
          } else {
            newResult.push({ type: 'text', content: chunk });
          }
        }
        return newResult.filter(p => p.content !== undefined || p.type === 'blank');
      }
      return result;
    }

    /* ── Skeleton Loading (dùng chung keyframes) ── */
    function SkeletonCard({ dark }) {
      const bg = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
      const shimmer = dark
        ? 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)'
        : 'linear-gradient(90deg, rgba(0,0,0,0.04) 25%, rgba(0,0,0,0.07) 50%, rgba(0,0,0,0.04) 75%)';
      return (
        <div style={{
          padding: '14px 16px',
          borderRadius: 22,
          background: bg,
          border: `1.5px solid ${dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
          position: 'relative',
          overflow: 'hidden',
          height: 72,
        }}>
          <div
            className="skeleton-shimmer"
            style={{
              position: 'absolute',
              inset: 0,
              background: shimmer,
              backgroundSize: '200% 100%',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: bg, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 14, width: '75%', borderRadius: 6, background: bg }} />
              <div style={{ height: 12, width: '45%', borderRadius: 6, background: bg, marginTop: 8 }} />
            </div>
          </div>
        </div>
      );
    }

    /* ── Icon set (thay emoji) ── */
    function IconHeadphones({ size = 14, color = 'currentColor' }) {
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
          <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5z" />
          <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5z" />
        </svg>
      );
    }

    function IconBook({ size = 11, color = 'currentColor' }) {
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M2 4.5C2 3.67 2.67 3 3.5 3H10a2 2 0 0 1 2 2v15a1.5 1.5 0 0 0-1.5-1.5H2v-14z" />
          <path d="M22 4.5c0-.83-.67-1.5-1.5-1.5H14a2 2 0 0 0-2 2v15a1.5 1.5 0 0 1 1.5-1.5H22v-14z" />
        </svg>
      );
    }

    function IconBox({ size = 11, color = 'currentColor' }) {
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M21 8a1 1 0 0 0-.5-.87l-8-4.6a1 1 0 0 0-1 0l-8 4.6A1 1 0 0 0 3 8v8a1 1 0 0 0 .5.87l8 4.6a1 1 0 0 0 1 0l8-4.6A1 1 0 0 0 21 16V8z" />
          <path d="M3.27 7.13 12 12l8.73-4.87" />
          <path d="M12 22.5V12" />
        </svg>
      );
    }

    function IconCheck({ size = 13, color = 'currentColor' }) {
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    }

    function IconRedo({ size = 13, color = 'currentColor' }) {
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <polyline points="3 3 3 6.5 6.5 6.5" />
        </svg>
      );
    }

    function IconRefresh({ size = 12, color = 'currentColor', spin = false }) {
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, animation: spin ? 'spin 0.9s linear infinite' : 'none' }}>
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <polyline points="21 3 21 9 15 9" />
        </svg>
      );
    }

    /* ── Icon bộ điểm số dùng cho ScoreToast ── */
    function IconTrophy({ size = 16, color = 'currentColor' }) {
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M8 21h8" /><path d="M12 17v4" />
          <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
          <path d="M7 5H4.5A1.5 1.5 0 0 0 3 6.5v0A3.5 3.5 0 0 0 6.5 10H7" />
          <path d="M17 5h2.5A1.5 1.5 0 0 1 21 6.5v0a3.5 3.5 0 0 1-3.5 3.5H17" />
        </svg>
      );
    }

    function IconThumbsUp({ size = 16, color = 'currentColor' }) {
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M7 10v11" />
          <path d="M11 4l-1 5h9.28a2 2 0 0 1 1.94 2.5l-1.76 7A2 2 0 0 1 17.52 20H7" />
        </svg>
      );
    }

    function IconStarBadge({ size = 16, color = 'currentColor' }) {
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.3l-5.8 3.1 1.1-6.45-4.7-4.6 6.5-.95L12 2.5z" />
        </svg>
      );
    }

    function IconSadFace({ size = 16, color = 'currentColor' }) {
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 16c.8-1.3 2-2 3.5-2s2.7.7 3.5 2" />
          <line x1="9" y1="9.5" x2="9" y2="9.5" strokeWidth="2.6" />
          <line x1="15" y1="9.5" x2="15" y2="9.5" strokeWidth="2.6" />
        </svg>
      );
    }

    /* ── Inject keyframes riêng cho ScoreToast (tự chứa, không phụ
       thuộc thứ tự load của dashboard.jsx) ── */
    (function injectScoreToastCSS() {
      if (document.getElementById('lp-toast-css')) return;
      const s = document.createElement('style');
      s.id = 'lp-toast-css';
      s.textContent = `
        @keyframes lp-pill-in {
          0%  { width:36px; height:36px; border-radius:50%; opacity:0; transform:translateX(-50%) scaleY(0.6); }
          20% { width:36px; height:36px; border-radius:50%; opacity:1; transform:translateX(-50%) scaleY(1); }
          55% { width:270px; height:52px; border-radius:26px; opacity:1; transform:translateX(-50%) scaleY(1); }
          100%{ width:300px; height:56px; border-radius:28px; opacity:1; transform:translateX(-50%) scaleY(1); }
        }
        @keyframes lp-pill-out {
          0%  { width:300px; height:56px; border-radius:28px; opacity:1; transform:translateX(-50%) scaleY(1); }
          40% { width:270px; height:52px; border-radius:26px; opacity:1; transform:translateX(-50%) scaleY(1); }
          75% { width:36px;  height:36px; border-radius:50%; opacity:1; transform:translateX(-50%) scaleY(1); }
          100%{ width:36px;  height:36px; border-radius:50%; opacity:0; transform:translateX(-50%) scaleY(0.6); }
        }
        @keyframes lp-content-in {
          0% { opacity:0; transform:translateX(-6px); }
          100% { opacity:1; transform:translateX(0); }
        }
        @keyframes lp-icon-pulse {
          0%,100% { transform:scale(1); }
          50% { transform:scale(1.12); }
        }
        @keyframes lp-glow-pulse {
          0%,100% { opacity:0.16; }
          50% { opacity:0.32; }
        }
      `;
      document.head.appendChild(s);
    })();

    /* ── ScoreToast — toast kiểu Dynamic Island báo điểm khi nộp bài,
       phong cách đồng bộ với AchievementToast của dashboard ── */
    function ScoreToast({ correct, total, onClose }) {
      const [leaving, setLeaving] = useState(false);
      const [mounted, setMounted] = useState(false);
      const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

      const visual = pct >= 90
        ? { Icon: IconTrophy, color: '#f59e0b', label: 'Xuất sắc!' }
        : pct >= 70
          ? { Icon: IconThumbsUp, color: '#34d399', label: 'Giỏi lắm!' }
          : pct >= 50
            ? { Icon: IconStarBadge, color: '#a855f7', label: 'Khá ổn!' }
            : { Icon: IconSadFace, color: '#f472b6', label: 'Cố lên nhé!' };

      useEffect(() => {
        setLeaving(false);
        setMounted(true);
        const leaveTimer = setTimeout(() => setLeaving(true), 3000);
        const closeTimer = setTimeout(onClose, 3500);
        return () => { clearTimeout(leaveTimer); clearTimeout(closeTimer); };
      }, [onClose]);

      if (!mounted) return null;

      const handleTap = () => {
        setLeaving(true);
        setTimeout(onClose, 450);
      };

      const pillBg = 'linear-gradient(135deg,rgba(18,6,14,0.97) 0%,rgba(30,10,22,0.97) 100%)';
      const glowColor = visual.color;

      return (
        <div
          onClick={handleTap}
          style={{
            position: 'fixed',
            top: 10,
            left: '50%',
            zIndex: 9999,
            width: 300,
            height: 56,
            borderRadius: 28,
            transform: 'translateX(-50%)',
            transformOrigin: 'center top',
            background: pillBg,
            boxShadow: `0 0 0 1.5px rgba(255,255,255,0.08), 0 8px 28px rgba(0,0,0,0.55), 0 0 20px ${glowColor}44`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: '0 16px',
            cursor: 'pointer',
            userSelect: 'none',
            overflow: 'hidden',
            animation: leaving
              ? 'lp-pill-out 0.45s cubic-bezier(.55,.0,.45,1) both'
              : 'lp-pill-in  0.55s cubic-bezier(.34,1.3,.64,1) both',
            willChange: 'width,height,border-radius,opacity',
          }}
        >
          {/* Glow halo phía sau icon */}
          <div style={{
            position: 'absolute', left: 14, top: '50%',
            transform: 'translateY(-50%)',
            width: 32, height: 32, borderRadius: '50%',
            background: glowColor,
            opacity: 0.18,
            filter: 'blur(8px)',
            animation: 'lp-glow-pulse 1.2s ease-in-out infinite',
            pointerEvents: 'none',
          }} />

          {/* Icon */}
          <div style={{
            flexShrink: 0,
            display: 'inline-flex',
            animation: 'lp-icon-pulse 1s ease-in-out infinite',
            position: 'relative', zIndex: 1,
          }}>
            <visual.Icon size={24} color={glowColor} />
          </div>

          {/* Nội dung — hiện sau khi pill nở ra */}
          <div style={{
            flex: 1, minWidth: 0,
            animation: 'lp-content-in 0.55s cubic-bezier(.34,1.3,.64,1) both',
            position: 'relative', zIndex: 1,
          }}>
            <div style={{
              fontSize: 9.5, fontWeight: 800, color: glowColor,
              letterSpacing: '0.7px', textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', gap: 3,
              marginBottom: 1,
              fontFamily: 'Nunito,sans-serif',
            }}>
              <IconHeadphones size={10} color={glowColor} /> {visual.label}
            </div>
            <div style={{
              fontFamily: "'Baloo 2',cursive",
              fontSize: 14, fontWeight: 800,
              color: '#fce4f0',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              lineHeight: 1.15,
            }}>
              Đúng {correct}/{total} câu · {pct}%
            </div>
          </div>

          {/* Chấm tap-to-dismiss */}
          <div style={{
            flexShrink: 0, width: 6, height: 6, borderRadius: '50%',
            background: 'rgba(255,255,255,0.25)',
            position: 'relative', zIndex: 1,
          }} />
        </div>
      );
    }

    /* ── Component chính ── */
    function ListeningPractice({ dark, onBack }) {
      const [items, setItems] = useState([]);
      const [loading, setLoading] = useState(true);
      const [loadError, setLoadError] = useState(false);

      const [selected, setSelected] = useState(null);
      const [wordBoxDisplay, setWordBoxDisplay] = useState([]); // wordBox đã xáo (hoặc gốc) cho bài đang làm
      const [blanks, setBlanks] = useState([]);
      const [stmtSel, setStmtSel] = useState([]);
      const [submitted, setSubmitted] = useState(false);
      const [showScoreToast, setShowScoreToast] = useState(false);

      const [isPlaying, setIsPlaying] = useState(false);
      const [speechRate, setSpeechRate] = useState(1.0);
      const [isRestarting, setIsRestarting] = useState(false);

      const utteranceRef = useRef(null);
      const synthRef = useRef(null);
      const timerRef = useRef(null);
      const speakPendingRef = useRef(false); // tránh double‑speak

      // ── Edge TTS (giọng AI, free) ──
      const audioRef = useRef(null);       // <audio> đang phát (nếu dùng remote TTS)
      const audioCacheRef = useRef({});    // cache blob URL theo item.id, tránh gọi lại API
      const ttsDownRef = useRef(false);     // bật lên khi remote TTS lỗi → dùng speechSynthesis cho phần còn lại của session

      const inputRefs = useRef([]);
      const inputRefCallbacks = useRef({});

      // Khởi tạo tham chiếu Web Speech API trong useEffect riêng — tránh
      // đụng vào `window` ngay trong thân render.
      useEffect(() => {
        synthRef.current = window.speechSynthesis || null;
      }, []);

      // Callback ref ổn định cho từng input theo index. Tránh anti-pattern
      // `ref={el => ...}` (arrow function inline bị tạo lại mỗi lần render,
      // khiến React gọi ref cũ với null rồi gọi ref mới với node ở mỗi update).
      const getInputRef = useCallback((bi) => {
        let cb = inputRefCallbacks.current[bi];
        if (!cb) {
          cb = (el) => {
            if (el) inputRefs.current[bi] = el;
            else delete inputRefs.current[bi];
          };
          inputRefCallbacks.current[bi] = cb;
        }
        return cb;
      }, []);

      const LC = useMemo(() => ({
        text: dark ? '#F2EAFF' : '#2D1245',
        text2: dark ? '#DDD0F8' : '#4A1860',
        textMid: dark ? '#9B7FC0' : '#8060A0',
        surface: dark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.82)',
        surfaceQ: dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.92)',
        border: dark ? 'rgba(196,181,253,0.13)' : 'rgba(180,100,255,0.13)',
        borderQ: dark ? 'rgba(196,181,253,0.18)' : 'rgba(180,100,255,0.18)',
        navBtn: dark ? 'rgba(255,150,200,0.07)' : 'rgba(255,107,149,0.06)',
        navBtnBorder: dark ? 'rgba(255,150,200,0.28)' : 'rgba(255,107,149,0.28)',
        navBtnText: dark ? '#FBAFCE' : '#E8547A',
        inputBg: dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.92)',
        inputColor: dark ? '#F2EAFF' : '#2D1245',
        inputBorder: dark ? 'rgba(196,181,253,0.28)' : 'rgba(180,100,255,0.28)',
        cardShadow: dark ? '0 2px 16px rgba(0,0,0,0.35)' : '0 2px 16px rgba(168,85,247,0.08)',
      }), [dark]);

      // Load dữ liệu
      useEffect(() => {
        const supa = window.supa;
        if (!supa) {
          setLoading(false);
          setLoadError(true);
          return;
        }
        supa.from('listening_items').select('*').order('created_at').then(({ data, error }) => {
          if (error) {
            console.error('[ListeningPractice] load error:', error);
            setLoadError(true);
          } else {
            setItems((data || []).map(r => ({
              id: r.id,
              text: r.text || '',
              wordBox: Array.isArray(r.word_box) ? r.word_box : [],
              answers: Array.isArray(r.answers) ? r.answers : [],
              statements: Array.isArray(r.statements) ? r.statements : [],
              shuffleStatements: !!r.shuffle_statements, // tự tráo thứ tự nhận định T/F/NM mỗi lần mở bài
              shuffleWordBox: !!r.shuffle_word_box,       // tự tráo thứ tự Word Box mỗi lần mở bài
            })));
          }
          setLoading(false);
        });
      }, []);

      // Mở bài
      const openItem = useCallback((it) => {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.onplay = null;
          audioRef.current.onended = null;
          audioRef.current.onerror = null;
          audioRef.current = null;
        }
        if (synthRef.current) {
          synthRef.current.cancel();
          setIsPlaying(false);
        }
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        speakPendingRef.current = false;
        setIsRestarting(false);
        // nếu bật "Tự tráo thứ tự", xáo lại thứ tự nhận định mỗi lần mở bài (không ảnh hưởng đáp án đúng vì answer đi theo từng câu)
        const stmts = it.shuffleStatements ? shuffleArr(it.statements) : it.statements;
        const wb = it.shuffleWordBox ? shuffleArr(it.wordBox) : it.wordBox;
        setSelected({ ...it, statements: stmts });
        setWordBoxDisplay(wb);
        setBlanks(it.answers.map(() => ''));
        setStmtSel(stmts.map(() => null));
        setSubmitted(false);
        setShowScoreToast(false);
        inputRefs.current = [];
      }, []);

      // ── Audio Controls ──
      // Handler sự kiện của utterance khai báo ổn định bằng useCallback
      // (deps rỗng) — tránh tạo closure mới mỗi lần gọi speak().
      const handleSpeechStart = useCallback(() => {
        setIsPlaying(true);
        setIsRestarting(false);
        speakPendingRef.current = false;
      }, []);

      const handleSpeechEnd = useCallback(() => {
        setIsPlaying(false);
        setIsRestarting(false);
        speakPendingRef.current = false;
      }, []);

      const handleSpeechError = useCallback(() => {
        setIsPlaying(false);
        setIsRestarting(false);
        speakPendingRef.current = false;
      }, []);

      // ── Giọng đọc AI (Edge TTS qua /api/tts) — fallback speechSynthesis nội bộ máy ──
      const speakLocalSynth = useCallback((raw, rate) => {
        if (!raw || !raw.trim()) return;
        if (!window.speechSynthesis) return;
        try {
          window.speechSynthesis.cancel();
          const plain = stripHTML(raw).replace(/_{3,}|▁{3,}/g, ' blank ').replace(/\s+/g, ' ').trim();
          const u = new SpeechSynthesisUtterance(plain);
          u.lang = 'en-US';
          u.rate = rate;
          utteranceRef.current = u;
          speakPendingRef.current = true; // đánh dấu đang chờ phát
          u.onstart = handleSpeechStart;
          u.onend = handleSpeechEnd;
          u.onerror = handleSpeechError;
          window.speechSynthesis.speak(u);
        } catch (e) {
          setIsPlaying(false);
          setIsRestarting(false);
          speakPendingRef.current = false;
        }
      }, [handleSpeechStart, handleSpeechEnd, handleSpeechError]);

      // Lấy (hoặc tải + cache) audio Edge TTS cho 1 item, rồi phát.
      const playRemoteTTS = useCallback(async (item, rate) => {
        let url = audioCacheRef.current[item.id];
        if (!url) {
          const plain = stripHTML(item.text).replace(/_{3,}|▁{3,}/g, ' blank ').replace(/\s+/g, ' ').trim();
          const res = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: plain }),
          });
          if (!res.ok) throw new Error('tts http ' + res.status);
          const blob = await res.blob();
          if (!blob || blob.size === 0) throw new Error('tts empty');
          url = URL.createObjectURL(blob);
          audioCacheRef.current[item.id] = url;
        }
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.onplay = null;
          audioRef.current.onended = null;
          audioRef.current.onerror = null;
        }
        const audio = new Audio(url);
        audio.playbackRate = rate;
        audio.onplay = handleSpeechStart;
        audio.onended = handleSpeechEnd;
        audio.onerror = handleSpeechError;
        audioRef.current = audio;
        await audio.play();
      }, [handleSpeechStart, handleSpeechEnd, handleSpeechError]);

      const speak = useCallback((raw, rate = speechRate) => {
        if (!raw || !raw.trim() || !selected) return;
        if (!ttsDownRef.current) {
          speakPendingRef.current = true;
          playRemoteTTS(selected, rate).catch((err) => {
            console.warn('[ListeningPractice] Edge TTS lỗi, chuyển sang giọng máy:', err);
            ttsDownRef.current = true; // không gọi API nữa cho phần còn lại của session
            speakPendingRef.current = false;
            speakLocalSynth(raw, rate);
          });
          return;
        }
        speakLocalSynth(raw, rate);
      }, [selected, speechRate, playRemoteTTS, speakLocalSynth]);

      const togglePlayPause = useCallback(() => {
        if (speakPendingRef.current) return; // tránh gọi speak thêm lần nữa trong lúc đang tải
        const audio = audioRef.current;
        if (audio && !audio.ended) {
          if (!audio.paused) { audio.pause(); setIsPlaying(false); }
          else { audio.play(); setIsPlaying(true); }
          return;
        }
        const synth = synthRef.current;
        if (synth && synth.speaking && !audio) {
          if (!synth.paused) { synth.pause(); setIsPlaying(false); }
          else { synth.resume(); setIsPlaying(true); }
          return;
        }
        if (selected) speak(selected.text);
      }, [selected, speak]);

      const handleRateChange = useCallback((e) => {
        const val = parseFloat(e.target.value);
        setSpeechRate(val);
        const audio = audioRef.current;
        if (audio) {
          audio.playbackRate = val; // Edge TTS: đổi tốc độ tức thì, không cần tải lại
          return;
        }
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        if (synthRef.current && (synthRef.current.speaking || synthRef.current.paused)) {
          synthRef.current.cancel();
          setIsPlaying(false);
          if (selected) {
            setIsRestarting(true);
            timerRef.current = setTimeout(() => {
              speak(selected.text, val);
              timerRef.current = null;
            }, 50);
          }
        }
      }, [selected, speak]);

      const handleRestart = useCallback(() => {
        if (!selected) return;
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        const audio = audioRef.current;
        if (audio) {
          audio.pause();
          audio.currentTime = 0;
          setIsPlaying(false);
          setIsRestarting(true);
          audio.play().catch(() => setIsRestarting(false));
          return;
        }
        if (synthRef.current) synthRef.current.cancel();
        setIsPlaying(false);
        setIsRestarting(true);
        speak(selected.text, speechRate);
      }, [selected, speak, speechRate]);

      useEffect(() => {
        return () => {
          if (audioRef.current) audioRef.current.pause();
          if (synthRef.current) synthRef.current.cancel();
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
          speakPendingRef.current = false;
          // Giải phóng các blob URL đã cache khi rời màn hình
          Object.values(audioCacheRef.current).forEach((u) => { try { URL.revokeObjectURL(u); } catch {} });
          audioCacheRef.current = {};
        };
      }, []);

      // ── Handlers ──
      const setBlank = (i, v) => setBlanks(p => p.map((b, idx) => idx === i ? v : b));
      const setStmt = (i, v) => setStmtSel(p => p.map((s, idx) => idx === i ? v : s));

      const score = useMemo(() => {
        if (!selected) return { correct: 0, total: 0 };
        let correct = 0, total = 0;
        selected.answers.forEach((ans, i) => {
          total++;
          if (norm(blanks[i]) === norm(ans)) correct++;
        });
        selected.statements.forEach((st, i) => {
          total++;
          if (stmtSel[i] === st.answer) correct++;
        });
        return { correct, total };
      }, [selected, blanks, stmtSel]);

      // Màu khớp với panel admin (listening-panel) để đồng bộ giao diện
      const ANS_COLOR = {
        'True': { c: '#16a34a', bg: 'rgba(22,163,74,.1)', bd: 'rgba(22,163,74,.35)', label: 'Đúng' },
        'False': { c: '#dc2626', bg: 'rgba(220,38,38,.08)', bd: 'rgba(220,38,38,.32)', label: 'Sai' },
        'Not Mentioned': { c: '#6366f1', bg: 'rgba(99,102,241,.08)', bd: 'rgba(99,102,241,.32)', label: 'NM' },
      };
      // Màu chỗ trống (điền từ) khớp với khối "Đáp án đúng" trong admin
      const BLANK_OK = '#059669';
      const BLANK_BAD = '#dc2626';

      // ── Render Passage với Inline Inputs ──
      const renderPassage = useCallback(() => {
        if (!selected) return null;
        const parts = splitPassage(selected.text, selected.answers.length);
        const blankCount = selected.answers.length;

        return parts.map((part, idx) => {
          if (part.type === 'text') {
            return <span key={`text-${idx}`} style={{ color: LC.text2, lineHeight: 1.75 }}>{part.content}</span>;
          }
          if (part.type === 'blank') {
            const bi = part.index;
            if (bi >= blankCount) return <span key={`blank-over-${idx}`} style={{ color: LC.textMid }}>___</span>;
            const val = blanks[bi] || '';
            const isOk = submitted && norm(val) === norm(selected.answers[bi]);
            const isBad = submitted && !isOk;

            return (
              <span key={`blank-${bi}-${idx}`} style={{ display: 'inline-block', position: 'relative', margin: '0 2px' }}>
                <input
                  type="text" autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false" data-lpignore="true" 
                  ref={getInputRef(bi)}
                  value={val}
                  disabled={submitted}
                  onChange={e => setBlank(bi, e.target.value)}
                  onFocus={e => e.target.select()}
                  placeholder="..."
                  aria-label={`Blank ${bi + 1}`}
                  style={{
                    width: Math.max(60, (selected.answers[bi]?.length || 4) * 12 + 20),
                    padding: '4px 8px',
                    borderRadius: 8,
                    fontSize: 13.5,
                    fontWeight: 700,
                    fontFamily: 'inherit',
                    color: isOk ? BLANK_OK : isBad ? BLANK_BAD : LC.inputColor,
                    background: isOk ? 'rgba(5,150,105,0.10)' : isBad ? 'rgba(220,38,38,0.08)' : LC.inputBg,
                    border: '1.5px solid ' + (isOk ? BLANK_OK : isBad ? BLANK_BAD : LC.inputBorder),
                    outline: 'none',
                    textAlign: 'center',
                    transition: 'border-color 0.15s cubic-bezier(.22,1,.36,1), background 0.15s cubic-bezier(.22,1,.36,1), transform 0.15s cubic-bezier(.22,1,.36,1)',
                    transform: 'scale(1)',
                  }}
                  className="inline-blank"
                />
                {submitted && isBad && (
                  <span style={{
                    position: 'absolute',
                    top: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: 9,
                    fontWeight: 800,
                    color: '#FCA5A5',
                    whiteSpace: 'nowrap',
                    background: dark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.95)',
                    padding: '1px 6px',
                    borderRadius: 4,
                    marginTop: 1,
                    pointerEvents: 'none',
                    zIndex: 10, // đảm bảo hiển thị trên các phần tử khác
                  }}>
                    {selected.answers[bi]}
                  </span>
                )}
              </span>
            );
          }
          return null;
        });
      }, [selected, blanks, submitted, LC, dark]);

      /* ════════════════════════════════════════
         DANH SÁCH
         ════════════════════════════════════════ */
      if (!selected) {
        return (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
            {/* Shimmer animation dùng chung */}
            <style>{`
              .skeleton-shimmer {
                animation: shimmer 1.8s infinite;
              }
              @keyframes shimmer {
                0% { background-position: -200% 0; }
                100% { background-position: 200% 0; }
              }
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>
            {/* Header */}
            <div style={{
              padding: '11px 15px 10px',
              background: LC.surfaceQ,
              borderBottom: `1px solid ${LC.border}`,
              position: 'sticky',
              top: 0,
              zIndex: 50,
              backdropFilter: 'blur(20px)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {onBack ? (
                  <button onClick={onBack}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 999,
                      border: `1.5px solid ${LC.navBtnBorder}`,
                      background: LC.navBtn,
                      color: LC.navBtnText,
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      transition: 'transform 0.18s cubic-bezier(.22,1,.36,1)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.96)'}
                    onMouseUp={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    Quay lại
                  </button>
                ) : <div style={{ width: 70 }} />}
                <div style={{ fontSize: 14, fontWeight: 900, color: LC.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconHeadphones size={15} color={LC.text} />
                  Listening
                </div>
                <div style={{ width: 70 }} />
              </div>
            </div>

            {/* Nội dung danh sách */}
            <div style={{ flex: 1, padding: '16px 14px 100px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {loadError && (
                <div style={{
                  padding: '12px 14px',
                  borderRadius: 18,
                  background: 'rgba(239,68,68,0.08)',
                  border: '1.5px solid rgba(239,68,68,0.25)',
                  color: '#EF4444',
                  fontSize: 12.5,
                  fontWeight: 700,
                }}>
                  Không tải được danh sách Listening. Thử lại sau nhé!
                </div>
              )}

              {loading ? (
                <>
                  <SkeletonCard dark={dark} />
                  <SkeletonCard dark={dark} />
                  <SkeletonCard dark={dark} />
                  <SkeletonCard dark={dark} />
                </>
              ) : items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 10px', color: LC.textMid, fontSize: 13, fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, borderRadius: 20, border: `1.5px solid ${LC.borderQ}` }}>
                  <IconHeadphones size={20} color={LC.textMid} />
                  Chưa có bài Listening nào. Quay lại sau nhé!
                </div>
              ) : (
                items.map((it, idx) => (
                  <button key={it.id} onClick={() => openItem(it)}
                    style={{
                      textAlign: 'left',
                      padding: '14px 16px',
                      borderRadius: 22,
                      border: `1.5px solid ${LC.borderQ}`,
                      background: LC.surfaceQ,
                      boxShadow: LC.cardShadow,
                      cursor: 'pointer',
                      transition: 'transform 0.18s cubic-bezier(.22,1,.36,1), box-shadow 0.2s cubic-bezier(.22,1,.36,1)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
                    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span style={{
                        width: 30,
                        height: 30,
                        borderRadius: '50%',
                        background: 'rgba(176,124,240,0.18)',
                        color: '#B07CF0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 900,
                        flexShrink: 0,
                      }}>{idx + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 13.5,
                          fontWeight: 700,
                          color: LC.text,
                          lineHeight: 1.55,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}>
                          {stripHTML(it.text)}
                        </div>
                        <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
                          {it.answers.length > 0 && (
                            <span style={{
                              fontSize: 10,
                              fontWeight: 800,
                              color: '#059669',
                              background: 'rgba(16,185,129,.1)',
                              border: '1px solid rgba(16,185,129,.3)',
                              borderRadius: 99,
                              padding: '2px 7px',
                            }}>{it.answers.length} chỗ trống</span>
                          )}
                          {it.statements.length > 0 && (
                            <span style={{
                              fontSize: 10,
                              fontWeight: 800,
                              color: '#dc2626',
                              background: 'rgba(220,38,38,.08)',
                              border: '1px solid rgba(220,38,38,.28)',
                              borderRadius: 99,
                              padding: '2px 7px',
                            }}>{it.statements.length} nhận định T/F/NM</span>
                          )}
                        </div>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={LC.textMid} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 6 }}>
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        );
      }

      /* ════════════════════════════════════════
         LUYỆN TẬP CHI TIẾT
         ════════════════════════════════════════ */
      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
          {/* Shimmer animation dùng chung (có thể bỏ nếu không dùng skeleton ở đây) */}
          <style>{`
            .skeleton-shimmer {
              animation: shimmer 1.8s infinite;
            }
            @keyframes shimmer {
              0% { background-position: -200% 0; }
              100% { background-position: 200% 0; }
            }
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
          {/* Header */}
          <div style={{
            padding: '11px 15px 10px',
            background: LC.surfaceQ,
            borderBottom: `1px solid ${LC.border}`,
            position: 'sticky',
            top: 0,
            zIndex: 50,
            backdropFilter: 'blur(20px)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={() => {
                if (synthRef.current) synthRef.current.cancel();
                if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
                speakPendingRef.current = false;
                setIsPlaying(false);
                setIsRestarting(false);
                setSelected(null);
                setSubmitted(false);
              }}
                style={{
                  padding: '6px 14px',
                  borderRadius: 999,
                  border: `1.5px solid ${LC.navBtnBorder}`,
                  background: LC.navBtn,
                  color: LC.navBtnText,
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'transform 0.18s cubic-bezier(.22,1,.36,1)',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.96)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Danh sách
              </button>
              <div style={{ fontSize: 13, fontWeight: 900, color: LC.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconHeadphones size={14} color={LC.text} />
                Listening
              </div>
              {submitted ? (
                <div style={{
                  padding: '5px 13px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 900,
                  color: '#fff',
                  background: 'linear-gradient(135deg,#10B981,#34D399)',
                }}>{score.correct}/{score.total}</div>
              ) : <div style={{ width: 80 }} />}
            </div>
          </div>

          {/* Nội dung */}
          <div style={{ flex: 1, padding: '16px 14px 100px', display: 'flex', flexDirection: 'column', gap: 13 }}>

            {/* ── Audio Controls ── */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              background: LC.surfaceQ,
              border: `1.5px solid ${isRestarting ? '#F59E0B' : LC.borderQ}`,
              borderRadius: 22,
              padding: '10px 14px',
              boxShadow: LC.cardShadow,
              transition: 'border-color 0.3s cubic-bezier(.22,1,.36,1), box-shadow 0.3s cubic-bezier(.22,1,.36,1)',
              ...(isRestarting && { boxShadow: '0 0 0 3px rgba(245,158,11,0.3)' }),
            }}>
              <button onClick={togglePlayPause}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  border: 'none',
                  background: isPlaying ? 'linear-gradient(135deg,#F59E0B,#F97316)' : 'linear-gradient(135deg,#10B981,#34D399)',
                  color: '#fff',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'transform 0.18s cubic-bezier(.22,1,.36,1)',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.92)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                {isPlaying ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              <div style={{ flex: 1, minWidth: 80 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: LC.textMid, marginBottom: 2 }}>
                  <span>0.8x</span>
                  <span style={{ color: LC.text }}>{speechRate.toFixed(1)}x</span>
                  <span>1.2x</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="1.2"
                  step="0.05"
                  value={speechRate}
                  onChange={handleRateChange}
                  style={{
                    width: '100%',
                    height: 4,
                    borderRadius: 2,
                    background: `linear-gradient(to right, #B07CF0 0%, #B07CF0 ${((speechRate - 0.8) / 0.4) * 100}%, ${dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'} ${((speechRate - 0.8) / 0.4) * 100}%)`,
                    outline: 'none',
                    cursor: 'pointer',
                    accentColor: '#B07CF0',
                  }}
                />
              </div>

              <button onClick={handleRestart}
                style={{
                  padding: '6px 14px',
                  borderRadius: 999,
                  border: `1.5px solid ${isRestarting ? '#F59E0B' : LC.borderQ}`,
                  background: isRestarting ? 'rgba(245,158,11,0.15)' : 'transparent',
                  color: isRestarting ? '#F59E0B' : LC.text2,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'transform 0.18s cubic-bezier(.22,1,.36,1), background 0.2s cubic-bezier(.22,1,.36,1), border-color 0.2s cubic-bezier(.22,1,.36,1), color 0.2s cubic-bezier(.22,1,.36,1)',
                  flexShrink: 0,
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.96)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  {isRestarting ? (
                    <><IconRefresh size={11} color="#F59E0B" spin /> Đang tải...</>
                  ) : (
                    <><IconRedo size={11} color={LC.text2} /> Phát lại</>
                  )}
                </span>
              </button>
            </div>

            {/* ── Word Box ── */}
            {selected.wordBox.length > 0 && (
              <div style={{
                background: 'rgba(99,102,241,.06)',
                border: '1.5px solid rgba(99,102,241,.22)',
                borderRadius: 20,
                padding: '12px 14px',
              }}>
                <div style={{ fontSize: 10, fontWeight: 900, color: '#6366f1', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 5 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <IconBox size={11} color="#6366f1" />
                    WORD BOX
                  </span>
                  {selected.shuffleWordBox && wordBoxDisplay.length > 1 && (
                    <button onClick={() => setWordBoxDisplay(prev => { let n; do { n = shuffleArr(prev); } while (n.every((w, i) => w === prev[i])); return n; })}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 99, border: '1.5px solid rgba(99,102,241,.35)', background: 'rgba(99,102,241,.1)', color: '#4338ca', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
                      Tráo lại
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {wordBoxDisplay.map((w, i) => (
                    <span key={i} style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: '#4338ca',
                      background: 'rgba(99,102,241,.12)',
                      borderRadius: 99,
                      padding: '5px 12px',
                    }}>{w}</span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Đoạn văn với Inline Inputs ── */}
            <div style={{
              background: LC.surfaceQ,
              border: `1.5px solid ${LC.borderQ}`,
              borderRadius: 22,
              padding: '15px 17px',
              boxShadow: LC.cardShadow,
            }}>
              <div style={{ fontSize: 10, fontWeight: 900, color: '#B07CF0', letterSpacing: 1.2, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <IconBook size={11} color="#B07CF0" />
                ĐOẠN VĂN
              </div>
              <div style={{ fontSize: 13.5, lineHeight: 2.1, color: LC.text2 }}>
                {renderPassage()}
              </div>
            </div>

            {/* ── True/False/Not Mentioned ── */}
            {selected.statements.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {selected.statements.map((st, i) => {
                  const sel = stmtSel[i];
                  const ok = submitted && sel === st.answer;
                  const bad = submitted && sel !== st.answer && sel !== null;
                  return (
                    <div key={i} style={{
                      background: ok ? 'rgba(22,163,74,0.1)' : bad ? 'rgba(220,38,38,0.08)' : LC.surfaceQ,
                      border: '1.5px solid ' + (ok ? '#16a34a' : bad ? '#dc2626' : LC.borderQ),
                      borderRadius: 20,
                      padding: '13px 14px',
                      transition: 'border-color 0.2s cubic-bezier(.22,1,.36,1), background 0.2s cubic-bezier(.22,1,.36,1)',
                    }}>
                      <div style={{ display: 'flex', gap: 9, marginBottom: 10 }}>
                        <span style={{
                          minWidth: 22,
                          height: 22,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          fontWeight: 900,
                          background: 'rgba(176,124,240,0.18)',
                          color: '#B07CF0',
                          flexShrink: 0,
                        }}>{i + 1}</span>
                        <p style={{ margin: 0, color: LC.text2, lineHeight: 1.65, fontWeight: 600, fontSize: 13 }}>
                          {renderUnderline(st.statement)}
                        </p>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                        {['True', 'False', 'Not Mentioned'].map(key => {
                          const isSel = sel === key;
                          const ac = ANS_COLOR[key];
                          return (
                            <button key={key} disabled={submitted} onClick={() => setStmt(i, key)}
                              style={{
                                padding: '8px 0',
                                borderRadius: 11,
                                fontSize: 11.5,
                                fontWeight: 800,
                                cursor: submitted ? 'default' : 'pointer',
                                background: isSel ? ac.c : ac.bg,
                                color: isSel ? '#fff' : ac.c,
                                border: '1.5px solid ' + (isSel ? ac.c : ac.bd),
                                transition: 'transform 0.15s cubic-bezier(.22,1,.36,1), background 0.15s cubic-bezier(.22,1,.36,1), border-color 0.15s cubic-bezier(.22,1,.36,1)',
                              }}
                              onMouseEnter={!submitted ? e => e.currentTarget.style.transform = 'translateY(-1px)' : undefined}
                              onMouseDown={!submitted ? e => e.currentTarget.style.transform = 'scale(0.95)' : undefined}
                              onMouseUp={!submitted ? e => e.currentTarget.style.transform = 'scale(1)' : undefined}
                              onMouseLeave={!submitted ? e => e.currentTarget.style.transform = 'scale(1)' : undefined}
                            >
                              {ac.label}
                            </button>
                          );
                        })}
                      </div>
                      {submitted && bad && (
                        <div style={{ marginTop: 7, textAlign: 'right' }}>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 800,
                            color: '#C084FC',
                            background: 'rgba(196,181,253,0.15)',
                            padding: '2px 9px',
                            borderRadius: 999,
                          }}>
                            Đáp án: {ANS_COLOR[st.answer].label}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Nút Nộp bài / Làm lại ── */}
            {!submitted ? (
              <button onClick={() => {
                setSubmitted(true);
                if (navigator.vibrate) navigator.vibrate(10);
                const pct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;
                _sfxSubmit();
                setTimeout(() => {
                  _AC?.get(); // wake AudioContext trước khi play fanfare/sad
                  if (pct >= 70) _sfxFanfare(); else _sfxSad();
                  setShowScoreToast(true);
                }, 420);
              }}
                style={{
                  padding: '14px',
                  borderRadius: 999,
                  border: 'none',
                  background: 'linear-gradient(135deg,#F472B6,#A855F7)',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 900,
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(168,85,247,0.3)',
                  transition: 'transform 0.18s cubic-bezier(.22,1,.36,1)',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <IconCheck size={13} color="#fff" />
                  Nộp bài
                </span>
              </button>
            ) : (
              <button onClick={() => {
                openItem(selected);
                if (navigator.vibrate) navigator.vibrate(5);
              }}
                style={{
                  padding: '14px',
                  borderRadius: 999,
                  border: `1.5px solid ${LC.navBtnBorder}`,
                  background: LC.navBtn,
                  color: LC.navBtnText,
                  fontSize: 14,
                  fontWeight: 900,
                  cursor: 'pointer',
                  transition: 'transform 0.18s cubic-bezier(.22,1,.36,1)',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <IconRedo size={13} color={LC.navBtnText} />
                  Làm lại
                </span>
              </button>
            )}
          </div>

          {/* ── Score Toast — Dynamic Island, hiện khi nộp bài ── */}
          {showScoreToast && (
            <ScoreToast
              correct={score.correct}
              total={score.total}
              onClose={() => setShowScoreToast(false)}
            />
          )}
        </div>
      );
    }

    window.ListeningPractice = ListeningPractice;

  } catch (e) {
    console.error('[ListeningPractice] initialization error:', e);
  }
})();