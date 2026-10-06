import React from 'react';

/* ══════════════════════════════════════════════
   🍓 SOUNDS — admin/JS/sounds.jsx
   Admin sounds: save success, delete, error
   ══════════════════════════════════════════════ */
(function () {
  'use strict';

  let _started = false;
  async function ensureAudio() {
    if (_started) return;
    try { await Tone.start(); _started = true; } catch (e) {}
  }
  function isMuted() { return localStorage.getItem('bb_admin_sound_muted') === '1'; }

  /* ── Save success: soft ting ── */
  async function playSave() {
    if (isMuted()) return;
    await ensureAudio();
    try {
      const s = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.4 },
        volume: -10,
      }).toDestination();
      const now = Tone.now();
      s.triggerAttackRelease('D5', '8n', now);
      s.triggerAttackRelease('F#5','8n', now + 0.1);
      s.triggerAttackRelease('A5', '8n', now + 0.2);
      setTimeout(() => s.dispose(), 1200);
    } catch (e) {}
  }

  /* ── Delete: soft pop ── */
  async function playDelete() {
    if (isMuted()) return;
    await ensureAudio();
    try {
      const s = new Tone.MembraneSynth({
        pitchDecay: 0.05, octaves: 4,
        envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.15 },
        volume: -15,
      }).toDestination();
      s.triggerAttackRelease('D2', '8n');
      setTimeout(() => s.dispose(), 600);
    } catch (e) {}
  }

  /* ── Error: bụp bụp ── */
  async function playError() {
    if (isMuted()) return;
    await ensureAudio();
    try {
      const s = new Tone.Synth({
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.1 },
        volume: -16,
      }).toDestination();
      const now = Tone.now();
      s.triggerAttackRelease('C3','16n', now);
      s.triggerAttackRelease('B2','16n', now + 0.12);
      setTimeout(() => s.dispose(), 600);
    } catch (e) {}
  }

  /* ── Click sound ── */
  async function playClick() {
    if (isMuted()) return;
    await ensureAudio();
    try {
      const s = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.07 },
        volume: -22,
      }).toDestination();
      s.triggerAttackRelease('G4','32n');
      setTimeout(() => s.dispose(), 300);
    } catch (e) {}
  }

  /* ── Publish fanfare ── */
  async function playPublish() {
    if (isMuted()) return;
    await ensureAudio();
    try {
      const poly = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle8' },
        envelope: { attack: 0.01, decay: 0.12, sustain: 0.45, release: 0.5 },
        volume: -11,
      }).toDestination();
      const now = Tone.now();
      ['G4','B4','D5','G5'].forEach((n,i) => poly.triggerAttackRelease(n,'8n', now + i*0.09));
      poly.triggerAttackRelease(['G4','B4','D5','G5'],'4n', now + 0.5);
      setTimeout(() => poly.dispose(), 2500);
    } catch (e) {}
  }

  /* ── Attach to button clicks ── */
  document.addEventListener('click', (e) => {
    if (e.target.closest('button')) playClick();
  });

  window.BbAdminSounds = { save: playSave, delete: playDelete, error: playError, publish: playPublish, click: playClick, isMuted };
})();