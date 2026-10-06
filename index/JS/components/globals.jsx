import React from 'react';

/* ══════════════════════════════════════════════════════════════════
   GLOBALS.JSX  ·  Learnsy · Global Helpers & UI Primitives
   Exports (window globals):
     window.C / window.CL / window.CD   — Color palettes
     window._shuf                        — Array shuffle
     window.applyShuffleToLesson         — Shuffle questions/answers
     window.Flower / Heart / Star / Sparkle — SVG icons
     window.playSound / playFanfare / playSad — Tone.js sounds
     window.LETTERS                      — ['A','B','C','D','E','F']

   Phụ thuộc:
     - React (window.React)
     - Tone.js (window.Tone) — từ CDN
══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  try {
    /* ══ SHUFFLE HELPERS ══ */
    function _shuf(a) {
      const r = a.slice();
      for (let i = r.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [r[i], r[j]] = [r[j], r[i]];
      }
      return r;
    }

    function applyShuffleToLesson(lesson, shuffleQ, shuffleA) {
      let qs = lesson.questions.slice();
      if (shuffleA) {
        qs = qs.map(q => {
          if (q.type === 'multiple') {
            const cv = q.options[q.correct];
            const o = _shuf(q.options.slice());
            return { ...q, options: o, correct: o.indexOf(cv) };
          }
          if (q.type === 'multi_select') {
            const cvs = (q.correct || []).map(i => q.options[i]);
            const o = _shuf(q.options.slice());
            return { ...q, options: o, correct: cvs.map(v => o.indexOf(v)) };
          }
          if (q.type === 'true_false') {
            return { ...q, items: _shuf(q.items.slice()) };
          }
          return q;
        });
      }
      if (shuffleQ) qs = _shuf(qs);      return { ...lesson, questions: qs };
    }

    /* ══ COLOR PALETTES ══ */
    const CL = {
      bg: '#FFF5F9', bg2: '#FEF0F7', surface: '#FFFFFF',
      rose: '#FF6B95', rose2: '#FF8FAF', roseL: '#FFE4ED', rosePale: '#FFF0F5',
      lav: '#A855F7', lav2: '#C084FC', lavL: '#F0E6FF', lavPale: '#FAF5FF',
      mint: '#10B981', mint2: '#6EE7B7', mintL: '#ECFDF5',
      peach: '#F97316', peachL: '#FFF7ED', peach2: '#FED7AA',
      text: '#3D1830', text2: '#6B3050', text3: '#A07090', text4: '#C8A0B8',
      border: '#F5D5E8', border2: '#E8DCFF',
      grad: 'linear-gradient(135deg,#F472B6,#A855F7)',
      gradSoft: 'linear-gradient(135deg,#FFDDED,#EDE9FE)',
    };

    const CD = {
      bg: '#180A10', bg2: '#200E18', surface: '#3A1824',
      rose: '#FF6B95', rose2: '#FF8FAF', roseL: '#3A0F22', rosePale: '#2D0A1A',
      lav: '#C084FC', lav2: '#D8A8FF', lavL: '#2A1040', lavPale: '#200C35',
      mint: '#10B981', mint2: '#6EE7B7', mintL: '#0A2618',
      peach: '#FB923C', peachL: '#2A1208', peach2: '#7A3810',
      text: '#F5E4EE', text2: '#D4A8C4', text3: '#9A7090', text4: '#604050',
      border: '#5C1F34', border2: '#4A1872',
      grad: 'linear-gradient(135deg,#F472B6,#A855F7)',
      gradSoft: 'linear-gradient(135deg,#3A0F22,#2A1040)',
    };

    let C = CL;

    /* ══ SVG ICONS ══ */
    const Flower = ({ s = 16, c = '#FFB7C9', style = {} }) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, ...style }}>
        {[0, 72, 144, 216, 288].map((deg, i) => (
          <ellipse key={i} cx="12" cy="6" rx="3" ry="5.5" fill={c} opacity={i % 2 === 0 ? 0.9 : 0.7}
            transform={`rotate(${deg} 12 12)`} />
        ))}
        <circle cx="12" cy="12" r="3.5" fill="#FFF5CC" />
      </svg>
    );

    const Heart = ({ s = 14, c = '#F9A8D4', style = {} }) => (
      <svg width={s} height={s} viewBox="0 0 20 20" fill={c} style={{ flexShrink: 0, ...style }}>
        <path d="M10 17S2 11.5 2 6.5a4 4 0 0 1 8-1 4 4 0 0 1 8 1C18 11.5 10 17 10 17z" />
      </svg>
    );

    const Star = ({ s = 13, c = '#FCD34D', style = {} }) => (
      <svg width={s} height={s} viewBox="0 0 20 20" fill={c} style={{ flexShrink: 0, ...style }}>
        <path d="M10 1.5 L12.47 7.35 L18.78 7.64 L14.09 11.89 L15.85 18.09 L10 14.55 L4.15 18.09 L5.91 11.89 L1.22 7.64 L7.53 7.35 Z" />      </svg>
    );

    const Sparkle = ({ s = 14, c = '#C084FC', style = {} }) => (
      <svg width={s} height={s} viewBox="0 0 20 20" fill={c} style={{ flexShrink: 0, ...style }}>
        <path d="M10 0 L11.5 8.5 L20 10 L11.5 11.5 L10 20 L8.5 11.5 L0 10 L8.5 8.5 Z" />
      </svg>
    );

    const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

    /* ══ SOUND HELPERS (Tone.js) ══ */
    const _withTone = (fn) => {
      try {
        if (typeof window.Tone === 'undefined') return;
        window.Tone.start().then(fn).catch(() => { });
      } catch (e) { }
    };

    const playSound = () => {
      _withTone(() => {
        try {
          const synth = new window.Tone.Synth({
            oscillator: { type: 'sine' },
            envelope: { attack: .005, decay: .08, sustain: .0, release: .1 },
            volume: -14
          }).toDestination();
          synth.triggerAttackRelease('A4', .09, window.Tone.now());
          setTimeout(() => synth.dispose(), 400);
        } catch (e) { }
      });
    };

    const playFanfare = () => {
      _withTone(() => {
        try {
          const synth = new window.Tone.PolySynth(window.Tone.Synth, {
            oscillator: { type: 'sine' },
            envelope: { attack: .01, decay: .2, sustain: .1, release: .28 },
            volume: -11
          }).toDestination();
          const now = window.Tone.now();
          [
            [['C5', 'E5'], 0],
            [['E5', 'G5'], .12],
            [['G5', 'C6'], .24],
            [['C5', 'E5', 'G5', 'C6'], .38]
          ].forEach(([ns, t]) => synth.triggerAttackRelease(ns, .28, now + t));
          setTimeout(() => synth.dispose(), 1800);
        } catch (e) { }      });
    };

    const playSad = () => {
      _withTone(() => {
        try {
          const synth = new window.Tone.PolySynth(window.Tone.Synth, {
            oscillator: { type: 'triangle' },
            envelope: { attack: .02, decay: .3, sustain: .06, release: .3 },
            volume: -13
          }).toDestination();
          const now = window.Tone.now();
          synth.triggerAttackRelease('G4', .32, now);
          synth.triggerAttackRelease('E4', .32, now + .22);
          synth.triggerAttackRelease('D4', .32, now + .46);
          synth.triggerAttackRelease('C4', .45, now + .72);
          setTimeout(() => synth.dispose(), 2000);
        } catch (e) { }
      });
    };

    /* ══ EXPORT GLOBALS ══ */
    window.C = C;
    window.CL = CL;
    window.CD = CD;
    window._shuf = _shuf;
    window.applyShuffleToLesson = applyShuffleToLesson;
    window.Flower = Flower;
    window.Heart = Heart;
    window.Star = Star;
    window.Sparkle = Sparkle;
    window.LETTERS = LETTERS;
    window.playSound = playSound;
    window.playFanfare = playFanfare;
    window.playSad = playSad;

  } catch (e) {
    console.error('[globals] INIT ERROR:', e);
  }
})();