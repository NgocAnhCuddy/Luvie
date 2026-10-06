/* ══ HOME-SCREEN.JSX ══ */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
(function(){

// ─── Global Styles ────────────────────────────────────────────────────────────
(function(){
  if(document.getElementById('_ls_home_css'))return;
  const s=document.createElement('style');
  s.id='_ls_home_css';
  s.textContent=`
    /* ── Play button ── */
    .ls-play-btn{transition:transform .16s var(--ease-smooth,cubic-bezier(.22,1,.36,1)),box-shadow .16s var(--ease-smooth,cubic-bezier(.22,1,.36,1))!important;}
    .ls-play-btn:active{transform:scale(0.88)!important;box-shadow:0 1px 4px rgba(168,85,247,0.2)!important;}
    @media(hover:hover){.ripple-host:hover .ls-play-btn{transform:scale(1.10) rotate(-3deg);box-shadow:0 6px 18px rgba(168,85,247,0.45)!important;}}

    /* ── Main Tabs ── */
    .ls-main-tab{transition:transform .16s var(--ease-smooth,cubic-bezier(.22,1,.36,1)),box-shadow .2s var(--ease-smooth,cubic-bezier(.22,1,.36,1)),background .22s!important;}
    .ls-main-tab:active{transform:scale(0.95)!important;filter:brightness(0.93)!important;}
    @media(hover:hover){.ls-main-tab:hover{transform:translateY(-2px);filter:brightness(1.04);}}

    /* ── Subject filter tabs ── */
    .ls-filter-tab{transition:transform .16s var(--ease-smooth,cubic-bezier(.22,1,.36,1)),box-shadow .2s var(--ease-smooth,cubic-bezier(.22,1,.36,1)),background .22s!important;}
    .ls-filter-tab:active{transform:scale(0.94)!important;filter:brightness(0.92)!important;}
    @media(hover:hover){.ls-filter-tab:hover{transform:translateY(-2px);filter:brightness(1.04);}}

    /* ── Shuffle toggle buttons ── */
    .ls-toggle-btn{transition:transform .13s ease,box-shadow .13s ease,background .2s,border-color .2s,color .2s!important;}
    .ls-toggle-btn:active{transform:scale(0.93)!important;}
    @media(hover:hover){.ls-toggle-btn:hover{filter:brightness(1.06);}}

    /* ── Sort buttons ── */
    .ls-sort-btn{transition:transform .12s ease,box-shadow .15s,background .15s,color .15s,border-color .15s!important;}
    .ls-sort-btn:active{transform:scale(0.91)!important;}
    .ls-sort-btn.active{box-shadow:0 2px 10px rgba(168,85,247,0.18)!important;}
    .ls-sort-btn.inactive{border-color:transparent!important;opacity:0.75;}
    .ls-sort-btn.inactive:active{opacity:1;}
    @media(hover:hover){.ls-sort-btn.inactive:hover{opacity:1;filter:brightness(1.05);}}

    /* ── Lesson cards ── */
    .ls-lesson-card{transition:transform .22s var(--ease-smooth,cubic-bezier(.22,1,.36,1)),box-shadow .22s var(--ease-smooth,cubic-bezier(.22,1,.36,1)),border-color .22s!important;}
    .ls-lesson-card:active{transform:scale(0.977)!important;}

    /* ── Dark mode toggle ── */
    .dm-btn:active{transform:scale(0.88)!important;}
    @media(hover:hover){.dm-btn:hover{transform:scale(1.1);}}

    /* ── Toggle track / thumb ── */
    .ls-toggle-track{transition:background .22s ease!important;}
    .ls-toggle-thumb{transition:left .22s cubic-bezier(.34,1.56,.64,1)!important;}

    /* ══ Export Bottom Sheet Animation ══
       Base state: hidden below viewport.
       .open state: slides into view.
       Backdrop fades in/out independently.
    ─────────────────────────────────── */
    .exp-backdrop{
      position:fixed;inset:0;
      background:rgba(0,0,0,0.55);
      backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);
      z-index:100;
      opacity:0;pointer-events:none;
      transition:opacity .28s ease;
    }
    .exp-backdrop.open{opacity:1;pointer-events:auto;}

    .exp-sheet{
      position:fixed;bottom:0;left:50%;
      transform:translate(-50%, 100%);
      width:100%;max-width:760px;
      background:#1E0D15;
      border-radius:24px 24px 0 0;
      padding:16px 18px 32px;
      z-index:101;
      max-height:90vh;overflow-y:auto;
      transition:transform .36s cubic-bezier(0.32,0.72,0,1);
    }
    .exp-sheet.open{transform:translate(-50%, 0);}

    .exp-pill-handle{
      width:40px;height:4px;border-radius:99px;
      background:rgba(255,255,255,0.18);
      margin:0 auto 18px;
    }
  `;
  document.head.appendChild(s);
})();

// ═══════════════════════════════════════════════════════════════════════════════
// ExportBottomSheet — component tách riêng
// ═══════════════════════════════════════════════════════════════════════════════
function ExportBottomSheet({open,lessons,exportMode,setExportMode,selectedIds,setSelectedIds,shuffleQ,shuffleA,onClose}){
  // Chỉ tính toán khi `lessons` thay đổi
  const eligible=useMemo(()=>lessons.filter(l=>l.questions&&l.questions.length>0),[lessons]);
  const selArr=useMemo(()=>eligible.filter(l=>selectedIds&&selectedIds.has(l.id)),[eligible,selectedIds]);
  const allChecked=selArr.length===eligible.length&&eligible.length>0;

  const toggleId=useCallback((id)=>{
    setSelectedIds(prev=>{const s=new Set(prev);s.has(id)?s.delete(id):s.add(id);return s;});
  },[setSelectedIds]);

  const toggleAll=useCallback(()=>{
    setSelectedIds(allChecked?new Set():new Set(eligible.map(l=>l.id)));
  },[allChecked,eligible,setSelectedIds]);

  const handleSetMode=useCallback((key)=>setExportMode(key),[setExportMode]);

  const handleDownload=useCallback(()=>{
    try{
      if(!selArr.length)return;
      const html=exportMode==='lite'?buildExportLiteHTML(selArr):buildExportHTML(selArr);
      const blob=new Blob([html],{type:'text/html'});
      const a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      a.download='learnsy-quiz.html';
      a.click();
      onClose();
    }catch(e){alert('Lỗi xuất file: '+e.message);}
  },[selArr,exportMode,onClose]);

  // Không mount gì nếu chưa mở lần nào (selectedIds === null)
  if(!selectedIds)return null;

  return(
    <>
      {/* Backdrop */}
      <div
        className={`exp-backdrop${open?' open':''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className={`exp-sheet${open?' open':''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Xuất bộ câu hỏi"
      >
        <div className="exp-pill-handle"/>

        {/* ── Header ── */}
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
          <div style={{width:36,height:36,borderRadius:11,background:'linear-gradient(135deg,#F472B6,#A855F7)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:15,fontWeight:900,color:'#F0DCE8'}}>Xuất bộ câu hỏi</div>
            <div style={{fontSize:11,color:'rgba(255,150,200,0.6)',marginTop:1}}>
              {selArr.length}/{eligible.length} bài đã chọn · {selArr.reduce((s,l)=>s+l.questions.length,0)} câu
            </div>
          </div>
          <span style={{fontSize:10,fontWeight:900,color:'#F472B6',background:'rgba(244,114,182,0.12)',border:'1.5px solid rgba(244,114,182,0.25)',borderRadius:99,padding:'3px 9px'}}>
            🔑 Giáo viên
          </span>
        </div>

        {/* ── Lesson picker ── */}
        <div style={{marginBottom:14}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
            <div style={{fontSize:11,fontWeight:800,color:'rgba(255,150,200,0.5)',letterSpacing:.7,textTransform:'uppercase'}}>Chọn bài</div>
            <button
              onClick={toggleAll}
              onMouseEnter={e=>e.currentTarget.style.opacity='0.7'}
              onMouseLeave={e=>e.currentTarget.style.opacity='1'}
              style={{fontSize:11,fontWeight:800,color:allChecked?'#FCA5A5':'#C084FC',background:'transparent',border:'none',cursor:'pointer',padding:'2px 4px',fontFamily:'inherit',transition:'opacity .15s'}}
            >
              {allChecked?'Bỏ chọn tất cả':'Chọn tất cả'}
            </button>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:200,overflowY:'auto',paddingRight:2}}>
            {eligible.map(l=>{
              const on=selectedIds.has(l.id);
              return(
                <button key={l.id} onClick={()=>toggleId(l.id)}
                  onMouseEnter={e=>{if(!on)e.currentTarget.style.background='rgba(255,255,255,0.08)';}}
                  onMouseLeave={e=>{if(!on)e.currentTarget.style.background='rgba(255,255,255,0.04)';}}
                  style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:13,
                    border:`1.5px solid ${on?'rgba(168,85,247,0.45)':'rgba(255,255,255,0.08)'}`,
                    background:on?'rgba(168,85,247,0.12)':'rgba(255,255,255,0.04)',
                    cursor:'pointer',textAlign:'left',transition:'all .15s',fontFamily:'inherit',width:'100%'}}>
                  <div style={{width:20,height:20,borderRadius:6,flexShrink:0,
                    background:on?'linear-gradient(135deg,#F472B6,#A855F7)':'transparent',
                    border:`1.5px solid ${on?'transparent':'rgba(255,255,255,0.2)'}`,
                    display:'flex',alignItems:'center',justifyContent:'center',transition:'all .15s'}}>
                    {on&&<svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2 6 5 9 10 3"/></svg>}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:800,color:on?'#F9A8D4':'rgba(255,255,255,0.55)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{l.title}</div>
                    <div style={{fontSize:11,color:'rgba(255,150,200,0.35)',marginTop:1}}>{l.questions.length} câu hỏi</div>
                  </div>
                  {on&&<div style={{width:6,height:6,borderRadius:'50%',background:'#A855F7',flexShrink:0}}/>}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Mode selector ── */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:800,color:'rgba(255,150,200,0.5)',letterSpacing:.7,marginBottom:8,textTransform:'uppercase'}}>Chế độ xuất</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
            {[
              {key:'full',icon:'🎵',label:'Full',desc:'Có âm thanh'},
              {key:'lite',icon:'⚡',label:'Lite',desc:'Nhẹ, offline'},
            ].map(({key,icon,label,desc})=>(
              <button key={key} onClick={()=>handleSetMode(key)}
                onMouseEnter={e=>{if(exportMode!==key)e.currentTarget.style.background='rgba(255,255,255,0.08)';}}
                onMouseLeave={e=>{if(exportMode!==key)e.currentTarget.style.background='rgba(255,255,255,0.04)';}}
                style={{padding:'10px 12px',borderRadius:13,
                  border:`1.5px solid ${exportMode===key?'rgba(244,114,182,0.5)':'rgba(255,255,255,0.08)'}`,
                  background:exportMode===key?'rgba(244,114,182,0.12)':'rgba(255,255,255,0.04)',
                  cursor:'pointer',textAlign:'left',transition:'all .18s',fontFamily:'inherit',
                  display:'flex',alignItems:'center',gap:9}}>
                <span style={{fontSize:18}}>{icon}</span>
                <div>
                  <div style={{fontSize:13,fontWeight:900,color:exportMode===key?'#F9A8D4':'rgba(255,255,255,0.55)'}}>{label}</div>
                  <div style={{fontSize:11,color:'rgba(255,150,200,0.35)'}}>{desc}</div>
                </div>
                {exportMode===key&&<div style={{marginLeft:'auto',width:7,height:7,borderRadius:'50%',background:'#F472B6'}}/>}
              </button>
            ))}
          </div>
        </div>

        {/* ── Shuffle status ── */}
        <div style={{display:'flex',gap:7,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
          {[{on:shuffleQ,label:'Xáo câu'},{on:shuffleA,label:'Xáo đáp án'}].map(({on,label})=>(
            <span key={label} style={{fontSize:11,fontWeight:800,padding:'4px 10px',borderRadius:999,
              border:`1px solid ${on?'rgba(168,85,247,0.4)':'rgba(255,255,255,0.1)'}`,
              color:on?'#C084FC':'rgba(255,255,255,0.3)',
              background:on?'rgba(168,85,247,0.1)':'transparent'}}>
              {on?'✓ ':'○ '}{label}
            </span>
          ))}
          <span style={{fontSize:11,color:'rgba(255,150,200,0.3)'}}>· theo toggle trang chủ</span>
        </div>

        {/* ── Download button ── */}
        <button
          disabled={selArr.length===0}
          onClick={handleDownload}
          onMouseEnter={e=>{if(selArr.length){e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 6px 26px rgba(168,85,247,0.52)';}}}
          onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow=selArr.length?'0 4px 20px rgba(168,85,247,0.4)':'none';}}
          onMouseDown={e=>{if(selArr.length)e.currentTarget.style.transform='scale(0.97)';}}
          onMouseUp={e=>{if(selArr.length)e.currentTarget.style.transform='translateY(-2px)';}}
          style={{width:'100%',padding:'13px 0',borderRadius:999,border:'none',
            background:selArr.length?'linear-gradient(135deg,#F472B6,#A855F7)':'rgba(255,255,255,0.08)',
            color:selArr.length?'#fff':'rgba(255,255,255,0.25)',
            fontSize:15,fontWeight:900,cursor:selArr.length?'pointer':'default',fontFamily:'inherit',
            boxShadow:selArr.length?'0 4px 20px rgba(168,85,247,0.4)':'none',transition:'all .2s',
            display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          {selArr.length?`Tải xuống ${exportMode==='full'?'Full':'Lite'} (${selArr.length} bài)`:'Chưa chọn bài nào'}
        </button>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HomeScreen
// ═══════════════════════════════════════════════════════════════════════════════
function HomeScreen({lessons,loading,fetchError,history,dark,setDark,onPlay,onClearHistory,onHistDetail,shuffleQ,setShuffleQ,shuffleA,setShuffleA,student,onLogout}){
  const [filterTab,setFilterTab]=useState('all');
  const [mainTab,setMainTab]=useState('lessons');
  const [searchQuery,setSearchQuery]=useState('');
  const [sortBy,setSortBy]=useState('newest');
  const [exportOpen,setExportOpen]=useState(false);
  const [exportMode,setExportMode]=useState('full');
  const [selectedIds,setSelectedIds]=useState(null);// null = chưa từng mở
  const _tapRef=useRef({n:0,t:0});
  const ripple=useRipple();

  // ── useCallback handlers ────────────────────────────────────────────────────
  const handleToggleDark  =useCallback(()=>setDark(d=>!d),[setDark]);
  const handleSetMainTab  =useCallback((key)=>setMainTab(key),[]);
  const handleSetFilterTab=useCallback((key)=>setFilterTab(key),[]);
  const handleSetSortBy   =useCallback((k)=>setSortBy(k),[]);
  const handleClearSearch =useCallback(()=>setSearchQuery(''),[]);
  const handleCloseExport =useCallback(()=>setExportOpen(false),[]);

  const handleLogoTap=useCallback(()=>{
    const now=Date.now();
    if(now-_tapRef.current.t>2000)_tapRef.current.n=0;
    _tapRef.current.t=now;
    _tapRef.current.n++;
    if(_tapRef.current.n>=5){
      _tapRef.current.n=0;
      setExportOpen(o=>{
        if(!o){
          const ids=new Set(lessons.filter(l=>l.questions&&l.questions.length>0).map(l=>l.id));
          setSelectedIds(ids);
        }
        return !o;
      });
    }
  },[lessons]);

  // ── useMemo: danh sách bài đã lọc + sắp xếp ────────────────────────────────
  const filteredLessons=useMemo(()=>{
    let list=lessons;
    if(filterTab==='english')list=list.filter(l=>l.subject==='Tiếng Anh');
    else if(filterTab==='other')list=list.filter(l=>l.subject!=='Tiếng Anh');
    if(searchQuery){
      const q=searchQuery.toLowerCase();
      list=list.filter(l=>(l.title||'').toLowerCase().includes(q)||(l.subject||'').toLowerCase().includes(q));
    }
    return [...list].sort((a,b)=>{
      if(sortBy==='name')return(a.title||'').localeCompare(b.title||'','vi');
      if(sortBy==='count')return(b.questionCount||0)-(a.questionCount||0);
      if(sortBy==='oldest')return(a.id||'').localeCompare(b.id||'');
      return(b.id||'').localeCompare(a.id||'');
    });
  },[lessons,filterTab,searchQuery,sortBy]);

  // ── useMemo: số lượng theo tab (cho badge + empty state) ───────────────────
  const tabCounts=useMemo(()=>({
    all:lessons.length,
    english:lessons.filter(l=>l.subject==='Tiếng Anh').length,
    other:lessons.filter(l=>l.subject!=='Tiếng Anh').length,
  }),[lessons]);

  // ── Subject colors helper ───────────────────────────────────────────────────
  const subjectColors={
    'Tiếng Anh':{bg:'#F0E6FF',color:'#A855F7',border:'#E8DCFF'},
    'Toán':{bg:'#ECFDF5',color:'#10B981',border:'#BBF7D0'},
    'Lịch Sử':{bg:'#FFF7ED',color:'#F97316',border:'#FED7AA'},
    'Địa Lý':{bg:'#EFF6FF',color:'#3B82F6',border:'#BFDBFE'},
    default:{bg:'#FFF0F5',color:'#FF6B95',border:'#F5D5E8'},
  };
  const sc=(s)=>subjectColors[s]||subjectColors.default;

  // ── Derived for empty state ─────────────────────────────────────────────────
  const tabCount=filterTab==='english'?tabCounts.english:filterTab==='other'?tabCounts.other:tabCounts.all;
  const isEmpty=filteredLessons.length===0;
  const isSearchEmpty=isEmpty&&!!searchQuery&&tabCount>0;

  return(
    <div style={{minHeight:'100vh',background:dark?'#180A10':'#FFF5F9',color:dark?'#F0DCE8':'#3D1830',maxWidth:760,margin:'0 auto',position:'relative'}}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{background:dark?'rgba(30,13,21,0.82)':'rgba(255,255,255,0.86)',borderBottom:`1.5px solid ${dark?'#421526':'#F5D5E8'}`,position:'sticky',top:0,zIndex:60,backdropFilter:'blur(20px) saturate(160%)',WebkitBackdropFilter:'blur(20px) saturate(160%)',boxShadow:dark?'0 1px 2px rgba(0,0,0,0.2), 0 6px 24px rgba(0,0,0,0.22)':'0 1px 2px rgba(120,40,90,0.04), 0 6px 24px rgba(255,100,150,0.09)',padding:'12px 14px 10px'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span className="logo-fl">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="url(#lg1s)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <defs><linearGradient id="lg1s" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#f472b6"/><stop offset="100%" stopColor="#6366f1"/></linearGradient></defs>
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
          </span>
          <span className="logo-learnsy" onClick={handleLogoTap} style={{cursor:'pointer',userSelect:'none',WebkitUserSelect:'none'}}>Luvie</span>
          <span className="logo-flb"><Sparkle s={13} c="#6366f1"/></span>
          <span style={{fontSize:10,fontWeight:900,color:'#FF6B95',background:'#FFF0F5',border:'1.5px solid #F5D5E8',borderRadius:99,padding:'2px 8px',marginLeft:2,flexShrink:0}}>🌸 Student</span>
          <div style={{flex:1}}/>
          <button
            className="dm-btn"
            onClick={handleToggleDark}
            aria-label={dark?'Chuyển sang sáng':'Chuyển sang tối'}
          >
            {dark
              ?<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FCD34D" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              :<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A855F7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>}
          </button>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="ls-body-pad">

        {/* Hero */}
        <div style={{textAlign:'center',padding:'24px 12px 20px'}}>
          <div style={{fontSize:32,marginBottom:6}}>📚</div>
          <h1 className="ls-title-hero" style={{fontWeight:900,color:dark?'#F0DCE8':'#3D1830',marginBottom:8}}>Luyện tập hôm nay</h1>
          <p className="ls-desc" style={{color:dark?'#8A6080':'#A07090'}}>Chọn bộ câu hỏi để bắt đầu ôn tập nào! ✨</p>
        </div>

        {/* ── Main Tabs: Bài tập | Lịch sử ── */}
        {(()=>{
          const tabs=[
            {
              key:'lessons',
              icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
              label:'Bài tập',
              badge:null,
            },
            {
              key:'history',
              icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
              label:'Lịch sử',
              badge:history.length||null,
            },
          ];
          return(
            <div role="tablist" style={{display:'flex',gap:7,marginBottom:16,padding:'0 2px'}}>
              {tabs.map(({key,icon,label,badge})=>{
                const active=mainTab===key;
                return(
                  <button
                    key={key}
                    role="tab"
                    aria-selected={active}
                    aria-controls={`panel-${key}`}
                    id={`tab-${key}`}
                    onClick={()=>handleSetMainTab(key)}
                    className="ls-main-tab"
                    style={{
                      flex:1,padding:'10px 8px',borderRadius:18,
                      border:`1.5px solid ${active?(dark?'#C084FC':'#A855F7'):(dark?'#421526':'#F5D5E8')}`,
                      background:active?'linear-gradient(135deg,#F472B6,#A855F7)':(dark?'#261018':'#FFFFFF'),
                      color:active?'#FFF':(dark?'#C898B8':'#6B3050'),
                      fontSize:12,fontWeight:900,cursor:'pointer',transition:'all .22s',
                      display:'flex',alignItems:'center',justifyContent:'center',gap:5,
                      boxShadow:active?'0 2px 6px rgba(168,85,247,0.18), 0 6px 18px rgba(168,85,247,0.28)':'none',
                      position:'relative',
                    }}>
                    {icon}
                    <span>{label}</span>
                    {badge&&(
                      <span style={{
                        fontSize:9,fontWeight:900,lineHeight:1,
                        background:active?'rgba(255,255,255,0.28)':'linear-gradient(135deg,#F472B6,#A855F7)',
                        color:'#fff',borderRadius:99,padding:'2px 6px',minWidth:16,textAlign:'center',
                      }}>{badge}</span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })()}

        {/* ══════════════════════ TAB: BÀI TẬP ══════════════════════ */}
        {mainTab==='lessons'&&(
          <div role="tabpanel" id="panel-lessons" aria-labelledby="tab-lessons">

            {/* ── Subject Tabs ── */}
            {!loading&&!fetchError&&(()=>{
              const tabDefs=[
                {key:'all',text:'Tất cả',count:tabCounts.all},
                {key:'english',text:'Tiếng Anh',count:tabCounts.english},
                {key:'other',text:'Các môn',count:tabCounts.other},
              ];
              const TabIcon=({k})=>{
                if(k==='all')return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 10h16M4 14h8M4 18h6"/></svg>;
                if(k==='english')return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8l4 4-4 4"/><path d="M12 16h7"/></svg>;
                return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
              };
              return(
                <div role="tablist" aria-label="Lọc theo môn học" style={{display:'flex',gap:8,marginBottom:14,padding:'0 2px'}}>
                  {tabDefs.map(({key,text,count})=>{
                    const active=filterTab===key;
                    return(
                      <button
                        key={key}
                        role="tab"
                        aria-selected={active}
                        onClick={()=>handleSetFilterTab(key)}
                        className="ls-filter-tab"
                        style={{
                          flex:1,padding:'9px 4px',borderRadius:18,
                          border:`1.5px solid ${active?(dark?'#C084FC':'#A855F7'):(dark?'#421526':'#F5D5E8')}`,
                          background:active?'linear-gradient(135deg,#F472B6,#A855F7)':(dark?'#261018':'#FFFFFF'),
                          color:active?'#FFF':(dark?'#C898B8':'#6B3050'),
                          fontSize:11,fontWeight:900,cursor:'pointer',transition:'all .22s',
                          display:'flex',flexDirection:'column',alignItems:'center',gap:3,
                          boxShadow:active?'0 2px 6px rgba(168,85,247,0.18), 0 6px 18px rgba(168,85,247,0.28)':'none',
                        }}>
                        <span style={{display:'flex',alignItems:'center',gap:4}}><TabIcon k={key}/><span style={{fontSize:11}}>{text}</span></span>
                        <span style={{
                          fontSize:10,fontWeight:800,
                          background:active?'rgba(255,255,255,0.25)':'transparent',
                          color:active?'rgba(255,255,255,0.9)':(dark?'#8A6080':'#A07090'),
                          borderRadius:99,padding:'1px 7px',
                          border:active?'none':`1px solid ${dark?'#421526':'#F0D0E0'}`,
                        }}>{count} bài</span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}

            {/* ── Shuffle Toggles ── */}
            {!loading&&!fetchError&&lessons.length>0&&(
              <div style={{display:'flex',gap:8,marginBottom:14}}>
                {[
                  {val:shuffleQ,set:setShuffleQ,label:'Xáo câu',color:'#F472B6',colorDark:'#F9A8D4',bgOn:'#FFE4ED',borderOn:'#F5D5E8'},
                  {val:shuffleA,set:setShuffleA,label:'Xáo đáp án',color:'#A855F7',colorDark:'#C084FC',bgOn:'#F0E6FF',borderOn:'#E8DCFF'},
                ].map(({val,set,label,color,colorDark,bgOn,borderOn})=>(
                  <button
                    key={label}
                    onClick={()=>set(v=>!v)}
                    className="ls-toggle-btn"
                    aria-pressed={val}
                    aria-label={label}
                    style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:7,padding:'8px 10px',borderRadius:999,
                      border:`1.5px solid ${val?borderOn:(dark?'#421526':'#F0D8E8')}`,
                      background:val?bgOn:(dark?'#261018':'#FFFFFF'),
                      color:val?(dark?colorDark:color):(dark?'#6A4860':'#B090A8'),
                      fontSize:12,fontWeight:800,cursor:'pointer',minWidth:0,
                      boxShadow:val?(dark?`0 2px 10px ${color}33`:`0 2px 10px ${color}22`):'none'}}>
                    <div className="ls-toggle-track" style={{width:32,height:18,borderRadius:99,background:val?color:(dark?'rgba(255,255,255,0.12)':'rgba(0,0,0,0.10)'),position:'relative',flexShrink:0}}>
                      <div className="ls-toggle-thumb" style={{position:'absolute',top:3,left:val?14:3,width:12,height:12,borderRadius:'50%',background:'#fff',boxShadow:'0 1px 4px rgba(0,0,0,0.28)'}}/>
                    </div>
                    <span style={{whiteSpace:'nowrap'}}>{label}</span>
                    {val&&<span style={{fontSize:9,fontWeight:900,color:dark?colorDark:color,background:dark?`${color}22`:`${color}15`,borderRadius:99,padding:'1px 5px',flexShrink:0}}>ON</span>}
                  </button>
                ))}
              </div>
            )}

            {/* ── Search + Sort ── */}
            {!loading&&!fetchError&&lessons.length>0&&(
              <div style={{marginBottom:18}}>
                <div style={{position:'relative',marginBottom:8}}>
                  <input
                    value={searchQuery}
                    onChange={e=>setSearchQuery(e.target.value)}
                    placeholder="🔍  Tìm bài tập..."
                    aria-label="Tìm bài tập"
                    style={{width:'100%',padding:'10px 14px 10px 38px',borderRadius:999,
                      border:`1.5px solid ${dark?(searchQuery?'#C084FC':'#421526'):(searchQuery?'#A855F7':'#F5D5E8')}`,
                      background:dark?'#261018':'#fff',color:dark?'#F0DCE8':'#3D1830',
                      fontSize:13,fontWeight:700,outline:'none',fontFamily:'Nunito,sans-serif',transition:'all .22s',
                      boxShadow:searchQuery?(dark?'0 0 0 3px rgba(192,132,252,0.18)':'0 0 0 3px rgba(168,85,247,0.12)'):'none'}}/>
                  <svg style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}
                    width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke={dark?(searchQuery?'#C084FC':'#8A6080'):(searchQuery?'#A855F7':'#A07090')}
                    strokeWidth="2.5" strokeLinecap="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  {searchQuery&&(
                    <button
                      onClick={handleClearSearch}
                      aria-label="Xóa tìm kiếm"
                      onMouseEnter={e=>{e.currentTarget.style.color='#F472B6';e.currentTarget.style.transform='translateY(-50%) scale(1.15)';}}
                      onMouseLeave={e=>{e.currentTarget.style.color=dark?'#8A6080':'#A07090';e.currentTarget.style.transform='translateY(-50%) scale(1)';}}
                      style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',
                        background:'none',border:'none',cursor:'pointer',color:dark?'#8A6080':'#A07090',fontSize:18,lineHeight:1,padding:0,transition:'color .15s,transform .15s'}}>
                      ×
                    </button>
                  )}
                </div>
                <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:2,scrollbarWidth:'none'}}>
                  {[['newest','🕐 Mới nhất'],['oldest','🕰 Cũ nhất'],['name','🔤 Tên A-Z'],['count','📝 Nhiều câu']].map(([k,l])=>(
                    <button
                      key={k}
                      onClick={()=>handleSetSortBy(k)}
                      aria-pressed={sortBy===k}
                      className={`ls-sort-btn ${sortBy===k?'active':'inactive'}`}
                      style={{flexShrink:0,padding:'6px 13px',borderRadius:12,fontSize:11,fontWeight:800,cursor:'pointer',
                        border:`1.5px solid ${sortBy===k?(dark?'#C084FC':'#A855F7'):(dark?'#2E0E20':'#EDD8E8')}`,
                        background:sortBy===k?(dark?'#2A1040':'#F0E6FF'):(dark?'#1E0A14':'#FAFAFA'),
                        color:sortBy===k?(dark?'#C084FC':'#A855F7'):(dark?'#5A3850':'#B090A8')}}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Loading Skeleton ── */}
            {loading&&(
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {[1,2,3].map(i=>(
                  <div key={i} style={{background:dark?'#261018':'#FFFFFF',border:`1.5px solid ${dark?'#421526':'#F5D5E8'}`,borderRadius:22,padding:'14px 15px',display:'flex',gap:12,alignItems:'flex-start'}}>
                    <div className="skeleton" style={{width:46,height:46,borderRadius:18,flexShrink:0}}/>
                    <div style={{flex:1,display:'flex',flexDirection:'column',gap:8}}>
                      <div className="skeleton" style={{height:16,borderRadius:8,width:'72%'}}/>
                      <div className="skeleton" style={{height:12,borderRadius:8,width:'50%'}}/>
                      <div style={{display:'flex',gap:6}}>
                        <div className="skeleton" style={{height:18,borderRadius:99,width:68}}/>
                        <div className="skeleton" style={{height:18,borderRadius:99,width:48}}/>
                      </div>
                    </div>
                    <div className="skeleton" style={{width:32,height:32,borderRadius:10,flexShrink:0}}/>
                  </div>
                ))}
              </div>
            )}

            {/* ── Fetch Error ── */}
            {fetchError&&!loading&&(
              <div style={{background:dark?'#261018':'#FFF5F9',border:`1.5px solid ${dark?'#421526':'#F5D5E8'}`,borderRadius:22,padding:'24px 20px',textAlign:'center',marginBottom:16}}>
                <div style={{fontSize:28,marginBottom:8}}>📂</div>
                <div style={{fontSize:14,fontWeight:900,color:dark?'#F0DCE8':'#3D1830',marginBottom:6}}>Chưa có bài nào</div>
                <div style={{fontSize:12,color:dark?'#8A6080':'#A07090',lineHeight:1.7}}>
                  Giáo viên chưa đăng bài tập lên.<br/>Vui lòng quay lại sau nhé! 🌸
                </div>
              </div>
            )}

            {/* ── Quiz List (filteredLessons từ useMemo) ── */}
            {!loading&&lessons.length>0&&(
              <div className="ls-lesson-grid" style={{marginTop:18}}>
                {filteredLessons.map((l,idx)=>{
                  const col=sc(l.subject);
                  const qc=l.questionCount||0;
                  return(
                    <div key={l.id} className="fade-up ripple-host ls-lesson-card"
                      style={{background:dark?'#261018':'#FFFFFF',border:`1.5px solid ${dark?'#421526':'#F5D5E8'}`,borderRadius:18,padding:'16px 15px',cursor:'pointer',transition:'all .22s',animation:`fadeUp .2s ${idx*0.05}s both`,boxShadow:dark?'0 1px 2px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.2)':'0 1px 2px rgba(120,40,90,0.04), 0 4px 12px rgba(160,92,222,0.08)'}}
                      onClick={(e)=>{ripple(e);onPlay(l);}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor='#C084FC';e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.boxShadow=dark?'0 2px 6px rgba(0,0,0,0.22), 0 12px 32px rgba(168,85,247,0.24)':'0 2px 6px rgba(120,40,90,0.05), 0 12px 32px rgba(168,85,247,0.18)';}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor=dark?'#421526':'#F5D5E8';e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow=dark?'0 1px 2px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.2)':'0 1px 2px rgba(120,40,90,0.04), 0 4px 12px rgba(160,92,222,0.08)';}}>
                      <div style={{display:'flex',alignItems:'center',gap:12}}>
                        <div style={{width:48,height:48,borderRadius:18,background:'linear-gradient(135deg,#FFE4ED,#F0E6FF)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:23,flexShrink:0,boxShadow:'inset 0 1px 2px rgba(255,255,255,0.6), 0 2px 6px rgba(168,85,247,0.12)'}}>
                          {l.emoji||'📝'}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div className="ls-title-card" style={{fontWeight:900,color:dark?'#F0DCE8':'#3D1830',marginBottom:3}}>{l.title}</div>
                          {l.description&&<div className="ls-desc" style={{color:dark?'#8A6080':'#A07090',marginBottom:7}}>{l.description}</div>}
                          <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
                            <span style={{fontSize:10,fontWeight:800,color:col.color,background:col.bg,border:`1px solid ${col.border}`,borderRadius:99,padding:'2px 8px'}}>{l.subject}</span>
                            {qc>0&&<span style={{fontSize:10,fontWeight:800,color:dark?'#C898B8':'#A07090',background:dark?'rgba(255,255,255,0.06)':'rgba(168,85,247,0.07)',border:`1px solid ${dark?'rgba(255,255,255,0.1)':'rgba(168,85,247,0.15)'}`,borderRadius:99,padding:'2px 8px'}}>{qc} câu</span>}
                            {l.password&&<span style={{fontSize:10,fontWeight:800,color:'#F97316',background:'#FFF7ED',border:'1px solid #FED7AA',borderRadius:99,padding:'2px 8px'}}>🔒 Có mật khẩu</span>}
                          </div>
                        </div>
                        <div className="ls-play-btn"
                          style={{width:38,height:38,borderRadius:12,background:'linear-gradient(135deg,#F472B6,#A855F7)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,boxShadow:'0 3px 10px rgba(168,85,247,0.35)',transition:'transform .15s, box-shadow .15s'}}>
                          <svg width="16" height="16" viewBox="0 0 20 20" fill="white" style={{marginLeft:2}}><path d="M7 4l9 6-9 6V4z"/></svg>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* ── Empty State ── */}
                {isEmpty&&(
                  <div style={{textAlign:'center',padding:'40px 24px 32px',animation:'fadeUp .22s both'}}>
                    <div style={{fontSize:52,marginBottom:12,lineHeight:1}}>
                      {isSearchEmpty?'🔍':filterTab==='english'?'📖':filterTab==='other'?'🎨':'😴'}
                    </div>
                    <div style={{fontSize:14,fontWeight:900,color:dark?'#F0DCE8':'#3D1830',marginBottom:6}}>
                      {isSearchEmpty?'Không tìm thấy bài nào':filterTab==='english'?'Chưa có bài Tiếng Anh':filterTab==='other'?'Chưa có bài các môn khác':'Hôm nay chưa có bài tập'}
                    </div>
                    <div style={{fontSize:12,color:dark?'#8A6080':'#A07090',lineHeight:1.7}}>
                      {isSearchEmpty?'Thử tìm với từ khóa khác nhé! ✨':filterTab==='other'?'Nghỉ ngơi chút rồi quay lại nhé! 🌸':'Hôm nay chưa có bài tập nào, nghỉ ngơi chút nhé! 🌸'}
                    </div>
                    {isSearchEmpty&&(
                      <button
                        onClick={handleClearSearch}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor='#A855F7';e.currentTarget.style.transform='translateY(-1px)';}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor=dark?'#421526':'#F5D5E8';e.currentTarget.style.transform='translateY(0)';}}
                        onMouseDown={e=>e.currentTarget.style.transform='scale(0.95)'}
                        onMouseUp={e=>e.currentTarget.style.transform='translateY(-1px)'}
                        style={{marginTop:12,padding:'7px 18px',borderRadius:999,border:`1.5px solid ${dark?'#421526':'#F5D5E8'}`,background:dark?'#261018':'#fff',color:dark?'#C898B8':'#A855F7',fontSize:12,fontWeight:800,cursor:'pointer',fontFamily:'inherit',transition:'all .15s'}}>
                        Xóa tìm kiếm
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════ TAB: LỊCH SỬ ══════════════════════ */}
        {mainTab==='history'&&(
          <div role="tabpanel" id="panel-history" aria-labelledby="tab-history" style={{paddingBottom:16}}>
            {history.length===0?(
              <div style={{textAlign:'center',padding:'48px 20px'}}>
                <div style={{fontSize:40,marginBottom:12}}>📭</div>
                <div style={{fontSize:14,fontWeight:900,color:dark?'#F0DCE8':'#3D1830',marginBottom:6}}>Chưa có lịch sử</div>
                <div style={{fontSize:12,color:dark?'#8A6080':'#A07090',lineHeight:1.7}}>
                  Làm bài xong sẽ lưu kết quả tại đây nhé! 🌸
                </div>
              </div>
            ):(
              <>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF6B95" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span style={{fontSize:12,fontWeight:900,color:dark?'#C898B8':'#6B3050',flex:1}}>
                    {history.length} lần làm
                  </span>
                  <button
                    onClick={onClearHistory}
                    onMouseEnter={e=>{e.currentTarget.style.background='rgba(239,68,68,0.15)';e.currentTarget.style.transform='translateY(-1px)';}}
                    onMouseLeave={e=>{e.currentTarget.style.background=dark?'#2D0A1A':'#FFF0F5';e.currentTarget.style.transform='translateY(0)';}}
                    onMouseDown={e=>e.currentTarget.style.transform='scale(0.95)'}
                    onMouseUp={e=>e.currentTarget.style.transform='translateY(-1px)'}
                    style={{padding:'4px 11px',borderRadius:999,border:`1.5px solid ${dark?'#421526':'#F5D5E8'}`,background:dark?'#2D0A1A':'#FFF0F5',color:'#EF4444',fontSize:11,fontWeight:800,cursor:'pointer',transition:'all .15s'}}>
                    Xóa tất cả
                  </button>
                </div>

                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {history.map((h,hi)=>{
                    const rc2=h.pct>=0.8?'#10B981':h.pct>=0.5?'#F59E0B':'#EF4444';
                    const bg2=h.pct>=0.8?(dark?'#0A2618':'#ECFDF5'):h.pct>=0.5?(dark?'#2A1208':'#FFF7ED'):(dark?'#2D0A1A':'#FFF0F5');
                    const bd2=h.pct>=0.8?'#BBF7D0':h.pct>=0.5?'#FED7AA':(dark?'#421526':'#F5D5E8');
                    const d=new Date(h.ts);
                    const dateStr=`${d.getDate()}/${d.getMonth()+1} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                    const col=sc(h.subject);
                    return(
                      <div key={hi} onClick={()=>onHistDetail(h)}
                        style={{background:dark?'#261018':'#FFFFFF',border:`1.5px solid ${dark?'#421526':'#F5D5E8'}`,borderRadius:20,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',transition:'all .18s',animation:`fadeUp .18s ${hi*0.03}s both`}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor=rc2;e.currentTarget.style.transform='translateY(-1px)';}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor=dark?'#421526':'#F5D5E8';e.currentTarget.style.transform='none';}}>

                        <div style={{width:50,height:50,borderRadius:18,background:bg2,border:`1.5px solid ${bd2}`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                          <span style={{fontSize:14,fontWeight:900,color:rc2,lineHeight:1}}>{Math.round(h.pct*100)}%</span>
                          <span style={{fontSize:9,fontWeight:700,color:rc2,opacity:0.75,marginTop:1}}>{typeof h.score==='number'?h.score.toFixed(1):h.score}/{h.total}</span>
                        </div>

                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:800,color:dark?'#F0DCE8':'#3D1830',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',marginBottom:3}}>
                            {h.lessonTitle}
                          </div>
                          <div style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap',marginBottom:h.perQ?5:0}}>
                            {h.subject&&(
                              <span style={{fontSize:9,fontWeight:800,color:col.color,background:col.bg,border:`1px solid ${col.border}`,borderRadius:99,padding:'1px 6px'}}>
                                {h.subject}
                              </span>
                            )}
                            <span style={{fontSize:11,color:dark?'#8A6080':'#A07090'}}>{dateStr} · {h.qCount||h.total} câu</span>
                          </div>
                          {h.perQ&&(
                            <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                              {h.perQ.map((pq,pi)=>(
                                <div key={pi} style={{width:7,height:7,borderRadius:'50%',flexShrink:0,background:pq.ok?'#10B981':pq.partial?'#F59E0B':'#EF4444',opacity:.85}}/>
                              ))}
                            </div>
                          )}
                        </div>

                        <svg width="13" height="13" viewBox="0 0 20 20" fill={dark?'#503040':'#C8A0B8'}><path d="M7 5l6 5-6 5V5z"/></svg>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

      </div>{/* end ls-body-pad */}

      {/* ══ Export Bottom Sheet — component riêng, luôn mount khi selectedIds tồn tại ══ */}
      <ExportBottomSheet
        open={exportOpen}
        lessons={lessons}
        exportMode={exportMode}
        setExportMode={setExportMode}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        shuffleQ={shuffleQ}
        shuffleA={shuffleA}
        onClose={handleCloseExport}
      />

    </div>
  );
}

window.HomeScreen=HomeScreen;
})();
