import React from 'react';

/* ══════════════════════════════════════════════════════════════════
   LEARNSY-DEV-ISLAND.JSX  ·  Bảng chẩn đoán "Dev Island"
   Thay thế badge debug tạm — Dynamic Island toast, mở rộng thành panel
   tabs (Tổng quan/Lệnh/Console/Storage/Mạng/Globals/Eval). Toggle ở Cài đặt.

   Animation morph pill→panel tái sử dụng đúng kiểu ScoreIsland trong
   quiz-player.jsx (cubic-bezier spring giống hệt, chỉ đổi kích thước).

   YÊU CẦU: React + ReactDOM phải là global (window.React/window.ReactDOM
   — đã có sẵn trong main.js). Import file này SAU learnsy-dev-icon.jsx:
     import './components/learnsy-dev-icon.jsx'
     import './components/learnsy-dev-island.jsx'

   API công khai (window):
     window.bbSetDevIslandOn(bool)   — bật/tắt bằng code
     window.bbGetDevIslandOn()       — trạng thái hiện tại
     window.DevIslandSettingsCard    — <Card/> nhét vào TabSettings

   Đã tích hợp sẵn trong dashboard.jsx (TabSettings, dưới SparkleSettingsCard):
     {window.DevIslandSettingsCard&&React.createElement(window.DevIslandSettingsCard,{dark})}

   LƯU Ý: tab "Eval" chạy JS bất kỳ trong context trang — đây là công cụ
   cho dev, mặc định TẮT. Nút bật nằm trong Cài đặt nên về lý thuyết học
   sinh tò mò cũng bấm được — không có gì nguy hiểm hơn F12 sẵn có trên
   mọi trình duyệt, nhưng nên biết trước khi để mặc định.
══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const {useState,useEffect,useRef}=React;

// ═══════════════════════════════════════════════════════════════
//  Console capture — monkey-patch, vẫn gọi console gốc bình thường
// ═══════════════════════════════════════════════════════════════
const _logBuf = [];
const _MAX_LOGS = 150;
let _logSubs = [];
function _notifyLogs(){ _logSubs.forEach(fn=>{ try{fn();}catch(e){} }); }
function _fmtArg(a){
  if(typeof a==='string') return a;
  if(a instanceof Error) return a.message;
  try{ return JSON.stringify(a); } catch(e){ return String(a); }
}
function _pushLog(type,args){
  _logBuf.push({ type, msg: args.map(_fmtArg).join(' '), t: Date.now() });
  if(_logBuf.length > _MAX_LOGS) _logBuf.shift();
  _notifyLogs();
}
['log','warn','error','info'].forEach(method=>{
  const orig = console[method].bind(console);
  console[method] = (...args)=>{ orig(...args); _pushLog(method,args); };
});
window.addEventListener('error', e=>{
  _pushLog('error', [(e.message||'Lỗi không xác định') + (e.filename ? ` @ ${e.filename.split('/').pop()}:${e.lineno}` : '')]);
});
window.addEventListener('unhandledrejection', e=>{
  _pushLog('error', ['Unhandled promise: ' + _fmtArg(e.reason)]);
});

// ═══════════════════════════════════════════════════════════════
//  Helpers — Storage / Network / Globals / Eval
// ═══════════════════════════════════════════════════════════════
function _lsSnapshot(){
  const out=[];
  for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i);
    out.push({ k, v: localStorage.getItem(k) });
  }
  return out;
}
function _resSnapshot(limit=30){
  return performance.getEntriesByType('resource').slice(-limit).reverse().map(e=>({
    name: (e.name.split('/').pop() || e.name).split('?')[0],
    status: e.responseStatus || '—',
    size: e.transferSize || 0,
  }));
}
const WATCHED_GLOBALS = ['PIXI','Tone','React','ReactDOM','supa','upstashCmd','_startPlavsky','bbApplySparkle','SparkleSettingsCard','BgSettingsCard','DevIslandIcon'];
function _globalsSnapshot(){
  return WATCHED_GLOBALS.map(k=>({ k, ok: typeof window[k] !== 'undefined' }));
}
function _runEval(code){
  try{
    const fn = new Function('return (' + code + ')');
    return { ok:true, out:_fmtArg(fn()) };
  }catch(err){
    return { ok:false, out: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════
//  Icon SVG mặc định (không phụ thuộc learnsy-dev-icon.jsx)
// ═══════════════════════════════════════════════════════════════
function DevIcon({ size = 18, color = '#4ade80' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect
        x="3" y="5" width="18" height="14" rx="2"
        stroke={color} strokeWidth="1.8" strokeLinejoin="round"
        fill="rgba(0,0,0,0.25)"
      />
      <text
        x="6" y="14"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fontWeight="900"
        fontSize="9"
        fill={color}
        letterSpacing="-0.5"
      >&gt;_</text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Bộ icon SVG nhỏ dùng chung trong panel (thay thế mọi emoji/ký tự Unicode)
// ═══════════════════════════════════════════════════════════════
function CheckIcon({ size = 11, color = '#4ade80' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function XMarkIcon({ size = 11, color = '#f87171' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function SearchIcon({ size = 12, color = '#86efac' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function WrenchIcon({ size = 12, color = '#86efac' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a4 4 0 1 0-5.66 5.66L3 18l3 3 6.04-6.04a4 4 0 0 0 5.66-5.66l-2.83 2.83-2.12-2.12 2.95-2.87z" />
    </svg>
  );
}
function TrashIcon({ size = 12, color = '#f87171' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}
function RefreshIcon({ size = 12, color = '#86efac' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}
function CloseIcon({ size = 12, color = '#f87171' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function PlayIcon({ size = 11, color = '#04150c' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <polygon points="6 4 20 12 6 20" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Style injection — morph pill↔panel (spring giống ScoreIsland) + nhấp nháy
// ═══════════════════════════════════════════════════════════════
function _injectStyles(){
  const id='bb-di-styles';
  if(document.getElementById(id)) return;
  const s=document.createElement('style');
  s.id=id;
  s.textContent=`
    @keyframes bb-di-expand{
      0%  {width:40px;height:40px;border-radius:20px;opacity:.7;}
      55% {opacity:1;}
      100%{width:min(92vw,380px);height:min(70vh,460px);border-radius:24px;opacity:1;}
    }
    @keyframes bb-di-collapse{
      0%  {width:min(92vw,380px);height:min(70vh,460px);border-radius:24px;}
      100%{width:40px;height:40px;border-radius:20px;}
    }
    @keyframes bb-di-content-in{0%,35%{opacity:0;transform:scale(.94);}100%{opacity:1;transform:scale(1);}}
    @keyframes bb-blink{0%,100%{opacity:1;}50%{opacity:.32;}}
  `;
  document.head.appendChild(s);
}

// ═══════════════════════════════════════════════════════════════
//  UI phụ — 1 dòng key/value kiểu terminal
// ═══════════════════════════════════════════════════════════════
function Row({k,v,warn,plain,small}){
  const isBool = !plain && typeof v==='boolean';
  return (
    <div style={{display:'flex',justifyContent:'space-between',gap:8,marginBottom:5,fontSize:small?9:11}}>
      <span style={{opacity:.65,flexShrink:0}}>{k}</span>
      {isBool ? (
        <span style={{display:'inline-flex',alignItems:'center'}}>{v ? <CheckIcon/> : <XMarkIcon/>}</span>
      ) : (
        <span style={{color:warn?'#f87171':'#4ade80',textAlign:'right',wordBreak:'break-word'}}>{v}</span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Danh sách lệnh nhanh — kiểm tra & sửa lỗi, bấm chạy trực tiếp
// ═══════════════════════════════════════════════════════════════
const QUICK_COMMANDS = [
  {
    group: 'Kiểm tra',
    icon: SearchIcon,
    items: [
      { label:'PIXI có tồn tại?', run: ()=> `window.PIXI: ${typeof window.PIXI!=='undefined'?'Có':'Không có'}` },
      { label:'Plavsky đang chạy?', run: ()=>{
        const app = window._playskyApp && window._playskyApp();
        return app ? 'Đang chạy' : 'Không chạy';
      }},
      { label:'Service Worker đã đăng ký', run: async ()=>{
        if(!('serviceWorker' in navigator)) return 'Trình duyệt không hỗ trợ Service Worker';
        const rs = await navigator.serviceWorker.getRegistrations();
        return rs.length ? rs.map(r=>r.scope).join('\n') : 'Không có Service Worker nào';
      }},
      { label:'Cache Storage hiện có', run: async ()=>{
        if(!('caches' in window)) return 'Trình duyệt không hỗ trợ Cache Storage';
        const ks = await caches.keys();
        return ks.length ? ks.join('\n') : 'Không có cache nào';
      }},
      { label:'Trạng thái mạng', run: ()=> navigator.onLine ? 'Online' : 'Offline' },
      { label:'Toàn bộ key localStorage', run: ()=>{
        const n = localStorage.length;
        return n ? `${n} key: ` + Array.from({length:n},(_,i)=>localStorage.key(i)).join(', ') : 'Trống';
      }},
    ],
  },
  {
    group: 'Sửa lỗi',
    icon: WrenchIcon,
    items: [
      { label:'Gỡ Service Worker + tải lại', dangerous:true, run: async ()=>{
        if(!('serviceWorker' in navigator)) return 'Trình duyệt không hỗ trợ Service Worker';
        const rs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(rs.map(r=>r.unregister()));
        setTimeout(()=>location.reload(), 500);
        return `Đã gỡ ${rs.length} Service Worker, đang tải lại trang...`;
      }},
      { label:'Xoá Cache Storage', dangerous:true, run: async ()=>{
        if(!('caches' in window)) return 'Trình duyệt không hỗ trợ Cache Storage';
        const ks = await caches.keys();
        await Promise.all(ks.map(k=>caches.delete(k)));
        return `Đã xoá ${ks.length} cache. Nên tải lại trang.`;
      }},
      { label:'Khởi động lại Plavsky', run: ()=>{
        window._stopPlavsky && window._stopPlavsky();
        setTimeout(()=>window._startPlavsky && window._startPlavsky(), 300);
        return 'Đã gửi lệnh dừng + khởi động lại (chờ ~1.5s để thấy hạt).';
      }},
      { label:'Tải lại bỏ qua cache', run: ()=>{
        setTimeout(()=>{ location.href = location.pathname + '?_r=' + Date.now(); }, 400);
        return 'Đang tải lại với URL mới (bypass cache)...';
      }},
      { label:'Xoá toàn bộ localStorage', dangerous:true, run: ()=>{
        localStorage.clear();
        setTimeout(()=>location.reload(), 500);
        return 'Đã xoá toàn bộ localStorage, đang tải lại...';
      }},
    ],
  },
];

function CommandsTab(){
  const [results,setResults]     = useState({});
  const [confirming,setConfirming] = useState(null);
  const [running,setRunning]     = useState(null);

  async function execute(cmd,key){
    setRunning(key);
    try{
      const out = await cmd.run();
      setResults(r=>({...r,[key]:{ok:true,out:String(out)}}));
    }catch(err){
      setResults(r=>({...r,[key]:{ok:false,out:err.message}}));
    }
    setRunning(null);
    setConfirming(null);
  }
  function handleTap(cmd,key){
    if(cmd.dangerous && confirming!==key){ setConfirming(key); return; }
    execute(cmd,key);
  }

  return (
    <div>
      {QUICK_COMMANDS.map(group=>(
        <div key={group.group} style={{marginBottom:14}}>
          <div style={{display:'flex',alignItems:'center',gap:5,fontSize:10,fontWeight:800,color:'#86efac',letterSpacing:'.03em',marginBottom:6,textTransform:'uppercase'}}>
            {group.icon && <group.icon size={11} color="#86efac"/>}
            {group.group}
          </div>
          {group.items.map((cmd,i)=>{
            const key = group.group+i;
            const res = results[key];
            const isConfirming = confirming===key;
            return (
              <div key={key} style={{marginBottom:8,paddingBottom:8,borderBottom:'1px solid rgba(74,222,128,0.08)'}}>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{flex:1,fontSize:11}}>{cmd.label}</span>
                  {isConfirming && <span onClick={()=>setConfirming(null)} style={{fontSize:10,color:'#86efac',cursor:'pointer',flexShrink:0}}>huỷ</span>}
                  <span onClick={()=>handleTap(cmd,key)} style={{
                    fontSize:10,fontWeight:800,padding:'4px 10px',borderRadius:999,cursor:'pointer',flexShrink:0,
                    background:isConfirming?'#f87171':(cmd.dangerous?'transparent':'#4ade80'),
                    color:isConfirming?'#fff':(cmd.dangerous?'#f87171':'#04150c'),
                    border:(cmd.dangerous&&!isConfirming)?'1px solid rgba(248,113,113,0.4)':'none',
                  }}>
                    {running===key ? '...' : isConfirming ? 'Chắc chắn?' : 'Chạy'}
                  </span>
                </div>
                {res && (
                  <div style={{marginTop:5,padding:6,background:'rgba(0,0,0,0.3)',borderRadius:6,
                    color:res.ok?'#86efac':'#f87171',fontSize:10,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{res.out}</div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

const TABS=[
  {key:'overview',label:'Tổng quan'},
  {key:'commands',label:'Lệnh'},
  {key:'console', label:'Console'},
  {key:'storage', label:'Storage'},
  {key:'network', label:'Mạng'},
  {key:'globals', label:'Globals'},
  {key:'eval',    label:'Eval'},
];

// ═══════════════════════════════════════════════════════════════
//  DevIsland — component chính (pill nổi → panel tabs)
// ═══════════════════════════════════════════════════════════════
function DevIsland(){
  const [open,setOpen]     = useState(false);
  const [tab,setTab]       = useState('overview');
  const [,forceTick]       = useState(0);
  const [lsData,setLsData] = useState([]);
  const [netData,setNetData] = useState([]);
  const [evalCode,setEvalCode]     = useState('');
  const [evalResult,setEvalResult] = useState(null);
  const logEndRef = useRef(null);

  useEffect(()=>{
    _injectStyles();
    const sub=()=>forceTick(x=>x+1);
    _logSubs.push(sub);
    return ()=>{ _logSubs = _logSubs.filter(f=>f!==sub); };
  },[]);

  useEffect(()=>{
    if(open && tab==='console' && logEndRef.current){
      logEndRef.current.scrollIntoView({block:'end'});
    }
  },[open,tab,_logBuf.length]);

  function refreshStorage(){ setLsData(_lsSnapshot()); }
  function refreshNetwork(){ setNetData(_resSnapshot()); }

  function toggleOpen(){
    const next=!open;
    setOpen(next);
    if(next){ refreshStorage(); refreshNetwork(); }
  }
  function runEvalNow(){ setEvalResult(_runEval(evalCode)); }
  function clearLogs(){ _logBuf.length=0; forceTick(x=>x+1); }

  const errCount = _logBuf.filter(l=>l.type==='error').length;

  // Icon ưu tiên window.DevIslandIcon, nếu không dùng SVG mặc định
  const IconComponent = window.DevIslandIcon || DevIcon;
  const iconProps = (size, color) => window.DevIslandIcon
    ? { size, color }
    : { size, color };

  return (
    <div style={{
      position:'fixed',top:10,left:'50%',zIndex:999999,
      transform:'translateX(-50%)',
      background:'linear-gradient(160deg,rgba(6,10,8,0.97),rgba(4,14,10,0.97))',
      border:'1px solid rgba(74,222,128,0.28)',
      boxShadow:'0 8px 28px rgba(0,0,0,0.55), 0 0 18px rgba(74,222,128,0.12)',
      overflow:'hidden',display:'flex',flexDirection:'column',
      fontFamily:"ui-monospace,SFMono-Regular,Menlo,monospace",
      animation: open
        ? 'bb-di-expand .38s cubic-bezier(.34,1.15,.64,1) both'
        : 'bb-di-collapse .32s cubic-bezier(.55,0,.45,1) both',
    }}>
      {!open && (
        <div onClick={toggleOpen} style={{width:40,height:40,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',position:'relative'}}>
          <span style={{position:'absolute',top:5,right:5,width:6,height:6,borderRadius:'50%',
            background:errCount>0?'#f87171':'#4ade80',animation:'bb-blink 1.3s ease-in-out infinite'}}/>
          <IconComponent {...iconProps(18, '#4ade80')} />
        </div>
      )}

      {open && (
        <div style={{display:'flex',flexDirection:'column',width:'100%',height:'100%',animation:'bb-di-content-in .3s ease .1s both'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 12px',borderBottom:'1px solid rgba(74,222,128,0.15)',flexShrink:0}}>
            <IconComponent {...iconProps(16, '#4ade80')} />
            <span style={{color:'#4ade80',fontWeight:800,fontSize:12,letterSpacing:'.03em',animation:'bb-blink 1.6s ease-in-out infinite'}}>DEV ISLAND</span>
            <span style={{flex:1}}/>
            <span onClick={()=>{refreshStorage();refreshNetwork();}} style={{display:'inline-flex',alignItems:'center',cursor:'pointer',padding:'4px 7px',border:'1px solid rgba(74,222,128,0.3)',borderRadius:7}}><RefreshIcon size={11}/></span>
            <span onClick={toggleOpen} style={{display:'inline-flex',alignItems:'center',cursor:'pointer',padding:'4px 7px',border:'1px solid rgba(248,113,113,0.3)',borderRadius:7}}><CloseIcon size={11}/></span>
          </div>

          <div style={{display:'flex',gap:4,padding:'6px 8px',borderBottom:'1px solid rgba(74,222,128,0.1)',overflowX:'auto',flexShrink:0}}>
            {TABS.map(t=>(
              <span key={t.key} onClick={()=>setTab(t.key)} style={{
                fontSize:10,fontWeight:700,padding:'4px 9px',borderRadius:999,whiteSpace:'nowrap',cursor:'pointer',
                color:tab===t.key?'#04150c':'#86efac',
                background:tab===t.key?'#4ade80':'transparent',
                border:tab===t.key?'none':'1px solid rgba(74,222,128,0.25)',
              }}>{t.label}</span>
            ))}
          </div>

          <div style={{flex:1,overflowY:'auto',padding:'10px 12px',fontSize:11,color:'#d1fae5',lineHeight:1.6,WebkitOverflowScrolling:'touch'}}>
            {tab==='overview' && (
              <div>
                <Row k="PIXI"            v={typeof window.PIXI!=='undefined'}/>
                <Row k="Plavsky app"     v={!!(window._playskyApp && window._playskyApp())}/>
                <Row k="Sparkle ON"      v={window.bbGetSparkleOn ? window.bbGetSparkleOn() : '—'}/>
                <Row k="Mức hạt"         v={window._getPlayskyLevel ? window._getPlayskyLevel() : '—'}/>
                <Row k="Dark mode"       v={document.body.classList.contains('dark')}/>
                <Row k="Lỗi ghi nhận"    v={errCount} warn={errCount>0}/>
                <Row k="Viewport"        v={window.innerWidth+'×'+window.innerHeight} plain/>
                <Row k="URL"             v={location.href.replace(location.origin,'')} plain small/>
              </div>
            )}

            {tab==='commands' && <CommandsTab/>}

            {tab==='console' && (
              <div>
                {_logBuf.length===0 && <div style={{opacity:.5}}>Chưa có log nào.</div>}
                {_logBuf.map((l,i)=>(
                  <div key={i} style={{
                    color:l.type==='error'?'#f87171':l.type==='warn'?'#fbbf24':l.type==='info'?'#60a5fa':'#d1fae5',
                    marginBottom:4,wordBreak:'break-word',
                  }}>
                    <span style={{opacity:.5}}>{new Date(l.t).toLocaleTimeString('vi-VN')}</span> {l.msg}
                  </div>
                ))}
                <div ref={logEndRef}/>
                {_logBuf.length>0 && (
                  <div onClick={clearLogs} style={{marginTop:6,display:'inline-flex',alignItems:'center',gap:4,color:'#f87171',cursor:'pointer',fontSize:10}}>
                    <TrashIcon size={11}/> Xoá log
                  </div>
                )}
              </div>
            )}

            {tab==='storage' && (
              <div>
                {lsData.length===0 && <div style={{opacity:.5}}>Trống.</div>}
                {lsData.map(({k,v})=>(
                  <div key={k} style={{marginBottom:7,paddingBottom:7,borderBottom:'1px solid rgba(74,222,128,0.08)'}}>
                    <div style={{display:'flex',justifyContent:'space-between',gap:6}}>
                      <span style={{color:'#4ade80',fontWeight:700,wordBreak:'break-word'}}>{k}</span>
                      <span onClick={()=>{localStorage.removeItem(k);refreshStorage();}} style={{color:'#f87171',cursor:'pointer',fontSize:10,flexShrink:0}}>xoá</span>
                    </div>
                    <div style={{opacity:.75,wordBreak:'break-word'}}>{v}</div>
                  </div>
                ))}
              </div>
            )}

            {tab==='network' && (
              <div>
                {netData.length===0 && (
                  <div style={{opacity:.5,display:'flex',alignItems:'center',gap:4}}>
                    Chưa có dữ liệu — bấm <RefreshIcon size={10}/> để tải lại.
                  </div>
                )}
                {netData.map((r,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',gap:6,marginBottom:4}}>
                    <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{r.name}</span>
                    <span style={{color:(r.status>=400)?'#f87171':'#4ade80',flexShrink:0}}>{r.status}</span>
                    <span style={{opacity:.6,flexShrink:0}}>{(r.size/1024).toFixed(1)}kB</span>
                  </div>
                ))}
              </div>
            )}

            {tab==='globals' && (
              <div>
                {_globalsSnapshot().map(({k,ok})=>(<Row key={k} k={k} v={ok}/>))}
              </div>
            )}

            {tab==='eval' && (
              <div>
                <textarea value={evalCode} onChange={e=>setEvalCode(e.target.value)}
                  placeholder="vd: window.PIXI"
                  style={{width:'100%',minHeight:60,background:'rgba(74,222,128,0.06)',border:'1px solid rgba(74,222,128,0.25)',
                    borderRadius:8,color:'#d1fae5',fontFamily:'inherit',fontSize:11,padding:8,resize:'vertical',boxSizing:'border-box'}}/>
                <div onClick={runEvalNow} style={{marginTop:6,display:'inline-flex',alignItems:'center',gap:5,background:'#4ade80',color:'#04150c',
                  fontWeight:800,padding:'5px 14px',borderRadius:999,cursor:'pointer',fontSize:11}}>Chạy <PlayIcon size={10}/></div>
                {evalResult && (
                  <div style={{marginTop:8,padding:8,background:'rgba(0,0,0,0.3)',borderRadius:8,
                    color:evalResult.ok?'#4ade80':'#f87171',wordBreak:'break-word'}}>{evalResult.out}</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Mount/unmount độc lập với cây React chính — giống cách canvas Plavsky
//  gắn thẳng vào <body>, tồn tại xuyên suốt mọi tab điều hướng.
// ═══════════════════════════════════════════════════════════════
let _diRoot = null;
function _mountDevIsland(){
  if(_diRoot || !window.ReactDOM) return;
  let host = document.getElementById('bb-dev-island-host');
  if(!host){
    host = document.createElement('div');
    host.id = 'bb-dev-island-host';
    document.body.appendChild(host);
  }
  _diRoot = window.ReactDOM.createRoot(host);
  _diRoot.render(<DevIsland/>);
}
function _unmountDevIsland(){
  if(!_diRoot) return;
  _diRoot.unmount();
  _diRoot = null;
  const host = document.getElementById('bb-dev-island-host');
  if(host) host.remove();
}

let _devOn = localStorage.getItem('bb-devIslandOn') === '1'; // mặc định TẮT
if(_devOn) _mountDevIsland();

function setDevIslandOn(val){
  _devOn = val;
  localStorage.setItem('bb-devIslandOn', val ? '1' : '0');
  if(val) _mountDevIsland(); else _unmountDevIsland();
}
window.bbSetDevIslandOn = setDevIslandOn;
window.bbGetDevIslandOn = () => _devOn;

// ═══════════════════════════════════════════════════════════════
//  DevIslandSettingsCard — toggle trong TabSettings
// ═══════════════════════════════════════════════════════════════
function DevIslandSettingsCard({ dark }){
  const C = dark ? window._bbCD : window._bbCL;
  const [on,setOn] = useState(_devOn);
  if(!C) return null;

  function toggle(){
    const next=!on;
    setOn(next);
    setDevIslandOn(next);
  }

  // Icon ưu tiên window.DevIslandIcon, nếu không dùng SVG mặc định
  const IconComponent = window.DevIslandIcon || DevIcon;
  const iconProps = (size, color) => window.DevIslandIcon
    ? { size, color }
    : { size, color };

  return (
    <div style={{
      background:C.card, borderRadius:24, padding:'16px 18px',
      border:`1.5px solid ${on?'rgba(74,222,128,0.4)':'rgba(244,114,182,0.15)'}`,
      boxShadow:on?'0 4px 20px rgba(74,222,128,0.15)':'none',
      animation:'bb-fadeUp .38s ease both',
    }}>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <span style={{display:'inline-flex',flexShrink:0,color:on?'#4ade80':C.sub}}>
          <IconComponent {...iconProps(20, on ? '#4ade80' : C.sub)} />
        </span>
        <div style={{flex:1}}>
          <div style={{fontSize:14,fontWeight:700,color:C.fg,fontFamily:"'Baloo 2',cursive"}}>Dev Island</div>
          <div style={{fontSize:11,color:C.sub}}>Bảng chẩn đoán hệ thống nâng cao</div>
        </div>
        <div className="bb-toggle-track" onClick={toggle}
          style={{background:on?'linear-gradient(135deg,#4ade80,#22c55e)':'rgba(128,128,128,0.2)',
            boxShadow:on?'0 2px 12px rgba(74,222,128,0.5)':'none'}}>
          <div className="bb-toggle-thumb" style={{left:on?26:4}}>
            {on?(<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#22c55e" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>):''}
          </div>
        </div>
      </div>
      {on && (
        <div style={{marginTop:12,paddingTop:10,borderTop:`1px solid ${dark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.05)'}`,fontSize:11,color:C.sub}}>
          Chạm chấm tròn nổi ở đầu màn hình để mở bảng điều khiển.
        </div>
      )}
    </div>
  );
}

window.DevIslandSettingsCard = DevIslandSettingsCard;
window.DevIsland = DevIsland;
})();

/* ══ END OF LEARNSY-DEV-ISLAND.JSX ══ */
