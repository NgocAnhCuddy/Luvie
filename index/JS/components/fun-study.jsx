import React from 'react';

/* ══════════════════════════════════════════════════════════════════
   FUN-STUDY.JSX — 2 cách học thêm cho bài Trắc nghiệm / Đúng-Sai
   • "Học vui"     : từng câu 1 màn, phản hồi tức thì, combo + XP + pháo
                     hoa emoji, câu Đúng/Sai tách từng ý (a, b, c, d) và có
                     thể VUỐT phải = Đúng, trái = Sai. Câu sai được hỏi lại.
   • "Học cấp tốc" : (1) lướt nhanh đáp án đúng → (2) luyện bấm giờ, câu
                     sai/hết giờ lặp lại tới khi nhớ → (3) kết quả. Ưu tiên
                     câu bạn từng làm sai (lưu cục bộ theo học sinh + bài).
   Props: lesson, mode ('fun'|'express'), dark, student, onBack
══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  try {
    const { useState, useEffect, useMemo, useRef } = React;

    const shuffle = a => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
    const pick = a => a[Math.floor(Math.random() * a.length)];
    const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

    const GOOD = ['Chuẩn luôn! 🎉', 'Giỏi quá! ✨', 'Đúng rồi! 💖', 'Xuất sắc! 🌟'];
    const COMBO = { 3: 'Combo 3! Đang vào form 🔥', 5: 'Combo 5! Siêu đỉnh ⭐', 8: 'Combo 8! Không thể cản 🚀', 10: 'Combo 10! Huyền thoại 👑' };
    const BAD = ['Suýt đúng rồi, nhớ lần sau nhé 💪', 'Không sao, sai là để nhớ lâu 🌈', 'Cố lên, câu này sẽ quay lại 🍀'];
    const BURST = ['🎉', '⭐', '✨', '💖', '🌸', '🎈'];

    function buildItems(lesson) {
      const out = [];
      (lesson.questions || []).forEach((q, qi) => {
        if (q.type === 'multiple' && Array.isArray(q.options) && q.options.length > 1 && q.correct != null) {
          out.push({ id: String(qi), kind: 'mc', q: q.question, options: q.options, correct: [q.correct], explanation: q.explanation, image: q.image });
        } else if (q.type === 'multi_select' && Array.isArray(q.options) && (q.correct || []).length) {
          out.push({ id: String(qi), kind: 'ms', q: q.question, options: q.options, correct: q.correct, explanation: q.explanation, image: q.image });
        } else if (q.type === 'true_false' && Array.isArray(q.items)) {
          q.items.forEach((it, ii) => out.push({
            id: `${qi}.${ii}`, kind: 'tf', q: q.question, passage: q.passage, source: q.source, text: it.text,
            answer: !!it.answer, explanation: it.explanation || q.explanation, image: q.image, letter: String.fromCharCode(97 + ii),
          }));
        }
      });
      return out;
    }
    const answerHtml = it => it.kind === 'tf' ? (it.answer ? 'ĐÚNG' : 'SAI') : it.correct.map(i => `${LETTERS[i]}. ${it.options[i]}`).join('<br/>');

    /* lưu câu hay sai theo học sinh + bài */
    const wrongKey = (sid, lid) => `fs_wrong_${sid || 'anon'}_${lid}`;
    function loadWrong(sid, lid) { try { return new Set(JSON.parse(localStorage.getItem(wrongKey(sid, lid)) || '[]')); } catch (e) { return new Set(); } }
    function saveWrong(sid, lid, set) { try { localStorage.setItem(wrongKey(sid, lid), JSON.stringify([...set])); } catch (e) { /* bỏ qua */ } }

    function makePalette(dark) {
      return {
        text: dark ? '#F2EAFF' : '#2D1245', textMid: dark ? '#9B7FC0' : '#8060A0',
        surface: dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.94)',
        border: dark ? 'rgba(196,181,253,0.16)' : 'rgba(180,100,255,0.16)',
        shadow: dark ? '0 2px 16px rgba(0,0,0,0.35)' : '0 2px 16px rgba(168,85,247,0.1)',
        navBtn: dark ? 'rgba(255,150,200,0.07)' : 'rgba(255,107,149,0.06)',
        navBtnBorder: dark ? 'rgba(255,150,200,0.28)' : 'rgba(255,107,149,0.28)',
        navBtnText: dark ? '#FBAFCE' : '#E8547A',
      };
    }
    const grad = 'linear-gradient(135deg,#FF6B95,#A855F7)';
    const bigBtn = (extra) => ({
      padding: '13px 26px', borderRadius: 999, border: 'none', cursor: 'pointer', background: grad, color: '#fff',
      fontSize: 14, fontWeight: 900, fontFamily: "'Nunito',sans-serif", boxShadow: '0 4px 16px rgba(168,85,247,0.32)', ...extra,
    });
    const ghostBtn = (LC, extra) => ({
      padding: '13px 24px', borderRadius: 999, cursor: 'pointer', fontFamily: "'Nunito',sans-serif",
      background: LC.surface, color: LC.text, border: `1.5px solid ${LC.border}`, fontSize: 14, fontWeight: 800, ...extra,
    });

    function Html({ html, style, cls }) { return <div className={cls} style={style} dangerouslySetInnerHTML={{ __html: html || '' }} />; }
    function Img({ src }) { return src ? <img src={src} alt="" style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 18, margin: '0 auto 12px', display: 'block' }} /> : null; }

    function TopBar({ title, onBack, LC, right }) {
      return (
        <div style={{ padding: '11px 15px 10px', background: LC.surface, borderBottom: `1px solid ${LC.border}`, position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <button onClick={onBack} style={{ padding: '6px 14px', borderRadius: 999, border: `1.5px solid ${LC.navBtnBorder}`, background: LC.navBtn, color: LC.navBtnText, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>← Thoát</button>
          <div style={{ fontSize: 14, fontWeight: 900, color: LC.text, flex: 1, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
          <div style={{ minWidth: 70, textAlign: 'right' }}>{right}</div>
        </div>
      );
    }

    /* ───────────── 1 CÂU HỎI + PHẢN HỒI + COMBO ───────────── */
    function QuizRunner({ items, LC, mode, timePerQ, maxRetry, onFinish, onWrong }) {
      const [queue, setQueue] = useState(() => items.map(it => ({ it, tries: 0 })));
      const [pos, setPos] = useState(0);
      const [picked, setPicked] = useState(null);
      const [res, setRes] = useState(null);
      const [combo, setCombo] = useState(0);
      const [maxCombo, setMaxCombo] = useState(0);
      const [xp, setXp] = useState(0);
      const [firstOk, setFirstOk] = useState(0);
      const [missed, setMissed] = useState([]);
      const [burst, setBurst] = useState(0);
      const [msg, setMsg] = useState('');
      const [timeLeft, setTimeLeft] = useState(timePerQ);
      const [dx, setDx] = useState(0);
      const t0Ref = useRef(Date.now());
      const doneRef = useRef(false);
      const timeoutRef = useRef(null);
      const touchX = useRef(null);
      const cur = queue[pos];
      const express = mode === 'express';

      useEffect(() => {
        if (pos >= queue.length && !doneRef.current) {
          doneRef.current = true;
          onFinish({ total: items.length, firstOk, missed, maxCombo, xp, seconds: Math.round((Date.now() - t0Ref.current) / 1000) });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [pos]);

      function resolve(ok, timeout) {
        if (res || !cur) return;
        setRes({ ok, timeout });
        const first = cur.tries === 0;
        if (first) {
          if (ok) setFirstOk(n => n + 1); else setMissed(m => [...m, cur.it]);
          onWrong && onWrong(cur.it.id, !ok);
        }
        if (ok) {
          const c = combo + 1;
          setCombo(c); setMaxCombo(m => Math.max(m, c));
          setXp(x => x + (first ? 10 : 5) + Math.min(c, 10));
          setMsg(COMBO[c] || pick(GOOD));
          if (COMBO[c] || (c > 10 && c % 5 === 0)) setBurst(b => b + 1);
        } else {
          setCombo(0);
          setMsg(timeout ? 'Hết giờ rồi ⏰ Xem đáp án nhé' : pick(BAD));
          try { navigator.vibrate && navigator.vibrate(60); } catch (e) { /* bỏ qua */ }
          if (cur.tries < maxRetry) setQueue(q => [...q, { it: cur.it, tries: cur.tries + 1 }]);
        }
      }
      timeoutRef.current = () => resolve(false, true);

      function next() { setPos(p => p + 1); setPicked(null); setRes(null); setMsg(''); setDx(0); }

      const autoAdvance = !!res && res.ok && (express || !cur.it.explanation);
      useEffect(() => {
        if (!autoAdvance) return;
        const t = setTimeout(next, express ? 700 : 1100);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [autoAdvance, pos]);

      useEffect(() => {
        if (!timePerQ || res || !cur) return;
        setTimeLeft(timePerQ);
        const t0 = Date.now();
        const id = setInterval(() => {
          const left = timePerQ - (Date.now() - t0) / 1000;
          if (left <= 0) { clearInterval(id); setTimeLeft(0); timeoutRef.current && timeoutRef.current(); }
          else setTimeLeft(left);
        }, 100);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [pos, !!res, timePerQ]);

      if (!cur) return null;
      const it = cur.it;
      const progress = Math.round((pos / Math.max(queue.length, 1)) * 100);
      const typeLabel = it.kind === 'tf' ? 'Đúng / Sai' : it.kind === 'ms' ? 'Chọn nhiều đáp án' : 'Trắc nghiệm';

      function optState(i) {
        if (!res) return (it.kind === 'ms' ? (picked || []).includes(i) : picked === i) ? 'sel' : 'idle';
        if (it.correct.includes(i)) return 'correct';
        if (it.kind === 'ms' ? (picked || []).includes(i) : picked === i) return 'wrong';
        return 'dim';
      }
      const sty = {
        idle: { bg: LC.surface, bd: LC.border, fg: LC.text }, sel: { bg: 'rgba(168,85,247,0.14)', bd: '#A855F7', fg: LC.text },
        correct: { bg: 'rgba(16,185,129,0.14)', bd: '#10B981', fg: '#10B981' }, wrong: { bg: 'rgba(239,68,68,0.12)', bd: '#EF4444', fg: '#EF4444' },
        dim: { bg: LC.surface, bd: LC.border, fg: LC.textMid },
      };

      function onOption(i) {
        if (res) return;
        if (it.kind === 'mc') { setPicked(i); resolve(it.correct[0] === i, false); }
        else setPicked(p => (p || []).includes(i) ? p.filter(x => x !== i) : [...(p || []), i]);
      }
      function checkMs() {
        const a = [...(picked || [])].sort().join(','), b = [...it.correct].sort().join(',');
        resolve(a === b, false);
      }
      function answerTf(v) { if (res) return; setPicked(v); resolve(v === it.answer, false); }

      const swipeHandlers = it.kind === 'tf' && !res ? {
        onTouchStart: e => { touchX.current = e.touches[0].clientX; },
        onTouchMove: e => { if (touchX.current != null) setDx(e.touches[0].clientX - touchX.current); },
        onTouchEnd: () => { const d = dx; touchX.current = null; setDx(0); if (d > 90) answerTf(true); else if (d < -90) answerTf(false); },
      } : {};

      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 16px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: LC.textMid }}>Câu {Math.min(pos + 1, queue.length)}/{queue.length}{cur.tries > 0 ? ' · ôn lại' : ''}</span>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {combo >= 2 && <span style={{ fontSize: 12, fontWeight: 900, color: '#F97316', animation: 'fs-pop .3s ease both' }} key={combo}>🔥 x{combo}</span>}
                <span style={{ fontSize: 12, fontWeight: 900, color: '#F59E0B' }}>⭐ {xp}</span>
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 99, background: LC.border, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#FF6B95,#A855F7)', borderRadius: 99, transition: 'width .35s' }} />
            </div>
            {timePerQ > 0 && (
              <div style={{ height: 5, borderRadius: 99, background: LC.border, overflow: 'hidden', marginTop: 6 }}>
                <div style={{ height: '100%', width: `${(timeLeft / timePerQ) * 100}%`, background: timeLeft < 4 ? '#EF4444' : '#10B981', transition: 'width .1s linear' }} />
              </div>
            )}
          </div>

          <div key={pos} style={{ flex: 1, padding: '16px 16px 120px', overflowY: 'auto', animation: 'fs-pop .28s ease both' }}>
            <div style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 999, background: 'rgba(168,85,247,0.12)', color: '#A855F7', fontSize: 11, fontWeight: 900, marginBottom: 10 }}>{typeLabel}</div>

            {it.kind === 'tf' && it.passage && (
              <div style={{ background: LC.surface, border: `1.5px solid ${LC.border}`, borderRadius: 22, padding: '13px 15px', marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 900, color: '#B07CF0', letterSpacing: 1.2, marginBottom: 6 }}>ĐOẠN TƯ LIỆU</div>
                <Html cls="ls-passage-text" html={it.passage} style={{ fontStyle: 'italic', color: LC.textMid, lineHeight: 1.7 }} />
                {it.source && <div style={{ fontSize: 11, color: LC.textMid, fontWeight: 700, marginTop: 6 }}>{it.source}</div>}
              </div>
            )}
            <Img src={it.image} />

            {it.kind === 'tf' ? (
              <div {...swipeHandlers} style={{
                background: LC.surface, border: `2px solid ${res ? (res.ok ? '#10B981' : '#EF4444') : dx > 30 ? '#10B981' : dx < -30 ? '#EF4444' : LC.border}`,
                borderRadius: 22, padding: '20px 18px', boxShadow: LC.shadow, touchAction: 'pan-y',
                transform: `translateX(${dx * 0.5}px) rotate(${dx / 30}deg)`, transition: dx ? 'none' : 'transform .2s',
              }}>
                {it.q && <Html cls="ls-question-text" html={it.q} style={{ fontWeight: 700, color: LC.textMid, marginBottom: 10, lineHeight: 1.6 }} />}
                <div style={{ display: 'flex', gap: 10 }}>
                  <span style={{ minWidth: 26, height: 26, borderRadius: '50%', background: 'rgba(176,124,240,0.18)', color: '#B07CF0', fontSize: 12, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{it.letter.toUpperCase()}</span>
                  <Html cls="ls-tf-text" html={it.text} style={{ color: LC.text, fontWeight: 700, lineHeight: 1.7 }} />
                </div>
                {!res && <div style={{ textAlign: 'center', fontSize: 11, color: LC.textMid, fontWeight: 700, marginTop: 14 }}>👈 Vuốt trái = Sai · Vuốt phải = Đúng 👉</div>}
              </div>
            ) : (
              <div style={{ background: LC.surface, border: `1.5px solid ${LC.border}`, borderRadius: 24, padding: '16px 17px', boxShadow: LC.shadow, marginBottom: 12 }}>
                <Html cls="ls-question-text" html={it.q} style={{ fontWeight: 700, color: LC.text, lineHeight: 1.75 }} />
              </div>
            )}

            {it.kind === 'tf' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
                {[[true, '✓ Đúng', '#10B981'], [false, '✗ Sai', '#EF4444']].map(([v, label, col]) => {
                  const isPick = picked === v, isAns = res && it.answer === v;
                  return (
                    <button key={label} onClick={() => answerTf(v)} style={{
                      padding: '18px 0', borderRadius: 22, fontSize: 17, fontWeight: 900, cursor: res ? 'default' : 'pointer', fontFamily: "'Nunito',sans-serif",
                      border: `2px solid ${isAns ? '#10B981' : res && isPick ? '#EF4444' : col + '66'}`,
                      background: isAns ? 'rgba(16,185,129,0.2)' : res && isPick ? 'rgba(239,68,68,0.16)' : col + '14', color: col, opacity: res && !isAns && !isPick ? 0.45 : 1,
                    }}>{label}</button>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {it.options.map((opt, i) => {
                  const s = sty[optState(i)];
                  return (
                    <button key={i} onClick={() => onOption(i)} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', borderRadius: 20, textAlign: 'left', cursor: res ? 'default' : 'pointer',
                      border: `1.5px solid ${s.bd}`, background: s.bg, color: s.fg, fontSize: 15, fontWeight: 700, fontFamily: "'Nunito',sans-serif",
                      opacity: optState(i) === 'dim' ? 0.55 : 1, transition: 'all .15s',
                    }}>
                      <span style={{ width: 30, height: 30, borderRadius: it.kind === 'mc' ? '50%' : 9, flexShrink: 0, background: 'rgba(176,124,240,0.16)', color: '#B07CF0', fontSize: 12, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{LETTERS[i]}</span>
                      <span style={{ flex: 1 }} dangerouslySetInnerHTML={{ __html: opt }} />
                    </button>
                  );
                })}
                {it.kind === 'ms' && !res && (
                  <button onClick={checkMs} disabled={!(picked || []).length} style={{ ...bigBtn(), marginTop: 6, opacity: (picked || []).length ? 1 : 0.5 }}>Kiểm tra</button>
                )}
              </div>
            )}

            {res && (
              <div style={{ marginTop: 16, padding: '13px 15px', borderRadius: 20, animation: 'fs-pop .25s ease both', background: res.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)', border: `1.5px solid ${res.ok ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.35)'}` }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: res.ok ? '#10B981' : '#EF4444' }}>{msg}</div>
                {!res.ok && it.kind === 'tf' && <div style={{ fontSize: 13, fontWeight: 800, color: LC.text, marginTop: 6 }}>Đáp án: {it.answer ? 'ĐÚNG' : 'SAI'}</div>}
                {it.explanation && <Html html={'💡 ' + it.explanation} style={{ fontSize: 13, color: LC.text, lineHeight: 1.65, marginTop: 6 }} />}
                {!autoAdvance && (
                  <div style={{ marginTop: 12, textAlign: 'center' }}>
                    <button onClick={next} style={bigBtn()}>{pos >= queue.length - 1 ? 'Xem kết quả' : 'Tiếp tục →'}</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {burst > 0 && (
            <div key={burst} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 200, overflow: 'hidden' }}>
              {Array.from({ length: 16 }).map((_, k) => (
                <span key={k} style={{ position: 'absolute', left: `${8 + (k * 83) % 84}%`, top: '55%', fontSize: 22 + (k % 3) * 6, animation: `fs-burst ${1.1 + (k % 4) * 0.2}s ease-out ${(k % 5) * 0.05}s both`, '--dx': `${((k * 37) % 120) - 60}px` }}>{BURST[k % BURST.length]}</span>
              ))}
            </div>
          )}
        </div>
      );
    }

    function ResultScreen({ LC, result, mode, onRetry, onRetryMissed, onExit }) {
      const { total, firstOk, missed, maxCombo, xp, seconds } = result;
      const pct = total > 0 ? Math.round((firstOk * 100) / total) : 0;
      const stars = pct >= 90 ? 3 : pct >= 60 ? 2 : 1;
      const title = pct >= 90 ? 'Xuất sắc! 🏆' : pct >= 60 ? 'Khá lắm! 🎉' : 'Cố lên, sắp được rồi! 💪';
      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 18px 100px', textAlign: 'center', overflowY: 'auto' }}>
          <div style={{ fontSize: 44, letterSpacing: 6, animation: 'fs-pop .5s ease both' }}>{[0, 1, 2].map(i => <span key={i} style={{ opacity: i < stars ? 1 : 0.2 }}>⭐</span>)}</div>
          <div style={{ fontSize: 21, fontWeight: 900, color: LC.text, marginTop: 10 }}>{title}</div>
          <div style={{ fontSize: 14, color: LC.textMid, marginTop: 4 }}>Đúng ngay lần đầu {firstOk}/{total} ({pct}%)</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
            {[['🔥', 'Combo cao nhất', maxCombo], ['⭐', 'Điểm XP', xp], ...(mode === 'express' ? [['⏱️', 'Thời gian', `${Math.floor(seconds / 60)}p${String(seconds % 60).padStart(2, '0')}`]] : [])].map(([ic, lb, v]) => (
              <div key={lb} style={{ padding: '10px 16px', borderRadius: 20, background: LC.surface, border: `1.5px solid ${LC.border}`, minWidth: 92 }}>
                <div style={{ fontSize: 18 }}>{ic}</div><div style={{ fontSize: 17, fontWeight: 900, color: LC.text }}>{v}</div><div style={{ fontSize: 10.5, color: LC.textMid, fontWeight: 700 }}>{lb}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap', justifyContent: 'center' }}>
            {missed.length > 0 && <button style={bigBtn()} onClick={onRetryMissed}>Ôn {missed.length} câu sai</button>}
            <button style={missed.length ? ghostBtn(LC) : bigBtn()} onClick={onRetry}>Chơi lại</button>
            <button style={ghostBtn(LC)} onClick={onExit}>Về trang chủ</button>
          </div>
          {missed.length > 0 && (
            <div style={{ width: '100%', maxWidth: 480, marginTop: 24, textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: LC.text, marginBottom: 8 }}>Cần ôn lại ({missed.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {missed.map(it => (
                  <div key={it.id} style={{ padding: '11px 13px', borderRadius: 18, background: LC.surface, border: `1px solid ${LC.border}` }}>
                    <Html html={it.kind === 'tf' ? `<b>${it.letter.toUpperCase()}.</b> ${it.text}` : it.q} style={{ fontSize: 13, color: LC.text, lineHeight: 1.6, fontWeight: 600 }} />
                    <Html html={'✅ ' + answerHtml(it)} style={{ fontSize: 12.5, color: '#10B981', fontWeight: 800, marginTop: 5 }} />
                    {it.explanation && <Html html={'💡 ' + it.explanation} style={{ fontSize: 12, color: LC.textMid, marginTop: 4, lineHeight: 1.55 }} />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    /* ───────────── CHỌN SỐ LƯỢNG / LOẠI CÂU (dùng cho cả 2 chế độ) ───────────── */
    function Chips({ options, value, onChange, LC }) {
      return (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {options.map(([v, label]) => (
            <button key={String(v)} onClick={() => onChange(v)} style={{
              padding: '8px 15px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 800, fontFamily: "'Nunito',sans-serif",
              border: `1.5px solid ${value === v ? '#A855F7' : LC.border}`, background: value === v ? 'rgba(168,85,247,0.15)' : LC.surface, color: value === v ? '#A855F7' : LC.textMid,
            }}>{label}</button>
          ))}
        </div>
      );
    }
    const Label = ({ LC, children }) => <div style={{ fontSize: 12, fontWeight: 900, color: LC.text, margin: '16px 0 8px' }}>{children}</div>;

    function SetupScreen({ lesson, items, mode, hasWrong, LC, onStart }) {
      const nMc = items.filter(i => i.kind !== 'tf').length, nTf = items.filter(i => i.kind === 'tf').length;
      const [kind, setKind] = useState('all');
      const [count, setCount] = useState(mode === 'express' ? 10 : 0);
      const [timer, setTimer] = useState(mode === 'express' ? 15 : 0);
      const [readFirst, setReadFirst] = useState(true);
      const [wrongFirst, setWrongFirst] = useState(true);
      const express = mode === 'express';
      return (
        <div style={{ flex: 1, padding: '22px 18px 100px', overflowY: 'auto' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 54, animation: 'fs-float 2.4s ease-in-out infinite' }}>{express ? '⚡' : '🎮'}</div>
            <div style={{ fontSize: 21, fontWeight: 900, color: LC.text, fontFamily: "'Baloo 2',cursive" }}>{express ? 'Học cấp tốc' : 'Học vui'}</div>
            <div style={{ fontSize: 12.5, color: LC.textMid, marginTop: 4, lineHeight: 1.6 }}>
              {express ? 'Lướt đáp án → luyện bấm giờ → câu sai lặp lại tới khi nhớ. Hợp để ôn gấp trước giờ thi!' : 'Mỗi câu một màn, có combo, điểm XP và pháo hoa. Câu Đúng/Sai tách từng ý, vuốt để trả lời!'}
            </div>
            <div style={{ fontSize: 12, color: LC.textMid, marginTop: 8, fontWeight: 700 }}>{lesson.title} · {nMc} câu trắc nghiệm · {nTf} ý Đúng/Sai</div>
          </div>

          {nMc > 0 && nTf > 0 && (<><Label LC={LC}>Loại câu</Label>
            <Chips LC={LC} value={kind} onChange={setKind} options={[['all', 'Tất cả'], ['mc', 'Chỉ trắc nghiệm'], ['tf', 'Chỉ Đúng/Sai']]} /></>)}

          <Label LC={LC}>Số câu</Label>
          <Chips LC={LC} value={count} onChange={setCount} options={express ? [[10, '10 câu'], [20, '20 câu'], [0, 'Tất cả']] : [[0, 'Tất cả'], [10, '10 câu'], [20, '20 câu']]} />

          {express && (<>
            <Label LC={LC}>Thời gian mỗi câu</Label>
            <Chips LC={LC} value={timer} onChange={setTimer} options={[[10, '10 giây'], [15, '15 giây'], [30, '30 giây'], [0, 'Không giới hạn']]} />
            <Label LC={LC}>Tuỳ chọn</Label>
            <Chips LC={LC} value={readFirst} onChange={setReadFirst} options={[[true, '📖 Lướt đáp án trước'], [false, 'Vào luyện ngay']]} />
            {hasWrong && <div style={{ marginTop: 8 }}><Chips LC={LC} value={wrongFirst} onChange={setWrongFirst} options={[[true, '🎯 Ưu tiên câu từng sai'], [false, 'Ngẫu nhiên']]} /></div>}
          </>)}

          <div style={{ textAlign: 'center', marginTop: 28 }}>
            <button style={bigBtn({ padding: '15px 38px', fontSize: 15 })} onClick={() => onStart({ kind, count, timer, readFirst, wrongFirst: hasWrong && wrongFirst })}>
              {express ? 'Bắt đầu cấp tốc ⚡' : 'Bắt đầu chơi 🚀'}
            </button>
          </div>
        </div>
      );
    }

    /* ───────────── LƯỚT ĐÁP ÁN (cấp tốc, pha 1) ───────────── */
    function ReadPhase({ items, LC, onDone }) {
      const [i, setI] = useState(0);
      const it = items[i];
      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 16px 0' }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: LC.textMid, marginBottom: 6 }}>📖 Lướt đáp án · {i + 1}/{items.length}</div>
            <div style={{ height: 6, borderRadius: 99, background: LC.border, overflow: 'hidden' }}><div style={{ height: '100%', width: `${((i + 1) / items.length) * 100}%`, background: 'linear-gradient(90deg,#10B981,#38BDF8)', transition: 'width .25s' }} /></div>
          </div>
          <div key={i} style={{ flex: 1, padding: '16px 16px 120px', overflowY: 'auto', animation: 'fs-pop .25s ease both' }}>
            {it.kind === 'tf' && it.passage && <Html cls="ls-passage-text" html={it.passage} style={{ fontStyle: 'italic', color: LC.textMid, lineHeight: 1.7, marginBottom: 10, padding: '11px 13px', borderRadius: 18, background: LC.surface, border: `1px solid ${LC.border}` }} />}
            <Img src={it.image} />
            <div style={{ background: LC.surface, border: `1.5px solid ${LC.border}`, borderRadius: 24, padding: '16px 17px', boxShadow: LC.shadow }}>
              <Html cls="ls-question-text" html={it.kind === 'tf' ? `<b>${it.letter.toUpperCase()}.</b> ${it.text}` : it.q} style={{ fontWeight: 700, color: LC.text, lineHeight: 1.7 }} />
            </div>
            <div style={{ marginTop: 12, padding: '14px 16px', borderRadius: 20, background: 'rgba(16,185,129,0.1)', border: '1.5px solid rgba(16,185,129,0.4)' }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: '#10B981', letterSpacing: 1 }}>ĐÁP ÁN</div>
              <Html html={answerHtml(it)} style={{ fontSize: it.kind === 'tf' ? 20 : 15, fontWeight: 900, color: '#10B981', marginTop: 4, lineHeight: 1.6 }} />
            </div>
            {it.explanation && <Html html={'💡 ' + it.explanation} style={{ fontSize: 13, color: LC.text, lineHeight: 1.65, marginTop: 10 }} />}
          </div>
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: '12px 16px calc(14px + env(safe-area-inset-bottom,0px))', display: 'flex', gap: 10, justifyContent: 'center', background: LC.surface, backdropFilter: 'blur(16px)', borderTop: `1px solid ${LC.border}` }}>
            <button style={ghostBtn(LC)} disabled={i === 0} onClick={() => setI(i - 1)}>← Trước</button>
            {i < items.length - 1
              ? <button style={bigBtn()} onClick={() => setI(i + 1)}>Tiếp →</button>
              : <button style={bigBtn()} onClick={onDone}>Vào luyện nhanh ⚡</button>}
          </div>
        </div>
      );
    }

    /* ───────────── ROOT ───────────── */
    function FunStudy({ lesson, mode, dark, student, onBack }) {
      const LC = useMemo(() => makePalette(dark), [dark]);
      const express = mode === 'express';
      const allItems = useMemo(() => buildItems(lesson), [lesson]);
      const sid = student && student.id;
      const wrongRef = useRef(loadWrong(sid, lesson.id));
      const [phase, setPhase] = useState('setup'); // setup | read | play | result
      const [cfg, setCfg] = useState(null);
      const [session, setSession] = useState([]);
      const [runKey, setRunKey] = useState(0);
      const [result, setResult] = useState(null);

      function onWrong(id, isWrong) {
        if (isWrong) wrongRef.current.add(id); else wrongRef.current.delete(id);
        saveWrong(sid, lesson.id, wrongRef.current);
      }

      function start(c) {
        let pool = allItems.filter(i => c.kind === 'all' || (c.kind === 'tf' ? i.kind === 'tf' : i.kind !== 'tf'));
        let ordered;
        if (c.wrongFirst) {
          const w = shuffle(pool.filter(i => wrongRef.current.has(i.id))), r = shuffle(pool.filter(i => !wrongRef.current.has(i.id)));
          ordered = [...w, ...r];
        } else ordered = shuffle(pool);
        if (c.count > 0) ordered = ordered.slice(0, c.count);
        setCfg(c); setSession(ordered); setRunKey(k => k + 1);
        setPhase(express && c.readFirst ? 'read' : 'play');
      }

      function playAgain(items) { setSession(items); setRunKey(k => k + 1); setResult(null); setPhase('play'); }

      const title = express ? '⚡ Học cấp tốc' : '🎮 Học vui';
      const goBack = () => {
        if (phase === 'play' && !window.confirm('Thoát giữa chừng? Tiến độ lượt này sẽ không được lưu.')) return;
        onBack();
      };

      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
          <style>{`
            @keyframes fs-pop{0%{opacity:0;transform:scale(.94) translateY(8px)}100%{opacity:1;transform:scale(1) translateY(0)}}
            @keyframes fs-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
            @keyframes fs-burst{0%{opacity:1;transform:translate(0,0) scale(.6)}100%{opacity:0;transform:translate(var(--dx),-55vh) scale(1.3) rotate(40deg)}}
          `}</style>
          <TopBar title={title} onBack={goBack} LC={LC} />
          {allItems.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', color: LC.textMid, fontSize: 14, fontWeight: 700 }}>
              Bài này chưa có câu trắc nghiệm hoặc Đúng/Sai để học theo cách này. Hãy thử làm bài chuẩn nhé!
            </div>
          ) : phase === 'setup' ? (
            <SetupScreen lesson={lesson} items={allItems} mode={mode} hasWrong={allItems.some(i => wrongRef.current.has(i.id))} LC={LC} onStart={start} />
          ) : phase === 'read' ? (
            <ReadPhase items={session} LC={LC} onDone={() => setPhase('play')} />
          ) : phase === 'play' ? (
            <QuizRunner key={runKey} items={session} LC={LC} mode={mode}
              timePerQ={express ? cfg.timer : 0} maxRetry={express ? 3 : 1}
              onWrong={onWrong} onFinish={r => { setResult(r); setPhase('result'); }} />
          ) : (
            <ResultScreen LC={LC} result={result} mode={mode}
              onRetry={() => setPhase('setup')}
              onRetryMissed={() => playAgain(shuffle(result.missed))}
              onExit={onBack} />
          )}
        </div>
      );
    }

    window.FunStudy = FunStudy;
  } catch (e) {
    console.error('[fun-study] INIT ERROR:', e);
  }
})();
