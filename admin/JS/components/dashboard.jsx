import React, {useState,useEffect,useRef,useMemo,useCallback} from 'react';

// ══════════════════════════════════════════════════════════════════════
//  Learnsy Admin Dashboard · Bánh Bèo Edition 🌸
//  Thêm vào admin/JS/components/dashboard.js
// ══════════════════════════════════════════════════════════════════════
(function(){

/* ══ INJECT CSS ══ */
(function injectCSS(){
  if(document.getElementById('bb-admin-css'))return;
  const s=document.createElement('style');
  s.id='bb-admin-css';
  s.textContent=`
    @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Baloo+2:wght@400;500;600;700;800&display=swap');
    @keyframes bb-fadeUp  { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
    @keyframes bb-spin    { to{transform:rotate(360deg)} }
    @keyframes bb-float   { 0%,100%{transform:translateY(0) rotate(-2deg)} 50%{transform:translateY(-7px) rotate(2deg)} }
    @keyframes bb-pop     { 0%{transform:scale(.7);opacity:0} 60%{transform:scale(1.1);opacity:1} 100%{transform:scale(1)} }
    @keyframes bb-shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
    @keyframes bb-heartbeat { 0%,100%{transform:scale(1)} 14%{transform:scale(1.2)} 42%{transform:scale(1.1)} }
    @keyframes bb-sparkle-rotate { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
    @keyframes bb-bounce  { 0%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
    @keyframes bb-pulse   { 0%,100%{box-shadow:0 0 0 0 rgba(244,114,182,.45)} 70%{box-shadow:0 0 0 10px rgba(244,114,182,0)} }
    @keyframes bb-confetti{ 0%{transform:translateY(-10px) rotate(0deg) scale(1);opacity:1} 100%{transform:translateY(70px) rotate(540deg) scale(.4);opacity:0} }
    @keyframes bb-glow-pulse{ 0%,100%{opacity:.45;transform:scale(1)} 50%{opacity:.9;transform:scale(1.2)} }
    @keyframes bb-slide-right{ from{transform:translateX(-10px);opacity:0} to{transform:translateX(0);opacity:1} }
    @keyframes bb-border-flow{ 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
    @keyframes bb-wave{ 0%,100%{transform:rotate(-10deg)} 50%{transform:rotate(10deg)} }
    @keyframes bb-typewriter{ from{width:0;opacity:0} to{width:100%;opacity:1} }
    @keyframes bb-rise{ from{opacity:0;transform:translateY(14px) scale(.95)} to{opacity:1;transform:translateY(0) scale(1)} }
    @keyframes bb-bar-grow{ from{width:0} to{width:var(--w)} }
    @keyframes di-pill-in {
      0%   { width:36px; height:36px; border-radius:50%; opacity:0; transform:translateX(-50%) scaleY(0.6); }
      20%  { width:36px; height:36px; border-radius:50%; opacity:1; transform:translateX(-50%) scaleY(1); }
      55%  { width:248px; height:50px; border-radius:25px; opacity:1; transform:translateX(-50%) scaleY(1); }
      100% { width:268px; height:54px; border-radius:27px; opacity:1; transform:translateX(-50%) scaleY(1); }
    }
    @keyframes di-pill-out {
      0%   { width:268px; height:54px; border-radius:27px; opacity:1; transform:translateX(-50%) scaleY(1); }
      40%  { width:248px; height:50px; border-radius:25px; opacity:1; transform:translateX(-50%) scaleY(1); }
      75%  { width:36px;  height:36px; border-radius:50%;  opacity:1; transform:translateX(-50%) scaleY(1); }
      100% { width:36px;  height:36px; border-radius:50%;  opacity:0; transform:translateX(-50%) scaleY(0.6); }
    }
    @keyframes di-content-in {
      0%,40% { opacity:0; transform:scale(.85) translateY(3px); }
      100%   { opacity:1; transform:scale(1) translateY(0); }
    }
    @keyframes di-icon-pulse {
      0%,100% { transform:scale(1); }
      50%     { transform:scale(1.18); }
    }
    @keyframes di-glow-pulse {
      0%,100% { opacity:.4; }
      50%     { opacity:.9; }
    }
    .bb-kpi-shine{ position:relative;overflow:hidden; }
    .bb-kpi-shine::after{ content:'';position:absolute;inset:0;border-radius:inherit;background:linear-gradient(105deg,transparent 38%,rgba(255,255,255,.22) 50%,transparent 62%);transform:translateX(-100%);transition:transform .55s ease; }
    .bb-kpi-shine:hover::after{ transform:translateX(100%); }
    .bb-quick-btn{ transition:all .18s cubic-bezier(.34,1.56,.64,1)!important; }
    .bb-quick-btn:hover{ transform:translateY(-3px) scale(1.04)!important; }
    .bb-quick-btn:active{ transform:scale(.95)!important; }
    .bb-a-card { transition:transform .18s cubic-bezier(.34,1.56,.64,1),box-shadow .18s; }
    .bb-a-card:hover { transform:translateY(-2px) scale(1.01); }
    .bb-a-card:active { transform:scale(.97); }
    .bb-a-btn { transition:transform .12s; cursor:pointer; border:none; }
    .bb-a-btn:active { transform:scale(.93); }
    .bb-a-tab { all:unset; cursor:pointer; }
    .bb-a-input { outline:none; font-family:Nunito,sans-serif; }
    .bb-a-input::placeholder { color:rgba(244,114,182,.4); }
    .bb-a-input:focus { border-color:#f472b6!important; box-shadow:0 0 0 3px rgba(244,114,182,.16)!important; }
    .bb-a-scroll::-webkit-scrollbar{display:none}
    .bb-a-scroll{-ms-overflow-style:none;scrollbar-width:none}
    .bb-a-toggle { all:unset; cursor:pointer; }
    .bb-a-sticker {
      display:inline-flex;align-items:center;gap:4px;border-radius:999px;
      font-weight:800;font-family:Nunito,sans-serif;
      transition:transform .18s cubic-bezier(.34,1.56,.64,1);
    }
    .bb-a-sticker:hover { transform:scale(1.08) rotate(2deg); }
  `;
  document.head.appendChild(s);
})();

/* ══ DYNAMIC ISLAND TOAST ══ */
function DiToastIcon({icon,color}){
  const c=color||'#f472b6';
  const s={width:15,height:15,display:'block'};
  /* map emoji/string → SVG */
  const k=String(icon||'').trim();
  if(k==='✅'||k==='✓'||k==='☑️')
    return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
  if(k==='❌'||k==='✗'||k==='🚫')
    return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.6" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
  if(k==='⚠️'||k==='⚠'||k==='🔔')
    return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="17" r="1" fill={c} stroke="none"/></svg>;
  if(k==='ℹ️'||k==='ℹ')
    return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/><circle cx="12" cy="17" r="1" fill={c} stroke="none"/></svg>;
  if(k==='💾'||k==='📥')
    return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;
  if(k==='📤'||k==='📦'||k==='⬆️')
    return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
  if(k==='📋'||k==='📄'||k==='📝')
    return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>;
  if(k==='📭'||k==='📬'||k==='📪')
    return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92V19a2 2 0 0 1-2.18 2A19.86 19.86 0 0 1 3 4.18 2 2 0 0 1 5 2h2.09a2 2 0 0 1 2 1.72c.13 1 .37 1.97.72 2.9a2 2 0 0 1-.45 2.11l-.9.9a16 16 0 0 0 6.92 6.92l.9-.9a2 2 0 0 1 2.11-.45c.93.35 1.9.59 2.9.72A2 2 0 0 1 22 16.92z"/></svg>;
  if(k==='🗑️'||k==='🗑'||k==='🚮')
    return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;
  if(k==='⭐'||k==='🌟'||k==='🏆')
    return <svg {...s} viewBox="0 0 24 24" fill="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill={c} opacity=".9"/></svg>;
  if(k==='🔄'||k==='↩️'||k==='↻')
    return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>;
  if(k==='⚙️'||k==='⚙'||k==='🔧')
    return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
  /* default: sparkle/star */
  return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
}

function DiToast({msg,onClose}){
  const [leaving,setLeaving]=useState(false);
  const {icon,label,color,sublabel}=msg;
  const glowColor=color||'#f472b6';

  useEffect(()=>{
    const t1=setTimeout(()=>setLeaving(true),2800);
    const t2=setTimeout(onClose,3300);
    return()=>{clearTimeout(t1);clearTimeout(t2);};
  },[onClose]);

  return(
    <div onClick={()=>{setLeaving(true);setTimeout(onClose,450);}}
      style={{
        position:'fixed',top:12,left:'50%',zIndex:99999,
        width:290,height:56,borderRadius:28,
        transform:'translateX(-50%)',transformOrigin:'center top',
        background:'linear-gradient(135deg,rgba(14,6,14,.97) 0%,rgba(26,10,20,.97) 100%)',
        boxShadow:`0 0 0 1.5px rgba(255,255,255,.09), 0 10px 32px rgba(0,0,0,.6), 0 0 22px ${glowColor}44`,
        display:'flex',alignItems:'center',
        gap:11,padding:'0 16px',cursor:'pointer',userSelect:'none',overflow:'hidden',
        animation:leaving
          ?'di-pill-out .45s cubic-bezier(.55,0,.45,1) both'
          :'di-pill-in  .55s cubic-bezier(.34,1.3,.64,1) both',
        willChange:'width,height,border-radius,opacity',
      }}>
      {/* glow halo */}
      <div style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',
        width:30,height:30,borderRadius:'50%',background:glowColor,
        opacity:.15,filter:'blur(9px)',pointerEvents:'none'}}/>
      {/* icon box — SVG giống quiz */}
      <div style={{
        flexShrink:0,position:'relative',zIndex:1,
        display:'flex',alignItems:'center',justifyContent:'center',
        width:30,height:30,borderRadius:10,
        background:`${glowColor}22`,
        border:`1.5px solid ${glowColor}55`,
      }}>
        <DiToastIcon icon={icon} color={glowColor}/>
      </div>
      {/* text */}
      <div style={{flex:1,minWidth:0,
        animation:'di-content-in .55s cubic-bezier(.34,1.3,.64,1) both',
        position:'relative',zIndex:1}}>
        <div style={{fontSize:9,fontWeight:800,color:glowColor,letterSpacing:'.6px',
          textTransform:'uppercase',fontFamily:'Nunito,sans-serif',marginBottom:1}}>
          {sublabel||'Learnsy Admin'}
        </div>
        <div style={{fontSize:14,fontWeight:900,color:'#f0e6ff',fontFamily:'Nunito,sans-serif',
          overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',lineHeight:1.2}}>{label}</div>
      </div>
      {/* dot */}
      <div style={{flexShrink:0,width:5,height:5,borderRadius:'50%',
        background:'rgba(255,255,255,.22)',position:'relative',zIndex:1}}/>
    </div>
  );
}

function useDiToast(){
  const [queue,setQueue]=useState([]);
  const show=useCallback((label,icon='✨',color='#f472b6')=>{
    const id=Date.now();
    setQueue(q=>[...q,{id,label,icon,color}]);
  },[]);
  const dismiss=useCallback((id)=>setQueue(q=>q.filter(t=>t.id!==id)),[]);
  const node=queue.length>0?(
    <DiToast key={queue[0].id} msg={queue[0]} onClose={()=>dismiss(queue[0].id)}/>
  ):null;
  return{show,node};
}
window.bbDiToast=DiToast;
window.bbUseDiToast=useDiToast;

/* ══ FLOATING DECO EMOJIS (background only) ══ */
function FloatingDecos({dark}){
  const decos=[
    {e:'🌸',t:'6%', l:'3%', sz:18,del:0,   dur:5},
    {e:'✨',t:'14%',r:'6%', sz:14,del:1.2, dur:4.5},
    {e:'🌷',t:'42%',l:'2%', sz:16,del:.7,  dur:6},
    {e:'💕',t:'30%',r:'3%', sz:13,del:2,   dur:5.5},
    {e:'⭐',t:'68%',l:'4%', sz:12,del:1.5, dur:4},
    {e:'🍓',t:'78%',r:'4%', sz:14,del:.3,  dur:5.8},
    {e:'🌈',t:'88%',l:'3%', sz:13,del:1,   dur:5.2},
  ];
  return(
    <>
      {decos.map((d,i)=>(
        <div key={i} style={{
          position:'fixed',top:d.t,left:d.l,right:d.r,
          fontSize:d.sz,pointerEvents:'none',zIndex:0,userSelect:'none',
          opacity:dark?.12:.22,
          animation:`bb-float ${d.dur}s ease-in-out ${d.del}s infinite`,
        }}>{d.e}</div>
      ))}
    </>
  );
}

/* ══ HELPERS ══ */
const rgba=(hex,a)=>{
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return`rgba(${r},${g},${b},${a})`;
};
const fmtDate=ts=>ts?new Date(ts).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'}):'—';
const scoreColor=p=>p>=85?'#10B981':p>=70?'#EAB308':p>=50?'#F97316':'#EF4444';

/* ══ BUILD STATS ══ */
function buildStats(lessons){
  const total=lessons.length;
  const totalQ=lessons.reduce((s,l)=>s+(l.questions?.length||0),0);
  const subjects={};
  lessons.forEach(l=>{const s=l.subject||'Khác';subjects[s]=(subjects[s]||0)+1;});
  const monthly=[];
  const now=new Date();
  for(let i=5;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const label=`T${d.getMonth()+1}`;
    const count=lessons.filter(l=>{
      if(!l.created_at)return false;
      const ld=new Date(l.created_at);
      return ld.getFullYear()===d.getFullYear()&&ld.getMonth()===d.getMonth();
    }).length;
    monthly.push({label,count});
  }
  const types={true_false:0,multiple:0,multi_select:0,fill_blank:0};
  lessons.forEach(l=>(l.questions||[]).forEach(q=>{if(types[q.type]!==undefined)types[q.type]++;}));
  return{total,totalQ,subjects,monthly,types};
}

/* ══ SVG BAR CHART ══ */
let _chartSeq=0;
function BarChart({data,color,dark,C}){
  const [uid]=useState(()=>'bc'+(++_chartSeq));
  const W=320,H=140,P={t:14,r:8,b:28,l:32};
  const max=Math.max(...data.map(d=>d.count),1);
  const bGap=(W-P.l-P.r)/data.length;
  const bW=bGap*0.55;
  const scaleY=v=>P.t+(H-P.t-P.b)*(1-v/max);
  // per-bar colour: use d.color if supplied (bins), else the chart colour
  return(
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'auto',display:'block'}}>
      <defs>{data.map((d,i)=>{
        const c=d.color||color;
        return(
          <linearGradient key={i} id={`${uid}g${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c} stopOpacity=".95"/>
            <stop offset="100%" stopColor={c} stopOpacity=".4"/>
          </linearGradient>
        );
      })}</defs>
      {[0,.25,.5,.75,1].map((f,i)=>{
        const y=P.t+(H-P.t-P.b)*(1-f);
        return<line key={i} x1={P.l} y1={y} x2={W-P.r} y2={y} stroke={dark?'rgba(255,255,255,.06)':'rgba(0,0,0,.05)'} strokeWidth="1"/>;
      })}
      {[0,.5,1].map((f,i)=>(
        <text key={i} x={P.l-5} y={P.t+(H-P.t-P.b)*(1-f)+4} textAnchor="end" fontSize="9" fill={C.text3} fontFamily="Nunito,sans-serif" fontWeight="700">{Math.round(max*f)}</text>
      ))}
      {data.map((d,i)=>{
        const c=d.color||color;
        const x=P.l+i*bGap+(bGap-bW)/2;
        const isEmpty=d.count===0;
        const y=isEmpty?H-P.b-3:scaleY(d.count);
        const h=isEmpty?3:Math.max(H-P.b-y,3);
        return(
          <g key={i}>
            <rect x={x} y={y} width={bW} height={h} rx="4"
              fill={isEmpty?'none':`url(#${uid}g${i})`}
              stroke={isEmpty?(dark?'rgba(255,255,255,.1)':rgba(c,.2)):undefined}
              strokeWidth={isEmpty?1:0}
              opacity={isEmpty?.4:1}
              style={isEmpty?undefined:{filter:`drop-shadow(0 2px 4px ${c}44)`}}/>
            {!isEmpty&&<text x={x+bW/2} y={y-4} textAnchor="middle" fontSize="9" fill={c} fontFamily="Nunito,sans-serif" fontWeight="900">{d.count}</text>}
            <text x={x+bW/2} y={H-P.b+12} textAnchor="middle" fontSize="9" fill={isEmpty?C.text4||C.text3:C.text3} fontFamily="Nunito,sans-serif" fontWeight={isEmpty?'600':'700'}>{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ══ SVG AREA CHART ══ */
function AreaChart({data,color,dark,C}){
  const [uid]=useState(()=>'ac'+(++_chartSeq));
  const W=320,H=110,P={t:14,r:10,b:26,l:32};
  const max=Math.max(...data.map(d=>d.count),1);
  const scaleX=i=>P.l+i*(W-P.l-P.r)/(Math.max(data.length-1,1));
  const scaleY=v=>P.t+(H-P.t-P.b)*(1-v/max);
  const pts=data.map((d,i)=>({x:scaleX(i),y:scaleY(d.count),v:d.count}));

  // smooth bezier path
  const bezier=pts.map((p,i)=>{
    if(i===0) return `M${p.x},${p.y}`;
    const prev=pts[i-1];
    const cpx=(prev.x+p.x)/2;
    return `C${cpx},${prev.y} ${cpx},${p.y} ${p.x},${p.y}`;
  }).join(' ');
  const area=`${bezier} L${pts[pts.length-1].x},${H-P.b} L${pts[0].x},${H-P.b} Z`;

  return(
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'auto',display:'block'}}>
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".35"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      {/* grid lines */}
      {[0,.5,1].map((f,i)=>{
        const y=scaleY(max*f);
        return<line key={i} x1={P.l} y1={y} x2={W-P.r} y2={y} stroke={dark?'rgba(255,255,255,.06)':'rgba(0,0,0,.05)'} strokeWidth="1"/>;
      })}
      {/* y-axis labels */}
      {[0,Math.ceil(max/2),max].map((v,i)=>(
        <text key={i} x={P.l-5} y={scaleY(v)+4} textAnchor="end" fontSize="8" fill={C.text3} fontFamily="Nunito,sans-serif" fontWeight="700">{v}</text>
      ))}
      {/* area fill */}
      <path d={area} fill={`url(#${uid})`}/>
      {/* line */}
      <path d={bezier} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{filter:`drop-shadow(0 0 5px ${color}77)`}}/>
      {/* dots + labels */}
      {pts.map((p,i)=>(
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="5" fill={color} style={{filter:`drop-shadow(0 0 4px ${color}99)`}}/>
          <circle cx={p.x} cy={p.y} r="3" fill={dark?'#261018':'#fff'}/>
          {p.v>0&&<text x={p.x} y={p.y-9} textAnchor="middle" fontSize="8" fill={color} fontFamily="Nunito,sans-serif" fontWeight="900">{p.v}</text>}
          <text x={p.x} y={H-P.b+11} textAnchor="middle" fontSize="8" fill={C.text3} fontFamily="Nunito,sans-serif" fontWeight="700">{data[i].label}</text>
        </g>
      ))}
    </svg>
  );
}

/* ══ ACTIVITY CHART — lượt làm bài 7 ngày gần nhất ══ */
function ActivityChart({results,color,dark,C}){
  const [uid]=useState(()=>'act'+(++_chartSeq));
  // Build last-7-days buckets
  const days=useMemo(()=>{
    // Gom theo NGÀY GIỜ ĐỊA PHƯƠNG (không dùng toISOString — đó là UTC nên
    // bài làm lúc 0h–7h sáng giờ VN bị tính nhầm sang ngày hôm trước).
    const pad=n=>String(n).padStart(2,'0');
    const dayKey=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
    const now=new Date();
    const buckets={};
    results.forEach(r=>{
      const t=r.submitted_at||r.created_at;
      if(!t)return;
      const k=dayKey(new Date(t));
      (buckets[k]=buckets[k]||[]).push(r);
    });
    return Array.from({length:7},(_,i)=>{
      const d=new Date(now);
      d.setDate(now.getDate()-(6-i));
      const key=dayKey(d);
      const dow=['CN','T2','T3','T4','T5','T6','T7'][d.getDay()];
      const isToday=i===6;
      const list=buckets[key]||[];
      const count=list.length;
      const avgPct=count>0
        ? Math.round(list.reduce((s,r)=>s+(r.total>0?Math.min(1,r.score/r.total)*100:0),0)/count)
        : null;
      return{label:isToday?'Hôm nay':dow,count,avgPct,key};
    });
  },[results]);

  const maxCount=Math.max(...days.map(d=>d.count),1);
  const W=320,H=120,P={t:16,r:10,b:32,l:30};
  const bGap=(W-P.l-P.r)/7;
  const bW=bGap*0.52;
  const scaleY=v=>P.t+(H-P.t-P.b)*(1-v/maxCount);

  // area line for avg score (secondary axis, 0-100)
  const scorePts=days.map((d,i)=>{
    const x=P.l+i*bGap+bGap/2;
    const y=d.avgPct!=null ? P.t+(H-P.t-P.b)*(1-d.avgPct/100) : null;
    return{x,y,d};
  });
  const lineSegs=scorePts.reduce((acc,pt,i)=>{
    if(pt.y==null)return acc;
    const cmd=acc===''||scorePts[i-1]?.y==null?`M${pt.x},${pt.y}`:`L${pt.x},${pt.y}`;
    return acc+cmd;
  },'');

  return(
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'auto',display:'block',overflow:'visible'}}>
        <defs>
          <linearGradient id={uid+'b'} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity=".9"/>
            <stop offset="100%" stopColor={color} stopOpacity=".35"/>
          </linearGradient>
          <linearGradient id={uid+'l'} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FCD34D" stopOpacity=".5"/>
            <stop offset="100%" stopColor="#FCD34D" stopOpacity="0"/>
          </linearGradient>
        </defs>
        {/* grid */}
        {[0,.5,1].map((f,i)=>{
          const y=P.t+(H-P.t-P.b)*(1-f);
          return<line key={i} x1={P.l} y1={y} x2={W-P.r} y2={y} stroke={dark?'rgba(255,255,255,.06)':'rgba(0,0,0,.05)'} strokeWidth="1"/>;
        })}
        {/* Y-axis labels (lượt) */}
        {[0,Math.ceil(maxCount/2),maxCount].map((v,i)=>(
          <text key={i} x={P.l-5} y={scaleY(v)+4} textAnchor="end" fontSize="8" fill={C.text3} fontFamily="Nunito,sans-serif" fontWeight="700">{v}</text>
        ))}
        {/* bars */}
        {days.map((d,i)=>{
          const x=P.l+i*bGap+(bGap-bW)/2;
          const y=scaleY(d.count);
          const h=Math.max(H-P.b-y,d.count>0?3:1);
          const isToday=i===6;
          return(
            <g key={i}>
              <rect x={x} y={d.count>0?y:H-P.b-1} width={bW} height={h} rx="4"
                fill={isToday?`url(#${uid}b)`:rgba(color,.55)}
                style={{filter:isToday?`drop-shadow(0 2px 6px ${color}55)`:undefined}}/>
              {d.count>0&&(
                <text x={x+bW/2} y={y-3} textAnchor="middle" fontSize="8" fill={isToday?color:rgba(color,.8)} fontFamily="Nunito,sans-serif" fontWeight="900">{d.count}</text>
              )}
              <text x={x+bW/2} y={H-P.b+11} textAnchor="middle" fontSize="8"
                fill={isToday?color:C.text3} fontFamily="Nunito,sans-serif" fontWeight={isToday?'900':'700'}>{d.label}</text>
            </g>
          );
        })}
        {/* avg score line */}
        {lineSegs&&<>
          <path d={lineSegs} fill="none" stroke="#FCD34D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 2" opacity=".8"/>
          {scorePts.filter(p=>p.y!=null).map((pt,i)=>(
            <g key={i}>
              <circle cx={pt.x} cy={pt.y} r="3.5" fill="#FCD34D" opacity=".9"/>
              <text x={pt.x} y={pt.y-6} textAnchor="middle" fontSize="7" fill="#FCD34D" fontFamily="Nunito,sans-serif" fontWeight="900">{pt.d.avgPct}%</text>
            </g>
          ))}
        </>}
      </svg>
      {/* Legend */}
      <div style={{display:'flex',gap:14,marginTop:8,justifyContent:'center'}}>
        <div style={{display:'flex',alignItems:'center',gap:5,fontSize:10,fontWeight:700,color:C.text3}}>
          <div style={{width:10,height:10,borderRadius:3,background:color}}/>
          Lượt làm
        </div>
        <div style={{display:'flex',alignItems:'center',gap:5,fontSize:10,fontWeight:700,color:C.text3}}>
          <svg width="18" height="6" viewBox="0 0 18 6"><line x1="0" y1="3" x2="18" y2="3" stroke="#FCD34D" strokeWidth="2" strokeDasharray="4 2"/></svg>
          Điểm TB (%)
        </div>
      </div>
    </div>
  );
}

/* ══ SVG DONUT CHART ══ */
function DonutChart({slices,dark,C}){
  const R=52,r=30,CX=70,CY=70;
  const total=slices.reduce((s,x)=>s+x.value,0);
  let angle=-Math.PI/2;
  const paths=total>0?slices.filter(sl=>sl.value>0).map(sl=>{
    const a=2*Math.PI*sl.value/total;
    const x1=CX+R*Math.cos(angle),y1=CY+R*Math.sin(angle);
    angle+=a;
    const x2=CX+R*Math.cos(angle),y2=CY+R*Math.sin(angle);
    const large=a>Math.PI?1:0;
    const xi1=CX+r*Math.cos(angle-a),yi1=CY+r*Math.sin(angle-a);
    const xi2=CX+r*Math.cos(angle),yi2=CY+r*Math.sin(angle);
    return{d:`M${x1},${y1}A${R},${R},0,${large},1,${x2},${y2}L${xi2},${yi2}A${r},${r},0,${large},0,${xi1},${yi1}Z`,color:sl.color,label:sl.label,value:sl.value};
  }):[];
  return(
    <div style={{display:'flex',alignItems:'center',gap:14}}>
      <svg viewBox="0 0 140 140" style={{width:120,height:120,flexShrink:0}}>
        <circle cx={CX} cy={CY} r={R+5} fill={dark?'rgba(244,114,182,.06)':'rgba(244,114,182,.05)'}/>
        {total===0
          ?<circle cx={CX} cy={CY} r={R} fill="none" stroke={dark?'rgba(255,255,255,.08)':'rgba(0,0,0,.07)'} strokeWidth="14"/>
          :paths.map((p,i)=><path key={i} d={p.d} fill={p.color} opacity=".92" style={{filter:`drop-shadow(0 2px 6px ${p.color}44)`}}/>)
        }
        <circle cx={CX} cy={CY} r={r-2} fill={dark?'#261018':'#fff'}/>
        <text x={CX} y={CY-6} textAnchor="middle" fontSize="14" fontWeight="900" fill={C.text} fontFamily="'Baloo 2',cursive">{total}</text>
        <text x={CX} y={CY+9} textAnchor="middle" fontSize="8" fontWeight="700" fill={C.text3} fontFamily="Nunito,sans-serif">câu hỏi</text>
      </svg>
      <div style={{flex:1,display:'flex',flexDirection:'column',gap:7}}>
        {slices.map((p,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:7}}>
            <div style={{width:10,height:10,borderRadius:3,background:p.color,flexShrink:0,boxShadow:`0 2px 6px ${p.color}55`}}/>
            <div style={{flex:1,fontSize:11,fontWeight:700,color:C.text2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.label}</div>
            <div style={{fontSize:11,fontWeight:900,color:p.color}}>{p.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══ RADIAL PROGRESS ══ */
function RadialProgress({value,max,color,label,dark,C}){
  const pct=max>0?Math.min(value/max,1):0;
  const R=36,CX=44,CY=44,circ=2*Math.PI*R;
  const dash=circ*pct;
  return(
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5}}>
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx={CX} cy={CY} r={R+3} fill={dark?rgba(color,.07):rgba(color,.05)}/>
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={dark?'rgba(255,255,255,.08)':'rgba(0,0,0,.06)'} strokeWidth="7"/>
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${CX} ${CY})`}
          style={{transition:'stroke-dasharray .8s ease',filter:`drop-shadow(0 0 4px ${color}66)`}}/>
        <text x={CX} y={CY-5} textAnchor="middle" fontSize="15" fontWeight="900" fill={C.text} fontFamily="'Baloo 2',cursive">{value}</text>
        <text x={CX} y={CY+10} textAnchor="middle" fontSize="9" fontWeight="700" fill={C.text3} fontFamily="Nunito,sans-serif">/{max}</text>
      </svg>
      <div style={{fontSize:10,fontWeight:800,color:C.text3,textAlign:'center',lineHeight:1.3}}>{label}</div>
    </div>
  );
}

/* ══ KPI CARD — kawaii ══ */
function KpiCard({icon,label,value,sub,color,dark,C,delay=0}){
  const bg=dark?rgba(color,.12):rgba(color,.08);
  const border=dark?rgba(color,.25):rgba(color,.2);
  return(
    <div className="bb-a-card bb-kpi-shine" style={{
      background:dark?`linear-gradient(135deg,${rgba(color,.14)},${rgba(color,.07)})`:
                      `linear-gradient(135deg,${rgba(color,.1)},${rgba(color,.05)})`,
      backdropFilter:C.surfaceBlur,WebkitBackdropFilter:C.surfaceBlur,
      border:`1.5px solid ${border}`,borderRadius:24,padding:'14px 15px',
      display:'flex',flexDirection:'column',gap:8,
      boxShadow:dark?`0 4px 20px ${rgba(color,.2)}`:`0 4px 20px ${rgba(color,.12)},0 0 0 1px ${rgba(color,.08)}`,
      animation:`bb-fadeUp .3s ease ${delay}s both`,
      position:'relative',overflow:'hidden',
    }}>
      {/* glow blob */}
      <div style={{position:'absolute',top:-16,right:-16,width:60,height:60,borderRadius:'50%',background:rgba(color,.12),pointerEvents:'none'}}/>
      <div style={{display:'flex',alignItems:'center',gap:9,position:'relative'}}>
        <div style={{width:38,height:38,borderRadius:13,background:bg,border:`1.5px solid ${border}`,
          display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,
          boxShadow:`0 2px 10px ${rgba(color,.3)}`}}>
          {icon}
        </div>
        <div style={{fontSize:11,fontWeight:800,color:C.text3,lineHeight:1.3}}>{label}</div>
      </div>
      <div style={{fontSize:28,fontWeight:900,color,lineHeight:1,fontFamily:"'Baloo 2',cursive"}}>{value}</div>
      {sub&&<div style={{fontSize:10,fontWeight:700,color:C.text3,lineHeight:1.5}}>{sub}</div>}
    </div>
  );
}

/* ══ KAWAII PROGRESS BAR ══ */
function ProgressBar({pct,color,dark}){
  return(
    <div style={{height:9,borderRadius:99,background:dark?'rgba(255,255,255,.08)':'rgba(0,0,0,.05)',overflow:'hidden'}}>
      <div style={{height:'100%',width:`${pct}%`,borderRadius:99,
        background:`linear-gradient(90deg,${color}bb,${color})`,
        transition:'width .8s cubic-bezier(.34,1.56,.64,1)',
        boxShadow:`0 2px 8px ${color}55`,
        position:'relative',overflow:'hidden',
      }}>
        <div style={{position:'absolute',inset:0,background:'linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent)',backgroundSize:'200% 100%',animation:'bb-shimmer 2s linear infinite'}}/>
      </div>
    </div>
  );
}

/* ══ SECTION HEADER ══ */
function SectionHeader({icon,title,color='#f472b6',C}){
  return(
    <div style={{fontSize:12,fontWeight:900,color:C.text2,marginBottom:13,display:'flex',alignItems:'center',gap:7}}>
      <div style={{width:26,height:26,borderRadius:9,background:rgba(color,.15),display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
        {icon}
      </div>
      <span style={{textTransform:'uppercase',letterSpacing:.7}}>{title}</span>
    </div>
  );
}

/* ══ SETTINGS PANEL ══ */
function SettingsPanel({dark,C,onDarkToggle,lessons=[]}){
  const [name,setName]=useState(()=>localStorage.getItem('learnsy_admin_name')||'Admin');
  const [school,setSchool]=useState(()=>localStorage.getItem('learnsy_school')||'');
  const [saved,setSaved]=useState(false);
  const [cardBlur,setCardBlur]=useState(()=>localStorage.getItem('learnsy_card_blur')||'off');
  const setCardBlurPersist=(v)=>{setCardBlur(v);localStorage.setItem('learnsy_card_blur',v);window._cardBlur=v;window.dispatchEvent(new CustomEvent('learnsy:card-blur',{detail:{value:v}}));};
  const save=()=>{
    localStorage.setItem('learnsy_admin_name',name);
    localStorage.setItem('learnsy_school',school);
    setSaved(true);
    setTimeout(()=>setSaved(false),2000);
  };
  const inputStyle={
    width:'100%',padding:'11px 14px',borderRadius:18,
    border:`1.5px solid ${dark?'rgba(244,114,182,.22)':'rgba(244,114,182,.28)'}`,
    background:dark?'rgba(255,255,255,.07)':'rgba(255,255,255,.9)',
    color:C.text,fontSize:13,fontWeight:700,boxSizing:'border-box',
    fontFamily:'Nunito,sans-serif',transition:'border .2s,box-shadow .2s',
  };
  const card={background:dark?'rgba(255,255,255,.06)':'rgba(255,255,255,.82)',
    border:`1.5px solid ${C.border}`,borderRadius:24,padding:'16px 15px',
    boxShadow:dark?'none':'0 4px 16px rgba(244,114,182,.08)'};

  return(
    <div style={{display:'flex',flexDirection:'column',gap:12,animation:'bb-fadeUp .28s ease both'}}>
      {/* Profile */}
      <div style={card}>
        <SectionHeader color={C.rose} C={C} title="Thông tin Admin"
          icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.rose} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}/>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div>
            <label style={{fontSize:11,fontWeight:800,color:C.text3,display:'block',marginBottom:5}}>Tên hiển thị</label>
            <input value={name} onChange={e=>setName(e.target.value)} style={inputStyle} className="bb-a-input" placeholder="Tên admin..."/>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:800,color:C.text3,display:'block',marginBottom:5}}>Tên trường / lớp</label>
            <input value={school} onChange={e=>setSchool(e.target.value)} style={inputStyle} className="bb-a-input" placeholder="VD: THPT An Nhơn Tây - Lớp 11A7"/>
          </div>
          <button onClick={save} className="bb-a-btn"
            style={{padding:'11px',borderRadius:18,
              background:saved?C.mint:'linear-gradient(135deg,#F472B6,#A855F7)',
              color:'#fff',fontSize:13,fontWeight:900,
              boxShadow:saved?'none':'0 4px 16px rgba(168,85,247,.3)',transition:'background .3s'}}>
            {saved?'Đã lưu!':'Lưu thông tin'}
          </button>
        </div>
      </div>

      {/* Appearance */}
      <div style={card}>
        <SectionHeader color={C.lav} C={C} title="Giao diện"
          icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.lav} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>}/>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 13px',borderRadius:18,
          background:dark?'rgba(255,255,255,.04)':'rgba(244,114,182,.06)',border:`1px solid ${C.border}`}}>
          <div>
            <div style={{fontSize:13,fontWeight:800,color:C.text,fontFamily:"'Baloo 2',cursive"}}>{dark?'Chế độ tối':'Chế độ sáng'}</div>
            <div style={{fontSize:11,color:C.text3,marginTop:2}}>Thay đổi giao diện</div>
          </div>
          <button className="bb-a-toggle" onClick={onDarkToggle}
            style={{width:50,height:28,borderRadius:99,position:'relative',
              background:dark?'linear-gradient(135deg,#f472b6,#a855f7)':'rgba(200,160,184,.25)',
              transition:'background .3s',boxShadow:dark?'0 2px 12px rgba(244,114,182,.5)':'none'}}>
            <div style={{position:'absolute',top:4,left:dark?26:4,width:20,height:20,borderRadius:'50%',
              background:'#fff',transition:'left .25s cubic-bezier(.34,1.56,.64,1)',boxShadow:'0 2px 6px rgba(0,0,0,.2)'}}/>
          </button>
        </div>

        {/* Blur card */}
        <div style={{marginTop:10,padding:'11px 13px',borderRadius:18,
          background:dark?'rgba(255,255,255,.04)':'rgba(168,85,247,.05)',border:`1px solid ${C.border}`}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <div>
              <div style={{fontSize:13,fontWeight:800,color:C.text,fontFamily:"'Baloo 2',cursive",display:'flex',alignItems:'center',gap:6}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.lav} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="5"/><circle cx="16" cy="16" r="5" opacity=".45"/></svg>
                Blur card
              </div>
              <div style={{fontSize:11,color:C.text3,marginTop:2}}>Xuyên thấu nền qua card bài học</div>
            </div>
            <span style={{fontSize:11,fontWeight:900,padding:'3px 10px',borderRadius:999,
              background:cardBlur==='off'?( dark?'rgba(255,255,255,.07)':'rgba(0,0,0,.06)' ):C.lavL,
              color:cardBlur==='off'?C.text3:C.lav,
              border:`1px solid ${cardBlur==='off'?C.border:C.border2}`}}>
              {cardBlur==='off'?'Tắt':cardBlur+'%'}
            </span>
          </div>
          <div style={{display:'flex',gap:7}}>
            {[
              ['off','Tắt','Không blur',C.text3,dark?'rgba(255,255,255,.07)':'rgba(0,0,0,.05)',C.border],
              ['50','50%','Nhẹ · xuyên card','#0EA5E9','#E0F2FE','#BAE6FD'],
              ['85','85%','Mạnh · trong suốt',C.lav,C.lavL,C.border2],
            ].map(([v,lbl,desc,c,bg,bd])=>(
              <button key={v} onClick={()=>setCardBlurPersist(v)} className="bb-a-btn"
                style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3,
                  padding:'8px 6px',borderRadius:13,
                  border:`1.5px solid ${cardBlur===v?c:C.border}`,
                  background:cardBlur===v?bg:(dark?'rgba(255,255,255,.04)':'rgba(255,255,255,.7)'),
                  color:cardBlur===v?c:C.text3,
                  boxShadow:cardBlur===v?`0 2px 10px ${c}33`:'none',
                  transition:'all .18s'}}>
                <span style={{fontSize:13,fontWeight:900}}>{lbl}</span>
                <span style={{fontSize:9,fontWeight:700,opacity:.8,textAlign:'center',lineHeight:1.3}}>{desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Export */}
      <div style={card}>
        <SectionHeader color={C.peach} C={C} title="Xuất dữ liệu"
          icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.peach} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>}/>
        <div style={{display:'flex',flexDirection:'column',gap:9}}>

          {/* Export JSON */}
          <div style={{padding:'11px 13px',borderRadius:18,
            background:dark?'rgba(255,255,255,.04)':'rgba(249,115,22,.05)',
            border:`1px solid ${dark?'rgba(249,115,22,.2)':'rgba(249,115,22,.18)'}`}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
              <div style={{width:32,height:32,borderRadius:10,
                background:dark?'rgba(249,115,22,.18)':'rgba(249,115,22,.1)',
                border:`1.5px solid rgba(249,115,22,.25)`,
                display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.peach} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/></svg>
              </div>
              <div>
                <div style={{fontSize:13,fontWeight:800,color:C.text,fontFamily:"'Baloo 2',cursive"}}>Backup JSON</div>
                <div style={{fontSize:11,color:C.text3}}>{lessons.length} bộ câu hỏi · {lessons.reduce((a,l)=>a+(l.questions?.length||0),0)} câu</div>
              </div>
            </div>
            <button className="bb-a-btn" onClick={()=>{
              const out=lessons.map(l=>({id:l.id,title:l.title,subject:l.subject,created_at:l.created_at,questions:l.questions}));
              const blob=new Blob([JSON.stringify(out,null,2)],{type:'application/json'});
              const a=document.createElement('a');
              a.href=URL.createObjectURL(blob);
              a.download=`learnsy-backup-${new Date().toISOString().slice(0,10)}.json`;
              a.click();URL.revokeObjectURL(a.href);
            }} style={{width:'100%',padding:'9px',borderRadius:11,border:'none',
              background:`linear-gradient(135deg,${C.peach},#f59e0b)`,
              color:'#fff',fontSize:12,fontWeight:900,cursor:'pointer',
              display:'flex',alignItems:'center',justifyContent:'center',gap:6,
              boxShadow:'0 3px 12px rgba(249,115,22,.3)',transition:'opacity .15s'}}
              onMouseEnter={e=>e.currentTarget.style.opacity='.88'}
              onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Tải về JSON
            </button>
          </div>

          {/* Export CSV */}
          <div style={{padding:'11px 13px',borderRadius:18,
            background:dark?'rgba(255,255,255,.04)':'rgba(16,185,129,.05)',
            border:`1px solid ${dark?'rgba(16,185,129,.2)':'rgba(16,185,129,.18)'}`}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
              <div style={{width:32,height:32,borderRadius:10,
                background:dark?'rgba(16,185,129,.18)':'rgba(16,185,129,.1)',
                border:'1.5px solid rgba(16,185,129,.25)',
                display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.mint} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
              </div>
              <div>
                <div style={{fontSize:13,fontWeight:800,color:C.text,fontFamily:"'Baloo 2',cursive"}}>Danh sách CSV</div>
                <div style={{fontSize:11,color:C.text3}}>Mở bằng Excel / Google Sheets</div>
              </div>
            </div>
            <button className="bb-a-btn" onClick={()=>{
              const rows=[['ID','Tiêu đề','Môn học','Số câu','Ngày tạo']];
              lessons.forEach(l=>rows.push([
                l.id,
                `"${(l.title||'').replace(/"/g,'""')}"`,
                l.subject||'',
                l.questions?.length||0,
                l.created_at?new Date(l.created_at).toLocaleDateString('vi-VN'):'',
              ]));
              const csv=rows.map(r=>r.join(',')).join('\n');
              const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
              const a=document.createElement('a');
              a.href=URL.createObjectURL(blob);
              a.download=`learnsy-lessons-${new Date().toISOString().slice(0,10)}.csv`;
              a.click();URL.revokeObjectURL(a.href);
            }} style={{width:'100%',padding:'9px',borderRadius:11,border:'none',
              background:`linear-gradient(135deg,${C.mint},#059669)`,
              color:'#fff',fontSize:12,fontWeight:900,cursor:'pointer',
              display:'flex',alignItems:'center',justifyContent:'center',gap:6,
              boxShadow:'0 3px 12px rgba(16,185,129,.3)',transition:'opacity .15s'}}
              onMouseEnter={e=>e.currentTarget.style.opacity='.88'}
              onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Tải về CSV
            </button>
          </div>

        </div>
      </div>

      {/* Export Quiz HTML */}
      <div style={card}>
        <SectionHeader color={C.lav} C={C} title="Xuất Quiz HTML"
          icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.lav} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>}/>
        <div style={{fontSize:11,color:C.text3,marginBottom:12,lineHeight:1.65}}>
          Xuất toàn bộ <b style={{color:C.text2}}>{lessons.filter(l=>l.questions?.length>0).length} bộ câu hỏi</b> thành file HTML upload lên Cloudflare.
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:9}}>

          {/* Full — with sound */}
          <div style={{padding:'11px 13px',borderRadius:18,
            background:dark?'rgba(168,85,247,.08)':'rgba(168,85,247,.06)',
            border:`1px solid ${dark?'rgba(168,85,247,.22)':'rgba(168,85,247,.18)'}`}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
              <div style={{width:32,height:32,borderRadius:10,
                background:dark?'rgba(168,85,247,.18)':'rgba(168,85,247,.12)',
                border:`1.5px solid rgba(168,85,247,.3)`,
                display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.lav} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
              </div>
              <div>
                <div style={{fontSize:13,fontWeight:800,color:C.text,fontFamily:"'Baloo 2',cursive"}}>Full (có âm thanh)</div>
                <div style={{fontSize:11,color:C.text3}}>Tone.js · hiệu ứng âm thanh đầy đủ</div>
              </div>
            </div>
            <button className="bb-a-btn" onClick={()=>{
              const valid=lessons.filter(l=>l.questions?.length>0);
              if(!valid.length){(window._adminToast||alert)('Chưa có bộ câu hỏi nào!','📭','#f472b6');return;}
              const html=buildExportHTML(valid);
              const blob=new Blob([html],{type:'text/html'});
              const a=document.createElement('a');
              a.href=URL.createObjectURL(blob);
              a.download=`learnsy-quiz-full-${new Date().toISOString().slice(0,10)}.html`;
              a.click();URL.revokeObjectURL(a.href);
            }} style={{width:'100%',padding:'9px',borderRadius:11,border:'none',
              background:'linear-gradient(135deg,#A855F7,#7C3AED)',
              color:'#fff',fontSize:12,fontWeight:900,cursor:'pointer',
              display:'flex',alignItems:'center',justifyContent:'center',gap:6,
              boxShadow:'0 3px 12px rgba(168,85,247,.35)',transition:'opacity .15s'}}
              onMouseEnter={e=>e.currentTarget.style.opacity='.88'}
              onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Tải về Full HTML
            </button>
          </div>

          {/* Lite — no sound */}
          <div style={{padding:'11px 13px',borderRadius:18,
            background:dark?'rgba(244,114,182,.07)':'rgba(244,114,182,.05)',
            border:`1px solid ${dark?'rgba(244,114,182,.2)':'rgba(244,114,182,.16)'}`}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
              <div style={{width:32,height:32,borderRadius:10,
                background:dark?'rgba(244,114,182,.16)':'rgba(244,114,182,.1)',
                border:`1.5px solid rgba(244,114,182,.28)`,
                display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.rose} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
              </div>
              <div>
                <div style={{fontSize:13,fontWeight:800,color:C.text,fontFamily:"'Baloo 2',cursive"}}>Lite (không âm thanh)</div>
                <div style={{fontSize:11,color:C.text3}}>Nhẹ hơn · tải nhanh hơn</div>
              </div>
            </div>
            <button className="bb-a-btn" onClick={()=>{
              const valid=lessons.filter(l=>l.questions?.length>0);
              if(!valid.length){(window._adminToast||alert)('Chưa có bộ câu hỏi nào!','📭','#f472b6');return;}
              const html=buildExportLiteHTML(valid);
              const blob=new Blob([html],{type:'text/html'});
              const a=document.createElement('a');
              a.href=URL.createObjectURL(blob);
              a.download=`learnsy-quiz-lite-${new Date().toISOString().slice(0,10)}.html`;
              a.click();URL.revokeObjectURL(a.href);
            }} style={{width:'100%',padding:'9px',borderRadius:11,border:'none',
              background:`linear-gradient(135deg,${C.rose},#db2777)`,
              color:'#fff',fontSize:12,fontWeight:900,cursor:'pointer',
              display:'flex',alignItems:'center',justifyContent:'center',gap:6,
              boxShadow:'0 3px 12px rgba(244,114,182,.35)',transition:'opacity .15s'}}
              onMouseEnter={e=>e.currentTarget.style.opacity='.88'}
              onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Tải về Lite HTML
            </button>
          </div>

        </div>
      </div>

      {/* About */}
      <div style={card}>
        <SectionHeader color={C.mint} C={C} title="Về ứng dụng"
          icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.mint} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}/>
        {[
          ['Phiên bản','Learnsy Admin v24.5'],
          ['Tác giả','EnglishFun · Việt Nam'],
          ['Stack','React · Supabase · Upstash · Cloudflare'],
          ['Hỗ trợ','Tiếng Anh, Lịch Sử, Vật Lý...'],
        ].map(([k,v])=>(
          <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:`1px solid ${C.border}`}}>
            <span style={{fontSize:12,fontWeight:700,color:C.text3}}>{k}</span>
            <span style={{fontSize:12,fontWeight:800,color:C.text2}}>{v}</span>
          </div>
        ))}
        <div style={{marginTop:10,textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center',gap:5,fontSize:11,fontWeight:700,color:C.rose}}>
          Made with
          <svg viewBox="0 0 24 24" width="12" height="12" fill={C.rose}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          for you~
        </div>
      </div>
    </div>
  );
}

/* ══ COLLAPSIBLE SECTION ══ */
function Collapsible({title,icon,color,badge,defaultOpen=true,dark,C,children}){
  const [open,setOpen]=useState(defaultOpen);
  return(
    <div style={{background:dark?'rgba(255,255,255,.06)':'rgba(255,255,255,.82)',border:`1.5px solid ${C.border}`,borderRadius:24,overflow:'hidden',transition:'box-shadow .18s'}}>
      <button onClick={()=>setOpen(o=>!o)} style={{
        all:'unset',width:'100%',boxSizing:'border-box',
        display:'flex',alignItems:'center',gap:8,
        padding:'12px 15px',cursor:'pointer',
        borderBottom:open?`1px solid ${C.border}`:'none',
        transition:'background .15s',
      }}
        onMouseEnter={e=>e.currentTarget.style.background=dark?'rgba(255,255,255,.04)':'rgba(244,114,182,.05)'}
        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
        <div style={{width:26,height:26,borderRadius:9,background:rgba(color,.15),display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          {icon}
        </div>
        <span style={{flex:1,fontSize:12,fontWeight:900,color:C.text2,textTransform:'uppercase',letterSpacing:.7}}>{title}</span>
        {badge!=null&&<span style={{fontSize:11,fontWeight:800,color,background:rgba(color,.12),border:`1px solid ${rgba(color,.25)}`,borderRadius:999,padding:'1px 9px'}}>{badge}</span>}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.text3} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{transition:'transform .25s cubic-bezier(.34,1.56,.64,1)',transform:open?'rotate(0deg)':'rotate(-90deg)',flexShrink:0}}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      <div style={{
        display:'grid',
        gridTemplateRows:open?'1fr':'0fr',
        transition:'grid-template-rows .28s cubic-bezier(.4,0,.2,1)',
      }}>
        <div style={{overflow:'hidden'}}>
          <div style={{padding:'14px 15px'}}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══ RESULTS PANEL ══ */
function ResultsPanel({dark,C}){
  const [results,setResults]=useState([]);
  const [loading,setLoading]=useState(true);
  const [loadErr,setLoadErr]=useState('');
  const [clearing,setClearing]=useState(false);
  const [openId,setOpenId]=useState(null); // dòng kết quả đang mở chi tiết đúng/sai
  const toast=window._adminToast||alert;

  // Tải qua /api/score?all=1 (server, xác thực x-admin-secret): cùng một nguồn
  // với học sinh nên số liệu không lệch, và server luôn lọc bản ghi đã xóa.
  const load=React.useCallback(async()=>{
    setLoading(true);setLoadErr('');
    try{
      const res=await fetch('/api/score?all=1&limit=200',{
        cache:'no-store',
        headers:{'x-admin-secret':window.ADMIN_API_KEY||''},
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok||!data.ok)throw new Error(data.error||('HTTP '+res.status));
      setResults((data.rows||[]).map(r=>({...r,score:Number(r.score),total:Number(r.total)})));
    }catch(e){
      console.warn('quiz_results:',e);
      setLoadErr('Không tải được kết quả ('+(e.message||'lỗi')+'). Kiểm tra ADMIN_API_KEY rồi bấm Tải lại.');
    }
    setLoading(false);
  },[]);
  useEffect(()=>{load();},[load]);

  // Xóa qua server (soft-delete) — cùng cơ chế với học sinh nên xóa xong
  // học sinh cũng KHÔNG còn thấy. Xác thực bằng x-admin-secret.
  async function adminDelete(body){
    const res=await fetch('/api/score',{
      method:'DELETE',
      headers:{'Content-Type':'application/json','x-admin-secret':window.ADMIN_API_KEY||''},
      body:JSON.stringify({admin:true,...body}),
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok||!data.ok)throw new Error(data.error||('HTTP '+res.status));
    return data.deleted||0;
  }

  async function handleClearAll(){
    if(!results.length)return;
    const ok=window.confirm(`Xoá toàn bộ kết quả? Học sinh cũng sẽ không còn thấy các lần làm này. Không thể hoàn tác.`);
    if(!ok)return;
    setClearing(true);
    try{
      const n=await adminDelete({all:true});
      setResults([]);
      toast(`Đã xoá ${n} kết quả!`,'🗑️','#EF4444');
    }catch(e){
      console.warn('clear quiz_results:',e);
      toast('Xoá thất bại: '+(e.message||'lỗi không rõ')+' — kiểm tra ADMIN_API_KEY / quyền ghi.','❌','#EF4444');
    }finally{
      setClearing(false);
    }
  }

  async function handleDeleteOne(id){
    if(!window.confirm('Xoá kết quả này?'))return;
    try{
      await adminDelete({ids:[id]});
      setResults(p=>p.filter(r=>r.id!==id));
      toast('Đã xoá kết quả','🗑️','#EF4444');
    }catch(e){
      toast('Xoá thất bại: '+(e.message||'lỗi không rõ'),'❌','#EF4444');
    }
  }

  const pct=r=>r.pct!=null?Number(r.pct):(r.total>0?Math.round(Math.min(1,r.score/r.total)*100):0);
  const avg=results.length?Math.round(results.reduce((s,r)=>s+pct(r),0)/results.length):0;
  const high=results.filter(r=>pct(r)>=80).length;
  const bins=[
    {label:'0–49', count:results.filter(r=>pct(r)<50).length,              color:'#EF4444'},
    {label:'50–69',count:results.filter(r=>pct(r)>=50&&pct(r)<70).length,  color:'#F97316'},
    {label:'70–84',count:results.filter(r=>pct(r)>=70&&pct(r)<85).length,  color:'#EAB308'},
    {label:'85+',  count:results.filter(r=>pct(r)>=85).length,             color:'#10B981'},
  ];

  if(loading)return(
    <div style={{textAlign:'center',padding:'60px 0',color:C.text3}}>
      <div style={{width:32,height:32,border:`3px solid ${C.border}`,borderTopColor:'#f472b6',borderRadius:'50%',margin:'0 auto 14px',animation:'bb-spin .7s linear infinite'}}/>
      <div style={{fontSize:13,fontWeight:700}}>Đang tải kết quả...</div>
    </div>
  );

  if(loadErr)return(
    <div style={{textAlign:'center',padding:'50px 20px',color:C.text3}}>
      <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>{loadErr}</div>
      <button onClick={load} style={{padding:'8px 16px',borderRadius:12,border:'1.5px solid rgba(244,114,182,.4)',background:'transparent',color:'#f472b6',fontWeight:800,cursor:'pointer',fontFamily:'Nunito,sans-serif'}}>Tải lại</button>
    </div>
  );

  if(!results.length)return(
    <div style={{textAlign:'center',padding:'60px 20px',display:'flex',flexDirection:'column',alignItems:'center',gap:14,animation:'bb-fadeUp .3s ease both'}}>
      <div style={{width:60,height:60,borderRadius:24,background:dark?'rgba(168,85,247,.14)':'rgba(168,85,247,.08)',
        border:`1.5px solid rgba(168,85,247,.25)`,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#A855F7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      </div>
      <div style={{fontSize:15,fontWeight:900,color:C.text2,fontFamily:"'Baloo 2',cursive"}}>Chưa có kết quả làm bài</div>
      <div style={{fontSize:12,color:C.text3,lineHeight:1.65,maxWidth:260}}>
        Kết quả xuất hiện khi học sinh nộp bài qua <b style={{color:'#f472b6'}}>index.html</b>. Dữ liệu lưu vào bảng <code style={{background:dark?'rgba(168,85,247,.14)':'rgba(168,85,247,.08)',padding:'1px 6px',borderRadius:6,fontSize:11}}>quiz_results</code>.
      </div>
    </div>
  );

  return(
    <div style={{display:'flex',flexDirection:'column',gap:12,animation:'bb-fadeUp .28s ease both'}}>

      {/* Clear-all action */}
      <div style={{display:'flex',justifyContent:'flex-end'}}>
        <button
          className="bb-a-btn"
          onClick={handleClearAll}
          disabled={clearing}
          title="Xoá toàn bộ kết quả"
          style={{
            display:'flex',alignItems:'center',gap:6,
            padding:'7px 12px',borderRadius:12,
            background:dark?'rgba(239,68,68,.12)':'rgba(239,68,68,.08)',
            border:'1.5px solid rgba(239,68,68,.28)',
            color:'#EF4444',fontSize:11,fontWeight:800,fontFamily:'Nunito,sans-serif',
            opacity:clearing?.6:1,cursor:clearing?'not-allowed':'pointer',
          }}>
          {clearing?(
            <div style={{width:13,height:13,border:'2px solid rgba(239,68,68,.3)',borderTopColor:'#EF4444',borderRadius:'50%',animation:'bb-spin .6s linear infinite'}}/>
          ):(
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          )}
          Xoá toàn bộ
        </button>
      </div>

      {/* KPIs — always visible, no collapse */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
        {[
          {label:'Lượt làm',value:results.length,color:'#A855F7',icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A855F7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>},
          {label:'Điểm TB',value:avg+'%',color:'#F472B6',icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F472B6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>},
          {label:'Điểm cao (≥80%)',value:high,color:'#10B981',icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="8 21 12 21 16 21"/><line x1="12" y1="17" x2="12" y2="21"/><path d="M7 4h3a2 2 0 0 0 2-2 2 2 0 0 0 2 2h3v8a5 5 0 0 1-10 0V4z"/></svg>},
        ].map(k=>(
          <div key={k.label} style={{
            background:dark?rgba(k.color,.12):rgba(k.color,.08),
            border:`1.5px solid ${rgba(k.color,.25)}`,borderRadius:22,padding:'12px 10px',textAlign:'center',
            boxShadow:`0 4px 16px ${rgba(k.color,.15)}`,
            animation:'bb-fadeUp .3s ease both',
          }}>
            <div style={{display:'flex',justifyContent:'center',marginBottom:6}}>{k.icon}</div>
            <div style={{fontSize:22,fontWeight:900,color:k.color,fontFamily:"'Baloo 2',cursive"}}>{k.value}</div>
            <div style={{fontSize:10,fontWeight:700,color:C.text3,marginTop:3}}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Activity chart — collapsible */}
      <Collapsible
        title="Hoạt động 7 ngày" color="#06B6D4" dark={dark} C={C} defaultOpen={false}
        icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#06B6D4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}>
        <ActivityChart results={results} color="#06B6D4" dark={dark} C={C}/>
      </Collapsible>

      {/* Score distribution — collapsible */}
      <Collapsible
        title="Phân bố điểm số" color={C.lav} dark={dark} C={C} defaultOpen={false}
        icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.lav} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 12h6M9 15h4"/></svg>}>
        <BarChart data={bins} color={C.lav} dark={dark} C={C}/>
      </Collapsible>

      {/* Recent results — collapsible */}
      <Collapsible
        title="Kết quả gần đây" color="#F472B6" badge={results.length} dark={dark} C={C} defaultOpen={false}
        icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f472b6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}>
        <div style={{display:'flex',flexDirection:'column',gap:0,margin:'-14px -15px'}}>
          {results.slice(0,30).map((r,i)=>{
            const p=pct(r);
            const col=scoreColor(p);
            const isOpen=openId===r.id;
            const pq=Array.isArray(r.per_q)?r.per_q:[];
            const nOk=pq.filter(x=>x&&x.ok).length;
            const nPart=pq.filter(x=>x&&!x.ok&&x.partial).length;
            const nBad=pq.length-nOk-nPart;
            return(
              <div key={r.id} style={{borderBottom:i<Math.min(results.length,30)-1?`1px solid ${C.border}`:'none'}}>
              <div onClick={()=>setOpenId(isOpen?null:r.id)}
                style={{display:'flex',alignItems:'center',gap:10,padding:'11px 15px',cursor:'pointer',
                background:isOpen?(dark?'rgba(244,114,182,.07)':'rgba(244,114,182,.06)'):'transparent',transition:'background .15s'}}
                onMouseEnter={e=>e.currentTarget.style.background=dark?'rgba(255,255,255,.03)':'rgba(244,114,182,.04)'}
                onMouseLeave={e=>e.currentTarget.style.background=isOpen?(dark?'rgba(244,114,182,.07)':'rgba(244,114,182,.06)'):'transparent'}>
                <div style={{width:32,height:32,borderRadius:11,background:rgba(col,.15),
                  border:`1.5px solid ${rgba(col,.3)}`,display:'flex',alignItems:'center',
                  justifyContent:'center',fontSize:11,fontWeight:900,color:col,flexShrink:0}}>
                  {i+1}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:800,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.student_name||'Ẩn danh'}</div>
                  <div style={{fontSize:10,color:C.text3,marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.lesson_title||'Không rõ bài'}</div>
                </div>
                <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:2,flexShrink:0}}>
                  <div style={{fontSize:14,fontWeight:900,color:col,fontFamily:"'Baloo 2',cursive"}}>{Math.round(r.score*100)/100}/{Math.round(r.total*100)/100} <span style={{fontSize:11,opacity:.7}}>({p}%)</span></div>
                  <div style={{fontSize:9,fontWeight:700,color:C.text4}}>{fmtDate(r.submitted_at||r.created_at)}</div>
                </div>
                <button title="Xoá kết quả này" onClick={e=>{e.stopPropagation();handleDeleteOne(r.id);}}
                  style={{border:'none',background:'transparent',color:C.text4,cursor:'pointer',fontSize:16,lineHeight:1,padding:'2px 4px',flexShrink:0}}>×</button>
              </div>
              {isOpen&&(
                <div style={{padding:'4px 15px 14px',background:dark?'rgba(0,0,0,.18)':'rgba(244,114,182,.03)'}}>
                  {pq.length===0?(
                    <div style={{fontSize:11,color:C.text3,padding:'8px 0'}}>Bài này chưa có chi tiết từng câu (làm trước khi có tính năng lưu đáp án).</div>
                  ):(<>
                    <div style={{display:'flex',gap:8,flexWrap:'wrap',padding:'8px 0 10px',fontSize:11,fontWeight:800}}>
                      <span style={{color:'#10b981'}}>✓ Đúng {nOk}</span>
                      {nPart>0&&<span style={{color:'#f59e0b'}}>◐ Đúng một phần {nPart}</span>}
                      <span style={{color:'#ef4444'}}>✗ Sai {nBad}</span>
                      {r.duration_sec?<span style={{color:C.text3,fontWeight:700}}>⏱ {Math.floor(r.duration_sec/60)}p{String(r.duration_sec%60).padStart(2,'0')}s</span>:null}
                    </div>
                    {pq.map((x,qi)=>{
                      const st=x.ok?'ok':x.partial?'part':'bad';
                      const c=st==='ok'?'#10b981':st==='part'?'#f59e0b':'#ef4444';
                      return(
                        <div key={qi} style={{display:'flex',gap:9,padding:'8px 0',borderTop:qi?`1px dashed ${C.border}`:'none'}}>
                          <div style={{width:24,height:24,borderRadius:8,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',
                            fontSize:11,fontWeight:900,color:c,background:rgba(c,.14),border:`1.5px solid ${rgba(c,.35)}`}}>{qi+1}</div>
                          <div style={{flex:1,minWidth:0,fontSize:11,lineHeight:1.45}}>
                            <div style={{color:C.text,fontWeight:700,wordBreak:'break-word'}}>{x.qText||'(không có nội dung)'}</div>
                            <div style={{color:c,fontWeight:800,marginTop:2,wordBreak:'break-word'}}>
                              {st==='ok'?'✓ ':st==='part'?'◐ ':'✗ '}Trả lời: {x.userAns||'(bỏ trống)'}
                            </div>
                            {st!=='ok'&&x.correctAns&&<div style={{color:'#10b981',fontWeight:700,wordBreak:'break-word'}}>Đáp án: {x.correctAns}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </>)}
                </div>
              )}
              </div>
            );
          })}
        </div>
      </Collapsible>

    </div>
  );
}

/* ══ MAIN DASHBOARD ══ */
/* ══ USAGE PANEL — lượt học theo ngày (đếm ở Upstash qua /api/analytics) ══ */
function UsagePanel({dark,C}){
  const [days,setDays]=useState(null);   // null = đang tải
  const [err,setErr]=useState('');
  const load=React.useCallback(async()=>{
    setDays(null);setErr('');
    try{
      const res=await fetch('/api/analytics?days=14',{cache:'no-store',headers:{'x-admin-secret':window.ADMIN_API_KEY||''}});
      const data=await res.json().catch(()=>({}));
      if(!res.ok||!data.ok)throw new Error(data.error||('HTTP '+res.status));
      setDays(data.days||[]);
    }catch(e){setErr(e.message||'lỗi');setDays([]);}
  },[]);
  useEffect(()=>{load();},[load]);

  const list=days||[];
  const maxV=Math.max(1,...list.map(d=>d.lesson_start));
  const total=list.reduce((a,d)=>a+d.lesson_start,0);
  const color='#06B6D4';
  const cell={fontSize:11,color:C.text2,textAlign:'right',fontVariantNumeric:'tabular-nums'};
  return(
    <Collapsible title="Lượt học 14 ngày" color={color} dark={dark} C={C} defaultOpen={false}
      badge={days?total:'…'}
      icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/></svg>}>
      {err&&<div style={{fontSize:12,color:'#EF4444',marginBottom:8}}>Không tải được ({err}). Cần UPSTASH_URL/UPSTASH_TOKEN và ADMIN_API_KEY. <button onClick={load} style={{all:'unset',cursor:'pointer',textDecoration:'underline'}}>Tải lại</button></div>}
      {days===null&&<div style={{fontSize:12,color:C.text3}}>Đang tải…</div>}
      {days&&!err&&(
        <div style={{display:'grid',gridTemplateColumns:'auto 1fr auto auto auto',gap:'5px 10px',alignItems:'center'}}>
          <span style={{...cell,textAlign:'left',fontWeight:900,color:C.text3}}>Ngày</span>
          <span/>
          <span style={{...cell,fontWeight:900,color:C.text3}}>Vào bài</span>
          <span style={{...cell,fontWeight:900,color:C.text3}}>Nộp bài</span>
          <span style={{...cell,fontWeight:900,color:C.text3}}>HS</span>
          {list.map(d=>(
            <React.Fragment key={d.day}>
              <span style={{...cell,textAlign:'left'}}>{d.day.slice(5)}</span>
              <div style={{height:8,borderRadius:99,background:dark?'rgba(255,255,255,.07)':'rgba(6,182,212,.1)',overflow:'hidden'}}>
                <div style={{width:(d.lesson_start/maxV*100)+'%',height:'100%',background:color,borderRadius:99,transition:'width .3s'}}/>
              </div>
              <span style={cell}>{d.lesson_start}</span>
              <span style={cell}>{d.quiz_complete}</span>
              <span style={cell}>{d.active||'–'}</span>
            </React.Fragment>
          ))}
        </div>
      )}
      <div style={{fontSize:10,color:C.text3,marginTop:8}}>Ngày tính theo UTC. “HS” = số học sinh khác nhau (ước lượng) có đăng nhập khi học; “–” nếu chưa có dữ liệu.</div>
    </Collapsible>
  );
}

function AdminDashboard({lessons,dark,C,onDarkToggle,onClose}){
  const [tab,setTab]=useState('overview');
  const {show:showToast,node:toastNode}=useDiToast();
  /* Expose globally so sub-components (SettingsPanel etc.) can call showToast */
  useEffect(()=>{ window._adminToast=showToast; return()=>{ window._adminToast=null; }; },[showToast]);
  const stats=useMemo(()=>buildStats(lessons),[lessons]);
  const TYPES_CONFIG=[
    {key:'true_false', label:'Đúng/Sai',     color:'#A855F7'},
    {key:'multiple',   label:'Trắc nghiệm',  color:'#F472B6'},
    {key:'multi_select',label:'Chọn nhiều',  color:'#10B981'},
    {key:'fill_blank', label:'Điền từ',      color:'#F97316'},
  ];
  const subjEntries=Object.entries(stats.subjects);
  const adminName=localStorage.getItem('learnsy_admin_name')||'Admin';

  const TABS=[
    {k:'overview',label:'Tổng quan',icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>},
    {k:'charts',  label:'Biểu đồ',  icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>},
    {k:'results', label:'Kết quả',  icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>},
    {k:'settings',label:'Cài đặt',  icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>},
  ];

  const card={background:dark?'rgba(255,255,255,.06)':'rgba(255,255,255,.82)',border:`1.5px solid ${C.border}`,borderRadius:24,padding:'14px 15px',boxShadow:dark?'none':'0 4px 16px rgba(244,114,182,.07)'};

  return(
    <div style={{minHeight:'100vh',background:C.bg,color:C.text,maxWidth:760,margin:'0 auto',display:'flex',flexDirection:'column',position:'relative',fontFamily:'Nunito,sans-serif'}}>
      <FloatingDecos dark={dark}/>

      {/* ── HEADER ── */}
      <div style={{
        background:dark?'rgba(20,5,14,.96)':'rgba(255,245,250,.96)',
        borderBottom:`1.5px solid ${C.border}`,position:'sticky',top:0,zIndex:60,
        backdropFilter:'blur(24px)',
        boxShadow:dark?'0 2px 20px rgba(244,114,182,.1)':'0 2px 20px rgba(244,114,182,.08)',
      }}>
        <div style={{padding:'11px 14px 9px',display:'flex',alignItems:'center',gap:8}}>
          {/* Back button */}
          <button onClick={onClose} className="bb-a-btn"
            style={{display:'flex',alignItems:'center',gap:5,padding:'6px 12px',borderRadius:99,
              border:`1.5px solid ${C.border}`,background:dark?'rgba(255,255,255,.07)':'rgba(244,114,182,.08)',
              color:C.text3,fontSize:12,fontWeight:800,flexShrink:0,transition:'all .18s'}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='#f472b6';e.currentTarget.style.color='#f472b6';}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.text3;}}>
            <svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor"><path d="M12 4l-8 6 8 6V4z"/></svg>
            Quản lý
          </button>

          {/* Logo */}
          <div style={{flex:1,display:'flex',alignItems:'center',gap:6}}>
            <span style={{display:'inline-flex',animation:'bb-heartbeat 2.5s ease-in-out infinite',color:'#f472b6'}}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="#f472b6"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            </span>
            <span style={{fontFamily:"'Baloo 2',cursive",fontWeight:900,fontSize:16,
              background:'linear-gradient(120deg,#f472b6,#a855f7)',
              backgroundClip:'text',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
              Dashboard
            </span>
            <span style={{fontSize:10,fontWeight:900,color:C.lav,background:dark?'rgba(168,85,247,.2)':'rgba(168,85,247,.1)',
              border:`1.5px solid rgba(168,85,247,.3)`,borderRadius:99,padding:'2px 7px',flexShrink:0}}>Admin</span>
          </div>

          {/* Dark mode toggle */}
          <button className="bb-a-toggle" onClick={onDarkToggle}
            style={{width:36,height:36,borderRadius:12,
              background:dark?'rgba(245,158,11,.15)':'rgba(168,85,247,.1)',
              border:`1.5px solid ${dark?'rgba(245,158,11,.3)':'rgba(168,85,247,.25)'}`,
              display:'flex',alignItems:'center',justifyContent:'center',
              transition:'all .25s cubic-bezier(.34,1.56,.64,1)'}}>
            {dark
              ?<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              :<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#a855f7" strokeWidth="2.2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            }
          </button>
        </div>

        {/* Tab bar */}
        <div style={{display:'flex',padding:'0 10px 9px',gap:3,overflowX:'auto'}} className="bb-a-scroll">
          {TABS.map(t=>{
            const active=tab===t.k;
            return(
              <button key={t.k} className="bb-a-tab" onClick={()=>setTab(t.k)}
                style={{display:'flex',alignItems:'center',gap:5,padding:'7px 14px',borderRadius:99,
                  fontSize:12,fontWeight:800,flexShrink:0,
                  background:active?(dark?'linear-gradient(135deg,rgba(244,114,182,.22),rgba(168,85,247,.18))':'linear-gradient(135deg,rgba(244,114,182,.14),rgba(168,85,247,.1))'):dark?'rgba(255,255,255,.04)':'rgba(244,114,182,.05)',
                  color:active?'#f472b6':C.text3,
                  border:active?`1.5px solid rgba(244,114,182,.3)`:`1.5px solid transparent`,
                  boxShadow:active?'0 2px 8px rgba(244,114,182,.2)':'none',
                  transform:active?'scale(1.03)':'scale(1)',
                  transition:'all .2s cubic-bezier(.34,1.56,.64,1)'}}>
                {t.icon}{t.label}
                {active&&<div style={{width:4,height:4,borderRadius:'50%',background:'#f472b6',boxShadow:'0 0 5px #f472b6',marginLeft:2}}/>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── BODY ── */}
      <div key={tab} style={{flex:1,padding:'14px 12px 80px',display:'flex',flexDirection:'column',gap:12,position:'relative',zIndex:1,animation:'bb-fadeUp .22s ease both'}}>

        {/* ══ OVERVIEW ══ */}
        {tab==='overview'&&(
          <>
            {/* Welcome banner */}
            {(()=>{
              const hour=new Date().getHours();
              const greeting=hour<5?'Làm việc khuya vậy 🌙':hour<12?'Chào buổi sáng ☀️':hour<18?'Chào buổi chiều 🌤️':'Chào buổi tối 🌙';
              const confettiItems=[
                {c:'#F472B6',x:'12%',d:'.1s',dur:'1.8s',shape:'circle'},
                {c:'#A855F7',x:'28%',d:'.4s',dur:'2.1s',shape:'square'},
                {c:'#10B981',x:'45%',d:'.2s',dur:'1.6s',shape:'circle'},
                {c:'#F97316',x:'62%',d:'.6s',dur:'2.3s',shape:'square'},
                {c:'#06B6D4',x:'78%',d:'.3s',dur:'1.9s',shape:'circle'},
                {c:'#FCD34D',x:'88%',d:'.5s',dur:'2.0s',shape:'square'},
              ];
              return(
            <div style={{
              background:dark?'linear-gradient(135deg,rgba(244,114,182,.18),rgba(168,85,247,.14))':'linear-gradient(135deg,#FFF0F5,#F0E6FF)',
              border:`1.5px solid rgba(244,114,182,.3)`,borderRadius:22,padding:'18px 16px',
              display:'flex',alignItems:'center',gap:13,
              boxShadow:dark?'0 8px 32px rgba(244,114,182,.15)':'0 8px 32px rgba(168,85,247,.12)',
              animation:'bb-fadeUp .28s ease both',position:'relative',overflow:'hidden',
            }}>
              {/* animated bg orbs */}
              <div style={{position:'absolute',top:-30,right:-30,width:100,height:100,borderRadius:'50%',background:dark?'rgba(168,85,247,.12)':'rgba(168,85,247,.14)',animation:'bb-glow-pulse 3s ease-in-out infinite',pointerEvents:'none'}}/>
              <div style={{position:'absolute',bottom:-20,left:'40%',width:70,height:70,borderRadius:'50%',background:dark?'rgba(244,114,182,.08)':'rgba(244,114,182,.1)',animation:'bb-glow-pulse 4s ease-in-out .8s infinite',pointerEvents:'none'}}/>
              {/* confetti */}
              {confettiItems.map((ci,i)=>(
                <div key={i} style={{position:'absolute',top:-6,left:ci.x,width:ci.shape==='circle'?7:6,height:ci.shape==='circle'?7:6,
                  borderRadius:ci.shape==='circle'?'50%':2,background:ci.c,pointerEvents:'none',
                  animation:`bb-confetti ${ci.dur} ease-in ${ci.d} infinite`,opacity:.75}}/>
              ))}
              <div style={{width:52,height:52,borderRadius:17,
                background:'linear-gradient(135deg,#F472B6,#A855F7)',
                display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,
                boxShadow:'0 4px 18px rgba(168,85,247,.45)',animation:'bb-heartbeat 2.5s ease-in-out infinite'}}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              </div>
              <div style={{flex:1,position:'relative'}}>
                <div style={{fontSize:11,fontWeight:700,color:C.lav,marginBottom:3,animation:'bb-slide-right .35s ease both'}}>{greeting}</div>
                <div style={{fontSize:17,fontWeight:900,color:C.text,fontFamily:"'Baloo 2',cursive"}}>
                  Xin chào, {adminName} 👋
                </div>
                <div style={{fontSize:12,color:C.text3,marginTop:4,lineHeight:1.6}}>
                  {lessons.length} bộ câu hỏi · {stats.totalQ} câu · {Object.keys(stats.subjects).length} môn học
                </div>
                <div style={{display:'flex',gap:6,marginTop:8,flexWrap:'wrap'}}>
                  {[
                    {label:`${stats.total} bộ`,  color:'#a855f7'},
                    {label:`${stats.totalQ} câu`, color:'#f472b6'},
                    {label:`${Object.keys(stats.subjects).length} môn`, color:'#10B981'},
                  ].map((b,i)=>(
                    <span key={i} className="bb-a-sticker" style={{
                      background:dark?rgba(b.color,.18):rgba(b.color,.12),
                      border:`1.5px solid ${rgba(b.color,.3)}`,
                      color:b.color,padding:'3px 10px',fontSize:11,
                      animation:`bb-rise .3s ease ${i*.08+.1}s both`,
                    }}>{b.label}</span>
                  ))}
                </div>
              </div>
            </div>
              );
            })()}

            {/* KPI Grid */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9}}>
              <KpiCard dark={dark} C={C} delay={.05}
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A855F7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>}
                label="Bộ câu hỏi" value={stats.total} sub={`${Object.keys(stats.subjects).length} môn học`} color="#A855F7"/>
              <KpiCard dark={dark} C={C} delay={.1}
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F472B6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
                label="Tổng câu hỏi" value={stats.totalQ} sub="Tất cả các bộ" color="#F472B6"/>
              <KpiCard dark={dark} C={C} delay={.15}
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>}
                label="Trắc nghiệm" value={stats.types.multiple+stats.types.multi_select} sub="MC + multi-select" color="#10B981"/>
              <KpiCard dark={dark} C={C} delay={.2}
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/></svg>}
                label="Điền từ" value={stats.types.fill_blank} sub="Fill-in-the-blank" color="#F97316"/>
            </div>

            {/* Radial rings */}
            <div style={{...card,animation:'bb-fadeUp .34s ease both'}}>
              <SectionHeader color={C.rose} C={C} title="Tỷ lệ loại câu hỏi"
                icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.rose} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}/>
              <div style={{display:'flex',justifyContent:'space-around',flexWrap:'wrap',gap:10}}>
                {TYPES_CONFIG.map(t=>(
                  <RadialProgress key={t.key} value={stats.types[t.key]} max={Math.max(stats.totalQ,1)} color={t.color} label={t.label} dark={dark} C={C}/>
                ))}
              </div>
            </div>

            {/* Monthly chart */}
            <div style={{...card,animation:'bb-fadeUp .38s ease both'}}>
              <SectionHeader color={C.mint} C={C} title="Bài học theo tháng"
                icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.mint} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}/>
              <AreaChart data={stats.monthly} color="#A855F7" dark={dark} C={C}/>
            </div>

            {/* Subjects */}
            {subjEntries.length>0&&(
              <div style={{...card,animation:'bb-fadeUp .42s ease both'}}>
                <SectionHeader color={C.lav} C={C} title="Phân bố theo môn học"
                  icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.lav} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>}/>
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {[...subjEntries].sort((a,b)=>b[1]-a[1]).map(([s,cnt],i)=>{
                    const colors=['#F472B6','#A855F7','#10B981','#F97316','#06B6D4','#EAB308','#EF4444'];
                    const c=colors[i%colors.length];
                    const pct=Math.round(cnt/stats.total*100);
                    return(
                      <div key={s}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                          <span style={{fontSize:12,fontWeight:800,color:C.text2}}>{s}</span>
                          <span style={{fontSize:12,fontWeight:800,color:c}}>{cnt} bộ ({pct}%)</span>
                        </div>
                        <ProgressBar pct={pct} color={c} dark={dark}/>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top lessons by question count */}
            {lessons.length>0&&(()=>{
              const top=[...lessons].sort((a,b)=>(b.questions?.length||0)-(a.questions?.length||0)).slice(0,5);
              const maxQ=top[0]?.questions?.length||1;
              const colors=['#F472B6','#A855F7','#10B981','#F97316','#06B6D4'];
              return(
              <div style={{...card,animation:'bb-fadeUp .44s ease both'}}>
                <SectionHeader color={C.peach} C={C} title="Top bộ đề nhiều câu nhất"
                  icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.peach} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>}/>
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {top.map((l,i)=>{
                    const qc=l.questions?.length||0;
                    const pct=Math.round(qc/maxQ*100);
                    const c=colors[i];
                    return(
                      <div key={l.id} style={{animation:`bb-rise .25s ease ${i*.07}s both`}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
                          <div style={{width:22,height:22,borderRadius:8,background:rgba(c,.18),border:`1.5px solid ${rgba(c,.3)}`,
                            display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                            <span style={{fontSize:10,fontWeight:900,color:c}}>{i+1}</span>
                          </div>
                          <span style={{flex:1,fontSize:12,fontWeight:800,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.title||'Không tên'}</span>
                          <span style={{fontSize:11,fontWeight:900,color:c,flexShrink:0}}>{qc} câu</span>
                        </div>
                        <div style={{height:7,borderRadius:99,background:dark?'rgba(255,255,255,.07)':'rgba(0,0,0,.05)',overflow:'hidden'}}>
                          <div style={{height:'100%',width:`${pct}%`,borderRadius:99,
                            background:`linear-gradient(90deg,${c}bb,${c})`,
                            boxShadow:`0 2px 6px ${c}44`,
                            transition:'width .9s cubic-bezier(.34,1.56,.64,1)',
                            position:'relative',overflow:'hidden'}}>
                            <div style={{position:'absolute',inset:0,background:'linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent)',backgroundSize:'200% 100%',animation:'bb-shimmer 2s linear infinite'}}/>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              );
            })()}

            {/* Quick Actions */}
            <div style={{...card,animation:'bb-fadeUp .46s ease both'}}>
              <SectionHeader color={C.rose} C={C} title="Thao tác nhanh"
                icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.rose} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>}/>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9}}>
                {[
                  {label:'Biểu đồ',  sub:'Xem số liệu',  color:'#F472B6', tab:'charts',  icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>},
                  {label:'Kết quả', sub:'Điểm học sinh', color:'#A855F7', tab:'results', icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>},
                  {label:'Cài đặt', sub:'Tuỳ chỉnh',     color:'#10B981', tab:'settings',icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>},
                  {label:'Xuất HTML',sub:'Full + Lite',   color:'#F97316', tab:'settings',icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>},
                ].map((a,i)=>(
                  <button key={i} className="bb-quick-btn bb-a-btn" onClick={()=>setTab(a.tab)}
                    style={{display:'flex',alignItems:'center',gap:9,padding:'11px 12px',borderRadius:18,
                      background:dark?rgba(a.color,.1):rgba(a.color,.07),
                      border:`1.5px solid ${rgba(a.color,.22)}`,
                      animation:`bb-rise .28s ease ${i*.06+.1}s both`,cursor:'pointer',
                      boxShadow:`0 3px 12px ${rgba(a.color,.15)}`}}>
                    <div style={{width:34,height:34,borderRadius:11,
                      background:`linear-gradient(135deg,${rgba(a.color,.25)},${rgba(a.color,.12)})`,
                      border:`1.5px solid ${rgba(a.color,.3)}`,
                      display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,color:a.color}}>
                      {a.icon}
                    </div>
                    <div style={{textAlign:'left'}}>
                      <div style={{fontSize:13,fontWeight:900,color:C.text}}>{a.label}</div>
                      <div style={{fontSize:10,fontWeight:700,color:C.text3}}>{a.sub}</div>
                    </div>
                    <svg style={{marginLeft:'auto',flexShrink:0}} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={a.color} strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                ))}
              </div>
            </div>

            {/* Motivational footer */}
            {(()=>{
              const quotes=[
                {text:'Mỗi câu hỏi tốt là một hạt giống kiến thức 🌱',color:'#10B981'},
                {text:'Học sinh giỏi bắt đầu từ bài tập hay ✨',color:'#A855F7'},
                {text:'Cảm ơn bạn đã chăm chút từng bộ đề! 💕',color:'#F472B6'},
                {text:'Kiên trì soạn bài là yêu thương học sinh 🌸',color:'#F97316'},
              ];
              const q=quotes[new Date().getDate()%quotes.length];
              return(
            <div style={{
              background:dark?`linear-gradient(135deg,${rgba(q.color,.1)},${rgba(q.color,.05)})`:`linear-gradient(135deg,${rgba(q.color,.08)},${rgba(q.color,.03)})`,
              border:`1.5px dashed ${rgba(q.color,.3)}`,borderRadius:22,padding:'13px 15px',
              display:'flex',alignItems:'center',gap:10,
              animation:'bb-fadeUp .52s ease both',
            }}>
              <div style={{width:36,height:36,borderRadius:12,background:rgba(q.color,.15),
                border:`1.5px solid ${rgba(q.color,.28)}`,flexShrink:0,
                display:'flex',alignItems:'center',justifyContent:'center',
                animation:'bb-wave 3s ease-in-out infinite'}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill={q.color}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </div>
              <div style={{fontSize:12,fontWeight:700,color:C.text2,lineHeight:1.55,fontStyle:'italic'}}>
                "{q.text}"
              </div>
            </div>
              );
            })()}
          </>
        )}
        {tab==='charts'&&(
          <>
            {/* Charts tab banner */}
            <div style={{
              background:dark?'linear-gradient(135deg,rgba(16,185,129,.12),rgba(168,85,247,.1))':'linear-gradient(135deg,#ECFDF5,#F0E6FF)',
              border:`1.5px solid rgba(16,185,129,.25)`,borderRadius:22,padding:'13px 15px',
              display:'flex',alignItems:'center',gap:10,
              animation:'bb-fadeUp .2s ease both',
            }}>
              <div style={{width:38,height:38,borderRadius:12,background:'linear-gradient(135deg,#10B981,#A855F7)',
                display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,
                boxShadow:'0 4px 14px rgba(16,185,129,.4)'}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              </div>
              <div>
                <div style={{fontSize:14,fontWeight:900,color:C.text,fontFamily:"'Baloo 2',cursive"}}>Phân tích dữ liệu 📊</div>
                <div style={{fontSize:11,color:C.text3,marginTop:2}}>{stats.total} bộ · {stats.totalQ} câu · {Object.keys(stats.subjects).length} môn</div>
              </div>
            </div>
            <div style={{...card,animation:'bb-fadeUp .28s ease both'}}>
              <SectionHeader color='#F472B6' C={C} title="Bài học / tháng (cột)"
                icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F472B6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="7" width="4" height="14" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/></svg>}/>
              <div style={{fontSize:11,color:C.text3,marginBottom:10}}>Số bộ câu hỏi tạo trong 6 tháng gần nhất</div>
              <BarChart data={stats.monthly} color="#F472B6" dark={dark} C={C}/>
            </div>

            <div style={{...card,animation:'bb-fadeUp .34s ease both'}}>
              <SectionHeader color='#A855F7' C={C} title="Loại câu hỏi (tròn)"
                icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#A855F7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>}/>
              <div style={{fontSize:11,color:C.text3,marginBottom:10}}>Tỷ lệ phân bố các loại câu hỏi</div>
              <DonutChart slices={TYPES_CONFIG.map(t=>({label:t.label,value:stats.types[t.key],color:t.color}))} dark={dark} C={C}/>
            </div>

            <div style={{...card,animation:'bb-fadeUp .38s ease both'}}>
              <SectionHeader color='#10B981' C={C} title="Xu hướng tạo bài (đường)"
                icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>}/>
              <div style={{fontSize:11,color:C.text3,marginBottom:10}}>Hoạt động thêm bài học theo thời gian</div>
              <AreaChart data={stats.monthly} color="#10B981" dark={dark} C={C}/>
            </div>

            {subjEntries.length>0&&(
              <div style={{...card,animation:'bb-fadeUp .42s ease both'}}>
                <SectionHeader color='#F97316' C={C} title="Môn học (ngang)"
                  icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>}/>
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {[...subjEntries].sort((a,b)=>b[1]-a[1]).map(([s,cnt],i)=>{
                    const colors=['#F472B6','#A855F7','#10B981','#F97316','#06B6D4','#EAB308'];
                    const c=colors[i%colors.length];
                    const pct=Math.round(cnt/Math.max(...subjEntries.map(e=>e[1]))*100);
                    return(
                      <div key={s} style={{display:'flex',alignItems:'center',gap:10}}>
                        <div style={{width:72,fontSize:11,fontWeight:800,color:C.text3,textAlign:'right',flexShrink:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s}</div>
                        <div style={{flex:1,height:22,borderRadius:99,background:dark?'rgba(255,255,255,.06)':'rgba(0,0,0,.04)',overflow:'hidden',position:'relative'}}>
                          <div style={{height:'100%',width:`${pct}%`,background:`linear-gradient(90deg,${c},${c}88)`,borderRadius:99,transition:'width .9s ease',display:'flex',alignItems:'center',justifyContent:'flex-end',paddingRight:8,
                            boxShadow:`0 2px 8px ${c}44`}}>
                            {pct>20&&<span style={{fontSize:10,fontWeight:900,color:'#fff'}}>{cnt}</span>}
                          </div>
                          {pct<=20&&<span style={{position:'absolute',left:`calc(${pct}% + 6px)`,top:'50%',transform:'translateY(-50%)',fontSize:10,fontWeight:900,color:c}}>{cnt}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Summary */}
            <div style={{
              background:dark?'linear-gradient(135deg,rgba(244,114,182,.1),rgba(168,85,247,.08))':'linear-gradient(135deg,#FFF5F9,#FAF5FF)',
              border:`1.5px solid ${C.border}`,borderRadius:24,padding:'14px 15px',
              animation:'bb-fadeUp .46s ease both',
            }}>
              <SectionHeader color={C.rose} C={C} title="Tóm tắt dữ liệu"
                icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.rose} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 12h6M9 15h4"/></svg>}/>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9}}>
                {[
                  ['TB câu/bộ',   stats.total?Math.round(stats.totalQ/stats.total):0,          C.rose],
                  ['Bộ lớn nhất',(()=>{const m=lessons.reduce((a,l)=>((l.questions?.length||0)>(a.questions?.length||0)?l:a),lessons[0]||{});return m?.title?.slice(0,12)||'–';})(),C.lav],
                  ['Môn nhiều',   (([...subjEntries].sort((a,b)=>b[1]-a[1])[0]?.[0]||'–').slice(0,10)),C.mint],
                  ['Loại nhiều', ([...TYPES_CONFIG].sort((a,b)=>stats.types[b.key]-stats.types[a.key])[0]?.label||'–'),C.peach],
                ].map(([l,v,c])=>(
                  <div key={l} style={{background:dark?'rgba(255,255,255,.04)':'rgba(255,255,255,.8)',border:`1px solid ${C.border}`,borderRadius:18,padding:'11px 13px'}}>
                    <div style={{fontSize:10,fontWeight:700,color:C.text3,marginBottom:5}}>{l}</div>
                    <div style={{fontSize:16,fontWeight:900,color:c,fontFamily:"'Baloo 2',cursive"}}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ══ RESULTS ══ */}
        {tab==='results'&&(
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div style={{
              background:dark?'linear-gradient(135deg,rgba(168,85,247,.14),rgba(6,182,212,.1))':'linear-gradient(135deg,#FAF5FF,#ECFEFF)',
              border:`1.5px solid rgba(168,85,247,.25)`,borderRadius:22,padding:'13px 15px',
              display:'flex',alignItems:'center',gap:10,animation:'bb-fadeUp .2s ease both',
            }}>
              <div style={{width:38,height:38,borderRadius:12,background:'linear-gradient(135deg,#A855F7,#06B6D4)',
                display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,
                boxShadow:'0 4px 14px rgba(168,85,247,.4)'}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </div>
              <div>
                <div style={{fontSize:14,fontWeight:900,color:C.text,fontFamily:"'Baloo 2',cursive"}}>Kết quả học sinh 🏆</div>
                <div style={{fontSize:11,color:C.text3,marginTop:2}}>Theo dõi điểm số & hoạt động làm bài</div>
              </div>
            </div>
            <ResultsPanel dark={dark} C={C}/>
            <UsagePanel dark={dark} C={C}/>
          </div>
        )}

        {/* ══ SETTINGS ══ */}
        {tab==='settings'&&(
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div style={{
              background:dark?'linear-gradient(135deg,rgba(244,114,182,.12),rgba(249,115,22,.08))':'linear-gradient(135deg,#FFF5F9,#FFF7ED)',
              border:`1.5px solid rgba(244,114,182,.25)`,borderRadius:22,padding:'13px 15px',
              display:'flex',alignItems:'center',gap:10,animation:'bb-fadeUp .2s ease both',
            }}>
              <div style={{width:38,height:38,borderRadius:12,background:'linear-gradient(135deg,#F472B6,#F97316)',
                display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,
                boxShadow:'0 4px 14px rgba(244,114,182,.4)'}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </div>
              <div>
                <div style={{fontSize:14,fontWeight:900,color:C.text,fontFamily:"'Baloo 2',cursive"}}>Cài đặt & Xuất dữ liệu ⚙️</div>
                <div style={{fontSize:11,color:C.text3,marginTop:2}}>Tuỳ chỉnh giao diện · backup · export quiz</div>
              </div>
            </div>
            <SettingsPanel dark={dark} C={C} onDarkToggle={onDarkToggle} lessons={lessons}/>
          </div>
        )}
      </div>
      {toastNode}
    </div>
  );
}

window.AdminDashboard=AdminDashboard;
})();
