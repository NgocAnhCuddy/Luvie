import React, {useState,useEffect,useCallback,useRef,useMemo} from 'react';

// ══════════════════════════════════════════════════════════════════════
//  LISTENING MANAGER v2 — trang độc lập, KHÔNG thuộc về bài học nào
//  Hiện ở tab riêng "Listening" cạnh "Bài học" / "Học sinh" trên trang chủ.
//  Dữ liệu lưu trong bảng Supabase riêng: listening_items
//  (không liên quan tới bảng lessons / mảng questions)
//
//  Cấu trúc 1 câu Listening (1 row trong bảng listening_items):
//    { id, text:'',          // đoạn văn để đọc — dùng ___ để đánh dấu chỗ trống
//      word_box:[],          // Word Box — các từ cho học sinh chọn
//      answers:[],           // đáp án đúng theo thứ tự (1),(2),(3)...
//      statements:[],        // [{statement, answer:'True'|'False'|'Not Mentioned'}]
//      shuffle_statements:bool, // [v3] true = tự tráo thứ tự nhận định T/F/NM mỗi lần học sinh làm
//      shuffle_word_box:bool,   // [v4] true = tự tráo thứ tự Word Box mỗi lần học sinh làm
//      sort_order:number,    // [v2] thứ tự sắp xếp
//      tags:[],              // [v2] nhãn phân loại
//      created_at }
//
//  SQL gợi ý để tạo / migrate bảng trên Supabase:
//    create table listening_items (
//      id text primary key,
//      text text,
//      word_box jsonb default '[]',
//      answers jsonb default '[]',
//      statements jsonb default '[]',
//      sort_order integer default 0,
//      tags jsonb default '[]',
//      created_at timestamptz default now()
//    );
//    -- migrate cột mới nếu bảng đã tồn tại:
//    alter table listening_items add column if not exists sort_order integer default 0;
//    alter table listening_items add column if not exists tags jsonb default '[]';
//    alter table listening_items add column if not exists shuffle_statements boolean default false;
//    alter table listening_items add column if not exists shuffle_word_box boolean default false;
//
//  Props nhận từ app.js:
//    dark, C            — theme
//    confirm_, toast_   — dùng chung toàn app
//
//  Load bằng: <script> qua loadModule, TRƯỚC admin/JS/app.js
// ══════════════════════════════════════════════════════════════════════
(function(){
  // ─────────────────────── UTILS ───────────────────────
  const stripHTML = s => (s||'').replace(/<[^>]*>/g,'');
  const cleanStr  = s => (s||'').replace(/[\u200B-\u200D\uFEFF\u00A0]/g,' ').replace(/[ \t]+/g,' ').trim();
  const genId     = () => 'id'+Date.now()+'_'+Math.random().toString(36).slice(2);
  const sleep     = ms => new Promise(r=>setTimeout(r,ms));

  // render text nhận định T/F/NM có hỗ trợ gạch chân: phần được bọc <u>...</u> sẽ hiển thị <u>
  const renderUnderline = str => {
    const text = str||'';
    const segs = text.split(/(<u>|<\/u>)/g);
    let underline = false, key = 0;
    const out = [];
    segs.forEach(seg=>{
      if(seg==='<u>'){ underline = true; return; }
      if(seg==='</u>'){ underline = false; return; }
      if(seg==='') return;
      out.push(underline ? <u key={key++}>{seg}</u> : <span key={key++}>{seg}</span>);
    });
    return out;
  };

  // làm sạch HTML gõ trong ô nhận định (contentEditable): chỉ giữ thẻ <u>, bỏ mọi thẻ/thuộc tính khác
  const sanitizeStmtHTML = html => {
    let s = html||'';
    s = s.replace(/<div[^>]*>/gi,'').replace(/<\/div>/gi,'').replace(/<br\s*\/?>/gi,''); // contentEditable hay chèn div/br khi Enter
    s = s.replace(/<u[^>]*>/gi,'<u>').replace(/<\/u\s*>/gi,'</u>'); // chuẩn hoá <u ...> -> <u>
    s = s.replace(/<(?!\/?u>)[^>]+>/gi,''); // xoá mọi thẻ khác không phải <u> hoặc </u>
    return s;
  };

  const ANS_COLORS = {
    'True':        {c:'#16a34a', bg:'rgba(22,163,74,.1)',   bd:'rgba(22,163,74,.35)',  label:'Đúng'},
    'False':       {c:'#dc2626', bg:'rgba(220,38,38,.08)',  bd:'rgba(220,38,38,.32)',  label:'Sai'},
    'Not Mentioned':{c:'#6366f1',bg:'rgba(99,102,241,.08)',bd:'rgba(99,102,241,.32)', label:'NM'},
  };

  // count blanks (___) trong văn bản
  const countBlanks = txt => ((txt||'').match(/_{3,}/g)||[]).length;

  // map DB row (snake_case) <-> UI item (camelCase)
  const fromRow = r => ({
    id: r.id,
    text: r.text||'',
    wordBox: r.word_box||[],
    answers: r.answers||[],
    statements: r.statements||[],
    shuffleStatements: !!r.shuffle_statements,
    shuffleWordBox: !!r.shuffle_word_box,    // [v4]
    sortOrder: r.sort_order ?? 0,
    tags: r.tags||[],
    created_at: r.created_at,
  });
  const toRow = it => {
    const wb = Array.isArray(it.wordBox)    ? it.wordBox    : (Array.isArray(it.word_box) ? it.word_box : []);
    const an = Array.isArray(it.answers)    ? it.answers    : [];
    const st = Array.isArray(it.statements) ? it.statements : [];
    const tg = Array.isArray(it.tags)       ? it.tags       : [];
    return {id:it.id, text:it.text, word_box:wb, answers:an, statements:st, shuffle_statements:!!it.shuffleStatements, shuffle_word_box:!!it.shuffleWordBox, sort_order:it.sortOrder??0, tags:tg};
  };

  // xáo trộn mảng (Fisher-Yates) — dùng để tráo thứ tự nhận định T/F/NM khi hiển thị cho học sinh
  const shuffleArr = arr => {
    const a = [...arr];
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  };


  // ─────────────────────── PREVIEW MODAL ───────────────────────
  function ListeningPreview({item, dark, C, onClose}){
    const [userAnswers, setUserAnswers] = useState({});
    const [stmtAnswers, setStmtAnswers] = useState({});
    const [checked, setChecked] = useState(false);
    const [ttsSpeed, setTtsSpeed] = useState(1);
    const [ttsSpeaking, setTtsSpeaking] = useState(false);
    const [wordBoxOrder, setWordBoxOrder] = useState(()=> item.shuffleWordBox ? shuffleArr(item.wordBox||[]) : (item.wordBox||[]));
    const reshuffleWordBox = () => setWordBoxOrder(prev=>{
      if(prev.length<=1) return prev;
      let next;
      do { next=shuffleArr(prev); } while(next.every((w,i)=>w===prev[i]));
      return next;
    });

    // nếu câu này bật "Tự tráo thứ tự" thì xáo 1 lần khi mở preview (giống cách học sinh sẽ thấy)
    const displayStatements = useMemo(()=>{
      const st = item.statements||[];
      return item.shuffleStatements ? shuffleArr(st) : st;
    },[]); // chỉ xáo 1 lần khi mở modal, không xáo lại mỗi lần render

    // build rendered text with inline inputs
    const parts = useMemo(()=>{
      const txt = item.text||'';
      const segs = txt.split(/(_{3,})/g);
      let idx=0;
      return segs.map((seg,i)=>{
        if(/_{3,}/.test(seg)){
          const ansIdx=idx++;
          return {type:'blank',idx:ansIdx};
        }
        return {type:'text',val:seg};
      });
    },[item.text]);

    const handleTTS = () => {
      if(!window.speechSynthesis) return;
      if(ttsSpeaking){ window.speechSynthesis.cancel(); setTtsSpeaking(false); return; }
      const plain = stripHTML(item.text).replace(/_{3,}/g,' blank ').replace(/\s+/g,' ').trim();
      const u = new SpeechSynthesisUtterance(plain);
      u.lang='en-US'; u.rate=ttsSpeed;
      u.onstart=()=>setTtsSpeaking(true);
      u.onend=()=>setTtsSpeaking(false);
      u.onerror=()=>setTtsSpeaking(false);
      window.speechSynthesis.speak(u);
    };

    const checkAnswers = () => setChecked(true);
    const resetPractice = () => { setUserAnswers({}); setStmtAnswers({}); setChecked(false); };

    const blankCorrect  = idx => cleanStr(userAnswers[idx]||'').toLowerCase() === cleanStr(item.answers[idx]||'').toLowerCase();
    const stmtCorrect   = (s,i) => (stmtAnswers[i]||'') === s.answer;
    const totalQ        = (item.answers||[]).length + displayStatements.length;
    const totalCorrect  = checked
      ? (item.answers||[]).filter((_,i)=>blankCorrect(i)).length
        + displayStatements.filter((s,i)=>stmtCorrect(s,i)).length
      : 0;

    const ovStyle = {
      position:'fixed',inset:0,zIndex:9999,
      background:'rgba(0,0,0,0.55)',backdropFilter:'blur(6px)',
      display:'flex',alignItems:'center',justifyContent:'center',padding:'12px',
    };
    const panelStyle = {
      width:'100%',maxWidth:560,maxHeight:'90vh',overflowY:'auto',
      borderRadius:24,padding:'18px 16px',
      background:dark?'#1A0B18':'#fff',
      border:`2px solid ${C.lav}`,
      boxShadow:'0 24px 60px rgba(0,0,0,.35)',
    };

    return(
      <div style={ovStyle} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
        <div style={panelStyle}>
          {/* header */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
            <div style={{display:'flex',alignItems:'center',gap:6,fontSize:14,fontWeight:900,color:C.lav}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              Xem trước — Giao diện học sinh
            </div>
            <button onClick={onClose} style={{width:28,height:28,borderRadius:99,border:`1.5px solid ${C.border2}`,background:C.bg2,color:C.text3,cursor:'pointer',fontSize:15,fontWeight:900,lineHeight:1,transition:'all .15s'}}
              onMouseEnter={e=>{e.currentTarget.style.background='rgba(239,68,68,0.1)';e.currentTarget.style.color='#ef4444';}}
              onMouseLeave={e=>{e.currentTarget.style.background=C.bg2;e.currentTarget.style.color=C.text3;}}
              onMouseDown={e=>e.currentTarget.style.transform='scale(0.88)'}
              onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}>×</button>
          </div>

          {/* TTS bar */}
          <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:12,padding:'8px 12px',borderRadius:12,background:C.lavPale,border:`1.5px solid ${C.border2}`}}>
            <button onClick={handleTTS}
              style={{display:'flex',alignItems:'center',gap:6,padding:'6px 14px',borderRadius:999,border:'none',background:ttsSpeaking?'#dc2626':C.lav,color:'#fff',fontSize:12,fontWeight:800,cursor:'pointer',transition:'all .15s'}}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 3px 10px rgba(0,0,0,0.2)';}}
              onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';}}
              onMouseDown={e=>e.currentTarget.style.transform='scale(0.95)'}
              onMouseUp={e=>e.currentTarget.style.transform='translateY(-1px)'}>
              {ttsSpeaking
                ? <><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="5" height="16"/><rect x="15" y="4" width="5" height="16"/></svg> Dừng</>
                : <><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Nghe</>}
            </button>
            <span style={{fontSize:11,color:C.text3,fontWeight:700}}>Tốc độ:</span>
            {[0.75,1,1.25,1.5].map(sp=>(
              <button key={sp} onClick={()=>setTtsSpeed(sp)}
                style={{padding:'3px 9px',borderRadius:99,border:`1.5px solid ${sp===ttsSpeed?C.lav:C.border2}`,background:sp===ttsSpeed?C.lavL:'transparent',color:sp===ttsSpeed?C.lav:C.text3,fontSize:11,fontWeight:800,cursor:'pointer',transition:'all .15s'}}
                onMouseEnter={e=>{if(sp!==ttsSpeed)e.currentTarget.style.background=C.lavPale;}}
                onMouseLeave={e=>{if(sp!==ttsSpeed)e.currentTarget.style.background='transparent';}}
                onMouseDown={e=>e.currentTarget.style.transform='scale(0.92)'}
                onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}>
                {sp}×
              </button>
            ))}
          </div>

          {/* reading text */}
          <div style={{marginBottom:14,padding:'12px 14px',borderRadius:12,background:dark?'#220F1E':'#F9F5FF',border:`1.5px solid ${C.border2}`,lineHeight:1.9,fontSize:13.5,color:C.text}}>
            {parts.map((p,i)=>{
              if(p.type==='text') return <span key={i}>{p.val}</span>;
              const ans  = userAnswers[p.idx]||'';
              const done = checked;
              const ok   = done && blankCorrect(p.idx);
              const bad  = done && !blankCorrect(p.idx);
              return(
                <span key={i} style={{display:'inline-block',verticalAlign:'middle',margin:'0 2px'}}>
                  <input
                    value={ans}
                    onChange={e=>!checked&&setUserAnswers(prev=>({...prev,[p.idx]:e.target.value}))}
                    style={{
                      width:90,padding:'2px 8px',borderRadius:8,textAlign:'center',fontWeight:800,fontSize:13,
                      border:`2px solid ${ok?'#16a34a':bad?'#dc2626':C.border2}`,
                      background:ok?'rgba(22,163,74,.12)':bad?'rgba(220,38,38,.08)':dark?'#2A1025':'#fff',
                      color:ok?'#16a34a':bad?'#dc2626':C.text,
                      outline:'none',fontFamily:'inherit',
                    }}
                    placeholder={`(${p.idx+1})`}
                    readOnly={checked}
                  />
                  {bad && <span style={{fontSize:10,color:'#dc2626',fontWeight:800,marginLeft:3}}>{item.answers[p.idx]}</span>}
                </span>
              );
            })}
          </div>

          {/* Word Box */}
          {(item.wordBox||[]).length>0 && (
            <div style={{marginBottom:12,padding:'10px 12px',borderRadius:12,background:'rgba(99,102,241,.07)',border:'1.5px solid rgba(99,102,241,.25)'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:5,marginBottom:7}}>
                <div style={{display:'flex',alignItems:'center',gap:5,fontSize:11,fontWeight:900,color:'#4338ca'}}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                  Word Box
                </div>
                {wordBoxOrder.length>1 && (
                  <button onClick={reshuffleWordBox} title="Tráo lại thứ tự các từ"
                    style={{display:'flex',alignItems:'center',gap:4,padding:'3px 9px',borderRadius:99,border:'1.5px solid rgba(99,102,241,.4)',background:'rgba(99,102,241,.1)',color:'#4338ca',fontSize:10.5,fontWeight:800,cursor:'pointer',flexShrink:0,transition:'all .15s'}}
                    onMouseEnter={e=>{e.currentTarget.style.background='rgba(99,102,241,.2)';e.currentTarget.style.transform='rotate(-8deg)';}}
                    onMouseLeave={e=>{e.currentTarget.style.background='rgba(99,102,241,.1)';e.currentTarget.style.transform='rotate(0deg)';}}
                    onMouseDown={e=>e.currentTarget.style.transform='scale(0.92)'}
                    onMouseUp={e=>e.currentTarget.style.transform='rotate(0deg)'}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
                    Tráo
                  </button>
                )}
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {wordBoxOrder.map((w,i)=>(
                  <span key={i} style={{fontSize:12,fontWeight:700,color:'#4338ca',background:'rgba(99,102,241,.13)',borderRadius:99,padding:'4px 11px'}}>
                    {w}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* T/F/NM statements */}
          {displayStatements.length>0 && (
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:900,color:'#dc2626',marginBottom:8}}>
                True / False / Not Mentioned
                {item.shuffleStatements && <span style={{marginLeft:6,fontWeight:700,color:'#b45309'}}>(đã tráo thứ tự)</span>}
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:7}}>
                {displayStatements.map((s,i)=>{
                  const sel   = stmtAnswers[i]||null;
                  const done  = checked;
                  const ok    = done && stmtCorrect(s,i);
                  const bad   = done && sel && !stmtCorrect(s,i);
                  return(
                    <div key={i} style={{padding:'8px 11px',borderRadius:10,background:dark?'rgba(255,255,255,.04)':'rgba(255,255,255,.7)',border:`1.5px solid ${ok?'#16a34a':bad?'#dc2626':C.border2}`}}>
                      <div style={{fontSize:12.5,fontWeight:700,color:C.text,marginBottom:7}}>{i+1}. {renderUnderline(s.statement)}</div>
                      <div style={{display:'flex',gap:6}}>
                        {Object.keys(ANS_COLORS).map(key=>{
                          const ac=ANS_COLORS[key]; const isSel=sel===key;
                          const highlight = done && key===s.answer;
                          return(
                            <button key={key} onClick={()=>!checked&&setStmtAnswers(prev=>({...prev,[i]:key}))}
                              style={{flex:1,padding:'5px 0',borderRadius:8,border:`1.5px solid ${highlight?ac.c:isSel?ac.c:ac.bd}`,background:highlight?ac.c:isSel?ac.c:ac.bg,color:(highlight||isSel)?'#fff':ac.c,fontSize:11,fontWeight:800,cursor:checked?'default':'pointer',transition:'all .15s'}}
                              onMouseEnter={e=>{if(!checked&&!isSel){e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow=`0 2px 8px ${ac.c}55`;}}}
                              onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';}}
                              onMouseDown={e=>{if(!checked)e.currentTarget.style.transform='scale(0.94)';}}
                              onMouseUp={e=>{if(!checked)e.currentTarget.style.transform='translateY(-1px)';}}>
                              {ac.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* score */}
          {checked && totalQ>0 && (
            <div style={{padding:'10px 14px',borderRadius:12,background:totalCorrect===totalQ?'rgba(22,163,74,.1)':'rgba(245,158,11,.1)',border:`1.5px solid ${totalCorrect===totalQ?'rgba(22,163,74,.35)':'rgba(245,158,11,.35)'}`,textAlign:'center',marginBottom:10}}>
              <span style={{fontSize:15,fontWeight:900,color:totalCorrect===totalQ?'#16a34a':'#d97706',display:'inline-flex',alignItems:'center',gap:6}}>
                {totalCorrect===totalQ
                  ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
                {totalCorrect}/{totalQ} câu đúng
              </span>
            </div>
          )}

          {/* action buttons */}
          <div style={{display:'flex',gap:8}}>
            {!checked
              ? <button onClick={checkAnswers} style={{flex:1,padding:'9px',borderRadius:999,border:'none',background:C.grad,color:'#fff',fontSize:13,fontWeight:900,cursor:'pointer',transition:'all .18s'}}
                  onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 4px 16px rgba(168,85,247,0.35)';}}
                  onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';}}
                  onMouseDown={e=>e.currentTarget.style.transform='scale(0.97)'}
                  onMouseUp={e=>e.currentTarget.style.transform='translateY(-1px)'}>Kiểm tra đáp án</button>
              : <button onClick={resetPractice} style={{flex:1,padding:'9px',borderRadius:999,border:`1.5px solid ${C.border2}`,background:C.bg2,color:C.text3,fontSize:13,fontWeight:800,cursor:'pointer',transition:'all .15s'}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=C.lav2;e.currentTarget.style.color=C.lav;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border2;e.currentTarget.style.color=C.text3;}}
                  onMouseDown={e=>e.currentTarget.style.transform='scale(0.97)'}
                  onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}>Làm lại</button>
            }
            <button onClick={onClose} style={{padding:'9px 16px',borderRadius:999,border:`1.5px solid ${C.border}`,background:'transparent',color:C.text3,fontSize:13,fontWeight:800,cursor:'pointer',transition:'all .15s'}}
              onMouseEnter={e=>e.currentTarget.style.background=C.bg2}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}
              onMouseDown={e=>e.currentTarget.style.transform='scale(0.96)'}
              onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}>Đóng</button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────── STATS PANEL ───────────────────────
  function StatsPanel({items, C, dark}){
    const totalBlanks = items.reduce((s,it)=>(it.answers||[]).length+s,0);
    const totalStmts  = items.reduce((s,it)=>(it.statements||[]).length+s,0);
    const totalWords  = items.reduce((s,it)=>(it.wordBox||[]).length+s,0);
    const withWB      = items.filter(it=>(it.wordBox||[]).length>0).length;
    const withTFNM    = items.filter(it=>(it.statements||[]).length>0).length;

    const stat=(label,val,color='#6366f1')=>(
      <div style={{flex:1,padding:'10px 12px',borderRadius:12,background:dark?'rgba(255,255,255,.04)':'#fff',border:`1.5px solid ${C.border2}`,textAlign:'center'}}>
        <div style={{fontSize:18,fontWeight:900,color}}>{val}</div>
        <div style={{fontSize:10,fontWeight:700,color:C.text3,marginTop:2,lineHeight:1.3}}>{label}</div>
      </div>
    );
    return(
      <div style={{padding:'12px 14px',borderRadius:18,background:C.lavPale,border:`1.5px solid ${C.border2}`,marginBottom:2}}>
        <div style={{display:'flex',alignItems:'center',gap:5,fontSize:11,fontWeight:900,color:C.lav,marginBottom:10}}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
          Thống kê
        </div>
        <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
          {stat('Tổng câu',   items.length,   C.lav)}
          {stat('Chỗ trống',  totalBlanks,    '#059669')}
          {stat('T/F/NM',     totalStmts,     '#dc2626')}
          {stat('Từ WB',      totalWords,     '#4338ca')}
          {stat('Có WB',      withWB,         '#7c3aed')}
          {stat('Có T/F',     withTFNM,       '#b45309')}
        </div>
      </div>
    );
  }

  // ─────────────────────── MAIN COMPONENT ───────────────────────
  function ListeningManager({dark, C, confirm_, toast_}){
    // ── State: list ──
    const [items,     setItems]     = useState([]);
    const [loading,   setLoading]   = useState(true);
    const [loadError, setLoadError] = useState(false);

    // ── State: UI mode ──
    const [tab, setTab]           = useState('list'); // 'list' | 'form' | 'stats'
    const [searchQ, setSearchQ]   = useState('');
    const [filterType, setFilter] = useState('all'); // 'all'|'has_wb'|'has_tfnm'|'no_wb'
    const [selected,  setSelected]= useState(new Set());
    const [bulkMode,  setBulkMode]= useState(false);
    const [previewItem, setPreviewItem] = useState(null);
    const [showImport,  setShowImport]  = useState(false);
    const [importJson,  setImportJson]  = useState('');
    const [importing,   setImporting]   = useState(false);
    const [sortBy, setSortBy]           = useState('order'); // 'order'|'created'|'blanks'

    // ── State: form ──
    const [editingId,   setEditingId]   = useState(null);
    const [text,        setText]        = useState('');
    const [wordBox,     setWordBox]     = useState([]);
    const [shuffleWordBox, setShuffleWordBox] = useState(false); // [v4] tự tráo Word Box cho học sinh
    const [wbInput,     setWbInput]     = useState('');
    const [answers,     setAnswers]     = useState([]);
    const [statements,  setStatements]  = useState([]);
    const [shuffleStatements, setShuffleStatements] = useState(false); // [v3] tự tráo thứ tự nhận định T/F/NM cho học sinh
    const [tags,        setTags]        = useState([]);
    const [tagInput,    setTagInput]    = useState('');
    const [saving,      setSaving]      = useState(false);
    const [ttsSpeed,    setTtsSpeed]    = useState(1);
    const [ttsSpeaking, setTtsSpeaking] = useState(false);

    const formRef    = useRef(null);
    const wbInputRef = useRef(null);
    const tagInputRef= useRef(null);
    const stmtInputRefs = useRef({}); // {[statementId]: <input> element} — để biết phần text đang bôi đen khi gạch chân
    const savingRef  = useRef(false); // chống bấm Lưu nhiều lần liên tiếp (đồng bộ, không chờ re-render)

    // ── Load ──
    useEffect(()=>{
      const supa = window.supa;
      if(!supa){ setLoading(false); setLoadError(true); return; }
      supa.from('listening_items').select('*').order('sort_order').order('created_at').then(({data,error})=>{
        if(error){ console.error('Listening load error:',error); setLoadError(true); }
        else setItems((data||[]).map(fromRow));
        setLoading(false);
      });
    },[]);

    // ── Cleanup TTS on unmount ──
    useEffect(()=>{ return()=>{ try{ window.speechSynthesis?.cancel(); }catch(_){} }; },[]);

    // ── Reset form ──
    const resetForm = useCallback(()=>{
      setEditingId(null); setText(''); setWordBox([]); setWbInput(''); setShuffleWordBox(false);
      setAnswers([]); setStatements([]); setShuffleStatements(false); setTags([]); setTagInput('');
    },[]);

    const openForm = useCallback((it=null)=>{
      if(it){
        setEditingId(it.id);
        setText(it.text||'');
        setWordBox(Array.isArray(it.wordBox)?it.wordBox.map(w=>({id:genId(),val:w})):[]);
        setAnswers(Array.isArray(it.answers)?it.answers.map((a,i)=>({id:i+'_'+Date.now(),val:a})):[]);
        setStatements(Array.isArray(it.statements)?it.statements.map((s,i)=>({...s,id:i+'_'+Date.now()})):[]);
        setShuffleStatements(!!it.shuffleStatements);
        setShuffleWordBox(!!it.shuffleWordBox);
        setTags(Array.isArray(it.tags)?[...it.tags]:[]);
      } else {
        resetForm();
      }
      setWbInput(''); setTagInput('');
      setTab('form');
      setTimeout(()=>{ formRef.current?.scrollIntoView({behavior:'smooth',block:'start'}); },60);
    },[resetForm]);

    // ── Word Box ──
    const addWord = useCallback(()=>{
      const w = wbInput.trim();
      if(!w) return;
      if(wordBox.some(x=>x.val.toLowerCase()===w.toLowerCase())){
        toast_&&toast_('! Từ này đã có trong Word Box'); return;
      }
      setWordBox(p=>[...p,{id:genId(),val:w}]);
      setWbInput('');
      setTimeout(()=>{ wbInputRef.current?.focus(); },0);
    },[wbInput,wordBox,toast_]);

    const removeWord   = id => setWordBox(p=>p.filter(x=>x.id!==id));
    const updateWord    = (id,val) => setWordBox(p=>p.map(x=>x.id===id?{...x,val}:x));

    // ── Answers ──
    const addAnswer    = ()       => setAnswers(p=>[...p,{id:genId(),val:''}]);
    const updateAnswer = (id,v)   => setAnswers(p=>p.map(a=>a.id===id?{...a,val:v}:a));
    const removeAnswer = id       => setAnswers(p=>p.filter(a=>a.id!==id));

    // Auto-detect blanks from text and sync answer slots
    const syncBlanksFromText = useCallback(()=>{
      const n = countBlanks(text);
      if(n===0){ toast_&&toast_('! Không tìm thấy ___ trong văn bản'); return; }
      setAnswers(prev=>{
        const next = [];
        for(let i=0;i<n;i++) next.push({id:genId(), val: prev[i]?.val||''});
        return next;
      });
      toast_&&toast_(`✓ Đồng bộ ${n} chỗ trống từ văn bản`);
    },[text,toast_]);

    // Suggest Word Box from answers
    const suggestWBFromAnswers = useCallback(()=>{
      const newWords = answers.map(a=>a.val.trim()).filter(Boolean);
      if(!newWords.length){ toast_&&toast_('! Chưa có đáp án nào'); return; }
      let added=0;
      setWordBox(prev=>{
        const next=[...prev];
        for(const w of newWords){
          if(!next.some(x=>x.val.toLowerCase()===w.toLowerCase())){
            next.push({id:genId(),val:w}); added++;
          }
        }
        return next;
      });
      toast_&&toast_(added?`✓ Đã thêm ${added} từ vào Word Box`:'! Tất cả đáp án đã có trong Word Box');
    },[answers,toast_]);

    // ── Statements ──
    const addStatement    = ()          => setStatements(p=>[...p,{id:genId(),statement:'',answer:'True'}]);
    const updateStatement = (id,fld,v)  => setStatements(p=>p.map(s=>s.id===id?{...s,[fld]:v}:s));
    const removeStatement = id          => setStatements(p=>p.filter(s=>s.id!==id));
    // đảo thứ tự câu nhận định: dir=-1 lên, dir=1 xuống
    const moveStatement    = (id,dir)   => setStatements(p=>{
      const i = p.findIndex(s=>s.id===id);
      const j = i+dir;
      if(i<0||j<0||j>=p.length) return p;
      const next=[...p];
      [next[i],next[j]]=[next[j],next[i]];
      return next;
    });
    // gạch chân phần text đang được bôi đen trong ô nhận định (dùng execCommand cho div contentEditable)
    const toggleUnderlineStatement = id => {
      const el = stmtInputRefs.current[id];
      if(!el) return;
      const sel = window.getSelection&&window.getSelection();
      const hasSelInside = sel && sel.rangeCount>0 && !sel.isCollapsed && el.contains(sel.anchorNode) && el.contains(sel.focusNode);
      if(!hasSelInside){ toast_&&toast_('! Hãy bôi đen phần chữ cần gạch chân trước'); el.focus(); return; }
      try{ document.execCommand('styleWithCSS', false, false); }catch(_){}
      document.execCommand('underline');
      updateStatement(id,'statement', sanitizeStmtHTML(el.innerHTML));
    };

    // ── Tags ──
    const addTag = ()=>{
      const t=tagInput.trim();
      if(!t||tags.includes(t)) return;
      setTags(p=>[...p,t]); setTagInput('');
      setTimeout(()=>tagInputRef.current?.focus(),0);
    };
    const removeTag = t => setTags(p=>p.filter(x=>x!==t));

    // ── TTS ──
    const handleTTS = useCallback((raw)=>{
      if(!raw||!raw.trim()) return;
      if(!window.speechSynthesis){ toast_&&toast_('! Trình duyệt không hỗ trợ TTS'); return; }
      try{
        if(ttsSpeaking){ window.speechSynthesis.cancel(); setTtsSpeaking(false); return; }
        window.speechSynthesis.cancel();
        const plain=stripHTML(raw).replace(/_{3,}/g,' blank ').replace(/\s+/g,' ').trim();
        const u=new SpeechSynthesisUtterance(plain);
        u.lang='en-US'; u.rate=ttsSpeed;
        u.onstart=()=>setTtsSpeaking(true);
        u.onend=()=>setTtsSpeaking(false);
        u.onerror=()=>setTtsSpeaking(false);
        window.speechSynthesis.speak(u);
      }catch(e){}
    },[ttsSpeed,ttsSpeaking,toast_]);

    // ── Save ──
    const save = useCallback(async()=>{
      if(savingRef.current||saving) return; // chống bấm Lưu nhiều lần liên tiếp
      if(!text.trim()){ toast_&&toast_('! Nhập đoạn văn để đọc trước!'); return; }
      const supa=window.supa;
      if(!supa){ toast_&&toast_('x Chưa kết nối Supabase!'); return; }

      const cleanText       = cleanStr(text);
      const cleanWordBox    = wordBox.map(w=>cleanStr(w.val)).filter(Boolean);
      const cleanAnswers    = answers.map(a=>cleanStr(a.val)).filter(Boolean);
      const cleanStatements = statements
        .filter(s=>s.statement&&s.statement.trim())
        .map(({id:_,...rest})=>({...rest,statement:cleanStr(rest.statement),answer:cleanStr(rest.answer)}));
      const cleanTags       = tags.filter(Boolean);

      // Chống trùng tên: ở đây "tên" chính là nội dung đoạn văn (text) — so sánh
      // không phân biệt hoa/thường và khoảng trắng, bỏ qua chính item đang sửa.
      const normText = cleanText.toLowerCase();
      const dup = items.find(it=>it.id!==editingId && cleanStr(it.text||'').toLowerCase()===normText);
      if(dup){
        toast_&&toast_('x Đã có câu Listening khác với nội dung giống y hệt!',4500);
        return;
      }

      const blankCount = countBlanks(cleanText);

      const doSave = async()=>{
        if(savingRef.current) return; // khóa lần thứ 2
        savingRef.current = true;
        setSaving(true);
        try{
          if(editingId){
            const payload={text:cleanText,wordBox:cleanWordBox,answers:cleanAnswers,statements:cleanStatements,shuffleStatements,shuffleWordBox,tags:cleanTags};
            const {error}=await supa.from('listening_items').update(toRow({id:editingId,...payload})).eq('id',editingId);
            if(error) throw error;
            setItems(p=>p.map(it=>it.id===editingId?{...it,...payload}:it));
            toast_&&toast_('+ Đã cập nhật câu Listening!');
          } else {
            const sortMax = items.reduce((m,it)=>Math.max(m,it.sortOrder||0),0);
            const newItem={id:'ls'+Date.now()+Math.random(),text:cleanText,wordBox:cleanWordBox,answers:cleanAnswers,statements:cleanStatements,shuffleStatements,shuffleWordBox,tags:cleanTags,sortOrder:sortMax+1};
            const {error}=await supa.from('listening_items').insert(toRow(newItem));
            if(error) throw error;
            setItems(p=>[...p,newItem]);
            toast_&&toast_('+ Đã thêm câu Listening!');
          }
          resetForm(); setTab('list');
        }catch(e){
          console.error('Listening save error:',e);
          toast_&&toast_('x Lưu thất bại: '+(e.message||''),5000);
        }finally{
          savingRef.current = false;
          setSaving(false);
        }
      };

      if(blankCount>0 && blankCount!==cleanAnswers.length){
        if(confirm_){
          confirm_({
            iconType:'warn', title:'Số chỗ trống không khớp',
            message:`Văn bản có <b>${blankCount} chỗ trống (___)</b> nhưng bạn nhập <b>${cleanAnswers.length} đáp án</b>.<br/><span style="color:#A07090">Vẫn tiếp tục lưu?</span>`,
            confirmLabel:'Lưu anyway', confirmColor:'#f59e0b',
            onConfirm:doSave,
          });
        } else doSave();
        return;
      }
      doSave();
    },[text,wordBox,answers,statements,shuffleStatements,shuffleWordBox,tags,editingId,items,saving,toast_,confirm_,resetForm]);

    // ── Remove ──
    const remove = useCallback(async(id)=>{
      const supa=window.supa;
      if(supa){
        const {error}=await supa.from('listening_items').delete().eq('id',id);
        if(error){ toast_&&toast_('x Xoá thất bại: '+error.message,5000); return; }
      }
      setItems(p=>p.filter(it=>it.id!==id));
      setSelected(prev=>{ const s=new Set(prev); s.delete(id); return s; });
      if(editingId===id){ resetForm(); setTab('list'); }
      toast_&&toast_('Đã xoá câu Listening');
    },[editingId,resetForm,toast_]);

    const askRemove = it=>{
      const _t=stripHTML(it.text)||'câu này';
      if(confirm_){
        confirm_({iconType:'delete',title:'Xoá câu Listening?',
          message:'<b>'+_t.slice(0,60)+'</b><br/><span style="color:#A07090">Sẽ bị xoá vĩnh viễn.</span>',
          confirmLabel:'Xoá',confirmColor:'#EF4444',
          onConfirm:()=>remove(it.id),
        });
      } else remove(it.id);
    };

    // ── Bulk delete ──
    const bulkDelete = useCallback(()=>{
      if(!selected.size) return;
      const ids=[...selected];
      if(confirm_){
        confirm_({iconType:'delete',title:`Xoá ${ids.length} câu Listening?`,
          message:`<b>${ids.length} câu</b> sẽ bị xoá vĩnh viễn.<br/><span style="color:#A07090">Không thể hoàn tác.</span>`,
          confirmLabel:'Xoá tất cả',confirmColor:'#EF4444',
          onConfirm:async()=>{
            const supa=window.supa;
            if(supa){ await supa.from('listening_items').delete().in('id',ids); }
            setItems(p=>p.filter(it=>!ids.includes(it.id)));
            setSelected(new Set()); setBulkMode(false);
            toast_&&toast_(`Đã xoá ${ids.length} câu`);
          },
        });
      }
    },[selected,confirm_,toast_]);

    // ── Duplicate ──
    const duplicate = useCallback(async(it)=>{
      const supa=window.supa;
      const sortMax=items.reduce((m,x)=>Math.max(m,x.sortOrder||0),0);
      const newItem={...it, id:'ls'+Date.now()+Math.random(), sortOrder:sortMax+1, created_at:new Date().toISOString()};
      if(supa){
        const {error}=await supa.from('listening_items').insert(toRow(newItem));
        if(error){ toast_&&toast_('x Nhân đôi thất bại: '+error.message,5000); return; }
      }
      setItems(p=>[...p,newItem]);
      toast_&&toast_('✓ Đã nhân đôi câu Listening');
    },[items,toast_]);

    // ── Drag & drop reorder ──
    const [dragId, setDragId] = useState(null);
    const [overId, setOverId] = useState(null);
    const persistOrder = useCallback(async(next)=>{
      next.forEach((it,i)=>{ it.sortOrder=i; });
      setItems([...next]);
      const supa=window.supa;
      if(supa){
        await Promise.all(next.map((it,i)=>
          supa.from('listening_items').update({sort_order:i}).eq('id',it.id)
        ));
      }
    },[]);
    const reorderTo = useCallback((srcId,targetId)=>{
      if(srcId===targetId) return;
      const next=[...items];
      const srcIdx=next.findIndex(it=>it.id===srcId);
      const tgtIdx=next.findIndex(it=>it.id===targetId);
      if(srcIdx<0||tgtIdx<0) return;
      const [moved]=next.splice(srcIdx,1);
      next.splice(tgtIdx,0,moved);
      persistOrder(next);
    },[items,persistOrder]);

    // ── Export JSON ──
    const exportJSON = ()=>{
      const data=JSON.stringify(items.map(toRow),null,2);
      const blob=new Blob([data],{type:'application/json'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a'); a.href=url;
      a.download=`listening_items_${new Date().toISOString().slice(0,10)}.json`;
      a.click(); URL.revokeObjectURL(url);
      toast_&&toast_('✓ Đã xuất file JSON');
    };

    // ── Import JSON ──
    const doImport = useCallback(async()=>{
      let parsed;
      try{ parsed=JSON.parse(importJson); }
      catch(e){ toast_&&toast_('x JSON không hợp lệ: '+e.message,5000); return; }
      if(!Array.isArray(parsed)){ toast_&&toast_('x Phải là mảng JSON []',5000); return; }
      setImporting(true);
      const supa=window.supa;
      const sortBase=items.reduce((m,it)=>Math.max(m,it.sortOrder||0),0);
      const toInsert=parsed.map((r,i)=>({
        ...r,
        id: r.id||('imp'+Date.now()+i),
        sort_order: (r.sort_order??sortBase+i+1),
      }));
      try{
        if(supa){
          const {error}=await supa.from('listening_items').upsert(toInsert);
          if(error) throw error;
        }
        const {data}=supa
          ? await supa.from('listening_items').select('*').order('sort_order').order('created_at')
          : {data:toInsert};
        setItems((data||toInsert).map(fromRow));
        toast_&&toast_(`✓ Đã import ${toInsert.length} câu`);
        setImportJson(''); setShowImport(false);
      }catch(e){
        toast_&&toast_('x Import thất bại: '+e.message,5000);
      }finally{
        setImporting(false);
      }
    },[importJson,items,toast_]);

    // ── Filtered + sorted list ──
    const displayItems = useMemo(()=>{
      let list=[...items];
      // filter type
      if(filterType==='has_wb')   list=list.filter(it=>(it.wordBox||[]).length>0);
      if(filterType==='has_tfnm') list=list.filter(it=>(it.statements||[]).length>0);
      if(filterType==='no_wb')    list=list.filter(it=>!(it.wordBox||[]).length);
      // search
      if(searchQ.trim()){
        const q=searchQ.toLowerCase();
        list=list.filter(it=>
          (it.text||'').toLowerCase().includes(q)||
          (it.tags||[]).some(t=>t.toLowerCase().includes(q))||
          (it.answers||[]).some(a=>(a+'').toLowerCase().includes(q))
        );
      }
      // sort
      if(sortBy==='blanks')  list.sort((a,b)=>(b.answers||[]).length-(a.answers||[]).length);
      else if(sortBy==='created') list.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
      // default: sort_order already from DB
      return list;
    },[items,filterType,searchQ,sortBy]);

    // ── STYLES ──
    const inputStyle = {
      width:'100%',padding:'9px 11px',borderRadius:10,
      border:`1.5px solid ${C.border2}`,
      background:dark?'#180A10':'#fff',
      color:C.text,fontSize:13,fontFamily:'inherit',outline:'none',
      boxSizing:'border-box',
    };
    const btnBase = (color='#6366f1',bg='rgba(99,102,241,.1)')=>({
      padding:'5px 12px',borderRadius:8,border:`1.5px solid ${color}44`,
      background:bg,color:color,fontSize:11,fontWeight:800,cursor:'pointer',
      transition:'all .15s',
    });
    const iconBtn = (color=C.text3)=>({
      width:26,height:26,borderRadius:8,border:`1.5px solid ${C.border2}`,
      background:C.bg2,color,cursor:'pointer',display:'flex',alignItems:'center',
      justifyContent:'center',flexShrink:0,transition:'all .15s',
    });
    // hover/press handlers cho các nút dùng btnBase/iconBtn — nhấc nhẹ khi hover, thu nhỏ khi bấm
    const liftHover = e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.filter='brightness(1.08)';};
    const liftLeave = e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.filter='none';};
    const pressDown = e=>e.currentTarget.style.transform='scale(0.92)';
    const pressUp   = e=>e.currentTarget.style.transform='translateY(-1px)';

    // ─── RENDER ───
    return(
      <div style={{padding:'16px 12px 100px',display:'flex',flexDirection:'column',gap:14}} className="fade-up">

        {/* ── Header ── */}
        <div style={{display:'flex',alignItems:'center',gap:10,paddingBottom:12,borderBottom:`2px solid ${C.border}`}}>
          <div style={{width:38,height:38,borderRadius:11,background:C.lavL,border:`1.5px solid ${C.border2}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={C.lav} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 18v-6a9 9 0 0118 0v6"/>
              <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z"/>
            </svg>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:18,fontWeight:900,color:C.text,lineHeight:1.2}}>Listening</div>
            <div style={{fontSize:12,color:C.text3,marginTop:2}}>{items.length} câu · Đoạn văn + Điền từ + True/False/NM</div>
          </div>
          {/* action buttons */}
          <div style={{display:'flex',gap:6,flexShrink:0}}>
            <button onClick={()=>setTab(tab==='stats'?'list':'stats')} title="Thống kê"
              style={{...iconBtn(C.lav),background:tab==='stats'?C.lavL:C.bg2}}
              onMouseEnter={liftHover} onMouseLeave={liftLeave} onMouseDown={pressDown} onMouseUp={pressUp}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="12" width="4" height="9"/><rect x="10" y="7" width="4" height="14"/><rect x="17" y="2" width="4" height="19"/></svg>
            </button>
            <button onClick={exportJSON} title="Xuất JSON"
              style={iconBtn('#059669')}
              onMouseEnter={liftHover} onMouseLeave={liftLeave} onMouseDown={pressDown} onMouseUp={pressUp}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
            <button onClick={()=>setShowImport(v=>!v)} title="Import JSON"
              style={{...iconBtn('#d97706'),background:showImport?'rgba(217,119,6,.12)':C.bg2}}
              onMouseEnter={liftHover} onMouseLeave={liftLeave} onMouseDown={pressDown} onMouseUp={pressUp}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </button>
            <button onClick={()=>{resetForm();setTab(tab==='form'?'list':'form');}} title="Thêm câu mới"
              style={{padding:'6px 12px',borderRadius:999,border:'none',background:C.grad,color:'#fff',fontSize:11.5,fontWeight:900,cursor:'pointer',display:'flex',alignItems:'center',gap:5,transition:'all .18s'}}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 4px 14px rgba(168,85,247,0.35)';}}
              onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';}}
              onMouseDown={e=>e.currentTarget.style.transform='scale(0.94)'}
              onMouseUp={e=>e.currentTarget.style.transform='translateY(-1px)'}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4v16M4 12h16"/></svg>
              Thêm
            </button>
          </div>
        </div>

        {/* ── Error ── */}
        {loadError && (
          <div style={{padding:'10px 14px',borderRadius:12,background:'rgba(220,38,38,.08)',border:'1.5px solid rgba(220,38,38,.25)',color:'#dc2626',fontSize:12.5,fontWeight:700}}>
            Không tải được dữ liệu Listening — kiểm tra bảng <code>listening_items</code> đã tạo trên Supabase chưa.
          </div>
        )}

        {/* ── Stats tab ── */}
        {tab==='stats' && <StatsPanel items={items} C={C} dark={dark}/>}

        {/* ── Import panel ── */}
        {showImport && (
          <div style={{padding:'12px 14px',borderRadius:18,border:'1.5px solid rgba(217,119,6,.3)',background:'rgba(217,119,6,.06)'}}>
            <div style={{display:'flex',alignItems:'center',gap:5,fontSize:11,fontWeight:900,color:'#d97706',marginBottom:8}}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Import JSON
            </div>
            <textarea value={importJson} onChange={e=>setImportJson(e.target.value)}
              rows={4} placeholder='Dán JSON mảng [...] vào đây'
              style={{...inputStyle,fontFamily:'monospace',fontSize:11,resize:'vertical'}}/>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button onClick={doImport} disabled={importing||!importJson.trim()}
                style={{padding:'7px 16px',borderRadius:999,border:'none',background:'#d97706',color:'#fff',fontSize:12,fontWeight:900,cursor:'pointer',opacity:importing?0.7:1,transition:'all .15s'}}
                onMouseEnter={e=>{if(!importing&&importJson.trim()){e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 3px 12px rgba(217,119,6,0.4)';}}}
                onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';}}
                onMouseDown={e=>{if(!importing&&importJson.trim())e.currentTarget.style.transform='scale(0.95)';}}
                onMouseUp={e=>{if(!importing&&importJson.trim())e.currentTarget.style.transform='translateY(-1px)';}}>
                {importing?'Đang import...':'Import'}
              </button>
              <button onClick={()=>{setShowImport(false);setImportJson('');}}
                style={{padding:'7px 14px',borderRadius:999,border:`1.5px solid ${C.border}`,background:'transparent',color:C.text3,fontSize:12,fontWeight:800,cursor:'pointer',transition:'all .15s'}}
                onMouseEnter={e=>e.currentTarget.style.background=C.bg2}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                onMouseDown={e=>e.currentTarget.style.transform='scale(0.95)'}
                onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}>
                Hủy
              </button>
            </div>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div style={{textAlign:'center',padding:'30px 10px',color:C.text3,fontSize:13,fontWeight:700}}>Đang tải...</div>
        )}

        {/* ── LIST tab ── */}
        {!loading && tab!=='form' && (
          <>
            {/* search + filter row */}
            {items.length>0 && (
              <div style={{display:'flex',gap:7,flexWrap:'wrap',alignItems:'center'}}>
                <div style={{flex:1,minWidth:140,position:'relative'}}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.text4} strokeWidth="2.2" style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)'}}>
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Tìm câu..."
                    style={{...inputStyle,paddingLeft:28}}/>
                </div>
                <select value={filterType} onChange={e=>setFilter(e.target.value)}
                  style={{...inputStyle,width:'auto',paddingLeft:8}}>
                  <option value="all">Tất cả</option>
                  <option value="has_wb">Có Word Box</option>
                  <option value="has_tfnm">Có T/F/NM</option>
                  <option value="no_wb">Không có WB</option>
                </select>
                <select value={sortBy} onChange={e=>setSortBy(e.target.value)}
                  style={{...inputStyle,width:'auto',paddingLeft:8}}>
                  <option value="order">Thứ tự</option>
                  <option value="created">Mới nhất</option>
                  <option value="blanks">Nhiều chỗ trống</option>
                </select>
                <button onClick={()=>setBulkMode(v=>!v)}
                  style={{...btnBase(bulkMode?'#dc2626':'#6366f1', bulkMode?'rgba(220,38,38,.08)':'rgba(99,102,241,.08)'),whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:5}}
                  onMouseEnter={liftHover} onMouseLeave={liftLeave} onMouseDown={pressDown} onMouseUp={pressUp}>
                  {bulkMode
                    ? <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Thoát</>
                    : <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg> Chọn nhiều</>}
                </button>
              </div>
            )}

            {/* bulk action bar */}
            {bulkMode && (
              <div style={{display:'flex',gap:8,alignItems:'center',padding:'8px 12px',borderRadius:12,background:'rgba(220,38,38,.06)',border:'1.5px solid rgba(220,38,38,.2)'}}>
                <span style={{fontSize:12,fontWeight:800,color:'#dc2626',flex:1}}>
                  {selected.size>0 ? `Đã chọn ${selected.size} câu` : 'Chọn câu để xoá hàng loạt'}
                </span>
                {selected.size>0 && (
                  <>
                    <button onClick={()=>setSelected(new Set(displayItems.map(it=>it.id)))}
                      style={btnBase('#6366f1')} onMouseEnter={liftHover} onMouseLeave={liftLeave} onMouseDown={pressDown} onMouseUp={pressUp}>Chọn tất cả ({displayItems.length})</button>
                    <button onClick={()=>setSelected(new Set())}
                      style={btnBase('#6b7280','rgba(107,114,128,.08)')} onMouseEnter={liftHover} onMouseLeave={liftLeave} onMouseDown={pressDown} onMouseUp={pressUp}>Bỏ chọn</button>
                    <button onClick={bulkDelete}
                      style={{...btnBase('#dc2626','rgba(220,38,38,.1)'),fontWeight:900,display:'flex',alignItems:'center',gap:5}}
                      onMouseEnter={liftHover} onMouseLeave={liftLeave} onMouseDown={pressDown} onMouseUp={pressUp}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                      Xoá {selected.size}
                    </button>
                  </>
                )}
                {selected.size===0 && (
                  <button onClick={()=>setSelected(new Set(displayItems.map(it=>it.id)))}
                    style={btnBase('#6366f1')} onMouseEnter={liftHover} onMouseLeave={liftLeave} onMouseDown={pressDown} onMouseUp={pressUp}>Chọn tất cả</button>
                )}
              </div>
            )}

            {/* empty state */}
            {items.length===0 && (
              <div style={{textAlign:'center',padding:'28px 10px',color:C.text3,fontSize:12.5,fontWeight:700,borderRadius:22,border:`1.5px solid ${C.border}`}}>
                Chưa có câu Listening nào.<br/>
                <button onClick={()=>{resetForm();setTab('form');}} style={{marginTop:10,...btnBase(C.lav,C.lavL)}}
                  onMouseEnter={liftHover} onMouseLeave={liftLeave} onMouseDown={pressDown} onMouseUp={pressUp}>+ Thêm câu đầu tiên</button>
              </div>
            )}

            {/* no results */}
            {items.length>0 && displayItems.length===0 && (
              <div style={{textAlign:'center',padding:'18px',color:C.text3,fontSize:12.5,fontWeight:700,borderRadius:22,border:`1.5px solid ${C.border}`}}>
                Không tìm thấy câu nào khớp với bộ lọc.
              </div>
            )}

            {/* item cards */}
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {displayItems.map((it,idx)=>(
                <div key={it.id!=null&&it.id!==''?String(it.id):'ls-idx-'+idx}
                  draggable={sortBy==='order'}
                  onDragStart={e=>{ if(sortBy!=='order'){e.preventDefault();return;} setDragId(it.id); e.dataTransfer.effectAllowed='move'; }}
                  onDragOver={e=>{ if(sortBy!=='order')return; e.preventDefault(); if(overId!==it.id) setOverId(it.id); }}
                  onDragLeave={()=>{ if(overId===it.id) setOverId(null); }}
                  onDrop={e=>{ e.preventDefault(); if(dragId!=null) reorderTo(dragId,it.id); setDragId(null); setOverId(null); }}
                  onDragEnd={()=>{ setDragId(null); setOverId(null); }}
                  style={{padding:'10px 12px',borderRadius:18,border:`1.5px solid ${overId===it.id&&dragId!==it.id?C.lav:C.border}`,background:C.bg2,
                    opacity:dragId===it.id?0.4:1,
                    ...(bulkMode&&selected.has(it.id)?{borderColor:C.lav,background:C.lavPale}:{})}}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:8}}>

                    {/* checkbox (bulk mode) */}
                    {bulkMode && (
                      <input type="checkbox" checked={selected.has(it.id)}
                        onChange={e=>{
                          setSelected(prev=>{
                            const s=new Set(prev);
                            e.target.checked?s.add(it.id):s.delete(it.id);
                            return s;
                          });
                        }}
                        style={{marginTop:3,accentColor:C.lav,width:15,height:15,flexShrink:0,cursor:'pointer'}}/>
                    )}

                    {/* drag handle */}
                    <span title={sortBy==='order'?'Kéo để đổi thứ tự':'Chỉ kéo được khi sắp xếp theo "Thứ tự"'}
                      style={{cursor:sortBy==='order'?'grab':'not-allowed',color:C.text4,flexShrink:0,marginTop:3,opacity:sortBy==='order'?1:0.35,touchAction:'none'}}>
                      <svg width="11" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="5" r="2"/><circle cx="16" cy="5" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="19" r="2"/><circle cx="16" cy="19" r="2"/></svg>
                    </span>

                    {/* order badge */}
                    <span style={{fontSize:10,fontWeight:900,color:C.lav,background:C.lavL,borderRadius:999,padding:'2px 7px',flexShrink:0,marginTop:1}}>#{idx+1}</span>

                    {/* content */}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12.5,fontWeight:700,color:dark?'#F0DCE8':'#3D1830',lineHeight:1.5,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>
                        {stripHTML(it.text)||<span style={{color:C.text4,fontStyle:'italic'}}>(chưa có văn bản)</span>}
                      </div>
                      {/* pills */}
                      <div style={{display:'flex',gap:5,marginTop:5,flexWrap:'wrap'}}>
                        {(it.answers||[]).length>0 && (
                          <span style={{fontSize:10,fontWeight:800,color:'#059669',background:'rgba(16,185,129,.1)',border:'1px solid rgba(16,185,129,.3)',borderRadius:99,padding:'2px 7px'}}>
                            {it.answers.length} chỗ trống
                          </span>
                        )}
                        {(it.wordBox||[]).length>0 && (
                          <span style={{fontSize:10,fontWeight:800,color:'#4338ca',background:'rgba(99,102,241,.1)',border:'1px solid rgba(99,102,241,.3)',borderRadius:99,padding:'2px 7px'}}>
                            WB: {it.wordBox.length}
                          </span>
                        )}
                        {(it.statements||[]).length>0 && (
                          <span style={{fontSize:10,fontWeight:800,color:'#dc2626',background:'rgba(220,38,38,.08)',border:'1px solid rgba(220,38,38,.28)',borderRadius:99,padding:'2px 7px',display:'inline-flex',alignItems:'center',gap:3}}>
                            {it.shuffleStatements && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>}
                            {it.statements.length} T/F/NM
                          </span>
                        )}
                        {(it.tags||[]).map(tg=>(
                          <span key={tg} style={{fontSize:10,fontWeight:700,color:'#7c3aed',background:'rgba(124,58,237,.1)',border:'1px solid rgba(124,58,237,.25)',borderRadius:99,padding:'2px 7px'}}>
                            {tg}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* action buttons */}
                    <div style={{display:'flex',gap:4,flexShrink:0,flexWrap:'wrap',justifyContent:'flex-end',maxWidth:120}}>
                      {/* preview */}
                      <button title="Xem trước" onClick={()=>setPreviewItem(it)}
                        style={{...iconBtn('#7c3aed'),background:'rgba(124,58,237,.08)'}}
                        onMouseEnter={liftHover} onMouseLeave={liftLeave} onMouseDown={pressDown} onMouseUp={pressUp}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      </button>
                      {/* TTS */}
                      <button title="Nghe thử" onClick={()=>handleTTS(it.text)}
                        style={{...iconBtn(C.mint),background:C.mintL}}
                        onMouseEnter={liftHover} onMouseLeave={liftLeave} onMouseDown={pressDown} onMouseUp={pressUp}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill={C.mint} stroke="none"><path d="M8 5v14l11-7z"/></svg>
                      </button>
                      {/* duplicate */}
                      <button title="Nhân đôi" onClick={()=>duplicate(it)}
                        style={{...iconBtn('#059669'),background:'rgba(5,150,105,.08)'}}
                        onMouseEnter={liftHover} onMouseLeave={liftLeave} onMouseDown={pressDown} onMouseUp={pressUp}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                      </button>
                      {/* edit */}
                      <button title="Sửa" onClick={()=>openForm(it)}
                        style={{...iconBtn(C.lav),background:C.lavL}}
                        onMouseEnter={liftHover} onMouseLeave={liftLeave} onMouseDown={pressDown} onMouseUp={pressUp}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.lav} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z"/></svg>
                      </button>
                      {/* delete */}
                      <button title="Xoá" onClick={()=>askRemove(it)}
                        style={{...iconBtn('#EF4444'),border:'1.5px solid #FECDD3',background:C.rosePale}}
                        onMouseEnter={e=>{e.currentTarget.style.background='#FEE2E2';e.currentTarget.style.transform='translateY(-1px)';}}
                        onMouseLeave={e=>{e.currentTarget.style.background=C.rosePale;e.currentTarget.style.transform='translateY(0)';}}
                        onMouseDown={pressDown} onMouseUp={pressUp}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── FORM tab ── */}
        {tab==='form' && (
          <div ref={formRef} style={{padding:'14px 16px',borderRadius:20,border:`1.5px dashed ${C.border2}`,background:C.lavPale,display:'flex',flexDirection:'column',gap:12}}>
            <style>{`[data-ph]:empty:before{content:attr(data-ph);color:${C.text4};pointer-events:none;}`}</style>

            {/* form header */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{display:'flex',alignItems:'center',gap:6,fontSize:13,fontWeight:900,color:C.lav}}>
                {editingId
                  ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z"/></svg>
                  : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>}
                {editingId?'Sửa câu Listening':'Thêm câu Listening mới'}
              </div>
              <button onClick={()=>{resetForm();setTab('list');}}
                style={{fontSize:12,color:C.text3,background:'transparent',border:'none',cursor:'pointer',fontWeight:700,display:'flex',alignItems:'center',gap:4,transition:'all .15s',padding:'4px 8px',borderRadius:8}}
                onMouseEnter={e=>{e.currentTarget.style.color=C.lav;e.currentTarget.style.background=C.lavPale;}}
                onMouseLeave={e=>{e.currentTarget.style.color=C.text3;e.currentTarget.style.background='transparent';}}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                Quay lại
              </button>
            </div>

            {/* Đoạn văn */}
            <div>
              <div style={{fontSize:11,fontWeight:800,color:C.text3,marginBottom:5}}>
                Đoạn văn để đọc <span style={{fontWeight:600,color:C.text4}}>(dùng <code>___</code> cho chỗ trống)</span>
                {countBlanks(text)>0 && <span style={{marginLeft:8,color:'#059669',fontWeight:900}}>· {countBlanks(text)} chỗ trống</span>}
              </div>
              <textarea value={text} onChange={e=>setText(e.target.value)}
                placeholder="VD: Trang An is famous ___ its beautiful landscape."
                rows={5} style={{...inputStyle,resize:'vertical'}}/>
              <div style={{display:'flex',gap:7,marginTop:7}}>
                <button onClick={syncBlanksFromText} style={{...btnBase('#059669','rgba(5,150,105,.08)'),display:'flex',alignItems:'center',gap:5}}
                  onMouseEnter={liftHover} onMouseLeave={liftLeave} onMouseDown={pressDown} onMouseUp={pressUp}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
                  Đồng bộ {countBlanks(text)} chỗ trống → {answers.length} đáp án
                </button>
                <button onClick={()=>handleTTS(text)}
                  style={{...btnBase(C.mint,C.mintL),display:'flex',alignItems:'center',gap:5}}
                  onMouseEnter={liftHover} onMouseLeave={liftLeave} onMouseDown={pressDown} onMouseUp={pressUp}>
                  {ttsSpeaking
                    ? <><svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="5" height="16"/><rect x="15" y="4" width="5" height="16"/></svg> Dừng</>
                    : <><svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Nghe thử</>}
                </button>
                {/* TTS speed */}
                <div style={{display:'flex',gap:4,alignItems:'center'}}>
                  {[0.75,1,1.25,1.5].map(sp=>(
                    <button key={sp} onClick={()=>setTtsSpeed(sp)}
                      style={{padding:'3px 7px',borderRadius:99,border:`1.5px solid ${sp===ttsSpeed?C.lav:C.border2}`,background:sp===ttsSpeed?C.lavL:'transparent',color:sp===ttsSpeed?C.lav:C.text3,fontSize:10,fontWeight:800,cursor:'pointer',transition:'all .15s'}}
                      onMouseEnter={e=>{if(sp!==ttsSpeed)e.currentTarget.style.background=C.lavPale;}}
                      onMouseLeave={e=>{if(sp!==ttsSpeed)e.currentTarget.style.background='transparent';}}
                      onMouseDown={e=>e.currentTarget.style.transform='scale(0.9)'}
                      onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}>
                      {sp}×
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Word Box */}
            <div style={{padding:'10px 12px',borderRadius:12,border:`1.5px solid ${C.border2}`,background:dark?'#180A10':'#FAFAFE'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                <span style={{fontSize:11,fontWeight:900,color:'#4338ca'}}>Word Box — từ cho học sinh chọn</span>
                <div style={{display:'flex',gap:6}}>
                  {wordBox.length>1 && (
                    <button onClick={()=>setShuffleWordBox(v=>!v)}
                      title="Tự tráo thứ tự Word Box mỗi lần học sinh làm"
                      style={{...btnBase(shuffleWordBox?'#dc2626':'#4338ca',shuffleWordBox?'rgba(220,38,38,.08)':'rgba(67,56,202,.08)'),fontSize:10,display:'flex',alignItems:'center',gap:4,border:`1.5px solid ${shuffleWordBox?'rgba(220,38,38,.35)':'rgba(67,56,202,.25)'}`}}
                      onMouseEnter={liftHover} onMouseLeave={liftLeave} onMouseDown={pressDown} onMouseUp={pressUp}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
                      Tráo
                    </button>
                  )}
                  <button onClick={suggestWBFromAnswers} style={{...btnBase('#4338ca','rgba(67,56,202,.08)'),fontSize:10,display:'flex',alignItems:'center',gap:4}}
                    onMouseEnter={liftHover} onMouseLeave={liftLeave} onMouseDown={pressDown} onMouseUp={pressUp}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5z"/><path d="M19 14l.7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7z"/></svg>
                    Gợi ý từ đáp án
                  </button>
                </div>
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:wordBox.length?8:0}}>
                {wordBox.map(w=>(
                  <span key={w.id} style={{display:'flex',alignItems:'center',gap:5,fontSize:12,fontWeight:700,color:'#4338ca',background:'rgba(99,102,241,.12)',borderRadius:99,padding:'4px 6px 4px 10px'}}>
                    <input value={w.val} onChange={e=>updateWord(w.id,e.target.value)}
                      onKeyDown={e=>{if(e.key==='Enter')e.target.blur();}}
                      style={{border:'none',background:'transparent',outline:'none',color:'#4338ca',fontWeight:700,fontSize:12,fontFamily:'inherit',width:`${Math.max((w.val||'').length,2)+1}ch`,padding:0}}/>
                    <button onClick={()=>removeWord(w.id)} style={{width:16,height:16,borderRadius:99,border:'none',background:'rgba(99,102,241,.25)',color:'#4338ca',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,lineHeight:1,padding:0,flexShrink:0,transition:'all .15s'}}
                      onMouseEnter={e=>{e.currentTarget.style.background='rgba(99,102,241,.4)';e.currentTarget.style.transform='scale(1.15)';}}
                      onMouseLeave={e=>{e.currentTarget.style.background='rgba(99,102,241,.25)';e.currentTarget.style.transform='scale(1)';}}>×</button>
                  </span>
                ))}
              </div>
              <div style={{display:'flex',gap:6}}>
                <input ref={wbInputRef} value={wbInput} onChange={e=>setWbInput(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addWord();}}}
                  placeholder="Nhập từ rồi Enter..." style={{...inputStyle,flex:1}}/>
                <button onClick={addWord} style={{padding:'0 14px',borderRadius:10,border:'1.5px solid rgba(99,102,241,.35)',background:'rgba(99,102,241,.1)',color:'#4338ca',fontSize:12,fontWeight:800,cursor:'pointer',transition:'all .15s'}}
                  onMouseEnter={liftHover} onMouseLeave={liftLeave} onMouseDown={pressDown} onMouseUp={pressUp}>+ Thêm</button>
              </div>
            </div>

            {/* Đáp án */}
            <div style={{padding:'10px 12px',borderRadius:12,border:'1.5px solid rgba(16,185,129,.25)',background:'rgba(16,185,129,.05)'}}>
              <div style={{fontSize:11,fontWeight:800,color:'#059669',marginBottom:8}}>
                Đáp án đúng theo thứ tự (1),(2),(3)...
                {countBlanks(text)>0 && answers.length>0 && countBlanks(text)!==answers.length && (
                  <span style={{marginLeft:8,color:'#f59e0b',fontWeight:700,display:'inline-flex',alignItems:'center',gap:4}}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    {countBlanks(text)} chỗ trống ≠ {answers.length} đáp án
                  </span>
                )}
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {answers.map((a,i)=>(
                  <div key={a.id} style={{display:'flex',gap:6,alignItems:'center'}}>
                    <span style={{fontSize:11,fontWeight:900,color:'#059669',minWidth:20}}>({i+1})</span>
                    <input value={a.val} onChange={e=>updateAnswer(a.id,e.target.value)}
                      placeholder={`Đáp án ${i+1}`} style={{...inputStyle,flex:1}}/>
                    <button onClick={()=>removeAnswer(a.id)}
                      style={{width:26,height:26,flexShrink:0,borderRadius:8,border:'1.5px solid rgba(220,38,38,.25)',background:'rgba(220,38,38,.08)',color:'#dc2626',cursor:'pointer',transition:'all .15s'}}
                      onMouseEnter={e=>{e.currentTarget.style.background='rgba(220,38,38,.2)';e.currentTarget.style.transform='scale(1.08)';}}
                      onMouseLeave={e=>{e.currentTarget.style.background='rgba(220,38,38,.08)';e.currentTarget.style.transform='scale(1)';}}>−</button>
                  </div>
                ))}
              </div>
              <button onClick={addAnswer} style={{marginTop:8,padding:'5px 11px',borderRadius:8,border:'1.5px solid rgba(16,185,129,.35)',background:'rgba(16,185,129,.1)',color:'#059669',fontSize:11,fontWeight:800,cursor:'pointer',transition:'all .15s'}}
                onMouseEnter={liftHover} onMouseLeave={liftLeave} onMouseDown={pressDown} onMouseUp={pressUp}>+ Thêm chỗ trống</button>
            </div>

            {/* T/F/NM */}
            <div style={{padding:'10px 12px',borderRadius:12,border:'1.5px solid rgba(220,38,38,.2)',background:'rgba(220,38,38,.04)'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4,gap:8}}>
                <span style={{fontSize:11,fontWeight:800,color:'#dc2626'}}>True / False / Not Mentioned <span style={{fontWeight:600,color:C.text4}}>(tuỳ chọn)</span></span>
                <button type="button" onClick={()=>setShuffleStatements(v=>!v)} title="Tự tráo thứ tự câu nhận định mỗi lần học sinh làm"
                  style={{display:'flex',alignItems:'center',gap:4,padding:'4px 9px',borderRadius:999,border:`1.5px solid ${shuffleStatements?'#dc2626':C.border2}`,background:shuffleStatements?'#dc2626':C.bg2,color:shuffleStatements?'#fff':C.text3,fontSize:10.5,fontWeight:800,cursor:'pointer',flexShrink:0,transition:'all .15s'}}
                  onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';}}
                  onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';}}
                  onMouseDown={e=>e.currentTarget.style.transform='scale(0.94)'}
                  onMouseUp={e=>e.currentTarget.style.transform='translateY(-1px)'}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
                  Tráo thứ tự
                </button>
              </div>
              {shuffleStatements && (
                <div style={{fontSize:10.5,color:'#b45309',marginBottom:8,fontStyle:'italic'}}>
                  Đang bật: mỗi học sinh sẽ thấy các nhận định theo thứ tự ngẫu nhiên khác nhau.
                </div>
              )}
              <div style={{display:'flex',flexDirection:'column',gap:7}}>
                {statements.map((s,i)=>(
                  <div key={s.id} style={{padding:'8px 10px',borderRadius:10,background:dark?'rgba(255,255,255,.04)':'rgba(255,255,255,.6)',border:'1px solid rgba(220,38,38,.15)'}}>
                    <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:7}}>
                      <span style={{fontSize:11,fontWeight:900,color:'#dc2626',minWidth:16}}>{i+1}.</span>
                      <div ref={el=>{
                          stmtInputRefs.current[s.id]=el;
                          if(el && el.getAttribute('data-inited')!=='1'){ el.innerHTML=s.statement||''; el.setAttribute('data-inited','1'); }
                        }}
                        contentEditable suppressContentEditableWarning data-ph={`Nhận định ${i+1}`}
                        onInput={e=>updateStatement(s.id,'statement',sanitizeStmtHTML(e.currentTarget.innerHTML))}
                        onKeyDown={e=>{ if(e.key==='Enter') e.preventDefault(); }}
                        onPaste={e=>{ e.preventDefault(); const t=(e.clipboardData||window.clipboardData).getData('text/plain'); document.execCommand('insertText',false,t); }}
                        style={{...inputStyle,flex:1,minHeight:36,cursor:'text',whiteSpace:'pre-wrap',wordBreak:'break-word'}}/>
                      <button type="button" onMouseDown={e=>{e.preventDefault();e.currentTarget.style.transform='scale(0.9)';}} onMouseUp={e=>e.currentTarget.style.transform='scale(1)'} onClick={()=>toggleUnderlineStatement(s.id)} title="Bôi đen chữ rồi bấm để gạch chân"
                        style={{width:26,height:26,flexShrink:0,borderRadius:8,border:`1.5px solid ${C.border2}`,background:C.bg2,color:C.text3,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .15s'}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor=C.lav2;e.currentTarget.style.color=C.lav;}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border2;e.currentTarget.style.color=C.text3;}}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 4v6a6 6 0 0012 0V4"/><line x1="4" y1="20" x2="20" y2="20"/></svg>
                      </button>
                      <button type="button" onClick={()=>moveStatement(s.id,-1)} disabled={i===0} title="Đưa lên trên"
                        style={{width:26,height:26,flexShrink:0,borderRadius:8,border:`1.5px solid ${C.border2}`,background:C.bg2,color:C.text3,cursor:i===0?'default':'pointer',opacity:i===0?0.4:1,display:'flex',alignItems:'center',justifyContent:'center',transition:'all .15s'}}
                        onMouseEnter={e=>{if(i!==0)e.currentTarget.style.background=C.lavPale;}}
                        onMouseLeave={e=>{e.currentTarget.style.background=C.bg2;}}
                        onMouseDown={e=>{if(i!==0)e.currentTarget.style.transform='scale(0.88)';}}
                        onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                      </button>
                      <button type="button" onClick={()=>moveStatement(s.id,1)} disabled={i===statements.length-1} title="Đưa xuống dưới"
                        style={{width:26,height:26,flexShrink:0,borderRadius:8,border:`1.5px solid ${C.border2}`,background:C.bg2,color:C.text3,cursor:i===statements.length-1?'default':'pointer',opacity:i===statements.length-1?0.4:1,display:'flex',alignItems:'center',justifyContent:'center',transition:'all .15s'}}
                        onMouseEnter={e=>{if(i!==statements.length-1)e.currentTarget.style.background=C.lavPale;}}
                        onMouseLeave={e=>{e.currentTarget.style.background=C.bg2;}}
                        onMouseDown={e=>{if(i!==statements.length-1)e.currentTarget.style.transform='scale(0.88)';}}
                        onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                      </button>
                      <button onClick={()=>removeStatement(s.id)}
                        style={{width:26,height:26,flexShrink:0,borderRadius:8,border:'1.5px solid rgba(220,38,38,.25)',background:'rgba(220,38,38,.08)',color:'#dc2626',cursor:'pointer',transition:'all .15s'}}
                        onMouseEnter={e=>{e.currentTarget.style.background='rgba(220,38,38,.2)';e.currentTarget.style.transform='scale(1.08)';}}
                        onMouseLeave={e=>{e.currentTarget.style.background='rgba(220,38,38,.08)';e.currentTarget.style.transform='scale(1)';}}>−</button>
                    </div>
                    <div style={{display:'flex',gap:6}}>
                      {Object.keys(ANS_COLORS).map(key=>{
                        const ac=ANS_COLORS[key]; const sel=s.answer===key;
                        return(
                          <button key={key} onClick={()=>updateStatement(s.id,'answer',key)}
                            style={{flex:1,padding:'5px 0',borderRadius:8,border:`1.5px solid ${sel?ac.c:ac.bd}`,background:sel?ac.c:ac.bg,color:sel?'#fff':ac.c,fontSize:11,fontWeight:800,cursor:'pointer',transition:'all .15s'}}
                            onMouseEnter={e=>{if(!sel){e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow=`0 2px 8px ${ac.c}55`;}}}
                            onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';}}
                            onMouseDown={e=>e.currentTarget.style.transform='scale(0.94)'}
                            onMouseUp={e=>e.currentTarget.style.transform='translateY(-1px)'}>
                            {ac.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={addStatement} style={{marginTop:8,padding:'5px 11px',borderRadius:8,border:'1.5px solid rgba(220,38,38,.3)',background:'rgba(220,38,38,.08)',color:'#dc2626',fontSize:11,fontWeight:800,cursor:'pointer',transition:'all .15s'}}
                onMouseEnter={liftHover} onMouseLeave={liftLeave} onMouseDown={pressDown} onMouseUp={pressUp}>+ Thêm nhận định</button>
            </div>

            {/* Tags */}
            <div style={{padding:'10px 12px',borderRadius:12,border:`1.5px solid rgba(124,58,237,.25)`,background:'rgba(124,58,237,.04)'}}>
              <div style={{display:'flex',alignItems:'center',gap:5,fontSize:11,fontWeight:800,color:'#7c3aed',marginBottom:8}}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41L13.42 20.58a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                Nhãn (Tags) <span style={{fontWeight:600,color:C.text4}}>(tuỳ chọn)</span>
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:tags.length?8:0}}>
                {tags.map(t=>(
                  <span key={t} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,fontWeight:700,color:'#7c3aed',background:'rgba(124,58,237,.12)',borderRadius:99,padding:'3px 6px 3px 10px'}}>
                    {t}
                    <button onClick={()=>removeTag(t)} style={{width:15,height:15,borderRadius:99,border:'none',background:'rgba(124,58,237,.25)',color:'#7c3aed',cursor:'pointer',fontSize:10,lineHeight:1,padding:0,transition:'all .15s'}}
                      onMouseEnter={e=>{e.currentTarget.style.background='rgba(124,58,237,.4)';e.currentTarget.style.transform='scale(1.15)';}}
                      onMouseLeave={e=>{e.currentTarget.style.background='rgba(124,58,237,.25)';e.currentTarget.style.transform='scale(1)';}}>×</button>
                  </span>
                ))}
              </div>
              <div style={{display:'flex',gap:6}}>
                <input ref={tagInputRef} value={tagInput} onChange={e=>setTagInput(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addTag();}}}
                  placeholder="VD: Unit 5, Beginner, ..." style={{...inputStyle,flex:1}}/>
                <button onClick={addTag} style={{padding:'0 14px',borderRadius:10,border:'1.5px solid rgba(124,58,237,.35)',background:'rgba(124,58,237,.1)',color:'#7c3aed',fontSize:12,fontWeight:800,cursor:'pointer',transition:'all .15s'}}
                  onMouseEnter={liftHover} onMouseLeave={liftLeave} onMouseDown={pressDown} onMouseUp={pressUp}>+ Thêm</button>
              </div>
            </div>

            {/* Save / Cancel */}
            <div style={{display:'flex',gap:8,marginTop:2}}>
              <button onClick={()=>{resetForm();setTab('list');}}
                style={{flex:1,padding:'9px',borderRadius:999,border:`1.5px solid ${C.border}`,background:'transparent',color:C.text3,fontSize:12.5,fontWeight:800,cursor:'pointer',transition:'all .15s'}}
                onMouseEnter={e=>e.currentTarget.style.background=C.bg2}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                onMouseDown={e=>e.currentTarget.style.transform='scale(0.97)'}
                onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}>
                Hủy
              </button>
              <button onClick={()=>previewItem||setPreviewItem({id:'__preview__',text,wordBox:wordBox.map(w=>w.val),answers:answers.map(a=>a.val),statements:statements.map(({id:_,...r})=>r),tags})}
                style={{padding:'9px 14px',borderRadius:999,border:`1.5px solid rgba(124,58,237,.35)`,background:'rgba(124,58,237,.08)',color:'#7c3aed',fontSize:12.5,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',gap:5,transition:'all .15s'}}
                onMouseEnter={e=>{e.currentTarget.style.background='rgba(124,58,237,.18)';e.currentTarget.style.transform='translateY(-1px)';}}
                onMouseLeave={e=>{e.currentTarget.style.background='rgba(124,58,237,.08)';e.currentTarget.style.transform='translateY(0)';}}
                onMouseDown={e=>e.currentTarget.style.transform='scale(0.96)'}
                onMouseUp={e=>e.currentTarget.style.transform='translateY(-1px)'}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Preview
              </button>
              <button onClick={save} disabled={saving}
                style={{flex:2,padding:'9px',borderRadius:999,border:'none',background:C.grad,color:'#fff',fontSize:12.5,fontWeight:900,cursor:saving?'default':'pointer',opacity:saving?0.7:1,boxShadow:'0 4px 14px rgba(168,85,247,0.3)',transition:'all .18s'}}
                onMouseEnter={e=>{if(!saving){e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 6px 20px rgba(168,85,247,0.42)';}}}
                onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 4px 14px rgba(168,85,247,0.3)';}}
                onMouseDown={e=>{if(!saving)e.currentTarget.style.transform='scale(0.97)';}}
                onMouseUp={e=>{if(!saving)e.currentTarget.style.transform='translateY(-1px)';}}>
                {saving?'Đang lưu...':(editingId?'Lưu thay đổi':'Thêm câu')}
              </button>
            </div>
          </div>
        )}

        {/* ── Preview modal ── */}
        {previewItem && (
          <ListeningPreview item={previewItem} dark={dark} C={C} onClose={()=>setPreviewItem(null)}/>
        )}
      </div>
    );
  }

  window.ListeningManager = ListeningManager;
})();
