import React, {useState,useRef,useEffect} from 'react';

/* ══ LEARNSY UI COMPONENTS ════════════════════════════════════════════
   Depends on: React, colors.js (window.C, window.CL, window.CD)
   Load order:  colors.js → ui-components.js
   ══════════════════════════════════════════════════════════════════ */
(function(){

  /* ── SVG Icons (no color dependency) ── */
  const Flower=({s=16,c='#FFB7C9',style={}})=>(
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={{flexShrink:0,...style}}>
      {[0,72,144,216,288].map((deg,i)=>(
        <ellipse key={i} cx="12" cy="6" rx="3" ry="5.5" fill={c} opacity={i%2===0?0.9:0.7}
          transform={`rotate(${deg} 12 12)`}/>
      ))}
      <circle cx="12" cy="12" r="3.5" fill="#FFF5CC"/>
    </svg>
  );
  const Heart=({s=14,c='#F9A8D4',style={}})=>(
    <svg width={s} height={s} viewBox="0 0 20 20" fill={c} style={{flexShrink:0,...style}}>
      <path d="M10 17S2 11.5 2 6.5a4 4 0 0 1 8-1 4 4 0 0 1 8 1C18 11.5 10 17 10 17z"/>
    </svg>
  );
  const Star=({s=13,c='#FCD34D',style={}})=>(
    <svg width={s} height={s} viewBox="0 0 20 20" fill={c} style={{flexShrink:0,...style}}>
      <path d="M10 1.5 L12.47 7.35 L18.78 7.64 L14.09 11.89 L15.85 18.09 L10 14.55 L4.15 18.09 L5.91 11.89 L1.22 7.64 L7.53 7.35 Z"/>
    </svg>
  );
  const Sparkle=({s=14,c='#C084FC',style={}})=>(
    <svg width={s} height={s} viewBox="0 0 20 20" fill={c} style={{flexShrink:0,...style}}>
      <path d="M10 0 L11.5 8.5 L20 10 L11.5 11.5 L10 20 L8.5 11.5 L0 10 L8.5 8.5 Z"/>
    </svg>
  );
  const Bow=({s=28})=>(
    <svg width={s} height={Math.round(s*0.65)} viewBox="0 0 28 18" fill="none">
      <path d="M14 9 C11 5.5, 2 1.5, 1.5 5.5 C1 9, 9 12.5, 14 9Z" fill="#FFAEC9" opacity="0.8"/>
      <path d="M14 9 C17 5.5, 26 1.5, 26.5 5.5 C27 9, 19 12.5, 14 9Z" fill="#FFAEC9" opacity="0.8"/>
      <ellipse cx="14" cy="9" rx="2.8" ry="2.8" fill="#FF85A5"/>
    </svg>
  );

  /* ── Basic Input ── */
  const Inp=({value,onChange,placeholder,style={},multiline=false})=>{
    const C=window.C;
    const base={width:'100%',padding:'10px 13px',border:`1.5px solid ${C.border}`,borderRadius:12,
      fontSize:13,fontWeight:700,color:C.text,background:C.surface,outline:'none',
      transition:'border-color .2s,box-shadow .2s',fontFamily:'Nunito,sans-serif',...style};
    const [focus,setFocus]=useState(false);
    const s={...base,borderColor:focus?C.lav2:C.border,boxShadow:focus?`0 0 0 3px rgba(192,132,252,0.15)`:undefined};
    if(multiline)return <textarea value={value} onChange={onChange} placeholder={placeholder} onFocus={()=>setFocus(true)} onBlur={()=>setFocus(false)} style={{...s,minHeight:70,resize:'vertical'}}/>;
    return <input value={value} onChange={onChange} placeholder={placeholder} onFocus={()=>setFocus(true)} onBlur={()=>setFocus(false)} style={s}/>;
  };

  /* ── Rich Input (full toolbar) ── */
  const FMT_CMDS=[
    {cmd:'bold',        label:'B', tip:'In đậm',    fs:{fontWeight:900}},
    {cmd:'italic',      label:'I', tip:'In nghiêng',fs:{fontStyle:'italic'}},
    {cmd:'underline',   label:'U', tip:'Gạch chân', fs:{textDecoration:'underline'}},
    {cmd:'strikeThrough',label:'S',tip:'Gạch ngang',fs:{textDecoration:'line-through'}},
  ];
  const RichInp=({value,onChange,placeholder,style={}})=>{
    const C=window.C;
    const ref=useRef();
    const [focus,setFocus]=useState(false);
    // Mount-only init: set innerHTML once, never again — eliminates prop→DOM→onInput→onChange loop entirely
    const didMount=useRef(false);
    // Guard: ngăn execCommand/innerHTML trigger onInput → emit → vòng lặp vô tận
    const suppressRef=useRef(false);
    useEffect(()=>{
      if(!didMount.current&&ref.current){
        suppressRef.current=true;
        ref.current.innerHTML=value||'';
        suppressRef.current=false;
        didMount.current=true;
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    },[]);
    // External reset (e.g. switching question): only apply when value becomes empty string or when
    // the DOM diverges significantly and we are NOT focused — use a stable ref to track last emitted value
    const lastEmitted=useRef(value||'');
    useEffect(()=>{
      if(!ref.current||document.activeElement===ref.current)return;
      // Only write back when caller explicitly cleared or replaced content (not just a round-trip echo)
      if(value!==lastEmitted.current){
        suppressRef.current=true;
        ref.current.innerHTML=value||'';
        suppressRef.current=false;
        lastEmitted.current=value||'';
      }
    },[value]);

    const emit=()=>{
      if(suppressRef.current||!ref.current)return;
      const html=ref.current.innerHTML;
      lastEmitted.current=html;
      onChange({target:{value:html}});
    };
    const fmt=(cmd)=>{
      if(!ref.current)return;
      ref.current.focus();
      suppressRef.current=true;
      document.execCommand(cmd,false,null);
      suppressRef.current=false;
      emit();
    };

    const base={width:'100%',padding:'10px 13px',border:`1.5px solid ${C.border}`,borderRadius:12,
      fontSize:13,fontWeight:700,color:C.text,background:C.surface,outline:'none',
      transition:'border-color .2s,box-shadow .2s',fontFamily:'Nunito,sans-serif',
      minHeight:70,lineHeight:1.65,wordBreak:'break-word',overflowWrap:'break-word',
      cursor:'text',...style};
    const s={...base,borderColor:focus?C.lav2:C.border,boxShadow:focus?`0 0 0 3px rgba(192,132,252,0.15)`:undefined};

    return(
      <div>
        <div style={{display:'flex',gap:4,marginBottom:5,flexWrap:'wrap'}}>
          {FMT_CMDS.map(({cmd,label,tip,fs})=>(
            <button key={cmd} title={tip}
              onMouseDown={e=>{e.preventDefault();fmt(cmd);}}
              style={{padding:'3px 9px',borderRadius:7,border:`1.5px solid ${C.border2}`,
                background:C.lavL,color:C.lav,cursor:'pointer',fontSize:12,...fs,
                transition:'all .15s',flexShrink:0}}
              onMouseEnter={e=>e.currentTarget.style.background=C.lavPale}
              onMouseLeave={e=>e.currentTarget.style.background=C.lavL}>
              {label}
            </button>
          ))}
          <span style={{fontSize:10,color:C.text4,alignSelf:'center',marginLeft:2}}>← bôi đen rồi bấm</span>
        </div>
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          data-ph={placeholder}
          onInput={emit}
          onFocus={()=>{setFocus(true);setTimeout(()=>{if(ref.current&&!ref.current.textContent.trim()){suppressRef.current=true;['bold','italic','underline','strikeThrough'].forEach(cmd=>{if(document.queryCommandState(cmd))document.execCommand(cmd,false,null);});suppressRef.current=false;}},0);}}
          onBlur={()=>{setFocus(false);emit();}}
          style={s}
        />
      </div>
    );
  };

  /* ── Mini Rich Input (inline toolbar, appears on focus) ── */
  const MiniRichInp=({value,onChange,placeholder,style={}})=>{
    const C=window.C;
    const ref=useRef();
    const [focused,setFocused]=useState(false);
    // Mount-only init
    const didMount=useRef(false);
    const suppressRef=useRef(false);
    const blurTimerRef=useRef(null); // để cancel khi unmount
    useEffect(()=>{
      if(!didMount.current&&ref.current){
        suppressRef.current=true;
        ref.current.innerHTML=value||'';
        suppressRef.current=false;
        didMount.current=true;
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    },[]);
    useEffect(()=>()=>{
      if(blurTimerRef.current)clearTimeout(blurTimerRef.current);
    },[]);
    // External value change (e.g. load different question): only write when we are not focused
    // and value differs from what we last emitted — prevents round-trip loops
    const lastEmitted=useRef(value||'');
    useEffect(()=>{
      if(!ref.current||document.activeElement===ref.current)return;
      if(value!==lastEmitted.current){
        suppressRef.current=true;
        ref.current.innerHTML=value||'';
        suppressRef.current=false;
        lastEmitted.current=value||'';
      }
    },[value]);
    const emit=()=>{
      if(suppressRef.current||!ref.current)return;
      const html=ref.current.innerHTML;
      lastEmitted.current=html;
      onChange({target:{value:html}});
    };
    const fmt=(cmd)=>{
      if(!ref.current)return;
      ref.current.focus();
      suppressRef.current=true;
      document.execCommand(cmd,false,null);
      suppressRef.current=false;
      emit();
    };

    const s={padding:'8px 10px',border:`1.5px solid ${focused?C.lav2:C.border}`,
      borderRadius:focused?'0 0 10px 10px':10,fontSize:13,fontWeight:700,color:C.text,
      background:C.surface,outline:'none',lineHeight:1.5,wordBreak:'break-word',
      cursor:'text',transition:'border-color .2s,box-shadow .2s',
      boxShadow:focused?`0 0 0 3px rgba(192,132,252,0.15)`:undefined,...style};

    return(
      <div style={{flex:1,minWidth:0}}>
        {focused&&(
          <div style={{display:'flex',gap:2,padding:'2px 6px',background:C.lavL,
            border:`1.5px solid ${C.lav2}`,borderBottom:'none',borderRadius:'10px 10px 0 0'}}>
            {[{cmd:'bold',l:'B',fs:{fontWeight:900}},{cmd:'italic',l:'I',fs:{fontStyle:'italic'}},
              {cmd:'underline',l:'U',fs:{textDecoration:'underline'}},{cmd:'strikeThrough',l:'S',fs:{textDecoration:'line-through'}}
            ].map(({cmd,l,fs})=>(
              <button key={cmd} onMouseDown={e=>{e.preventDefault();fmt(cmd);}}
                style={{padding:'2px 7px',borderRadius:5,border:'none',background:'transparent',
                  color:C.lav,cursor:'pointer',fontSize:11,...fs}}>{l}</button>
            ))}
          </div>
        )}
        <div ref={ref} contentEditable suppressContentEditableWarning data-ph={placeholder}
          onInput={emit}
          onFocus={()=>{
            // Cancel blur timer nếu user focus lại trước khi timer chạy
            if(blurTimerRef.current){clearTimeout(blurTimerRef.current);blurTimerRef.current=null;}
            setFocused(true);
            setTimeout(()=>{if(ref.current&&!ref.current.textContent.trim()){suppressRef.current=true;['bold','italic','underline','strikeThrough'].forEach(cmd=>{if(document.queryCommandState(cmd))document.execCommand(cmd,false,null);});suppressRef.current=false;}},0);
          }}
          onBlur={()=>{
            blurTimerRef.current=setTimeout(()=>{
              blurTimerRef.current=null;
              setFocused(false);emit();
            },150);
          }}
          style={s}/>
      </div>
    );
  };


  /* ── Field Wrapper ── */
  const Fld=({label,children,icon})=>{
    const C=window.C;
    return(
      <div style={{marginBottom:11}}>
        <label style={{display:'flex',alignItems:'center',gap:5,fontSize:11,fontWeight:900,color:C.text2,textTransform:'uppercase',letterSpacing:.8,marginBottom:6}}>
          {icon&&<span style={{fontSize:12}}>{icon}</span>}{label}
        </label>
        {children}
      </div>
    );
  };

  /* ── Pill Button ── */
  const Pill=({onClick,children,variant='ghost',size='sm',disabled=false,style={}})=>{
    const C=window.C;
    const variants={
      primary:{background:C.grad,color:'#fff',border:'none',boxShadow:'0 3px 12px rgba(168,85,247,0.25)'},
      pink:{background:C.roseL,color:C.rose,border:`1.5px solid ${C.border}`},
      lav:{background:C.lavL,color:C.lav,border:`1.5px solid ${C.border2}`},
      green:{background:C.mintL,color:C.mint,border:'1.5px solid #BBF7D0'},
      ghost:{background:'transparent',color:C.text3,border:`1.5px solid ${C.border}`},
      danger:{background:C.rosePale,color:'#EF4444',border:'1.5px solid #FECDD3'},
    };
    const sizes={sm:{padding:'6px 12px',fontSize:12,borderRadius:999},md:{padding:'9px 18px',fontSize:13,borderRadius:999},lg:{padding:'12px 24px',fontSize:14,borderRadius:999}};
    const v=variants[variant]||variants.ghost;
    const sz=sizes[size]||sizes.sm;
    return(
      <button onClick={onClick} disabled={disabled}
        style={{...sz,...v,fontWeight:800,cursor:disabled?'default':'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center',gap:5,transition:'all .18s',opacity:disabled?.45:1,...style}}
        onMouseEnter={e=>{if(!disabled)e.currentTarget.style.transform='translateY(-1px)';}}
        onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';}}
        onMouseDown={e=>e.currentTarget.style.transform='scale(0.96)'}
        onMouseUp={e=>e.currentTarget.style.transform='translateY(-1px)'}>
        {children}
      </button>
    );
  };

  /* ── Question type config (dùng C + SVG icons trên) ── */
  const getTypes=()=>{
    const C=window.C;
    return {
      true_false:{label:'Đúng / Sai',short:'ĐS',icon:<Flower s={15} c="#C084FC"/>,color:C.lav,bg:C.lavL,pale:C.lavPale,border:C.border2},
      multiple:{label:'Trắc nghiệm 4 đáp án',short:'TN',icon:<Heart s={14} c="#FF8FAF"/>,color:C.rose,bg:C.roseL,pale:C.rosePale,border:C.border},
      multi_select:{label:'Chọn nhiều đáp án',short:'CN',icon:<Star s={13} c="#10B981"/>,color:C.mint,bg:C.mintL,pale:C.mintL,border:'#BBF7D0'},
      fill_blank:{label:'Điền chỗ trống',short:'ĐT',icon:<Sparkle s={13} c="#F97316"/>,color:C.peach,bg:C.peachL,pale:C.peachL,border:'#FED7AA'},
    };
  };

  /* ── Exports ── */
  window.Flower=Flower; window.Heart=Heart; window.Star=Star;
  window.Sparkle=Sparkle; window.Bow=Bow;
  window.Inp=Inp; window.RichInp=RichInp; window.MiniRichInp=MiniRichInp;
  window.Fld=Fld; window.Pill=Pill; window.getTypes=getTypes;
})();
