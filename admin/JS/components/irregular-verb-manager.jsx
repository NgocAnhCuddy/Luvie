import React, {useState,useEffect,useCallback,useMemo} from 'react';

// ══════════════════════════════════════════════════════════════════════
//  IRREGULAR VERB MANAGER — trang quản lý "Động từ bất quy tắc", tab riêng
//  cạnh "Từ vựng". Tương đương VocabularyManager nhưng cho bảng riêng
//  irregular_verb_sets / irregular_verbs (khác cấu trúc: base/past/participle/
//  meaning/group_label thay vì word/pos/ipa/meaning/example) và có công tắc
//  is_published (giống cơ chế Lesson category="practice") để ẩn/hiện bộ cho
//  Student — Student chỉ thấy bộ đã is_published=true.
//
//  Dữ liệu lưu trong Supabase: irregular_verb_sets, irregular_verbs
//
//  Cấu trúc:
//    irregular_verb_sets { id, title, description, sort_order, is_published, created_at }
//    irregular_verbs     { id, set_id, base, past, participle, meaning, group_label, sort_order, created_at }
//
//  SQL gợi ý:
//    create table irregular_verb_sets(
//      id uuid default gen_random_uuid() primary key,
//      title text not null, description text default '',
//      sort_order integer default 0, is_published boolean default false,
//      created_at timestamptz default now()
//    );
//    create table irregular_verbs(
//      id uuid default gen_random_uuid() primary key,
//      set_id uuid references irregular_verb_sets(id) on delete cascade,
//      base text not null, past text default '', participle text default '',
//      meaning text default '', group_label text default '',
//      sort_order integer default 0, created_at timestamptz default now()
//    );
//    alter table irregular_verb_sets enable row level security;
//    alter table irregular_verbs enable row level security;
//    create policy "public_read" on irregular_verb_sets for select to anon, authenticated using (true);
//    create policy "admin_write" on irregular_verb_sets for all to authenticated using (true) with check (true);
//    -- lặp lại 2 policy trên cho irregular_verbs
//
//  Props nhận từ app.jsx:
//    dark, C            — theme
//    confirm_, toast_   — dùng chung toàn app
// ══════════════════════════════════════════════════════════════════════
(function(){

  const fmtDate = d => { try{return new Date(d).toLocaleDateString('vi-VN');}catch(e){return '';} };

  /* ─────────────────────── ICONS ─────────────────────── */
  const IconChevron = ({open}) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{transition:'transform .25s cubic-bezier(.34,1.56,.64,1)', transform:open?'rotate(180deg)':'rotate(0deg)'}}>
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
  const IconPlus = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
  );
  const IconEdit = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
  );
  const IconTrash = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
  );
  const IconShuffle = ({size=15}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
  );
  const IconStack = ({size=15}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
  );
  const IconStar = ({size=14, color="#F59E0B"}) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill={color}><polygon points="10,1.5 12.6,7 18.5,7.8 14.2,11.8 15.4,17.6 10,14.7 4.6,17.6 5.8,11.8 1.5,7.8 7.4,7"/></svg>
  );
  const IconEye = ({size=14}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
  );
  const IconEyeOff = ({size=14}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
  );

  /* ─────────────────────── HELPERS: styles dùng chung ─────────────────────── */
  function useInputStyle(C){
    return useMemo(()=>({
      width:'100%', padding:'9px 11px', borderRadius:11,
      border:`1.5px solid ${C.border2}`, background:C.surface, color:C.text,
      fontSize:13.5, fontFamily:"'Nunito',sans-serif", fontWeight:600,
      outline:'none', boxSizing:'border-box', transition:'border-color .15s, box-shadow .15s',
    }),[C]);
  }
  const focusHandlers = C => ({
    onFocus: e=>{ e.currentTarget.style.borderColor = C.lav||'#a855f7'; e.currentTarget.style.boxShadow = `0 0 0 3px ${C.lav?C.lav+'26':'rgba(168,85,247,0.15)'}`; },
    onBlur: e=>{ e.currentTarget.style.borderColor = C.border2; e.currentTarget.style.boxShadow = 'none'; },
  });
  const labelStyleFor = C => ({ fontSize:11, fontWeight:800, color:C.text3, marginBottom:4, display:'block', letterSpacing:'.2px' });

  function PrimaryBtn({children, onClick, disabled, C, style, ...rest}){
    return(
      <button onClick={onClick} disabled={disabled} style={{
        display:'flex', alignItems:'center', justifyContent:'center', gap:6,
        padding:'11px 16px', borderRadius:999, border:'none',
        background:C.grad, color:'#fff', fontSize:13, fontWeight:900,
        cursor:disabled?'default':'pointer', boxShadow:'0 3px 14px rgba(168,85,247,0.3)',
        fontFamily:"'Nunito',sans-serif", transition:'all .18s', opacity:disabled?0.7:1,
        ...style,
      }}
        onMouseEnter={e=>{if(!disabled){e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 6px 20px rgba(168,85,247,0.42)';}}}
        onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 3px 14px rgba(168,85,247,0.3)';}}
        onMouseDown={e=>{if(!disabled)e.currentTarget.style.transform='scale(0.96)';}}
        onMouseUp={e=>{if(!disabled)e.currentTarget.style.transform='translateY(-2px)';}}
        {...rest}>
        {children}
      </button>
    );
  }

  function GhostBtn({children, onClick, disabled, C}){
    return(
      <button onClick={onClick} disabled={disabled} style={{
        flex:1, padding:'11px', borderRadius:999, border:`1.5px solid ${C.border2}`,
        background:'transparent', color:C.text2, fontSize:13, fontWeight:800,
        cursor:disabled?'not-allowed':'pointer', fontFamily:"'Nunito',sans-serif",
        transition:'all .15s', opacity:disabled?0.6:1,
      }}
        onMouseEnter={e=>{if(!disabled){e.currentTarget.style.background=C.bg2;e.currentTarget.style.transform='translateY(-1px)';}}}
        onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.transform='translateY(0)';}}>
        {children}
      </button>
    );
  }

  function IconBtn({onClick, title, danger, active, C, children}){
    return(
      <button onClick={onClick} title={title} style={{
        width:30, height:30, borderRadius:10, flexShrink:0,
        border: danger?'1.5px solid rgba(239,68,68,0.35)':`1.5px solid ${C.border2}`,
        background: danger?'rgba(239,68,68,0.08)':(active?C.lavL:C.bg2),
        color: danger?'#ef4444':C.lav,
        cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .15s',
      }}
        onMouseEnter={e=>{e.currentTarget.style.background= danger?'rgba(239,68,68,0.18)':C.lavL; e.currentTarget.style.transform='translateY(-1px)';}}
        onMouseLeave={e=>{e.currentTarget.style.background= danger?'rgba(239,68,68,0.08)':(active?C.lavL:C.bg2); e.currentTarget.style.transform='translateY(0)';}}
        onMouseDown={e=>e.currentTarget.style.transform='scale(0.9)'}
        onMouseUp={e=>e.currentTarget.style.transform='translateY(-1px)'}>
        {children}
      </button>
    );
  }

  // Toggle switch — công khai / ẩn bộ động từ
  function PublishSwitch({checked, onChange, C}){
    return(
      <button onClick={e=>{e.stopPropagation(); onChange(!checked);}} title={checked?'Đang công khai — bấm để ẩn':'Đang ẩn — bấm để công khai'} style={{
        display:'flex', alignItems:'center', gap:5, padding:'4px 9px 4px 4px', borderRadius:999, border:'none', cursor:'pointer',
        background: checked ? 'rgba(16,185,129,0.14)' : C.bg2, transition:'background .18s', flexShrink:0,
      }}>
        <span style={{
          width:30, height:17, borderRadius:99, background: checked?'#10B981':C.border2, position:'relative', transition:'background .18s', flexShrink:0,
        }}>
          <span style={{
            position:'absolute', top:2, left: checked?15:2, width:13, height:13, borderRadius:'50%', background:'#fff',
            transition:'left .18s cubic-bezier(.34,1.56,.64,1)', boxShadow:'0 1px 3px rgba(0,0,0,.25)',
          }}/>
        </span>
        <span style={{fontSize:10.5, fontWeight:800, color: checked?'#10B981':C.text3, display:'flex', alignItems:'center', gap:3}}>
          {checked ? <IconEye size={11}/> : <IconEyeOff size={11}/>} {checked?'Công khai':'Đang ẩn'}
        </span>
      </button>
    );
  }

  /* ─────────────────────── MODAL: Bộ động từ (thêm/sửa) ─────────────────────── */
  function SetModal({dark, C, initial, onClose, onSaved, toast_}){
    const isEdit = !!initial;
    const [title,setTitle] = useState(initial?.title||'');
    const [description,setDescription] = useState(initial?.description||'');
    const [saving,setSaving] = useState(false);
    const [err,setErr] = useState('');
    const inputStyle = useInputStyle(C);
    const fh = focusHandlers(C);

    async function handleSave(){
      if(!title.trim()){ setErr('Nhập tên bộ động từ nhé!'); return; }
      setSaving(true); setErr('');
      try{
        const row = { title: title.trim(), description: description.trim() };
        if(isEdit){
          const { error } = await window.supa.from('irregular_verb_sets').update(row).eq('id', initial.id);
          if(error) throw error;
        } else {
          const { error } = await window.supa.from('irregular_verb_sets').insert({ id: crypto.randomUUID(), ...row, sort_order:0, is_published:false, created_at: new Date().toISOString() });
          if(error) throw error;
        }
        toast_ && toast_(isEdit ? 'Đã cập nhật bộ động từ!' : 'Đã tạo bộ động từ mới!');
        onSaved();
      } catch(e){
        console.error('[iv-manager] set save error:', e);
        setErr(e.message || 'Có lỗi xảy ra, thử lại nhé!');
      } finally { setSaving(false); }
    }

    return(
      <div onClick={e=>{if(e.target===e.currentTarget && !saving) onClose();}}
        style={{position:'fixed', inset:0, zIndex:9200, background:'rgba(10,2,25,0.72)', backdropFilter:'blur(10px)', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:16, overflowY:'auto', WebkitOverflowScrolling:'touch'}}>
        <div style={{width:'100%', maxWidth:420, maxHeight:'min(85vh, 620px)', margin:'auto 0', borderRadius:24, background:dark?'#1E0D15':'#fff', border:`1.5px solid ${C.border2}`, boxShadow:'0 24px 60px rgba(0,0,0,.3)', animation:'pop .2s ease both', display:'flex', flexDirection:'column', overflow:'hidden'}}>
          <div style={{flex:'1 1 auto', minHeight:0, overflowY:'auto', WebkitOverflowScrolling:'touch', padding:'18px 18px 2px'}}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14}}>
              <div style={{fontSize:15, fontWeight:900, color:C.text, display:'flex', alignItems:'center', gap:7}}>
                <span style={{display:'flex', color:C.lav}}><IconShuffle size={16}/></span>
                {isEdit ? 'Sửa bộ động từ' : 'Tạo bộ động từ mới'}
              </div>
              <button onClick={onClose} disabled={saving} style={{width:26, height:26, borderRadius:99, border:`1.5px solid ${C.border2}`, background:C.bg2, color:C.text3, cursor:saving?'not-allowed':'pointer', fontSize:14, fontWeight:900, lineHeight:1, opacity:saving?0.5:1}}>×</button>
            </div>
            <div style={{marginBottom:10}}>
              <label style={labelStyleFor(C)}>Tên bộ động từ *</label>
              <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Vd: Global Success 12 — Unit 1-5" style={inputStyle} {...fh} autoFocus/>
            </div>
            <div style={{marginBottom:12}}>
              <label style={labelStyleFor(C)}>Mô tả</label>
              <textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Mô tả ngắn về bộ động từ..." rows={2} style={{...inputStyle, resize:'vertical'}} {...fh}/>
            </div>
            {err && <div style={{fontSize:12, fontWeight:700, color:'#ef4444', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:'8px 12px', marginBottom:12}}>{err}</div>}
          </div>
          <div style={{display:'flex', gap:8, padding:'12px 18px', borderTop:`1.5px solid ${C.border2}`, background:dark?'#1E0D15':'#fff', flexShrink:0}}>
            <GhostBtn onClick={onClose} disabled={saving} C={C}>Huỷ</GhostBtn>
            <PrimaryBtn onClick={handleSave} disabled={saving} C={C} style={{flex:2}}>{saving?'Đang lưu...':(isEdit?'Lưu thay đổi':'Tạo bộ động từ')}</PrimaryBtn>
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────────── PARSE PASTE TỰ ĐỘNG ───────────────────────
     Khớp logic parseBulkIrregularVerbs bên app Kotlin — nhận diện nhiều
     kiểu paste khác nhau: dán bảng (TAB/≥2 khoảng trắng), gõ tay dùng |,
     hoặc chỉ 3 cột (past === participle). */
  function parseIrregularVerbLine(rawLine){
    const line = rawLine.replace(/^\d+[.)]\s*/, '');
    let cols;
    if(line.includes('|')) cols = line.split('|').map(s=>s.trim());
    else if(line.includes('\t')) cols = line.split('\t').map(s=>s.trim());
    else cols = line.split(/\s{2,}/).map(s=>s.trim());
    cols = cols.filter(Boolean);
    if(cols.length===0) return null;
    const base = (cols[0]||'').trim();
    if(!base || !/[a-zA-ZÀ-ỹ]/.test(base[0])) return null;
    const cleanMeaning = raw => (raw||'').trim().replace(/^:/,'').trim();
    if(cols.length===1) return null;
    if(cols.length===2) return { base, past:cols[1], participle:cols[1], meaning:'' };
    if(cols.length===3) return { base, past:cols[1], participle:cols[1], meaning:cleanMeaning(cols[2]) };
    return { base, past:cols[1], participle:cols[2], meaning:cleanMeaning(cols[3]) };
  }
  function parseBulkIrregularVerbs(text){
    return text.split('\n').map(l=>l.trim()).filter(Boolean).map(parseIrregularVerbLine).filter(Boolean);
  }

  /* ─────────────────────── MODAL: Nhập nhanh nhiều động từ ─────────────────────── */
  function BulkVerbModal({dark, C, setId, onClose, onSaved, toast_}){
    const [text,setText] = useState('');
    const [saving,setSaving] = useState(false);
    const [err,setErr] = useState('');
    const inputStyle = useInputStyle(C);
    const fh = focusHandlers(C);

    const parsed = useMemo(()=>parseBulkIrregularVerbs(text), [text]);

    async function handleBulkSave(){
      if(parsed.length===0){ setErr('Chưa nhận diện được động từ hợp lệ nào!'); return; }
      setSaving(true); setErr('');
      try{
        const rows = parsed.map(r=>({ id: crypto.randomUUID(), set_id: setId, ...r, group_label:'', sort_order:0, created_at: new Date().toISOString() }));
        const { error } = await window.supa.from('irregular_verbs').insert(rows);
        if(error) throw error;
        toast_ && toast_(`Đã thêm ${rows.length} động từ!`);
        onSaved();
      } catch(e){
        console.error('[iv-manager] bulk verb save error:', e);
        setErr(e.message || 'Có lỗi xảy ra, thử lại nhé!');
      } finally { setSaving(false); }
    }

    return(
      <div onClick={e=>{if(e.target===e.currentTarget && !saving) onClose();}}
        style={{position:'fixed', inset:0, zIndex:9200, background:'rgba(10,2,25,0.72)', backdropFilter:'blur(10px)', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:16, overflowY:'auto', WebkitOverflowScrolling:'touch'}}>
        <div style={{width:'100%', maxWidth:560, maxHeight:'min(85vh, 680px)', margin:'auto 0', borderRadius:24, background:dark?'#1E0D15':'#fff', border:`1.5px solid ${C.border2}`, boxShadow:'0 24px 60px rgba(0,0,0,.3)', animation:'pop .2s ease both', display:'flex', flexDirection:'column', overflow:'hidden'}}>
          <div style={{flex:'1 1 auto', minHeight:0, overflowY:'auto', WebkitOverflowScrolling:'touch', padding:'18px 20px 2px'}}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6}}>
              <div style={{fontSize:15, fontWeight:900, color:C.text, display:'flex', alignItems:'center', gap:7}}>
                <span style={{display:'flex', color:C.lav}}><IconStack size={16}/></span>
                Nhập nhanh nhiều động từ
              </div>
              <button onClick={onClose} disabled={saving} style={{width:26, height:26, borderRadius:99, border:`1.5px solid ${C.border2}`, background:C.bg2, color:C.text3, cursor:saving?'not-allowed':'pointer', fontSize:14, fontWeight:900, lineHeight:1, opacity:saving?0.5:1}}>×</button>
            </div>
            <div style={{fontSize:11.5, color:C.text3, fontWeight:600, marginBottom:10}}>
              Dán trực tiếp từ bảng in/Word/Excel (tách bằng TAB hoặc ≥2 khoảng trắng), hoặc gõ tay dùng dấu | — mỗi dòng 1 động từ.
            </div>
            <textarea value={text} onChange={e=>{setText(e.target.value); setErr('');}}
              placeholder={"go        went      gone      đi\neat       ate       eaten     ăn\nshine  shone  shone  : chiếu sáng\ncut | cut | cut | cắt"}
              rows={7} style={{...inputStyle, resize:'vertical', fontFamily:'monospace', fontSize:12.5, marginBottom:12}} {...fh}/>

            <div style={{fontSize:11.5, fontWeight:800, color:C.text3, marginBottom:6}}>
              Xem trước: {parsed.length>0 ? `${parsed.length} động từ hợp lệ` : 'chưa có động từ nào'}
            </div>
            <div style={{maxHeight:180, overflowY:'auto', borderRadius:12, border:`1.5px solid ${C.border2}`, marginBottom:12}}>
              {parsed.length===0 ? (
                <div style={{padding:'14px 12px', fontSize:12, color:C.text3, textAlign:'center'}}>Dán động từ bên trên để xem trước ở đây</div>
              ) : parsed.map((r,i)=>(
                <div key={i} style={{display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderBottom: i<parsed.length-1?`1px solid ${C.border2}`:'none'}}>
                  <span style={{fontSize:12.5, fontWeight:800, color:C.text, minWidth:60}}>{r.base}</span>
                  <span style={{fontSize:11, color:'#F59E0B', fontWeight:700, minWidth:55}}>{r.past}</span>
                  <span style={{fontSize:11, color:'#10B981', fontWeight:700, minWidth:60}}>{r.participle}</span>
                  {r.meaning && <span style={{fontSize:11.5, color:C.text3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1}}>{r.meaning}</span>}
                </div>
              ))}
            </div>
            {err && <div style={{fontSize:12, fontWeight:700, color:'#ef4444', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:'8px 12px', marginBottom:12}}>{err}</div>}

            <div style={{background:C.surface||(dark?'#170A11':'#FAFAFA'), border:`1.5px solid ${C.border2}`, borderRadius:20, padding:'13px 15px', marginBottom:14}}>
              <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:11}}>
                <IconStar size={14}/>
                <span style={{fontSize:11, fontWeight:900, color:C.mint||'#10b981', textTransform:'uppercase', letterSpacing:'.8px'}}>Ví dụ định dạng văn bản</span>
              </div>
              {[
                ['Dán từ bảng in', C.lav, C.lavL, 'go        went      gone      đi'],
                ['Chỉ 3 cột (past = participle)', C.rose||'#e8547a', C.roseL||'rgba(232,84,122,0.12)', 'cut       cut       cắt'],
                ['Gõ tay dùng |', C.peach, C.peachL, 'eat | ate | eaten | ăn'],
              ].map(([k,c,bg,v])=>(
                <div key={k} style={{marginBottom:10}}>
                  <span style={{fontSize:11, fontWeight:900, color:c, background:bg, padding:'2px 9px', borderRadius:999}}>{k}</span>
                  <pre style={{marginTop:6, fontSize:11.5, color:C.text2, lineHeight:1.75, whiteSpace:'pre-wrap', fontFamily:'monospace', background:dark?'#120B10':'#FAFAFA', padding:'9px 11px', borderRadius:10, border:`1px solid ${C.border2}`}}>{v}</pre>
                </div>
              ))}
              <div style={{fontSize:11, color:C.text3, fontWeight:600, lineHeight:1.5}}>
                Thứ tự cột: <b style={{color:C.text2}}>nguyên thể · quá khứ · quá khứ phân từ · nghĩa</b> — có thể dán nhiều dòng cùng lúc.
              </div>
            </div>
          </div>
          <div style={{display:'flex', gap:8, padding:'12px 16px', borderTop:`1.5px solid ${C.border2}`, background:dark?'#1E0D15':'#fff', flexShrink:0}}>
            <GhostBtn onClick={onClose} disabled={saving} C={C}>Huỷ</GhostBtn>
            <PrimaryBtn onClick={handleBulkSave} disabled={saving || parsed.length===0} C={C} style={{flex:2}}>{saving?'Đang lưu...':`Thêm ${parsed.length||''} động từ`}</PrimaryBtn>
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────────── MODAL: Động từ (thêm/sửa) ─────────────────────── */
  function VerbModal({dark, C, setId, initial, onClose, onSaved, toast_}){
    const isEdit = !!initial;
    const [base,setBase] = useState(initial?.base||'');
    const [past,setPast] = useState(initial?.past||'');
    const [participle,setParticiple] = useState(initial?.participle||'');
    const [meaning,setMeaning] = useState(initial?.meaning||'');
    const [groupLabel,setGroupLabel] = useState(initial?.group_label||'');
    const [saving,setSaving] = useState(false);
    const [err,setErr] = useState('');
    const inputStyle = useInputStyle(C);
    const fh = focusHandlers(C);

    async function handleSave(){
      if(!base.trim() || !past.trim() || !participle.trim()){ setErr('Nhập đủ V1, V2, V3 nhé!'); return; }
      setSaving(true); setErr('');
      try{
        const row = { base: base.trim(), past: past.trim(), participle: participle.trim(), meaning: meaning.trim(), group_label: groupLabel.trim() };
        if(isEdit){
          const { error } = await window.supa.from('irregular_verbs').update(row).eq('id', initial.id);
          if(error) throw error;
        } else {
          const { error } = await window.supa.from('irregular_verbs').insert({ id: crypto.randomUUID(), set_id: setId, ...row, sort_order:0, created_at: new Date().toISOString() });
          if(error) throw error;
        }
        toast_ && toast_(isEdit ? 'Đã lưu thay đổi!' : 'Đã thêm động từ!');
        onSaved();
      } catch(e){
        console.error('[iv-manager] verb save error:', e);
        setErr(e.message || 'Có lỗi xảy ra, thử lại nhé!');
      } finally { setSaving(false); }
    }

    return(
      <div onClick={e=>{if(e.target===e.currentTarget && !saving) onClose();}}
        style={{position:'fixed', inset:0, zIndex:9200, background:'rgba(10,2,25,0.72)', backdropFilter:'blur(10px)', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:16, overflowY:'auto', WebkitOverflowScrolling:'touch'}}>
        <div style={{width:'100%', maxWidth:560, maxHeight:'min(85vh, 640px)', margin:'auto 0', borderRadius:24, background:dark?'#1E0D15':'#fff', border:`1.5px solid ${C.border2}`, boxShadow:'0 24px 60px rgba(0,0,0,.3)', animation:'pop .2s ease both', display:'flex', flexDirection:'column', overflow:'hidden'}}>
          <div style={{flex:'1 1 auto', minHeight:0, overflowY:'auto', WebkitOverflowScrolling:'touch', padding:'18px 20px 2px'}}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14}}>
              <div style={{fontSize:15, fontWeight:900, color:C.text}}>{isEdit?'Sửa động từ':'Thêm động từ'}</div>
              <button onClick={onClose} disabled={saving} style={{width:26, height:26, borderRadius:99, border:`1.5px solid ${C.border2}`, background:C.bg2, color:C.text3, cursor:saving?'not-allowed':'pointer', fontSize:14, fontWeight:900, lineHeight:1, opacity:saving?0.5:1}}>×</button>
            </div>
            <div style={{display:'flex', flexWrap:'wrap', gap:10, marginBottom:10}}>
              <div style={{flex:'1 1 140px'}}>
                <label style={labelStyleFor(C)}>V1 — Nguyên thể *</label>
                <input value={base} onChange={e=>setBase(e.target.value)} placeholder="go" style={inputStyle} {...fh} autoFocus/>
              </div>
              <div style={{flex:'1 1 140px'}}>
                <label style={{...labelStyleFor(C), color:'#F59E0B'}}>V2 — Quá khứ *</label>
                <input value={past} onChange={e=>setPast(e.target.value)} placeholder="went" style={inputStyle} {...fh}/>
              </div>
              <div style={{flex:'1 1 140px'}}>
                <label style={{...labelStyleFor(C), color:'#10B981'}}>V3 — Phân từ *</label>
                <input value={participle} onChange={e=>setParticiple(e.target.value)} placeholder="gone" style={inputStyle} {...fh}/>
              </div>
            </div>
            <div style={{display:'flex', flexWrap:'wrap', gap:10, marginBottom:12}}>
              <div style={{flex:'2 1 220px'}}>
                <label style={labelStyleFor(C)}>Nghĩa tiếng Việt</label>
                <input value={meaning} onChange={e=>setMeaning(e.target.value)} placeholder="đi" style={inputStyle} {...fh}/>
              </div>
              <div style={{flex:'1 1 160px'}}>
                <label style={labelStyleFor(C)}>Nhãn nhóm (tuỳ chọn)</label>
                <input value={groupLabel} onChange={e=>setGroupLabel(e.target.value)} placeholder="Vd: I. Cả 3 giống nhau" style={inputStyle} {...fh}/>
              </div>
            </div>
            {err && <div style={{fontSize:12, fontWeight:700, color:'#ef4444', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:'8px 12px', marginBottom:12}}>{err}</div>}
          </div>
          <div style={{display:'flex', gap:8, padding:'12px 16px', borderTop:`1.5px solid ${C.border2}`, background:dark?'#1E0D15':'#fff', flexShrink:0}}>
            <GhostBtn onClick={onClose} disabled={saving} C={C}>Huỷ</GhostBtn>
            <PrimaryBtn onClick={handleSave} disabled={saving} C={C} style={{flex:2}}>{saving?'Đang lưu...':(isEdit?'Lưu thay đổi':'Thêm động từ')}</PrimaryBtn>
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────────── HÀNG ĐỘNG TỪ ─────────────────────── */
  function VerbRow({v, dark, C, onEdit, onDelete, index}){
    return(
      <div style={{
        display:'flex', alignItems:'flex-start', gap:10, padding:'11px 12px',
        borderRadius:18, background:C.surfaceGlass||C.surface, backdropFilter:C.surfaceBlur, WebkitBackdropFilter:C.surfaceBlur, border:`1.5px solid ${C.border}`,
        animation:`fadeUp .22s cubic-bezier(.16,1,.3,1) both`, animationDelay:`${Math.min(index*0.03,0.3)}s`,
        transition:'transform .15s ease, box-shadow .15s ease, border-color .15s ease',
      }}
        onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 4px 14px rgba(168,85,247,0.1)'; }}
        onMouseLeave={e=>{ e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none'; }}>
        <div style={{flex:1, minWidth:0}}>
          <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
            <span style={{fontSize:14.5, fontWeight:900, color:C.text}}>{v.base}</span>
            <span style={{fontSize:12.5, fontWeight:800, color:'#F59E0B'}}>{v.past}</span>
            <span style={{fontSize:12.5, fontWeight:800, color:'#10B981'}}>{v.participle}</span>
          </div>
          {v.meaning && <div style={{fontSize:13, color:C.text2, marginTop:3, fontWeight:600}}>{v.meaning}</div>}
          {v.group_label && <div style={{fontSize:11, color:C.text3, marginTop:2, fontStyle:'italic'}}>{v.group_label}</div>}
        </div>
        <div style={{display:'flex', gap:6, flexShrink:0}}>
          <IconBtn onClick={()=>onEdit(v)} title="Sửa" C={C}><IconEdit/></IconBtn>
          <IconBtn onClick={()=>onDelete(v)} title="Xoá" danger C={C}><IconTrash/></IconBtn>
        </div>
      </div>
    );
  }

  /* ─────────────────────── KHỐI BỘ ĐỘNG TỪ (accordion) ─────────────────────── */
  function SetBlock({set, dark, C, confirm_, toast_, onChanged, defaultOpen}){
    const [open,setOpen] = useState(!!defaultOpen);
    const [verbs,setVerbs] = useState([]);
    const [loaded,setLoaded] = useState(false);
    const [verbModal,setVerbModal] = useState(null); // null | {} (add) | verb (edit)
    const [bulkModal,setBulkModal] = useState(false);
    const [setModal,setSetModal] = useState(false);
    const [togglingPub,setTogglingPub] = useState(false);

    const fetchVerbs = useCallback(async ()=>{
      try{
        const { data, error } = await window.supa.from('irregular_verbs')
          .select('*').eq('set_id', set.id).order('sort_order',{ascending:true}).order('created_at',{ascending:true});
        if(error) throw error;
        setVerbs(data||[]);
      } catch(e){
        console.error('[iv-manager] fetch verbs error:', e);
        toast_ && toast_('Không tải được động từ của bộ này');
      } finally { setLoaded(true); }
    },[set.id, toast_]);

    useEffect(()=>{ if(open && !loaded) fetchVerbs(); },[open, loaded, fetchVerbs]);

    async function doDeleteVerb(v){
      try{
        const { error } = await window.supa.from('irregular_verbs').delete().eq('id', v.id);
        if(error) throw error;
        setVerbs(prev=>prev.filter(x=>x.id!==v.id));
        toast_ && toast_('Đã xoá động từ');
      } catch(e){
        console.error('[iv-manager] delete verb error:', e);
        toast_ && toast_('Xoá thất bại, thử lại nhé!');
      }
    }
    function handleDeleteVerb(v){
      if(confirm_){
        confirm_({ title:'Xoá động từ?', message:`"${v.base}" sẽ bị xoá vĩnh viễn.`, confirmLabel:'Xoá', danger:true, onConfirm:()=>doDeleteVerb(v) });
      } else if(window.confirm(`Xoá "${v.base}"?`)){ doDeleteVerb(v); }
    }

    async function doDeleteSet(){
      try{
        const { error } = await window.supa.from('irregular_verb_sets').delete().eq('id', set.id);
        if(error) throw error;
        toast_ && toast_('Đã xoá bộ động từ');
        onChanged();
      } catch(e){
        console.error('[iv-manager] delete set error:', e);
        toast_ && toast_('Xoá thất bại, thử lại nhé!');
      }
    }
    function handleDeleteSet(e){
      e.stopPropagation();
      if(confirm_){
        confirm_({ title:'Xoá bộ động từ?', message:`"${set.title}" và toàn bộ động từ bên trong sẽ bị xoá vĩnh viễn.`, confirmLabel:'Xoá', danger:true, onConfirm:doDeleteSet });
      } else if(window.confirm(`Xoá "${set.title}" và toàn bộ động từ?`)){ doDeleteSet(); }
    }

    async function handleTogglePublish(next){
      setTogglingPub(true);
      try{
        const { error } = await window.supa.from('irregular_verb_sets').update({ is_published: next }).eq('id', set.id);
        if(error) throw error;
        toast_ && toast_(next ? 'Đã công khai cho học sinh!' : 'Đã ẩn khỏi học sinh');
        onChanged();
      } catch(e){
        console.error('[iv-manager] toggle publish error:', e);
        toast_ && toast_('Lưu thất bại, thử lại nhé!');
      } finally { setTogglingPub(false); }
    }

    return(
      <div style={{
        borderRadius:22, border:`1.5px solid ${C.border}`, overflow:'hidden',
        background:dark?'rgba(255,255,255,0.02)':'rgba(52,211,153,0.02)',
        boxShadow: open ? '0 6px 22px rgba(52,211,153,0.12)' : '0 2px 8px rgba(52,211,153,0.05)',
        transition:'box-shadow .25s ease',
      }}>
        <div onClick={()=>setOpen(p=>!p)} style={{
          display:'flex', alignItems:'center', gap:10, padding:'14px 16px', cursor:'pointer',
          background: open ? (dark?'rgba(52,211,153,0.06)':'rgba(52,211,153,0.05)') : 'transparent', transition:'background .2s',
        }}
          onMouseEnter={e=>{ if(!open) e.currentTarget.style.background = dark?'rgba(255,255,255,0.03)':'rgba(52,211,153,0.035)'; }}
          onMouseLeave={e=>{ if(!open) e.currentTarget.style.background = 'transparent'; }}>
          <span style={{display:'flex', color:C.lav, flexShrink:0}}><IconChevron open={open}/></span>
          <div style={{
            width:36, height:36, borderRadius:12, flexShrink:0, background:'linear-gradient(135deg,#34D399,#38BDF8)',
            display:'flex', alignItems:'center', justifyContent:'center', color:'#fff',
            boxShadow:'0 3px 10px rgba(52,211,153,0.3)',
            transform: open ? 'scale(1.06)' : 'scale(1)', transition:'transform .25s cubic-bezier(.34,1.56,.64,1)',
          }}>
            <IconShuffle size={17}/>
          </div>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:14.5, fontWeight:900, color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{set.title}</div>
            <div style={{fontSize:11.5, color:C.text3, marginTop:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
              {set.description || (loaded ? `${verbs.length} động từ` : 'Bấm để xem động từ')}
            </div>
          </div>
          <div style={{display:'flex', gap:6, flexShrink:0, alignItems:'center'}} onClick={e=>e.stopPropagation()}>
            <PublishSwitch checked={!!set.is_published} onChange={handleTogglePublish} C={C}/>
            <IconBtn onClick={()=>setSetModal(true)} title="Sửa bộ" C={C}><IconEdit/></IconBtn>
            <IconBtn onClick={handleDeleteSet} title="Xoá bộ" danger C={C}><IconTrash/></IconBtn>
          </div>
        </div>

        {open && (
          <div style={{padding:'12px 14px 16px', display:'flex', flexDirection:'column', gap:10, borderTop:`1.5px solid ${C.border}`, animation:'fadeUp .18s ease both'}}>
            <div style={{display:'flex', gap:8}}>
              <button onClick={()=>setVerbModal({})} style={{
                flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'9px', borderRadius:12,
                border:`1.5px dashed ${C.lav2}`, background:'transparent', color:C.lav, fontSize:12.5, fontWeight:800,
                cursor:'pointer', fontFamily:"'Nunito',sans-serif", transition:'all .15s',
              }}
                onMouseEnter={e=>{e.currentTarget.style.background=C.lavPale;}}
                onMouseLeave={e=>{e.currentTarget.style.background='transparent';}}>
                <IconPlus/> Thêm động từ
              </button>
              <button onClick={()=>setBulkModal(true)} title="Nhập nhiều động từ cùng lúc" style={{
                display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'9px 12px', borderRadius:12,
                border:`1.5px dashed ${C.lav2}`, background:'transparent', color:C.lav, fontSize:12.5, fontWeight:800,
                cursor:'pointer', fontFamily:"'Nunito',sans-serif", transition:'all .15s', whiteSpace:'nowrap',
              }}
                onMouseEnter={e=>{e.currentTarget.style.background=C.lavPale;}}
                onMouseLeave={e=>{e.currentTarget.style.background='transparent';}}>
                <IconStack/> Nhập nhanh
              </button>
            </div>

            {!loaded && (
              <div style={{display:'flex', flexDirection:'column', gap:8}}>
                {[0,1].map(i=>(<div key={i} style={{height:52, borderRadius:18, background:C.bg2, opacity:0.6}}/>))}
              </div>
            )}
            {loaded && verbs.length===0 && (
              <div style={{textAlign:'center', padding:'18px 10px', fontSize:12.5, color:C.text3, fontWeight:600}}>Chưa có động từ nào trong bộ này</div>
            )}
            {loaded && verbs.map((v,i)=>(
              <VerbRow key={v.id} v={v} dark={dark} C={C} index={i}
                onEdit={()=>setVerbModal(v)} onDelete={handleDeleteVerb}/>
            ))}
          </div>
        )}

        {verbModal!==null && (
          <VerbModal dark={dark} C={C} setId={set.id} initial={verbModal.id?verbModal:null}
            onClose={()=>setVerbModal(null)}
            onSaved={()=>{ setVerbModal(null); fetchVerbs(); }}
            toast_={toast_}/>
        )}
        {bulkModal && (
          <BulkVerbModal dark={dark} C={C} setId={set.id}
            onClose={()=>setBulkModal(false)}
            onSaved={()=>{ setBulkModal(false); fetchVerbs(); }}
            toast_={toast_}/>
        )}
        {setModal && (
          <SetModal dark={dark} C={C} initial={set}
            onClose={()=>setSetModal(false)}
            onSaved={()=>{ setSetModal(false); onChanged(); }}
            toast_={toast_}/>
        )}
      </div>
    );
  }

  /* ══ IRREGULAR VERB MANAGER (main export) ══ */
  function IrregularVerbManager({dark, C, confirm_, toast_}){
    const [sets,setSets] = useState([]);
    const [loading,setLoading] = useState(true);
    const [search,setSearch] = useState('');
    const [setModal,setSetModal] = useState(false);

    const fetchSets = useCallback(async ()=>{
      setLoading(true);
      try{
        const { data, error } = await window.supa.from('irregular_verb_sets')
          .select('*').order('sort_order',{ascending:true}).order('created_at',{ascending:false});
        if(error) throw error;
        setSets(data||[]);
      } catch(e){
        console.error('[iv-manager] fetch sets error:', e);
        toast_ && toast_('Không tải được danh sách bộ động từ');
      } finally { setLoading(false); }
    },[toast_]);

    useEffect(()=>{ fetchSets(); },[fetchSets]);

    const filtered = useMemo(()=>{
      const q = search.trim().toLowerCase();
      if(!q) return sets;
      return sets.filter(s=>(s.title||'').toLowerCase().includes(q) || (s.description||'').toLowerCase().includes(q));
    },[sets,search]);

    const publishedCount = sets.filter(s=>s.is_published).length;

    return(
      <div style={{padding:'16px 12px 100px', display:'flex', flexDirection:'column', gap:14}} className="fade-up">
        <div style={{display:'flex', alignItems:'center', gap:10}}>
          <div style={{flex:1, position:'relative'}}>
            <span style={{position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:C.text3, display:'flex'}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm bộ động từ..."
              style={{width:'100%', padding:'10px 12px 10px 34px', borderRadius:18, border:`1.5px solid ${C.border2}`, background:C.surface, color:C.text, fontSize:13, outline:'none', fontFamily:"'Nunito',sans-serif", fontWeight:600, boxSizing:'border-box'}}/>
          </div>
          <PrimaryBtn onClick={()=>setSetModal(true)} C={C} style={{whiteSpace:'nowrap', background:'linear-gradient(135deg,#34D399,#38BDF8)', boxShadow:'0 3px 14px rgba(52,211,153,0.3)'}}>
            <IconPlus/> Thêm bộ động từ
          </PrimaryBtn>
        </div>

        <div style={{fontSize:12, color:C.text3, fontWeight:700}}>
          {sets.length} bộ động từ · {publishedCount} đang công khai {search && `· ${filtered.length} khớp tìm kiếm`}
        </div>

        {loading && (
          <div style={{display:'flex', flexDirection:'column', gap:10}}>
            {[0,1,2].map(i=>(<div key={i} style={{height:66, borderRadius:22, background:C.surface, border:`1.5px solid ${C.border}`, opacity:0.5}}/>))}
          </div>
        )}

        {!loading && filtered.length===0 && (
          <div style={{
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
            minHeight:'34vh', gap:12, padding:'32px 20px', textAlign:'center', animation:'fadeUp .3s ease both',
            borderRadius:22, border:`1.5px solid ${C.border}`,
            background:dark?'rgba(255,255,255,0.02)':'rgba(52,211,153,0.02)',
          }}>
            <span style={{
              display:'flex', color:'#34D399', opacity:0.7, animation:'bb-float 3s ease-in-out infinite',
              width:64, height:64, borderRadius:'50%', background:dark?'rgba(52,211,153,0.1)':'rgba(52,211,153,0.08)', alignItems:'center', justifyContent:'center',
            }}><IconShuffle size={30}/></span>
            <div style={{fontSize:14.5, fontWeight:900, color:C.text2, fontFamily:"'Baloo 2',cursive"}}>{search ? 'Không tìm thấy bộ động từ' : 'Chưa có bộ động từ nào'}</div>
            <div style={{fontSize:12, color:C.text3}}>{search ? 'Thử từ khoá khác nhé' : 'Bấm "Thêm bộ động từ" để tạo bộ đầu tiên'}</div>
          </div>
        )}

        {!loading && filtered.length>0 && (
          <div style={{display:'flex', flexDirection:'column', gap:10}}>
            {filtered.map(s=>(
              <SetBlock key={s.id} set={s} dark={dark} C={C} confirm_={confirm_} toast_={toast_} onChanged={fetchSets}/>
            ))}
          </div>
        )}

        {setModal && (
          <SetModal dark={dark} C={C} initial={null}
            onClose={()=>setSetModal(false)}
            onSaved={()=>{ setSetModal(false); fetchSets(); }}
            toast_={toast_}/>
        )}
      </div>
    );
  }

  window.IrregularVerbManager = IrregularVerbManager;
})();
