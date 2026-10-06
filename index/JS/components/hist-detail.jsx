import React from 'react';

/* ══════════════════════════════════════════════════════════════════
   HIST-DETAIL.JSX  ·  Learnsy · History Detail Modal
   Exports (window globals):
     window.HistDetailModal — Component: Modal hiển thị chi tiết 1 lần làm quiz

   Phụ thuộc:
     - React (window.React)
══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  try {
    const { useState } = React;

    function formatTime(sec) {
      if (!sec || sec <= 0) return null;
      const m = Math.floor(sec / 60), s = sec % 60;
      return m > 0 ? `${m}p${String(s).padStart(2, '0')}s` : `${s}s`;
    }

    function ScoreRing({ pct, color, dark }) {
      const R = 42, SW = 10, SIZE = R * 2 + SW;
      const CIRC = 2 * Math.PI * R;
      const dash = Math.max(0, Math.min(1, pct / 100)) * CIRC;
      return (
        <svg width={SIZE} height={SIZE} style={{ flexShrink: 0, transform: 'rotate(-90deg)' }}>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none"
            stroke={dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'} strokeWidth={SW} />
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none"
            stroke={color} strokeWidth={SW} strokeLinecap="round"
            strokeDasharray={`${dash} ${CIRC}`}
            style={{ transition: 'stroke-dasharray .7s cubic-bezier(.22,1,.36,1)' }} />
        </svg>
      );
    }

    function StatPill({ count, label, color }) {
      return (
        <div style={{
          flex: 1, textAlign: 'center', padding: '9px 6px',
          background: `${color}1A`, borderRadius: 13,
          border: `1.5px solid ${color}33`
        }}>
          <div style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1 }}>{count}</div>
          <div style={{ fontSize: 10, color, fontWeight: 800, marginTop: 2 }}>{label}</div>
        </div>
      );
    }
    function QuestionRow({ pq, pi, dark, subC, cardBg, cardBorder, expanded, onToggle }) {
      const color = pq.ok ? '#10B981' : pq.partial ? '#F59E0B' : '#EF4444';
      const label = pq.ok ? '✓ Đúng' : pq.partial ? '~ Một phần' : '✗ Sai';
      const qt = pq.qText || pq.text || '';
      const hasDetail = qt || pq.userAns || pq.correctAns;
      const radius = expanded && hasDetail ? '10px 10px 0 0' : 10;
      
      return (
        <div>
          <div onClick={() => hasDetail && onToggle(pi)}
            style={{
              display: 'flex', alignItems: 'center', gap: 9, padding: '8px 11px',
              background: cardBg, borderRadius: radius,
              border: `1px solid ${cardBorder}`,
              cursor: hasDetail ? 'pointer' : 'default',
              userSelect: 'none'
            }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{
              fontSize: 12, color: dark ? '#C898B8' : '#6B3050', fontWeight: 700, flex: 1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>
              Câu {pi + 1}{qt ? ` – ${qt.length > 36 ? qt.slice(0, 36) + '…' : qt}` : ''}
            </span>
            <span style={{ fontSize: 11, fontWeight: 800, color, flexShrink: 0 }}>{label}</span>
            {hasDetail && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                stroke={subC} strokeWidth="2.5" strokeLinecap="round"
                style={{ flexShrink: 0, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .25s cubic-bezier(.34,1.56,.64,1)' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            )}
          </div>
          
          {expanded && hasDetail && (
            <div style={{
              padding: '8px 12px 10px',
              background: dark ? 'rgba(255,255,255,0.025)' : 'rgba(168,85,247,0.03)',
              borderRadius: '0 0 10px 10px',
              border: `1px solid ${cardBorder}`, borderTop: 'none',
              display: 'flex', flexDirection: 'column', gap: 4
            }}>
              {pq.userAns && (
                <div style={{ fontSize: 11, color: dark ? '#A08898' : '#8A6070' }}>
                  Bạn trả lời:{' '}
                  <span style={{ color, fontWeight: 700 }}>{pq.userAns}</span>
                </div>
              )}
              {!pq.ok && pq.correctAns && (
                <div style={{ fontSize: 11, color: dark ? '#A08898' : '#8A6070' }}>
                  Đáp án đúng:{' '}                  <span style={{ color: '#10B981', fontWeight: 700 }}>{pq.correctAns}</span>
                </div>
              )}
              {!pq.userAns && !pq.correctAns && qt && (
                <div style={{ fontSize: 11, color: dark ? '#A08898' : '#8A6070', fontStyle: 'italic' }}>
                  {pq.ok ? 'Trả lời đúng' : 'Trả lời sai'}
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    function HistDetailModal({ h, dark, onClose }) {
      const [expandedQ, setExpandedQ] = useState(null);
      if (!h) return null;

      const pct = h.pct || 0;
      const pctRound = Math.round(pct);
      const scoreColor = pct >= 80 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444';
      const label = pct >= 80 ? '🌟 Xuất sắc' : pct >= 50 ? '⭐ Khá tốt' : '💪 Cần ôn thêm';

      const d = new Date(h.ts);
      const dateStr = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} `
        + `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const timeStr = formatTime(h.durationSec || h.timeTaken);

      const perQ = h.perQ || [];
      const nCorrect = perQ.filter(q => q.ok).length;
      const nPartial = perQ.filter(q => !q.ok && q.partial).length;
      const nWrong = perQ.filter(q => !q.ok && !q.partial).length;
      const hasPartial = nPartial > 0;

      // theme tokens
      const bg = dark ? 'linear-gradient(160deg,#1E0845,#120330)' : 'linear-gradient(160deg,#FFF5F9,#F0E6FF)';
      const bdr = dark ? 'rgba(255,150,200,0.2)' : '#F5D5E8';
      const titleC = dark ? '#F0DCE8' : '#3D1830';
      const subC = dark ? '#8A6080' : '#A07090';
      const cardBg = dark ? 'rgba(255,255,255,0.04)' : 'rgba(168,85,247,0.05)';
      const cardBorder = dark ? 'rgba(255,255,255,0.06)' : 'rgba(168,85,247,0.12)';

      const toggleQ = (pi) => setExpandedQ(prev => prev === pi ? null : pi);

      return (
        <div onClick={onClose} style={{
          position: 'fixed', inset: 0,
          background: 'rgba(10,2,25,0.82)', backdropFilter: 'blur(14px) saturate(140%)', WebkitBackdropFilter: 'blur(14px) saturate(140%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: 20        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: bg, border: `1.5px solid ${bdr}`,
            borderRadius: 28, padding: '22px 18px 22px',
            maxWidth: 360, width: '100%',
            boxShadow: dark ? '0 25px 60px rgba(0,0,0,0.4)' : '0 25px 60px rgba(120,60,180,0.22)',
            animation: 'pop .25s cubic-bezier(.22,1,.36,1) both',
            maxHeight: '88vh', overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: 0
          }}>

            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="#FF6B95" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              <span style={{ fontSize: 14, fontWeight: 900, color: titleC, flex: 1 }}>Chi tiết lần làm</span>
              <button onClick={onClose} style={{
                background: 'none', border: 'none',
                cursor: 'pointer', padding: 4, color: subC, lineHeight: 0,
                borderRadius: 999, transition: 'all .2s cubic-bezier(.22,1,.36,1)',
              }}
                onMouseEnter={e => { e.currentTarget.style.color = '#F472B6'; e.currentTarget.style.background = 'rgba(244,114,182,0.12)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = subC; e.currentTarget.style.background = 'none'; }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* ── Title + meta badges ── */}
            <div style={{ fontSize: 15, fontWeight: 900, color: titleC, marginBottom: 8, lineHeight: 1.35 }}>
              {h.lessonTitle}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {h.subject && (
                <span style={{
                  fontSize: 10, fontWeight: 800, color: '#FF6B95',
                  background: 'rgba(255,107,149,0.12)', padding: '2px 8px', borderRadius: 24
                }}>
                  {h.subject}
                </span>
              )}
              <span style={{ fontSize: 11, color: subC }}>🗓 {dateStr}</span>
              {timeStr && <span style={{ fontSize: 11, color: subC }}>⏱ {timeStr}</span>}
              <span style={{ fontSize: 11, color: subC }}>📝 {h.qCount || perQ.length || '—'} câu</span>
            </div>

            {/* ── Score card (ring + text) ── */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14,
              padding: '14px 16px',              background: `${scoreColor}12`,
              borderRadius: 22, border: `1.5px solid ${scoreColor}30`
            }}>
              <ScoreRing pct={pct} color={scoreColor} dark={dark} />
              <div>
                <div style={{ fontSize: 36, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>
                  {pctRound}%
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: scoreColor, marginTop: 3 }}>
                  {(() => {
                    const v = Number.isFinite(Number(h.diem10)) ? Number(h.diem10)
                      : (h.total > 0 ? Math.min(1, h.score / h.total) * 10 : 0);
                    return String(Math.round(v * 100) / 100);
                  })()} / 10 điểm
                </div>
                <div style={{ fontSize: 11, color: subC, marginTop: 5, fontWeight: 600 }}>{label}</div>
              </div>
            </div>

            {/* ── Stats pills ── */}
            {perQ.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                <StatPill count={nCorrect} label="Đúng" color="#10B981" />
                {hasPartial && <StatPill count={nPartial} label="Một phần" color="#F59E0B" />}
                <StatPill count={nWrong} label="Sai" color="#EF4444" />
              </div>
            )}

            {/* ── Per-question list ── */}
            {perQ.length > 0 && (
              <div>
                <div style={{
                  fontSize: 10, fontWeight: 900, color: subC,
                  marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase'
                }}>
                  Chi tiết từng câu
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {perQ.map((pq, pi) => (
                    <QuestionRow key={pi}
                      pq={pq} pi={pi} dark={dark}
                      subC={subC} cardBg={cardBg} cardBorder={cardBorder}
                      expanded={expandedQ === pi}
                      onToggle={toggleQ} />
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      );
    }
    /* ══ EXPORT GLOBALS ══ */
    window.HistDetailModal = HistDetailModal;
  } catch (e) {
    console.error('[hist-detail] INIT ERROR:', e);
  }
})();