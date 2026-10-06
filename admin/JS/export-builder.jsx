import React from 'react';

/* ══ EXPORT-BUILDER.JS ══ */
/* ─────────────────────────────────────────────────────────────────────────────
   export-builder.js  — Learnsy quiz export (Full + Lite)
   Visual design 100% giống index.html
───────────────────────────────────────────────────────────────────────────── */

function _buildTemplate(lessons, withSound, shuffleQ, shuffleA, timerLimit) {
  // Quiz đã xuất đọc field "timeLimit" (không có "r"), trong khi dữ liệu lesson
  // trong app dùng "timerLimit" (có "r") — map lại đây, ưu tiên giá trị đã lưu trên
  // từng lesson, nếu chưa có thì dùng timerLimit truyền vào lúc xuất.
  const lessonsForExport = lessons.map(l => ({
    ...l,
    timeLimit: l.timerLimit || l.timeLimit || timerLimit || null,
  }));
  const escLessons = JSON.stringify(lessonsForExport).replace(/<\/script/gi, '<\\/script');

  const toneScript = withSound
    ? `<script src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.7.77/Tone.js" crossorigin="anonymous" referrerpolicy="no-referrer"><\/script>`
    : '';

  const soundFns = withSound ? `
var _withTone=function(fn){try{if(typeof Tone==='undefined')return;Tone.start().then(fn).catch(function(){});}catch(e){}};
/* Click — soft triangle tick with subtle reverb */
function playClick(){_withTone(function(){try{
  var rev=new Tone.Reverb({decay:.4,wet:.18}).toDestination();
  var s=new Tone.Synth({oscillator:{type:'triangle'},envelope:{attack:.003,decay:.07,sustain:0,release:.08}}).connect(rev);
  s.volume.value=-20;s.triggerAttackRelease('D5','32n');
  setTimeout(function(){s.dispose();rev.dispose();},400);
}catch(e){}});}
/* Correct — bright ascending arpeggio + shimmer */
function playCorrect(){_withTone(function(){try{
  var rev=new Tone.Reverb({decay:.6,wet:.25}).toDestination();
  var cho=new Tone.Chorus(4,.5,0.7).connect(rev).start();
  var s=new Tone.PolySynth(Tone.Synth,{oscillator:{type:'sine4'},envelope:{attack:.01,decay:.18,sustain:.05,release:.35}}).connect(cho);
  s.volume.value=-11;var n=Tone.now();
  s.triggerAttackRelease(['E4','G4','B4'],.22,n);
  s.triggerAttackRelease(['G4','B4','E5'],.28,n+.14);
  s.triggerAttackRelease(['B4','E5','G5'],.32,n+.28);
  var bell=new Tone.Synth({oscillator:{type:'triangle'},envelope:{attack:.005,decay:.3,sustain:0,release:.4}}).connect(rev);
  bell.volume.value=-16;bell.triggerAttackRelease('C6','8n',n+.42);
  setTimeout(function(){s.dispose();cho.dispose();rev.dispose();bell.dispose();},2000);
}catch(e){}});}
/* Wrong — dissonant buzz + low thud */
function playWrong(){_withTone(function(){try{
  var dist=new Tone.Distortion(.3).toDestination();
  var s=new Tone.PolySynth(Tone.Synth,{oscillator:{type:'sawtooth'},envelope:{attack:.01,decay:.18,sustain:.04,release:.22}}).connect(dist);
  s.volume.value=-17;var n=Tone.now();
  s.triggerAttackRelease(['C4','Gb4'],.18,n);
  s.triggerAttackRelease(['B3','F4'],.22,n+.19);
  var thud=new Tone.MembraneSynth({pitchDecay:.05,octaves:4,envelope:{attack:.001,decay:.22,sustain:0,release:.1}}).toDestination();
  thud.volume.value=-14;thud.triggerAttackRelease('C2','8n',n+.38);
  setTimeout(function(){s.dispose();dist.dispose();thud.dispose();},1200);
}catch(e){}});}
/* Fanfare — triumphant brass chord sequence + sparkle bells */
function playFanfare(){_withTone(function(){try{
  var rev=new Tone.Reverb({decay:1.2,wet:.35}).toDestination();
  var cho=new Tone.Chorus(3,.3,0.9).connect(rev).start();
  var s=new Tone.PolySynth(Tone.Synth,{oscillator:{type:'triangle4'},envelope:{attack:.015,decay:.22,sustain:.18,release:.4},volume:-10}).connect(cho);
  var n=Tone.now();
  s.triggerAttackRelease(['C5','E5'],.3,n);
  s.triggerAttackRelease(['E5','G5'],.3,n+.13);
  s.triggerAttackRelease(['G5','C6'],.3,n+.26);
  s.triggerAttackRelease(['C5','E5','G5','C6'],.55,n+.42);
  /* sparkle bells */
  var bell=new Tone.Synth({oscillator:{type:'sine'},envelope:{attack:.004,decay:.35,sustain:0,release:.5}}).connect(rev);
  bell.volume.value=-14;
  ['E6','G6','C7'].forEach(function(note,i){bell.triggerAttackRelease(note,'16n',n+.7+i*.1);});
  setTimeout(function(){s.dispose();cho.dispose();rev.dispose();bell.dispose();},3000);
}catch(e){}});}
/* Sad — slow descending minor with fading reverb */
function playSad(){_withTone(function(){try{
  var rev=new Tone.Reverb({decay:1.8,wet:.45}).toDestination();
  var s=new Tone.PolySynth(Tone.Synth,{oscillator:{type:'triangle'},envelope:{attack:.03,decay:.4,sustain:.1,release:.55},volume:-12}).connect(rev);
  var n=Tone.now();
  s.triggerAttackRelease(['G4','Bb4'],.38,n);
  s.triggerAttackRelease(['F4','Ab4'],.38,n+.28);
  s.triggerAttackRelease(['Eb4','G4'],.38,n+.56);
  s.triggerAttackRelease(['C4','Eb4'],.55,n+.88);
  var low=new Tone.Synth({oscillator:{type:'sine'},envelope:{attack:.02,decay:.5,sustain:0,release:.4}}).connect(rev);
  low.volume.value=-18;low.triggerAttackRelease('C3','4n',n+1.1);
  setTimeout(function(){s.dispose();rev.dispose();low.dispose();},3200);
}catch(e){}});}
/* Streak — rising ping sequence */
function playStreak(n){_withTone(function(){try{
  var rev=new Tone.Reverb({decay:.5,wet:.2}).toDestination();
  var s=new Tone.Synth({oscillator:{type:'sine'},envelope:{attack:.005,decay:.15,sustain:.02,release:.2}}).connect(rev);
  s.volume.value=-14;var t=Tone.now();var notes=['C5','E5','G5','B5','E6'];var cnt=Math.min(n||3,5);
  for(var i=0;i<cnt;i++){s.triggerAttackRelease(notes[i],'16n',t+i*.08);}
  setTimeout(function(){s.dispose();rev.dispose();},1500);
}catch(e){}});}
` : `
function playClick(){}
function playCorrect(){}
function playWrong(){}
function playFanfare(){}
function playSad(){}
function playStreak(){}
`;

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Learnsy · Quiz</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Satisfy&display=swap" rel="stylesheet">
${toneScript}
<style>
*{box-sizing:border-box;margin:0;padding:0;}
:root{
  --ao-grad:linear-gradient(120deg,#7C9CE8 0%,#B98EE8 25%,#F472B6 50%,#FB923C 100%);
  --ao-grad-soft:linear-gradient(120deg,rgba(124,156,232,0.16),rgba(185,142,232,0.16),rgba(244,114,182,0.16),rgba(251,146,60,0.16));
}
html,body{min-height:100vh;font-family:'Nunito',system-ui,sans-serif;background:#FFF5F9;transition:background .3s,color .3s;}
button,input,select{font-family:'Nunito',system-ui,sans-serif;}
::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-thumb{background:rgba(255,140,170,0.3);border-radius:99px;}
body.dark ::-webkit-scrollbar-thumb{background:rgba(200,80,120,0.25);}

/* ── ÁO DÀI GLOW (viền neon gradient dùng chung cho nút & khung câu hỏi) ── */
@keyframes aoGlowPulse{0%,100%{opacity:.55}50%{opacity:1}}
.ao-glow{position:relative;isolation:isolate;}
.ao-glow::before{content:'';position:absolute;inset:-2px;border-radius:inherit;z-index:-1;
  background:var(--ao-grad);background-size:220% 220%;
  animation:shimmer 5s ease infinite,aoGlowPulse 2.6s ease-in-out infinite;
  filter:blur(7px);opacity:.65;transition:opacity .25s,filter .25s;}
.ao-glow:hover::before,.ao-glow:focus-visible::before{opacity:1;filter:blur(9px);}
.ao-glow:active::before{filter:blur(5px);}
.ao-glow-thin{position:relative;isolation:isolate;}
.ao-glow-thin::before{content:'';position:absolute;inset:-1.5px;border-radius:inherit;z-index:-1;
  background:var(--ao-grad);background-size:220% 220%;
  animation:shimmer 5s ease infinite,aoGlowPulse 2.6s ease-in-out infinite;
  filter:blur(4px);opacity:.5;transition:opacity .25s,filter .25s;}
.ao-glow-thin:hover::before{opacity:.85;}

@keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
@keyframes shimmer{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
@keyframes float{0%,100%{transform:translateY(0) rotate(-4deg)}50%{transform:translateY(-5px) rotate(4deg)}}
@keyframes floatB{0%,100%{transform:translateY(0) rotate(3deg)}50%{transform:translateY(-4px) rotate(-3deg)}}
@keyframes pop{0%{transform:scale(.8);opacity:0}100%{transform:scale(1);opacity:1}}
@keyframes cfDrop{0%{transform:translateY(-20px) rotate(0deg);opacity:1}100%{transform:translateY(110vh) rotate(720deg);opacity:0}}
@keyframes scoreIn{0%{transform:scale(0.7) translateY(30px);opacity:0}60%{transform:scale(1.06) translateY(-4px);opacity:1}100%{transform:scale(1) translateY(0);opacity:1}}
@keyframes scoreNum{0%{transform:scale(0.5);opacity:0}70%{transform:scale(1.12);opacity:1}100%{transform:scale(1);opacity:1}}
@keyframes starSpin{0%{transform:rotate(0deg) scale(0)}60%{transform:rotate(200deg) scale(1.2)}100%{transform:rotate(360deg) scale(1)}}
@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-7px)}40%,80%{transform:translateX(7px)}}
@keyframes strkIn{0%{opacity:0;transform:translate(-50%,10px) scale(.7)}60%{opacity:1;transform:translate(-50%,-3px) scale(1.05)}100%{opacity:1;transform:translate(-50%,0) scale(1)}}
@keyframes strkOut{to{opacity:0;transform:translate(-50%,-16px)}}
@keyframes btnPulse{0%,100%{box-shadow:0 4px 20px rgba(168,85,247,0.35)}50%{box-shadow:0 6px 32px rgba(168,85,247,0.55),0 0 0 6px rgba(168,85,247,0.08)}}
@keyframes iconSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes iconBounce{0%,100%{transform:translateY(0)}40%{transform:translateY(-4px)}70%{transform:translateY(2px)}}
@keyframes svgPop{0%{transform:scale(0.6);opacity:0}65%{transform:scale(1.18);opacity:1}100%{transform:scale(1);opacity:1}}

/* ── BUTTON SMOOTHNESS UPGRADE ── */
button{-webkit-tap-highlight-color:transparent;will-change:transform;}
button:not(.bg-swatch,.bg-blur-toggle,#bg-fab,.dm-btn){transition:transform .18s cubic-bezier(0.34,1.56,0.64,1),box-shadow .22s cubic-bezier(0.34,1.56,0.64,1),background .22s,border-color .22s,opacity .2s,filter .2s;}
button:not(.bg-swatch,.bg-blur-toggle,#bg-fab,.dm-btn):active{transform:scale(0.955);filter:brightness(0.97);}
button:disabled{opacity:.55;cursor:not-allowed;transform:none!important;}
@media(hover:hover){
  button:not(.bg-swatch,.bg-blur-toggle,#bg-fab,.dm-btn):hover{filter:brightness(1.04);}
}
.rpl-wrap{position:relative;overflow:hidden;}
.rpl{position:absolute;border-radius:50%;background:rgba(255,255,255,0.55);transform:scale(0);pointer-events:none;animation:rplGrow .55s cubic-bezier(0.16,1,0.3,1) forwards;}
@keyframes rplGrow{to{transform:scale(2.6);opacity:0;}}

.logo-wrap{display:inline-flex;flex-direction:column;align-items:flex-start;line-height:1;}
.logo-learnsy{font-family:'Satisfy','Dancing Script','Brush Script MT',cursive;font-weight:400;font-size:29px;letter-spacing:0;
  background:linear-gradient(100deg,#5cc791 0%,#a4ac71 38%,#ef8e59 72%,#e0907a 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
  display:inline-block;padding:.06em .2em .12em .06em;line-height:1.1;}
.logo-sub{font-size:7px;font-weight:800;letter-spacing:.2px;color:#B090C8;margin-top:1px;opacity:.75;white-space:nowrap;}
body.dark .logo-sub{color:#8A6080;}
.logo-fl{display:inline-block;animation:float 2.8s ease-in-out infinite;font-size:15px;}
.logo-flb{display:inline-block;animation:floatB 3.2s ease-in-out infinite;font-size:13px;animation-delay:.5s;}
.fade-up{animation:fadeUp .24s ease both;}
.do-shake{animation:shake .35s ease!important;}
.dm-btn{width:34px;height:34px;border-radius:50%;border:1.5px solid rgba(255,150,200,0.25);background:rgba(255,150,200,0.07);
  cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .25s cubic-bezier(0.34,1.56,0.64,1);flex-shrink:0;}
.dm-btn:hover{background:rgba(255,150,200,0.18);border-color:rgba(255,150,200,0.45);transform:scale(1.1);}
.dm-btn:active{transform:scale(0.9);}
.dm-btn svg{transition:transform .4s cubic-bezier(0.34,1.56,0.64,1);}
.dm-btn:active svg{transform:rotate(30deg) scale(0.85);}

body::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:0;
  background-image:
    radial-gradient(circle at 15% 20%,rgba(255,182,203,.12) 0%,transparent 45%),
    radial-gradient(circle at 85% 10%,rgba(196,181,253,.1) 0%,transparent 40%),
    radial-gradient(circle at 50% 80%,rgba(167,243,208,.08) 0%,transparent 40%),
    radial-gradient(circle at 90% 70%,rgba(253,186,116,.07) 0%,transparent 35%);}

/* ── DARK MODE ── */
body.dark{background:#180A10;}
body.dark::before{background-image:
  radial-gradient(circle at 15% 20%,rgba(255,80,120,.07) 0%,transparent 45%),
  radial-gradient(circle at 85% 10%,rgba(160,100,255,.06) 0%,transparent 40%),
  radial-gradient(circle at 50% 80%,rgba(80,200,140,.04) 0%,transparent 40%),
  radial-gradient(circle at 90% 70%,rgba(250,150,60,.04) 0%,transparent 35%);}

/* ── BACKGROUND THEMES ── */
:root{--bg-blur:1;}
#bg-layer{position:fixed;inset:0;z-index:0;pointer-events:none;transition:opacity .5s,background .5s,background-image .5s;opacity:0;background-size:cover;background-position:center;background-repeat:no-repeat;}
#bg-layer.active{opacity:1;}
/* Blur overlay — độ mờ điều chỉnh qua --bg-blur-px, mặc định 25% khi dùng ảnh tùy chỉnh */
#bg-blur-overlay{position:fixed;inset:0;z-index:0;pointer-events:none;
  backdrop-filter:blur(0px);-webkit-backdrop-filter:blur(0px);transition:backdrop-filter .4s cubic-bezier(0.34,1.56,0.64,1),-webkit-backdrop-filter .4s cubic-bezier(0.34,1.56,0.64,1);}
body.bg-blur-on #bg-blur-overlay{backdrop-filter:blur(var(--bg-blur-px,18px));-webkit-backdrop-filter:blur(var(--bg-blur-px,18px));}

/* bg-* theme bodies */
body.bg-rose{background:#FFF0F4!important;}
body.bg-lav{background:#F5F0FF!important;}
body.bg-mint{background:#F0FBF5!important;}
body.bg-sky{background:#F0F7FF!important;}
body.bg-peach{background:#FFF5EE!important;}
body.bg-lemon{background:#FFFBEE!important;}
body.bg-lilac{background:#F8F0FF!important;}
body.bg-blush{background:#FFF0F7!important;}
body.dark.bg-rose{background:#1E0810!important;}
body.dark.bg-lav{background:#120830!important;}
body.dark.bg-mint{background:#04180E!important;}
body.dark.bg-sky{background:#021428!important;}
body.dark.bg-peach{background:#1E0C04!important;}
body.dark.bg-lemon{background:#181400!important;}
body.dark.bg-lilac{background:#140828!important;}
body.dark.bg-blush{background:#1E0412!important;}

/* Background panel */
#bg-panel{position:fixed;top:58px;right:14px;z-index:9990;
  background:rgba(255,255,255,0.96);border:1.5px solid #F5D5E8;
  border-radius:22px;padding:16px 14px 14px;width:270px;
  box-shadow:0 12px 48px rgba(168,85,247,0.2),0 2px 12px rgba(0,0,0,0.07);
  transition:all .3s cubic-bezier(0.34,1.56,0.64,1);
  transform:scale(0.85) translateY(12px);opacity:0;pointer-events:none;}
#bg-panel.show{transform:scale(1) translateY(0);opacity:1;pointer-events:all;}
body.dark #bg-panel{background:rgba(24,6,30,0.97);border-color:#421526;}

#bg-panel-title{font-size:13px;font-weight:900;margin-bottom:12px;
  display:flex;align-items:center;gap:7px;}
.bg-swatches{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:12px;}
.bg-swatch{width:100%;aspect-ratio:1;border-radius:12px;cursor:pointer;
  border:2.5px solid transparent;transition:all .22s cubic-bezier(0.34,1.56,0.64,1);
  position:relative;overflow:hidden;}
.bg-swatch:hover{transform:scale(1.08);}
.bg-swatch.active{border-color:#A855F7;box-shadow:0 0 0 3px rgba(168,85,247,0.3);}
.bg-swatch-check{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .18s;}
.bg-swatch.active .bg-swatch-check{opacity:1;}

.bg-blur-row{display:flex;align-items:center;justify-content:space-between;
  padding:9px 12px;border-radius:14px;background:rgba(168,85,247,0.06);
  border:1.5px solid rgba(168,85,247,0.15);}
.bg-blur-label{font-size:12px;font-weight:800;display:flex;align-items:center;gap:6px;}
.bg-blur-toggle{width:40px;height:21px;border-radius:99px;cursor:pointer;
  border:none;padding:0;position:relative;transition:background .22s;flex-shrink:0;}
.bg-blur-toggle::after{content:'';position:absolute;top:3px;width:15px;height:15px;
  border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.25);transition:left .22s;}
.bg-blur-toggle.off{background:rgba(0,0,0,0.15);}
.bg-blur-toggle.off::after{left:3px;}
.bg-blur-toggle.on{background:var(--ao-grad);background-size:220% 220%;animation:shimmer 5s ease infinite;}
.bg-blur-toggle.on::after{left:22px;}

/* Upload ảnh nền tùy chỉnh */
.bg-upload-row{margin-top:10px;}
.bg-upload-btn{width:100%;padding:10px 12px;border-radius:14px;cursor:pointer;
  border:1.5px dashed rgba(168,85,247,0.35);background:rgba(168,85,247,0.05);
  color:#A855F7;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:7px;
  transition:all .22s cubic-bezier(0.34,1.56,0.64,1);font-family:'Nunito',sans-serif;}
.bg-upload-btn:hover{background:rgba(168,85,247,0.1);border-color:rgba(168,85,247,0.55);}
.bg-upload-btn:active{transform:scale(0.97);}
body.dark .bg-upload-btn{background:rgba(168,85,247,0.1);border-color:rgba(168,85,247,0.3);}
.bg-blur-slider-row{display:none;align-items:center;gap:9px;margin-top:9px;padding:9px 12px;
  border-radius:14px;background:rgba(168,85,247,0.06);border:1.5px solid rgba(168,85,247,0.15);}
.bg-blur-slider-row.show{display:flex;}
.bg-blur-slider-row input[type=range]{flex:1;accent-color:#A855F7;height:4px;cursor:pointer;}
#bg-blur-pct{font-size:11px;font-weight:900;color:#A855F7;min-width:30px;text-align:right;}
.bg-custom-thumb{width:100%;aspect-ratio:1;border-radius:12px;cursor:pointer;overflow:hidden;
  border:2.5px solid transparent;transition:all .22s cubic-bezier(0.34,1.56,0.64,1);position:relative;background-size:cover;background-position:center;}
.bg-custom-thumb:hover{transform:scale(1.08);}
.bg-custom-thumb.active{border-color:#A855F7;box-shadow:0 0 0 3px rgba(168,85,247,0.3);}
.bg-custom-thumb .bg-swatch-check{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.25);opacity:0;transition:opacity .18s;}
.bg-custom-thumb.active .bg-swatch-check{opacity:1;}
.bg-custom-thumb .bg-custom-rm{position:absolute;top:3px;right:3px;width:16px;height:16px;border-radius:50%;
  background:rgba(0,0,0,0.55);color:#fff;display:flex;align-items:center;justify-content:center;
  border:none;cursor:pointer;padding:0;transition:all .18s cubic-bezier(0.34,1.56,0.64,1);}
.bg-custom-thumb .bg-custom-rm:hover{background:#EF4444;transform:scale(1.15);}

/* Background button in header — same style as dm-btn */
#bg-fab{width:34px;height:34px;border-radius:50%;
  border:1.5px solid rgba(255,150,200,0.25);
  background:rgba(255,150,200,0.07);
  cursor:pointer;display:flex;align-items:center;justify-content:center;
  transition:all .25s cubic-bezier(0.34,1.56,0.64,1);flex-shrink:0;
  padding:0;outline:none;-webkit-appearance:none;}
#bg-fab:hover{background:rgba(255,150,200,0.18);border-color:rgba(255,150,200,0.45);transform:scale(1.1);}
#bg-fab:active{transform:scale(0.9);}
body.dark #bg-fab{border-color:rgba(255,150,200,0.25);background:rgba(255,150,200,0.07);}
#bg-fab svg{transition:transform .4s cubic-bezier(0.34,1.56,0.64,1);}
#bg-fab.open svg{transform:rotate(45deg);}

/* ── LAYOUT ── */
#app{max-width:760px;margin:0 auto;min-height:100vh;position:relative;z-index:1;}
.ls-body{padding:14px 14px 80px;}

/* ── HEADER ── */
.ls-hdr{background:rgba(255,255,255,0.95);border-bottom:1.5px solid #F5D5E8;
  position:sticky;top:0;z-index:60;backdrop-filter:blur(20px);
  box-shadow:0 2px 20px rgba(255,100,150,0.08);padding:12px 14px 10px;}
body.dark .ls-hdr{background:rgba(30,13,21,0.97);border-color:#421526;}
.ls-hdr-row{display:flex;align-items:center;gap:8px;}

/* ── HOME HERO ── */
.ls-hero{text-align:center;padding:24px 12px 20px;}
.ls-hero-title{font-size:22px;font-weight:900;color:#3D1830;margin-bottom:8px;line-height:1.2;}
body.dark .ls-hero-title{color:#F0DCE8;}
.ls-hero-desc{font-size:13px;color:#A07090;}
body.dark .ls-hero-desc{color:#8A6080;}

/* ── SUBJECT TABS ── */
.ls-tabs{display:flex;gap:8px;margin-bottom:14px;}
.ls-tab{flex:1;padding:9px 4px;border-radius:14px;font-size:11px;font-weight:900;
  cursor:pointer;transition:all .18s;display:flex;flex-direction:column;align-items:center;gap:3px;border:1.5px solid #F5D5E8;background:#fff;color:#6B3050;}
.ls-tab.active{background:var(--ao-grad);background-size:220% 220%;animation:shimmer 5s ease infinite;color:#fff;border-color:transparent;box-shadow:0 4px 14px rgba(168,85,247,0.3);}
body.dark .ls-tab{background:#261018;border-color:#421526;color:#C898B8;}
body.dark .ls-tab.active{background:var(--ao-grad);background-size:220% 220%;animation:shimmer 5s ease infinite;border-color:transparent;}
.ls-tab-count{font-size:10px;font-weight:800;border-radius:99px;padding:1px 7px;border:1px solid #F0D0E0;color:#A07090;}
.ls-tab.active .ls-tab-count{background:rgba(255,255,255,0.25);border:none;color:rgba(255,255,255,0.9);}
body.dark .ls-tab-count{border-color:#421526;color:#8A6080;}

/* ── CSS :has() — hover card highlight ── */
@supports selector(:has(a)){
  .ls-card:has(button:active){transform:scale(0.975);}
  .qz-opts:has(.qz-opt.correct) .qz-opt:not(.correct):not(.wrong):not(.missed){opacity:0.55;}
}

/* ── Container Queries — quiz layout tự điều chỉnh ── */
#qz-body{container-type:inline-size;}
@container(min-width:500px){
  .qz-opts{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
  .qz-opts .qz-confirm-btn{grid-column:1/-1;}
}

/* ── LESSON CARDS ── */
.ls-grid{display:flex;flex-direction:column;gap:10px;}
.ls-card{background:#fff;border:1.5px solid #F5D5E8;border-radius:18px;padding:14px 15px;
  cursor:pointer;transition:all .25s cubic-bezier(0.34,1.56,0.64,1);animation:fadeUp .2s both;display:flex;align-items:flex-start;gap:12px;}
.ls-card:hover{border-color:#C084FC;transform:translateY(-3px);box-shadow:0 8px 28px rgba(168,85,247,0.15);}
.ls-card:active{transform:scale(0.975);}
.ls-card:hover .ls-card-arrow{transform:scale(1.12) translateX(2px);}
.ls-card:active .ls-card-arrow{transform:scale(0.92);}
body.dark .ls-card{background:#261018;border-color:#421526;}
body.dark .ls-card:hover{border-color:#C084FC;}
.ls-card-icon{width:46px;height:46px;border-radius:14px;background:linear-gradient(135deg,#FFE4ED,#F0E6FF);
  display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;}
.ls-card-body{flex:1;min-width:0;}
.ls-card-title{font-size:15px;font-weight:900;color:#3D1830;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
body.dark .ls-card-title{color:#F0DCE8;}
.ls-card-desc{font-size:12px;color:#A07090;margin-bottom:7px;}
body.dark .ls-card-desc{color:#8A6080;}
.ls-card-tags{display:flex;gap:6px;flex-wrap:wrap;align-items:center;}
.ls-card-arrow{width:32px;height:32px;border-radius:10px;background:var(--ao-grad);background-size:220% 220%;animation:shimmer 5s ease infinite;
  display:flex;align-items:center;justify-content:center;flex-shrink:0;
  transition:transform .25s cubic-bezier(0.34,1.56,0.64,1),box-shadow .25s;}

/* ── SETTINGS (gộp) ── */
#shuffle-bar{display:none;margin-bottom:14px;position:relative;}
.setn-btn{display:inline-flex;align-items:center;gap:7px;padding:7px 14px;border-radius:999px;
  border:1.5px solid #F5D5E8;background:#FFFFFF;color:#A07090;
  font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;
  transition:background .22s,border-color .22s,color .22s;flex-shrink:0;}
body.dark .setn-btn{border-color:#421526;background:#261018;color:#8A6080;}
.setn-btn.active-n{border-color:transparent!important;background:var(--ao-grad-soft)!important;color:#A855F7!important;}
body.dark .setn-btn.active-n{border-color:transparent!important;background:var(--ao-grad-soft)!important;color:#C89AF5!important;}
.setn-badge{display:inline-flex;align-items:center;justify-content:center;min-width:15px;height:15px;
  padding:0 4px;border-radius:99px;background:var(--ao-grad);background-size:220% 220%;animation:shimmer 5s ease infinite;font-size:9px;font-weight:900;flex-shrink:0;}
.setn-badge span{color:#fff;}
.setn-chevron{transition:transform .25s cubic-bezier(0.34,1.56,0.64,1);}
.setn-btn.open .setn-chevron{transform:rotate(180deg);}

.setn-pop{position:absolute;top:calc(100% + 8px);left:0;z-index:20;min-width:220px;
  border-radius:16px;border:1.5px solid #F5D5E8;background:#FFFFFF;
  box-shadow:0 12px 30px rgba(168,85,247,0.18);padding:8px;
  display:flex;flex-direction:column;gap:4px;
  transform-origin:top left;opacity:0;transform:scale(.92) translateY(-6px);pointer-events:none;
  transition:opacity .2s cubic-bezier(0.34,1.56,0.64,1),transform .2s cubic-bezier(0.34,1.56,0.64,1);}
body.dark .setn-pop{border-color:#421526;background:#20101C;box-shadow:0 12px 30px rgba(0,0,0,0.4);}
.setn-pop.show{opacity:1;transform:scale(1) translateY(0);pointer-events:auto;}
.setn-row{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:11px;cursor:pointer;
  transition:background .18s;user-select:none;}
.setn-row:hover{background:rgba(168,85,247,0.06);}
body.dark .setn-row:hover{background:rgba(255,255,255,0.04);}
.setn-row-label{flex:1;font-size:12.5px;font-weight:800;color:#6B3050;}
body.dark .setn-row-label{color:#C898B8;}
.shuf-track{width:28px;height:15px;border-radius:99px;background:rgba(0,0,0,0.12);
  position:relative;flex-shrink:0;transition:background .22s;}
.setn-row.on-q .shuf-track,.setn-row.on-a .shuf-track{background:var(--ao-grad);background-size:220% 220%;animation:shimmer 5s ease infinite;}
.shuf-thumb{position:absolute;top:2px;left:2px;width:11px;height:11px;
  border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.25);
  transition:left .22s cubic-bezier(0.34,1.56,0.64,1);}
.setn-row.on-q .shuf-thumb,.setn-row.on-a .shuf-thumb{left:13px;}

/* ── QUIZ HEADER ── */
#quiz-screen{display:none;flex-direction:column;min-height:100vh;position:relative;z-index:1;max-width:760px;margin:0 auto;}
.qz-hdr{background:rgba(255,255,255,0.95);border-bottom:1px solid rgba(168,85,247,0.15);
  position:sticky;top:0;z-index:60;backdrop-filter:blur(16px);}
body.dark .qz-hdr{background:rgba(18,4,48,0.96);border-color:rgba(196,181,253,0.15);}
.qz-hdr-top{padding:10px 14px 8px;display:flex;justify-content:space-between;align-items:center;margin-bottom:9px;}
.qz-back{padding:6px 13px 6px 10px;border-radius:999px;border:1.5px solid rgba(255,107,149,0.3);
  background:rgba(255,107,149,0.07);color:#FF6B95;font-size:12px;font-weight:800;cursor:pointer;
  display:flex;align-items:center;gap:5px;transition:all .22s cubic-bezier(0.34,1.56,0.64,1);}
.qz-back:hover{background:rgba(255,107,149,0.15);transform:translateX(-2px);}
.qz-back:active{transform:scale(0.93);}
body.dark .qz-back{border-color:rgba(255,107,149,0.3);background:rgba(255,107,149,0.07);}
.qz-title{font-size:13px;font-weight:900;color:#3D1830;flex:1;text-align:center;
  margin:0 10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
body.dark .qz-title{color:#F0DCE8;}
.qz-prog-wrap{height:5px;background:rgba(168,85,247,0.12);border-radius:99px;overflow:hidden;margin:0 14px 6px;}
body.dark .qz-prog-wrap{background:rgba(255,150,200,0.15);}
.qz-prog-bar{height:100%;background:linear-gradient(90deg,#F472B6,#A855F7,#6EE7B7);border-radius:99px;transition:width .4s ease;width:0%;}
.qz-hdr-meta{display:flex;justify-content:space-between;align-items:center;padding:0 14px 8px;}
.qz-type-badge{font-size:11px;font-weight:900;background:rgba(168,85,247,0.08);padding:2px 9px;border-radius:999px;}
body.dark .qz-type-badge{background:rgba(255,255,255,0.06);}
.qz-counter{font-size:11px;color:#A07090;font-weight:700;}
body.dark .qz-counter{color:#8A6080;}

/* ── TIMER ── */
#qz-timer{display:none;align-items:center;gap:5px;padding:4px 11px;border-radius:999px;
  font-size:12px;font-weight:900;border:1.5px solid rgba(168,85,247,0.3);
  background:rgba(168,85,247,0.08);color:#C084FC;transition:all .3s;flex-shrink:0;}
#qz-timer.warn{border-color:rgba(245,158,11,0.5);background:rgba(245,158,11,0.1);color:#F59E0B;animation:timerPulse 1s ease-in-out infinite;}
#qz-timer.danger{border-color:rgba(239,68,68,0.6);background:rgba(239,68,68,0.12);color:#EF4444;animation:timerFlash .5s ease-in-out infinite;}
@keyframes timerPulse{0%,100%{transform:scale(1);box-shadow:none;}50%{transform:scale(1.04);box-shadow:0 0 0 4px rgba(245,158,11,0.15);}}
@keyframes timerFlash{
  0%{background:rgba(239,68,68,0.12);color:#EF4444;border-color:rgba(239,68,68,0.6);box-shadow:none;}
  50%{background:rgba(239,68,68,0.35);color:#fff;border-color:#EF4444;box-shadow:0 0 0 5px rgba(239,68,68,0.2);}
  100%{background:rgba(239,68,68,0.12);color:#EF4444;border-color:rgba(239,68,68,0.6);box-shadow:none;}
}

/* ── QUIZ BODY ── */
.qz-body{flex:1;padding:13px;overflow-y:auto;background:linear-gradient(160deg,#FFF5F9,#F5EEFF,#F0F5FF);}
body.dark .qz-body{background:linear-gradient(160deg,#120430,#1A0838,#0A1030);}

/* ── Q BOX ── */
.qz-surface{position:relative;isolation:isolate;background:rgba(255,255,255,0.9);border:1.5px solid rgba(168,85,247,0.2);
  border-radius:15px;padding:13px 15px;margin-bottom:12px;backdrop-filter:blur(8px);}
body.dark .qz-surface{background:rgba(255,255,255,0.05);border-color:rgba(196,181,253,0.2);}
.qz-surface::before{content:'';position:absolute;inset:-2px;border-radius:inherit;z-index:-1;
  background:var(--ao-grad);background-size:220% 220%;
  animation:shimmer 6s ease infinite,aoGlowPulse 3s ease-in-out infinite;
  filter:blur(6px);opacity:.4;}
.qz-type-lbl{font-size:11px;font-weight:900;letter-spacing:.8px;margin-bottom:7px;text-transform:uppercase;}
.qz-q-text{font-size:15px;font-weight:700;color:#3D1830;line-height:1.65;}
.qz-img{display:block;max-width:100%;max-height:320px;margin:0 auto 13px;object-fit:contain;border-radius:14px;cursor:zoom-in;}
.qz-img.zoomed{position:fixed;inset:0;z-index:99999;width:100vw;height:100vh;max-width:none;max-height:none;margin:0;padding:12px;box-sizing:border-box;background:rgba(8,1,22,.92);border-radius:0;cursor:zoom-out;}
body.dark .qz-q-text{color:#F0DCE8;}
.qz-hint{font-size:12px;color:#A07090;font-weight:700;margin-top:6px;}
body.dark .qz-hint{color:#8A6080;}

/* ── PASSAGE ── */
.qz-passage-wrap{position:relative;isolation:isolate;background:rgba(196,181,253,0.08);border:1.5px solid rgba(196,181,253,0.2);
  border-radius:15px;padding:13px 15px;margin-bottom:12px;}
body.dark .qz-passage-wrap{background:rgba(196,181,253,0.07);border-color:rgba(196,181,253,0.15);}
.qz-passage-wrap::before{content:'';position:absolute;inset:-2px;border-radius:inherit;z-index:-1;
  background:var(--ao-grad);background-size:220% 220%;
  animation:shimmer 6s ease infinite,aoGlowPulse 3s ease-in-out infinite;
  filter:blur(6px);opacity:.35;}
.qz-passage-lbl{font-size:11px;font-weight:900;color:#C084FC;letter-spacing:.8px;margin-bottom:7px;
  display:flex;align-items:center;gap:5px;}
.qz-passage-text{font-size:13px;font-style:italic;color:#6B3050;line-height:1.75;}
body.dark .qz-passage-text{color:#C898B8;}
.qz-source{font-size:11px;color:#A07090;font-weight:700;margin-top:4px;}
body.dark .qz-source{color:#8A6080;}

/* ── OPTIONS ── */
.qz-opts{display:flex;flex-direction:column;gap:8px;}
.qz-opt{position:relative;isolation:isolate;display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:13px;
  border:1.5px solid rgba(168,85,247,0.2);background:rgba(255,255,255,0.7);
  text-align:left;cursor:pointer;transition:all .22s cubic-bezier(0.34,1.56,0.64,1);width:100%;font-family:'Nunito',sans-serif;}
body.dark .qz-opt{background:rgba(255,255,255,0.04);border-color:rgba(196,181,253,0.2);}
.qz-opt::before{content:'';position:absolute;inset:-1.5px;border-radius:inherit;z-index:-1;
  background:var(--ao-grad);background-size:220% 220%;animation:shimmer 6s ease infinite;
  filter:blur(3px);opacity:0;transition:opacity .25s;}
.qz-opt:hover:not([disabled])::before{opacity:.45;}
.qz-opt.sel::before{opacity:.7;filter:blur(4px);}
.qz-opt:hover:not([disabled]){border-color:#C084FC;background:rgba(168,85,247,0.08);transform:translateY(-1px);box-shadow:0 4px 14px rgba(168,85,247,0.1);}
.qz-opt:active:not([disabled]){transform:scale(0.97);}
.qz-opt.sel{border-color:#C084FC;background:rgba(168,85,247,0.12);}
body.dark .qz-opt.sel{background:rgba(196,181,253,0.15);}
.qz-opt.correct{border-color:#10B981!important;background:rgba(16,185,129,0.15)!important;}
.qz-opt.correct::before,.qz-opt.wrong::before,.qz-opt.missed::before{opacity:0!important;}
.qz-opt.wrong{border-color:#EF4444!important;background:rgba(239,68,68,0.12)!important;}
.qz-opt.missed{border-color:#F59E0B!important;background:rgba(245,158,11,0.12)!important;}
.qz-opt-letter{width:27px;height:27px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:12px;font-weight:900;background:rgba(196,181,253,0.15);color:#C084FC;flex-shrink:0;}
.qz-opt.sel .qz-opt-letter{background:#A855F7;color:#fff;}
.qz-opt.correct .qz-opt-letter{background:#10B981;color:#fff;}
.qz-opt.wrong .qz-opt-letter{background:#EF4444;color:#fff;}
.qz-opt.missed .qz-opt-letter{background:#F59E0B;color:#fff;}
.qz-opt-text{font-size:13px;line-height:1.65;color:#6B3050;flex:1;}
body.dark .qz-opt-text{color:#E2D9F3;}
.qz-confirm-btn{width:100%;margin-top:8px;padding:10px;border-radius:999px;border:none;
  background:var(--ao-grad);background-size:220% 220%;color:#fff;font-size:13px;
  font-weight:900;cursor:pointer;font-family:'Nunito',sans-serif;
  transition:all .22s cubic-bezier(0.34,1.56,0.64,1);animation:shimmer 5s ease infinite;
  display:flex;align-items:center;justify-content:center;gap:6px;}
.qz-confirm-btn:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(168,85,247,0.4);}
.qz-confirm-btn:active{transform:scale(0.96);}

/* ── TRUE/FALSE ── */
.qz-tf-items{display:flex;flex-direction:column;gap:9px;}
.qz-tf-item{position:relative;isolation:isolate;border:1.5px solid rgba(168,85,247,0.2);border-radius:13px;padding:11px 13px;
  background:rgba(255,255,255,0.7);transition:all .2s;}
body.dark .qz-tf-item{background:rgba(255,255,255,0.04);border-color:rgba(196,181,253,0.2);}
.qz-tf-item::before{content:'';position:absolute;inset:-1.5px;border-radius:inherit;z-index:-1;
  background:var(--ao-grad);background-size:220% 220%;animation:shimmer 6s ease infinite;
  filter:blur(3px);opacity:.3;transition:opacity .25s;}
.qz-tf-item.ok,.qz-tf-item.bad{border-color:transparent;}
.qz-tf-item.ok::before,.qz-tf-item.bad::before{opacity:0;}
.qz-tf-item.ok{background:rgba(16,185,129,0.12);}
.qz-tf-item.bad{background:rgba(239,68,68,0.1);}
.qz-tf-item.sel-t{border-color:#6EE7B7;background:rgba(16,185,129,0.08);}
.qz-tf-item.sel-f{border-color:#FCA5A5;background:rgba(239,68,68,0.08);}
.qz-tf-row{display:flex;gap:8px;margin-bottom:9px;}
.qz-tf-ltr{font-size:13px;font-weight:900;color:#C084FC;flex-shrink:0;}
.qz-tf-text{font-size:13px;font-weight:700;color:#6B3050;line-height:1.6;flex:1;margin:0;}
body.dark .qz-tf-text{color:#E2D9F3;}
.qz-tf-btns{display:flex;gap:7px;flex-wrap:wrap;align-items:center;}
.qz-tf-btn{padding:5px 14px;border-radius:999px;font-size:12px;font-weight:800;
  cursor:pointer;border:1.5px solid;transition:all .2s cubic-bezier(0.34,1.56,0.64,1);font-family:'Nunito',sans-serif;
  display:inline-flex;align-items:center;gap:5px;}
.qz-tf-btn:hover:not([disabled]){transform:scale(1.07);}
.qz-tf-btn:active:not([disabled]){transform:scale(0.93);}
.qz-tf-btn-t{border-color:#6EE7B7;background:rgba(16,185,129,0.1);color:#6EE7B7;}
.qz-tf-btn-t.on{background:var(--ao-grad);background-size:220% 220%;animation:shimmer 5s ease infinite;color:#fff;border-color:transparent;}
.qz-tf-btn-f{border-color:#FCA5A5;background:rgba(239,68,68,0.1);color:#FCA5A5;}
.qz-tf-btn-f.on{background:var(--ao-grad);background-size:220% 220%;animation:shimmer 5s ease infinite;color:#fff;border-color:transparent;}
.qz-tf-btn-t.sub-ok,.qz-tf-btn-f.sub-ok{background:#10B981;color:#fff;border-color:transparent;}
.qz-tf-btn-t.sub-bad,.qz-tf-btn-f.sub-bad{background:#EF4444;color:#fff;border-color:transparent;}
.qz-tf-ans-badge{font-size:11px;font-weight:800;padding:3px 9px;border-radius:999px;
  background:rgba(196,181,253,0.15);color:#C084FC;border:1px solid rgba(196,181,253,0.3);margin-left:auto;}

/* ── FILL BLANK ── */
.qz-fill-wrap{position:relative;isolation:isolate;border-radius:13px;}
.qz-fill-wrap::before{content:'';position:absolute;inset:-1.5px;border-radius:inherit;z-index:-1;
  background:var(--ao-grad);background-size:220% 220%;animation:shimmer 6s ease infinite;
  filter:blur(4px);opacity:0;transition:opacity .25s;}
.qz-fill-wrap:focus-within::before{opacity:.8;}
.qz-fill-input{width:100%;padding:12px 15px;border-radius:13px;font-size:14px;font-weight:700;
  background:rgba(255,255,255,0.9);border:1.5px solid rgba(168,85,247,0.3);
  color:#3D1830;outline:none;font-family:'Nunito',sans-serif;transition:border-color .22s;}
body.dark .qz-fill-input{background:rgba(255,255,255,0.07);border-color:rgba(196,181,253,0.3);color:#F0E6FF;}
.qz-fill-input:focus{border-color:#C084FC;}
.qz-fill-input.ok{border-color:#10B981;background:rgba(16,185,129,0.12);color:#10B981;}
.qz-fill-input.bad{border-color:#EF4444;background:rgba(239,68,68,0.1);color:#EF4444;}
.qz-fill-fb{font-size:13px;font-weight:800;margin-top:8px;display:flex;align-items:center;gap:5px;}

/* ── DOTS NAV ── */
.qz-dots-row{display:flex;align-items:center;gap:8px;padding:13px 0 5px;}
.qz-dots-scroll{flex:1;overflow-x:auto;display:flex;gap:4px;align-items:center;
  scrollbar-width:none;-webkit-overflow-scrolling:touch;padding:4px 2px;}
.qz-dots-scroll::-webkit-scrollbar{display:none;}
.qz-dot{flex-shrink:0;width:22px;height:22px;border-radius:999px;cursor:pointer;
  transition:all .22s;font-size:9px;font-weight:900;font-family:'Nunito',sans-serif;
  display:flex;align-items:center;justify-content:center;line-height:1;border:1.5px solid;}
.qz-nav-btn{flex-shrink:0;width:36px;height:36px;border-radius:50%;font-size:12px;font-weight:800;
  background:rgba(255,107,149,0.07);border:1.5px solid rgba(255,107,149,0.3);
  color:#FF6B95;cursor:pointer;font-family:'Nunito',sans-serif;
  display:flex;align-items:center;justify-content:center;
  transition:all .22s cubic-bezier(0.34,1.56,0.64,1);}
.qz-nav-btn:hover:not(:disabled){background:rgba(255,107,149,0.15);transform:scale(1.1);}
.qz-nav-btn:active:not(:disabled){transform:scale(0.9);}
.qz-nav-btn:disabled{opacity:.3;cursor:default;}
body.dark .qz-nav-btn{background:rgba(255,107,149,0.07);border-color:rgba(255,107,149,0.3);}

/* ── SUBMIT BAR ── */
.qz-bar{position:sticky;bottom:0;padding:10px 14px 20px;
  border-top:1px solid rgba(168,85,247,0.12);
  background:rgba(255,245,249,0.95);backdrop-filter:blur(16px);}
body.dark .qz-bar{background:rgba(18,4,48,0.94);border-color:rgba(196,181,253,0.15);}
.qz-submit{width:100%;padding:13px;border-radius:999px;border:none;
  background:var(--ao-grad);background-size:220% 220%;color:#fff;font-size:15px;
  font-weight:900;box-shadow:0 4px 20px rgba(168,85,247,0.35);cursor:pointer;
  display:flex;align-items:center;justify-content:center;gap:8px;font-family:'Nunito',sans-serif;
  transition:all .25s cubic-bezier(0.34,1.56,0.64,1);animation:shimmer 5s ease infinite;}
.qz-submit:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(168,85,247,0.5);}
.qz-submit:active{transform:scale(0.97);}
.qz-retry{display:none;width:100%;padding:13px;border-radius:999px;
  border:1.5px solid transparent;background:rgba(255,150,200,0.08);
  color:#F9A8D4;font-size:15px;font-weight:900;cursor:pointer;font-family:'Nunito',sans-serif;
  display:none;align-items:center;justify-content:center;gap:8px;
  transition:all .22s cubic-bezier(0.34,1.56,0.64,1);}
.qz-retry:hover{background:rgba(255,150,200,0.16);transform:translateY(-1px);}
.qz-retry:active{transform:scale(0.97);}

/* ── MODALS ── */
.modal-bg{display:none;position:fixed;inset:0;background:rgba(10,2,25,0.88);
  backdrop-filter:blur(12px);align-items:center;justify-content:center;z-index:9999;padding:20px;}
.modal-bg.show{display:flex;}
.score-box{background:linear-gradient(160deg,#1E0845,#120330);border:1.5px solid rgba(255,150,200,0.25);
  border-radius:28px;padding:28px 22px 24px;max-width:330px;width:100%;text-align:center;
  animation:scoreIn .55s cubic-bezier(0.34,1.56,0.64,1) both;}
.warn-box{background:linear-gradient(160deg,#1E0845,#120330);border:1.5px solid rgba(252,211,77,0.35);
  border-radius:24px;padding:26px 22px;max-width:300px;width:100%;text-align:center;animation:pop .28s ease both;}
.pw-box{background:linear-gradient(160deg,#FFF5F9,#F0E6FF);border:1.5px solid #F5D5E8;
  border-radius:28px;padding:28px 24px;max-width:300px;width:100%;text-align:center;
  box-shadow:0 20px 60px rgba(168,85,247,0.15);animation:pop .28s ease both;}
body.dark .pw-box{background:linear-gradient(160deg,#1E0845,#120330);border-color:rgba(255,150,200,0.2);}
.hist-detail-box{background:linear-gradient(160deg,#FFF5F9,#F0E6FF);border:1.5px solid #F5D5E8;
  border-radius:24px;padding:22px 18px 20px;max-width:340px;width:100%;
  animation:pop .22s ease both;max-height:85vh;overflow-y:auto;}
body.dark .hist-detail-box{background:linear-gradient(160deg,#1E0845,#120330);border-color:rgba(255,150,200,0.2);}

/* ── STREAK ── */
#strk-t{position:fixed;top:70px;left:50%;transform:translate(-50%,0);z-index:9997;pointer-events:none;
  padding:9px 22px;border-radius:999px;background:var(--ao-grad);background-size:220% 220%;animation:shimmer 5s ease infinite;
  color:#fff;font-size:14px;font-weight:900;box-shadow:0 6px 24px rgba(168,85,247,.5);display:none;}

/* ── CONFETTI ── */
.cf-piece{position:fixed;pointer-events:none;border-radius:2px;animation:cfDrop 1.4s ease-in both;}

/* ── text-wrap: balance — câu hỏi xuống dòng tự nhiên ── */
.qz-q-text,.ls-hero-title,.ls-card-title{text-wrap:balance;}

/* ── oklch() — pastel sống động hơn trong display-p3 gamut ── */
@supports (color:oklch(50% 0.2 0)){
  :root{
    --rose:oklch(70% 0.22 358);
    --lav:oklch(65% 0.25 295);
    --mint:oklch(72% 0.17 162);
    --grad-start:oklch(70% 0.26 350);
    --grad-end:oklch(60% 0.28 300);
  }
  .qz-submit,.ls-card-arrow,.qz-confirm-btn,.qz-tf-btn-t.on,.qz-tf-btn-f.on{
    background:linear-gradient(135deg,var(--grad-start),var(--grad-end))!important;
  }
  .qz-opt.correct{border-color:var(--mint)!important;background:oklch(from var(--mint) l c h / .15)!important;}
  .qz-opt.wrong{border-color:oklch(62% 0.26 27)!important;background:oklch(62% 0.26 27 / .12)!important;}
  .qz-fill-input.ok{border-color:var(--mint)!important;color:var(--mint)!important;}
}

/* ── @starting-style — modals animate in/out bằng CSS thuần ── */
@supports selector(:popover-open){
  .modal-bg{transition:display .3s allow-discrete,opacity .3s;}
  .modal-bg:not(.show){opacity:0;pointer-events:none;}
  .modal-bg.show{opacity:1;}
  @starting-style{.modal-bg.show{opacity:0;}}
  .score-box,.warn-box,.pw-box,.hist-detail-box{
    transition:transform .35s cubic-bezier(0.34,1.56,0.64,1),opacity .3s;
  }
  .modal-bg:not(.show) .score-box,
  .modal-bg:not(.show) .warn-box,
  .modal-bg:not(.show) .pw-box,
  .modal-bg:not(.show) .hist-detail-box{transform:scale(.85) translateY(20px);opacity:0;}
  @starting-style{
    .modal-bg.show .score-box,
    .modal-bg.show .warn-box,
    .modal-bg.show .pw-box,
    .modal-bg.show .hist-detail-box{transform:scale(.85) translateY(20px);opacity:0;}
  }
}

/* ── View Transitions ── */
::view-transition-old(home){animation:vtOldOut .28s ease both;}
::view-transition-new(home){animation:vtNewIn .3s ease both;}
::view-transition-old(quiz){animation:vtSlideOutL .28s ease both;}
::view-transition-new(quiz){animation:vtSlideInR .3s ease both;}
@keyframes vtOldOut{to{opacity:0;transform:translateY(12px) scale(.97);}}
@keyframes vtNewIn{from{opacity:0;transform:translateY(-12px) scale(.97);}}
@keyframes vtSlideOutL{to{opacity:0;transform:translateX(-30px);}}
@keyframes vtSlideInR{from{opacity:0;transform:translateX(30px);}}
#home-screen{view-transition-name:home;}
#quiz-screen{view-transition-name:quiz;}
</style>
</head>
<body>
<div id="bg-layer"></div>
<div id="bg-blur-overlay"></div>
<div id="strk-t"></div>

<div id="app">
  <!-- HOME -->
  <div id="home-screen">
    <div class="ls-hdr">
      <div class="ls-hdr-row">
        <span class="logo-fl">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="url(#lgH)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <defs><linearGradient id="lgH" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f472b6"/><stop offset="100%" stop-color="#6366f1"/></linearGradient></defs>
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
        </span>
        <span class="logo-wrap">
          <span class="logo-learnsy">Luvie</span>
          <span class="logo-sub">Thu Anh &amp; Ngọc Anh</span>
        </span>
        <span class="logo-flb">
          <svg width="13" height="13" viewBox="0 0 20 20" fill="#6366f1"><path d="M10 0 L11.5 8.5 L20 10 L11.5 11.5 L10 20 L8.5 11.5 L0 10 L8.5 8.5 Z"/></svg>
        </span>
        <span style="font-size:10px;font-weight:900;color:#FF6B95;background:#FFF0F5;border:1.5px solid #F5D5E8;border-radius:99px;padding:2px 8px 2px 6px;margin-left:2px;flex-shrink:0;display:inline-flex;align-items:center;gap:4px;">
          <svg width="9" height="9" viewBox="0 0 20 20" fill="#FF6B95"><path d="M10 0 L11.5 8.5 L20 10 L11.5 11.5 L10 20 L8.5 11.5 L0 10 L8.5 8.5 Z"/></svg>
          Student
        </span>
        <div style="flex:1"></div>
        <button id="bg-fab" onclick="toggleBgPanel()" title="Đổi nền">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A855F7" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M3 12h1m16 0h1M12 3v1m0 16v1m-6.36-2.64.71-.71m11.31-11.31.71-.71M5.64 5.64l-.71-.71m12.73 12.73-.71-.71"/>
          </svg>
        </button>
        <button class="dm-btn" id="dm-btn-home" onclick="toggleDark()">
          <svg id="dm-icon-h" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A855F7" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>
      </div>
    </div>
    <div class="ls-body">
      <div class="ls-hero">
        <div style="margin-bottom:6px;">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <defs>
              <linearGradient id="heroGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#f472b6"/><stop offset="50%" stop-color="#a855f7"/><stop offset="100%" stop-color="#6366f1"/>
              </linearGradient>
            </defs>
            <rect x="6" y="8" width="22" height="32" rx="3" fill="url(#heroGrad)" opacity=".9"/>
            <rect x="10" y="8" width="26" height="32" rx="3" fill="url(#heroGrad)" opacity=".7" transform="rotate(3 10 8)"/>
            <rect x="8" y="8" width="24" height="32" rx="3" fill="white" stroke="url(#heroGrad)" stroke-width="1.5"/>
            <line x1="13" y1="17" x2="27" y2="17" stroke="url(#heroGrad)" stroke-width="1.8" stroke-linecap="round"/>
            <line x1="13" y1="22" x2="27" y2="22" stroke="url(#heroGrad)" stroke-width="1.8" stroke-linecap="round"/>
            <line x1="13" y1="27" x2="22" y2="27" stroke="url(#heroGrad)" stroke-width="1.8" stroke-linecap="round"/>
            <circle cx="37" cy="34" r="9" fill="url(#heroGrad)" opacity=".95"/>
            <path d="M33 34l3 3 6-6" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h1 class="ls-hero-title">Luyện tập hôm nay</h1>
        <p class="ls-hero-desc">Chọn bộ câu hỏi để bắt đầu ôn tập nào!</p>
      </div>
      <div id="ls-tabs" class="ls-tabs"></div>
      <div id="shuffle-bar"></div>
      <div id="lesson-list"></div>
    </div>
  </div>

  <!-- QUIZ -->
  <div id="quiz-screen">
    <div class="qz-hdr">
      <div class="qz-hdr-top">
        <button class="qz-back ao-glow-thin" onclick="showHome()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Quay lại
        </button>
        <div class="qz-title" id="quiz-title"></div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
          <div id="score-pill" style="display:none;padding:5px 14px;border-radius:999px;font-size:13px;font-weight:900;color:#fff;box-shadow:0 3px 12px rgba(0,0,0,0.25);"></div>
          <button class="dm-btn" id="dm-btn-quiz" onclick="toggleDark()">
            <svg id="dm-icon-q" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A855F7" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          </button>
        </div>
      </div>
      <div class="qz-prog-wrap"><div class="qz-prog-bar" id="prog-bar"></div></div>
      <div class="qz-hdr-meta">
        <span class="qz-type-badge" id="type-badge" style="color:#F9A8D4;"></span>
        <div id="qz-timer">
          <svg id="timer-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5"/><path d="M9 2h6"/><path d="M12 2v3"/>
          </svg>
          <span id="timer-txt">--:--</span>
        </div>
        <span class="qz-counter" id="q-counter">Câu 1 / 1</span>
      </div>
    </div>
    <div class="qz-body" id="qz-body">
      <div id="q-box" class="fade-up"></div>
      <div class="qz-dots-row">
        <button class="qz-nav-btn ao-glow-thin" id="btn-prev">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div class="qz-dots-scroll" id="dots"
          ontouchstart="event.stopPropagation()"
          ontouchmove="event.stopPropagation()"
          ontouchend="event.stopPropagation()"></div>
        <button class="qz-nav-btn ao-glow-thin" id="btn-next">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>
    </div>
    <div class="qz-bar">
      <button class="qz-submit ao-glow" id="btn-submit">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F9A8D4" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        Nộp bài
      </button>
      <button class="qz-retry ao-glow-thin" id="btn-retry">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        Làm lại
      </button>
    </div>
  </div>
</div>

<!-- WARN MODAL -->
<div class="modal-bg" id="warn-modal">
  <div class="warn-box">
    <div style="margin-bottom:12px;">
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
        <circle cx="22" cy="22" r="20" fill="rgba(252,211,77,0.15)" stroke="#FCD34D" stroke-width="2"/>
        <path d="M22 13v12" stroke="#FCD34D" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="22" cy="30" r="2" fill="#FCD34D"/>
      </svg>
    </div>
    <div style="font-size:16px;font-weight:900;color:#FCD34D;margin-bottom:8px;">Còn câu chưa làm!</div>
    <div style="font-size:13px;color:#B090C8;margin-bottom:18px;line-height:1.65;" id="warn-msg"></div>
    <div style="display:flex;gap:9px;">
      <button id="warn-review" style="flex:1;padding:10px 0;border-radius:999px;border:1.5px solid rgba(255,150,200,0.3);background:transparent;color:#F9A8D4;font-size:13px;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .2s cubic-bezier(0.34,1.56,0.64,1);">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        Xem lại
      </button>
      <button id="warn-force" class="ao-glow" style="flex:1;padding:10px 0;border-radius:999px;border:none;background:var(--ao-grad);background-size:220% 220%;animation:shimmer 5s ease infinite;color:#fff;font-size:13px;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .2s cubic-bezier(0.34,1.56,0.64,1);">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        Nộp thôi!
      </button>
    </div>
  </div>
</div>

<!-- SCORE MODAL -->
<div class="modal-bg" id="score-modal" onclick="if(event.target===this)this.classList.remove('show')">
  <div class="score-box" onclick="event.stopPropagation()">
    <div id="modal-icon" style="margin-bottom:14px;"></div>
    <div id="modal-score" style="font-size:38px;font-weight:900;line-height:1;margin-bottom:4px;animation:scoreNum .5s ease both;animation-delay:.3s;"></div>
    <div style="height:7px;background:rgba(255,255,255,0.08);border-radius:99px;margin:10px 0 8px;overflow:hidden;">
      <div id="modal-bar" style="height:100%;border-radius:99px;transition:width .8s ease .5s;width:0%;"></div>
    </div>
    <div id="modal-pct" style="font-size:12px;color:rgba(255,255,255,0.4);margin-bottom:14px;"></div>
    <div id="modal-msg" style="font-size:14px;font-weight:800;margin-bottom:6px;"></div>
    <div id="modal-list" style="background:rgba(255,255,255,0.04);border:1px solid rgba(196,181,253,0.12);border-radius:14px;padding:9px 12px;margin-bottom:18px;max-height:130px;overflow-y:auto;"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button id="modal-retry" style="flex:1;min-width:90px;padding:10px 0;border-radius:999px;border:1.5px solid rgba(255,150,200,0.3);background:transparent;color:#F9A8D4;font-size:13px;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .2s cubic-bezier(0.34,1.56,0.64,1);">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        Làm lại
      </button>
      <button id="btn-share" style="padding:10px 14px;border-radius:999px;border:1.5px solid rgba(255,150,200,0.3);background:transparent;color:#F9A8D4;font-size:13px;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;display:none;align-items:center;gap:5px;transition:all .2s cubic-bezier(0.34,1.56,0.64,1);">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
      </button>
      <button id="btn-detail" class="ao-glow" style="flex:1;min-width:90px;padding:10px 0;border-radius:999px;border:none;background:var(--ao-grad);background-size:220% 220%;animation:shimmer 5s ease infinite;color:#fff;font-size:13px;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .2s cubic-bezier(0.34,1.56,0.64,1);">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        Xem đáp án
      </button>
    </div>
  </div>
</div>

<!-- PW MODAL -->
<div class="modal-bg" id="pw-modal">
  <div class="pw-box">
    <div style="margin-bottom:10px;">
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
        <defs><linearGradient id="pwGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f472b6"/><stop offset="100%" stop-color="#a855f7"/></linearGradient></defs>
        <circle cx="22" cy="22" r="20" fill="rgba(168,85,247,0.1)" stroke="url(#pwGrad)" stroke-width="1.5"/>
        <rect x="13" y="20" width="18" height="13" rx="3" fill="url(#pwGrad)" opacity=".9"/>
        <path d="M16 20v-4a6 6 0 0 1 12 0v4" stroke="url(#pwGrad)" stroke-width="2.2" stroke-linecap="round"/>
        <circle cx="22" cy="27" r="2" fill="white"/>
      </svg>
    </div>
    <div id="pw-title" style="font-size:16px;font-weight:900;color:#3D1830;margin-bottom:4px;"></div>
    <div style="font-size:12px;color:#A07090;margin-bottom:16px;">Nhập mật khẩu để mở bài này</div>
    <input id="pw-input" type="password" placeholder="Mật khẩu..."
      style="width:100%;padding:12px 16px;border:1.5px solid #E8DCFF;border-radius:14px;font-size:15px;font-weight:700;color:#3D1830;background:#FAF5FF;outline:none;text-align:center;letter-spacing:3px;margin-bottom:10px;font-family:'Nunito',sans-serif;"/>
    <div id="pw-err" style="font-size:12px;color:#EF4444;min-height:16px;margin-bottom:8px;font-weight:700;"></div>
    <button id="pw-ok" class="ao-glow" style="width:100%;padding:13px;border-radius:999px;border:none;background:var(--ao-grad);background-size:220% 220%;animation:shimmer 5s ease infinite;color:#fff;font-size:14px;font-weight:900;cursor:pointer;margin-bottom:8px;font-family:'Nunito',sans-serif;display:flex;align-items:center;justify-content:center;gap:7px;transition:all .22s cubic-bezier(0.34,1.56,0.64,1);">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      Mở bài
    </button>
    <button onclick="hidePw()" style="width:100%;padding:10px;border-radius:999px;border:1.5px solid #F5D5E8;background:transparent;color:#A07090;font-size:13px;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .2s;">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
      Quay lại
    </button>
  </div>
</div>

<!-- BG PANEL -->
<div id="bg-panel">
  <div id="bg-panel-title">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="url(#bgTitleGrad)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <defs><linearGradient id="bgTitleGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f472b6"/><stop offset="100%" stop-color="#a855f7"/></linearGradient></defs>
      <circle cx="12" cy="12" r="3"/><path d="M3 12h1m16 0h1M12 3v1m0 16v1m-6.36-2.64.71-.71m11.31-11.31.71-.71M5.64 5.64l-.71-.71m12.73 12.73-.71-.71"/>
    </svg>
    <span style="background:linear-gradient(120deg,#f472b6,#a855f7);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">Nền & Hiệu ứng</span>
    <button onclick="closeBgPanel()" style="margin-left:auto;background:none;border:none;cursor:pointer;padding:2px;color:#C084FC;display:flex;align-items:center;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>
  <div class="bg-swatches" id="bg-swatches"></div>
  <div class="bg-upload-row">
    <input type="file" id="bg-upload-input" accept="image/*" style="display:none;" onchange="handleBgUpload(event)">
    <button class="bg-upload-btn" onclick="document.getElementById('bg-upload-input').click()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      Tải ảnh nền lên
    </button>
  </div>
  <div class="bg-blur-row">
    <span class="bg-blur-label">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#A855F7" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
      <span style="font-size:12px;font-weight:800;color:#6B3050;" id="blur-label-txt">Hiệu ứng blur</span>
    </span>
    <button class="bg-blur-toggle off" id="bg-blur-btn" onclick="toggleBgBlur()"></button>
  </div>
  <div class="bg-blur-slider-row" id="bg-blur-slider-row">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#A855F7" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg>
    <input type="range" id="bg-blur-range" min="0" max="100" value="25" oninput="setBgBlurPct(this.value)">
    <span id="bg-blur-pct">25%</span>
  </div>
</div>

<script>
var LESSONS=${escLessons};
var QS=[],answers=[],answeredQ={},cur=0,submitted=false,total=0;
var LTRS=['A','B','C','D','E','F'];
var _dark=false,_filterTab='all';

/* ── RUNTIME SHUFFLE ── */
var shuffleQ=${shuffleQ ? 'true' : 'false'},shuffleA=${shuffleA ? 'true' : 'false'};
function _shuf(a){var r=a.slice();for(var i=r.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=r[i];r[i]=r[j];r[j]=t;}return r;}
function applyShuffleA(qs){if(!shuffleA)return qs;return qs.map(function(q){if(q.type==='multiple'){var cv=q.options[q.correct];var o=_shuf(q.options.slice());return Object.assign({},q,{options:o,correct:o.indexOf(cv)});}if(q.type==='multi_select'){var cvs=(q.correct||[]).map(function(i){return q.options[i];});var o=_shuf(q.options.slice());return Object.assign({},q,{options:o,correct:cvs.map(function(v){return o.indexOf(v);})});}if(q.type==='true_false'){return Object.assign({},q,{items:_shuf(q.items.slice())});}return q;});}
function applyShuffleQ(qs){if(!shuffleQ)return qs;return _shuf(qs);}

/* ── SOUND ── */
${soundFns}

/* ── HAPTIC ── */
function haptic(t){try{if(navigator.vibrate){navigator.vibrate(t==='success'?[30]:t==='error'?[20,40,20]:[10]);}}catch(e){}}

/* ── DARK MODE ── */
function toggleDark(){
  _dark=!_dark;
  document.body.classList.toggle('dark',_dark);
  var sun='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FCD34D" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  var moon='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A855F7" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  var svg=_dark?sun:moon;
  var h=document.getElementById('dm-icon-h');if(h)h.outerHTML=svg;
  var q=document.getElementById('dm-icon-q');if(q)q.outerHTML=svg;
  // Update dark colors in bg-panel
  var panel=document.getElementById('bg-panel');
  if(panel){panel.style.background=_dark?'rgba(24,6,30,0.97)':'rgba(255,255,255,0.96)';panel.style.borderColor=_dark?'#421526':'#F5D5E8';}
  var lbl=document.getElementById('blur-label-txt');
  if(lbl){lbl.style.color=_bgBlur?'#A855F7':(_dark?'#C898B8':'#6B3050');}
  // Re-render theme-dependent components
  renderShuffleBar();
}

/* ── BACKGROUND THEMES ── */
var BG_THEMES=[
  {key:'none',label:'Mặc định',bg:'linear-gradient(135deg,#FFF5F9,#F0E6FF)',layer:'',icon:'none'},
  {key:'rose',label:'Hồng Rose',bg:'linear-gradient(135deg,#FFE4ED,#FFB6C1,#FF69B4)',layer:'linear-gradient(135deg,#FFE4ED 0%,#FFC0CB 50%,#FFB6C1 100%)'},
  {key:'lav',label:'Lavender',bg:'linear-gradient(135deg,#E6E0FF,#D8C8FF,#C9B8F0)',layer:'linear-gradient(135deg,#E6E0FF 0%,#D8BBFF 50%,#C9AAFF 100%)'},
  {key:'mint',label:'Bạc Hà',bg:'linear-gradient(135deg,#C8F7E0,#B0EDD0,#90E0B8)',layer:'linear-gradient(135deg,#C8F7E4 0%,#A8EED2 50%,#85E0BC 100%)'},
  {key:'sky',label:'Xanh Sky',bg:'linear-gradient(135deg,#C8E8FF,#B8D8F8,#A0C8F0)',layer:'linear-gradient(135deg,#C8E8FF 0%,#B0D4FF 50%,#95C2FF 100%)'},
  {key:'peach',label:'Đào',bg:'linear-gradient(135deg,#FFE0C8,#FFD0B0,#FFC090)',layer:'linear-gradient(135deg,#FFE4C8 0%,#FFD0A8 50%,#FFBA8C 100%)'},
  {key:'lemon',label:'Chanh',bg:'linear-gradient(135deg,#FFF8C0,#FFF090,#FFE860)',layer:'linear-gradient(135deg,#FFFAC8 0%,#FFF398 50%,#FFE968 100%)'},
  {key:'lilac',label:'Lilac',bg:'linear-gradient(135deg,#F0D8FF,#E4C0FF,#D8A8FF)',layer:'linear-gradient(135deg,#F2DAFF 0%,#E6C2FF 50%,#D8AAFF 100%)'},
  {key:'blush',label:'Blush',bg:'linear-gradient(135deg,#FFD8E8,#FFC0D8,#FFA8C8)',layer:'linear-gradient(135deg,#FFDAEA 0%,#FFC2D8 50%,#FFAAC8 100%)'},
];
var _bgKey='none',_bgBlur=false,_bgBlurPct=25,_bgCustomImg=null;
var _BG_STORE='ls_export_bg';

function _loadBgPref(){
  try{
    var d=JSON.parse(localStorage.getItem(_BG_STORE)||'{}');
    _bgKey=d.key||'none';_bgBlur=!!d.blur;
    _bgBlurPct=(typeof d.blurPct==='number')?d.blurPct:25;
    _bgCustomImg=d.customImg||null;
  }catch(e){}
}
function _saveBgPref(){
  try{localStorage.setItem(_BG_STORE,JSON.stringify({key:_bgKey,blur:_bgBlur,blurPct:_bgBlurPct,customImg:_bgCustomImg}));}catch(e){}
}

function applyBgTheme(key,blur){
  _bgKey=key;_bgBlur=blur;
  var layer=document.getElementById('bg-layer');
  var body=document.body;
  BG_THEMES.forEach(function(t){body.classList.remove('bg-'+t.key);});

  if(key==='custom'&&_bgCustomImg){
    layer.style.background='';
    layer.style.backgroundImage='url('+_bgCustomImg+')';
    layer.classList.add('active');
  } else if(key!=='none'){
    var theme=BG_THEMES.filter(function(t){return t.key===key;})[0]||BG_THEMES[0];
    layer.style.backgroundImage='';
    layer.style.background=theme.layer||theme.bg;
    layer.classList.add('active');
    body.classList.add('bg-'+key);
  } else {
    layer.style.backgroundImage='';
    layer.classList.remove('active');
  }

  document.documentElement.style.setProperty('--bg-blur-px',Math.round(_bgBlurPct*0.8)+'px');
  body.classList.toggle('bg-blur-on',blur&&key!=='none');
  _saveBgPref();
  _renderSwatches();
  var btn=document.getElementById('bg-blur-btn');
  if(btn){btn.className='bg-blur-toggle '+(blur?'on':'off');}
  var lbl=document.getElementById('blur-label-txt');
  if(lbl){lbl.style.color=blur?'#A855F7':(_dark?'#C898B8':'#6B3050');}
  var sliderRow=document.getElementById('bg-blur-slider-row');
  if(sliderRow){sliderRow.classList.toggle('show',blur&&key!=='none');}
  var range=document.getElementById('bg-blur-range');
  if(range)range.value=_bgBlurPct;
  var pctTxt=document.getElementById('bg-blur-pct');
  if(pctTxt)pctTxt.textContent=_bgBlurPct+'%';
}

function toggleBgBlur(){
  applyBgTheme(_bgKey,!_bgBlur);
}

function setBgBlurPct(v){
  _bgBlurPct=parseInt(v,10)||0;
  document.documentElement.style.setProperty('--bg-blur-px',Math.round(_bgBlurPct*0.8)+'px');
  var pctTxt=document.getElementById('bg-blur-pct');
  if(pctTxt)pctTxt.textContent=_bgBlurPct+'%';
  _saveBgPref();
}

function handleBgUpload(ev){
  var file=ev.target.files&&ev.target.files[0];
  if(!file)return;
  if(!file.type||file.type.indexOf('image/')!==0){return;}
  var reader=new FileReader();
  reader.onload=function(e){
    _bgCustomImg=e.target.result;
    _bgBlur=true;
    _bgBlurPct=25;
    applyBgTheme('custom',true);
  };
  reader.readAsDataURL(file);
  ev.target.value='';
}

function removeBgCustom(ev){
  if(ev)ev.stopPropagation();
  _bgCustomImg=null;
  applyBgTheme('none',_bgBlur);
}

function _renderSwatches(){
  var el=document.getElementById('bg-swatches');if(!el)return;
  el.innerHTML='';
  var checkSvg='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
  BG_THEMES.forEach(function(t){
    var div=document.createElement('div');
    div.className='bg-swatch'+(_bgKey===t.key?' active':'');
    div.style.background=t.bg;
    if(t.key==='none'){
      var noneInner=_bgKey==='none'?checkSvg:'<span style="opacity:.4;font-size:13px;color:#C084FC;font-weight:900;">OFF</span>';
      div.innerHTML='<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;border-radius:10px;background:linear-gradient(135deg,#FFF5F9,#F0E6FF);">'+noneInner+'</div>';
      div.title='Mặc định';
    } else {
      div.innerHTML='<div class="bg-swatch-check">'+checkSvg+'</div>';
      div.title=t.label;
    }
    div.onclick=(function(k){return function(){applyBgTheme(k,_bgBlur);};})(t.key);
    el.appendChild(div);
  });
  if(_bgCustomImg){
    var cdiv=document.createElement('div');
    cdiv.className='bg-custom-thumb'+(_bgKey==='custom'?' active':'');
    cdiv.style.backgroundImage='url('+_bgCustomImg+')';
    cdiv.title='Ảnh của bạn';
    cdiv.innerHTML='<div class="bg-swatch-check">'+checkSvg+'</div>'
      +'<button class="bg-custom-rm" onclick="removeBgCustom(event)" title="Xóa ảnh"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
    cdiv.onclick=function(){applyBgTheme('custom',_bgBlur);};
    el.appendChild(cdiv);
  }
}

function toggleBgPanel(){
  var panel=document.getElementById('bg-panel');
  var fab=document.getElementById('bg-fab');
  if(!panel)return;
  var showing=panel.classList.contains('show');
  if(showing){closeBgPanel();}
  else{
    panel.classList.add('show');
    if(fab)fab.classList.add('open');
    _renderSwatches();
    var btn=document.getElementById('bg-blur-btn');
    if(btn){btn.className='bg-blur-toggle '+(_bgBlur?'on':'off');}
    document.addEventListener('click',_bgPanelOutsideClick,{capture:true,once:true});
    setTimeout(function(){},0);
  }
}
function closeBgPanel(){
  var panel=document.getElementById('bg-panel');
  var fab=document.getElementById('bg-fab');
  if(panel)panel.classList.remove('show');
  if(fab)fab.classList.remove('open');
}
function _bgPanelOutsideClick(e){
  var panel=document.getElementById('bg-panel');
  var fab=document.getElementById('bg-fab');
  if(panel&&!panel.contains(e.target)&&fab&&!fab.contains(e.target)){
    closeBgPanel();
  } else if(panel&&(panel.contains(e.target)||fab&&fab.contains(e.target))){
    document.addEventListener('click',_bgPanelOutsideClick,{capture:true,once:true});
  }
}

/* ── HOME ── */
function showHome(){
  var _do=function(){
    document.getElementById('home-screen').style.display='block';
    document.getElementById('quiz-screen').style.display='none';
    renderTabs();renderShuffleBar();renderLessons();
  };
  if(document.startViewTransition){document.startViewTransition(_do);}else{_do();}
  _releaseWake();
  stopTimer();
}

var SUBJECT_COLORS={
  'Tiếng Anh':{bg:'#F0E6FF',color:'#A855F7',border:'#E8DCFF'},
  'Toán':{bg:'#ECFDF5',color:'#10B981',border:'#BBF7D0'},
  'Lịch Sử':{bg:'#FFF7ED',color:'#F97316',border:'#FED7AA'},
  'Địa Lý':{bg:'#EFF6FF',color:'#3B82F6',border:'#BFDBFE'},
};
function sc(s){return SUBJECT_COLORS[s]||{bg:'#FFF0F5',color:'#FF6B95',border:'#F5D5E8'};}

function renderTabs(){
  var el=document.getElementById('ls-tabs');
  if(!LESSONS.length){el.innerHTML='';return;}
  var tabs=[
    {key:'all',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 10h16M4 14h8M4 18h6"/></svg>',label:'Tất cả',count:LESSONS.length},
    {key:'english',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8l4 4-4 4"/><path d="M12 16h7"/></svg>',label:'Tiếng Anh',count:LESSONS.filter(function(l){return l.subject==='Tiếng Anh';}).length},
    {key:'other',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',label:'Các môn',count:LESSONS.filter(function(l){return l.subject!=='Tiếng Anh';}).length},
  ];
  el.innerHTML='';
  tabs.forEach(function(t){
    var active=_filterTab===t.key;
    var btn=document.createElement('button');
    btn.className='ls-tab'+(active?' active':'');
    btn.innerHTML='<span style="display:flex;align-items:center;gap:4px;">'+t.icon+'<span style="font-size:11px;">'+t.label+'</span></span>'
      +'<span class="ls-tab-count">'+t.count+' bài</span>';
    btn.onclick=(function(k){return function(){_filterTab=k;renderTabs();renderLessons();};})(t.key);
    el.appendChild(btn);
  });
}

function renderShuffleBar(){
  var bar=document.getElementById('shuffle-bar');
  if(!bar||!LESSONS.length){if(bar)bar.style.display='none';return;}
  bar.style.display='block';
  var activeCount=(shuffleQ?1:0)+(shuffleA?1:0);
  bar.innerHTML=
    '<button class="setn-btn ao-glow-thin'+(activeCount?' active-n':'')+'" id="setn-toggle-btn" onclick="toggleSettingsPop()">'
      +'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
      +'<span>Cài đặt</span>'
      +(activeCount?'<span class="setn-badge"><span>'+activeCount+'</span></span>':'')
      +'<svg class="setn-chevron" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>'
    +'</button>'
    +'<div class="setn-pop" id="setn-pop">'
      +'<div class="setn-row'+(shuffleQ?' on-q':'')+'" id="setn-row-q" onclick="toggleShuffleSetting(\\'Q\\')">'
        +'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F472B6" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6"/></svg>'
        +'<span class="setn-row-label">Xáo thứ tự câu</span>'
        +'<div class="shuf-track"><div class="shuf-thumb"></div></div>'
      +'</div>'
      +'<div class="setn-row'+(shuffleA?' on-a':'')+'" id="setn-row-a" onclick="toggleShuffleSetting(\\'A\\')">'
        +'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#A855F7" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6"/></svg>'
        +'<span class="setn-row-label">Xáo đáp án</span>'
        +'<div class="shuf-track"><div class="shuf-thumb"></div></div>'
      +'</div>'
    +'</div>';
}

function toggleSettingsPop(){
  var pop=document.getElementById('setn-pop');
  var btn=document.getElementById('setn-toggle-btn');
  if(!pop||!btn)return;
  var willShow=!pop.classList.contains('show');
  pop.classList.toggle('show',willShow);
  btn.classList.toggle('open',willShow);
}

function toggleShuffleSetting(key){
  if(key==='Q')shuffleQ=!shuffleQ;else shuffleA=!shuffleA;
  renderShuffleBar();
  var pop=document.getElementById('setn-pop');
  var btn=document.getElementById('setn-toggle-btn');
  if(pop){pop.classList.add('show');}
  if(btn){btn.classList.add('open');}
}

document.addEventListener('click',function(e){
  var bar=document.getElementById('shuffle-bar');
  if(!bar)return;
  if(!bar.contains(e.target)){
    var pop=document.getElementById('setn-pop');
    var btn=document.getElementById('setn-toggle-btn');
    if(pop)pop.classList.remove('show');
    if(btn)btn.classList.remove('open');
  }
});

function renderLessons(){
  var list=document.getElementById('lesson-list');
  var filtered=LESSONS.filter(function(l){
    if(_filterTab==='english')return l.subject==='Tiếng Anh';
    if(_filterTab==='other')return l.subject!=='Tiếng Anh';
    return true;
  });
  if(!filtered.length){
    list.innerHTML='<div style="text-align:center;padding:32px 20px;color:'+(_dark?'#8A6080':'#A07090')+';font-size:13px;font-weight:800;display:flex;flex-direction:column;align-items:center;gap:8px;"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity=".4"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>Chưa có bài nào</div>';
    return;
  }
  list.innerHTML='';
  var grid=document.createElement('div');grid.className='ls-grid';
  filtered.forEach(function(l,idx){
    var col=sc(l.subject);
    var qc=(l.questions||[]).length;
    var card=document.createElement('div');
    card.className='ls-card';
    card.style.animationDelay=(idx*0.05)+'s';
    card.innerHTML=
      '<div class="ls-card-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="url(#ciGrad'+idx+')" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><defs><linearGradient id="ciGrad'+idx+'" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f472b6"/><stop offset="100%" stop-color="#a855f7"/></linearGradient></defs><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></div>'+
      '<div class="ls-card-body">'+
        '<div class="ls-card-title">'+(l.password?'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="display:inline;vertical-align:-1px;margin-right:3px;opacity:.7"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>':'')+(l.title||'Chưa đặt tên')+'</div>'+
        '<div class="ls-card-tags">'+
          '<span style="font-size:10px;font-weight:800;color:'+col.color+';background:'+col.bg+';border:1px solid '+col.border+';border-radius:99px;padding:2px 8px;">'+(l.subject||'Tiếng Anh')+'</span>'+
          (qc?'<span style="font-size:10px;font-weight:800;color:'+(_dark?'#C898B8':'#A07090')+';background:'+(_dark?'rgba(255,255,255,0.06)':'rgba(168,85,247,0.07)')+';border:1px solid '+(_dark?'rgba(255,255,255,0.1)':'rgba(168,85,247,0.15)')+';border-radius:99px;padding:2px 8px;">'+qc+' câu</span>':'')+
          (l.password?'<span style="font-size:10px;font-weight:800;color:#F97316;background:#FFF7ED;border:1px solid #FED7AA;border-radius:99px;padding:2px 8px 2px 6px;display:inline-flex;align-items:center;gap:4px;"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#F97316" stroke-width="2.5" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Có mật khẩu</span>':'')+
        '</div>'+
      '</div>'+
      '<div class="ls-card-arrow"><svg width="14" height="14" viewBox="0 0 20 20" fill="white"><path d="M7 5l6 5-6 5V5z"/></svg></div>';
    var realIdx=LESSONS.indexOf(l);
    card.onclick=(function(i){return function(){loadLesson(i);};})(realIdx);
    grid.appendChild(card);
  });
  list.appendChild(grid);
}

/* ── PASSWORD ── */
var _pwCallback=null;
function loadLesson(idx){
  var lesson=LESSONS[idx];
  if(!lesson||!(lesson.questions||[]).length){alert('Bộ câu hỏi này chưa có câu nào!');return;}
  if(lesson.password){showPw(lesson,function(){_doLoad(lesson);});return;}
  _doLoad(lesson);
}
function showPw(lesson,cb){
  _pwCallback=cb;
  var m=document.getElementById('pw-modal');
  document.getElementById('pw-title').textContent=lesson.title||'';
  document.getElementById('pw-input').value='';
  document.getElementById('pw-err').textContent='';
  m.classList.add('show');
  setTimeout(function(){document.getElementById('pw-input').focus();},80);
  var ok=function(){
    var v=document.getElementById('pw-input').value;
    if(v===lesson.password){hidePw();cb();}
    else{
      var e=document.getElementById('pw-err');e.textContent='Sai mật khẩu, thử lại!';
      var inp=document.getElementById('pw-input');
      inp.classList.add('do-shake');inp.value='';
      setTimeout(function(){inp.classList.remove('do-shake');inp.focus();},380);
    }
  };
  document.getElementById('pw-ok').onclick=ok;
  document.getElementById('pw-input').onkeydown=function(e){if(e.key==='Enter')ok();};
}
function hidePw(){document.getElementById('pw-modal').classList.remove('show');}

function _doLoad(lesson){
  QS=applyShuffleA(lesson.questions.slice());
  QS=applyShuffleQ(QS);
  total=QS.length;
  answers=QS.map(function(q){
    if(q.type==='true_false')return q.items.map(function(){return null;});
    if(q.type==='multi_select')return[];
    return null;
  });
  answeredQ={};cur=0;submitted=false;
  document.getElementById('quiz-title').textContent=lesson.title||'Bài tập';
  document.getElementById('score-pill').style.display='none';
  document.getElementById('btn-submit').style.display='flex';
  document.getElementById('btn-retry').style.display='none';
  var _go=function(){
    document.getElementById('home-screen').style.display='none';
    document.getElementById('quiz-screen').style.display='flex';
    render();
  };
  if(document.startViewTransition){document.startViewTransition(_go);}else{_go();}
  _requestWake();
  // Khởi động timer nếu bài có timeLimit
  stopTimer();
  if(lesson.timeLimit&&lesson.timeLimit>0)startTimer(lesson.timeLimit);
}

/* ── QUIZ RENDER ── */
function render(skipDots){
  var q=QS[cur];
  document.getElementById('prog-bar').style.width=((cur+1)/total*100)+'%';
  document.getElementById('q-counter').textContent='Câu '+(cur+1)+' / '+total;
  var typeMap={multiple:{l:'Trắc nghiệm',c:'#F9A8D4'},multi_select:{l:'Chọn nhiều',c:'#6EE7B7'},true_false:{l:'Đúng / Sai',c:'#C084FC'},fill_blank:{l:'Điền chỗ trống',c:'#FED7AA'}};
  var ti=typeMap[q.type]||typeMap.multiple;
  var badge=document.getElementById('type-badge');
  badge.textContent=ti.l;badge.style.color=ti.c;

  var box=document.getElementById('q-box');
  box.innerHTML='';
  box.className='fade-up';void box.offsetWidth;box.className='fade-up';

  // Passage (true_false)
  if(q.type==='true_false'&&q.passage){
    var pw=document.createElement('div');pw.className='qz-passage-wrap';
    pw.innerHTML='<div class="qz-passage-lbl"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#C084FC" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>ĐOẠN TƯ LIỆU</div>'
      +'<p class="qz-passage-text">'+q.passage+'</p>'
      +(q.source?'<div class="qz-source">'+q.source+'</div>':'');
    box.appendChild(pw);
  }

  // Question text
  if(q.type!=='true_false'&&q.question){
    var qw=document.createElement('div');qw.className='qz-surface';
    qw.innerHTML='<div class="qz-type-lbl" style="color:'+ti.c+'">'+ti.l+'</div>'
      +'<p class="qz-q-text">'+q.question+'</p>'
      +(q.type==='multi_select'?'<p style="font-size:11px;color:#A07090;margin-top:5px;font-weight:700;">Chọn tất cả đáp án đúng</p>':'');
    box.appendChild(qw);
  }

  // Ảnh minh họa (q.image) — bấm để phóng to / thu nhỏ
  if(q.image){
    var qim=document.createElement('img');qim.className='qz-img';qim.alt='Ảnh minh họa';qim.loading='lazy';qim.src=q.image;
    qim.onclick=function(){qim.classList.toggle('zoomed');};
    qim.onerror=function(){qim.style.display='none';};
    box.appendChild(qim);
  }

  var c=document.createElement('div');

  if(q.type==='multiple'||q.type==='multi_select'){
    c.className='qz-opts';
    var isMS=q.type==='multi_select';
    var isAns=answeredQ[cur]||submitted;
    q.options.forEach(function(opt,i){
      var sel=isMS?(answers[cur]||[]).includes(i):answers[cur]===i;
      var isCor=isMS?(q.correct||[]).includes(i):q.correct===i;
      var cls='qz-opt';
      if(isAns&&isCor)cls+=' correct';
      else if(isAns&&sel&&!isCor)cls+=' wrong';
      else if(isAns&&!sel&&isCor)cls+=' missed';
      else if(sel)cls+=' sel';
      var btn=document.createElement('button');btn.className=cls;
      btn.innerHTML='<span class="qz-opt-letter">'+LTRS[i]+'</span>'
        +'<span class="qz-opt-text">'+opt+'</span>'
        +(isAns&&isCor?'<span style="margin-left:auto;display:flex;align-items:center;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></span>':'');
      if(!isAns){
        btn.onclick=(function(idx){return function(){
          if(isMS){var a=(answers[cur]||[]).slice();var p=a.indexOf(idx);if(p>=0)a.splice(p,1);else a.push(idx);answers[cur]=a;}
          else{answers[cur]=answers[cur]===idx?null:idx;}
          playClick();render(true);
        };})(i);
      }
      c.appendChild(btn);
    });
    if(isMS&&!isAns&&(answers[cur]||[]).length>0){
      var cf=document.createElement('button');cf.className='qz-confirm-btn';
      cf.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg> Xác nhận';
      cf.onclick=function(){
        answeredQ[cur]=true;
        var ok=JSON.stringify((answers[cur]||[]).slice().sort())===JSON.stringify((q.correct||[]).slice().sort());
        if(ok){playCorrect();haptic('success');bumpStreak(true);}else{playWrong();haptic('error');bumpStreak(false);}
        render(true);
      };
      c.appendChild(cf);
    }
  } else if(q.type==='true_false'){
    c.className='qz-tf-items';
    q.items.forEach(function(item,ii){
      var sv=(answers[cur]&&answers[cur][ii]!==undefined)?answers[cur][ii]:null;
      var ok2=submitted&&sv===item.answer;var bad2=submitted&&sv!==null&&sv!==item.answer;
      var div=document.createElement('div');
      div.className='qz-tf-item'+(ok2?' ok':bad2?' bad':sv===true?' sel-t':sv===false?' sel-f':'');
      div.innerHTML='<div class="qz-tf-row"><span class="qz-tf-ltr">'+String.fromCharCode(97+ii)+'.</span><p class="qz-tf-text">'+item.text+'</p></div>';
      var btns=document.createElement('div');btns.className='qz-tf-btns';
      var bt=document.createElement('button');bt.className='qz-tf-btn qz-tf-btn-t'+(sv===true?' on':'')+(submitted&&item.answer===true?' sub-ok':submitted&&sv===true&&item.answer!==true?' sub-bad':'');
      bt.innerHTML='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg> Đúng';
      var bf=document.createElement('button');bf.className='qz-tf-btn qz-tf-btn-f'+(sv===false?' on':'')+(submitted&&item.answer===false?' sub-ok':submitted&&sv===false&&item.answer!==false?' sub-bad':'');
      bf.innerHTML='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Sai';
      if(!submitted){
        bt.onclick=(function(i2){return function(){var n=(answers[cur]||q.items.map(function(){return null;})).slice();n[i2]=n[i2]===true?null:true;answers[cur]=n;playClick();render(true);};})(ii);
        bf.onclick=(function(i2){return function(){var n=(answers[cur]||q.items.map(function(){return null;})).slice();n[i2]=n[i2]===false?null:false;answers[cur]=n;playClick();render(true);};})(ii);
      }
      btns.appendChild(bt);btns.appendChild(bf);
      if(submitted){var ab=document.createElement('span');ab.className='qz-tf-ans-badge';ab.textContent='Đáp án: '+(item.answer?'✓':'✗');btns.appendChild(ab);}
      div.appendChild(btns);c.appendChild(div);
    });
  } else if(q.type==='fill_blank'){
    var isAnsF=answeredQ[cur]||submitted;
    var inp=document.createElement('input');inp.className='qz-fill-input';inp.placeholder='Nhập câu trả lời... (Enter để kiểm tra)';inp.value=answers[cur]||'';
    if(isAnsF){var cF=(answers[cur]||'').trim().toLowerCase()===q.answer.trim().toLowerCase();inp.className+=(cF?' ok':' bad');inp.readOnly=true;}
    inp.oninput=function(){if(!isAnsF){answers[cur]=this.value;render(true);}};
    inp.onkeydown=function(e){
      if(e.key==='Enter'&&!isAnsF&&(answers[cur]||'').trim()){
        answeredQ[cur]=true;
        var ok3=(answers[cur]||'').trim().toLowerCase()===q.answer.trim().toLowerCase();
        if(ok3){playCorrect();haptic('success');bumpStreak(true);}else{playWrong();haptic('error');bumpStreak(false);inp.classList.add('do-shake');setTimeout(function(){inp.classList.remove('do-shake');},400);}
        render(true);
      }
    };
    var inpWrap=document.createElement('div');inpWrap.className='qz-fill-wrap';inpWrap.appendChild(inp);
    c.appendChild(inpWrap);
    if(isAnsF){
      var cF2=(answers[cur]||'').trim().toLowerCase()===q.answer.trim().toLowerCase();
      var fb=document.createElement('div');fb.className='qz-fill-fb';fb.style.color=cF2?'#6EE7B7':'#FCA5A5';
      fb.innerHTML=(cF2?'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg> Chính xác!':'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Đáp án đúng: '+q.answer);c.appendChild(fb);
    } else if((answers[cur]||'').trim()){
      var cfBF=document.createElement('button');cfBF.className='qz-confirm-btn';cfBF.style.marginTop='8px';
      cfBF.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg> Kiểm tra';
      cfBF.onclick=function(){
        answeredQ[cur]=true;
        var ok4=(answers[cur]||'').trim().toLowerCase()===q.answer.trim().toLowerCase();
        if(ok4){playCorrect();haptic('success');bumpStreak(true);}else{playWrong();haptic('error');bumpStreak(false);inp.classList.add('do-shake');setTimeout(function(){inp.classList.remove('do-shake');},400);}
        render(true);
      };
      c.appendChild(cfBF);
      if(q.hint){var hEl=document.createElement('div');hEl.className='qz-hint';hEl.innerHTML='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:-1px;margin-right:4px;"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>'+q.hint;c.appendChild(hEl);}
    } else if(q.hint&&!isAnsF){var hEl2=document.createElement('div');hEl2.className='qz-hint';hEl2.innerHTML='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:-1px;margin-right:4px;"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>'+q.hint;c.appendChild(hEl2);}
  }

  box.appendChild(c);
  if(!skipDots)renderDots();
  document.getElementById('btn-prev').disabled=cur===0;
  document.getElementById('btn-next').disabled=cur===total-1;
  setTimeout(function(){var i=document.querySelector('.qz-fill-input:not([readonly])');if(i&&cur===0){}},50);
}

function renderDots(){
  var d=document.getElementById('dots');d.innerHTML='';
  QS.forEach(function(q,i){
    var isActive=i===cur;
    var isAns=answeredQ[i]||submitted;
    var bg,border,txtColor,shadow,scale;
    if(submitted){
      var ok=false;
      if(q.type==='multiple')ok=answers[i]===q.correct;
      else if(q.type==='multi_select')ok=JSON.stringify((answers[i]||[]).slice().sort())===JSON.stringify((q.correct||[]).slice().sort());
      else if(q.type==='true_false')ok=q.items.every(function(it,ii){return(answers[i]||[])[ii]===it.answer;});
      else ok=(answers[i]||'').trim().toLowerCase()===q.answer.trim().toLowerCase();
      var clr=ok?'#10B981':'#EF4444';
      bg=isActive?clr:'transparent';border='1.5px solid '+clr;txtColor=isActive?'#fff':clr;
      shadow=isActive?'0 2px 10px '+clr+'99':'none';
    } else {
      bg=isActive?'var(--ao-grad)':'transparent';
      border='1.5px solid '+(isActive?'transparent':(isAns?'rgba(168,85,247,0.5)':'rgba(255,150,200,0.25)'));
      txtColor=isActive?'#fff':(isAns?'#C084FC':'rgba(255,107,149,0.5)');
      shadow=isActive?'0 2px 10px rgba(168,85,247,0.4)':'none';
    }
    var dot=document.createElement('button');
    dot.className='qz-dot';
    dot.style.cssText='background:'+bg+';border:'+border+';color:'+txtColor+';box-shadow:'+shadow+';transform:'+(isActive?'scale(1.15)':'scale(1)')+';';
    dot.textContent=i+1;
    dot.onclick=(function(idx){return function(){cur=idx;render();};})(i);
    d.appendChild(dot);
  });
  var active=d.children[cur];if(active)active.scrollIntoView({block:'nearest',inline:'center',behavior:'smooth'});
  // scrollend — re-center sau khi user scroll tay
  if(!d._scrollEndAttached){
    d._scrollEndAttached=true;
    var _snap=function(){var a=d.children[cur];if(a)a.scrollIntoView({block:'nearest',inline:'center',behavior:'smooth'});};
    if('onscrollend' in d){d.addEventListener('scrollend',_snap);}
  }
}

/* ── SCORE ── */
function calcScore(){
  var s=0,t=0;
  QS.forEach(function(q,qi){
    if(q.type==='multiple'){t+=1;if(answers[qi]===q.correct)s+=1;}
    else if(q.type==='multi_select'){t+=1;var a=answers[qi]||[];if(JSON.stringify(a.slice().sort())===JSON.stringify((q.correct||[]).slice().sort()))s+=1;}
    else if(q.type==='true_false'){t+=q.items.length*0.25;s+=q.items.filter(function(it,ii){return(answers[qi]||[])[ii]===it.answer;}).length*0.25;}
    else if(q.type==='fill_blank'){t+=1;if((answers[qi]||'').trim().toLowerCase()===q.answer.trim().toLowerCase())s+=1;}
  });
  return{s:s,t:t,pct:t>0?s/t:0};
}

function showScoreModal(){
  var sc=calcScore();var pct=sc.pct;var s=sc.s;var t=sc.t;
  var rc=pct>=0.8?'#10B981':pct>=0.5?'#F59E0B':'#EF4444';
  var icon='';
  if(pct>=0.8){icon='<div style="display:inline-block;animation:starSpin .7s ease .2s both"><svg width="72" height="72" viewBox="0 0 72 72">'+[0,60,120,180,240,300].map(function(d,i){return'<ellipse cx="36" cy="14" rx="5" ry="10" fill="'+['#F472B6','#A855F7','#6EE7B7','#FCD34D','#FB923C','#60A5FA'][i]+'" opacity=".85" transform="rotate('+d+' 36 36)"/>';}).join('')+'<circle cx="36" cy="36" r="16" fill="rgba(16,185,129,0.2)" stroke="#10B981" stroke-width="2.5"/><polyline points="26 36 33 43 46 28" fill="none" stroke="#10B981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></div>';}
  else if(pct>=0.5){icon='<div style="display:inline-block;animation:starSpin .7s ease .2s both"><svg width="72" height="72" viewBox="0 0 72 72"><circle cx="36" cy="36" r="30" fill="rgba(245,158,11,0.12)" stroke="#F59E0B" stroke-width="2.5"/><path d="M36 18L40.9 29.1L53 30.7L44 39.4L46.2 51.5L36 45.9L25.8 51.5L28 39.4L19 30.7L31.1 29.1Z" fill="#F59E0B" opacity=".9"/></svg></div>';}
  else{icon='<div style="display:inline-block;animation:scoreIn .5s ease both"><svg width="72" height="72" viewBox="0 0 72 72"><circle cx="36" cy="36" r="30" fill="rgba(239,68,68,0.12)" stroke="#EF4444" stroke-width="2.5"/><path d="M36 20 Q38 32 36 38 Q34 32 36 20Z" fill="#EF4444" opacity=".9"/><circle cx="36" cy="46" r="3" fill="#EF4444"/></svg></div>';}
  document.getElementById('modal-icon').innerHTML=icon;
  var el=document.getElementById('modal-score');el.style.color=rc;
  (function(){var dur=850,st=performance.now();function tick(t2){var p=Math.min((t2-st)/dur,1),v=p*s;el.textContent=v.toFixed(2)+' / '+t;if(p<1)requestAnimationFrame(tick);}setTimeout(function(){requestAnimationFrame(tick);},350);})();
  var bar=document.getElementById('modal-bar');
  bar.style.background=pct>=0.8?'linear-gradient(90deg,#10B981,#6EE7B7)':pct>=0.5?'linear-gradient(90deg,#F59E0B,#FCD34D)':'linear-gradient(90deg,#EF4444,#FCA5A5)';
  bar.style.width=(pct*100)+'%';
  document.getElementById('modal-pct').textContent=Math.round(pct*100)+'%';
  document.getElementById('modal-msg').style.color=rc;
  document.getElementById('modal-msg').textContent=pct>=0.8?'Xuất sắc! Giỏi lắm!':pct>=0.5?'Khá tốt, cố lên!':'Cần ôn lại nhé!';
  var listEl=document.getElementById('modal-list');listEl.innerHTML='';
  QS.forEach(function(q2,qi){
    var ok=false;
    if(q2.type==='multiple')ok=answers[qi]===q2.correct;
    else if(q2.type==='multi_select')ok=JSON.stringify((answers[qi]||[]).slice().sort())===JSON.stringify((q2.correct||[]).slice().sort());
    else if(q2.type==='true_false')ok=q2.items.every(function(it,ii){return(answers[qi]||[])[ii]===it.answer;});
    else ok=(answers[qi]||'').trim().toLowerCase()===q2.answer.trim().toLowerCase();
    var row=document.createElement('div');
    row.style.cssText='display:flex;align-items:center;gap:9px;padding:6px 10px;background:rgba(255,255,255,0.05);border-radius:10px;margin-bottom:3px;';
    row.innerHTML='<div style="width:8px;height:8px;border-radius:50%;background:'+(ok?'#10B981':'#EF4444')+';flex-shrink:0;"></div>'
      +'<span style="font-size:12px;color:rgba(255,255,255,0.6);font-weight:700;flex:1;">Câu '+(qi+1)+'</span>'
      +'<span style="font-size:11px;font-weight:800;color:'+(ok?'#10B981':'#FCA5A5')+'">'+(ok?'Đúng':'Sai')+'</span>';
    listEl.appendChild(row);
  });
  document.getElementById('score-modal').classList.add('show');
  if(pct>=0.8)spawnConfetti();
  // Web Share API
  var shareBtn=document.getElementById('btn-share');
  if(shareBtn){
    if(navigator.share){
      shareBtn.style.display='flex';shareBtn.style.alignItems='center';shareBtn.style.gap='5px';
      shareBtn.onclick=function(){
        var title=document.getElementById('quiz-title').textContent;
        navigator.share({
          title:'Learnsy — Kết quả',
          text:'Mình vừa làm bài "'+title+'" đạt '+Math.round(pct*100)+'% ('+s.toFixed(2)+'/'+t+' điểm)! Thử thách bạn nào?',
        }).catch(function(){});
      };
    } else {shareBtn.style.display='none';}
  }
}

/* ── CONFETTI ── */
function spawnConfetti(){
  var colors=['#F472B6','#A855F7','#6EE7B7','#FCD34D','#FB923C','#60A5FA'];
  for(var i=0;i<28;i++){
    var el=document.createElement('div');el.className='cf-piece';
    var size=5+Math.random()*7;
    el.style.cssText='left:'+Math.random()*100+'%;top:0;width:'+size+'px;height:'+size+'px;background:'+colors[i%6]+';border-radius:'+(size>9?'50%':'2px')+';transform:rotate('+Math.floor(Math.random()*360)+'deg);animation-delay:'+Math.random()*0.6+'s;animation-duration:'+(1.4+Math.random()*0.6)+'s;';
    document.body.appendChild(el);
    setTimeout(function(e){return function(){e.remove();};}(el),2500);
  }
}

/* ── TIMER ── */
var _timerSec=0,_timerInterval=null;
function startTimer(minutes){
  var el=document.getElementById('qz-timer');
  var txt=document.getElementById('timer-txt');
  var svg=document.getElementById('timer-svg');
  if(!el||!minutes)return;
  _timerSec=minutes*60;
  el.style.display='flex';
  el.className='';
  function tick(){
    if(submitted){clearInterval(_timerInterval);return;}
    var m=Math.floor(_timerSec/60);
    var s=_timerSec%60;
    txt.textContent=(m<10?'0':'')+m+':'+(s<10?'0':'')+s;
    // Trạng thái màu
    if(_timerSec<=30){
      el.className='danger';
      // SVG đổi màu đồng bộ (stroke được kế thừa từ color)
      svg.setAttribute('stroke','#EF4444');
    } else if(_timerSec<=60){
      el.className='warn';
      svg.setAttribute('stroke','#F59E0B');
    } else {
      el.className='';
      svg.setAttribute('stroke','currentColor');
    }
    if(_timerSec<=0){
      clearInterval(_timerInterval);
      txt.textContent='00:00';
      // Auto-submit
      if(!submitted)doSubmitFinal();
      return;
    }
    _timerSec--;
  }
  tick();
  _timerInterval=setInterval(tick,1000);
}
function stopTimer(){
  clearInterval(_timerInterval);
  var el=document.getElementById('qz-timer');
  if(el)el.style.display='none';
}

/* ── SUBMIT ── */
function getUnanswered(){
  var un=[];
  QS.forEach(function(q,qi){
    var ans=answers[qi];var empty=false;
    if(q.type==='multiple')empty=ans===null||ans===undefined;
    else if(q.type==='multi_select')empty=!ans||!ans.length;
    else if(q.type==='fill_blank')empty=!(ans||'').trim();
    else if(q.type==='true_false')empty=!ans||ans.some(function(v){return v===null;});
    if(empty)un.push(qi+1);
  });
  return un;
}

function doSubmitFinal(){
  submitted=true;
  clearInterval(_timerInterval);
  var sc=calcScore();
  var rc=sc.pct>=0.8?'#10B981':sc.pct>=0.5?'#F59E0B':'#EF4444';
  var pill=document.getElementById('score-pill');
  pill.style.display='block';pill.style.background=rc;
  pill.textContent=sc.s.toFixed(2)+'/'+sc.t;
  document.getElementById('btn-submit').style.display='none';
  document.getElementById('btn-retry').style.display='block';
  if(sc.pct>=0.7)playFanfare();else playSad();
  render();showScoreModal();
}

document.getElementById('btn-submit').onclick=function(){
  var un=getUnanswered();
  if(un.length){
    var wm=document.getElementById('warn-modal');
    document.getElementById('warn-msg').textContent=un.length===1?'Câu '+un[0]+' chưa được trả lời.':un.length+' câu chưa trả lời: câu '+un.join(', ')+'.';
    wm.classList.add('show');
    document.getElementById('warn-review').onclick=function(){wm.classList.remove('show');cur=un[0]-1;render();};
    document.getElementById('warn-force').onclick=function(){wm.classList.remove('show');doSubmitFinal();};
    return;
  }
  doSubmitFinal();
};

function resetQuiz(){
  answers=QS.map(function(q){if(q.type==='true_false')return q.items.map(function(){return null;});if(q.type==='multi_select')return[];return null;});
  submitted=false;cur=0;answeredQ={};
  document.getElementById('score-pill').style.display='none';
  document.getElementById('btn-submit').style.display='flex';
  document.getElementById('btn-retry').style.display='none';
  document.getElementById('score-modal').classList.remove('show');
  render();
}

document.getElementById('btn-retry').onclick=resetQuiz;
document.getElementById('modal-retry').onclick=resetQuiz;
document.getElementById('btn-detail').onclick=function(){document.getElementById('score-modal').classList.remove('show');};
document.getElementById('btn-prev').onclick=function(){if(cur>0){cur--;render();}};
document.getElementById('btn-next').onclick=function(){if(cur<total-1){cur++;render();}};

/* ── STREAK ── */
var _streak=0,_stTmr=null;
function bumpStreak(ok){if(ok){_streak++;if(_streak>=3)showStreak(_streak);}else _streak=0;}
function showStreak(n){
  var t=document.getElementById('strk-t');if(!t)return;
  var fireSvg='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c0 0-5 5-5 10a5 5 0 0 0 10 0c0-3-2-5-2-5s0 3-3 3-2-3-2-3 0 4-2 5c0 0 0-8 4-10z" fill="currentColor" opacity=".7"/></svg>';
  var label=n>=7?' Siêu hot!':n>=5?' Xuất sắc!':' Chuỗi đúng!';
  t.innerHTML=fireSvg+(n>=7?fireSvg:'')+'<strong>'+n+'</strong>'+label;
  t.style.display='block';t.style.animation='none';void t.offsetWidth;
  t.style.animation='strkIn .4s ease both';
  if(typeof playStreak==='function')playStreak(n);
  if(_stTmr)clearTimeout(_stTmr);
  _stTmr=setTimeout(function(){t.style.animation='strkOut .35s ease forwards';setTimeout(function(){t.style.display='none';},400);},2200);
}

/* ── WAKE LOCK — màn hình không tắt khi đang làm bài ── */
var _wakeLock=null;
async function _requestWake(){
  try{if('wakeLock' in navigator){_wakeLock=await navigator.wakeLock.request('screen');}}catch(e){}
}
function _releaseWake(){try{if(_wakeLock){_wakeLock.release();_wakeLock=null;}}catch(e){}}
document.addEventListener('visibilitychange',function(){
  if(document.visibilityState==='visible'&&document.getElementById('quiz-screen').style.display==='flex')_requestWake();
});

/* ── SWIPE (skip dots) ── */
(function(){
  var _sx=0,_sy=0,_skip=false;
  var qs=document.getElementById('quiz-screen');
  var dw=document.getElementById('dots');
  qs.addEventListener('touchstart',function(e){_skip=dw&&dw.contains(e.target);if(_skip)return;_sx=e.touches[0].clientX;_sy=e.touches[0].clientY;},{passive:true});
  qs.addEventListener('touchend',function(e){if(_skip){_skip=false;return;}var dx=e.changedTouches[0].clientX-_sx,dy=e.changedTouches[0].clientY-_sy;if(Math.abs(dx)<40||Math.abs(dy)>Math.abs(dx)*1.5)return;if(dx<0&&cur<total-1){cur++;render();}else if(dx>0&&cur>0){cur--;render();}});
})();

/* ── RIPPLE EFFECT (mượt, nhẹ, cho mọi nút bấm) ── */
document.addEventListener('pointerdown',function(e){
  var btn=e.target.closest && e.target.closest('button');
  if(!btn||btn.disabled)return;
  var cs=getComputedStyle(btn);
  if(cs.position==='static')btn.style.position='relative';
  btn.classList.add('rpl-wrap');
  var r=btn.getBoundingClientRect();
  var size=Math.max(r.width,r.height);
  var span=document.createElement('span');
  span.className='rpl';
  span.style.width=span.style.height=size+'px';
  span.style.left=(e.clientX-r.left-size/2)+'px';
  span.style.top=(e.clientY-r.top-size/2)+'px';
  btn.appendChild(span);
  setTimeout(function(){span.remove();},600);
},{passive:true});

/* ── INIT BG ── */
_loadBgPref();
applyBgTheme(_bgKey,_bgBlur);

showHome();
<\/script>
</body>
</html>`;
}

function buildExportHTML(lessons, shuffleQ, shuffleA, timerLimit) {
  return _buildTemplate(lessons, true, shuffleQ, shuffleA, timerLimit);
}

function buildExportLiteHTML(lessons, shuffleQ, shuffleA, timerLimit) {
  return _buildTemplate(lessons, false, shuffleQ, shuffleA, timerLimit);
}

// app.jsx gọi 2 hàm này như biến toàn cục (buildExportHTML(...), không phải
// window.buildExportHTML(...)) — bắt buộc phải gán ra window ở đây vì file này
// là ES module, hàm khai báo bên trong KHÔNG tự động lên window như script thường.
window.buildExportHTML = buildExportHTML;
window.buildExportLiteHTML = buildExportLiteHTML;

console.log('[export-builder] ✓ loaded');
