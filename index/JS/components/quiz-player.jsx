/* ══ QUIZ-PLAYER.JSX ══ */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { gradeAll, gradeQuestion, fmtNum } from '../scoring.js';
import { HLProvider, HLText, hlBlockKey } from './highlighter.jsx';
import { NotesQuick } from './notes.jsx';
(function(){

/* ────────────────────────────────────────────────
   FIX 🔴 Global variable safety
   Resolve all globals ONCE at load-time so the
   component never crashes if a dependency file
   hasn't loaded yet.
──────────────────────────────────────────────── */
const _useRipple = typeof useRipple  !== 'undefined' ? useRipple  : () => () => {};
const _useSwipe  = typeof useSwipe   !== 'undefined' ? useSwipe   : () => ({});
const _LETTERS   = typeof LETTERS    !== 'undefined' ? LETTERS    : ['A','B','C','D','E','F'];
const _Heart     = typeof Heart      !== 'undefined' ? Heart
                 : ({s,c}) => React.createElement('svg',{width:s,height:s,viewBox:'0 0 24 24',fill:c,stroke:'none'},
                     React.createElement('path',{d:'M12 21s-7.5-4.6-10.2-9.3C.3 8.9 1.4 5.4 4.6 4.3c2.1-.7 4.2.1 5.4 1.9.4.6.7 1.2 1 1.8.3-.6.6-1.2 1-1.8 1.2-1.8 3.3-2.6 5.4-1.9 3.2 1.1 4.3 4.6 2.8 7.4C19.5 16.4 12 21 12 21z'}));
const _call = fn => (...a) => { try { if (typeof fn === 'function') fn(...a); } catch {} };

/* ────────────────────────────────────────────────
   🖼 Ảnh minh họa của câu hỏi (q.image = URL công khai)
   - Lazy-load, mờ dần khi tải xong
   - Bấm vào ảnh để phóng to toàn màn hình, bấm lại / Esc để đóng
   - Lỗi mạng: hiện thông báo nhỏ + nút Thử lại (không làm hỏng câu hỏi)
──────────────────────────────────────────────── */
function QuestionImage({ src }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => { setFailed(false); setLoaded(false); setTick(0); }, [src]);
  useEffect(() => {
    if (!zoom) return;
    const h = e => { if (e.key === 'Escape') setZoom(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [zoom]);
  if (!src) return null;
  const url = tick ? src + (src.indexOf('?') >= 0 ? '&' : '?') + 'r=' + tick : src;
  if (failed) {
    return (
      <div style={{marginBottom:13,padding:'12px 14px',borderRadius:18,border:'1.5px dashed rgba(176,124,240,0.35)',fontSize:12,fontWeight:700,color:'#9D7AB8',textAlign:'center'}}>
        Không tải được ảnh minh họa{' '}
        <button onClick={() => { setFailed(false); setLoaded(false); setTick(t => t + 1); }}
          style={{marginLeft:6,padding:'3px 12px',borderRadius:999,border:'1.5px solid rgba(176,124,240,0.4)',background:'transparent',color:'#B07CF0',fontSize:12,fontWeight:800,cursor:'pointer'}}>Thử lại</button>
      </div>
    );
  }
  return (
    <>
      <div style={{marginBottom:13,borderRadius:22,overflow:'hidden',border:'1.5px solid rgba(176,124,240,0.22)',background:'rgba(255,255,255,0.04)',textAlign:'center',minHeight:loaded?0:120}}>
        <img src={url} alt="Ảnh minh họa câu hỏi" loading="lazy" decoding="async"
          onLoad={() => setLoaded(true)} onError={() => setFailed(true)} onClick={() => setZoom(true)}
          style={{display:'block',maxWidth:'100%',maxHeight:320,margin:'0 auto',objectFit:'contain',cursor:'zoom-in',opacity:loaded?1:0,transition:'opacity .25s'}}/>
      </div>
      {zoom && (
        <div onClick={() => setZoom(false)}
          style={{position:'fixed',inset:0,zIndex:99999,background:'rgba(8,1,22,0.92)',display:'flex',alignItems:'center',justifyContent:'center',padding:12,cursor:'zoom-out'}}>
          <img src={url} alt="Ảnh minh họa câu hỏi" style={{maxWidth:'96vw',maxHeight:'92vh',objectFit:'contain',borderRadius:12}}/>
        </div>
      )}
    </>
  );
}

/* ────────────────────────────────────────────────
   🔊 BUILT-IN AUDIO ENGINE (Web Audio API)
   Chạy độc lập — không cần CDN hay file ngoài.
   Fallback sang globals nếu có (playSound, v.v.)
   Tất cả hàm _sfx* đều an toàn (try/catch).
──────────────────────────────────────────────── */
const _AC = (() => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    let ctx = null;
    // lazy-create on first user gesture
    const get = () => {
      if (!ctx) ctx = new Ctx();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    };
    return { get };
  } catch { return null; }
})();

/* Master volume knob — tweak here to taste */
const _VOL = 0.22;

/* ────────────────────────────────────────────────
   🔇 MUTE — cờ ở module scope vì các hàm _sfx* sống
   ngoài component, không thể dùng useState trực tiếp.
   Đồng bộ với localStorage để giữ lựa chọn của HS.
──────────────────────────────────────────────── */
let _muted = false;
try { _muted = localStorage.getItem('qp_muted') === '1'; } catch {}
const _setMutedFlag = (v) => { _muted = !!v; try { localStorage.setItem('qp_muted', _muted ? '1' : '0'); } catch {} };

/* Low-level: play a series of {freq, dur, type, vol, delay} notes */
const _sfxPlay = (notes, masterVol) => {
  if (!_AC || _muted) return;
  try {
    const ctx = _AC.get();
    const mv = masterVol !== undefined ? masterVol : _VOL;
    notes.forEach(({ f, d, t, v, delay, ramp }) => {
      const osc  = ctx.createOscillator();
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

/* ── Âm thanh chọn đáp án (neutral click) ── */
const _sfxClick = () => _sfxPlay([
  { f: 880, d: 0.07, t: 'triangle', v: 0.7 },
  { f: 1100, d: 0.05, t: 'sine', v: 0.4, delay: 0.04 },
]);

/* ── Đúng! — bright ascending chime ── */
const _sfxCorrect = () => _sfxPlay([
  { f: 523, d: 0.10, t: 'triangle', v: 0.8 },
  { f: 659, d: 0.10, t: 'triangle', v: 0.8, delay: 0.09 },
  { f: 784, d: 0.14, t: 'triangle', v: 0.9, delay: 0.18 },
  { f: 1047,d: 0.18, t: 'sine',     v: 0.6, delay: 0.28 },
], 0.28);

/* ── Sai! — dull descending thud ── */
const _sfxWrong = () => _sfxPlay([
  { f: 300, d: 0.10, t: 'sawtooth', v: 0.5 },
  { f: 220, d: 0.18, t: 'sawtooth', v: 0.6, delay: 0.08 },
  { f: 160, d: 0.25, t: 'triangle', v: 0.4, delay: 0.18 },
], 0.24);

/* ── Streak! (>=3) — sparkle arpeggio ── */
const _sfxStreak = (n) => {
  // higher streak = faster + higher pitch
  const base = 523 + Math.min(n - 3, 5) * 40;
  const spd  = Math.max(0.045, 0.08 - (n - 3) * 0.005);
  _sfxPlay([
    { f: base,       d: 0.09, t: 'triangle', v: 0.7 },
    { f: base * 1.25,d: 0.09, t: 'triangle', v: 0.7, delay: spd },
    { f: base * 1.5, d: 0.09, t: 'triangle', v: 0.8, delay: spd * 2 },
    { f: base * 2,   d: 0.14, t: 'sine',     v: 0.6, delay: spd * 3 },
  ], 0.26);
};

/* ── Fanfare — victory jingle (8 notes) ── */
const _sfxFanfare = () => _sfxPlay([
  { f: 523, d: 0.12, t: 'triangle', v: 0.9 },
  { f: 659, d: 0.12, t: 'triangle', v: 0.9, delay: 0.11 },
  { f: 784, d: 0.12, t: 'triangle', v: 0.9, delay: 0.22 },
  { f: 1047,d: 0.18, t: 'sine',     v: 1.0, delay: 0.33 },
  { f: 784, d: 0.09, t: 'triangle', v: 0.7, delay: 0.52 },
  { f: 1047,d: 0.09, t: 'sine',     v: 0.8, delay: 0.62 },
  { f: 1319,d: 0.26, t: 'sine',     v: 1.0, delay: 0.72, ramp: 'slide' },
  // harmony
  { f: 659, d: 0.26, t: 'triangle', v: 0.4, delay: 0.72 },
], 0.30);

/* ── Sad — drooping wah ── */
const _sfxSad = () => _sfxPlay([
  { f: 440, d: 0.14, t: 'sawtooth', v: 0.6 },
  { f: 370, d: 0.18, t: 'sawtooth', v: 0.7, delay: 0.12 },
  { f: 294, d: 0.24, t: 'triangle', v: 0.5, delay: 0.26 },
  { f: 220, d: 0.30, t: 'triangle', v: 0.4, delay: 0.44 },
], 0.26);

/* ── Timer tick (last 10s) ── */
const _sfxTick = () => _sfxPlay([
  { f: 1200, d: 0.04, t: 'square', v: 0.35 },
], 0.18);

/* ── Timer urgent (last 5s) ── */
const _sfxTickUrgent = () => _sfxPlay([
  { f: 1400, d: 0.05, t: 'square', v: 0.5 },
  { f: 1600, d: 0.04, t: 'square', v: 0.4, delay: 0.06 },
], 0.22);

/* ── Navigation swipe ── */
const _sfxNav = () => _sfxPlay([
  { f: 660, d: 0.06, t: 'sine', v: 0.5 },
], 0.15);

/* ── Submit (nộp bài) ── */
const _sfxSubmit = () => _sfxPlay([
  { f: 440, d: 0.08, t: 'triangle', v: 0.6 },
  { f: 550, d: 0.10, t: 'triangle', v: 0.7, delay: 0.07 },
  { f: 660, d: 0.12, t: 'sine',     v: 0.8, delay: 0.15 },
], 0.24);

/* ────────────────────────────────────────────────
   🎵 BGM — Nhạc nền lo-fi học bài (loop, volume nhỏ)
   Nếu có file nhạc thật, điền URL vào _BGM_URL (mp3/ogg
   trên CDN hoặc cùng thư mục). Để rỗng '' → tự động
   dùng pad nhạc nền tổng hợp bằng Web Audio (êm, không
   cần file ngoài, nhưng chất lượng không bằng nhạc thật).
──────────────────────────────────────────────── */
const _BGM_URL = '';
const _BGM_VOL = 0.05;
const _startBgmSynth = () => {
  if (!_AC) return null;
  try {
    const ctx = _AC.get();
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    master.gain.linearRampToValueAtTime(_BGM_VOL, ctx.currentTime + 1.5);

    // Tiếng mưa chill: white-noise loop qua bandpass + lowpass,
    // không dùng oscillator nên không bị rít/hú do cộng hưởng tần số.
    const bufSize = ctx.sampleRate * 2; // loop 2s
    const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1200;
    bandpass.Q.value = 0.6;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 3500;

    // LFO rất chậm làm "mưa" lúc to lúc nhỏ tự nhiên, không tạo cao độ rõ
    const lfo = ctx.createOscillator();
    lfo.type = 'sine'; lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.15;
    const noiseGain = ctx.createGain(); noiseGain.gain.value = 0.85;
    lfo.connect(lfoGain); lfoGain.connect(noiseGain.gain);

    noise.connect(bandpass);
    bandpass.connect(lowpass);
    lowpass.connect(noiseGain);
    noiseGain.connect(master);

    noise.start(); lfo.start();

    return {
      stop: () => {
        try {
          master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.7);
          setTimeout(() => { try { noise.stop(); lfo.stop(); } catch {} }, 750);
        } catch {}
      },
    };
  } catch { return null; }
};

/* ────────────────────────────────────────────────
   Wrapper: ưu tiên globals nếu đã có, fallback
   sang engine nội bộ.
──────────────────────────────────────────────── */
const _playSound   = () => { if (typeof playSound   === 'function') { try { playSound();   } catch {} } else _sfxClick(); };
const _haptic      = _call(typeof haptic      !== 'undefined' ? haptic      : null);
const _playFanfare = () => { if (typeof playFanfare === 'function') { try { playFanfare(); } catch {} } else _sfxFanfare(); };
const _playSad     = () => { if (typeof playSad     === 'function') { try { playSad();     } catch {} } else _sfxSad(); };

/* ────────────────────────────────────────────────
   PERF 🟢 Canvas confetti engine
   Thay 28 <div> React + setTimeout bằng 1 <canvas>
   chạy requestAnimationFrame. Không tốn React
   reconciliation/layout cho từng mảnh — chỉ 1 lần
   vẽ canvas mỗi frame, rẻ hơn nhiều trên máy yếu.
   Tự huỷ canvas + cancelAnimationFrame khi xong.
──────────────────────────────────────────────── */
const _confettiColors=['#F472B6','#A855F7','#6EE7B7','#FCD34D','#FB923C','#60A5FA'];
const _runConfetti=(canvas)=>{
  if(!canvas)return ()=>{};
  const ctx=canvas.getContext('2d');
  if(!ctx)return ()=>{};
  const dpr=Math.min(window.devicePixelRatio||1,2); // cap DPR — tránh canvas khổng lồ trên máy Retina/yếu
  let w=0,h=0;
  const resize=()=>{
    w=window.innerWidth;h=window.innerHeight;
    canvas.width=w*dpr;canvas.height=h*dpr;
    canvas.style.width=w+'px';canvas.style.height=h+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  };
  resize();
  window.addEventListener('resize',resize);

  const N=28;
  const pieces=Array.from({length:N},(_,i)=>({
    x:Math.random()*w,
    y:-20-Math.random()*h*0.3,
    vy:2.2+Math.random()*2.2,
    vx:(Math.random()-0.5)*1.4,
    size:5+Math.random()*7,
    rot:Math.random()*360,
    vr:(Math.random()-0.5)*10,
    color:_confettiColors[i%_confettiColors.length],
    shape:Math.random()>0.5?'circle':'square',
    delay:Math.random()*0.6*60, // frames de delay (≈0.6s @60fps)
    life:0,
  }));

  const DURATION=2200; // ms — khớp với thời lượng cũ
  const start=performance.now();
  let rafId=null;

  const frame=(now)=>{
    const elapsed=now-start;
    if(elapsed>=DURATION){ctx.clearRect(0,0,w,h);return;}
    ctx.clearRect(0,0,w,h);
    pieces.forEach(p=>{
      p.life++;
      if(p.life<p.delay)return;
      p.x+=p.vx;p.y+=p.vy;p.rot+=p.vr;
      p.vy+=0.025; // gravity nhẹ
      const fadeStart=DURATION*0.7;
      const alpha=elapsed>fadeStart?Math.max(0,1-(elapsed-fadeStart)/(DURATION-fadeStart)):1;
      ctx.save();
      ctx.globalAlpha=alpha;
      ctx.translate(p.x,p.y);
      ctx.rotate(p.rot*Math.PI/180);
      ctx.fillStyle=p.color;
      if(p.shape==='circle'){
        ctx.beginPath();ctx.arc(0,0,p.size/2,0,Math.PI*2);ctx.fill();
      }else{
        ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size);
      }
      ctx.restore();
    });
    rafId=requestAnimationFrame(frame);
  };
  rafId=requestAnimationFrame(frame);

  return ()=>{
    if(rafId)cancelAnimationFrame(rafId);
    window.removeEventListener('resize',resize);
    try{ctx.clearRect(0,0,w,h);}catch{}
  };
};

/* ────────────────────────────────────────────────
   FIX 🔴 Duplicated score logic → single pure fn
   FIX 🔴 Null safety: (q.answer||'') everywhere
   Lives outside the component → never re-created.
──────────────────────────────────────────────── */
const computeScore = (questions, answers) => {
  const { s, t } = gradeAll(questions, answers);
  return { s, t };
};

/* Helper: check one question answer for correctness (null-safe) */
/* Điền từ: chuẩn hoá để "A / B", "A/B", "a /b" đều được chấp nhận */
const normFill = (v) => String(v == null ? '' : v)
  .toLowerCase()
  .replace(/[\u2018\u2019`\u00B4]/g, "'")
  .replace(/\s*[\/\uFF0F]\s*/g, '/')
  .replace(/\s+/g, ' ')
  .replace(/[.!?]+$/, '')
  .trim();
const fillMatch = (a, b) => normFill(a) === normFill(b);

const isAnswerCorrect = (q, ans) =>
  q && q.type === 'fill_blank' ? fillMatch(ans, q.answer) : gradeQuestion(q, ans).ok;

/* ── Score display: 10 thay vì 10.0 ── */
const fmtS=v=>fmtNum(v);

/* ────────────────────────────────────────────────
   PERF 🟢 TimerBadge — React.memo
   Tách riêng để không phải tạo lại style object của
   TOÀN BỘ cây JSX cha mỗi khi timeLeft đổi (mỗi giây).
   timeLeft vẫn là nguồn sự thật duy nhất từ cha (để
   khớp chính xác với logic hết-giờ/doSubmit) — memo
   chỉ ngăn các phần KHÁC của cây bị re-render lây.
──────────────────────────────────────────────── */
const fmtTime=s=>{const m=Math.floor(s/60),sec=s%60;return m+':'+String(sec).padStart(2,'0');};
const TimerBadge=React.memo(function TimerBadge({timeLeft,dark}){
  if(timeLeft===null)return null;
  const timerColor=timeLeft<60?'#EF4444':timeLeft<120?'#F59E0B':'#10B981';
  return(
    <div style={{display:'flex',alignItems:'center',gap:5,padding:'4px 12px',borderRadius:999,
      background:dark?'rgba(0,0,0,0.2)':'rgba(255,255,255,0.6)',border:`1.5px solid ${timerColor}44`,boxShadow:`0 0 0 3px ${timerColor}14`,transition:'all .5s cubic-bezier(.22,1,.36,1)'}}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={timerColor} strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      <span style={{fontSize:11,fontWeight:900,color:timerColor,letterSpacing:.3}}>{fmtTime(timeLeft)}</span>
    </div>
  );
});

/* ────────────────────────────────────────────────
   PERF 🟢 NavDots — component riêng + React.memo
   Tránh việc cả mảng "dots" (1 button/câu hỏi) bị
   tạo lại style object mỗi khi QuizPlayer cha
   re-render vì lý do không liên quan (gõ phím, đổi
   timeLeft...). Chỉ re-render khi props thật sự đổi.
──────────────────────────────────────────────── */
const NavDots=React.memo(function NavDots({questions,answers,cur,submitted,onJump,flags,answeredArr}){
  const wrapRef=useRef(null);
  const dotRefs=useRef([]);
  const ripple=_useRipple();
  useEffect(()=>{
    dotRefs.current[cur]?.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});
  },[cur]);
  return(
    <div ref={wrapRef} data-dots="1" style={{flex:1,overflowX:'auto',display:'flex',gap:5,alignItems:'center',scrollbarWidth:'none',WebkitOverflowScrolling:'touch',padding:'4px 2px'}}
      onTouchStart={e=>e.stopPropagation()}
      onTouchMove={e=>e.stopPropagation()}
      onTouchEnd={e=>e.stopPropagation()}>
      {questions.map((q2,i)=>{
        const didAnswer=answeredArr?answeredArr[i]:false;
        let dotColor='rgba(255,150,200,0.28)';
        if(submitted){
          dotColor=isAnswerCorrect(q2,answers[i])?'#10B981':'#EF4444';
        }
        const isActive=i===cur;
        const bg=isActive
          ?(submitted?dotColor:'linear-gradient(135deg,#F472B6,#A855F7)')
          :submitted?dotColor
          :didAnswer?'rgba(155,92,246,0.85)'
          :'rgba(124,92,200,0.12)';
        const txtColor=isActive?'#fff':submitted?'#fff':didAnswer?'#fff':'#8B72C8';
        return(
          <button key={i} ref={el=>{dotRefs.current[i]=el;}} className="ripple-host" onClick={(e)=>{ripple(e);onJump(i);}}
            onMouseEnter={e=>{if(!isActive)e.currentTarget.style.filter='brightness(1.12)';}}
            onMouseLeave={e=>{e.currentTarget.style.filter='none';}}
            style={{
            position:'relative',
            flexShrink:0,width:28,height:28,borderRadius:999,
            border:isActive?'1.5px solid rgba(168,85,247,0.75)':`1.5px solid ${submitted?dotColor:didAnswer?'transparent':'rgba(124,92,200,0.22)'}`,
            padding:0,cursor:'pointer',background:bg,color:txtColor,
            fontSize:11,fontWeight:800,fontFamily:'Nunito,sans-serif',fontVariantNumeric:'tabular-nums',
            display:'flex',alignItems:'center',justifyContent:'center',
            boxShadow:isActive?`0 0 0 3px rgba(168,85,247,0.18),0 2px 8px ${submitted?dotColor+'66':'rgba(168,85,247,0.35)'}`:'none',
            transform:isActive?'scale(1.12)':'scale(1)',
            transition:'all .22s cubic-bezier(.22,1,.36,1)',lineHeight:1,
          }}>
            {i+1}
            {flags?.[i]&&<span style={{position:'absolute',top:-3,right:-3,width:7,height:7,borderRadius:'50%',background:'#FCD34D',boxShadow:'0 0 0 1.5px rgba(0,0,0,0.25)'}}/>}
          </button>
        );
      })}
    </div>
  );
});

/* ════════════════════════════════════════════════
   SCORE DYNAMIC ISLAND TOAST
   Mở từ giữa ra 2 bên  (di-open)
   Đóng từ 2 bên vào giữa (di-close)
   Compact pill → expand card → compact pill
════════════════════════════════════════════════ */
const _injectDIStyles=()=>{
  const id='qp-di-styles';
  if(document.getElementById(id))return;
  const s=document.createElement('style');
  s.id=id;
  s.textContent=`
    @keyframes di-pill-in{
      0%  {width:36px;height:36px;border-radius:50%;opacity:0;transform:translateX(-50%) scaleY(0.6);}
      20% {width:36px;height:36px;border-radius:50%;opacity:1;transform:translateX(-50%) scaleY(1);}
      55% {width:270px;height:52px;border-radius:26px;opacity:1;transform:translateX(-50%) scaleY(1);}
      100%{width:290px;height:56px;border-radius:28px;opacity:1;transform:translateX(-50%) scaleY(1);}
    }
    @keyframes di-pill-out{
      0%  {width:290px;height:56px;border-radius:28px;opacity:1;transform:translateX(-50%) scaleY(1);}
      40% {width:270px;height:52px;border-radius:26px;opacity:1;transform:translateX(-50%) scaleY(1);}
      75% {width:36px;height:36px;border-radius:50%;opacity:1;transform:translateX(-50%) scaleY(1);}
      100%{width:36px;height:36px;border-radius:50%;opacity:0;transform:translateX(-50%) scaleY(0.6);}
    }
    @keyframes di-content-in{
      0%,40%{opacity:0;transform:scale(0.85) translateY(3px);}
      100%  {opacity:1;transform:scale(1) translateY(0);}
    }
  `;
  document.head.appendChild(s);
};

/* ScoreIsland — compact pill giống AchievementToast của dashboard
   Nộp bài → pill xuất hiện 3s → tự tắt. Tap để tắt sớm. */
function ScoreIsland({visible,onClose,pct,s,t,rc,questions,answers}){
  const [leaving,setLeaving]=useState(false);
  const [mounted,setMounted]=useState(false);

  useEffect(()=>{
    if(!visible)return;
    setLeaving(false);
    setMounted(true);
    const leaveT=setTimeout(()=>setLeaving(true),3000);
    const closeT=setTimeout(onClose,3500);
    return()=>{clearTimeout(leaveT);clearTimeout(closeT);};
  },[visible]);

  const handleTap=()=>{setLeaving(true);setTimeout(onClose,450);};

  if(!mounted||!visible&&!leaving)return null;

  const label=pct>=0.8?'Xuất sắc!':pct>=0.5?'Khá tốt!':'Cần ôn thêm';
  const correct=questions.filter((q2,qi)=>isAnswerCorrect(q2,answers[qi])).length;
  const wrong  =questions.length-correct;
  const pillBg='linear-gradient(135deg,rgba(14,6,14,0.97) 0%,rgba(26,10,20,0.97) 100%)';
  const glow=rc;

  return(
    <div
      onClick={handleTap}
      style={{
        position:'fixed',top:12,left:'50%',
        zIndex:10500,
        width:290,height:56,borderRadius:28,
        transform:'translateX(-50%)',
        transformOrigin:'center top',
        background:pillBg,
        boxShadow:`0 0 0 1.5px rgba(255,255,255,0.09), 0 10px 32px rgba(0,0,0,0.6), 0 0 22px ${glow}44`,
        display:'flex',alignItems:'center',gap:11,padding:'0 16px',
        cursor:'pointer',userSelect:'none',overflow:'hidden',
        animation:leaving
          ?'di-pill-out 0.45s cubic-bezier(.55,0,.45,1) both'
          :'di-pill-in  0.55s cubic-bezier(.34,1.3,.64,1) both',
        willChange:'width,height,border-radius,opacity',
      }}
    >
      {/* Glow halo */}
      <div style={{
        position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',
        width:30,height:30,borderRadius:'50%',
        background:glow,opacity:0.15,filter:'blur(9px)',pointerEvents:'none',
      }}/>

      {/* Icon */}
      <div style={{flexShrink:0,position:'relative',zIndex:1,display:'flex',alignItems:'center',justifyContent:'center',
        width:30,height:30,borderRadius:10,
        background:pct>=0.8?'rgba(16,185,129,0.15)':pct>=0.5?'rgba(245,158,11,0.15)':'rgba(239,68,68,0.13)',
        border:`1.5px solid ${rc}55`,
      }}>
        {pct>=0.8
          ?<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={rc} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          :pct>=0.5
            ?<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill={rc} opacity=".9"/></svg>
            :<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={rc} strokeWidth="2.6" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/><circle cx="12" cy="17" r="1" fill={rc}/></svg>
        }
      </div>

      {/* Text */}
      <div style={{
        flex:1,minWidth:0,
        animation:'di-content-in 0.55s cubic-bezier(.34,1.3,.64,1) both',
        position:'relative',zIndex:1,
      }}>
        <div style={{
          fontSize:9,fontWeight:800,color:rc,letterSpacing:'0.6px',
          textTransform:'uppercase',marginBottom:1,fontFamily:'Nunito,sans-serif',
        }}>Kết quả bài thi</div>
        <div style={{
          fontSize:14,fontWeight:900,color:'#f0e6ff',
          whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',lineHeight:1.2,
          fontFamily:'Nunito,sans-serif',
        }}>
          {fmtS(pct*10)}/10 · {label}
        </div>
      </div>

      {/* Đúng/sai badges */}
      <div style={{flexShrink:0,display:'flex',flexDirection:'column',gap:3,position:'relative',zIndex:1,
        animation:'di-content-in 0.55s cubic-bezier(.34,1.3,.64,1) both',
      }}>
        <span style={{fontSize:9,fontWeight:800,color:'#10B981',background:'rgba(16,185,129,0.15)',padding:'1px 6px',borderRadius:999,display:'inline-flex',alignItems:'center',gap:3}}>{correct}<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
        <span style={{fontSize:9,fontWeight:800,color:'#F87171',background:'rgba(239,68,68,0.15)',padding:'1px 6px',borderRadius:999,display:'inline-flex',alignItems:'center',gap:3}}>{wrong}<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>
      </div>

      {/* Dismiss dot */}
      <div style={{flexShrink:0,width:5,height:5,borderRadius:'50%',background:'rgba(255,255,255,0.22)',position:'relative',zIndex:1}}/>
    </div>
  );
}

/* ════════════════════════════════════════════════ */
function QuizPlayerInner({lesson,onBack,dark,setDark,onSaveHistory}){
  const {questions=[],title=''}=lesson;
  const total=questions.length;

  /* LocalStorage key unique to this quiz.
     Trước đây khóa chỉ gồm tiêu đề + số câu → 2 bài trùng tên/cùng số câu trộn đáp án
     của nhau, và 2 học sinh dùng chung máy thấy bài làm dở của nhau.
     Nay gắn theo HỌC SINH + ID bài (fallback tiêu đề cho bài chưa có id). */
  const _uid=(window.LearnsySession?.peekUser?.()||{}).id||'anon';
  const _lid=lesson.id||lesson.lessonId||title;
  const STORAGE_KEY=`quizstate_${_uid}_${_lid}_${total}`;

  /* ── State ── */
  const [answers,setAnswers]=useState(()=>{
    try{
      const sv=JSON.parse(localStorage.getItem(STORAGE_KEY));
      if(sv?.answers?.length===total)return sv.answers;
    }catch{}
    return questions.map(q=>{
      if(q.type==='true_false')return q.items.map(()=>null);
      if(q.type==='multi_select')return[];
      return null;
    });
  });
  const [flags,setFlags]=useState(()=>{
    try{
      const sv=JSON.parse(localStorage.getItem(STORAGE_KEY));
      if(Array.isArray(sv?.flags)&&sv.flags.length===total)return sv.flags;
    }catch{}
    return questions.map(()=>false);
  });
  const [submitted,setSubmitted]=useState(false);
  const [cur,setCur]=useState(()=>{
    try{const sv=JSON.parse(localStorage.getItem(STORAGE_KEY));return Number(sv?.cur)||0;}catch{return 0;}
  });
  const [modal,setModal]=useState(false);
  const [warnModal,setWarnModal]=useState(null);
  const [showExitConfirm,setShowExitConfirm]=useState(false);
  /* ── Giao diện: 'single' (mặc định, mỗi lần 1 câu, vuốt/nút chuyển)
     hoặc 'scroll' (tất cả câu hỏi xếp dọc, cuộn từ trên xuống). Nhớ lựa
     chọn qua các lần vào bài khác nhau (không theo từng bài cụ thể). ── */
  const [viewMode,setViewMode]=useState(()=>{
    try{return localStorage.getItem('qp_viewmode')==='scroll'?'scroll':'single';}catch{return 'single';}
  });
  const toggleViewMode=()=>{
    setViewMode(m=>{
      const nv=m==='single'?'scroll':'single';
      try{localStorage.setItem('qp_viewmode',nv);}catch{}
      return nv;
    });
  };
  const scrollAnchorRefs=useRef([]);
  const [streak,setStreak]=useState(0);
  const [bestStreak,setBestStreak]=useState(0);
  const [timeLeft,setTimeLeft]=useState(()=>{
    if(lesson.timeLimit>0){
      try{const sv=JSON.parse(localStorage.getItem(STORAGE_KEY));if(typeof sv?.timeLeft==='number')return sv.timeLeft;}catch{}
      return lesson.timeLimit*60;
    }
    return null;
  });
  const [showStats,setShowStats]=useState(false);
  const [answerTimes,setAnswerTimes]=useState({});
  const [qStartTime,setQStartTime]=useState(()=>Date.now());
  const timerRef=useRef(null);
  const submitGuardRef=useRef(false);
  // Mỗi lần làm bài có 1 attemptId riêng → server chống lưu trùng khi gửi lại.
  // Đổi lại ở resetQuiz() để lần làm mới được tính là bản ghi mới.
  const attemptIdRef=useRef(null);
  const attemptStartRef=useRef(Date.now());
  const _newAttemptId=()=>{try{if(crypto?.randomUUID)return crypto.randomUUID();}catch{}return 'a_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);};
  const submittedRef=useRef(false);
  const [confettiOn,setConfettiOn]=useState(false);
  const confettiCanvasRef=useRef(null);
  /* ── Slide transition ── */
  const [slideDir,setSlideDir]=useState('idle');
  const slideTimerRef=useRef(null);

  useEffect(()=>{
    const id='qp-slide-styles';
    if(document.getElementById(id))return;
    const s=document.createElement('style');
    s.id=id;
    s.textContent=`
      @keyframes qpSlideInRight{from{opacity:0;transform:translateX(36px);}to{opacity:1;transform:translateX(0);}}
      @keyframes qpSlideInLeft {from{opacity:0;transform:translateX(-36px);}to{opacity:1;transform:translateX(0);}}
      @keyframes qpFadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
      .qp-slide-right{animation:qpSlideInRight .22s cubic-bezier(.22,1,.36,1) both;will-change:transform,opacity;}
      .qp-slide-left {animation:qpSlideInLeft  .22s cubic-bezier(.22,1,.36,1) both;will-change:transform,opacity;}
      .qp-fade-up    {animation:qpFadeUp        .2s cubic-bezier(.22,1,.36,1) both;will-change:transform,opacity;}
      .qp-anim-idle  {opacity:1;transform:none;}
      @media print{
        body *{visibility:hidden !important;}
        #qp-print-area{display:block !important;visibility:visible !important;position:absolute;left:0;top:0;width:100%;color:#000;background:#fff;padding:24px;font-family:Arial,sans-serif;}
        #qp-print-area *{visibility:visible !important;}
      }
    `;
    document.head.appendChild(s);
  },[]);
  const [showExpSheet,setShowExpSheet]=useState(false);
  const [toolsOpen,setToolsOpen]=useState(false); // nút gộp cute → bung ra tải/mute/bgm/layout/dark
  const [expSel,setExpSel]=useState(true); // bài hiện tại, true = selected

  /* ── Mute / BGM / Practice mode (persist qua localStorage) ── */
  const [muted,setMuted]=useState(()=>_muted);
  const toggleMuted=()=>{const nv=!muted;setMuted(nv);_setMutedFlag(nv);};

  const [bgmOn,setBgmOn]=useState(()=>{try{return localStorage.getItem('qp_bgm')==='1';}catch{return false;}});
  const bgmAudioRef=useRef(null);
  const bgmSynthRef=useRef(null);
  const startBgm=()=>{
    if(bgmAudioRef.current||bgmSynthRef.current)return; // đã chạy rồi
    if(_BGM_URL){
      const a=new Audio(_BGM_URL);
      a.loop=true;a.volume=_BGM_VOL;
      a.play().catch(err=>console.warn('[BGM] play() bị chặn:',err));
      bgmAudioRef.current=a;
    }else{
      bgmSynthRef.current=_startBgmSynth();
    }
  };
  const stopBgm=()=>{
    if(bgmAudioRef.current){bgmAudioRef.current.pause();bgmAudioRef.current=null;}
    if(bgmSynthRef.current){bgmSynthRef.current.stop();bgmSynthRef.current=null;}
  };
  // Toggle gọi trực tiếp trong onClick (user gesture) để unlock AudioContext
  // ngay lập tức trên Chrome/Safari mobile — không đợi qua useEffect.
  const toggleBgm=()=>{
    const next=!bgmOn;
    setBgmOn(next);
    try{localStorage.setItem('qp_bgm',next?'1':'0');}catch{}
    if(next){
      if(muted){setMuted(false);_setMutedFlag(false);} // bật nhạc thì tự bỏ mute, tránh "bật mà câm"
      if(_AC)_AC.get(); // resume AudioContext ngay trong tap, không trễ
      startBgm();
    }else{
      stopBgm();
    }
  };
  // Đồng bộ khi muted đổi từ nút loa riêng (không phải từ toggleBgm)
  useEffect(()=>{
    if(!bgmOn)return;
    if(muted)stopBgm();
    else startBgm();
  },[muted]);
  // Dọn dẹp khi unmount component
  useEffect(()=>()=>stopBgm(),[]);

  const [practiceMode,setPracticeMode]=useState(()=>{try{return localStorage.getItem('qp_practice')==='1';}catch{return false;}});
  useEffect(()=>{try{localStorage.setItem('qp_practice',practiceMode?'1':'0');}catch{}},[practiceMode]);

  /* ── Cơ chế 2.0 (chỉ chế độ Luyện tập): XP + combo, quyền 50:50, hiệu ứng nổi ── */
  const [xp,setXp]=useState(0);
  const [fx,setFx]=useState([]);                       // popup nổi: {id,main,sub,kind}
  const [hint,setHint]=useState({left:2,hidden:{}});   // 50:50: còn mấy lượt + đáp án đã loại theo câu
  const fxIdRef=useRef(0);
  const afterPickRef=useRef(null);                     // luôn trỏ tới bản afterPick mới nhất (cho phím tắt)
  const hintRef=useRef(hint);
  const scoredRef=useRef(null);                        // câu đã tính XP — mỗi câu chỉ tính lần chọn đầu
  if(scoredRef.current===null){
    scoredRef.current=new Set();
    answers.forEach((a,i)=>{
      const qq=questions[i]; if(!qq)return;
      const done=qq.type==='multiple'?(a!==null&&a!==undefined)
        :qq.type==='multi_select'?(a||[]).length>0
        :qq.type==='fill_blank'?!!(a||'').trim()
        :qq.type==='true_false'?(a||[]).some(v=>v!==null):false;
      if(done)scoredRef.current.add(i); // câu đã làm từ trước (autosave) → không tính XP lại
    });
  }

  /* ── Touch-drag tracking (kéo theo ngón tay khi vuốt) ──
     cardRef = vùng overflowY:auto (chỉ lo cuộn).
     innerRef = wrapper animation bên trong (chỉ lo transform/opacity
     khi vuốt + slide/fade animation). Tách riêng để không lặp lại vấn
     đề nháy do 1 phần tử vừa bị cuộn vừa bị biến đổi transform. */
  const cardRef=useRef(null);
  const innerRef=useRef(null);
  const dragRef=useRef(null);

  /* ────────────────────────────────────────────────
     PERF 🔴 useMemo for score
     Only recalculates when answers or questions change,
     NOT every second when timeLeft ticks.
  ──────────────────────────────────────────────── */
  const {s,t}=useMemo(()=>computeScore(questions,answers),[answers,questions]);
  const pct=t>0?s/t:0;
  const rc=pct>=0.8?'#10B981':pct>=0.5?'#F59E0B':'#EF4444';

  /* ────────────────────────────────────────────────
     PERF 🔴 useMemo for QC style object
     Only rebuilds when dark mode changes.
  ──────────────────────────────────────────────── */
  const QC=useMemo(()=>({
    text:dark?'#F4EEFF':'#1F1433',
    text2:dark?'#E4DAFA':'#352552',
    textMid:dark?'#A596C8':'#6B5A8E',
    surface:dark?'rgba(255,255,255,0.05)':'rgba(255,255,255,0.88)',
    surfaceQ:dark?'rgba(255,255,255,0.065)':'#FFFFFF',
    border:dark?'rgba(190,170,240,0.14)':'rgba(124,92,200,0.14)',
    borderQ:dark?'rgba(190,170,240,0.2)':'rgba(124,92,200,0.16)',
    optBg:dark?'rgba(255,255,255,0.05)':'#FFFFFF',
    optBorder:dark?'rgba(190,170,240,0.22)':'rgba(124,92,200,0.2)',
    optSel:dark?'rgba(168,110,255,0.2)':'rgba(168,85,247,0.09)',
    navBtn:dark?'rgba(255,255,255,0.06)':'rgba(124,92,200,0.07)',
    navBtnBorder:dark?'rgba(190,170,240,0.26)':'rgba(124,92,200,0.22)',
    navBtnText:dark?'#D9C8FF':'#6B3FC4',
    stickyBg:dark?'rgba(17,9,38,0.9)':'rgba(251,249,255,0.92)',
    stickyBorder:dark?'rgba(190,170,240,0.14)':'rgba(124,92,200,0.12)',
    headerBg:dark?'rgba(20,10,44,0.82)':'rgba(255,255,255,0.86)',
    progressBg:dark?'rgba(190,170,240,0.16)':'rgba(124,92,200,0.12)',
    typeBadge:dark?'rgba(255,255,255,0.08)':'rgba(155,92,246,0.1)',
    tfPassageBg:dark?'rgba(196,181,253,0.07)':'rgba(155,92,246,0.06)',
    inputBg:dark?'rgba(255,255,255,0.07)':'#FFFFFF',
    inputColor:dark?'#F4EEFF':'#1F1433',
    inputBorder:dark?'rgba(196,181,253,0.3)':'rgba(124,92,200,0.3)',
    cardShadow:dark?'0 2px 16px rgba(0,0,0,0.35)':'0 1px 2px rgba(60,30,110,0.05), 0 6px 20px rgba(120,70,220,0.08)',
    optShadowSel:dark?'0 3px 14px rgba(168,85,247,0.24)':'0 4px 16px rgba(168,85,247,0.18)',
  }),[dark]);

  /* ── Ripple & Swipe (safe-wrapped) ── */
  const ripple=_useRipple();

  /* ── Slide-aware navigation ──
     FIX 🔴 Nhấp nháy khi chuyển câu:
     Trước đây vùng câu hỏi có key={cur}, khiến React unmount toàn bộ
     DOM cũ rồi mount lại DOM mới mỗi lần đổi câu (thay vì chỉ update).
     Việc huỷ + dựng lại cây DOM lớn (text, ảnh, input...) trong cùng
     1 frame gây ra khoảng trống/giật hình — đó là hiện tượng nhấp nháy.
     Giờ bỏ key={cur}: DOM được giữ nguyên, React chỉ patch nội dung.
     Để CSS animation (qp-slide-x / qp-fade-up) vẫn re-trigger được mỗi
     lần chuyển câu (vì class name không đổi giữa 2 lần "right" liên
     tiếp nên browser sẽ không tự restart animation), ta ép reflow thủ
     công bằng cách tạm gỡ class rồi gắn lại ở frame kế tiếp. */
  const navTo=(idx)=>{
    if(idx===cur)return;
    const dir=idx>cur?'right':'left';
    clearTimeout(slideTimerRef.current);
    // FIX 🔴 Phòng trường hợp navTo() được gọi (nút mũi tên, phím tắt, dot
    // nav, nhấn nhanh) trong khi vẫn còn inline transform/opacity sót lại
    // từ một lần vuốt dở dang trước đó (touchend bị hụt, ví dụ gesture bị
    // hệ thống huỷ giữa chừng) — xoá sạch để CSS animation kiểm soát toàn
    // quyền transform, tránh nội dung hiện ra bị lệch vị trí.
    if(innerRef.current){innerRef.current.style.transition='';innerRef.current.style.transform='';innerRef.current.style.opacity='';}
    // FIX 🔴 Nháy khi chuyển câu (lần 3 — sửa tận gốc):
    // Trước đây bước "gỡ class" tạm set slideDir về 'none', nhưng ở JSX
    // render, 'none' lại fallback sang class 'qp-fade-up' — một class CÓ
    // animation riêng (opacity 0→1). Nghĩa là mỗi lần chuyển câu, div bị
    // chạy NHẦM animation fade-up trong khoảnh khắc giữa 2 rAF, TRƯỚC KHI
    // animation slide thật sự bắt đầu → nội dung mờ-hiện 2 lần liên tiếp
    // trong ~1-2 frame, đó chính là hiện tượng nhấp nháy.
    // Sửa: trạng thái trung gian giờ dùng class 'qp-anim-idle' (opacity:1,
    // transform:none, KHÔNG có animation nào cả) thay vì tái dùng 'none'
    // như một giá trị runtime của slideDir map sang qp-fade-up. Việc "gỡ
    // rồi gắn lại" vẫn cần thiết để browser restart animation khi đi
    // cùng hướng 2 lần liên tiếp (right → right), nhưng giờ khoảng gỡ đó
    // không còn tự ý phát sinh animation nữa.
    setSlideDir('idle');
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        setSlideDir(dir);
        setCur(idx);
      });
    });
    // reset về idle sau 260ms (khớp thời lượng animation mới, rút từ 380ms)
    // để animation có thể re-trigger khi chuyển lại
    slideTimerRef.current=setTimeout(()=>setSlideDir('idle'),280);
  };

  /* ── Drag theo ngón tay: transform bám sát finger qua DOM trực tiếp
     (không qua setState) để mượt 60fps, chỉ commit điều hướng ở touchend. ── */
  const onCardTouchStart=(e)=>{
    if(submitted)return;
    // FIX 🔴 Chạm vào thanh dot-nav bị nhầm thành vuốt chuyển câu:
    // NavDots có onTouchStart/Move/End với e.stopPropagation() riêng,
    // nhưng đó chỉ chặn sự kiện ở tầng React synthetic event. Handler
    // swipe-nav này lại được gắn bằng addEventListener THUẦN (native)
    // trực tiếp trên cardRef — sự kiện touch gốc của trình duyệt vẫn
    // nổi bọt (bubble) lên tới cardRef ở tầng native bất kể React đã
    // "stop" ở tầng synthetic, vì hai hệ thống độc lập nhau. Kết quả:
    // kéo ngón tay trên dải số câu vẫn kích hoạt swipe chuyển câu.
    // Sửa: kiểm tra điểm chạm có bắt nguồn từ vùng dot-nav (đánh dấu
    // bằng data-dots="1") hay không — nếu có thì bỏ qua luôn từ đầu,
    // không khởi tạo dragRef, để cuộn ngang của dot-nav hoạt động độc
    // lập, không bị card cha "cướp" thành thao tác chuyển câu.
    if(e.target.closest?.('[data-dots="1"]'))return;
    // Đang bôi đen chữ để tô/gạch chân → thao tác kéo là chọn chữ, không phải vuốt chuyển câu.
    if(window.LSHL?.hasSelection?.())return;
    const t=e.touches[0];
    dragRef.current={startX:t.clientX,startY:t.clientY,dx:0,dragging:false,decided:false};
  };
  const onCardTouchMove=(e)=>{
    const d=dragRef.current;
    if(!d)return;
    if(window.LSHL?.hasSelection?.()){dragRef.current=null;return;}
    const t=e.touches[0];
    const dx=t.clientX-d.startX, dy=t.clientY-d.startY;
    if(!d.decided){
      if(Math.abs(dx)<8&&Math.abs(dy)<8)return;
      d.decided=true;
      d.dragging=Math.abs(dx)>Math.abs(dy); // ngang mới coi là vuốt câu, dọc để cuộn bình thường
      if(d.dragging&&innerRef.current)innerRef.current.style.transition='none';
    }
    if(!d.dragging)return;
    e.preventDefault?.();
    d.dx=dx;
    if(innerRef.current){
      const damp=dx*0.62; // có lực cản nhẹ, không kéo 1:1
      innerRef.current.style.transform=`translateX(${damp}px)`;
      innerRef.current.style.opacity=String(Math.max(0.45,1-Math.abs(damp)/260));
    }
  };
  const onCardTouchEnd=()=>{
    const d=dragRef.current;
    dragRef.current=null;
    if(!d||!d.dragging)return;
    const dx=d.dx;
    const THRESH=64;
    if(dx<=-THRESH&&cur<total-1){
      // FIX 🔴 Tràn/lệch layout sau khi vuốt chuyển câu:
      // Trước đây chỉ đổi style.transition rồi gọi navTo() ngay, nhưng
      // style.transform (từ lúc kéo tay, vd translateX(-40px)) vẫn còn
      // nằm trên inline style của innerRef. navTo() sau đó gắn class CSS
      // animation (qp-slide-right/left) — nhưng animation "both" chỉ áp
      // keyframe từ khi nó thực sự bắt đầu chạy; trước đó inline style
      // cũ vẫn thắng. Kết quả: câu mới hiện ra khi transform còn lệch,
      // tạo cảm giác nội dung bị đẩy lệch/tràn ra ngoài màn hình.
      // Sửa: xoá sạch inline transform/opacity/transition NGAY trước khi
      // gọi navTo(), để CSS animation là bên duy nhất kiểm soát transform.
      if(innerRef.current){innerRef.current.style.transition='';innerRef.current.style.transform='';innerRef.current.style.opacity='';}
      _sfxNav();navTo(cur+1);
    }
    else if(dx>=THRESH&&cur>0){
      if(innerRef.current){innerRef.current.style.transition='';innerRef.current.style.transform='';innerRef.current.style.opacity='';}
      _sfxNav();navTo(cur-1);
    }
    else if(innerRef.current){
      innerRef.current.style.transition='transform .3s cubic-bezier(.22,1,.36,1), opacity .3s';
      innerRef.current.style.transform='translateX(0)';
      innerRef.current.style.opacity='1';
    }
  };

  /* Gắn bằng addEventListener thuần (không qua JSX onTouchMove) vì React
     đặt onTouchMove ở dạng passive listener mặc định → preventDefault không
     hoạt động và bị browser báo lỗi. touchmove cần {passive:false} mới
     chặn được gesture vuốt-back/forward của trình duyệt khi đang kéo ngang. */
  useEffect(()=>{
    const el=cardRef.current;
    if(!el||viewMode!=='single')return;
    el.addEventListener('touchstart',onCardTouchStart,{passive:true});
    el.addEventListener('touchmove',onCardTouchMove,{passive:false});
    el.addEventListener('touchend',onCardTouchEnd,{passive:true});
    return()=>{
      el.removeEventListener('touchstart',onCardTouchStart);
      el.removeEventListener('touchmove',onCardTouchMove);
      el.removeEventListener('touchend',onCardTouchEnd);
    };
  },[cur,submitted,viewMode]);

  /* ── Effects ── */

  // Timer (runs each second only because timeLeft/submitted changed)
  useEffect(()=>{
    if(timeLeft===null||submittedRef.current||submitGuardRef.current)return;
    if(timeLeft<=0){doSubmit();return;}
    // Tick sounds for countdown urgency
    if(timeLeft<=5)  _sfxTickUrgent();
    else if(timeLeft<=10) _sfxTick();
    timerRef.current=setTimeout(()=>setTimeLeft(t=>t-1),1000);
    return()=>clearTimeout(timerRef.current);
  },[timeLeft,submitted]);

  // Reset question start-time on navigation (chỉ áp dụng chế độ 1-câu-1-lần)
  useEffect(()=>{if(viewMode==='single')setQStartTime(Date.now());},[cur,viewMode]);

  /* FIX 🟡 Scroll to top on question change
     Trước đây dùng window.scrollTo — nếu vùng câu hỏi nằm
     trong container overflowY:'auto' riêng (cardRef) thì lệnh
     đó không có tác dụng. Giờ scroll đúng container đó, kèm
     fallback window.scrollTo cho trường hợp trang ngoài cũng scroll.
     FIX 🔴 behavior:'auto' thay vì 'smooth' — tránh scroll-animation
     chạy song song/cạnh tranh với CSS slide/fade-in animation.
     FIX 🔴 Nháy khi cuộn — sửa tận gốc: animation (qp-slide-x/qp-fade-up)
     giờ nằm trên 1 div con riêng (qp-anim-inner), KHÔNG còn cùng phần
     tử với cardRef (vùng overflowY:auto bị set scrollTop=0 ở đây).
     Vì 2 việc không còn đụng chạm trên cùng 1 phần tử nữa, không cần
     trì hoãn qua requestAnimationFrame nữa — set ngay cũng không gây
     tranh chấp layout/compositor như trước.
     Chỉ áp dụng ở chế độ 'single' — chế độ 'scroll' tự cuộn tự nhiên. */
  useEffect(()=>{
    if(viewMode!=='single')return;
    cardRef.current?.scrollTo({top:0,behavior:'auto'});
    window.scrollTo({top:0,behavior:'auto'});
  },[cur,viewMode]);

  /* ── Chế độ cuộn: theo dõi câu nào đang hiện trong khung nhìn.
     Trước đây dùng IntersectionObserver chọn entry có intersectionRatio
     cao nhất — với câu dài (nhiều lựa chọn/passage dài) so với câu ngắn,
     tỉ lệ giao nhau không so sánh công bằng được, dễ lệch dot. Đổi sang
     cùng thuật toán "mốc gần đỉnh khung nhìn" như bên bản Android: câu
     nào có đỉnh đã cuộn qua mốc 20% chiều cao khung nhìn (item cuối
     cùng thoả điều kiện đó) thì tính là "đang xem" — nhất quán, dễ đoán,
     không phụ thuộc chiều cao từng câu.
     FIX 🔴 Dot-nav không đồng bộ khi cuộn (kẹt ở câu 1):
     Listener trước đây gắn trên window ('scroll'). Nhưng từ khi container
     gốc đổi sang height:'100vh' + overflowY:'hidden' (fix lỗi không cuộn
     được), TRANG (window/document) không còn tự cuộn nữa — chỉ cardRef
     (khung overflowY:'auto' nội bộ) mới thực sự cuộn. Sự kiện 'scroll'
     trên window vì vậy không bao giờ bắn ra khi người dùng cuộn bên
     trong cardRef, nên setCur() không bao giờ được gọi lại. Sửa: gắn
     listener trực tiếp lên cardRef.current thay vì window — getBoundingClientRect()
     của từng câu vẫn cho toạ độ đúng theo viewport nên thuật toán mốc
     20% không cần đổi gì thêm. */
  useEffect(()=>{
    if(viewMode!=='scroll')return;
    const els=scrollAnchorRefs.current.filter(Boolean);
    const scrollEl=cardRef.current;
    if(!els.length||!scrollEl)return;
    let raf=null;
    const update=()=>{
      raf=null;
      const vh=window.innerHeight||document.documentElement.clientHeight;
      const thresholdLine=vh*0.2;
      let idx=0;
      for(let i=0;i<els.length;i++){
        const top=els[i].getBoundingClientRect().top;
        if(top<=thresholdLine)idx=i; else break;
      }
      setCur(idx);
    };
    const onScroll=()=>{if(raf===null)raf=requestAnimationFrame(update);};
    update();
    scrollEl.addEventListener('scroll',onScroll,{passive:true});
    window.addEventListener('resize',onScroll);
    return()=>{
      scrollEl.removeEventListener('scroll',onScroll);
      window.removeEventListener('resize',onScroll);
      if(raf!==null)cancelAnimationFrame(raf);
    };
  },[viewMode,total]);

  // NEW: Save progress to LocalStorage (skipped when submitted)
  useEffect(()=>{
    if(submitted){try{localStorage.removeItem(STORAGE_KEY);}catch{}return;}
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify({answers,cur,timeLeft,flags}));}catch{}
  },[answers,cur,timeLeft,submitted,flags]);

  /* NEW: Keyboard shortcuts
     A/B/C/D hoặc 1/2/3/4 → chọn option cho trắc nghiệm / chọn nhiều
     ← → → chuyển câu hỏi
     Enter (khi KHÔNG focus vào button) → sang câu tiếp / nộp bài ở câu cuối
     Space khi không có gì focus → chặn cuộn trang ngoài ý muốn
     Không làm gì khi đang focus vào input/textarea (input tự xử lý riêng). */
  useEffect(()=>{
    const handler=(e)=>{
      if(submitted)return;
      const tag=document.activeElement?.tagName;
      if(tag==='INPUT'||tag==='TEXTAREA')return;
      if(viewMode==='single'){
        if(e.key==='ArrowRight'&&cur<total-1){navTo(cur+1);_sfxNav();return;}
        if(e.key==='ArrowLeft' &&cur>0)      {navTo(cur-1);_sfxNav();return;}
        if(e.key==='Enter'){
          // Nếu đang focus 1 button thì để hành vi click gốc của button tự xử lý,
          // tránh bị nhảy câu 2 lần (1 lần do click, 1 lần do handler này).
          if(tag==='BUTTON')return;
          if(cur<total-1){navTo(cur+1);_sfxNav();}else handleSubmit();
          return;
        }
      }
      if(e.key===' '&&tag!=='BUTTON'){e.preventDefault();return;}
      const cq=questions[cur];
      if(!cq)return;
      if(cq.type==='multiple'||cq.type==='multi_select'){
        const k=e.key.toLowerCase();
        let idx=-1;
        if('abcdef'.includes(k))idx='abcdef'.indexOf(k);
        else if(k>='1'&&k<='6')idx=Number(k)-1;
        if(idx>=0&&idx<(cq.options||[]).length){
          if(cq.type==='multiple'){
            if((hintRef.current.hidden[cur]||[]).includes(idx))return; // đáp án đã bị 50:50 loại
            const sv=answers[cur];const nv=sv===idx?null:idx;
            setAnswers(prev=>{const n=[...prev];n[cur]=nv;return n;});
            if(nv!==null){ _sfxClick(); if(afterPickRef.current)afterPickRef.current(cur,nv); }
          }else{
            const msv=answers[cur]||[];
            setAnswers(prev=>{const n=[...prev];n[cur]=msv.includes(idx)?msv.filter(x=>x!==idx):[...msv,idx];return n;});
            _sfxClick();
          }
        }
      }
    };
    window.addEventListener('keydown',handler);
    return()=>window.removeEventListener('keydown',handler);
  },[cur,submitted,answers,questions,total,viewMode]);

  /* ── Helpers (non-hook) ── */
  // fmtTime/timerColor giờ nằm trong TimerBadge (module scope), không cần ở đây nữa

  // Canvas confetti: chạy rAF loop khi confettiOn bật, tự dọn khi tắt/unmount
  useEffect(()=>{
    if(!confettiOn)return;
    const stop=_runConfetti(confettiCanvasRef.current);
    const t=setTimeout(()=>setConfettiOn(false),2200);
    return ()=>{stop();clearTimeout(t);};
  },[confettiOn]);

  const spawnConfetti=()=>{setConfettiOn(true);};

  /* ── Early return (after ALL hooks) ── */
  const q=questions[cur];
  if(!q)return null;

  const ti={
    true_false: {l:'Đúng / Sai',   c:'#C084FC'},
    multiple:   {l:'Trắc nghiệm',  c:'#F9A8D4'},
    multi_select:{l:'Chọn nhiều',  c:'#6EE7B7'},
    fill_blank: {l:'Điền chỗ trống',c:'#FED7AA'},
  };
  const infoFor=(qq)=>ti[qq.type]||ti.multiple;

  /* Practice mode: hiện đáp án đúng/sai NGAY khi đã trả lời câu, không
     cần đợi Nộp bài. Các hàm dưới đây nhận qi tường minh (thay vì chỉ
     dựa vào `cur`) để dùng lại được cho cả 2 giao diện: single (1 câu/
     lần) và scroll (toàn bộ câu xếp dọc). */
  const isAnsweredAt=(qi)=>{
    const qq=questions[qi];
    return qq.type==='multiple' ? (answers[qi]!==null&&answers[qi]!==undefined) :
      qq.type==='multi_select' ? (answers[qi]||[]).length>0 :
      qq.type==='fill_blank' ? !!(answers[qi]||'').trim() :
      qq.type==='true_false' ? (answers[qi]||[]).some(v=>v!==null) : false;
  };
  const isRevealedAt=(qi)=>submitted||(practiceMode&&isAnsweredAt(qi));

  /* FIX 🔴 Null-safe check */
  const checkCorrectAt=(qi,ans)=>{
    const qq=questions[qi];
    if(qq.type==='multiple')    return ans===qq.correct;
    if(qq.type==='multi_select')return JSON.stringify([...(ans||[])].sort())===JSON.stringify([...(qq.correct||[])].sort());
    if(qq.type==='fill_blank')  return fillMatch(ans,qq.answer);
    if(qq.type==='true_false')  return qq.items.filter((it,ii)=>ans?.[ii]===it.answer).length===qq.items.length;
    return false;
  };

  const setAnswerAt=(qi,v)=>{const n=[...answers];n[qi]=v;setAnswers(n);};
  const toggleFlagAt=(qi)=>{setFlags(prev=>{const n=[...prev];n[qi]=!n[qi];return n;});_sfxClick();};

  const setAnswerWithFeedbackAt=(qi,v)=>{
    setAnswerAt(qi,v);
    const ok=checkCorrectAt(qi,v);
    _haptic(ok?'success':'error');
    const elapsed=Math.round((Date.now()-qStartTime)/1000);
    setAnswerTimes(prev=>({...prev,[qi]:elapsed}));
    if(ok){
      const ns=streak+1;
      setStreak(ns);
      setBestStreak(bs=>Math.max(bs,ns));
      // streak >= 3: sparkle arpeggio thay chime thường
      if(ns>=3) _sfxStreak(ns);
      else _sfxCorrect();
    } else {
      _sfxWrong();
      setStreak(0);
    }
  };

  /* Thin wrapper theo `cur` — giữ nguyên tên cũ để phần JSX chế độ
     single bên dưới không cần sửa gì thêm. */
  const info=infoFor(q);
  const answeredCur=isAnsweredAt(cur);
  const questionRevealed=isRevealedAt(cur);
  const checkCurrent=(ans)=>checkCorrectAt(cur,ans);
  const setA=(v)=>setAnswerAt(cur,v);
  const setAWithFeedback=(v)=>setAnswerWithFeedbackAt(cur,v);
  const toggleFlag=()=>toggleFlagAt(cur);

  /* ── XP / combo / 50:50 ── */
  hintRef.current=hint;
  const pushFx=(main,sub,kind)=>{
    const id=++fxIdRef.current;
    setFx(prev=>[...prev.slice(-1),{id,main,sub,kind}]);
    setTimeout(()=>setFx(prev=>prev.filter(f=>f.id!==id)),1150);
  };
  /* Gọi sau mỗi lần chọn đáp án. Chỉ chạy ở Luyện tập, chỉ tính lần chọn ĐẦU của mỗi câu
     (đổi đáp án để "săn" streak/XP không có tác dụng). Câu nhiều đáp án (multi_select)
     không có tín hiệu "xong" rõ ràng nên chưa tính XP. */
  const afterPick=(qi,v)=>{
    if(!practiceMode||submitted)return;
    const qq=questions[qi]; if(!qq||scoredRef.current.has(qi))return;
    let done=false;
    if(qq.type==='multiple')done=v!==null&&v!==undefined;
    else if(qq.type==='true_false')done=Array.isArray(v)&&v.length===qq.items.length&&v.every(x=>x!==null);
    else if(qq.type==='fill_blank')done=!!String(v||'').trim();
    if(!done)return;
    scoredRef.current.add(qi);
    const ok=checkCorrectAt(qi,v);
    _haptic(ok?'success':'error');
    const elapsed=viewMode==='single'?Math.max(0,Math.round((Date.now()-qStartTime)/1000)):null;
    if(elapsed!==null)setAnswerTimes(prev=>({...prev,[qi]:elapsed}));
    if(ok){
      const ns=streak+1;
      setStreak(ns);
      setBestStreak(b=>Math.max(b,ns));
      const gain=10+(ns>=8?15:ns>=5?10:ns>=3?5:0)+(elapsed!==null&&elapsed<=6?3:0);
      setXp(x=>x+gain);
      pushFx('+'+gain+' XP',ns>=3?'Combo x'+ns:'','ok');
      if(ns>=3)_sfxStreak(ns);else _sfxCorrect();
    }else{
      setStreak(0);
      pushFx('Chưa đúng','Cố lên câu sau!','bad');
      _sfxWrong();
    }
  };
  afterPickRef.current=afterPick;

  /* 50:50 — loại 2 đáp án sai của câu trắc nghiệm hiện tại (còn 2 lượt/bài, chỉ khi Luyện tập) */
  const applyHint5050=()=>{
    if(!practiceMode||submitted||hint.left<=0)return;
    const qq=questions[cur];
    if(!qq||qq.type!=='multiple'||isAnsweredAt(cur)||hint.hidden[cur])return;
    const wrong=qq.options.map((_,i)=>i).filter(i=>i!==qq.correct);
    if(wrong.length<2)return;
    const picked=[...wrong].sort(()=>Math.random()-0.5).slice(0,Math.min(2,wrong.length-1));
    setHint(h=>({left:h.left-1,hidden:{...h.hidden,[cur]:picked}}));
    _sfxClick();
  };
  const hiddenAt=(qi)=>hint.hidden[qi]||[];

  /* ── Render 1 câu hỏi đầy đủ (passage/text/options/giải thích) — dùng
     cho chế độ 'scroll' (map qua toàn bộ câu). Chế độ 'single' vẫn giữ
     nguyên khối JSX cũ bên dưới (không đổi) để tránh rủi ro khi refactor. */
  const renderQuestionCard=(qq,qi)=>{
    const qInfo=infoFor(qq);
    const qRevealed=isRevealedAt(qi);
    const qSetA=(v)=>setAnswerAt(qi,v);
    return(
      <div key={qi} ref={el=>{scrollAnchorRefs.current[qi]=el;}}
        style={{background:QC.surface,border:`1.5px solid ${QC.border}`,borderRadius:22,padding:'14px',marginBottom:16,boxShadow:QC.cardShadow}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:11}}>
          <span style={{fontSize:11,fontWeight:900,color:qInfo.c,background:QC.typeBadge,padding:'3px 11px',borderRadius:999,border:`1px solid ${qInfo.c}22`}}>Câu {qi+1} · {qInfo.l}</span>
          <button onClick={(e)=>{ripple(e);toggleFlagAt(qi);}} title={flags[qi]?'Bỏ đánh dấu':'Đánh dấu câu này'} className="ripple-host"
            onMouseEnter={e=>{e.currentTarget.style.filter='brightness(1.2)';}}
            onMouseLeave={e=>{e.currentTarget.style.filter='none';}}
            style={{background:'none',border:'none',cursor:'pointer',padding:0,lineHeight:1,display:'flex',opacity:flags[qi]?1:0.32,transform:flags[qi]?'scale(1.18)':'scale(1)',transition:'all .18s',position:'relative',overflow:'hidden'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill={flags[qi]?'#F87171':'none'} stroke={flags[qi]?'#F87171':'currentColor'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
          </button>
        </div>

        {/* Passage (True/False) */}
        {qq.type==='true_false'&&qq.passage&&(
          <div style={{background:QC.tfPassageBg,border:`1.5px solid ${QC.borderQ}`,borderRadius:24,padding:'18px 18px',marginBottom:14,boxShadow:QC.cardShadow}}>
            <div style={{fontSize:12,fontWeight:800,color:'#8B5CF6',letterSpacing:.2,marginBottom:8,display:'flex',alignItems:'center',gap:6}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#B07CF0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              Đoạn tư liệu
            </div>
            <HLText as="p" className="ls-passage-text" style={{fontStyle:'italic',color:QC.text2,marginBottom:qq.source?5:0,lineHeight:1.75}} html={qq.passage} blockKey={hlBlockKey(qq,'p')}/>
            {qq.source&&<p style={{fontSize:11,color:QC.textMid,fontWeight:700,marginTop:5,paddingTop:5,borderTop:`1px dashed ${QC.border}`}}>{qq.source}</p>}
          </div>
        )}

        {/* Question text */}
        {qq.type!=='true_false'&&(
          <div style={{background:QC.surfaceQ,border:`1.5px solid ${QC.borderQ}`,borderRadius:24,padding:'18px 18px',marginBottom:14,boxShadow:QC.cardShadow}}>
            <HLText as="p" className="ls-question-text" style={{fontWeight:700,color:QC.text,lineHeight:1.75,margin:0}} html={qq.question} blockKey={hlBlockKey(qq,'q')}/>
            {qq.type==='multi_select'&&(
              <div style={{display:'flex',alignItems:'center',gap:5,marginTop:8,padding:'4px 10px',borderRadius:999,background:'rgba(110,231,183,0.1)',border:'1px solid rgba(110,231,183,0.3)',width:'fit-content'}}>
                <span style={{fontSize:11,color:'#5CB893',fontWeight:800}}>Chọn nhiều đáp án</span>
              </div>
            )}
          </div>
        )}

        <QuestionImage src={qq.image}/>

        {/* TF items */}
        {qq.type==='true_false'&&(
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {qq.items.map((item,ii)=>{
              const sv=answers[qi]?.[ii];
              const rowRevealed=submitted||(practiceMode&&sv!==null);
              const ok=rowRevealed&&sv===item.answer;
              const bad=rowRevealed&&sv!==null&&sv!==item.answer;
              return(
                <div key={ii} style={{background:ok?'rgba(16,185,129,0.1)':bad?'rgba(239,68,68,0.08)':sv===true?'rgba(16,185,129,0.07)':sv===false?'rgba(239,68,68,0.07)':QC.optBg,border:'1.5px solid '+(ok?'#10B981':bad?'#EF4444':sv===true?'#6EE7B7':sv===false?'#FCA5A5':QC.optBorder),borderRadius:20,padding:'13px 14px',transition:'all .22s',boxShadow:sv!==null?QC.optShadowSel:'none'}}>
                  <div style={{display:'flex',gap:9,marginBottom:11}}>
                    <span style={{minWidth:22,height:22,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:900,background:'rgba(176,124,240,0.18)',color:'#B07CF0',flexShrink:0}}>{String.fromCharCode(97+ii).toUpperCase()}</span>
                    <p className="ls-tf-text" style={{margin:0,color:QC.text2,lineHeight:1.65,fontWeight:600}} dangerouslySetInnerHTML={{__html:item.text}}/>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    <button className="ripple-host" onClick={(e)=>{ripple(e);if(submitted)return;const n=[...(answers[qi]||qq.items.map(()=>null))];n[ii]=n[ii]===true?null:true;qSetA(n);afterPick(qi,n);_sfxClick();}}
                      onMouseEnter={e=>{if(!submitted)e.currentTarget.style.transform='translateY(-1px)';}}
                      onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';}}
                      style={{padding:'8px 0',borderRadius:12,fontSize:12,fontWeight:800,transition:'all .18s',background:sv===true?(rowRevealed?(ok?'rgba(16,185,129,0.25)':'rgba(239,68,68,0.2)'):'rgba(16,185,129,0.18)'):'rgba(16,185,129,0.07)',color:sv===true?(rowRevealed?(ok?'#10B981':'#EF4444'):'#10B981'):'#6EE7B7',border:'1.5px solid '+(sv===true?(rowRevealed?(ok?'#10B981':'#EF4444'):'#10B981'):'rgba(110,231,183,0.35)'),cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:5,position:'relative',overflow:'hidden'}}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Đúng</button>
                    <button className="ripple-host" onClick={(e)=>{ripple(e);if(submitted)return;const n=[...(answers[qi]||qq.items.map(()=>null))];n[ii]=n[ii]===false?null:false;qSetA(n);afterPick(qi,n);_sfxClick();}}
                      onMouseEnter={e=>{if(!submitted)e.currentTarget.style.transform='translateY(-1px)';}}
                      onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';}}
                      style={{padding:'8px 0',borderRadius:12,fontSize:12,fontWeight:800,transition:'all .18s',background:sv===false?(rowRevealed?(ok?'rgba(16,185,129,0.25)':'rgba(239,68,68,0.2)'):'rgba(239,68,68,0.18)'):'rgba(239,68,68,0.07)',color:sv===false?(rowRevealed?(ok?'#10B981':'#EF4444'):'#EF4444'):'#FCA5A5',border:'1.5px solid '+(sv===false?(rowRevealed?(ok?'#10B981':'#EF4444'):'#EF4444'):'rgba(252,165,165,0.35)'),cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:5,position:'relative',overflow:'hidden'}}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Sai</button>
                  </div>
                  {rowRevealed&&<div style={{marginTop:6,textAlign:'right'}}><span style={{fontSize:11,fontWeight:800,color:'#C084FC',background:'rgba(196,181,253,0.15)',padding:'2px 9px',borderRadius:999,display:'inline-flex',alignItems:'center',gap:4}}>Đáp án: {item.answer
                    ?<><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Đúng</>
                    :<><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Sai</>}</span></div>}
                </div>
              );
            })}
          </div>
        )}

        {/* MC / MS */}
        {(qq.type==='multiple'||qq.type==='multi_select')&&(
          <div style={{display:'flex',flexDirection:'column',gap:9}}>
            {qq.options.map((opt,i)=>{
              const sv=qq.type==='multiple'?answers[qi]:(answers[qi]||[]);
              const isSel=qq.type==='multiple'?sv===i:sv.includes(i);
              const isCor=qq.type==='multiple'?qq.correct===i:(qq.correct||[]).includes(i);
              const ok=qRevealed&&isSel&&isCor;
              const bad=qRevealed&&isSel&&!isCor;
              const missed=qRevealed&&!isSel&&isCor;
              const gone=qq.type==='multiple'&&hiddenAt(qi).includes(i);
              return(
                <button key={i} disabled={gone} className={'ripple-host qp2-opt'+(gone?' qp2-opt-gone':'')+(!submitted&&ok?' qp2-pop':'')+(!submitted&&bad?' qp2-shake':'')} onClick={(e)=>{
                  ripple(e);
                  if(submitted||gone)return;
                  if(qq.type==='multiple'){
                    const newVal=sv===i?null:i;qSetA(newVal);
                    if(newVal!==null){_sfxClick();afterPick(qi,newVal);}
                  }else{qSetA(sv.includes(i)?sv.filter(x=>x!==i):[...sv,i]);_sfxClick();}
                }}
                onMouseEnter={e=>{if(!submitted&&!isSel)e.currentTarget.style.borderColor='#B07CF0';}}
                onMouseLeave={e=>{if(!isSel)e.currentTarget.style.borderColor=ok?'#10B981':bad?'#EF4444':missed?'#F59E0B':QC.optBorder;}}
                style={{display:'flex',alignItems:'center',gap:11,background:ok?'rgba(16,185,129,0.12)':bad?'rgba(239,68,68,0.1)':missed?'rgba(245,158,11,0.1)':isSel?QC.optSel:QC.optBg,border:'2px solid '+(ok?'#10B981':bad?'#EF4444':missed?'#F59E0B':isSel?'#9B5CF6':QC.optBorder),borderRadius:20,padding:'12px 14px',minHeight:56,cursor:'pointer',textAlign:'left',transition:'all .22s cubic-bezier(.4,0,.2,1)',width:'100%',boxShadow:isSel?QC.optShadowSel:'none',transform:isSel?'scale(1.005)':'scale(1)',position:'relative',overflow:'hidden'}}>
                  <span style={{width:32,height:32,borderRadius:qq.type==='multiple'?'50%':10,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:900,transition:'all .22s',background:isSel?(qRevealed?(ok?'#10B981':bad?'#EF4444':'linear-gradient(135deg,#B07CF0,#8B5CF6)'):'linear-gradient(135deg,#D490FF,#8B5CF6)'):'rgba(176,124,240,0.14)',color:isSel?'#fff':'#B07CF0'}}>{_LETTERS[i]}</span>
                  <span className="ls-option-text" style={{color:QC.text2,flex:1,fontWeight:600}} dangerouslySetInnerHTML={{__html:opt}}/>
                  {qRevealed&&isCor&&<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><polyline points="20 6 9 17 4 12"/></svg>}
                  {qRevealed&&bad&&<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
                </button>
              );
            })}
          </div>
        )}

        {/* Fill blank */}
        {qq.type==='fill_blank'&&(
          <div>
            <input type="text" autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false" data-lpignore="true" value={answers[qi]||''} onChange={e=>{if(!submitted)qSetA(e.target.value);}}
              placeholder="Nhập câu trả lời..."
              style={{width:'100%',padding:'13px 16px',borderRadius:20,fontSize:14,fontWeight:700,
                color:qRevealed?undefined:QC.inputColor,
                background:qRevealed?(fillMatch(answers[qi],qq.answer)?'rgba(16,185,129,0.1)':'rgba(239,68,68,0.08)'):QC.inputBg,
                border:'1.5px solid '+(qRevealed?(fillMatch(answers[qi],qq.answer)?'#10B981':'#EF4444'):QC.inputBorder),
                outline:'none',fontFamily:'Nunito,sans-serif',boxSizing:'border-box',transition:'border-color .2s,box-shadow .2s',boxShadow:qRevealed?'none':`0 0 0 3px ${QC.inputBorder}22`}}/>
            {qRevealed&&(
              <div style={{marginTop:8,fontSize:13,fontWeight:800,
                color:fillMatch(answers[qi],qq.answer)?'#6EE7B7':'#FCA5A5',
                display:'flex',alignItems:'center',gap:5}}>
                {fillMatch(answers[qi],qq.answer)
                  ?<><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Chính xác!</>
                  :<><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Đáp án đúng: {qq.answer||'—'}</>}
              </div>
            )}
            {!submitted&&qq.hint&&<div style={{marginTop:6,fontSize:12,color:QC.textMid,fontWeight:700,display:'flex',alignItems:'center',gap:5}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a6 6 0 0 0-6 6c0 2.2 1.2 3.7 2.2 4.8.6.6 1.3 1.4 1.5 2.2h4.6c.2-.8.9-1.6 1.5-2.2C16.8 11.7 18 10.2 18 8a6 6 0 0 0-6-6z"/></svg>{qq.hint}</div>}
          </div>
        )}

        {/* Explanation */}
        {qRevealed&&qq.explanation&&(
          <div style={{marginTop:13,background:'rgba(176,124,240,0.07)',border:'1.5px solid rgba(176,124,240,0.28)',borderRadius:20,padding:'12px 14px',boxShadow:'0 2px 12px rgba(176,124,240,0.08)'}}>
            <div style={{fontSize:12,fontWeight:800,color:'#8B5CF6',marginBottom:6,letterSpacing:.2,display:'flex',alignItems:'center',gap:5}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a6 6 0 0 0-6 6c0 2.2 1.2 3.7 2.2 4.8.6.6 1.3 1.4 1.5 2.2h4.6c.2-.8.9-1.6 1.5-2.2C16.8 11.7 18 10.2 18 8a6 6 0 0 0-6-6z"/></svg> Giải thích
            </div>
            <HLText as="div" style={{fontSize:13,color:QC.text2,lineHeight:1.7,fontWeight:500}} html={qq.explanation} blockKey={hlBlockKey(qq,'e')}/>
          </div>
        )}
      </div>
    );
  };

  /* Dùng cho NavDots — biết câu nào đã trả lời để tô sáng ngay cả khi
     chưa nộp bài (trước đây NavDots chỉ tô theo submitted/cur). */
  const answeredArr=questions.map((qq,i)=>isAnsweredAt(i));

  const getUnanswered=()=>questions.reduce((acc,q,qi)=>{
    let empty=false;
    if(q.type==='multiple')    empty=answers[qi]===null||answers[qi]===undefined;
    else if(q.type==='multi_select')empty=!(answers[qi]||[]).length;
    else if(q.type==='fill_blank')  empty=!(answers[qi]||'').trim();
    else if(q.type==='true_false')  empty=!(answers[qi])||answers[qi].some(v=>v===null);
    if(empty)acc.push(qi+1);
    return acc;
  },[]);

  /* doSubmit: MỘT nguồn chấm điểm (gradeAll) cho cả hiển thị, lịch sử
     local lẫn bản lưu server → không thể lệch nhau. */
  const doSubmit=()=>{
    if(submitGuardRef.current)return; // 🔒 chống gọi lại lần 2
    submitGuardRef.current=true;
    submittedRef.current=true;
    setSubmitted(true);

    const {s:hs,t:ht,perQ,diem10:hd10,pct:hpct}=gradeAll(questions,answers);
    if(!attemptIdRef.current)attemptIdRef.current=_newAttemptId();
    const attemptId=attemptIdRef.current;
    const durationSec=Math.max(0,Math.round((Date.now()-attemptStartRef.current)/1000));

    onSaveHistory&&onSaveHistory({
      id:attemptId,attemptId,ts:new Date().toISOString(),
      lessonId:lesson.id||lesson.lessonId||'',
      lessonTitle:title,
      score:hs,total:ht,pct:hpct,diem10:hd10,qCount:questions.length,perQ,durationSec,
    });
    // ── Lưu kết quả lên server (bản ghi riêng, chống trùng bằng attemptId) ──
    if(typeof window.saveQuizResult==='function'){
      window.saveQuizResult({
        attemptId,
        lessonId:   lesson.id||lesson.lessonId||'',
        lessonTitle: title,
        score:      hs,
        total:      ht,
        perQ,
        durationSec,
      }).catch(()=>{});
    }
    // Use locally computed hpct (not stale closure pct) for fanfare decision
    _sfxSubmit();
    setTimeout(()=>{
      _AC?.get(); // wake AudioContext trước khi play fanfare/sad
      setModal(true);
      if(hpct>=70){_playFanfare();spawnConfetti();}else _playSad();
    },420);
  };

  const handleSubmit=()=>{
    const un=getUnanswered();
    if(un.length>0){setWarnModal(un);return;}
    doSubmit();
  };

  const resetQuiz=()=>{
    submitGuardRef.current=false; // 🔒 reset guard cho lần làm mới
    submittedRef.current=false;
    attemptIdRef.current=null;               // lần làm mới = bản ghi mới
    attemptStartRef.current=Date.now();
    setAnswers(questions.map(q=>{
      if(q.type==='true_false')return q.items.map(()=>null);
      if(q.type==='multi_select')return[];
      return null;
    }));
    setSubmitted(false);setModal(false);setCur(0);setStreak(0);
    setBestStreak(0);setAnswerTimes({});setShowStats(false);
    scoredRef.current=new Set();setXp(0);setFx([]);setHint({left:2,hidden:{}});
    setFlags(questions.map(()=>false));
    if(lesson.timeLimit>0)setTimeLeft(lesson.timeLimit*60);
    try{localStorage.removeItem(STORAGE_KEY);}catch{}
  };

  /* ── Xác nhận thoát giữa chừng ──
     Chỉ cần chưa nộp bài (dù chưa trả lời câu nào) là hỏi xác nhận trước
     khi thoát, vì thoát sẽ xoá autosave (localStorage). Đã nộp bài rồi
     thì không còn gì để mất, thoát thẳng luôn. */
  const attemptExit=()=>{
    if(!submitted){setShowExitConfirm(true);return;}
    onBack();
  };
  const confirmExit=()=>{
    setShowExitConfirm(false);
    try{localStorage.removeItem(STORAGE_KEY);}catch{}
    onBack();
  };

  /* ══════════════════════════════════════════════
     JSX
  ════════════════════════════════════════════ */
  return(
    <div className="qp2-root" style={{flex:1,display:'flex',flexDirection:'column',background:'transparent',color:QC.text,height:'100vh',maxHeight:'100dvh',minHeight:0,position:'relative',maxWidth:760,margin:'0 auto',width:'100%',overflowX:'hidden',overflowY:'hidden'}}>
      {/* FIX 🔴 Chế độ cuộn không cuộn được + thanh dot-nav không đứng yên:
          Trước đây container gốc chỉ có minHeight:'100vh' (không phải
          height cố định). Với minHeight, container tự giãn cao theo tổng
          chiều cao nội dung con thay vì bị khoá bằng đúng chiều cao màn
          hình — nghĩa là div cardRef bên dưới (flex:1, overflowY:'auto')
          không bao giờ thực sự bị "ép" vào một khung nhìn giới hạn để
          phải tự cuộn nội bộ. Kết quả: cả TRANG (document/body) cuộn
          thay vì cardRef cuộn, nên:
            1) 'Chế độ cuộn' tưởng như không cuộn nổi (vì thực ra người
               dùng đang cuộn trang ngoài, không phải khung mong đợi).
            2) position:'sticky' của thanh dot-nav bên trong cardRef bám
               theo trang thay vì bám đúng theo cardRef, nên nó trôi/nhảy
               lung tung thay vì đứng yên ở đỉnh khung.
          Sửa: khoá container gốc bằng height:'100vh' + overflowY:'hidden'
          để buộc mọi phần tử con flex:1 phải tự cuộn nội bộ đúng như
          thiết kế ban đầu (cardRef là nơi DUY NHẤT được phép cuộn dọc). */}

      {/* Confetti — canvas, không phải 28 div React */}
      {confettiOn&&(
        <canvas ref={confettiCanvasRef} style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:9998}}/>
      )}

      {/* Header */}
      {fx.length>0&&(
        <div className="qp2-fx-layer" aria-hidden="true">
          {fx.map(f=>(
            <div key={f.id} className={'qp2-fx '+(f.kind==='ok'?'qp2-fx-ok':'qp2-fx-bad')}>
              <div className="qp2-fx-main">{f.main}</div>
              {f.sub&&<div className="qp2-fx-sub">{f.sub}</div>}
            </div>
          ))}
        </div>
      )}
      <div style={{padding:'11px 15px 10px',background:QC.headerBg,borderBottom:`1px solid ${QC.border}`,position:'sticky',top:0,zIndex:50,backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)'}}>
        {!submitted&&(
          <div style={{display:'flex',gap:7,marginBottom:8,alignItems:'center',flexWrap:'wrap'}}>
            {timeLeft!==null&&<TimerBadge timeLeft={timeLeft} dark={dark}/>}
            {streak>=2&&(
              <div key={streak} className="qp2-bump" style={{display:'flex',alignItems:'center',gap:4,padding:'4px 11px',borderRadius:999,background:'rgba(252,211,77,0.1)',border:'1.5px solid rgba(252,211,77,0.4)',boxShadow:'0 0 0 3px rgba(252,211,77,0.07)'}}>
                <svg className="qp2-flame" width="11" height="11" viewBox="0 0 24 24" fill="#F59E0B" stroke="none"><path d="M12 2c1 3-2 4.5-2 7.5 0 1.5 1 2.5 2 2.5s2-1 2-2.5c0-.8-.3-1.3-.6-1.9 1.8 1 3.6 3 3.6 5.9 0 3.6-2.7 6.5-6 6.5s-6-2.9-6-6.5c0-4.5 3-6 4-9 .3-.9.7-1.7 3-2z"/></svg><span style={{fontSize:11,fontWeight:900,color:'#C89700'}}>{streak} liên tiếp</span>
              </div>
            )}
            {practiceMode&&xp>0&&(
              <div className="qp2-xp" title="Điểm XP trong lượt luyện tập này">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#8B5CF6" stroke="none"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z"/></svg>
                <span key={xp} className="qp2-bump">{xp}</span>
              </div>
            )}
            <button className="ripple-host" onClick={(e)=>{ripple(e);setPracticeMode(p=>!p);}} title="Xem giải thích ngay khi làm hay đợi đến lúc nộp bài"
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';}}
              onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';}}
              style={{display:'flex',alignItems:'center',gap:5,padding:'4px 11px',borderRadius:999,border:`1.5px solid ${practiceMode?'rgba(110,231,183,0.45)':QC.navBtnBorder}`,background:practiceMode?'rgba(110,231,183,0.12)':QC.navBtn,cursor:'pointer',position:'relative',overflow:'hidden',transition:'all .15s'}}>
              {practiceMode
                ?<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                :<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={QC.navBtnText} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>}
              <span style={{fontSize:11,fontWeight:900,color:practiceMode?'#10B981':QC.navBtnText}}>{practiceMode?'Luyện tập':'Thi cử'}</span>
            </button>
          </div>
        )}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <button onClick={(e)=>{ripple(e);attemptExit();}} className="ripple-host qp2-iconbtn" aria-label="Quay lại" title="Quay lại"
            style={{border:`1.5px solid ${QC.navBtnBorder}`,background:QC.navBtn,color:QC.navBtnText}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div style={{fontSize:13,fontWeight:900,color:QC.text,textAlign:'center',flex:1,margin:'0 10px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',minWidth:0}}>{title}</div>
          <div style={{position:'relative',display:'flex',alignItems:'center',gap:7,flexShrink:0}}>
            <button className="ripple-host" onClick={(e)=>{ripple(e);setToolsOpen(v=>!v);}} title="Tuỳ chọn"
              onMouseEnter={e=>{e.currentTarget.style.filter='brightness(1.08)';}}
              onMouseLeave={e=>{e.currentTarget.style.filter='none';}}
              style={{width:40,height:40,borderRadius:18,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
                background:'linear-gradient(135deg,#F472B6,#A855F7)',boxShadow:toolsOpen?'0 2px 14px rgba(176,124,240,0.55)':'0 2px 10px rgba(176,124,240,0.35)',
                transform:toolsOpen?'scale(1.08) rotate(8deg)':'scale(1)',transition:'all .25s cubic-bezier(.34,1.56,.64,1)',position:'relative',overflow:'hidden'}}>
              {/* Bé sao lấp lánh cute làm icon gộp */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M12 2c.6 3.4 2 5.6 5 6.5-3 .9-4.4 3.1-5 6.5-.6-3.4-2-5.6-5-6.5 3-.9 4.4-3.1 5-6.5z"/><path d="M19 15c.3 1.6.9 2.6 2.3 3-1.4.4-2 1.4-2.3 3-.3-1.6-.9-2.6-2.3-3 1.4-.4 2-1.4 2.3-3z"/><path d="M5 15c.3 1.6.9 2.6 2.3 3-1.4.4-2 1.4-2.3 3-.3-1.6-.9-2.6-2.3-3 1.4-.4 2-1.4 2.3-3z"/></svg>
            </button>

            {toolsOpen&&(
              <>
                <div onClick={()=>setToolsOpen(false)} style={{position:'fixed',inset:0,zIndex:9990,background:'transparent'}}/>
                <div style={{position:'absolute',top:38,right:0,zIndex:9991,display:'flex',gap:6,padding:'8px',borderRadius:22,
                  background:QC.surface,border:`1.5px solid ${QC.border}`,boxShadow:'0 10px 32px rgba(120,40,140,0.22)',
                  animation:'pop .24s cubic-bezier(.34,1.56,.64,1) both'}}>
                  <button className="ripple-host" onClick={(e)=>{ripple(e);setShowExpSheet(true);setToolsOpen(false);}} title="Tải bài về máy"
                    onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';}}
                    onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';}}
                    style={{width:30,height:30,borderRadius:999,border:`1.5px solid ${QC.navBtnBorder}`,background:QC.navBtn,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',position:'relative',overflow:'hidden',transition:'all .15s'}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F472B6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </button>
                  <button className="ripple-host" onClick={(e)=>{ripple(e);toggleMuted();}} title={muted?'Bật âm thanh':'Tắt âm thanh'}
                    onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';}}
                    onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';}}
                    style={{width:30,height:30,borderRadius:999,border:`1.5px solid ${QC.navBtnBorder}`,background:QC.navBtn,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',position:'relative',overflow:'hidden',transition:'all .15s'}}>
                    {muted
                      ?<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={QC.navBtnText} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                      :<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={QC.navBtnText} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>}
                  </button>
                  <button className="ripple-host" onClick={(e)=>{ripple(e);toggleBgm();}} title={bgmOn?'Tắt nhạc nền':'Bật nhạc nền (lo-fi, nhỏ)'}
                    onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';}}
                    onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';}}
                    style={{width:30,height:30,borderRadius:999,border:`1.5px solid ${bgmOn?'rgba(110,231,183,0.5)':QC.navBtnBorder}`,background:bgmOn?'rgba(110,231,183,0.12)':QC.navBtn,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',position:'relative',overflow:'hidden',transition:'all .15s'}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={bgmOn?'#10B981':QC.navBtnText} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                  </button>
                  <button className="ripple-host" onClick={(e)=>{ripple(e);toggleViewMode();}} title={viewMode==='single'?'Chuyển sang xem tất cả câu (cuộn dọc)':'Chuyển sang xem từng câu'}
                    onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';}}
                    onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';}}
                    style={{width:30,height:30,borderRadius:999,border:`1.5px solid ${viewMode==='scroll'?'rgba(110,231,183,0.5)':QC.navBtnBorder}`,background:viewMode==='scroll'?'rgba(110,231,183,0.12)':QC.navBtn,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',position:'relative',overflow:'hidden',transition:'all .15s'}}>
                    {viewMode==='single'
                      ?<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={QC.navBtnText} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                      :<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>}
                  </button>
                  <button className="ripple-host dm-btn" onClick={(e)=>{ripple(e);setDark(d=>!d);}} title="Đổi giao diện"
                    onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';}}
                    onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';}}
                    style={{width:30,height:30,borderRadius:999,border:`1.5px solid ${QC.navBtnBorder}`,background:QC.navBtn,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',position:'relative',overflow:'hidden',transition:'all .15s'}}>
                    {dark
                      ?<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={QC.navBtnText} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                      :<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={QC.navBtnText} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>}
                  </button>
                </div>
              </>
            )}

            {submitted&&<div style={{padding:'5px 13px',borderRadius:999,fontSize:12,fontWeight:900,color:'#fff',background:`linear-gradient(135deg,${rc}ee,${rc}aa)`,boxShadow:`0 3px 12px ${rc}44`}}>{fmtS(pct*10)}/10</div>}
          </div>
        </div>
        <div className="qp2-progress">
          <div className="qp2-progress-track" style={{background:QC.progressBg}}>
            <div className="qp2-progress-fill" style={{width:`${(cur+1)/total*100}%`}}/>
          </div>
          <span className="qp2-progress-count" style={{color:QC.textMid}}>{cur+1}/{total}</span>
        </div>
        {/* FIX/UI: hàng info cuối header — thiết kế riêng cho chế độ cuộn
            (viewMode==='scroll'), chế độ 1-câu-1-lần giữ NGUYÊN như cũ.
            Lý do tách riêng: ở single mode, `cur`/`flags[cur]` là câu
            đang thực sự active (người dùng đang làm) nên badge loại câu
            + flag + "x/total" gắn với đúng 1 câu là hợp lý. Ở scroll mode,
            `cur` chỉ là ước lượng theo vị trí cuộn (câu gần đỉnh khung
            nhìn nhất) — không có khái niệm "câu đang active" rõ ràng như
            single mode, nên gọn lại chỉ còn "x/15 · Loại câu" căn giữa,
            không kèm badge màu riêng theo loại hay flag của "câu hiện
            tại" (vì chính khái niệm đó mơ hồ hơn ở chế độ cuộn). */}
        {viewMode==='single'?(
        <div style={{display:'flex',justifyContent:'space-between',marginTop:6,alignItems:'center'}}>
          <span style={{fontSize:11,fontWeight:800,color:info.c,background:QC.typeBadge,padding:'2px 10px',borderRadius:999,border:`1px solid ${info.c}22`}}>{info.l}</span>
          <div style={{display:'flex',alignItems:'center',gap:9}}>
            <button className="ripple-host" onClick={(e)=>{ripple(e);toggleFlag();}} title={flags[cur]?'Bỏ đánh dấu':'Đánh dấu câu này'}
              onMouseEnter={e=>{e.currentTarget.style.filter='brightness(1.2)';}}
              onMouseLeave={e=>{e.currentTarget.style.filter='none';}}
              style={{background:'none',border:'none',cursor:'pointer',padding:0,lineHeight:1,display:'flex',opacity:flags[cur]?1:0.32,transform:flags[cur]?'scale(1.18)':'scale(1)',transition:'all .18s',position:'relative',overflow:'hidden'}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill={flags[cur]?'#F87171':'none'} stroke={flags[cur]?'#F87171':'currentColor'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
            </button>
            {!submitted&&(q.type==='multiple'||q.type==='multi_select')&&
              <span className="qp2-kbd-hint" style={{fontSize:10,color:QC.textMid,fontWeight:700,opacity:.6}}>Phím tắt: A–D hoặc 1–4</span>}
          </div>
        </div>
        ):(
        <div style={{textAlign:'center',marginTop:8}}>
          <span style={{fontSize:11,fontWeight:800,color:info.c,background:QC.typeBadge,padding:'3px 12px',borderRadius:999,border:`1px solid ${info.c}22`}}>
            {cur+1}/{total} <span style={{opacity:.5,margin:'0 2px'}}>·</span> {info.l}
          </span>
        </div>
        )}
      </div>

      {/* Dải chấm số câu — CHỈ ở chế độ cuộn, nằm ngay trên vùng câu hỏi
          (không còn là ô sticky riêng bên trong cardRef nữa). Header ở
          trên đã gọn lại (bỏ badge loại câu + flag + A/B/C/D khỏi hàng
          cuối cho scroll mode) nên header thấp hơn, câu hỏi được đẩy
          lên gần hơn. Dải này KHÔNG sticky vì header phía trên đã sticky
          rồi — sticky lồng sticky dễ gây các lỗi định vị/độ cao đã gặp
          trước đó, nên chỉ cần 1 lớp sticky duy nhất (header). */}
      {viewMode==='scroll'&&(
        <div data-dots="1" style={{padding:'8px 15px',borderBottom:`1px solid ${QC.border}`,background:QC.headerBg}}>
          <NavDots questions={questions} answers={answers} cur={cur} submitted={submitted}
            onJump={(idx)=>{scrollAnchorRefs.current[idx]?.scrollIntoView({behavior:'smooth',block:'start'});}} flags={flags} answeredArr={answeredArr}/>
        </div>
      )}

      {/* Question area — KHÔNG dùng key={cur} nữa: trước đây key={cur}
          khiến React unmount/remount toàn bộ DOM mỗi lần đổi câu, gây
          nhấp nháy. Animation giờ được re-trigger thủ công trong navTo()
          bằng cách reset class → force reflow → set class mới.
          FIX 🔴 Nháy khi cuộn (lần 2 — sửa tận gốc): cardRef trước đây
          VỪA là vùng overflowY:auto (bị set scrollTop=0 mỗi lần đổi câu)
          VỪA là phần tử mang class animation (opacity/transform). Hai
          việc đụng vào cùng 1 phần tử cùng lúc là nguyên nhân nháy thật
          sự, không chỉ là vấn đề thời điểm (RAF không giải quyết triệt
          để vì layout vẫn bị động tới khi animation đang chạy).
          Giờ tách hẳn 2 vai trò ra 2 lớp DOM khác nhau:
            - cardRef (div ngoài): CHỈ lo cuộn, không có animation gì cả
              → set scrollTop=0 không bao giờ ảnh hưởng compositor.
            - div trong (qp-anim-inner): CHỈ lo animation slide/fade,
              không bị set scrollTop, không bị động tới khi cuộn.
          Nhờ vậy "cuộn về đầu" và "animation chuyển câu" hoàn toàn độc
          lập, không còn tranh chấp gây nháy nữa. */}
      <div style={{flex:1,minHeight:0,padding:'14px',overflowY:'auto',WebkitOverflowScrolling:'touch',overscrollBehavior:'contain',touchAction:'pan-y'}}
        ref={cardRef}>
      {viewMode==='single'?(
      <div className={slideDir==='right'?'qp-slide-right':slideDir==='left'?'qp-slide-left':'qp-anim-idle'} ref={innerRef}>

        {/* Passage (True/False) */}
        {q.type==='true_false'&&q.passage&&(
          <div style={{background:QC.tfPassageBg,border:`1.5px solid ${QC.borderQ}`,borderRadius:24,padding:'18px 18px',marginBottom:14,boxShadow:QC.cardShadow}}>
            <div style={{fontSize:12,fontWeight:800,color:'#8B5CF6',letterSpacing:.2,marginBottom:8,display:'flex',alignItems:'center',gap:6}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#B07CF0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              Đoạn tư liệu
            </div>
            <HLText as="p" className="ls-passage-text" style={{fontStyle:'italic',color:QC.text2,marginBottom:q.source?5:0,lineHeight:1.75}} html={q.passage} blockKey={hlBlockKey(q,'p')}/>
            {q.source&&<p style={{fontSize:11,color:QC.textMid,fontWeight:700,marginTop:5,paddingTop:5,borderTop:`1px dashed ${QC.border}`}}>{q.source}</p>}
          </div>
        )}

        {/* Question text */}
        {q.type!=='true_false'&&(
          <div style={{background:QC.surfaceQ,border:`1.5px solid ${QC.borderQ}`,borderRadius:24,padding:'18px 18px',marginBottom:14,boxShadow:QC.cardShadow}}>
            <HLText as="p" className="ls-question-text" style={{fontWeight:700,color:QC.text,lineHeight:1.75}} html={q.question} blockKey={hlBlockKey(q,'q')}/>
            {q.type==='multi_select'&&(
              <div style={{display:'flex',alignItems:'center',gap:5,marginTop:8,padding:'4px 10px',borderRadius:999,background:'rgba(110,231,183,0.1)',border:'1px solid rgba(110,231,183,0.3)',width:'fit-content'}}>
                <span style={{fontSize:11,color:'#5CB893',fontWeight:800}}>Chọn nhiều đáp án</span>
              </div>
            )}
          </div>
        )}

        <QuestionImage src={q.image}/>

        {/* TF items */}
        {q.type==='true_false'&&(
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {q.items.map((item,ii)=>{
              const sv=answers[cur]?.[ii];
              const rowRevealed=submitted||(practiceMode&&sv!==null);
              const ok=rowRevealed&&sv===item.answer;
              const bad=rowRevealed&&sv!==null&&sv!==item.answer;
              return(
                <div key={ii} style={{background:ok?'rgba(16,185,129,0.1)':bad?'rgba(239,68,68,0.08)':sv===true?'rgba(16,185,129,0.07)':sv===false?'rgba(239,68,68,0.07)':QC.optBg,border:'1.5px solid '+(ok?'#10B981':bad?'#EF4444':sv===true?'#6EE7B7':sv===false?'#FCA5A5':QC.optBorder),borderRadius:20,padding:'13px 14px',transition:'all .22s',boxShadow:sv!==null?QC.optShadowSel:'none'}}>
                  <div style={{display:'flex',gap:9,marginBottom:11}}>
                    <span style={{minWidth:22,height:22,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:900,background:'rgba(176,124,240,0.18)',color:'#B07CF0',flexShrink:0}}>{String.fromCharCode(97+ii).toUpperCase()}</span>
                    <p className="ls-tf-text" style={{margin:0,color:QC.text2,lineHeight:1.65,fontWeight:600}} dangerouslySetInnerHTML={{__html:item.text}}/>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    <button className="ripple-host" onClick={(e)=>{ripple(e);if(submitted)return;const n=[...(answers[cur]||q.items.map(()=>null))];n[ii]=n[ii]===true?null:true;setA(n);afterPick(cur,n);_sfxClick();}}
                      onMouseEnter={e=>{if(!submitted)e.currentTarget.style.transform='translateY(-1px)';}}
                      onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';}}
                      style={{padding:'8px 0',borderRadius:12,fontSize:12,fontWeight:800,transition:'all .18s',background:sv===true?(rowRevealed?(ok?'rgba(16,185,129,0.25)':'rgba(239,68,68,0.2)'):'rgba(16,185,129,0.18)'):'rgba(16,185,129,0.07)',color:sv===true?(rowRevealed?(ok?'#10B981':'#EF4444'):'#10B981'):'#6EE7B7',border:'1.5px solid '+(sv===true?(rowRevealed?(ok?'#10B981':'#EF4444'):'#10B981'):'rgba(110,231,183,0.35)'),cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:5,position:'relative',overflow:'hidden'}}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Đúng</button>
                    <button className="ripple-host" onClick={(e)=>{ripple(e);if(submitted)return;const n=[...(answers[cur]||q.items.map(()=>null))];n[ii]=n[ii]===false?null:false;setA(n);afterPick(cur,n);_sfxClick();}}
                      onMouseEnter={e=>{if(!submitted)e.currentTarget.style.transform='translateY(-1px)';}}
                      onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';}}
                      style={{padding:'8px 0',borderRadius:12,fontSize:12,fontWeight:800,transition:'all .18s',background:sv===false?(rowRevealed?(ok?'rgba(16,185,129,0.25)':'rgba(239,68,68,0.2)'):'rgba(239,68,68,0.18)'):'rgba(239,68,68,0.07)',color:sv===false?(rowRevealed?(ok?'#10B981':'#EF4444'):'#EF4444'):'#FCA5A5',border:'1.5px solid '+(sv===false?(rowRevealed?(ok?'#10B981':'#EF4444'):'#EF4444'):'rgba(252,165,165,0.35)'),cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:5,position:'relative',overflow:'hidden'}}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Sai</button>
                  </div>
                  {rowRevealed&&<div style={{marginTop:6,textAlign:'right'}}><span style={{fontSize:11,fontWeight:800,color:'#C084FC',background:'rgba(196,181,253,0.15)',padding:'2px 9px',borderRadius:999,display:'inline-flex',alignItems:'center',gap:4}}>Đáp án: {item.answer
                    ?<><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Đúng</>
                    :<><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Sai</>}</span></div>}
                </div>
              );
            })}
          </div>
        )}

        {/* MC / MS */}
        {(q.type==='multiple'||q.type==='multi_select')&&(
          <div style={{display:'flex',flexDirection:'column',gap:9}}>
            {q.options.map((opt,i)=>{
              const sv=q.type==='multiple'?answers[cur]:(answers[cur]||[]);
              const isSel=q.type==='multiple'?sv===i:sv.includes(i);
              const isCor=q.type==='multiple'?q.correct===i:(q.correct||[]).includes(i);
              const ok=questionRevealed&&isSel&&isCor;
              const bad=questionRevealed&&isSel&&!isCor;
              const missed=questionRevealed&&!isSel&&isCor;
              const gone=q.type==='multiple'&&hiddenAt(cur).includes(i);
              return(
                <button key={i} disabled={gone} className={'ripple-host qp2-opt'+(gone?' qp2-opt-gone':'')+(!submitted&&ok?' qp2-pop':'')+(!submitted&&bad?' qp2-shake':'')} onClick={(e)=>{
                  ripple(e);
                  if(submitted||gone)return;
                  if(q.type==='multiple'){
                    const newVal=sv===i?null:i;setA(newVal);
                    if(newVal!==null){_sfxClick();afterPick(cur,newVal);}
                  }else{setA(sv.includes(i)?sv.filter(x=>x!==i):[...sv,i]);_sfxClick();}
                }}
                onMouseEnter={e=>{if(!submitted&&!isSel)e.currentTarget.style.borderColor='#B07CF0';}}
                onMouseLeave={e=>{if(!isSel)e.currentTarget.style.borderColor=ok?'#10B981':bad?'#EF4444':missed?'#F59E0B':QC.optBorder;}}
                style={{display:'flex',alignItems:'center',gap:11,background:ok?'rgba(16,185,129,0.12)':bad?'rgba(239,68,68,0.1)':missed?'rgba(245,158,11,0.1)':isSel?QC.optSel:QC.optBg,border:'2px solid '+(ok?'#10B981':bad?'#EF4444':missed?'#F59E0B':isSel?'#9B5CF6':QC.optBorder),borderRadius:20,padding:'12px 14px',minHeight:56,cursor:'pointer',textAlign:'left',transition:'all .22s cubic-bezier(.4,0,.2,1)',width:'100%',boxShadow:isSel?QC.optShadowSel:'none',transform:isSel?'scale(1.005)':'scale(1)',position:'relative',overflow:'hidden'}}>
                  <span style={{width:32,height:32,borderRadius:q.type==='multiple'?'50%':10,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:900,transition:'all .22s',background:isSel?(questionRevealed?(ok?'#10B981':bad?'#EF4444':'linear-gradient(135deg,#B07CF0,#8B5CF6)'):'linear-gradient(135deg,#D490FF,#8B5CF6)'):'rgba(176,124,240,0.14)',color:isSel?'#fff':'#B07CF0'}}>{_LETTERS[i]}</span>
                  <span className="ls-option-text" style={{color:QC.text2,flex:1,fontWeight:600}} dangerouslySetInnerHTML={{__html:opt}}/>
                  {questionRevealed&&isCor&&<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><polyline points="20 6 9 17 4 12"/></svg>}
                  {questionRevealed&&bad&&<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
                </button>
              );
            })}
          </div>
        )}

        {/* Fill blank */}
        {q.type==='fill_blank'&&(
          <div>
            <input type="text" autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false" data-lpignore="true" value={answers[cur]||''} onChange={e=>{if(!submitted)setA(e.target.value);}}
              onKeyDown={e=>{
                if(e.key==='Enter'&&!submitted&&(answers[cur]||'').trim()){
                  afterPick(cur,answers[cur]);
                  _sfxClick();
                  if(cur<total-1){_sfxNav();navTo(cur+1);}
                  else handleSubmit();
                }
              }}
              placeholder="Nhập câu trả lời... (Enter để tiếp theo)"
              style={{width:'100%',padding:'13px 16px',borderRadius:20,fontSize:14,fontWeight:700,
                color:questionRevealed?undefined:QC.inputColor,
                background:questionRevealed?(fillMatch(answers[cur],q.answer)?'rgba(16,185,129,0.1)':'rgba(239,68,68,0.08)'):QC.inputBg,
                border:'1.5px solid '+(questionRevealed?(fillMatch(answers[cur],q.answer)?'#10B981':'#EF4444'):QC.inputBorder),
                outline:'none',fontFamily:'Nunito,sans-serif',boxSizing:'border-box',transition:'border-color .2s,box-shadow .2s',boxShadow:questionRevealed?'none':`0 0 0 3px ${QC.inputBorder}22`}}/>
            {questionRevealed&&(
              <div style={{marginTop:8,fontSize:13,fontWeight:800,
                color:fillMatch(answers[cur],q.answer)?'#6EE7B7':'#FCA5A5',
                display:'flex',alignItems:'center',gap:5}}>
                {fillMatch(answers[cur],q.answer)
                  ?<><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Chính xác!</>
                  :<><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Đáp án đúng: {q.answer||'—'}</>}
              </div>
            )}
            {!submitted&&q.hint&&<div style={{marginTop:6,fontSize:12,color:QC.textMid,fontWeight:700,display:'flex',alignItems:'center',gap:5}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a6 6 0 0 0-6 6c0 2.2 1.2 3.7 2.2 4.8.6.6 1.3 1.4 1.5 2.2h4.6c.2-.8.9-1.6 1.5-2.2C16.8 11.7 18 10.2 18 8a6 6 0 0 0-6-6z"/></svg>{q.hint}</div>}
          </div>
        )}

        {/* Explanation (hiện sau khi nộp, hoặc ngay khi trả lời nếu đang Practice mode) */}
        {questionRevealed&&q.explanation&&(
          <div style={{marginTop:13,background:dark?'rgba(176,124,240,0.07)':'rgba(176,124,240,0.07)',border:'1.5px solid rgba(176,124,240,0.28)',borderRadius:20,padding:'12px 14px',boxShadow:'0 2px 12px rgba(176,124,240,0.08)'}}>
            <div style={{fontSize:12,fontWeight:800,color:'#8B5CF6',marginBottom:6,letterSpacing:.2,display:'flex',alignItems:'center',gap:5}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a6 6 0 0 0-6 6c0 2.2 1.2 3.7 2.2 4.8.6.6 1.3 1.4 1.5 2.2h4.6c.2-.8.9-1.6 1.5-2.2C16.8 11.7 18 10.2 18 8a6 6 0 0 0-6-6z"/></svg> Giải thích
            </div>
            <HLText as="div" style={{fontSize:13,color:QC.text2,lineHeight:1.7,fontWeight:500}} html={q.explanation} blockKey={hlBlockKey(q,'e')}/>
          </div>
        )}

      </div>
      ):(
      /* ── Giao diện cuộn: toàn bộ câu hỏi xếp dọc, cuộn từ trên xuống.
         Dải chấm tròn giờ nằm trong header phía trên (không sticky
         riêng trong này nữa — xem khối "Dải chấm số câu" ngay trên
         div cardRef). Câu đang hiện trong khung nhìn được đồng bộ vào
         `cur` qua thuật toán theo dõi scroll ở trên. */
      <div>
        {questions.map((qq,qi)=>renderQuestionCard(qq,qi))}
      </div>
      )}

      </div>

      {/* Submit bar */}
      <div className="qp2-dock" style={{borderTop:`1px solid ${QC.stickyBorder}`,background:QC.stickyBg,backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)'}}>
        {viewMode==='single'&&practiceMode&&!submitted&&q.type==='multiple'&&!answeredCur&&(
          <div style={{display:'flex',justifyContent:'center',marginBottom:8}}>
            <button className="ripple-host qp2-hint" onClick={(e)=>{ripple(e);applyHint5050();}}
              disabled={hint.left<=0||!!hint.hidden[cur]}
              title={'Loại bớt 2 đáp án sai (còn '+hint.left+' lượt)'}>
              <span className="qp2-hint-badge">50:50</span>
              {hint.hidden[cur]?'Đã loại đáp án sai':hint.left>0?'Gợi ý · còn '+hint.left+' lượt':'Hết lượt gợi ý'}
            </button>
          </div>
        )}
        {viewMode==='single'&&(
          <div className="qp2-dock-nav">
            <button onClick={(e)=>{ripple(e);if(cur>0){_sfxNav();navTo(cur-1);}}} disabled={cur===0} className="ripple-host qp2-navbtn" aria-label="Câu trước" title="Câu trước"
              style={{background:QC.navBtn,border:`1.5px solid ${QC.navBtnBorder}`,color:QC.navBtnText,opacity:cur===0?0.3:1,cursor:cur===0?'default':'pointer'}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <NavDots questions={questions} answers={answers} cur={cur} submitted={submitted} onJump={navTo} flags={flags} answeredArr={answeredArr}/>
            <button onClick={(e)=>{ripple(e);if(cur<total-1){_sfxNav();navTo(cur+1);}}} disabled={cur===total-1} className="ripple-host qp2-navbtn" aria-label="Câu tiếp theo" title="Câu tiếp theo"
              style={{background:QC.navBtn,border:`1.5px solid ${QC.navBtnBorder}`,color:QC.navBtnText,opacity:cur===total-1?0.3:1,cursor:cur===total-1?'default':'pointer'}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        )}
        {!submitted
          ?<button onClick={(e)=>{ripple(e);handleSubmit();}} className={'ripple-host qp2-submit'+(getUnanswered().length===0?' qp2-submit-ready':'')}>
            <_Heart s={14} c="#fff"/> Nộp bài
          </button>
          :<div style={{display:'flex',gap:9}}>
            <button onClick={(e)=>{ripple(e);resetQuiz();}} className="ripple-host"
              onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,150,200,0.14)';e.currentTarget.style.transform='translateY(-1px)';}}
              onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,150,200,0.07)';e.currentTarget.style.transform='translateY(0)';}}
              style={{flex:1,padding:13,borderRadius:999,border:'1.5px solid rgba(255,150,200,0.28)',background:'rgba(255,150,200,0.07)',color:'#FBAFCE',fontSize:13,fontWeight:900,cursor:'pointer',transition:'all .18s'}}>
              Làm lại
            </button>
            <button className="ripple-host" onClick={(e)=>{ripple(e);setShowStats(true);}}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 6px 22px rgba(16,185,129,0.42)';}}
              onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 4px 16px rgba(16,185,129,0.3)';}}
              style={{flex:1,padding:13,borderRadius:999,border:'none',background:'linear-gradient(135deg,#10B981,#6EE7B7)',color:'#fff',fontSize:13,fontWeight:900,cursor:'pointer',boxShadow:'0 4px 16px rgba(16,185,129,0.3)',transition:'all .18s',position:'relative',overflow:'hidden'}}>
              Thống kê
            </button>
            <button className="ripple-host" onClick={(e)=>{ripple(e);window.print();}} title="In hoặc lưu thành PDF"
              onMouseEnter={e=>{e.currentTarget.style.background='rgba(176,124,240,0.16)';e.currentTarget.style.transform='translateY(-1px)';}}
              onMouseLeave={e=>{e.currentTarget.style.background='rgba(176,124,240,0.08)';e.currentTarget.style.transform='translateY(0)';}}
              style={{flex:1,padding:13,borderRadius:999,border:'1.5px solid rgba(176,124,240,0.3)',background:'rgba(176,124,240,0.08)',color:'#B07CF0',fontSize:13,fontWeight:900,cursor:'pointer',transition:'all .18s',position:'relative',overflow:'hidden'}}>
              In kết quả
            </button>
          </div>}
      </div>

      {/* Vùng dành riêng cho in (ẩn trên màn hình, chỉ hiện khi window.print() — xem CSS @media print) */}
      {submitted&&(
        <div id="qp-print-area" style={{display:'none'}}>
          <h2>{title}</h2>
          <p>Ngày làm bài: {new Date().toLocaleDateString('vi-VN')}</p>
          <p>Điểm: {fmtS(pct*10)}/10 &nbsp;({fmtNum(s)}/{fmtNum(t)} điểm)</p>
          <hr/>
          {questions.map((q2,qi)=>{
            const ok2=isAnswerCorrect(q2,answers[qi]);
            return(
              <div key={qi} style={{marginBottom:10,paddingBottom:6,borderBottom:'1px solid #ccc'}}>
                <strong>Câu {qi+1}:</strong> {ok2?'Đúng':'Sai'}
                {!ok2&&q2.explanation&&(
                  <div style={{marginTop:4,fontSize:13}} dangerouslySetInnerHTML={{__html:'Giải thích: '+q2.explanation}}/>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Stats modal */}
      {showStats&&submitted&&(
        <div onClick={()=>setShowStats(false)} style={{position:'fixed',inset:0,background:'rgba(8,1,22,0.87)',backdropFilter:'blur(18px)',WebkitBackdropFilter:'blur(18px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:10000,padding:16}}>
          <div onClick={e=>e.stopPropagation()} style={{background:dark?'linear-gradient(160deg,#1A0640,#110228)':'linear-gradient(160deg,#FFF0F8,#F4E8FF)',border:`1.5px solid ${dark?'rgba(196,181,253,0.18)':'rgba(220,180,255,0.5)'}`,borderRadius:26,padding:'22px 19px',maxWidth:340,width:'100%',maxHeight:'85vh',overflowY:'auto',animation:'pop .28s cubic-bezier(.34,1.56,.64,1) both',boxShadow:dark?'0 20px 60px rgba(0,0,0,0.55)':'0 20px 60px rgba(140,60,220,0.15)'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16}}>
              <span style={{fontSize:14,fontWeight:900,color:dark?'#F2EAFF':'#2D1245',flex:1}}>Thống kê bài làm</span>
              <button className="ripple-host" onClick={(e)=>{ripple(e);setShowStats(false);}}
                onMouseEnter={e=>{e.currentTarget.style.background='rgba(128,100,180,0.22)';e.currentTarget.style.transform='scale(1.08)';}}
                onMouseLeave={e=>{e.currentTarget.style.background='rgba(128,100,180,0.12)';e.currentTarget.style.transform='scale(1)';}}
                style={{width:28,height:28,borderRadius:999,background:'rgba(128,100,180,0.12)',border:'none',color:dark?'#9B7FC0':'#8060A0',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',position:'relative',overflow:'hidden',transition:'all .15s'}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
            <div style={{textAlign:'center',marginBottom:16}}>
              <div style={{fontSize:40,fontWeight:900,color:rc,lineHeight:1,letterSpacing:-1}}>{fmtS(pct*10)}<span style={{fontSize:18,opacity:0.35,fontWeight:700}}>/10</span></div>
              <div style={{fontSize:12,color:dark?'#9B7FC0':'#8060A0',marginTop:3}}>{fmtNum(s)} / {fmtNum(t)} điểm</div>
              <div style={{height:7,background:'rgba(0,0,0,0.06)',borderRadius:99,margin:'12px 0 10px',overflow:'hidden'}}>
                <div style={{height:'100%',width:`${pct*100}%`,borderRadius:99,background:pct>=0.8?'linear-gradient(90deg,#10B981,#6EE7B7)':pct>=0.5?'linear-gradient(90deg,#F59E0B,#FCD34D)':'linear-gradient(90deg,#EF4444,#FCA5A5)',transition:'width .8s ease'}}/>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9,marginBottom:15}}>
              {[
                ['Streak tốt nhất',`${bestStreak} câu`,'#EEB800','#FEF9C3'],
                ['Trung bình/câu',`${Math.round(Object.values(answerTimes).reduce((a,b)=>a+b,0)/Math.max(Object.keys(answerTimes).length,1))}s`,'#B07CF0','#F3E8FF'],
                ...(xp>0?[['Tổng XP',`${xp} XP`,'#7C3AED','#EDE9FE']]:[]),
              ].map(([l,v,col,bg],_i,_arr)=>(
                <div key={l} style={{gridColumn:(_arr.length%2===1&&_i===_arr.length-1)?'1 / -1':undefined,background:dark?'rgba(255,255,255,0.045)':bg+'55',border:`1px solid ${dark?'rgba(255,255,255,0.08)':col+'33'}`,borderRadius:18,padding:'12px 10px',textAlign:'center'}}>
                  <div style={{fontSize:9,color:dark?'#9B7FC0':'#8060A0',marginBottom:4,fontWeight:700,letterSpacing:.5}}>{l.toUpperCase()}</div>
                  <div style={{fontSize:18,fontWeight:900,color:col}}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{background:dark?'rgba(255,255,255,0.035)':'rgba(176,124,240,0.05)',borderRadius:20,padding:'11px 13px',marginBottom:15,maxHeight:190,overflowY:'auto'}}>
              <div style={{fontSize:9,fontWeight:900,color:dark?'#9B7FC0':'#8060A0',marginBottom:9,letterSpacing:.8}}>TỪNG CÂU</div>
              {questions.map((q2,qi)=>{
                const ok2=isAnswerCorrect(q2,answers[qi]);
                return(
                  <div key={qi} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:qi<questions.length-1?`1px solid ${dark?'rgba(255,255,255,0.04)':'rgba(176,124,240,0.07)'}`:  'none'}}>
                    <span style={{fontSize:12,color:dark?'#9B7FC0':'#8060A0',fontWeight:600}}>Câu {qi+1} <span style={{fontSize:9,opacity:.4}}>{q2.type==='true_false'?'DS':q2.type==='multiple'?'TN':q2.type==='multi_select'?'CN':'DT'}</span></span>
                    <div style={{display:'flex',gap:9,alignItems:'center'}}>
                      {answerTimes[qi]!=null&&<span style={{fontSize:10,color:dark?'#9B7FC0':'#A080B0'}}>{answerTimes[qi]}s</span>}
                      <span style={{fontSize:11,fontWeight:800,color:ok2?'#10B981':'#EF4444',background:ok2?'rgba(16,185,129,0.1)':'rgba(239,68,68,0.08)',padding:'2px 8px',borderRadius:999}}>{ok2?'Đúng':'Sai'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {bestStreak>=3&&<div style={{textAlign:'center',fontSize:12,color:'#C89700',fontWeight:800,marginBottom:11,background:'rgba(252,211,77,0.1)',borderRadius:10,padding:'6px'}}>Streak tốt nhất: {bestStreak} câu liên tiếp!</div>}
            <button className="ripple-host" onClick={(e)=>{ripple(e);resetQuiz();}}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 6px 24px rgba(168,85,247,0.48)';}}
              onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 4px 18px rgba(168,85,247,0.35)';}}
              style={{width:'100%',padding:'12px',borderRadius:999,border:'none',background:'linear-gradient(135deg,#F472B6,#A855F7)',color:'#fff',fontSize:13,fontWeight:900,cursor:'pointer',boxShadow:'0 4px 18px rgba(168,85,247,0.35)',position:'relative',overflow:'hidden',transition:'all .18s'}}>Làm lại</button>
          </div>
        </div>
      )}

      {/* Warn modal */}
      {warnModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(8,1,22,0.87)',backdropFilter:'blur(18px)',WebkitBackdropFilter:'blur(18px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:10000,padding:20}}>
          <div style={{background:dark?'linear-gradient(160deg,#1A0640,#110228)':'linear-gradient(160deg,#FFF5E8,#FFF0F6)',border:'1.5px solid rgba(252,211,77,0.3)',borderRadius:26,padding:'28px 22px',maxWidth:300,width:'100%',textAlign:'center',animation:'pop .3s cubic-bezier(.34,1.56,.64,1) both',boxShadow:dark?'0 20px 60px rgba(0,0,0,0.5)':'0 20px 60px rgba(252,211,77,0.12)'}}>
            <div style={{width:56,height:56,borderRadius:999,background:'rgba(252,211,77,0.12)',border:'2px solid rgba(252,211,77,0.3)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px'}}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#EEB800" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div style={{fontSize:16,fontWeight:900,color:dark?'#FDE68A':'#C89700',marginBottom:8}}>Còn câu chưa làm!</div>
            <div style={{fontSize:13,color:dark?'#C0A0D8':'#806090',marginBottom:20,lineHeight:1.7}}>
              {warnModal.length===1?`Câu ${warnModal[0]} chưa trả lời.`:`${warnModal.length} câu chưa trả lời: câu ${warnModal.join(', ')}.`}
            </div>
            <div style={{display:'flex',gap:9}}>
              <button className="ripple-host" onClick={(e)=>{ripple(e);navTo(warnModal[0]-1);setWarnModal(null);}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(255,150,200,0.1)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                style={{flex:1,padding:'11px 0',borderRadius:999,border:'1.5px solid rgba(255,150,200,0.28)',background:'transparent',color:dark?'#FBAFCE':'#E8547A',fontSize:13,fontWeight:800,cursor:'pointer',transition:'all .18s',position:'relative',overflow:'hidden'}}>Xem lại</button>
              <button className="ripple-host" onClick={(e)=>{ripple(e);setWarnModal(null);doSubmit();}}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 6px 22px rgba(168,85,247,0.48)';}}
                onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 4px 16px rgba(168,85,247,0.35)';}}
                style={{flex:1,padding:'11px 0',borderRadius:999,border:'none',background:'linear-gradient(135deg,#F472B6,#A855F7)',color:'#fff',fontSize:13,fontWeight:800,cursor:'pointer',boxShadow:'0 4px 16px rgba(168,85,247,0.35)',position:'relative',overflow:'hidden',transition:'all .18s'}}>Nộp thôi!</button>
            </div>
          </div>
        </div>
      )}

      {/* Exit confirm modal — tông đỏ/hồng cảnh báo mất dữ liệu, khác
          tông vàng "còn câu chưa làm" ở trên vì 2 tình huống khác nhau. */}
      {/* Ghi nhanh: tờ note gắn với bài này (lưu trong Sổ ghi chú) */}
      <NotesQuick dark={dark} lessonKey={String(_lid)} lessonTitle={title} student={(window.LearnsySession?.peekUser?.()||null)}/>
      {showExitConfirm&&(
        <div onClick={()=>setShowExitConfirm(false)} style={{position:'fixed',inset:0,background:'rgba(8,1,22,0.87)',backdropFilter:'blur(18px)',WebkitBackdropFilter:'blur(18px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:10000,padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:dark?'linear-gradient(160deg,#2A0618,#110228)':'linear-gradient(160deg,#FFF0F3,#FFF0F6)',border:'1.5px solid rgba(251,113,133,0.3)',borderRadius:26,padding:'28px 22px',maxWidth:300,width:'100%',textAlign:'center',animation:'pop .3s cubic-bezier(.34,1.56,.64,1) both',boxShadow:dark?'0 20px 60px rgba(0,0,0,0.5)':'0 20px 60px rgba(225,29,72,0.12)'}}>
            <div style={{width:56,height:56,borderRadius:999,background:'rgba(251,113,133,0.12)',border:'2px solid rgba(251,113,133,0.3)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px'}}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#E11D48" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            </div>
            <div style={{fontSize:16,fontWeight:900,color:dark?'#FECDD3':'#E11D48',marginBottom:8}}>Thoát bài tập?</div>
            <div style={{fontSize:13,color:dark?'#C0A0D8':'#806090',marginBottom:20,lineHeight:1.7}}>
              Bạn đang làm dở bài này. Nếu thoát bây giờ, toàn bộ bài làm sẽ mất và lần sau phải làm lại từ đầu.
            </div>
            <div style={{display:'flex',gap:9}}>
              <button className="ripple-host" onClick={(e)=>{ripple(e);setShowExitConfirm(false);}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(255,150,200,0.1)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                style={{flex:1,padding:'11px 0',borderRadius:999,border:'1.5px solid rgba(255,150,200,0.28)',background:'transparent',color:dark?'#FBAFCE':'#E8547A',fontSize:13,fontWeight:800,cursor:'pointer',transition:'all .18s',position:'relative',overflow:'hidden'}}>Tiếp tục học</button>
              <button className="ripple-host" onClick={(e)=>{ripple(e);confirmExit();}}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 6px 22px rgba(225,29,72,0.48)';}}
                onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 4px 16px rgba(225,29,72,0.35)';}}
                style={{flex:1,padding:'11px 0',borderRadius:999,border:'none',background:'linear-gradient(135deg,#FB7185,#E11D48)',color:'#fff',fontSize:13,fontWeight:800,cursor:'pointer',boxShadow:'0 4px 16px rgba(225,29,72,0.35)',position:'relative',overflow:'hidden',transition:'all .18s'}}>Thoát</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Score Dynamic Island Toast ── */}
      <ScoreIsland
        visible={modal}
        onClose={()=>setModal(false)}
        pct={pct} s={s} t={t} rc={rc}
        questions={questions} answers={answers}
      />

      {/* ── Export bottom sheet ── */}
      {showExpSheet&&(
        <>
          <div onClick={()=>setShowExpSheet(false)} style={{position:'fixed',inset:0,background:'rgba(10,2,25,0.72)',zIndex:8800,backdropFilter:'blur(4px)',WebkitBackdropFilter:'blur(4px)'}}/>
          <div style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:760,zIndex:8801,borderRadius:'28px 28px 0 0',padding:'20px 20px 36px',background:'linear-gradient(160deg,#1E0845,#120330)',borderTop:'1.5px solid rgba(255,150,200,0.2)',boxShadow:'0 -12px 60px rgba(168,85,247,0.3)'}}>
            <div style={{width:36,height:4,borderRadius:99,background:'rgba(255,255,255,0.15)',margin:'0 auto 18px'}}/>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F472B6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span style={{fontSize:15,fontWeight:900,color:'#F0DCE8',flex:1}}>Tải bài về máy</span>
              <button className="ripple-host" onClick={(e)=>{ripple(e);setShowExpSheet(false);}}
                onMouseEnter={e=>{e.currentTarget.style.color='#F472B6';e.currentTarget.style.background='rgba(244,114,182,0.12)';}}
                onMouseLeave={e=>{e.currentTarget.style.color='#8A6080';e.currentTarget.style.background='none';}}
                style={{background:'none',border:'none',cursor:'pointer',padding:4,color:'#8A6080',display:'flex',position:'relative',overflow:'hidden',borderRadius:8,transition:'all .15s'}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <p style={{fontSize:12,color:'#8A6080',marginBottom:16,lineHeight:1.6}}>File HTML hoạt động offline, không cần internet.</p>
            <div onClick={()=>setExpSel(s=>!s)} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 13px',borderRadius:18,border:`1.5px solid ${expSel?'rgba(168,85,247,0.6)':'rgba(255,150,200,0.15)'}`,background:expSel?'rgba(168,85,247,0.1)':'rgba(255,255,255,0.04)',cursor:'pointer',marginBottom:16,transition:'all .15s'}}>
              <div style={{width:18,height:18,borderRadius:6,border:`1.5px solid ${expSel?'#A855F7':'rgba(255,255,255,0.2)'}`,background:expSel?'linear-gradient(135deg,#F472B6,#A855F7)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all .15s'}}>
                {expSel&&<svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1.5 6 4.5 9 10.5 3"/></svg>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:800,color:'#F0DCE8',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{title||'Bài tập'}</div>
                <div style={{fontSize:11,color:'#8A6080',marginTop:2}}>{total} câu hỏi</div>
              </div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="ripple-host" onClick={(e)=>{
                ripple(e);
                if(!expSel){alert('Chọn bài nhé!');return;}
                if(typeof buildExportLiteHTML==='function'){
                  var html=buildExportLiteHTML([lesson]);
                  var blob=new Blob([html],{type:'text/html;charset=utf-8'});
                  var url=URL.createObjectURL(blob);
                  var a=document.createElement('a');
                  a.href=url;a.download=(title||'learnsy-quiz').replace(/[<>:"/\\|?*]/g,'').trim()+'.html';
                  document.body.appendChild(a);a.click();
                  setTimeout(function(){URL.revokeObjectURL(url);a.remove();},1000);
                  setShowExpSheet(false);
                }
              }}
                onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,150,200,0.1)';e.currentTarget.style.transform='translateY(-1px)';}}
                onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.transform='translateY(0)';}}
                style={{flex:1,padding:'11px 0',borderRadius:999,border:'1.5px solid rgba(255,150,200,0.3)',background:'transparent',color:'#F9A8D4',fontSize:13,fontWeight:800,cursor:'pointer',fontFamily:'Nunito,sans-serif',position:'relative',overflow:'hidden',transition:'all .15s'}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:-2,marginRight:4}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Lite
              </button>
              <button className="ripple-host" onClick={(e)=>{
                ripple(e);
                if(!expSel){alert('Chọn bài nhé!');return;}
                if(typeof buildExportHTML==='function'){
                  var html=buildExportHTML([lesson]);
                  var blob=new Blob([html],{type:'text/html;charset=utf-8'});
                  var url=URL.createObjectURL(blob);
                  var a=document.createElement('a');
                  a.href=url;a.download=(title||'learnsy-quiz').replace(/[<>:"/\\|?*]/g,'').trim()+'.html';
                  document.body.appendChild(a);a.click();
                  setTimeout(function(){URL.revokeObjectURL(url);a.remove();},1000);
                  setShowExpSheet(false);
                }
              }}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 6px 24px rgba(168,85,247,0.48)';}}
                onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 4px 18px rgba(168,85,247,0.35)';}}
                style={{flex:1,padding:'11px 0',borderRadius:999,border:'none',background:'linear-gradient(135deg,#F472B6,#A855F7)',color:'#fff',fontSize:13,fontWeight:800,cursor:'pointer',fontFamily:'Nunito,sans-serif',boxShadow:'0 4px 18px rgba(168,85,247,0.35)',position:'relative',overflow:'hidden',transition:'all .18s'}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:-2,marginRight:4}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Full (âm thanh)
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* Bọc bằng HLProvider: học sinh tự gạch chân / tô dạ quang (8 màu), chọn lưu hoặc không lưu.
   Khóa lưu theo HỌC SINH + ID bài (cùng quy tắc với STORAGE_KEY bên trong). */
function QuizPlayer(props){
  const lesson=props.lesson||{};
  const uid=(window.LearnsySession?.peekUser?.()||{}).id||'anon';
  const lid=lesson.id||lesson.lessonId||lesson.title||'lesson';
  return(
    <HLProvider uid={uid} lessonKey={lid} dark={props.dark}>
      <QuizPlayerInner {...props}/>
    </HLProvider>
  );
}
window.QuizPlayer=QuizPlayer;
})();
