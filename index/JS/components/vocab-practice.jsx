import React from 'react';

/* ══════════════════════════════════════════════════════════════════
   VOCAB-PRACTICE.JSX
   ★ CẬP NHẬT: thẻ lật flashcard giờ xoay 3D THẬT (rotateY + perspective),
   khớp FlashcardFace.kt bên app. Thêm hẳn luồng "Động từ bất quy tắc"
   (irregular_verb_sets/irregular_verbs) — 4 chế độ Flashcard/Trắc
   nghiệm/Điền từ/Ghép cặp, công tắc "Ẩn nghĩa khi Điền từ", lưu điểm
   cao nhất cục bộ theo bộ (localStorage, khớp SharedPreferences app).

   ★ MỚI: mỗi Unit có màn chọn cách học — Flashcard, Trắc nghiệm (Anh→Việt / Việt→Anh),
   Nghe & chọn, Gõ từ (có gợi ý), Ghép cặp; kết quả liệt kê từ cần ôn lại.

   Props: dark, student, onBack
══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  try {
    const { useState, useEffect, useMemo, useRef, useCallback } = React;

    const POS_LABELS = {
      noun: 'Danh từ (n)', n: 'Danh từ (n)',
      verb: 'Động từ (v)', v: 'Động từ (v)',
      adjective: 'Tính từ (adj)', adj: 'Tính từ (adj)',
      adverb: 'Trạng từ (adv)', adv: 'Trạng từ (adv)',
      preposition: 'Giới từ (prep)', prep: 'Giới từ (prep)',
      conjunction: 'Liên từ (conj)', conj: 'Liên từ (conj)',
      pronoun: 'Đại từ (pron)', pron: 'Đại từ (pron)',
      interjection: 'Thán từ (intj)', intj: 'Thán từ (intj)',
      phrase: 'Cụm từ',
      'phrasal verb': 'Cụm động từ (phr V)', 'phrasal_verb': 'Cụm động từ (phr V)',
      'phr v': 'Cụm động từ (phr V)', 'phr.v': 'Cụm động từ (phr V)', 'phr_v': 'Cụm động từ (phr V)', phrv: 'Cụm động từ (phr V)',
    };
    const getPosLabel = pos => {
      const k = String(pos || '').trim().toLowerCase();
      return POS_LABELS[k] || pos || 'Từ vựng';
    };
    // Thứ tự hiển thị ô Word Form: N → V → phr V → Adj → Adv → còn lại
    const POS_ORDER = ['n', 'noun', 'v', 'verb', 'phr v', 'phr.v', 'phr_v', 'phrv', 'phrasal verb', 'phrasal_verb', 'adj', 'adjective', 'adv', 'adverb'];
    const posRank = pos => {
      const i = POS_ORDER.indexOf(String(pos || '').trim().toLowerCase());
      return i === -1 ? 99 : (i < 2 ? 0 : i < 4 ? 1 : i < 10 ? 2 : i < 12 ? 3 : 4);
    };

    function levenshtein(a, b) {
      if (!a || !b) return Math.max((a || '').length, (b || '').length);
      const m = a.length, n = b.length;
      const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i ? (j ? 0 : i) : j)));
      for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
          dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      return dp[m][n];
    }

    function speak(word, rate = 1) {
      try {
        if (!word) return;
        const synth = window.speechSynthesis;
        if (!synth) {
          if (window.showToast) window.showToast('Trình duyệt này không hỗ trợ đọc từ vựng, thử dùng Chrome nhé!', 'warn');
          return;
        }
        synth.cancel();
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US';
        utterance.rate = rate;
        utterance.onerror = (ev) => {
          if (ev.error !== 'canceled' && ev.error !== 'interrupted' && window.showToast) {
            window.showToast('Không phát được âm thanh, thử dùng Chrome nhé!', 'warn');
          }
        };
        const voices = synth.getVoices();
        if (voices.length === 0) {
          synth.onvoiceschanged = () => { synth.speak(utterance); };
        }
        synth.speak(utterance);
      } catch (e) {
        if (window.showToast) window.showToast('Không phát được âm thanh, thử dùng Chrome nhé!', 'warn');
      }
    }

    /* ─────────────────────── ICONS ─────────────────────── */
    const IconBook = ({ size = 16, color }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    );
    const IconTrophy = ({ size = 44, color = '#f59e0b' }) => (
      <svg width={size} height={size} viewBox="0 0 20 20" fill={color} stroke="none"><polygon points="10,2 12.5,7.5 18,8.2 14,12.1 15.1,17.5 10,14.8 4.9,17.5 6,12.1 2,8.2 7.5,7.5" /></svg>
    );
    const IconCheck = ({ size = 16, color = '#10B981' }) => (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 10 8 14 16 6" /></svg>
    );
    const IconClose = ({ size = 15, color = '#EF4444' }) => (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="5" x2="15" y2="15" /><line x1="15" y1="5" x2="5" y2="15" /></svg>
    );
    const IconSpeaker = ({ size = 18, waves = 2, color }) => (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color || 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.5 7.2v5.6h3l4.3 3.6V3.6L5.5 7.2h-3z" fill={color || 'currentColor'} stroke="none" />
        {waves >= 1 && <path d="M12.3 7c.9.75 1.4 1.83 1.4 3s-.5 2.25-1.4 3" />}
        {waves >= 2 && <path d="M14.7 4.7c1.7 1.4 2.65 3.4 2.65 5.3s-.95 3.9-2.65 5.3" />}
      </svg>
    );
    const IconShuffle = ({ size = 19, color }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" /><polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" /><line x1="4" y1="4" x2="9" y2="9" />
      </svg>
    );
    const IconRefresh = ({ size = 12, color }) => (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color || 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3.5A7.5 7.5 0 1 0 17.5 10" /><path d="M17.5 3.5v4h-4" /></svg>
    );
    const IconWifiOff = ({ size = 14, color = '#B45309' }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23" /><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" /><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" /><path d="M10.71 5.05A16 16 0 0 1 22.58 9" /><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" /><path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><line x1="12" y1="20" x2="12.01" y2="20" /></svg>
    );

    function SkeletonCard({ LC }) {
      return (
        <div style={{ height: 64, borderRadius: 22, background: LC.surfaceQ, border: `1.5px solid ${LC.borderQ}`, opacity: 0.55 }} />
      );
    }

    function btnPrimaryStyle() {
      return {
        padding: '12px 26px', borderRadius: 999, border: 'none', cursor: 'pointer',
        background: 'linear-gradient(135deg,#FF6B95,#A855F7)', color: '#fff',
        fontSize: 14, fontWeight: 900, fontFamily: "'Nunito',sans-serif",
        boxShadow: '0 4px 16px rgba(168,85,247,0.32)', display: 'inline-flex', alignItems: 'center', gap: 7,
      };
    }
    function btnGhostStyle(LC, over) {
      return {
        padding: '12px 26px', borderRadius: 999, cursor: 'pointer', fontFamily: "'Nunito',sans-serif",
        background: over?.bg || LC.navBtn, color: over?.fg || LC.navBtnText, border: `1.5px solid ${over?.border || LC.navBtnBorder}`,
        fontSize: 14, fontWeight: 800,
      };
    }

    /* ═══════════════════════════════════════════════════════
       MÀN HÌNH HỌC TỪ (flashcard 3D thật + kiểm tra viết)
       ═══════════════════════════════════════════════════════ */
    /* ═══════════════════════════════════════════════════════
       Tab con: Từ vựng thường / Gia đình từ — khớp
       VocabUnitSubTabBar bên Android app.
       ═══════════════════════════════════════════════════════ */
    function VocabUnitSubTabBar({ selected, LC, onSelect }) {
      const tabs = [
        ['words', 'Từ vựng thường'],
        ['families', 'Gia đình từ'],
      ];
      return (
        <div style={{ padding: '10px 15px 0' }}>
          <div style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 18, background: LC.border }}>
            {tabs.map(([key, label]) => (
              <button key={key} onClick={() => onSelect(key)} style={{
                flex: 1, padding: '9px 0', borderRadius: 11, border: 'none', cursor: 'pointer',
                background: selected === key ? 'linear-gradient(135deg,#FF6B95,#A855F7)' : 'transparent',
                color: selected === key ? '#fff' : LC.textMid,
                fontSize: 12.5, fontWeight: 900, fontFamily: "'Nunito',sans-serif", transition: 'all .15s',
              }}>{label}</button>
            ))}
          </div>
        </div>
      );
    }

    /* ═══════════════════════════════════════════════════════
       GIA ĐÌNH TỪ (xem) — 1 base_word + danh sách form bên
       trong, có nút phát âm cho từng form. Không phải chế độ
       học chủ động (không có flashcard/writing test), chỉ để
       tra cứu — khớp WordFamilyListView bên Android app.
       ═══════════════════════════════════════════════════════ */
    function WordFamilyListView({ unit, LC, dark, onSpeak }) {
      const families = unit.wordFamilies || [];
      return (
        <div style={{ flex: 1, padding: '14px 15px 100px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {families.map((family, idx) => (
            <WordFamilyCard key={family.id} family={family} LC={LC} dark={dark} staggerIndex={idx} onSpeak={onSpeak} />
          ))}
        </div>
      );
    }

    function WordFamilyCard({ family, LC, dark, staggerIndex, onSpeak }) {
      return (
        <div style={{
          padding: '14px 16px', borderRadius: 22, border: `1.5px solid ${LC.borderQ}`,
          background: LC.surfaceQ, boxShadow: LC.cardShadow,
          animation: `fadeUp .22s ease ${Math.min(staggerIndex * 0.04, 0.3)}s both`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: family.meaning ? 4 : 10 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: LC.text, fontFamily: "'Baloo 2',cursive", flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {family.base_word}
            </div>
            <button onClick={() => onSpeak(family.base_word, 1)} style={{
              width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0,
              background: 'linear-gradient(135deg,#FF6B95,#A855F7)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IconSpeaker size={13} color="#fff" />
            </button>
          </div>
          {family.meaning && (
            <div style={{ fontSize: 12.5, color: LC.textMid, marginBottom: 10 }}>{family.meaning}</div>
          )}
          {(family.forms || []).length === 0 ? (
            <div style={{ fontSize: 12, color: LC.textMid }}>Chưa có form nào cho từ này.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {family.forms.map(form => (
                <WordFormRowStudent key={form.id} form={form} LC={LC} dark={dark} onSpeak={onSpeak} />
              ))}
            </div>
          )}
        </div>
      );
    }

    function WordFormRowStudent({ form, LC, dark, onSpeak }) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
          borderRadius: 12, background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(168,85,247,0.05)',
          border: `1px solid ${LC.border}`,
        }}>
          <button onClick={() => onSpeak(form.form, 1)} style={{
            width: 24, height: 24, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0,
            background: 'transparent', color: LC.textMid, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <IconSpeaker size={11} color={LC.textMid} />
          </button>
          <span style={{ fontSize: 13.5, fontWeight: 800, color: LC.text }}>{form.form}</span>
          <span style={{ fontSize: 11, color: '#B07CF0' }}>({getPosLabel(form.pos)})</span>
          {form.ipa && <span style={{ fontSize: 11.5, color: LC.textMid, fontStyle: 'italic' }}>/{form.ipa.replace(/^\/|\/$/g, '')}/</span>}
          {form.meaning && (
            <span style={{ fontSize: 12, color: LC.textMid, marginLeft: 'auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {form.meaning}
            </span>
          )}
        </div>
      );
    }

    function LearningView({ unit, LC, dark, onExit, onProgressSaved }) {
      const allVocab = unit.vocab || [];
      const [learnedIdx, setLearnedIdx] = useState([]);
      const [unlearned, setUnlearned] = useState(() => allVocab.map((_, i) => i));
      const [cursor, setCursor] = useState(0);
      const [isWriting, setIsWriting] = useState(false);
      const [inputVal, setInputVal] = useState('');
      const [feedback, setFeedback] = useState(null);
      const [done, setDone] = useState(false);
      const [savedOnce, setSavedOnce] = useState(false);
      const inputRef = useRef(null);

      const total = allVocab.length;
      const progressPct = total > 0 ? Math.round((learnedIdx.length / total) * 100) : 0;
      const currentVocabIdx = unlearned[cursor];
      const vocab = currentVocabIdx !== undefined ? allVocab[currentVocabIdx] : null;

      useEffect(() => {
        if (unlearned.length === 0 && learnedIdx.length === total && total > 0) {
          setDone(true);
        }
      }, [unlearned, learnedIdx, total]);

      useEffect(() => {
        if (isWriting) setTimeout(() => inputRef.current?.focus(), 80);
      }, [isWriting, cursor]);

      useEffect(() => {
        if (done && !savedOnce) {
          setSavedOnce(true);
          onProgressSaved && onProgressSaved(unit, learnedIdx.length);
        }
      }, [done, savedOnce, unit, learnedIdx.length, onProgressSaved]);

      function startWritingTest() { setIsWriting(true); setFeedback(null); setInputVal(''); }

      function checkWriting() {
        if (!vocab) return;
        const userAnswer = inputVal.trim().toLowerCase();
        const correctAnswer = (vocab.word || '').trim().toLowerCase();
        const ok = userAnswer === correctAnswer || levenshtein(userAnswer, correctAnswer) <= 1;
        const exact = userAnswer === correctAnswer;
        setFeedback({ ok, exact, correctWord: vocab.word });

        if (ok) {
          setLearnedIdx(prev => [...prev, currentVocabIdx]);
          const nextUnlearned = unlearned.filter((_, i) => i !== cursor);
          setTimeout(() => {
            setUnlearned(nextUnlearned);
            setCursor(prev => nextUnlearned.length > 0 ? prev % nextUnlearned.length : 0);
            setIsWriting(false);
            setFeedback(null);
            setInputVal('');
          }, 1500);
        } else {
          setTimeout(() => { setIsWriting(false); setFeedback(null); setInputVal(''); }, 2000);
        }
      }

      function skip() {
        if (unlearned.length === 0) return;
        setCursor(prev => (prev + 1) % unlearned.length);
        setIsWriting(false); setFeedback(null);
      }

      function restart() {
        setLearnedIdx([]);
        setUnlearned(allVocab.map((_, i) => i));
        setCursor(0);
        setIsWriting(false); setFeedback(null); setDone(false); setSavedOnce(false);
      }

      const btnPrimary = btnPrimaryStyle();
      const btnGhost = btnGhostStyle(LC);

      if (total === 0) {
        return (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: LC.textMid }}>
            Unit này chưa có từ vựng nào.
          </div>
        );
      }

      if (done) {
        return (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', textAlign: 'center', gap: 6 }}>
            <div style={{ animation: 'vp-float 2s ease-in-out infinite', marginBottom: 8 }}><IconTrophy size={80} /></div>
            <div style={{ fontSize: 24, fontWeight: 900, color: LC.text }}>Hoàn thành!</div>
            <div style={{ fontSize: 14, color: LC.text2, fontWeight: 600, marginBottom: 20 }}>
              Bạn đã học xong tất cả {total} từ vựng trong bài này!
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button style={btnPrimary} onClick={restart}>
                <IconRefresh size={14} color="#fff" />
                Học lại
              </button>
              <button style={btnGhost} onClick={onExit}>← Bài khác</button>
            </div>
          </div>
        );
      }

      if (!vocab) {
        return (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
            <div style={{ animation: 'vp-float 2s ease-in-out infinite' }}><IconTrophy size={64} /></div>
          </div>
        );
      }

      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 16px 0' }}>
            <div style={{ height: 8, borderRadius: 99, background: LC.border, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progressPct}%`, background: 'linear-gradient(90deg,#10B981,#38BDF8)', borderRadius: 99, transition: 'width .4s' }} />
            </div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: LC.textMid, marginTop: 6, textAlign: 'center' }}>
              {learnedIdx.length} / {total} từ đã học
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 20px 30px' }}>
            {!isWriting ? (
              <FlipFlashcard key={currentVocabIdx} vocab={vocab} LC={LC} dark={dark} onStartWriting={startWritingTest} onSkip={skip} />
            ) : (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                width: '100%', maxWidth: 480, padding: '32px 24px',
                background: dark ? 'rgba(30,13,21,0.6)' : '#fff',
                border: `1.5px solid ${LC.border}`, borderRadius: 28,
                boxShadow: dark ? '0 10px 34px rgba(0,0,0,.28)' : '0 10px 34px rgba(168,85,247,0.12)',
                animation: 'vp-pop .3s cubic-bezier(.34,1.56,.64,1) both',
              }}>
                {vocab.ipa && <div style={{ fontSize: 18, color: LC.textMid, fontStyle: 'italic', marginBottom: 22 }}>/{vocab.ipa.replace(/^\/|\/$/g, '')}/</div>}
                <button onClick={() => speak(vocab.word, 1)} style={{
                  width: 46, height: 46, borderRadius: '50%', border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg,#FF6B95,#A855F7)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22,
                  boxShadow: '0 4px 14px rgba(155,114,239,0.3)', transition: 'transform .15s ease',
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}>
                  <IconSpeaker size={16} color="#fff" />
                </button>
                <input ref={inputRef} type="text" value={inputVal}
                  onChange={e => setInputVal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') checkWriting(); }}
                  placeholder="Viết từ bạn vừa nghe..." autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false" data-lpignore="true"
                  style={{ width: '100%', maxWidth: 380, padding: '13px 16px', borderRadius: 18, border: `2px solid ${feedback ? (feedback.ok ? '#10B981' : '#EF4444') : LC.inputBorder}`, fontSize: 17, textAlign: 'center', fontFamily: 'inherit', color: LC.inputColor, background: LC.inputBg, outline: 'none', marginBottom: 18 }} />
                {feedback && (
                  <div style={{
                    fontSize: 14.5, fontWeight: 800, padding: '11px 18px', borderRadius: 12, marginBottom: 16,
                    color: feedback.ok ? '#10B981' : '#EF4444',
                    background: feedback.ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.08)',
                    border: `1.5px solid ${feedback.ok ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
                  }}>
                    {feedback.ok
                      ? `${feedback.exact ? 'Chính xác!' : 'Gần đúng!'} "${feedback.correctWord}"`
                      : `Sai! Đáp án đúng: "${feedback.correctWord}"`}
                  </div>
                )}
                <button style={btnPrimary} onClick={checkWriting}>
                  <IconCheck size={14} color="#fff" /> Kiểm tra
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    /* ═══════════════════════════════════════════════════════
       FlipFlashcard — thẻ lật 3D THẬT (rotateY + perspective)
       ═══════════════════════════════════════════════════════ */
    function FlipFlashcard({ vocab, LC, dark, onStartWriting, onSkip }) {
      const [flipped, setFlipped] = useState(false);

      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 480, animation: 'vp-pop .3s cubic-bezier(.34,1.56,.64,1) both' }}>
          <div onClick={() => setFlipped(f => !f)} style={{ width: '100%', minHeight: 280, cursor: 'pointer', perspective: 1400 }}>
            <div style={{
              position: 'relative', width: '100%', minHeight: 280, transformStyle: 'preserve-3d',
              transition: 'transform .42s cubic-bezier(.25,.46,.45,.94)',
              transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}>
              <div style={{
                position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                padding: '32px 24px', boxSizing: 'border-box',
                background: dark ? 'rgba(30,13,21,0.6)' : '#fff',
                border: `1.5px solid ${LC.border}`, borderRadius: 28,
                boxShadow: dark ? '0 10px 34px rgba(0,0,0,.28)' : '0 10px 34px rgba(168,85,247,0.12)',
              }}>
                <div style={{ fontSize: 44, fontWeight: 900, color: '#E8547A', marginBottom: 10 }}>{vocab.word}</div>
                <div style={{ display: 'inline-block', background: '#FEF3C7', color: '#78350f', padding: '5px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 800, marginBottom: 12 }}>
                  {getPosLabel(vocab.pos)}
                </div>
                {vocab.ipa && <div style={{ fontSize: 18, color: LC.textMid, fontStyle: 'italic', marginBottom: 20 }}>/{vocab.ipa.replace(/^\/|\/$/g, '')}/</div>}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4, marginBottom: 20,
                  padding: 6, borderRadius: 999,
                  background: dark ? 'rgba(196,181,253,0.08)' : 'rgba(168,85,247,0.07)',
                  border: `1.5px solid ${dark ? 'rgba(196,181,253,0.18)' : 'rgba(168,85,247,0.16)'}`,
                }}>
                  {[{ rate: 0.6, label: '0.5x', waves: 1 }, { rate: 1, label: '1x', waves: 2 }, { rate: 1.4, label: '2x', waves: 2 }].map(({ rate, label, waves }) => (
                    <button key={rate} onClick={e => { e.stopPropagation(); speak(vocab.word, rate); }}
                      title={rate < 1 ? 'Nghe chậm' : rate > 1 ? 'Nghe nhanh' : 'Nghe bình thường'}
                      style={{ width: 58, height: 46, borderRadius: 999, border: 'none', background: 'linear-gradient(135deg,#FF6B95,#A855F7)', color: '#fff', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, boxShadow: '0 4px 14px rgba(155,114,239,0.3)', transition: 'transform .15s ease, box-shadow .15s ease' }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px) scale(1.05)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(155,114,239,0.42)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(155,114,239,0.3)'; }}>
                      <IconSpeaker size={15} waves={waves} color="#fff" />
                      <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.2px', opacity: 0.92 }}>{label}</span>
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: LC.textMid, fontWeight: 700 }}>
                  <IconRefresh size={12} color={LC.textMid} /> Chạm để lật thẻ
                </div>
              </div>

              <div style={{
                position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                padding: '32px 24px', boxSizing: 'border-box',
                background: dark ? 'rgba(30,13,21,0.6)' : '#fff',
                border: `1.5px solid ${LC.border}`, borderRadius: 28,
                boxShadow: dark ? '0 10px 34px rgba(0,0,0,.28)' : '0 10px 34px rgba(168,85,247,0.12)',
              }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: LC.textMid, marginBottom: 14 }}>{vocab.word}</div>
                {vocab.meaning && <div style={{ fontSize: 18, fontWeight: 700, color: LC.text, marginBottom: 14, lineHeight: 1.6 }}>{vocab.meaning}</div>}
                {vocab.example && (
                  <div style={{ fontSize: 13.5, color: LC.text2, fontStyle: 'italic', padding: 14, width: '100%', boxSizing: 'border-box', background: dark ? 'rgba(196,181,253,0.08)' : 'rgba(168,85,247,0.06)', borderRadius: 18, marginBottom: 16 }}>
                    "{vocab.example}"
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: LC.textMid, fontWeight: 700 }}>
                  <IconRefresh size={12} color={LC.textMid} /> Chạm để lật lại
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button style={btnPrimaryStyle()} onClick={onStartWriting}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
              Kiểm tra viết từ
            </button>
            <button style={btnGhostStyle(LC, { bg: '#FEF3C7', fg: '#92400E', border: '#FDE68A' })} onClick={onSkip}>→ Bỏ qua</button>
          </div>
        </div>
      );
    }

    /* ═══════════════════════════════════════════════════════
       MÀN HÌNH CHỌN UNIT (trong 1 khóa học)
       ═══════════════════════════════════════════════════════ */
    function UnitPicker({ course, LC, dark, onPickUnit, onBack, masteryOf }) {
      const units = course.units || [];
      return (
        <div style={{ flex: 1, padding: '16px 14px 100px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {units.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: LC.textMid, fontSize: 13, fontWeight: 700, borderRadius: 20, border: `1.5px solid ${LC.borderQ}` }}>
              Chưa có bài học nào trong khóa học này.
            </div>
          ) : units.map((u, uIdx) => {
            const total = u.vocab ? u.vocab.length : 0;
            const mastered = masteryOf(u.id, total);
            const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;
            return (
              <button key={u.id || uIdx} onClick={() => onPickUnit(u)}
                style={{
                  textAlign: 'left', padding: '14px 16px', borderRadius: 22,
                  border: `1.5px solid ${LC.borderQ}`, background: LC.surfaceQ, boxShadow: LC.cardShadow,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                  transition: 'transform .18s ease, box-shadow .18s ease',
                  animation: `fadeUp .22s ease ${Math.min(uIdx * 0.04, 0.3)}s both`,
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 22px rgba(168,85,247,0.16)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = LC.cardShadow; }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, background: 'rgba(176,124,240,0.18)', color: '#B07CF0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconBook size={17} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: LC.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.title}</div>
                  <div style={{ fontSize: 11.5, color: LC.textMid, marginTop: 2, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                    {u.level && <span>Level {u.level} · </span>}
                    <IconBook size={11} /> {total} từ
                    {(u.wordFamilies || []).length > 0 && <span>· {u.wordFamilies.length} gia đình từ</span>}
                    {pct > 0 && <span style={{ color: '#10B981', fontWeight: 800 }}>· {pct}%</span>}
                  </div>
                  {total > 0 && (
                    <div style={{ marginTop: 5, height: 4, background: LC.border, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#10B981,#38BDF8)', borderRadius: 4 }} />
                    </div>
                  )}
                </div>
                <div style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 800, color: pct === 100 ? '#10B981' : '#B07CF0' }}>
                  {pct === 100 ? <IconCheck size={17} /> : 'Học ngay →'}
                </div>
              </button>
            );
          })}
        </div>
      );
    }

    /* ══════════════════════════════════════════════════════════════════
       ĐỘNG TỪ BẤT QUY TẮC
       ══════════════════════════════════════════════════════════════════ */
    function shuffleArr(arr) { return [...arr].sort(() => Math.random() - 0.5); }

    function IvProgressBar({ current, total, LC, color = '#34D399' }) {
      const pct = total > 0 ? Math.min(Math.max(current / total, 0), 1) * 100 : 0;
      return (
        <div style={{ padding: '6px 14px' }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: LC.textMid, marginBottom: 5 }}>Câu {Math.min(current, total)}/{total}</div>
          <div style={{ height: 6, borderRadius: 4, background: LC.border, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width .3s' }} />
          </div>
        </div>
      );
    }

    function IvBigButton({ text, onClick, icon }) {
      return (
        <button onClick={onClick} style={{
          padding: '14px 22px', borderRadius: 999, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg,#FF6B95,#A855F7)', color: '#fff',
          fontSize: 13.5, fontWeight: 900, fontFamily: "'Nunito',sans-serif",
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          {icon}{text}
        </button>
      );
    }

    function IvHeader({ title, onBack, LC, icon }) {
      return (
        <div style={{ padding: '11px 15px 10px', background: LC.surfaceQ, borderBottom: `1px solid ${LC.border}`, position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(20px)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={onBack} style={{ padding: '6px 14px', borderRadius: 999, border: `1.5px solid ${LC.navBtnBorder}`, background: LC.navBtn, color: LC.navBtnText, fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              Quay lại
            </button>
            <div style={{ fontSize: 14, fontWeight: 900, color: LC.text, display: 'flex', alignItems: 'center', gap: 6 }}>
              {icon || <IconShuffle size={15} color={LC.text} />} {title}
            </div>
            <div style={{ width: 70 }} />
          </div>
        </div>
      );
    }

    function IrregularVerbEntryCard({ LC, dark, onClick }) {
      return (
        <button onClick={onClick} style={{
          textAlign: 'left', padding: '12px 14px', borderRadius: 22, width: '100%', boxSizing: 'border-box',
          border: '1.5px solid rgba(52,211,153,0.35)',
          background: 'linear-gradient(135deg,rgba(52,211,153,0.14),rgba(56,189,248,0.14))',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
          transition: 'transform .18s ease, box-shadow .18s ease',
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 22px rgba(52,211,153,0.2)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
          <div style={{ width: 42, height: 42, borderRadius: 18, flexShrink: 0, background: 'linear-gradient(135deg,#34D399,#38BDF8)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 12px rgba(52,211,153,0.32)' }}>
            <IconShuffle size={19} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: LC.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Động từ bất quy tắc</div>
            <div style={{ fontSize: 11.5, color: LC.textMid, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Flashcard · Trắc nghiệm · Điền từ · Ghép cặp
            </div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={LC.textMid} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      );
    }

    function IvSetListScreen({ loading, loadError, isOffline, sets, LC, dark, bestScorePct, onOpenSet }) {
      return (
        <div style={{ flex: 1, padding: '16px 14px 100px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {isOffline && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 18, background: 'rgba(245,158,11,0.1)', border: '1.5px solid rgba(245,158,11,0.25)' }}>
              <IconWifiOff size={14} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#B45309' }}>Không có mạng — đang xem bộ động từ đã lưu offline</span>
            </div>
          )}
          {loadError && (
            <div style={{ padding: '12px 14px', borderRadius: 18, background: 'rgba(239,68,68,0.08)', border: '1.5px solid rgba(239,68,68,0.25)', color: '#EF4444', fontSize: 12.5, fontWeight: 700 }}>
              Không tải được danh sách bộ động từ. Thử lại sau nhé!
            </div>
          )}
          {loading ? (
            <><SkeletonCard LC={LC} /><SkeletonCard LC={LC} /><SkeletonCard LC={LC} /></>
          ) : sets.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '34vh', gap: 12, padding: '32px 20px', textAlign: 'center', borderRadius: 22, border: `1.5px solid ${LC.borderQ}` }}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: '50%', background: dark ? 'rgba(52,211,153,0.1)' : 'rgba(52,211,153,0.08)', color: '#34D399', animation: 'bb-float 3s ease-in-out infinite' }}><IconShuffle size={28} color="#34D399" /></span>
              <div style={{ fontSize: 14.5, fontWeight: 900, color: LC.text, fontFamily: "'Baloo 2',cursive" }}>Chưa có bộ động từ nào</div>
              <div style={{ fontSize: 12.5, color: LC.textMid }}>Quay lại sau nhé, giáo viên sẽ đăng bài sớm thôi!</div>
            </div>
          ) : sets.map((set, i) => {
            const best = bestScorePct[set.id];
            return (
              <button key={set.id} onClick={() => onOpenSet(set)} style={{
                textAlign: 'left', padding: '14px 16px', borderRadius: 22, border: `1.5px solid ${LC.borderQ}`,
                background: LC.surfaceQ, boxShadow: LC.cardShadow, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                transition: 'transform .18s ease, box-shadow .18s ease',
                animation: `fadeUp .22s ease ${Math.min(i * 0.04, 0.3)}s both`,
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 22px rgba(52,211,153,0.16)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = LC.cardShadow; }}>
                <div style={{ width: 42, height: 42, borderRadius: 18, flexShrink: 0, background: 'linear-gradient(135deg,#34D399,#38BDF8)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconShuffle size={19} color="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: LC.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{set.title}</div>
                  <div style={{ fontSize: 12, color: LC.textMid, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {set.description || `${(set.verbs || []).length} động từ`}
                  </div>
                </div>
                {best !== undefined && (
                  <div style={{ flexShrink: 0, padding: '4px 9px', borderRadius: 999, background: best >= 90 ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)', color: best >= 90 ? '#10B981' : '#F59E0B', fontSize: 11, fontWeight: 900 }}>{best}%</div>
                )}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={LC.textMid} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            );
          })}
        </div>
      );
    }

    function IvModePickerScreen({ set, LC, dark, bestScorePct, hideMeaningMode, onToggleHideMeaning, onPickMode }) {
      const modes = [
        { mode: 'flashcard', title: 'Flashcard', desc: 'Lật thẻ ghi nhớ V1 - V2 - V3', color: '#A855F7', icon: <IconBook size={21} color="#A855F7" /> },
        { mode: 'quiz', title: 'Trắc nghiệm', desc: 'Đoán 2 dạng còn lại (V1/V2/V3 trộn)', color: '#3B82F6', icon: <IconCheck size={21} color="#3B82F6" /> },
        { mode: 'fillin', title: 'Điền từ', desc: 'Gõ V2, V3 từ trí nhớ', color: '#F59E0B', icon: <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg> },
        { mode: 'matching', title: 'Ghép cặp', desc: 'Nối V1 với V2 - V3 đúng', color: '#10B981', icon: <IconShuffle size={21} color="#10B981" /> },
      ];
      const verbs = set.verbs || [];
      return (
        <div style={{ flex: 1, padding: 14, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: LC.textMid, marginBottom: 10 }}>
            {verbs.length} động từ{bestScorePct !== undefined ? ` · Điểm cao nhất: ${bestScorePct}%` : ''}
          </div>

          <button onClick={onToggleHideMeaning} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', textAlign: 'left',
            padding: '12px 14px', borderRadius: 18, cursor: 'pointer', marginBottom: 14,
            background: hideMeaningMode ? 'rgba(245,158,11,0.12)' : LC.inputBg,
            border: `1.5px solid ${hideMeaningMode ? '#F59E0B' : LC.border}`,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 900, color: LC.text }}>Ẩn nghĩa khi Điền từ</div>
              <div style={{ fontSize: 10.5, color: LC.textMid, marginTop: 2 }}>Bật lên: phải gõ luôn cả nghĩa tiếng Việt, khó hơn</div>
            </div>
            <span style={{ width: 42, height: 24, borderRadius: 999, background: hideMeaningMode ? '#F59E0B' : LC.border, position: 'relative', flexShrink: 0, marginLeft: 10 }}>
              <span style={{ position: 'absolute', top: 3, left: hideMeaningMode ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .18s cubic-bezier(.34,1.56,.64,1)' }} />
            </span>
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {modes.map((m, i) => (
              <button key={m.mode} onClick={() => verbs.length > 0 && onPickMode(m.mode)} disabled={verbs.length === 0} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: 16, borderRadius: 24, textAlign: 'left',
                border: `1.5px solid ${m.color}4d`, background: LC.surfaceQ, cursor: verbs.length === 0 ? 'default' : 'pointer',
                opacity: verbs.length === 0 ? 0.5 : 1, transition: 'transform .15s ease',
                animation: `fadeUp .22s ease ${Math.min(i * 0.05, 0.3)}s both`,
              }}
                onMouseEnter={e => { if (verbs.length > 0) e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}>
                <div style={{ width: 48, height: 48, borderRadius: 20, flexShrink: 0, background: `${m.color}24`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{m.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: LC.text }}>{m.title}</div>
                  <div style={{ fontSize: 11.5, color: LC.textMid, marginTop: 1 }}>{m.desc}</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={m.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            ))}
            {verbs.length === 0 && <div style={{ textAlign: 'center', fontSize: 12.5, color: LC.textMid, marginTop: 16 }}>Bộ này chưa có động từ nào, quay lại sau nhé!</div>}
          </div>
        </div>
      );
    }

    function IvFlashcardMode({ set, LC, dark, onDone }) {
      const all = set.verbs || [];
      const total = all.length;
      const [queue, setQueue] = useState(() => all.map((_, i) => i));
      const [knownCount, setKnownCount] = useState(0);
      const [flipped, setFlipped] = useState(false);

      const currentIdx = queue[0];
      const verb = currentIdx !== undefined ? all[currentIdx] : null;

      useEffect(() => {
        if (verb === null || verb === undefined) onDone(total > 0 ? Math.min(Math.round((knownCount * 100) / total), 100) : 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [verb]);

      if (!verb) return null;

      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <IvProgressBar current={total - queue.length + 1} total={total} LC={LC} color="#A855F7" />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div onClick={() => setFlipped(f => !f)} style={{ width: '100%', maxWidth: 420, minHeight: 220, cursor: 'pointer', perspective: 1400 }}>
              <div style={{
                position: 'relative', width: '100%', minHeight: 220, transformStyle: 'preserve-3d',
                transition: 'transform .42s cubic-bezier(.25,.46,.45,.94)', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}>
                <div style={{
                  position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28, boxSizing: 'border-box',
                  background: dark ? 'rgba(30,13,21,0.6)' : '#fff', border: `1.5px solid ${LC.border}`, borderRadius: 28,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: '#A855F7', letterSpacing: 1 }}>NGUYÊN THỂ (V1)</div>
                  <div style={{ fontSize: 32, fontWeight: 900, color: LC.text, marginTop: 10 }}>{verb.base}</div>
                  <button onClick={e => { e.stopPropagation(); speak(verb.base, 1); }} style={{
                    width: 42, height: 42, borderRadius: '50%', border: 'none', cursor: 'pointer', marginTop: 16,
                    background: 'linear-gradient(135deg,#FF6B95,#A855F7)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}><IconSpeaker size={15} color="#fff" /></button>
                </div>
                <div style={{
                  position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28, boxSizing: 'border-box', textAlign: 'center',
                  background: dark ? 'rgba(30,13,21,0.6)' : '#fff', border: `1.5px solid ${LC.border}`, borderRadius: 28,
                }}>
                  <div style={{ display: 'flex', gap: 18 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 9.5, fontWeight: 900, color: '#F59E0B' }}>QUÁ KHỨ (V2)</div>
                      <div style={{ fontSize: 19, fontWeight: 900, color: '#F59E0B', marginTop: 4 }}>{verb.past}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 9.5, fontWeight: 900, color: '#10B981' }}>PHÂN TỪ (V3)</div>
                      <div style={{ fontSize: 19, fontWeight: 900, color: '#10B981', marginTop: 4 }}>{verb.participle}</div>
                    </div>
                  </div>
                  {verb.meaning && <div style={{ fontSize: 15, fontWeight: 700, color: LC.text, marginTop: 16 }}>{verb.meaning}</div>}
                  {verb.group_label && <div style={{ fontSize: 10.5, color: LC.textMid, marginTop: 6 }}>{verb.group_label}</div>}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 22 }}>
              {!flipped ? (
                <div style={{ fontSize: 12, color: LC.textMid, fontWeight: 700 }}>Chạm vào thẻ để xem đáp án</div>
              ) : (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => { setQueue(q => [...q.slice(1), currentIdx]); setFlipped(false); }} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '12px 20px', borderRadius: 999, cursor: 'pointer',
                    background: 'rgba(239,68,68,0.12)', border: '1.5px solid rgba(239,68,68,0.4)', color: '#EF4444', fontSize: 13, fontWeight: 900,
                  }}><IconClose size={13} color="#EF4444" /> Chưa nhớ</button>
                  <button onClick={() => { setKnownCount(c => c + 1); setQueue(q => q.slice(1)); setFlipped(false); }} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '12px 20px', borderRadius: 999, cursor: 'pointer',
                    background: 'rgba(16,185,129,0.12)', border: '1.5px solid rgba(16,185,129,0.4)', color: '#10B981', fontSize: 13, fontWeight: 900,
                  }}><IconCheck size={13} color="#10B981" /> Đã nhớ</button>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    function IvQuizMode({ set, LC, onDone }) {
      const fieldOf = (v, formIdx) => formIdx === 0 ? v.base : formIdx === 1 ? v.past : v.participle;
      const formLabel = ['V1 (nguyên mẫu)', 'V2 (quá khứ)', 'V3 (phân từ)'];

      const questions = useMemo(() => {
        return shuffleArr((set.verbs || []).filter(v => v.base && v.past && v.participle)).map(v => {
          const givenForm = Math.floor(Math.random() * 3);
          const askForms = [0, 1, 2].filter(f => f !== givenForm);
          return { verb: v, givenForm, askForms };
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [set.id]);
      const total = questions.length;

      const [qIndex, setQIndex] = useState(0);
      const [correctCount, setCorrectCount] = useState(0);
      const [selected, setSelected] = useState(null);

      useEffect(() => {
        if (total === 0) onDone(0, 0);
        else if (qIndex >= total) onDone(correctCount, total);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [qIndex, total]);

      if (total === 0 || qIndex >= total) return null;

      const q = questions[qIndex];
      const [askA, askB] = q.askForms;
      const correctPair = [fieldOf(q.verb, askA), fieldOf(q.verb, askB)];
      const correctLabel = `${correctPair[0]} - ${correctPair[1]}`;

      const options = useMemo(() => {
        const others = shuffleArr((set.verbs || []).filter(v => v.id !== q.verb.id && fieldOf(v, askA) && fieldOf(v, askB)));
        const distractorPairs = others.map(v => `${fieldOf(v, askA)} - ${fieldOf(v, askB)}`)
          .filter((v, i, arr) => arr.indexOf(v) === i)
          .filter(v => v !== correctLabel)
          .slice(0, 3);
        return shuffleArr([...distractorPairs, correctLabel]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [set.id, qIndex]);

      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <IvProgressBar current={qIndex + 1} total={total} LC={LC} color="#3B82F6" />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 20 }}>
            <div style={{ padding: '6px 14px', borderRadius: 999, background: 'rgba(59,130,246,0.12)', marginBottom: 18, marginTop: 10 }}>
              <span style={{ fontSize: 11.5, fontWeight: 900, color: '#3B82F6' }}>{formLabel[askA]} và {formLabel[askB]} của động từ dưới đây là gì?</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 30, fontWeight: 900, color: LC.text }}>{fieldOf(q.verb, q.givenForm)}</div>
              <button onClick={() => speak(q.verb.base, 1)} style={{
                width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg,#FF6B95,#A855F7)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><IconSpeaker size={13} color="#fff" /></button>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: LC.textMid, marginTop: 2 }}>({formLabel[q.givenForm]})</div>

            <div style={{ width: '100%', maxWidth: 420, marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {options.map(opt => {
                const state = selected === null ? 'idle' : opt === correctLabel ? 'correct' : opt === selected ? 'wrong' : 'dimmed';
                const styleMap = {
                  idle: { bg: LC.surfaceQ, border: LC.border, fg: LC.text },
                  correct: { bg: 'rgba(16,185,129,0.12)', border: '#10B981', fg: '#10B981' },
                  wrong: { bg: 'rgba(239,68,68,0.12)', border: '#EF4444', fg: '#EF4444' },
                  dimmed: { bg: LC.surfaceQ, border: LC.border, fg: LC.textMid },
                };
                const s = styleMap[state];
                return (
                  <button key={opt} onClick={() => selected === null && setSelected(opt)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderRadius: 20,
                    border: `1.5px solid ${s.border}`, background: s.bg, color: s.fg, fontSize: 15.5, fontWeight: 700,
                    cursor: state === 'idle' ? 'pointer' : 'default', opacity: state === 'dimmed' ? 0.5 : 1, transition: 'opacity .2s',
                  }}>
                    <span>{opt}</span>
                    {state === 'correct' && <IconCheck size={15} />}
                    {state === 'wrong' && <IconClose size={15} />}
                  </button>
                );
              })}
            </div>

            {selected !== null && (
              <div style={{ marginTop: 22 }}>
                <IvBigButton text={qIndex === total - 1 ? 'Xem kết quả' : 'Câu tiếp theo →'} onClick={() => {
                  if (selected === correctLabel) setCorrectCount(c => c + 1);
                  setSelected(null);
                  setQIndex(i => i + 1);
                }} />
              </div>
            )}
          </div>
        </div>
      );
    }

    function IvFillInField({ label, value, onChange, disabled, checked, isCorrect, correctAnswer, LC, onEnter, inputRef }) {
      return (
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: LC.textMid, marginBottom: 5 }}>{label}</div>
          <div style={{ position: 'relative' }}>
            <input ref={inputRef} value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
              onKeyDown={e => { if (e.key === 'Enter') onEnter && onEnter(); }}
              autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false" data-lpignore="true"
              style={{
                width: '100%', padding: '13px 40px 13px 16px', borderRadius: 18, boxSizing: 'border-box',
                border: `2px solid ${checked ? (isCorrect ? '#10B981' : '#EF4444') : LC.inputBorder}`,
                fontSize: 16, fontWeight: 700, fontFamily: 'inherit', color: LC.inputColor, background: LC.inputBg, outline: 'none',
              }} />
            {checked && (
              <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)' }}>
                {isCorrect ? <IconCheck size={16} /> : <IconClose size={16} />}
              </span>
            )}
          </div>
          {checked && !isCorrect && <div style={{ fontSize: 12, fontWeight: 700, color: '#10B981', marginTop: 4 }}>Đáp án đúng: {correctAnswer}</div>}
        </div>
      );
    }

    function IvFillInMode({ set, LC, hideMeaningMode, onDone }) {
      const verbs = useMemo(() => {
        return shuffleArr((set.verbs || [])
          .filter(v => v.past && v.participle)
          .filter(v => !hideMeaningMode || v.meaning));
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [set.id, hideMeaningMode]);
      const total = verbs.length;

      const [idx, setIdx] = useState(0);
      const [pastInput, setPastInput] = useState('');
      const [participleInput, setParticipleInput] = useState('');
      const [meaningInput, setMeaningInput] = useState('');
      const [checked, setChecked] = useState(false);
      const [correctCount, setCorrectCount] = useState(0);
      const pastRef = useRef(null);

      useEffect(() => {
        if (total === 0) onDone(0, 0);
        else if (idx >= total) onDone(correctCount, total);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [idx, total]);

      useEffect(() => { setTimeout(() => pastRef.current?.focus(), 80); }, [idx]);

      if (total === 0 || idx >= total) return null;
      const verb = verbs[idx];

      const isExactMatch = (input, answer) => !!input.trim() && input.trim().toLowerCase() === (answer || '').trim().toLowerCase();
      // Chỉ tách theo dấu phân cách GIỮA CÁC NGHĨA (; , / |) — không tách theo
      // khoảng trắng, để giữ nguyên cụm nghĩa nhiều từ như "bắt đầu", "kết thúc".
      const isMeaningMatch = (input, answer) => {
        const cleanedInput = input.trim().toLowerCase().replace(/\s+/g, ' ');
        if (!cleanedInput || !answer) return false;
        const candidates = answer.toLowerCase().split(/[;,/|]+/).map(s => s.trim().replace(/\s+/g, ' ')).filter(Boolean);
        return candidates.includes(cleanedInput);
      };

      const pastOk = checked && isExactMatch(pastInput, verb.past);
      const participleOk = checked && isExactMatch(participleInput, verb.participle);
      const meaningOk = checked && (!hideMeaningMode || isMeaningMatch(meaningInput, verb.meaning || ''));
      const allOk = pastOk && participleOk && meaningOk;

      function handleCheck() { setChecked(true); }
      function handleNext() {
        if (allOk) setCorrectCount(c => c + 1);
        setIdx(i => i + 1);
        setPastInput(''); setParticipleInput(''); setMeaningInput(''); setChecked(false);
      }

      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <IvProgressBar current={idx + 1} total={total} LC={LC} color="#F59E0B" />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 20px 30px', gap: 12, overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 30, fontWeight: 900, color: LC.text }}>{verb.base}</div>
              <button onClick={() => speak(verb.base, 1)} style={{
                width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg,#FF6B95,#A855F7)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><IconSpeaker size={13} color="#fff" /></button>
            </div>
            {!hideMeaningMode && verb.meaning && <div style={{ fontSize: 13, color: LC.textMid }}>{verb.meaning}</div>}

            <IvFillInField label="V2 — Quá khứ đơn" value={pastInput} onChange={setPastInput} disabled={checked}
              checked={checked} isCorrect={pastOk} correctAnswer={verb.past} LC={LC} inputRef={pastRef} />
            <IvFillInField label="V3 — Quá khứ phân từ" value={participleInput} onChange={setParticipleInput} disabled={checked}
              checked={checked} isCorrect={participleOk} correctAnswer={verb.participle} LC={LC}
              onEnter={() => { if (!hideMeaningMode && !checked && pastInput.trim() && participleInput.trim()) handleCheck(); }} />
            {hideMeaningMode && (
              <IvFillInField label="Nghĩa tiếng Việt" value={meaningInput} onChange={setMeaningInput} disabled={checked}
                checked={checked} isCorrect={meaningOk} correctAnswer={verb.meaning || ''} LC={LC}
                onEnter={() => { if (!checked && pastInput.trim() && participleInput.trim() && meaningInput.trim()) handleCheck(); }} />
            )}

            <div style={{ marginTop: 10 }}>
              {!checked ? (
                <IvBigButton text="Kiểm tra" icon={<IconCheck size={14} color="#fff" />} onClick={handleCheck} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: allOk ? '#10B981' : '#EF4444' }}>
                    {allOk ? 'Chính xác! 🎉' : 'Chưa đúng, đáp án đúng đã hiện phía trên nhé'}
                  </div>
                  <IvBigButton text={idx === total - 1 ? 'Xem kết quả' : 'Câu tiếp theo →'} onClick={handleNext} />
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    function IvMatchTile({ text, matched, selected, wrongFlash, color, onClick }) {
      const state = matched ? 'matched' : wrongFlash ? 'wrong' : selected ? 'selected' : 'idle';
      const styleMap = {
        matched: { bg: 'rgba(16,185,129,0.1)', border: '#10B981', fg: '#10B981' },
        wrong: { bg: 'rgba(239,68,68,0.12)', border: '#EF4444', fg: '#EF4444' },
        selected: { bg: `${color}29`, border: color, fg: color },
        idle: { bg: 'transparent', border: `${color}4d`, fg: color },
      };
      const s = styleMap[state];
      return (
        <button onClick={onClick} disabled={matched} style={{
          width: '100%', padding: '12px 10px', borderRadius: 12, textAlign: 'center', cursor: matched ? 'default' : 'pointer',
          border: `1.5px solid ${s.border}`, background: s.bg, color: s.fg, fontSize: 13, fontWeight: 700,
          opacity: matched ? 0.55 : 1, transform: selected ? 'scale(1.03)' : 'scale(1)', transition: 'all .15s',
        }}>{text}</button>
      );
    }

    function IvMatchingRound({ roundKey, verbs, LC, roundLabel, onRoundDone }) {
      const leftItems = useMemo(() => shuffleArr(verbs), [roundKey]);
      const rightItems = useMemo(() => shuffleArr(verbs), [roundKey]);
      const [selectedLeft, setSelectedLeft] = useState(null);
      const [selectedRight, setSelectedRight] = useState(null);
      const [matchedIds, setMatchedIds] = useState(() => new Set());
      const [wrongFlash, setWrongFlash] = useState({ left: null, right: null });
      const [mistakes, setMistakes] = useState(0);

      useEffect(() => {
        if (selectedLeft !== null && selectedRight !== null) {
          if (selectedLeft === selectedRight) {
            const nextMatched = new Set(matchedIds); nextMatched.add(selectedLeft);
            setMatchedIds(nextMatched);
            setSelectedLeft(null); setSelectedRight(null);
            if (nextMatched.size === verbs.length) {
              setTimeout(() => onRoundDone(mistakes), 280);
            }
          } else {
            setMistakes(m => m + 1);
            setWrongFlash({ left: selectedLeft, right: selectedRight });
            const t = setTimeout(() => { setWrongFlash({ left: null, right: null }); setSelectedLeft(null); setSelectedRight(null); }, 420);
            return () => clearTimeout(t);
          }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [selectedLeft, selectedRight]);

      return (
        <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: LC.textMid }}>{roundLabel}</div>
          <div style={{ fontSize: 12, color: LC.textMid, marginTop: 4, marginBottom: 14 }}>Chạm để nối V1 với V2 - V3 tương ứng</div>
          <div style={{ flex: 1, display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {leftItems.map(v => (
                <IvMatchTile key={v.id} text={v.base} matched={matchedIds.has(v.id)} selected={selectedLeft === v.id}
                  wrongFlash={wrongFlash.left === v.id} color="#3B82F6"
                  onClick={() => { if (!matchedIds.has(v.id) && selectedRight === null) setSelectedLeft(selectedLeft === v.id ? null : v.id); }} />
              ))}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rightItems.map(v => (
                <IvMatchTile key={v.id} text={`${v.past} - ${v.participle}`} matched={matchedIds.has(v.id)} selected={selectedRight === v.id}
                  wrongFlash={wrongFlash.right === v.id} color="#10B981"
                  onClick={() => { if (!matchedIds.has(v.id) && selectedLeft !== null) setSelectedRight(v.id); }} />
              ))}
            </div>
          </div>
        </div>
      );
    }

    function IvMatchingMode({ set, LC, onDone }) {
      const roundSize = 6;
      const rounds = useMemo(() => {
        const chunks = [];
        const shuffled = shuffleArr(set.verbs || []);
        for (let i = 0; i < shuffled.length; i += roundSize) chunks.push(shuffled.slice(i, i + roundSize));
        return chunks;
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [set.id]);
      const totalRounds = rounds.length;

      const [roundIdx, setRoundIdx] = useState(0);
      const [totalMistakes, setTotalMistakes] = useState(0);
      const [totalPairs, setTotalPairs] = useState(0);

      useEffect(() => {
        if (totalRounds === 0 || roundIdx >= totalRounds) {
          const total = Math.max(totalPairs, 1);
          const correctEquivalent = Math.max(total - Math.min(totalMistakes, total), 0);
          onDone(correctEquivalent, total);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [roundIdx, totalRounds]);

      if (totalRounds === 0 || roundIdx >= totalRounds) return null;
      const roundVerbs = rounds[roundIdx];

      return (
        <IvMatchingRound
          roundKey={`${set.id}_${roundIdx}`}
          verbs={roundVerbs}
          LC={LC}
          roundLabel={`Vòng ${roundIdx + 1}/${totalRounds}`}
          onRoundDone={mistakes => {
            setTotalMistakes(m => m + mistakes);
            setTotalPairs(p => p + roundVerbs.length);
            setRoundIdx(i => i + 1);
          }}
        />
      );
    }

    function IvResultScreen({ LC, result, onRetry, onExit }) {
      const { correct, total, scorePct } = result;
      const [title, color, mascotIcon] = scorePct >= 90
        ? ['Xuất sắc!', '#10B981', <IconTrophy size={72} color="#10B981" />]
        : scorePct >= 60
          ? ['Khá lắm!', '#3B82F6', <IconTrophy size={72} color="#3B82F6" />]
          : ['Cố lên nào!', '#F59E0B', <IconBook size={64} color="#F59E0B" />];

      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
          <div style={{ animation: 'vp-float 2s ease-in-out infinite' }}>{mascotIcon}</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: LC.text, marginTop: 16 }}>{title}</div>
          <div style={{ fontSize: 14, color: LC.textMid, marginTop: 6 }}>Đúng {correct}/{total} câu</div>
          <div style={{
            width: 96, height: 96, borderRadius: '50%', background: `${color}1f`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 18,
          }}>
            <span style={{ fontSize: 24, fontWeight: 900, color }}>{scorePct}%</span>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
            <IvBigButton text="Học lại" icon={<IconRefresh size={14} color="#fff" />} onClick={onRetry} />
            <button onClick={onExit} style={{
              padding: '14px 22px', borderRadius: 999, border: `1.5px solid ${LC.border}`, background: LC.inputBg,
              color: LC.text, fontSize: 13.5, fontWeight: 900, cursor: 'pointer', fontFamily: "'Nunito',sans-serif",
            }}>Chọn cách khác</button>
          </div>
        </div>
      );
    }

    function IvPlayHost({ mode, set, LC, hideMeaningMode, onFinish, onExit }) {
      const [result, setResult] = useState(null);

      if (result) {
        return <IvResultScreen LC={LC} result={result} onRetry={() => setResult(null)} onExit={onExit} />;
      }

      function handleDone(correct, total) {
        const pct = total > 0 ? Math.round((correct * 100) / total) : 0;
        onFinish(pct);
        setResult({ correct, total, scorePct: pct });
      }

      switch (mode) {
        case 'quiz':
          return <IvQuizMode set={set} LC={LC} onDone={handleDone} />;
        case 'fillin':
          return <IvFillInMode set={set} LC={LC} hideMeaningMode={hideMeaningMode} onDone={handleDone} />;
        case 'matching':
          return <IvMatchingMode set={set} LC={LC} onDone={handleDone} />;
        default:
          return null;
      }
    }

    // Flashcard tính điểm % nội bộ (knownCount/total) — bọc host riêng để khớp
    // interface onDone(pct) khác với 3 chế độ kia (correct/total câu hỏi)
    function IvFlashcardHost({ set, LC, dark, onFinish, onExit }) {
      const [result, setResult] = useState(null);
      if (result) return <IvResultScreen LC={LC} result={result} onRetry={() => setResult(null)} onExit={onExit} />;
      return (
        <IvFlashcardMode set={set} LC={LC} dark={dark} onDone={pct => {
          onFinish(pct);
          setResult({ correct: Math.round((pct * (set.verbs || []).length) / 100), total: (set.verbs || []).length, scorePct: pct });
        }} />
      );
    }

    /* ══════════════════════════════════════════════════════════════════
       ★ CÁC CÁCH HỌC TỪ VỰNG MỚI (cho từ vựng thường trong Unit):
       Trắc nghiệm (Anh→Việt, Việt→Anh), Nghe & chọn, Gõ từ (có gợi ý
       chữ cái đầu), Ghép cặp. Màn kết quả liệt kê từ cần ôn lại.
       ══════════════════════════════════════════════════════════════════ */
    function vpValidWords(unit) {
      return (unit.vocab || []).map((w, i) => ({ ...w, _i: i })).filter(w => w.word && w.meaning);
    }

    function vpBuildQuestions(words, askField) {
      // askField: 'meaning' → đáp án là nghĩa; 'word' → đáp án là từ tiếng Anh
      return shuffleArr(words).map(w => {
        const correct = w[askField];
        const distract = shuffleArr(words.filter(o => o._i !== w._i && o[askField] && o[askField] !== correct))
          .map(o => o[askField]).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3);
        return { w, correct, options: shuffleArr([...distract, correct]) };
      });
    }

    // ★ Word form khi Gõ từ: lấy các form của gia đình từ có base_word trùng với từ đang hỏi
    function vpFamilyFormsFor(unit, w) {
      const key = (w.word || '').trim().toLowerCase();
      if (!key) return [];
      // Khớp nếu từ đang hỏi là base_word HOẶC là 1 trong các form của gia đình
      const fam = (unit.wordFamilies || []).find(f =>
        (f.base_word || '').trim().toLowerCase() === key ||
        (f.forms || []).some(x => (x.form || '').trim().toLowerCase() === key));
      if (!fam) return [];
      const seen = new Set([key]);
      const all = [
        ...(fam.base_word ? [{ id: 'base-' + fam.id, form: fam.base_word, pos: fam.pos, meaning: '' }] : []),
        ...(fam.forms || []),
      ];
      return all.filter(f => {
        const k = (f.form || '').trim().toLowerCase();
        if (!k || seen.has(k)) return false;
        seen.add(k); return true;
      }).map((f, i) => ({ f, i })).sort((a, b) => (posRank(a.f.pos) - posRank(b.f.pos)) || (a.i - b.i)).map(x => x.f);
    }

    function VocabModePicker({ unit, LC, mastered, onPick, wordFormMode, onToggleWordForm }) {
      const words = vpValidWords(unit);
      const modes = [
        { mode: 'flashcard', title: 'Flashcard', desc: 'Lật thẻ xem nghĩa, rồi kiểm tra viết từ', color: '#A855F7', icon: <IconBook size={21} color="#A855F7" /> },
        { mode: 'quiz_en', title: 'Trắc nghiệm: Anh → Việt', desc: 'Thấy từ tiếng Anh, chọn nghĩa đúng', color: '#3B82F6', icon: <IconCheck size={21} color="#3B82F6" /> },
        { mode: 'quiz_vi', title: 'Trắc nghiệm: Việt → Anh', desc: 'Thấy nghĩa, chọn từ tiếng Anh đúng', color: '#0EA5E9', icon: <IconCheck size={21} color="#0EA5E9" /> },
        { mode: 'listen', title: 'Nghe & chọn', desc: 'Nghe phát âm, chọn từ bạn vừa nghe', color: '#EC4899', icon: <IconSpeaker size={21} color="#EC4899" /> },
        { mode: 'typing', title: 'Gõ từ (có gợi ý)', desc: 'Thấy nghĩa + chữ cái đầu, gõ lại từ', color: '#F59E0B', icon: <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg> },
        { mode: 'matching', title: 'Ghép cặp', desc: 'Nối từ tiếng Anh với nghĩa tương ứng', color: '#10B981', icon: <IconShuffle size={21} color="#10B981" /> },
      ];
      const total = (unit.vocab || []).length;
      return (
        <div style={{ flex: 1, padding: '14px 15px 100px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: LC.textMid, marginBottom: 10 }}>
            {total} từ{mastered > 0 ? ` · Đã thuộc ${mastered}/${total}` : ''} · Chọn cách học bạn thấy dễ nhất
          </div>
          {(
            <button onClick={onToggleWordForm} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', textAlign: 'left',
              padding: '12px 14px', borderRadius: 18, marginBottom: 10, cursor: 'pointer', fontFamily: 'inherit',
              background: wordFormMode ? 'rgba(245,158,11,0.12)' : LC.inputBg,
              border: `1.5px solid ${wordFormMode ? '#F59E0B' : LC.border}`,
            }}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 900, color: LC.text }}>Điền cả Word Form khi Gõ từ</div>
                <div style={{ fontSize: 11, color: LC.textMid, marginTop: 2 }}>{(unit.wordFamilies || []).length > 0 ? 'Bật: gõ thêm các dạng từ (n, v, adj, adv...) của từ đó' : 'Unit này chưa có Gia đình từ nên chưa có ô Word Form nào'}</div>
              </div>
              <span style={{ width: 42, height: 24, borderRadius: 999, background: wordFormMode ? '#F59E0B' : LC.border, position: 'relative', flexShrink: 0, marginLeft: 10 }}>
                <span style={{ position: 'absolute', top: 3, left: wordFormMode ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .18s cubic-bezier(.34,1.56,.64,1)' }} />
              </span>
            </button>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {modes.map((m, i) => {
              const disabled = m.mode !== 'flashcard' && words.length < 2;
              return (
                <button key={m.mode} onClick={() => !disabled && onPick(m.mode)} disabled={disabled} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: 16, borderRadius: 24, textAlign: 'left',
                  border: `1.5px solid ${m.color}4d`, background: LC.surfaceQ, cursor: disabled ? 'default' : 'pointer',
                  opacity: disabled ? 0.5 : 1, transition: 'transform .15s ease',
                  animation: `fadeUp .22s ease ${Math.min(i * 0.05, 0.3)}s both`,
                }}
                  onMouseEnter={e => { if (!disabled) e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}>
                  <div style={{ width: 48, height: 48, borderRadius: 20, flexShrink: 0, background: `${m.color}24`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{m.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 900, color: LC.text }}>{m.title}</div>
                    <div style={{ fontSize: 11.5, color: LC.textMid, marginTop: 1 }}>{m.desc}</div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={m.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
              );
            })}
          </div>
          {words.length < 2 && <div style={{ textAlign: 'center', fontSize: 12.5, color: LC.textMid, marginTop: 14 }}>Unit cần ít nhất 2 từ (có nghĩa) để dùng các cách học này.</div>}
        </div>
      );
    }

    function VocabQuizMode({ unit, LC, kind, onDone }) {
      // kind: 'quiz_en' (Anh→Việt) | 'quiz_vi' (Việt→Anh) | 'listen'
      const questions = useMemo(
        () => vpBuildQuestions(vpValidWords(unit), kind === 'quiz_en' ? 'meaning' : 'word'),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [unit.id, kind]);
      const total = questions.length;
      const [qIndex, setQIndex] = useState(0);
      const [correctCount, setCorrectCount] = useState(0);
      const [missed, setMissed] = useState([]);
      const [selected, setSelected] = useState(null);
      const accent = kind === 'listen' ? '#EC4899' : kind === 'quiz_vi' ? '#0EA5E9' : '#3B82F6';

      useEffect(() => {
        if (total === 0 || qIndex >= total) onDone(correctCount, total, missed);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [qIndex, total]);

      useEffect(() => {
        if (kind === 'listen' && questions[qIndex]) setTimeout(() => speak(questions[qIndex].w.word, 1), 250);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [qIndex, kind]);

      if (total === 0 || qIndex >= total) return null;
      const q = questions[qIndex];
      const prompt = kind === 'quiz_en' ? 'Nghĩa của từ này là gì?' : kind === 'quiz_vi' ? 'Chọn từ tiếng Anh đúng' : 'Nghe và chọn từ bạn vừa nghe';

      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <IvProgressBar current={qIndex + 1} total={total} LC={LC} color={accent} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 20px 100px', overflowY: 'auto' }}>
            <div style={{ padding: '6px 14px', borderRadius: 999, background: `${accent}1f`, marginBottom: 18, marginTop: 6 }}>
              <span style={{ fontSize: 11.5, fontWeight: 900, color: accent }}>{prompt}</span>
            </div>

            {kind === 'quiz_en' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 32, fontWeight: 900, color: LC.text }}>{q.w.word}</div>
                  <button onClick={() => speak(q.w.word, 1)} style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#FF6B95,#A855F7)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconSpeaker size={13} color="#fff" /></button>
                </div>
                {q.w.ipa && <div style={{ fontSize: 14, color: LC.textMid, fontStyle: 'italic' }}>/{q.w.ipa.replace(/^\/|\/$/g, '')}/</div>}
                {q.w.pos && <div style={{ fontSize: 11.5, color: '#B07CF0', fontWeight: 700 }}>{getPosLabel(q.w.pos)}</div>}
              </div>
            )}
            {kind === 'quiz_vi' && (
              <div style={{ fontSize: 22, fontWeight: 900, color: LC.text, textAlign: 'center', lineHeight: 1.5, maxWidth: 420 }}>{q.w.meaning}</div>
            )}
            {kind === 'listen' && (
              <button onClick={() => speak(q.w.word, 1)} style={{ width: 84, height: 84, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#FF6B95,#A855F7)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 22px rgba(168,85,247,0.35)' }}>
                <IconSpeaker size={34} color="#fff" />
              </button>
            )}
            {kind === 'listen' && (
              <button onClick={() => speak(q.w.word, 0.6)} style={{ marginTop: 10, padding: '5px 14px', borderRadius: 999, border: `1.5px solid ${LC.border}`, background: LC.inputBg, color: LC.textMid, fontSize: 11.5, fontWeight: 800, cursor: 'pointer' }}>Nghe chậm</button>
            )}

            <div style={{ width: '100%', maxWidth: 420, marginTop: 26, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {q.options.map(opt => {
                const state = selected === null ? 'idle' : opt === q.correct ? 'correct' : opt === selected ? 'wrong' : 'dimmed';
                const styleMap = {
                  idle: { bg: LC.surfaceQ, border: LC.border, fg: LC.text },
                  correct: { bg: 'rgba(16,185,129,0.12)', border: '#10B981', fg: '#10B981' },
                  wrong: { bg: 'rgba(239,68,68,0.12)', border: '#EF4444', fg: '#EF4444' },
                  dimmed: { bg: LC.surfaceQ, border: LC.border, fg: LC.textMid },
                };
                const s = styleMap[state];
                return (
                  <button key={opt} onClick={() => selected === null && setSelected(opt)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '14px 18px', borderRadius: 20, textAlign: 'left',
                    border: `1.5px solid ${s.border}`, background: s.bg, color: s.fg, fontSize: 15, fontWeight: 700,
                    cursor: state === 'idle' ? 'pointer' : 'default', opacity: state === 'dimmed' ? 0.5 : 1, transition: 'opacity .2s',
                  }}>
                    <span>{opt}</span>
                    {state === 'correct' && <IconCheck size={15} />}
                    {state === 'wrong' && <IconClose size={15} />}
                  </button>
                );
              })}
            </div>

            {selected !== null && (
              <div style={{ marginTop: 22 }}>
                <IvBigButton text={qIndex === total - 1 ? 'Xem kết quả' : 'Câu tiếp theo →'} onClick={() => {
                  if (selected === q.correct) setCorrectCount(c => c + 1);
                  else setMissed(m => [...m, q.w]);
                  setSelected(null);
                  setQIndex(i => i + 1);
                }} />
              </div>
            )}
          </div>
        </div>
      );
    }

    function VocabTypingMode({ unit, LC, wordFormMode, onToggleWordForm, onDone }) {
      const words = useMemo(() => shuffleArr(vpValidWords(unit)), [unit.id]);
      const total = words.length;
      const [idx, setIdx] = useState(0);
      const [input, setInput] = useState('');
      const [checked, setChecked] = useState(false);
      const [ok, setOk] = useState(false);
      const [wordOk, setWordOk] = useState(false);
      const [formInputs, setFormInputs] = useState({});
      const [formOk, setFormOk] = useState({});
      const [correctCount, setCorrectCount] = useState(0);
      const [missed, setMissed] = useState([]);
      const inputRef = useRef(null);
      const formRefs = useRef({});

      useEffect(() => {
        if (total === 0 || idx >= total) onDone(correctCount, total, missed);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [idx, total]);
      useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, [idx]);

      if (total === 0 || idx >= total) return null;
      const w = words[idx];
      const hint = (w.word || '').split('').map((c, i) => (c === ' ' ? '\u00A0\u00A0' : i === 0 ? c : '_')).join(' ');
      // ★ Chỉ có form khi công tắc bật VÀ từ này có gia đình từ
      const forms = wordFormMode ? vpFamilyFormsFor(unit, w) : [];
      const matches = (inp, ans) => {
        const a = (inp || '').trim().toLowerCase(), b = (ans || '').trim().toLowerCase();
        return !!a && (a === b || (b.length > 3 && levenshtein(a, b) <= 1));
      };

      function handleCheck() {
        if (checked || !input.trim()) return;
        const good = matches(input, w.word);
        const fOk = {};
        forms.forEach(f => { fOk[f.id] = matches(formInputs[f.id], f.form); });
        const allOk = good && forms.every(f => fOk[f.id]);
        setWordOk(good); setFormOk(fOk); setOk(allOk); setChecked(true);
        if (allOk) setCorrectCount(c => c + 1); else setMissed(m => [...m, w]);
        speak(w.word, 1);
      }
      function focusNextField(i) {
        // i = -1: ô từ chính; i >= 0: ô form thứ i
        if (i + 1 < forms.length) formRefs.current[forms[i + 1].id]?.focus();
        else handleCheck();
      }
      function handleNext() {
        setIdx(i => i + 1); setInput(''); setChecked(false); setOk(false); setWordOk(false);
        setFormInputs({}); setFormOk({}); formRefs.current = {};
      }

      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <IvProgressBar current={idx + 1} total={total} LC={LC} color="#F59E0B" />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 20px 100px', gap: 12, overflowY: 'auto' }}>
            {onToggleWordForm && (
              <button onClick={() => { if (!checked) onToggleWordForm(); }} disabled={checked} style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, cursor: checked ? 'default' : 'pointer',
                fontFamily: 'inherit', fontSize: 11.5, fontWeight: 900, color: wordFormMode ? '#F59E0B' : LC.textMid,
                background: wordFormMode ? 'rgba(245,158,11,0.12)' : LC.inputBg, border: `1.5px solid ${wordFormMode ? '#F59E0B' : LC.border}`,
                opacity: checked ? 0.6 : 1,
              }}>
                <span style={{ width: 30, height: 17, borderRadius: 999, background: wordFormMode ? '#F59E0B' : LC.border, position: 'relative', flexShrink: 0 }}>
                  <span style={{ position: 'absolute', top: 2, left: wordFormMode ? 15 : 2, width: 13, height: 13, borderRadius: '50%', background: '#fff', transition: 'left .18s ease' }} />
                </span>
                Điền cả Word Form
              </button>
            )}
            <div style={{ padding: '6px 14px', borderRadius: 999, background: 'rgba(245,158,11,0.12)' }}>
              <span style={{ fontSize: 11.5, fontWeight: 900, color: '#F59E0B' }}>Gõ từ tiếng Anh có nghĩa này</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: LC.text, textAlign: 'center', lineHeight: 1.5, maxWidth: 420 }}>{w.meaning}</div>
            {w.pos && <div style={{ fontSize: 11.5, color: '#B07CF0', fontWeight: 700 }}>{getPosLabel(w.pos)}</div>}
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 2, color: LC.textMid, margin: '4px 0 6px' }}>{hint}</div>
            <IvFillInField label={wordFormMode ? `Từ tiếng Anh · ${getPosLabel(w.pos)}` : 'Từ tiếng Anh'} value={input} onChange={setInput} disabled={checked}
              checked={checked} isCorrect={wordOk} correctAnswer={w.word} LC={LC} inputRef={inputRef} onEnter={() => focusNextField(-1)} />
            {wordFormMode && forms.length === 0 && (
              <div style={{ fontSize: 11.5, fontWeight: 700, color: LC.textMid, textAlign: 'center', maxWidth: 420 }}>Từ này chưa có Word Form trong Gia đình từ của Unit.</div>
            )}
            {forms.map((f, fi) => (
              <IvFillInField key={f.id} label={`Word form · ${getPosLabel(f.pos)}${f.meaning ? ' — ' + f.meaning : ''}`}
                value={formInputs[f.id] || ''} onChange={v => setFormInputs(p => ({ ...p, [f.id]: v }))} disabled={checked}
                checked={checked} isCorrect={!!formOk[f.id]} correctAnswer={f.form} LC={LC}
                inputRef={el => { if (el) formRefs.current[f.id] = el; }} onEnter={() => focusNextField(fi)} />
            ))}
            <div style={{ marginTop: 10 }}>
              {!checked ? (
                <IvBigButton text="Kiểm tra" icon={<IconCheck size={14} color="#fff" />} onClick={handleCheck} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: ok ? '#10B981' : '#EF4444' }}>{ok ? 'Chính xác! 🎉' : 'Chưa đúng, xem đáp án phía trên nhé'}</div>
                  <IvBigButton text={idx === total - 1 ? 'Xem kết quả' : 'Từ tiếp theo →'} onClick={handleNext} />
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    function VocabMatchingRound({ roundKey, words, LC, roundLabel, onRoundDone }) {
      const leftItems = useMemo(() => shuffleArr(words), [roundKey]);
      const rightItems = useMemo(() => shuffleArr(words), [roundKey]);
      const [selectedLeft, setSelectedLeft] = useState(null);
      const [selectedRight, setSelectedRight] = useState(null);
      const [matchedIds, setMatchedIds] = useState(() => new Set());
      const [wrongFlash, setWrongFlash] = useState({ left: null, right: null });
      const [mistakes, setMistakes] = useState(0);
      const [missedIds, setMissedIds] = useState(() => new Set());

      useEffect(() => {
        if (selectedLeft !== null && selectedRight !== null) {
          if (selectedLeft === selectedRight) {
            const next = new Set(matchedIds); next.add(selectedLeft);
            setMatchedIds(next); setSelectedLeft(null); setSelectedRight(null);
            speak(words.find(w => w._i === selectedLeft)?.word, 1);
            if (next.size === words.length) setTimeout(() => onRoundDone(mistakes, missedIds), 500);
          } else {
            setMistakes(m => m + 1);
            setMissedIds(s => new Set(s).add(selectedLeft));
            setWrongFlash({ left: selectedLeft, right: selectedRight });
            const t = setTimeout(() => { setWrongFlash({ left: null, right: null }); setSelectedLeft(null); setSelectedRight(null); }, 420);
            return () => clearTimeout(t);
          }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [selectedLeft, selectedRight]);

      return (
        <div style={{ flex: 1, padding: '16px 16px 100px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: LC.textMid }}>{roundLabel}</div>
          <div style={{ fontSize: 12, color: LC.textMid, marginTop: 4, marginBottom: 14 }}>Chạm một từ rồi chạm nghĩa tương ứng</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {leftItems.map(w => (
                <IvMatchTile key={w._i} text={w.word} matched={matchedIds.has(w._i)} selected={selectedLeft === w._i}
                  wrongFlash={wrongFlash.left === w._i} color="#3B82F6"
                  onClick={() => { if (!matchedIds.has(w._i) && selectedRight === null) setSelectedLeft(selectedLeft === w._i ? null : w._i); }} />
              ))}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rightItems.map(w => (
                <IvMatchTile key={w._i} text={w.meaning} matched={matchedIds.has(w._i)} selected={selectedRight === w._i}
                  wrongFlash={wrongFlash.right === w._i} color="#10B981"
                  onClick={() => { if (!matchedIds.has(w._i) && selectedLeft !== null) setSelectedRight(w._i); }} />
              ))}
            </div>
          </div>
        </div>
      );
    }

    function VocabMatchingMode({ unit, LC, onDone }) {
      const all = useMemo(() => vpValidWords(unit), [unit.id]);
      const rounds = useMemo(() => {
        const shuffled = shuffleArr(all), chunks = [];
        for (let i = 0; i < shuffled.length; i += 5) chunks.push(shuffled.slice(i, i + 5));
        // Gộp vòng cuối nếu chỉ còn 1 từ (nối 1 cặp thì vô nghĩa)
        if (chunks.length > 1 && chunks[chunks.length - 1].length === 1) {
          const last = chunks.pop(); chunks[chunks.length - 1].push(...last);
        }
        return chunks;
      }, [all]);
      const [roundIdx, setRoundIdx] = useState(0);
      const [missedSet, setMissedSet] = useState(() => new Set());

      useEffect(() => {
        if (rounds.length === 0 || roundIdx >= rounds.length) {
          const missed = all.filter(w => missedSet.has(w._i));
          onDone(all.length - missed.length, all.length, missed);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [roundIdx, rounds.length]);

      if (rounds.length === 0 || roundIdx >= rounds.length) return null;
      return (
        <VocabMatchingRound roundKey={`${unit.id}_${roundIdx}`} words={rounds[roundIdx]} LC={LC}
          roundLabel={`Vòng ${roundIdx + 1}/${rounds.length}`}
          onRoundDone={(m, ids) => {
            setMissedSet(prev => { const n = new Set(prev); ids.forEach(i => n.add(i)); return n; });
            setRoundIdx(i => i + 1);
          }} />
      );
    }

    function VocabResultScreen({ LC, result, onRetry, onExit }) {
      const { correct, total } = result;
      const missed = (result.missed || []).filter((w, i, a) => a.findIndex(x => x._i === w._i) === i);
      const scorePct = total > 0 ? Math.round((correct * 100) / total) : 0;
      const [title, color, icon] = scorePct >= 90
        ? ['Xuất sắc!', '#10B981', <IconTrophy size={72} color="#10B981" />]
        : scorePct >= 60
          ? ['Khá lắm!', '#3B82F6', <IconTrophy size={72} color="#3B82F6" />]
          : ['Cố lên nào!', '#F59E0B', <IconBook size={64} color="#F59E0B" />];
      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 20px 100px', textAlign: 'center', overflowY: 'auto' }}>
          <div style={{ animation: 'vp-float 2s ease-in-out infinite' }}>{icon}</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: LC.text, marginTop: 14 }}>{title}</div>
          <div style={{ fontSize: 14, color: LC.textMid, marginTop: 6 }}>Đúng {correct}/{total} từ</div>
          <div style={{ width: 88, height: 88, borderRadius: '50%', background: `${color}1f`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 16 }}>
            <span style={{ fontSize: 22, fontWeight: 900, color }}>{scorePct}%</span>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap', justifyContent: 'center' }}>
            <IvBigButton text="Học lại" icon={<IconRefresh size={14} color="#fff" />} onClick={onRetry} />
            <button onClick={onExit} style={{ padding: '14px 22px', borderRadius: 999, border: `1.5px solid ${LC.border}`, background: LC.inputBg, color: LC.text, fontSize: 13.5, fontWeight: 900, cursor: 'pointer', fontFamily: "'Nunito',sans-serif" }}>Chọn cách khác</button>
          </div>
          {missed.length > 0 && (
            <div style={{ width: '100%', maxWidth: 420, marginTop: 26, textAlign: 'left' }}>
              <div style={{ fontSize: 12.5, fontWeight: 900, color: LC.text, marginBottom: 8 }}>Từ cần ôn lại ({missed.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {missed.map(w => (
                  <div key={w._i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 12, background: LC.surfaceQ, border: `1px solid ${LC.border}` }}>
                    <button onClick={() => speak(w.word, 1)} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0, background: 'linear-gradient(135deg,#FF6B95,#A855F7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconSpeaker size={12} color="#fff" /></button>
                    <span style={{ fontSize: 14, fontWeight: 800, color: LC.text }}>{w.word}</span>
                    <span style={{ fontSize: 12.5, color: LC.textMid, marginLeft: 'auto', textAlign: 'right' }}>{w.meaning}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    function VocabPlayHost({ mode, unit, LC, wordFormMode, onToggleWordForm, onFinish, onExit }) {
      const [result, setResult] = useState(null);
      const [runKey, setRunKey] = useState(0);
      if (result) {
        return <VocabResultScreen LC={LC} result={result} onExit={onExit}
          onRetry={() => { setResult(null); setRunKey(k => k + 1); }} />;
      }
      function handleDone(correct, total, missed) {
        onFinish(correct, total);
        setResult({ correct, total, missed: missed || [] });
      }
      if (mode === 'typing') return <VocabTypingMode key={runKey} unit={unit} LC={LC} wordFormMode={wordFormMode} onToggleWordForm={onToggleWordForm} onDone={handleDone} />;
      if (mode === 'matching') return <VocabMatchingMode key={runKey} unit={unit} LC={LC} onDone={handleDone} />;
      return <VocabQuizMode key={runKey} unit={unit} LC={LC} kind={mode} onDone={handleDone} />;
    }

    /* ══════════════════════════════════════════════════════════════════
       VOCAB PRACTICE — main export
       ══════════════════════════════════════════════════════════════════ */
    function VocabPractice({ dark, student, onBack }) {
      const [courses, setCourses] = useState([]);
      const [loading, setLoading] = useState(true);
      const [loadError, setLoadError] = useState(false);
      const [openCourseId, setOpenCourseId] = useState(null);
      const [activeUnit, setActiveUnit] = useState(null);
      const [activeCourse, setActiveCourse] = useState(null);
      const [mastery, setMastery] = useState({});
      // ★ Tab con trong 1 Unit đang mở: "Từ vựng thường" (chế độ học flashcard
      // + writing test) vs "Gia đình từ" (danh sách xem, không phải chế độ
      // học chủ động) — khớp VocabUnitSubTab bên Android app.
      const [unitSubTab, setUnitSubTab] = useState('words');
      // ★ Cách học đang chọn trong Unit: null = màn chọn cách học
      const [unitMode, setUnitMode] = useState(null);

      const [showIrregularVerbs, setShowIrregularVerbs] = useState(false);
      const [ivSets, setIvSets] = useState([]);
      const [ivLoading, setIvLoading] = useState(true);
      const [ivLoadError, setIvLoadError] = useState(false);
      const [ivOffline, setIvOffline] = useState(false);
      const [ivBestScorePct, setIvBestScorePct] = useState({});
      const [ivActiveSet, setIvActiveSet] = useState(null);
      const [ivActiveMode, setIvActiveMode] = useState(null);
      const [ivHideMeaningMode, setIvHideMeaningMode] = useState(false);
      // ★ Công tắc "Điền cả Word Form khi Gõ từ" (lưu cục bộ, mặc định TẮT)
      const [vpWordFormMode, setVpWordFormMode] = useState(() => {
        try { return localStorage.getItem('vp_wordform_mode') === '1'; } catch (e) { return false; }
      });
      function vpToggleWordForm() {
        setVpWordFormMode(prev => {
          const next = !prev;
          try { localStorage.setItem('vp_wordform_mode', next ? '1' : '0'); } catch (e) { /* bỏ qua */ }
          return next;
        });
      }

      const LC = useMemo(() => ({
        text: dark ? '#F2EAFF' : '#2D1245',
        text2: dark ? '#DDD0F8' : '#4A1860',
        textMid: dark ? '#9B7FC0' : '#8060A0',
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

      useEffect(() => {
        const supa = window.supa;
        if (!supa) { setLoading(false); setLoadError(true); return; }
        (async () => {
          try {
            const [
              { data: cs, error: e1 }, { data: us, error: e2 }, { data: ws, error: e3 },
              { data: fams, error: e4 }, { data: frms, error: e5 },
            ] = await Promise.all([
              supa.from('vocab_courses').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: false }),
              supa.from('vocab_units').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
              supa.from('vocab_words').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
              // ★ Gia đình từ (word families) — cùng cấp với vocab_words, hiển
              // thị ở tab con riêng bên trong mỗi Unit, khớp
              // vocab_word_families/vocab_word_forms bên Android app.
              supa.from('vocab_word_families').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
              supa.from('vocab_word_forms').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
            ]);
            if (e1 || e2 || e3 || e4 || e5) throw (e1 || e2 || e3 || e4 || e5);
            const wordsByUnit = {};
            (ws || []).forEach(w => { (wordsByUnit[w.unit_id] ||= []).push(w); });
            const formsByFamily = {};
            (frms || []).forEach(f => { (formsByFamily[f.family_id] ||= []).push(f); });
            const familiesByUnit = {};
            (fams || []).forEach(fam => { (familiesByUnit[fam.unit_id] ||= []).push({ ...fam, forms: formsByFamily[fam.id] || [] }); });
            const unitsByCourse = {};
            (us || []).forEach(u => { (unitsByCourse[u.course_id] ||= []).push({ ...u, vocab: wordsByUnit[u.id] || [], wordFamilies: familiesByUnit[u.id] || [] }); });
            setCourses((cs || []).map(c => ({ ...c, units: unitsByCourse[c.id] || [] })));
          } catch (e) {
            console.error('[VocabPractice] load error:', e);
            setLoadError(true);
          } finally {
            setLoading(false);
          }
        })();
      }, []);

      const loadIrregularVerbSets = useCallback(async () => {
        setIvLoading(true); setIvLoadError(false);
        const supa = window.supa;
        if (!supa) { setIvLoading(false); setIvLoadError(true); return; }
        try {
          const { data: sets, error: e1 } = await supa.from('irregular_verb_sets')
            .select('*').eq('is_published', true)
            .order('sort_order', { ascending: true }).order('created_at', { ascending: false });
          if (e1) throw e1;
          const setIds = (sets || []).map(s => s.id);
          let verbs = [];
          if (setIds.length > 0) {
            const { data: vs, error: e2 } = await supa.from('irregular_verbs')
              .select('*').in('set_id', setIds)
              .order('sort_order', { ascending: true }).order('created_at', { ascending: true });
            if (e2) throw e2;
            verbs = vs || [];
          }
          const verbsBySet = {};
          verbs.forEach(v => { (verbsBySet[v.set_id] ||= []).push(v); });
          const merged = (sets || []).map(s => ({ ...s, verbs: verbsBySet[s.id] || [] }));
          setIvSets(merged);
          setIvOffline(false);
          try { localStorage.setItem('iv_sets_cache', JSON.stringify(merged)); } catch (e) { /* quota đầy, bỏ qua cache */ }
        } catch (e) {
          console.error('[VocabPractice] load irregular verb sets error:', e);
          try {
            const cached = JSON.parse(localStorage.getItem('iv_sets_cache') || 'null');
            if (cached) { setIvSets(cached); setIvOffline(true); }
            else setIvLoadError(true);
          } catch (e2) { setIvLoadError(true); }
        } finally {
          setIvLoading(false);
        }
      }, []);

      // Điểm cao nhất theo HỌC SINH: ivbest_<studentId>_<setId>
      const ivPrefix = `ivbest_${student?.id || 'anon'}_`;

      useEffect(() => {
        if (!showIrregularVerbs) return;
        loadIrregularVerbSets();
        try {
          const scoreMap = {};
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(ivPrefix)) {
              const v = parseInt(localStorage.getItem(key), 10);
              if (Number.isFinite(v) && v >= 0 && v <= 100) scoreMap[key.slice(ivPrefix.length)] = v;
            }
          }
          setIvBestScorePct(scoreMap);
          setIvHideMeaningMode(localStorage.getItem('iv_hide_meaning') === '1');
        } catch (e) { /* localStorage không khả dụng, bỏ qua */ }
      }, [showIrregularVerbs, loadIrregularVerbSets, ivPrefix]);

      function ivSaveScore(setId, scorePct) {
        try {
          const pct = Math.max(0, Math.min(100, Math.round(Number(scorePct) || 0)));
          const prevBest = parseInt(localStorage.getItem(ivPrefix + setId) || '-1', 10);
          if (pct > prevBest) {
            localStorage.setItem(ivPrefix + setId, String(pct));
            setIvBestScorePct(prev => ({ ...prev, [setId]: pct }));
          }
        } catch (e) { /* bỏ qua */ }
      }
      function ivToggleHideMeaning() {
        setIvHideMeaningMode(prev => {
          const next = !prev;
          try { localStorage.setItem('iv_hide_meaning', next ? '1' : '0'); } catch (e) { /* bỏ qua */ }
          return next;
        });
      }

      // Khóa theo học sinh: vmaster_<studentId>_<unitId>. (Khóa cũ vmaster_<unitId>
      // không gắn user nên 2 học sinh dùng chung máy sẽ đè tiến độ của nhau; nó bị
      // bỏ qua và được dọn khi đăng xuất.)
      const mkey = (unitId) => `vmaster_${student?.id || 'anon'}_${unitId}`;

      const masteryOf = useCallback((unitId, total) => {
        if (mastery[unitId] !== undefined) return mastery[unitId];
        try {
          const v = parseInt(localStorage.getItem(mkey(unitId)) || '0', 10);
          return Number.isFinite(v) ? Math.max(0, Math.min(v, total)) : 0;
        } catch (e) { return 0; }
      }, [mastery, student?.id]);

      const saveMastery = useCallback((unitId, count) => {
        setMastery(prev => ({ ...prev, [unitId]: count }));
        try { localStorage.setItem(mkey(unitId), String(count)); } catch (e) { /* bỏ qua */ }
      }, [student?.id]);

      const saveProgress = useCallback(async (unit, learnedCount) => {
        saveMastery(unit.id, learnedCount);
        if (!student?.id || !window.supa) return;
        // Ngày theo GIỜ ĐỊA PHƯƠNG (không dùng toISOString: đó là UTC nên học sinh
        // học lúc 0h–7h sáng ở Việt Nam bị ghi nhầm sang ngày hôm trước).
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        // Khóa theo HỌC SINH + ngày + unit, lưu số từ đã ghi. Trước đây chỉ ghi 1
        // lần/ngày/unit nên học tiếp thêm trong ngày không được cập nhật.
        const saveKey = `vocabsave_${student.id}_${today}_${unit.id}`;
        try {
          const already = parseInt(localStorage.getItem(saveKey) || '0', 10) || 0;
          if (learnedCount <= already) return; // chỉ ghi khi có tiến bộ thật sự
          const { error } = await window.supa.from('vocab_progress').insert({
            id: crypto.randomUUID(), student_id: student.id, unit_id: unit.id,
            date: today, vocab_count: learnedCount,
          });
          if (error) throw error;
          localStorage.setItem(saveKey, String(learnedCount));
        } catch (e) {
          console.error('[VocabPractice] save progress error:', e);
        }
      }, [student?.id, saveMastery]);

      function pickUnit(course, unit) {
        setActiveCourse(course);
        setActiveUnit(unit);
        setUnitSubTab('words');
        setUnitMode(null);
      }
      function exitLearning() { setActiveUnit(null); setActiveCourse(null); setUnitSubTab('words'); setUnitMode(null); }

      const header = (title, onBackFn) => (
        <div style={{ padding: '11px 15px 10px', background: LC.surfaceQ, borderBottom: `1px solid ${LC.border}`, position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(20px)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {onBackFn ? (
              <button onClick={onBackFn} style={{ padding: '6px 14px', borderRadius: 999, border: `1.5px solid ${LC.navBtnBorder}`, background: LC.navBtn, color: LC.navBtnText, fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                Quay lại
              </button>
            ) : <div style={{ width: 70 }} />}
            <div style={{ fontSize: 14, fontWeight: 900, color: LC.text, display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconBook size={15} color={LC.text} /> {title}
            </div>
            <div style={{ width: 70 }} />
          </div>
        </div>
      );

      const sharedKeyframes = (
        <style>{`
          @keyframes vp-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
          @keyframes vp-pop { 0% { opacity:0; transform:scale(.92) translateY(8px); } 100% { opacity:1; transform:scale(1) translateY(0); } }
          @keyframes bb-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        `}</style>
      );

      if (showIrregularVerbs) {
        return (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
            {sharedKeyframes}
            {ivActiveSet && ivActiveMode ? (
              <>
                <IvHeader title={ivActiveSet.title} onBack={() => setIvActiveMode(null)} LC={LC} icon={<IconShuffle size={15} color={LC.text} />} />
                {ivActiveMode === 'flashcard' ? (
                  <IvFlashcardHost set={ivActiveSet} LC={LC} dark={dark}
                    onFinish={pct => ivSaveScore(ivActiveSet.id, pct)}
                    onExit={() => setIvActiveMode(null)} />
                ) : (
                  <IvPlayHost mode={ivActiveMode} set={ivActiveSet} LC={LC} hideMeaningMode={ivHideMeaningMode}
                    onFinish={pct => ivSaveScore(ivActiveSet.id, pct)}
                    onExit={() => setIvActiveMode(null)} />
                )}
              </>
            ) : ivActiveSet ? (
              <>
                <IvHeader title={ivActiveSet.title} onBack={() => setIvActiveSet(null)} LC={LC} icon={<IconShuffle size={15} color={LC.text} />} />
                <IvModePickerScreen set={ivActiveSet} LC={LC} dark={dark}
                  bestScorePct={ivBestScorePct[ivActiveSet.id]}
                  hideMeaningMode={ivHideMeaningMode}
                  onToggleHideMeaning={ivToggleHideMeaning}
                  onPickMode={mode => setIvActiveMode(mode)} />
              </>
            ) : (
              <>
                <IvHeader title="Động từ bất quy tắc" onBack={() => setShowIrregularVerbs(false)} LC={LC} icon={<IconShuffle size={15} color={LC.text} />} />
                <IvSetListScreen loading={ivLoading} loadError={ivLoadError} isOffline={ivOffline} sets={ivSets} LC={LC} dark={dark}
                  bestScorePct={ivBestScorePct} onOpenSet={set => setIvActiveSet(set)} />
              </>
            )}
          </div>
        );
      }

      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
          {sharedKeyframes}

          {activeUnit ? (
            <>
              {header(activeUnit.title, unitSubTab === 'families' ? () => setUnitSubTab('words') : unitMode ? () => setUnitMode(null) : exitLearning)}
              {(activeUnit.wordFamilies || []).length > 0 && (unitSubTab === 'families' || !unitMode) && (
                <VocabUnitSubTabBar selected={unitSubTab} LC={LC} onSelect={setUnitSubTab} />
              )}
              {unitSubTab === 'families' && (activeUnit.wordFamilies || []).length > 0 ? (
                <WordFamilyListView unit={activeUnit} LC={LC} dark={dark} onSpeak={speak} />
              ) : !unitMode ? (
                <VocabModePicker unit={activeUnit} LC={LC}
                  mastered={masteryOf(activeUnit.id, (activeUnit.vocab || []).length)}
                  wordFormMode={vpWordFormMode} onToggleWordForm={vpToggleWordForm}
                  onPick={setUnitMode} />
              ) : unitMode === 'flashcard' ? (
                <LearningView unit={activeUnit} LC={LC} dark={dark} onExit={() => setUnitMode(null)} onProgressSaved={saveProgress} />
              ) : (
                <VocabPlayHost mode={unitMode} unit={activeUnit} LC={LC} wordFormMode={vpWordFormMode} onToggleWordForm={vpToggleWordForm}
                  onFinish={(correct, total) => {
                    if (correct > masteryOf(activeUnit.id, total)) saveProgress(activeUnit, correct);
                  }}
                  onExit={() => setUnitMode(null)} />
              )}
            </>
          ) : openCourseId ? (
            (() => {
              const course = courses.find(c => c.id === openCourseId);
              if (!course) return null;
              return (
                <>
                  {header(course.title, () => setOpenCourseId(null))}
                  <UnitPicker course={course} LC={LC} dark={dark} onBack={() => setOpenCourseId(null)}
                    onPickUnit={u => pickUnit(course, u)} masteryOf={masteryOf} />
                </>
              );
            })()
          ) : (
            <>
              {header('Từ vựng', onBack)}
              <div style={{ flex: 1, padding: '16px 14px 100px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <IrregularVerbEntryCard LC={LC} dark={dark} onClick={() => setShowIrregularVerbs(true)} />

                {loadError && (
                  <div style={{ padding: '12px 14px', borderRadius: 18, background: 'rgba(239,68,68,0.08)', border: '1.5px solid rgba(239,68,68,0.25)', color: '#EF4444', fontSize: 12.5, fontWeight: 700 }}>
                    Không tải được danh sách từ vựng. Thử lại sau nhé!
                  </div>
                )}
                {loading ? (
                  <>
                    <SkeletonCard LC={LC} /><SkeletonCard LC={LC} /><SkeletonCard LC={LC} />
                  </>
                ) : courses.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '34vh', gap: 12, padding: '32px 20px', textAlign: 'center', animation: 'fadeUp .3s ease both', borderRadius: 22, border: `1.5px solid ${LC.borderQ}` }}>
                    <span style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: '50%',
                      background: dark ? 'rgba(196,181,253,0.1)' : 'rgba(168,85,247,0.08)', color: LC.textMid,
                      animation: 'bb-float 3s ease-in-out infinite',
                    }}><IconBook size={28} /></span>
                    <div style={{ fontSize: 14.5, fontWeight: 900, color: LC.text, fontFamily: "'Baloo 2',cursive" }}>Chưa có khóa học nào</div>
                    <div style={{ fontSize: 12.5, color: LC.textMid }}>Quay lại sau nhé, giáo viên sẽ đăng bài sớm thôi!</div>
                  </div>
                ) : courses.map((course, cIdx) => {
                  const unitCount = (course.units || []).length;
                  const wordCount = (course.units || []).reduce((n, u) => n + (u.vocab ? u.vocab.length : 0), 0);
                  return (
                    <button key={course.id} onClick={() => setOpenCourseId(course.id)}
                      style={{
                        textAlign: 'left', padding: '14px 16px', borderRadius: 22, border: `1.5px solid ${LC.borderQ}`,
                        background: LC.surfaceQ, boxShadow: LC.cardShadow, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                        transition: 'transform .18s ease, box-shadow .18s ease',
                        animation: `fadeUp .22s ease ${Math.min(cIdx * 0.04, 0.3)}s both`,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 22px rgba(168,85,247,0.16)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = LC.cardShadow; }}>
                      <div style={{ width: 42, height: 42, borderRadius: 18, flexShrink: 0, background: 'linear-gradient(135deg,#F472B6,#A855F7)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 12px rgba(168,85,247,0.32)' }}>
                        <IconBook size={19} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 800, color: LC.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{course.title}</div>
                        <div style={{ fontSize: 12, color: LC.textMid, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {course.description || `${unitCount} unit · ${wordCount} từ`}
                        </div>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={LC.textMid} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="9 18 15 12 9 6" /></svg>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      );
    }

    window.VocabPractice = VocabPractice;
  } catch (e) {
    console.error('[vocab-practice] INIT ERROR:', e);
  }
})();
