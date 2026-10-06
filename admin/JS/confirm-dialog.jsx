import React from 'react';

/* ══ CONFIRM-DIALOG.JSX ═════════════════════════════════════════════════
   iconType: 'add' | 'copy' | 'delete' | 'key' | 'warn'
════════════════════════════════════════════════════════════════════════ */
(function(){
const {useEffect,useRef} = React;
const e = React.createElement;

function hexToRgb(hex){
  if(!hex||hex[0]!=='#')return'168,85,247';
  const r=parseInt(hex.slice(1,3),16)||0;
  const g=parseInt(hex.slice(3,5),16)||0;
  const b=parseInt(hex.slice(5,7),16)||0;
  return r+','+g+','+b;
}

/* SVG icons — plain React.createElement, không dùng JSX */
function IconSVG({iconType,color}){
  const base={width:32,height:32,viewBox:'0 0 24 24',fill:'none',
    stroke:color,strokeWidth:'1.8',strokeLinecap:'round',strokeLinejoin:'round'};
  if(iconType==='add') return e('svg',base,
    e('path',{key:'p',d:'M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z'})
  );
  if(iconType==='copy') return e('svg',base,
    e('rect',{key:'r',x:'9',y:'9',width:'13',height:'13',rx:'2'}),
    e('path',{key:'p',d:'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'})
  );
  if(iconType==='delete') return e('svg',base,
    e('polyline',{key:'a',points:'3 6 5 6 21 6'}),
    e('path',{key:'b',d:'M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6'}),
    e('path',{key:'c',d:'M10 11v6M14 11v6'}),
    e('path',{key:'d',d:'M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2'})
  );
  if(iconType==='key') return e('svg',base,
    e('path',{key:'p',d:'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4'})
  );
  // warn (default)
  return e('svg',base,
    e('path',{key:'p',d:'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z'}),
    e('line',{key:'a',x1:'12',y1:'9',x2:'12',y2:'13'}),
    e('line',{key:'b',x1:'12',y1:'17',x2:'12.01',y2:'17'})
  );
}

function ConfirmDialog({open,onClose,dark}){
  const C = window.C;
  const btnRef = useRef();

  useEffect(()=>{
    if(open&&btnRef.current)setTimeout(()=>{btnRef.current&&btnRef.current.focus();},120);
  },[open]);

  useEffect(()=>{
    if(!open)return;
    const h=(ev)=>{if(ev.key==='Escape')onClose();};
    document.addEventListener('keydown',h);
    return()=>document.removeEventListener('keydown',h);
  },[open,onClose]);

  if(!open)return null;

  const{
    iconType='warn',
    title='Xác nhận',
    message='',
    confirmLabel='Xác nhận',
    confirmColor='#EF4444',
    confirmGrad=null,
    onConfirm,
  }=open;

  const rgb=hexToRgb(confirmColor);
  const card=dark?'rgba(38,16,24,0.98)':'#ffffff';
  const bord=dark?'rgba(255,100,150,0.18)':'#F5D5E8';
  const tMain=dark?'#F0DCE8':'#3D1830';
  const tSub=dark?'#8A6080':'#A07090';

  const handleConfirm=()=>{onConfirm&&onConfirm();onClose();};

  return(
    <div onClick={(ev)=>{if(ev.target===ev.currentTarget)onClose();}}
      style={{position:'fixed',inset:0,zIndex:9200,display:'flex',alignItems:'center',
        justifyContent:'center',padding:20,
        background:dark?'rgba(12,4,18,0.88)':'rgba(255,240,248,0.82)',
        backdropFilter:'blur(18px)'}}>
      <div style={{background:card,border:`1.5px solid ${bord}`,borderRadius:28,
        padding:'28px 22px 22px',maxWidth:310,width:'100%',textAlign:'center',
        boxShadow:'0 16px 48px rgba(168,85,247,0.18)',animation:'pop .22s ease both'}}>

        {/* Icon badge */}
        <div style={{width:64,height:64,borderRadius:24,margin:'0 auto 16px',
          background:`rgba(${rgb},0.12)`,
          border:`1.5px solid rgba(${rgb},0.22)`,
          display:'flex',alignItems:'center',justifyContent:'center'}}>
          <IconSVG iconType={iconType} color={confirmColor}/>
        </div>

        <div style={{fontSize:16,fontWeight:900,color:tMain,marginBottom:8}}>{title}</div>

        {message&&(
          <div style={{fontSize:13,color:tSub,marginBottom:22,lineHeight:1.6}}
            dangerouslySetInnerHTML={{__html:message}}/>
        )}

        <div style={{display:'flex',gap:8}}>
          <button onClick={onClose}
            style={{flex:1,padding:'10px',borderRadius:999,
              border:`1.5px solid ${bord}`,background:'transparent',
              color:tSub,fontSize:13,fontWeight:800,
              fontFamily:"'Nunito',sans-serif",cursor:'pointer',transition:'all .18s'}}
            onMouseEnter={e=>e.currentTarget.style.background=dark?'rgba(255,255,255,0.05)':(C&&C.bg2||'#FEF0F7')}
            onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            Huỷ
          </button>
          <button ref={btnRef} onClick={handleConfirm}
            style={{flex:1,padding:'10px',borderRadius:999,border:'none',
              background:confirmGrad||confirmColor,color:'#fff',
              fontSize:13,fontWeight:900,fontFamily:"'Nunito',sans-serif",
              cursor:'pointer',transition:'all .18s',
              boxShadow:`0 4px 16px rgba(${rgb},0.35)`}}
            onMouseEnter={e=>e.currentTarget.style.opacity='0.88'}
            onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

window.ConfirmDialog = ConfirmDialog;
console.log('[confirm-dialog] ✓ loaded');
})();