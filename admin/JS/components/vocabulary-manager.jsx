import React, {useState,useEffect,useCallback,useMemo,useRef} from 'react';

// ══════════════════════════════════════════════════════════════════════
//  VOCABULARY MANAGER — trang độc lập, quản lý Bài học > Unit > Từ vựng
//  Hiện ở tab riêng "Từ vựng" cạnh "Bài học" / "Listening" / "Tài liệu" / "Học sinh".
//  Dữ liệu lưu trong Supabase: vocab_courses, vocab_units, vocab_words,
//  vocab_word_families, vocab_word_forms
//
//  Cấu trúc:
//    vocab_courses  { id, title, description, sort_order, created_at }
//    vocab_units    { id, course_id, title, level, sort_order, created_at }
//    vocab_words    { id, unit_id, word, pos, ipa, meaning, example, sort_order, created_at }
//
//  ★ CẬP NHẬT: thêm "Gia đình từ" (word family) — cùng cấp với vocab_words,
//  hiển thị ở tab con riêng trong mỗi Unit. 1 gia đình từ = 1 từ gốc
//  (base_word, vd "energy"), bên trong có nhiều form theo loại từ khác
//  nhau (energetic/energize/energetically...). Khớp
//  admin/data/Vocabulary.kt + VocabularyRepository.kt bên app Android.
//    vocab_word_families { id, unit_id, base_word, meaning, sort_order, created_at }
//    vocab_word_forms    { id, family_id, pos, form, meaning, ipa, sort_order, created_at }
//
//  SQL gợi ý:
//    create table vocab_courses(
//      id uuid default gen_random_uuid() primary key,
//      title text not null, description text default '',
//      sort_order integer default 0, created_at timestamptz default now()
//    );
//    create table vocab_units(
//      id uuid default gen_random_uuid() primary key,
//      course_id uuid references vocab_courses(id) on delete cascade,
//      title text not null, level text default '',
//      sort_order integer default 0, created_at timestamptz default now()
//    );
//    create table vocab_words(
//      id uuid default gen_random_uuid() primary key,
//      unit_id uuid references vocab_units(id) on delete cascade,
//      word text not null, pos text default 'noun', ipa text default '',
//      meaning text default '', example text default '',
//      sort_order integer default 0, created_at timestamptz default now()
//    );
//    create table vocab_word_families(
//      id uuid default gen_random_uuid() primary key,
//      unit_id uuid references vocab_units(id) on delete cascade,
//      base_word text not null, meaning text default '',
//      sort_order integer default 0, created_at timestamptz default now()
//    );
//    create table vocab_word_forms(
//      id uuid default gen_random_uuid() primary key,
//      family_id uuid references vocab_word_families(id) on delete cascade,
//      pos text default 'noun', form text not null,
//      meaning text default '', ipa text default '',
//      sort_order integer default 0, created_at timestamptz default now()
//    );
//    alter table vocab_courses enable row level security;
//    alter table vocab_units enable row level security;
//    alter table vocab_words enable row level security;
//    alter table vocab_word_families enable row level security;
//    alter table vocab_word_forms enable row level security;
//    create policy "public_read" on vocab_courses for select to anon, authenticated using (true);
//    create policy "admin_write" on vocab_courses for all to authenticated using (true) with check (true);
//    -- lặp lại 2 policy trên cho vocab_units, vocab_words, vocab_word_families, vocab_word_forms
//
//  Props nhận từ app.jsx:
//    dark, C            — theme
//    confirm_, toast_   — dùng chung toàn app
// ══════════════════════════════════════════════════════════════════════
(function(){

  const POS_OPTIONS = [
    { value:'noun', label:'Danh từ', short:'n.' },
    { value:'verb', label:'Động từ', short:'v.' },
    { value:'adjective', label:'Tính từ', short:'adj.' },
    { value:'adverb', label:'Trạng từ', short:'adv.' },
    { value:'pronoun', label:'Đại từ', short:'pron.' },
    { value:'preposition', label:'Giới từ', short:'prep.' },
    { value:'conjunction', label:'Liên từ', short:'conj.' },
    { value:'interjection', label:'Thán từ', short:'interj.' },
  ];
  const POS_COLORS = {
    noun:'#3b82f6', verb:'#ef4444', adjective:'#f59e0b', adverb:'#10b981',
    pronoun:'#a855f7', preposition:'#06b6d4', conjunction:'#f97316', interjection:'#ec4899',
  };
  const posLabel = p => POS_OPTIONS.find(o=>o.value===p)?.short || p;
  const posColor = p => POS_COLORS[p] || '#9ca3af';

  // Nhận diện loại từ viết tắt/tiếng Việt lúc nhập nhanh (VD: "dt", "n", "danh từ" → noun)
  const POS_ALIASES = {
    n:'noun', noun:'noun', dt:'noun', 'danh từ':'noun', 'danh tu':'noun',
    v:'verb', verb:'verb', đt:'verb', 'động từ':'verb', 'dong tu':'verb',
    adj:'adjective', adjective:'adjective', tt:'adjective', 'tính từ':'adjective', 'tinh tu':'adjective',
    adv:'adverb', adverb:'adverb', trt:'adverb', 'trạng từ':'adverb', 'trang tu':'adverb',
    pron:'pronoun', pronoun:'pronoun', dait:'pronoun', 'đại từ':'pronoun', 'dai tu':'pronoun',
    prep:'preposition', preposition:'preposition', gt:'preposition', 'giới từ':'preposition', 'gioi tu':'preposition',
    conj:'conjunction', conjunction:'conjunction', lt:'conjunction', 'liên từ':'conjunction', 'lien tu':'conjunction',
    interj:'interjection', interjection:'interjection', tht:'interjection', 'thán từ':'interjection', 'than tu':'interjection',
  };
  const parsePos = raw => {
    const key = (raw||'').trim().toLowerCase();
    if(!key) return 'noun';
    return POS_ALIASES[key] || 'noun';
  };
  const fmtDate = d => { try{return new Date(d).toLocaleDateString('vi-VN');}catch(e){return '';} };

  // Mỗi dòng "loại từ | form | phiên âm | nghĩa" — vd: "tt | energetic | /ˌenərˈdʒetɪk/ | đầy năng lượng"
  // Nếu chỉ 1 cột (không có dấu |), coi đó là form, loại từ mặc định "noun".
  const parseBulkForms = text => {
    return text.split('\n').map(line=>line.trim()).filter(Boolean).map(line=>{
      const parts = line.split('|').map(p=>p.trim());
      const hasExplicitPos = parts.length >= 2;
      const form = hasExplicitPos ? (parts[1]||'') : (parts[0]||'');
      if(!form) return null;
      return {
        pos: hasExplicitPos ? parsePos(parts[0]) : 'noun',
        form,
        ipa: hasExplicitPos ? (parts[2]||'') : (parts[1]||''),
        meaning: hasExplicitPos ? (parts[3]||'') : (parts[2]||''),
      };
    }).filter(Boolean);
  };

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
  const IconBook = ({size=14}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
  );
  const IconStack = ({size=15}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
  );
  const IconStar = ({size=14, color="#F59E0B"}) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill={color}><polygon points="10,1.5 12.6,7 18.5,7.8 14.2,11.8 15.4,17.6 10,14.7 4.6,17.6 5.8,11.8 1.5,7.8 7.4,7"/></svg>
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

  function IconBtn({onClick, title, danger, C, children}){
    return(
      <button onClick={onClick} title={title} style={{
        width:30, height:30, borderRadius:10, flexShrink:0,
        border: danger?'1.5px solid rgba(239,68,68,0.35)':`1.5px solid ${C.border2}`,
        background: danger?'rgba(239,68,68,0.08)':C.bg2,
        color: danger?'#ef4444':C.lav,
        cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .15s',
      }}
        onMouseEnter={e=>{e.currentTarget.style.background= danger?'rgba(239,68,68,0.18)':C.lavL; e.currentTarget.style.transform='translateY(-1px)';}}
        onMouseLeave={e=>{e.currentTarget.style.background= danger?'rgba(239,68,68,0.08)':C.bg2; e.currentTarget.style.transform='translateY(0)';}}
        onMouseDown={e=>e.currentTarget.style.transform='scale(0.9)'}
        onMouseUp={e=>e.currentTarget.style.transform='translateY(-1px)'}>
        {children}
      </button>
    );
  }

  /* ─────────────────────── MODAL: Bài học (thêm/sửa) ─────────────────────── */
  function LessonModal({dark, C, initial, onClose, onSaved, toast_}){
    const isEdit = !!initial;
    const [title,setTitle] = useState(initial?.title||'');
    const [description,setDescription] = useState(initial?.description||'');
    const [saving,setSaving] = useState(false);
    const [err,setErr] = useState('');
    const inputStyle = useInputStyle(C);
    const fh = focusHandlers(C);

    async function handleSave(){
      if(!title.trim()){ setErr('Nhập tên bài học nhé!'); return; }
      setSaving(true); setErr('');
      try{
        const row = { title: title.trim(), description: description.trim() };
        if(isEdit){
          const { error } = await window.supa.from('vocab_courses').update(row).eq('id', initial.id);
          if(error) throw error;
        } else {
          const { error } = await window.supa.from('vocab_courses').insert({ id: crypto.randomUUID(), ...row, sort_order:0 });
          if(error) throw error;
        }
        toast_ && toast_(isEdit ? 'Đã cập nhật bài học!' : 'Đã tạo bài học mới!');
        onSaved();
      } catch(e){
        console.error('[vocab-manager] lesson save error:', e);
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
                <span style={{display:'flex', color:C.lav}}><IconBook size={16}/></span>
                {isEdit ? 'Sửa bài học' : 'Tạo bài học mới'}
              </div>
              <button onClick={onClose} disabled={saving} style={{width:26, height:26, borderRadius:99, border:`1.5px solid ${C.border2}`, background:C.bg2, color:C.text3, cursor:saving?'not-allowed':'pointer', fontSize:14, fontWeight:900, lineHeight:1, opacity:saving?0.5:1}}>×</button>
            </div>
            <div style={{marginBottom:10}}>
              <label style={labelStyleFor(C)}>Tên bài học *</label>
              <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Vd: Tiếng Anh Cơ Bản A1" style={inputStyle} {...fh} autoFocus/>
            </div>
            <div style={{marginBottom:12}}>
              <label style={labelStyleFor(C)}>Mô tả</label>
              <textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Mô tả ngắn về bài học..." rows={2} style={{...inputStyle, resize:'vertical'}} {...fh}/>
            </div>
            {err && <div style={{fontSize:12, fontWeight:700, color:'#ef4444', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:'8px 12px', marginBottom:12}}>{err}</div>}
          </div>
          <div style={{display:'flex', gap:8, padding:'12px 18px', borderTop:`1.5px solid ${C.border2}`, background:dark?'#1E0D15':'#fff', flexShrink:0}}>
            <GhostBtn onClick={onClose} disabled={saving} C={C}>Huỷ</GhostBtn>
            <PrimaryBtn onClick={handleSave} disabled={saving} C={C} style={{flex:2}}>{saving?'Đang lưu...':(isEdit?'Lưu thay đổi':'Tạo bài học')}</PrimaryBtn>
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────────── MODAL: Unit (thêm/sửa) ─────────────────────── */
  function UnitModal({dark, C, courseId, initial, onClose, onSaved, toast_}){
    const isEdit = !!initial;
    const [title,setTitle] = useState(initial?.title||'');
    const [level,setLevel] = useState(initial?.level||'');
    const [saving,setSaving] = useState(false);
    const [err,setErr] = useState('');
    const inputStyle = useInputStyle(C);
    const fh = focusHandlers(C);

    async function handleSave(){
      if(!title.trim()){ setErr('Nhập tên bài học nhé!'); return; }
      setSaving(true); setErr('');
      try{
        const row = { title: title.trim(), level: level.trim() };
        if(isEdit){
          const { error } = await window.supa.from('vocab_units').update(row).eq('id', initial.id);
          if(error) throw error;
        } else {
          const { error } = await window.supa.from('vocab_units').insert({ id: crypto.randomUUID(), course_id: courseId, ...row, sort_order:0 });
          if(error) throw error;
        }
        toast_ && toast_(isEdit ? 'Đã cập nhật Unit!' : 'Đã tạo Unit mới!');
        onSaved();
      } catch(e){
        console.error('[vocab-manager] unit save error:', e);
        setErr(e.message || 'Có lỗi xảy ra, thử lại nhé!');
      } finally { setSaving(false); }
    }

    return(
      <div onClick={e=>{if(e.target===e.currentTarget && !saving) onClose();}}
        style={{position:'fixed', inset:0, zIndex:9200, background:'rgba(10,2,25,0.72)', backdropFilter:'blur(10px)', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:16, overflowY:'auto', WebkitOverflowScrolling:'touch'}}>
        <div style={{width:'100%', maxWidth:420, maxHeight:'min(85vh, 620px)', margin:'auto 0', borderRadius:24, background:dark?'#1E0D15':'#fff', border:`1.5px solid ${C.border2}`, boxShadow:'0 24px 60px rgba(0,0,0,.3)', animation:'pop .2s ease both', display:'flex', flexDirection:'column', overflow:'hidden'}}>
          <div style={{flex:'1 1 auto', minHeight:0, overflowY:'auto', WebkitOverflowScrolling:'touch', padding:'18px 18px 2px'}}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14}}>
              <div style={{fontSize:15, fontWeight:900, color:C.text}}>{isEdit?'Sửa Unit':'Tạo Unit mới'}</div>
              <button onClick={onClose} disabled={saving} style={{width:26, height:26, borderRadius:99, border:`1.5px solid ${C.border2}`, background:C.bg2, color:C.text3, cursor:saving?'not-allowed':'pointer', fontSize:14, fontWeight:900, lineHeight:1, opacity:saving?0.5:1}}>×</button>
            </div>
            <div style={{marginBottom:10}}>
              <label style={labelStyleFor(C)}>Tên bài học *</label>
              <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Vd: Unit 1 - Greetings" style={inputStyle} {...fh} autoFocus/>
            </div>
            <div style={{marginBottom:12}}>
              <label style={labelStyleFor(C)}>Level</label>
              <input value={level} onChange={e=>setLevel(e.target.value)} placeholder="Vd: Beginner, A1, A2..." style={inputStyle} {...fh}/>
            </div>
            {err && <div style={{fontSize:12, fontWeight:700, color:'#ef4444', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:'8px 12px', marginBottom:12}}>{err}</div>}
          </div>
          <div style={{display:'flex', gap:8, padding:'12px 16px', borderTop:`1.5px solid ${C.border2}`, background:dark?'#1E0D15':'#fff', flexShrink:0}}>
            <GhostBtn onClick={onClose} disabled={saving} C={C}>Huỷ</GhostBtn>
            <PrimaryBtn onClick={handleSave} disabled={saving} C={C} style={{flex:2}}>{saving?'Đang lưu...':(isEdit?'Lưu thay đổi':'Tạo Unit')}</PrimaryBtn>
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────────── MODAL: Nhập nhanh nhiều từ vựng ─────────────────────── */
  function BulkWordModal({dark, C, unitId, onClose, onSaved, toast_}){
    const [text,setText] = useState('');
    const [saving,setSaving] = useState(false);
    const [err,setErr] = useState('');
    const inputStyle = useInputStyle(C);
    const fh = focusHandlers(C);

    // Mỗi dòng: từ | loại từ | phiên âm | nghĩa | ví dụ  (chỉ "từ" bắt buộc, phần sau tuỳ chọn)
    const parsed = useMemo(()=>{
      return text.split('\n').map(line=>line.trim()).filter(Boolean).map(line=>{
        const parts = line.split('|').map(p=>p.trim());
        const [word, posRaw, ipa, meaning, example] = parts;
        return { word: word||'', pos: parsePos(posRaw), ipa: ipa||'', meaning: meaning||'', example: example||'' };
      }).filter(r=>r.word);
    }, [text]);

    async function handleBulkSave(){
      if(parsed.length===0){ setErr('Chưa có từ vựng hợp lệ nào để thêm!'); return; }
      setSaving(true); setErr('');
      try{
        const rows = parsed.map(r=>({ id: crypto.randomUUID(), unit_id: unitId, ...r, sort_order:0 }));
        const { error } = await window.supa.from('vocab_words').insert(rows);
        if(error) throw error;
        toast_ && toast_(`Đã thêm ${rows.length} từ vựng!`);
        onSaved();
      } catch(e){
        console.error('[vocab-manager] bulk word save error:', e);
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
                Nhập nhanh nhiều từ vựng
              </div>
              <button onClick={onClose} disabled={saving} style={{width:26, height:26, borderRadius:99, border:`1.5px solid ${C.border2}`, background:C.bg2, color:C.text3, cursor:saving?'not-allowed':'pointer', fontSize:14, fontWeight:900, lineHeight:1, opacity:saving?0.5:1}}>×</button>
            </div>
            <div style={{fontSize:11.5, color:C.text3, fontWeight:600, marginBottom:10}}>
              Mỗi dòng 1 từ vựng — xem ví dụ định dạng bên dưới.
            </div>
            <textarea value={text} onChange={e=>{setText(e.target.value); setErr('');}}
              placeholder={"hello | dt | /həˈloʊ/ | xin chào | Hello, how are you?\nrun | đt | /rʌn/ | chạy\napple | dt"}
              rows={7} style={{...inputStyle, resize:'vertical', fontFamily:'monospace', fontSize:12.5, marginBottom:12}} {...fh}/>

            <div style={{fontSize:11.5, fontWeight:800, color:C.text3, marginBottom:6}}>
              Xem trước: {parsed.length>0 ? `${parsed.length} từ vựng hợp lệ` : 'chưa có từ nào'}
            </div>
            <div style={{maxHeight:180, overflowY:'auto', borderRadius:12, border:`1.5px solid ${C.border2}`, marginBottom:12}}>
              {parsed.length===0 ? (
                <div style={{padding:'14px 12px', fontSize:12, color:C.text3, textAlign:'center'}}>Nhập từ vựng bên trên để xem trước ở đây</div>
              ) : parsed.map((r,i)=>(
                <div key={i} style={{display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderBottom: i<parsed.length-1?`1px solid ${C.border2}`:'none'}}>
                  <span style={{fontSize:12.5, fontWeight:800, color:C.text, minWidth:70}}>{r.word}</span>
                  <span style={{fontSize:9.5, fontWeight:800, color:posColor(r.pos), background:posColor(r.pos)+'1c', padding:'2px 6px', borderRadius:6, flexShrink:0}}>{posLabel(r.pos)}</span>
                  {r.meaning && <span style={{fontSize:11.5, color:C.text3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1}}>{r.meaning}</span>}
                </div>
              ))}
            </div>
            {err && <div style={{fontSize:12, fontWeight:700, color:'#ef4444', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:'8px 12px', marginBottom:12}}>{err}</div>}

            {/* Ví dụ định dạng văn bản */}
            <div style={{background:C.surface||(dark?'#170A11':'#FAFAFA'), border:`1.5px solid ${C.border2}`, borderRadius:20, padding:'13px 15px', marginBottom:14}}>
              <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:11}}>
                <IconStar size={14}/>
                <span style={{fontSize:11, fontWeight:900, color:C.mint||'#10b981', textTransform:'uppercase', letterSpacing:'.8px'}}>Ví dụ định dạng văn bản</span>
              </div>
              {[
                ['Đầy đủ', C.lav, C.lavL, 'hello | dt | /həˈloʊ/ | xin chào | Hello, how are you?'],
                ['Chỉ loại từ', C.rose||'#e8547a', C.roseL||'rgba(232,84,122,0.12)', 'run | đt'],
                ['Chỉ từ vựng', C.peach, C.peachL, 'apple'],
              ].map(([k,c,bg,v])=>(
                <div key={k} style={{marginBottom:10}}>
                  <span style={{fontSize:11, fontWeight:900, color:c, background:bg, padding:'2px 9px', borderRadius:999}}>{k}</span>
                  <pre style={{marginTop:6, fontSize:11.5, color:C.text2, lineHeight:1.75, whiteSpace:'pre-wrap', fontFamily:'monospace', background:dark?'#120B10':'#FAFAFA', padding:'9px 11px', borderRadius:10, border:`1px solid ${C.border2}`}}>{v}</pre>
                </div>
              ))}
              <div style={{fontSize:11, color:C.text3, fontWeight:600, lineHeight:1.5}}>
                Thứ tự cột: <b style={{color:C.text2}}>từ | loại từ | phiên âm | nghĩa | ví dụ</b> — chỉ từ vựng bắt buộc, có thể dán nhiều dòng cùng lúc.
              </div>
            </div>
          </div>
          <div style={{display:'flex', gap:8, padding:'12px 16px', borderTop:`1.5px solid ${C.border2}`, background:dark?'#1E0D15':'#fff', flexShrink:0}}>
            <GhostBtn onClick={onClose} disabled={saving} C={C}>Huỷ</GhostBtn>
            <PrimaryBtn onClick={handleBulkSave} disabled={saving || parsed.length===0} C={C} style={{flex:2}}>{saving?'Đang lưu...':`Thêm ${parsed.length||''} từ vựng`}</PrimaryBtn>
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────────── MODAL: Từ vựng (thêm/sửa) ─────────────────────── */
  function WordModal({dark, C, unitId, initial, onClose, onSaved, toast_}){
    const isEdit = !!initial;
    const [word,setWord] = useState(initial?.word||'');
    const [pos,setPos] = useState(initial?.pos||'noun');
    const [ipa,setIpa] = useState(initial?.ipa||'');
    const [meaning,setMeaning] = useState(initial?.meaning||'');
    const [example,setExample] = useState(initial?.example||'');
    const [saving,setSaving] = useState(false);
    const [err,setErr] = useState('');
    const inputStyle = useInputStyle(C);
    const fh = focusHandlers(C);

    async function handleSave(){
      if(!word.trim()){ setErr('Nhập từ vựng nhé!'); return; }
      setSaving(true); setErr('');
      try{
        const row = { word: word.trim(), pos, ipa: ipa.trim(), meaning: meaning.trim(), example: example.trim() };
        if(isEdit){
          const { error } = await window.supa.from('vocab_words').update(row).eq('id', initial.id);
          if(error) throw error;
        } else {
          const { error } = await window.supa.from('vocab_words').insert({ id: crypto.randomUUID(), unit_id: unitId, ...row, sort_order:0 });
          if(error) throw error;
        }
        toast_ && toast_(isEdit ? 'Đã lưu thay đổi!' : 'Đã thêm từ vựng!');
        onSaved();
      } catch(e){
        console.error('[vocab-manager] word save error:', e);
        setErr(e.message || 'Có lỗi xảy ra, thử lại nhé!');
      } finally { setSaving(false); }
    }

    return(
      <div onClick={e=>{if(e.target===e.currentTarget && !saving) onClose();}}
        style={{position:'fixed', inset:0, zIndex:9200, background:'rgba(10,2,25,0.72)', backdropFilter:'blur(10px)', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:16, overflowY:'auto', WebkitOverflowScrolling:'touch'}}>
        <div style={{width:'100%', maxWidth:560, maxHeight:'min(85vh, 620px)', margin:'auto 0', borderRadius:24, background:dark?'#1E0D15':'#fff', border:`1.5px solid ${C.border2}`, boxShadow:'0 24px 60px rgba(0,0,0,.3)', animation:'pop .2s ease both', display:'flex', flexDirection:'column', overflow:'hidden'}}>
          <div style={{flex:'1 1 auto', minHeight:0, overflowY:'auto', WebkitOverflowScrolling:'touch', padding:'18px 20px 2px'}}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14}}>
              <div style={{fontSize:15, fontWeight:900, color:C.text}}>{isEdit?'Sửa từ vựng':'Thêm từ vựng'}</div>
              <button onClick={onClose} disabled={saving} style={{width:26, height:26, borderRadius:99, border:`1.5px solid ${C.border2}`, background:C.bg2, color:C.text3, cursor:saving?'not-allowed':'pointer', fontSize:14, fontWeight:900, lineHeight:1, opacity:saving?0.5:1}}>×</button>
            </div>
            <div style={{display:'flex', flexWrap:'wrap', gap:10, marginBottom:10}}>
              <div style={{flex:'2 1 160px'}}>
                <label style={labelStyleFor(C)}>Từ vựng *</label>
                <input value={word} onChange={e=>setWord(e.target.value)} placeholder="Vd: Hello" style={inputStyle} {...fh} autoFocus/>
              </div>
              <div style={{flex:'1 1 110px'}}>
                <label style={labelStyleFor(C)}>Loại từ</label>
                <select value={pos} onChange={e=>setPos(e.target.value)} style={{...inputStyle, cursor:'pointer'}} {...fh}>
                  {POS_OPTIONS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div style={{flex:'1 1 110px'}}>
                <label style={labelStyleFor(C)}>Phiên âm (IPA)</label>
                <input value={ipa} onChange={e=>setIpa(e.target.value)} placeholder="/həˈloʊ/" style={inputStyle} {...fh}/>
              </div>
            </div>
            <div style={{display:'flex', flexWrap:'wrap', gap:10, marginBottom:12}}>
              <div style={{flex:'1 1 220px'}}>
                <label style={labelStyleFor(C)}>Nghĩa</label>
                <textarea value={meaning} onChange={e=>setMeaning(e.target.value)} placeholder="Giải thích nghĩa..." rows={3} style={{...inputStyle, resize:'vertical', minHeight:78}} {...fh}/>
              </div>
              <div style={{flex:'1 1 220px'}}>
                <label style={labelStyleFor(C)}>Ví dụ</label>
                <textarea value={example} onChange={e=>setExample(e.target.value)} placeholder="Câu ví dụ..." rows={3} style={{...inputStyle, resize:'vertical', minHeight:78}} {...fh}/>
              </div>
            </div>
            {err && <div style={{fontSize:12, fontWeight:700, color:'#ef4444', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:'8px 12px', marginBottom:12}}>{err}</div>}
          </div>
          <div style={{display:'flex', gap:8, padding:'12px 16px', borderTop:`1.5px solid ${C.border2}`, background:dark?'#1E0D15':'#fff', flexShrink:0}}>
            <GhostBtn onClick={onClose} disabled={saving} C={C}>Huỷ</GhostBtn>
            <PrimaryBtn onClick={handleSave} disabled={saving} C={C} style={{flex:2}}>{saving?'Đang lưu...':(isEdit?'Lưu thay đổi':'Thêm từ vựng')}</PrimaryBtn>
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────────── MODAL: Gia đình từ (thêm/sửa) ─────────────────────── */
  function FamilyModal({dark, C, unitId, initial, onClose, onSaved, toast_}){
    const isEdit = !!initial;
    const [baseWord,setBaseWord] = useState(initial?.base_word||'');
    const [meaning,setMeaning] = useState(initial?.meaning||'');
    const [saving,setSaving] = useState(false);
    const [err,setErr] = useState('');
    const inputStyle = useInputStyle(C);
    const fh = focusHandlers(C);

    async function handleSave(){
      if(!baseWord.trim()){ setErr('Nhập từ gốc nhé!'); return; }
      setSaving(true); setErr('');
      try{
        const row = { base_word: baseWord.trim(), meaning: meaning.trim() };
        if(isEdit){
          const { error } = await window.supa.from('vocab_word_families').update(row).eq('id', initial.id);
          if(error) throw error;
        } else {
          const { error } = await window.supa.from('vocab_word_families').insert({ id: crypto.randomUUID(), unit_id: unitId, ...row, sort_order:0 });
          if(error) throw error;
        }
        toast_ && toast_(isEdit ? 'Đã lưu thay đổi!' : 'Đã tạo gia đình từ!');
        onSaved();
      } catch(e){
        console.error('[vocab-manager] family save error:', e);
        setErr(e.message || 'Có lỗi xảy ra, thử lại nhé!');
      } finally { setSaving(false); }
    }

    return(
      <div onClick={e=>{if(e.target===e.currentTarget && !saving) onClose();}}
        style={{position:'fixed', inset:0, zIndex:9200, background:'rgba(10,2,25,0.72)', backdropFilter:'blur(10px)', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:16, overflowY:'auto', WebkitOverflowScrolling:'touch'}}>
        <div style={{width:'100%', maxWidth:480, maxHeight:'min(85vh, 500px)', margin:'auto 0', borderRadius:24, background:dark?'#1E0D15':'#fff', border:`1.5px solid ${C.border2}`, boxShadow:'0 24px 60px rgba(0,0,0,.3)', animation:'pop .2s ease both', display:'flex', flexDirection:'column', overflow:'hidden'}}>
          <div style={{flex:'1 1 auto', minHeight:0, overflowY:'auto', WebkitOverflowScrolling:'touch', padding:'18px 20px 2px'}}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14}}>
              <div style={{fontSize:15, fontWeight:900, color:C.text}}>{isEdit?'Sửa gia đình từ':'Thêm gia đình từ'}</div>
              <button onClick={onClose} disabled={saving} style={{width:26, height:26, borderRadius:99, border:`1.5px solid ${C.border2}`, background:C.bg2, color:C.text3, cursor:saving?'not-allowed':'pointer', fontSize:14, fontWeight:900, lineHeight:1, opacity:saving?0.5:1}}>×</button>
            </div>
            <div style={{marginBottom:10}}>
              <label style={labelStyleFor(C)}>Từ gốc *</label>
              <input value={baseWord} onChange={e=>setBaseWord(e.target.value)} placeholder="Vd: energy" style={inputStyle} {...fh} autoFocus/>
            </div>
            <div style={{marginBottom:12}}>
              <label style={labelStyleFor(C)}>Nghĩa từ gốc</label>
              <textarea value={meaning} onChange={e=>setMeaning(e.target.value)} placeholder="Vd: năng lượng" rows={2} style={{...inputStyle, resize:'vertical', minHeight:60}} {...fh}/>
            </div>
            {err && <div style={{fontSize:12, fontWeight:700, color:'#ef4444', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:'8px 12px', marginBottom:12}}>{err}</div>}
          </div>
          <div style={{display:'flex', gap:8, padding:'12px 16px', borderTop:`1.5px solid ${C.border2}`, background:dark?'#1E0D15':'#fff', flexShrink:0}}>
            <GhostBtn onClick={onClose} disabled={saving} C={C}>Huỷ</GhostBtn>
            <PrimaryBtn onClick={handleSave} disabled={saving} C={C} style={{flex:2}}>{saving?'Đang lưu...':(isEdit?'Lưu thay đổi':'Tạo gia đình từ')}</PrimaryBtn>
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────────── MODAL: Form của gia đình từ (thêm/sửa) ─────────────────────── */
  function FormModal({dark, C, familyId, initial, onClose, onSaved, toast_}){
    const isEdit = !!initial;
    const [pos,setPos] = useState(initial?.pos||'noun');
    const [form,setForm] = useState(initial?.form||'');
    const [ipa,setIpa] = useState(initial?.ipa||'');
    const [meaning,setMeaning] = useState(initial?.meaning||'');
    const [saving,setSaving] = useState(false);
    const [err,setErr] = useState('');
    const inputStyle = useInputStyle(C);
    const fh = focusHandlers(C);

    async function handleSave(){
      if(!form.trim()){ setErr('Nhập form nhé!'); return; }
      setSaving(true); setErr('');
      try{
        const row = { pos, form: form.trim(), ipa: ipa.trim(), meaning: meaning.trim() };
        if(isEdit){
          const { error } = await window.supa.from('vocab_word_forms').update(row).eq('id', initial.id);
          if(error) throw error;
        } else {
          const { error } = await window.supa.from('vocab_word_forms').insert({ id: crypto.randomUUID(), family_id: familyId, ...row, sort_order:0 });
          if(error) throw error;
        }
        toast_ && toast_(isEdit ? 'Đã lưu thay đổi!' : 'Đã thêm form!');
        onSaved();
      } catch(e){
        console.error('[vocab-manager] form save error:', e);
        setErr(e.message || 'Có lỗi xảy ra, thử lại nhé!');
      } finally { setSaving(false); }
    }

    return(
      <div onClick={e=>{if(e.target===e.currentTarget && !saving) onClose();}}
        style={{position:'fixed', inset:0, zIndex:9200, background:'rgba(10,2,25,0.72)', backdropFilter:'blur(10px)', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:16, overflowY:'auto', WebkitOverflowScrolling:'touch'}}>
        <div style={{width:'100%', maxWidth:520, maxHeight:'min(85vh, 560px)', margin:'auto 0', borderRadius:24, background:dark?'#1E0D15':'#fff', border:`1.5px solid ${C.border2}`, boxShadow:'0 24px 60px rgba(0,0,0,.3)', animation:'pop .2s ease both', display:'flex', flexDirection:'column', overflow:'hidden'}}>
          <div style={{flex:'1 1 auto', minHeight:0, overflowY:'auto', WebkitOverflowScrolling:'touch', padding:'18px 20px 2px'}}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14}}>
              <div style={{fontSize:15, fontWeight:900, color:C.text}}>{isEdit?'Sửa form':'Thêm form'}</div>
              <button onClick={onClose} disabled={saving} style={{width:26, height:26, borderRadius:99, border:`1.5px solid ${C.border2}`, background:C.bg2, color:C.text3, cursor:saving?'not-allowed':'pointer', fontSize:14, fontWeight:900, lineHeight:1, opacity:saving?0.5:1}}>×</button>
            </div>
            <div style={{display:'flex', flexWrap:'wrap', gap:10, marginBottom:10}}>
              <div style={{flex:'2 1 160px'}}>
                <label style={labelStyleFor(C)}>Form *</label>
                <input value={form} onChange={e=>setForm(e.target.value)} placeholder="Vd: energetic" style={inputStyle} {...fh} autoFocus/>
              </div>
              <div style={{flex:'1 1 110px'}}>
                <label style={labelStyleFor(C)}>Loại từ</label>
                <select value={pos} onChange={e=>setPos(e.target.value)} style={{...inputStyle, cursor:'pointer'}} {...fh}>
                  {POS_OPTIONS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div style={{flex:'1 1 110px'}}>
                <label style={labelStyleFor(C)}>Phiên âm (IPA)</label>
                <input value={ipa} onChange={e=>setIpa(e.target.value)} placeholder="/ˌenərˈdʒetɪk/" style={inputStyle} {...fh}/>
              </div>
            </div>
            <div style={{marginBottom:12}}>
              <label style={labelStyleFor(C)}>Nghĩa</label>
              <textarea value={meaning} onChange={e=>setMeaning(e.target.value)} placeholder="Vd: đầy năng lượng" rows={2} style={{...inputStyle, resize:'vertical', minHeight:60}} {...fh}/>
            </div>
            {err && <div style={{fontSize:12, fontWeight:700, color:'#ef4444', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:'8px 12px', marginBottom:12}}>{err}</div>}
          </div>
          <div style={{display:'flex', gap:8, padding:'12px 16px', borderTop:`1.5px solid ${C.border2}`, background:dark?'#1E0D15':'#fff', flexShrink:0}}>
            <GhostBtn onClick={onClose} disabled={saving} C={C}>Huỷ</GhostBtn>
            <PrimaryBtn onClick={handleSave} disabled={saving} C={C} style={{flex:2}}>{saving?'Đang lưu...':(isEdit?'Lưu thay đổi':'Thêm form')}</PrimaryBtn>
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────────── MODAL: Nhập nhanh nhiều form ─────────────────────── */
  function BulkFormModal({dark, C, familyId, onClose, onSaved, toast_}){
    const [text,setText] = useState('');
    const [saving,setSaving] = useState(false);
    const [err,setErr] = useState('');
    const inputStyle = useInputStyle(C);
    const fh = focusHandlers(C);

    const parsed = useMemo(()=>parseBulkForms(text), [text]);

    async function handleBulkSave(){
      if(parsed.length===0){ setErr('Chưa có form hợp lệ nào để thêm!'); return; }
      setSaving(true); setErr('');
      try{
        const rows = parsed.map(r=>({ id: crypto.randomUUID(), family_id: familyId, ...r, sort_order:0 }));
        const { error } = await window.supa.from('vocab_word_forms').insert(rows);
        if(error) throw error;
        toast_ && toast_(`Đã thêm ${rows.length} form!`);
        onSaved();
      } catch(e){
        console.error('[vocab-manager] bulk form save error:', e);
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
                Nhập nhanh nhiều form
              </div>
              <button onClick={onClose} disabled={saving} style={{width:26, height:26, borderRadius:99, border:`1.5px solid ${C.border2}`, background:C.bg2, color:C.text3, cursor:saving?'not-allowed':'pointer', fontSize:14, fontWeight:900, lineHeight:1, opacity:saving?0.5:1}}>×</button>
            </div>
            <div style={{fontSize:11.5, color:C.text3, fontWeight:600, marginBottom:10}}>
              Mỗi dòng 1 form — xem ví dụ định dạng bên dưới.
            </div>
            <textarea value={text} onChange={e=>{setText(e.target.value); setErr('');}}
              placeholder={"tt | energetic | /ˌenərˈdʒetɪk/ | đầy năng lượng\nđt | energize | | làm cho mạnh mẽ\ntrt | energetically"}
              rows={7} style={{...inputStyle, resize:'vertical', fontFamily:'monospace', fontSize:12.5, marginBottom:12}} {...fh}/>

            <div style={{fontSize:11.5, fontWeight:800, color:C.text3, marginBottom:6}}>
              Xem trước: {parsed.length>0 ? `${parsed.length} form hợp lệ` : 'chưa có form nào'}
            </div>
            <div style={{maxHeight:180, overflowY:'auto', borderRadius:12, border:`1.5px solid ${C.border2}`, marginBottom:12}}>
              {parsed.length===0 ? (
                <div style={{padding:'14px 12px', fontSize:12, color:C.text3, textAlign:'center'}}>Nhập form bên trên để xem trước ở đây</div>
              ) : parsed.map((r,i)=>(
                <div key={i} style={{display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderBottom: i<parsed.length-1?`1px solid ${C.border2}`:'none'}}>
                  <span style={{fontSize:12.5, fontWeight:800, color:C.text, minWidth:70}}>{r.form}</span>
                  <span style={{fontSize:9.5, fontWeight:800, color:posColor(r.pos), background:posColor(r.pos)+'1c', padding:'2px 6px', borderRadius:6, flexShrink:0}}>{posLabel(r.pos)}</span>
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
                ['Đầy đủ', C.lav, C.lavL, 'tt | energetic | /ˌenərˈdʒetɪk/ | đầy năng lượng'],
                ['Chỉ loại từ + form', C.rose||'#e8547a', C.roseL||'rgba(232,84,122,0.12)', 'đt | energize'],
                ['Chỉ form', C.peach, C.peachL, 'energetically'],
              ].map(([k,c,bg,v])=>(
                <div key={k} style={{marginBottom:10}}>
                  <span style={{fontSize:11, fontWeight:900, color:c, background:bg, padding:'2px 9px', borderRadius:999}}>{k}</span>
                  <pre style={{marginTop:6, fontSize:11.5, color:C.text2, lineHeight:1.75, whiteSpace:'pre-wrap', fontFamily:'monospace', background:dark?'#120B10':'#FAFAFA', padding:'9px 11px', borderRadius:10, border:`1px solid ${C.border2}`}}>{v}</pre>
                </div>
              ))}
              <div style={{fontSize:11, color:C.text3, fontWeight:600, lineHeight:1.5}}>
                Thứ tự cột: <b style={{color:C.text2}}>loại từ | form | phiên âm | nghĩa</b> — chỉ form bắt buộc, có thể dán nhiều dòng cùng lúc.
              </div>
            </div>
          </div>
          <div style={{display:'flex', gap:8, padding:'12px 16px', borderTop:`1.5px solid ${C.border2}`, background:dark?'#1E0D15':'#fff', flexShrink:0}}>
            <GhostBtn onClick={onClose} disabled={saving} C={C}>Huỷ</GhostBtn>
            <PrimaryBtn onClick={handleBulkSave} disabled={saving || parsed.length===0} C={C} style={{flex:2}}>{saving?'Đang lưu...':`Thêm ${parsed.length||''} form`}</PrimaryBtn>
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────────── HÀNG TỪ VỰNG ─────────────────────── */
  function WordRow({v, dark, C, onEdit, onDelete, index}){
    const col = posColor(v.pos);
    return(
      <div className="vm-word-row" style={{
        display:'flex', alignItems:'flex-start', gap:10, padding:'11px 12px',
        borderRadius:18, background:C.surfaceGlass||C.surface, backdropFilter:C.surfaceBlur, WebkitBackdropFilter:C.surfaceBlur, border:`1.5px solid ${C.border}`,
        animation:`fadeUp .22s cubic-bezier(.16,1,.3,1) both`, animationDelay:`${Math.min(index*0.03,0.3)}s`,
        transition:'transform .15s ease, box-shadow .15s ease, border-color .15s ease',
      }}
        onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow=`0 4px 14px ${col}1a`; e.currentTarget.style.borderColor=`${col}44`; }}
        onMouseLeave={e=>{ e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none'; e.currentTarget.style.borderColor=C.border; }}>
        <div style={{width:8, height:8, borderRadius:99, background:col, flexShrink:0, marginTop:5, boxShadow:`0 0 0 3px ${col}22`}}/>
        <div style={{flex:1, minWidth:0}}>
          <div style={{display:'flex', alignItems:'center', gap:7, flexWrap:'wrap'}}>
            <span style={{fontSize:14.5, fontWeight:900, color:C.text}}>{v.word}</span>
            <span style={{fontSize:10, fontWeight:800, color:col, background:`${col}18`, borderRadius:7, padding:'2px 7px'}}>{posLabel(v.pos)}</span>
            {v.ipa && <span style={{fontSize:12, color:C.text3, fontStyle:'italic'}}>/{v.ipa.replace(/^\/|\/$/g,'')}/</span>}
          </div>
          {v.meaning && <div style={{fontSize:13, color:C.text2, marginTop:3, fontWeight:600}}>{v.meaning}</div>}
          {v.example && <div style={{fontSize:12, color:C.text3, marginTop:2, fontStyle:'italic'}}>"{v.example}"</div>}
        </div>
        <div style={{display:'flex', gap:6, flexShrink:0}}>
          <IconBtn onClick={()=>onEdit(v)} title="Sửa" C={C}><IconEdit/></IconBtn>
          <IconBtn onClick={()=>onDelete(v)} title="Xoá" danger C={C}><IconTrash/></IconBtn>
        </div>
      </div>
    );
  }

  /* ─────────────────────── HÀNG FORM (trong 1 gia đình từ) ─────────────────────── */
  function FormRow({f, dark, C, onEdit, onDelete, index}){
    const col = posColor(f.pos);
    return(
      <div className="vm-word-row" style={{
        display:'flex', alignItems:'flex-start', gap:10, padding:'11px 12px',
        borderRadius:18, background:C.surfaceGlass||C.surface, backdropFilter:C.surfaceBlur, WebkitBackdropFilter:C.surfaceBlur, border:`1.5px solid ${C.border}`,
        animation:`fadeUp .22s cubic-bezier(.16,1,.3,1) both`, animationDelay:`${Math.min(index*0.03,0.3)}s`,
        transition:'transform .15s ease, box-shadow .15s ease, border-color .15s ease',
      }}
        onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow=`0 4px 14px ${col}1a`; e.currentTarget.style.borderColor=`${col}44`; }}
        onMouseLeave={e=>{ e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none'; e.currentTarget.style.borderColor=C.border; }}>
        <div style={{width:8, height:8, borderRadius:99, background:col, flexShrink:0, marginTop:5, boxShadow:`0 0 0 3px ${col}22`}}/>
        <div style={{flex:1, minWidth:0}}>
          <div style={{display:'flex', alignItems:'center', gap:7, flexWrap:'wrap'}}>
            <span style={{fontSize:14.5, fontWeight:900, color:C.text}}>{f.form}</span>
            <span style={{fontSize:10, fontWeight:800, color:col, background:`${col}18`, borderRadius:7, padding:'2px 7px'}}>{posLabel(f.pos)}</span>
            {f.ipa && <span style={{fontSize:12, color:C.text3, fontStyle:'italic'}}>/{f.ipa.replace(/^\/|\/$/g,'')}/</span>}
          </div>
          {f.meaning && <div style={{fontSize:13, color:C.text2, marginTop:3, fontWeight:600}}>{f.meaning}</div>}
        </div>
        <div style={{display:'flex', gap:6, flexShrink:0}}>
          <IconBtn onClick={()=>onEdit(f)} title="Sửa" C={C}><IconEdit/></IconBtn>
          <IconBtn onClick={()=>onDelete(f)} title="Xoá" danger C={C}><IconTrash/></IconBtn>
        </div>
      </div>
    );
  }

  /* ─────────────────────── KHỐI GIA ĐÌNH TỪ (accordion, chứa forms) ─────────────────────── */
  function FamilyBlock({family, dark, C, confirm_, toast_, onChanged, onEditFamily}){
    const [open,setOpen] = useState(false);
    const [forms,setForms] = useState([]);
    const [loaded,setLoaded] = useState(false);
    const [formModal,setFormModal] = useState(null); // null | {} (add) | form (edit)
    const [bulkModal,setBulkModal] = useState(false);

    const fetchForms = useCallback(async ()=>{
      try{
        const { data, error } = await window.supa.from('vocab_word_forms')
          .select('*').eq('family_id', family.id).order('sort_order',{ascending:true}).order('created_at',{ascending:true});
        if(error) throw error;
        setForms(data||[]);
      } catch(e){
        console.error('[vocab-manager] fetch forms error:', e);
        toast_ && toast_('Không tải được form của gia đình từ');
      } finally { setLoaded(true); }
    },[family.id, toast_]);

    useEffect(()=>{ if(open && !loaded) fetchForms(); },[open, loaded, fetchForms]);

    async function doDeleteForm(f){
      try{
        const { error } = await window.supa.from('vocab_word_forms').delete().eq('id', f.id);
        if(error) throw error;
        setForms(prev=>prev.filter(x=>x.id!==f.id));
        toast_ && toast_('Đã xoá form');
      } catch(e){
        console.error('[vocab-manager] delete form error:', e);
        toast_ && toast_('Xoá thất bại, thử lại nhé!');
      }
    }
    function handleDeleteForm(f){
      if(confirm_){
        confirm_({ title:'Xoá form?', message:`"${f.form}" sẽ bị xoá vĩnh viễn.`, confirmLabel:'Xoá', danger:true, onConfirm:()=>doDeleteForm(f) });
      } else if(window.confirm(`Xoá "${f.form}"?`)){ doDeleteForm(f); }
    }

    async function doDeleteFamily(){
      try{
        const { error } = await window.supa.from('vocab_word_families').delete().eq('id', family.id);
        if(error) throw error;
        toast_ && toast_('Đã xoá gia đình từ');
        onChanged();
      } catch(e){
        console.error('[vocab-manager] delete family error:', e);
        toast_ && toast_('Xoá thất bại, thử lại nhé!');
      }
    }
    function handleDeleteFamily(e){
      e.stopPropagation();
      if(confirm_){
        confirm_({ title:'Xoá gia đình từ?', message:`"${family.base_word}" và toàn bộ form bên trong sẽ bị xoá vĩnh viễn.`, confirmLabel:'Xoá', danger:true, onConfirm:doDeleteFamily });
      } else if(window.confirm(`Xoá "${family.base_word}" và toàn bộ form?`)){ doDeleteFamily(); }
    }

    return(
      <div style={{
        borderRadius:20, border:`1.5px solid ${C.border}`, overflow:'hidden', background:C.surfaceGlass||C.surface, backdropFilter:C.surfaceBlur, WebkitBackdropFilter:C.surfaceBlur,
        boxShadow: open ? '0 4px 16px rgba(168,85,247,0.1)' : 'none', transition:'box-shadow .25s ease',
      }}>
        <div onClick={()=>setOpen(p=>!p)} style={{
          display:'flex', alignItems:'center', gap:10, padding:'12px 14px', cursor:'pointer',
          background: open ? C.lavPale : 'transparent', transition:'background .18s',
        }}
          onMouseEnter={e=>{ if(!open) e.currentTarget.style.background = C.bg2; }}
          onMouseLeave={e=>{ if(!open) e.currentTarget.style.background = 'transparent'; }}>
          <span style={{display:'flex', color:C.lav, flexShrink:0}}><IconChevron open={open}/></span>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:13.5, fontWeight:800, color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{family.base_word}</div>
            <div style={{fontSize:11, color:C.text3, marginTop:1, display:'flex', gap:6, alignItems:'center'}}>
              {family.meaning && <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:180}}>{family.meaning}</span>}
              <span>{loaded ? `${forms.length} form` : '···'}</span>
            </div>
          </div>
          <div style={{display:'flex', gap:6, flexShrink:0}} onClick={e=>e.stopPropagation()}>
            <IconBtn onClick={()=>onEditFamily(family)} title="Sửa gia đình từ" C={C}><IconEdit/></IconBtn>
            <IconBtn onClick={handleDeleteFamily} title="Xoá gia đình từ" danger C={C}><IconTrash/></IconBtn>
          </div>
        </div>

        {open && (
          <div style={{padding:'12px 14px 14px', display:'flex', flexDirection:'column', gap:8, borderTop:`1.5px solid ${C.border}`, animation:'fadeUp .18s ease both'}}>
            <div style={{display:'flex', gap:8}}>
              <button onClick={()=>setFormModal({})} style={{
                flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'9px', borderRadius:12,
                border:`1.5px dashed ${C.lav2}`, background:'transparent', color:C.lav, fontSize:12.5, fontWeight:800,
                cursor:'pointer', fontFamily:"'Nunito',sans-serif", transition:'all .15s',
              }}
                onMouseEnter={e=>{e.currentTarget.style.background=C.lavPale;}}
                onMouseLeave={e=>{e.currentTarget.style.background='transparent';}}>
                <IconPlus/> Thêm form
              </button>
              <button onClick={()=>setBulkModal(true)} title="Nhập nhiều form cùng lúc" style={{
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
                {[0,1].map(i=>(<div key={i} style={{height:48, borderRadius:18, background:C.bg2, opacity:0.6}}/>))}
              </div>
            )}
            {loaded && forms.length===0 && (
              <div style={{textAlign:'center', padding:'16px 10px', fontSize:12.5, color:C.text3, fontWeight:600}}>Chưa có form nào trong gia đình từ này</div>
            )}
            {loaded && forms.map((f,i)=>(
              <FormRow key={f.id} f={f} dark={dark} C={C} index={i}
                onEdit={()=>setFormModal(f)} onDelete={handleDeleteForm}/>
            ))}
          </div>
        )}

        {formModal!==null && (
          <FormModal dark={dark} C={C} familyId={family.id} initial={formModal.id?formModal:null}
            onClose={()=>setFormModal(null)}
            onSaved={()=>{ setFormModal(null); fetchForms(); }}
            toast_={toast_}/>
        )}
        {bulkModal && (
          <BulkFormModal dark={dark} C={C} familyId={family.id}
            onClose={()=>setBulkModal(false)}
            onSaved={()=>{ setBulkModal(false); fetchForms(); }}
            toast_={toast_}/>
        )}
      </div>
    );
  }

  /* ─────────────────────── KHỐI UNIT (accordion) ─────────────────────── */
  function UnitBlock({unit, dark, C, confirm_, toast_, onChanged, defaultOpen}){
    const [open,setOpen] = useState(!!defaultOpen);
    const [subTab,setSubTab] = useState('words'); // 'words' | 'families'
    const [words,setWords] = useState([]);
    const [loaded,setLoaded] = useState(false);
    const [wordModal,setWordModal] = useState(null); // null | {} (add) | word (edit)
    const [bulkModal,setBulkModal] = useState(false);
    const [unitModal,setUnitModal] = useState(false);

    const [families,setFamilies] = useState([]);
    const [familiesLoaded,setFamiliesLoaded] = useState(false);
    const [familyModal,setFamilyModal] = useState(null); // null | {} (add) | family (edit)

    const fetchWords = useCallback(async ()=>{
      try{
        const { data, error } = await window.supa.from('vocab_words')
          .select('*').eq('unit_id', unit.id).order('sort_order',{ascending:true}).order('created_at',{ascending:true});
        if(error) throw error;
        setWords(data||[]);
      } catch(e){
        console.error('[vocab-manager] fetch words error:', e);
        toast_ && toast_('Không tải được từ vựng của unit');
      } finally { setLoaded(true); }
    },[unit.id, toast_]);

    const fetchFamilies = useCallback(async ()=>{
      try{
        const { data, error } = await window.supa.from('vocab_word_families')
          .select('*').eq('unit_id', unit.id).order('sort_order',{ascending:true}).order('created_at',{ascending:true});
        if(error) throw error;
        setFamilies(data||[]);
      } catch(e){
        console.error('[vocab-manager] fetch families error:', e);
        toast_ && toast_('Không tải được gia đình từ của unit');
      } finally { setFamiliesLoaded(true); }
    },[unit.id, toast_]);

    useEffect(()=>{ if(open && !loaded) fetchWords(); },[open, loaded, fetchWords]);
    useEffect(()=>{ if(open && subTab==='families' && !familiesLoaded) fetchFamilies(); },[open, subTab, familiesLoaded, fetchFamilies]);

    async function doDeleteWord(v){
      try{
        const { error } = await window.supa.from('vocab_words').delete().eq('id', v.id);
        if(error) throw error;
        setWords(prev=>prev.filter(x=>x.id!==v.id));
        toast_ && toast_('Đã xoá từ vựng');
      } catch(e){
        console.error('[vocab-manager] delete word error:', e);
        toast_ && toast_('Xoá thất bại, thử lại nhé!');
      }
    }
    function handleDeleteWord(v){
      if(confirm_){
        confirm_({ title:'Xoá từ vựng?', message:`"${v.word}" sẽ bị xoá vĩnh viễn.`, confirmLabel:'Xoá', danger:true, onConfirm:()=>doDeleteWord(v) });
      } else if(window.confirm(`Xoá "${v.word}"?`)){ doDeleteWord(v); }
    }

    async function doDeleteUnit(){
      try{
        const { error } = await window.supa.from('vocab_units').delete().eq('id', unit.id);
        if(error) throw error;
        toast_ && toast_('Đã xoá Unit');
        onChanged();
      } catch(e){
        console.error('[vocab-manager] delete unit error:', e);
        toast_ && toast_('Xoá thất bại, thử lại nhé!');
      }
    }
    function handleDeleteUnit(e){
      e.stopPropagation();
      if(confirm_){
        confirm_({ title:'Xoá Unit?', message:`"${unit.title}" và toàn bộ từ vựng bên trong sẽ bị xoá vĩnh viễn.`, confirmLabel:'Xoá', danger:true, onConfirm:doDeleteUnit });
      } else if(window.confirm(`Xoá "${unit.title}" và toàn bộ từ vựng?`)){ doDeleteUnit(); }
    }

    return(
      <div style={{
        borderRadius:20, border:`1.5px solid ${C.border}`, overflow:'hidden', background:C.surfaceGlass||C.surface, backdropFilter:C.surfaceBlur, WebkitBackdropFilter:C.surfaceBlur,
        boxShadow: open ? '0 4px 16px rgba(168,85,247,0.1)' : 'none', transition:'box-shadow .25s ease',
      }}>
        <div onClick={()=>setOpen(p=>!p)} style={{
          display:'flex', alignItems:'center', gap:10, padding:'12px 14px', cursor:'pointer',
          background: open ? C.lavPale : 'transparent', transition:'background .18s',
        }}
          onMouseEnter={e=>{ if(!open) e.currentTarget.style.background = C.bg2; }}
          onMouseLeave={e=>{ if(!open) e.currentTarget.style.background = 'transparent'; }}>
          <span style={{display:'flex', color:C.lav, flexShrink:0}}><IconChevron open={open}/></span>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:13.5, fontWeight:800, color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{unit.title}</div>
            <div style={{fontSize:11, color:C.text3, marginTop:1, display:'flex', gap:6, alignItems:'center'}}>
              {unit.level && <span style={{background:C.peachL, color:C.peach, borderRadius:7, padding:'1px 7px', fontWeight:800, fontSize:10}}>{unit.level}</span>}
              <span>
                {subTab==='words'
                  ? (loaded ? `${words.length} từ` : '···')
                  : (familiesLoaded ? `${families.length} gia đình từ` : '···')}
              </span>
            </div>
          </div>
          <div style={{display:'flex', gap:6, flexShrink:0}} onClick={e=>e.stopPropagation()}>
            <IconBtn onClick={()=>setUnitModal(true)} title="Sửa Unit" C={C}><IconEdit/></IconBtn>
            <IconBtn onClick={handleDeleteUnit} title="Xoá Unit" danger C={C}><IconTrash/></IconBtn>
          </div>
        </div>

        {open && (
          <div style={{padding:'12px 14px 14px', display:'flex', flexDirection:'column', gap:8, borderTop:`1.5px solid ${C.border}`, animation:'fadeUp .18s ease both'}}>
            {/* Tab con: Từ vựng thường / Gia đình từ — cùng cơ chế accordion,
                chỉ khác nguồn dữ liệu (vocab_words vs vocab_word_families),
                khớp UnitSubTab bên Android app. */}
            <div style={{display:'flex', gap:3, padding:3, borderRadius:12, background:C.bg2}}>
              <button onClick={()=>setSubTab('words')} style={{
                flex:1, padding:'8px 0', borderRadius:10, border:'none', cursor:'pointer',
                background: subTab==='words' ? C.lav : 'transparent', color: subTab==='words' ? '#fff' : C.text3,
                fontSize:12, fontWeight:900, fontFamily:"'Nunito',sans-serif", transition:'all .15s',
              }}>Từ vựng thường</button>
              <button onClick={()=>setSubTab('families')} style={{
                flex:1, padding:'8px 0', borderRadius:10, border:'none', cursor:'pointer',
                background: subTab==='families' ? C.lav : 'transparent', color: subTab==='families' ? '#fff' : C.text3,
                fontSize:12, fontWeight:900, fontFamily:"'Nunito',sans-serif", transition:'all .15s',
              }}>Gia đình từ</button>
            </div>

            {subTab==='words' ? (
              <>
                <div style={{display:'flex', gap:8}}>
                  <button onClick={()=>setWordModal({})} style={{
                    flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'9px', borderRadius:12,
                    border:`1.5px dashed ${C.lav2}`, background:'transparent', color:C.lav, fontSize:12.5, fontWeight:800,
                    cursor:'pointer', fontFamily:"'Nunito',sans-serif", transition:'all .15s',
                  }}
                    onMouseEnter={e=>{e.currentTarget.style.background=C.lavPale;}}
                    onMouseLeave={e=>{e.currentTarget.style.background='transparent';}}>
                    <IconPlus/> Thêm từ vựng
                  </button>
                  <button onClick={()=>setBulkModal(true)} title="Nhập nhiều từ vựng cùng lúc" style={{
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
                {loaded && words.length===0 && (
                  <div style={{textAlign:'center', padding:'18px 10px', fontSize:12.5, color:C.text3, fontWeight:600}}>Chưa có từ vựng nào trong unit này</div>
                )}
                {loaded && words.map((v,i)=>(
                  <WordRow key={v.id} v={v} dark={dark} C={C} index={i}
                    onEdit={()=>setWordModal(v)} onDelete={handleDeleteWord}/>
                ))}
              </>
            ) : (
              <>
                <button onClick={()=>setFamilyModal({})} style={{
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'9px', borderRadius:12,
                  border:`1.5px dashed ${C.lav2}`, background:'transparent', color:C.lav, fontSize:12.5, fontWeight:800,
                  cursor:'pointer', fontFamily:"'Nunito',sans-serif", transition:'all .15s',
                }}
                  onMouseEnter={e=>{e.currentTarget.style.background=C.lavPale;}}
                  onMouseLeave={e=>{e.currentTarget.style.background='transparent';}}>
                  <IconPlus/> Thêm gia đình từ
                </button>

                {!familiesLoaded && (
                  <div style={{display:'flex', flexDirection:'column', gap:8}}>
                    {[0,1].map(i=>(<div key={i} style={{height:52, borderRadius:18, background:C.bg2, opacity:0.6}}/>))}
                  </div>
                )}
                {familiesLoaded && families.length===0 && (
                  <div style={{textAlign:'center', padding:'18px 10px', fontSize:12.5, color:C.text3, fontWeight:600}}>Chưa có gia đình từ nào trong unit này</div>
                )}
                {familiesLoaded && families.map(fam=>(
                  <FamilyBlock key={fam.id} family={fam} dark={dark} C={C} confirm_={confirm_} toast_={toast_}
                    onChanged={fetchFamilies} onEditFamily={()=>setFamilyModal(fam)}/>
                ))}
              </>
            )}
          </div>
        )}

        {wordModal!==null && (
          <WordModal dark={dark} C={C} unitId={unit.id} initial={wordModal.id?wordModal:null}
            onClose={()=>setWordModal(null)}
            onSaved={()=>{ setWordModal(null); fetchWords(); }}
            toast_={toast_}/>
        )}
        {bulkModal && (
          <BulkWordModal dark={dark} C={C} unitId={unit.id}
            onClose={()=>setBulkModal(false)}
            onSaved={()=>{ setBulkModal(false); fetchWords(); }}
            toast_={toast_}/>
        )}
        {unitModal && (
          <UnitModal dark={dark} C={C} courseId={unit.course_id} initial={unit}
            onClose={()=>setUnitModal(false)}
            onSaved={()=>{ setUnitModal(false); onChanged(); }}
            toast_={toast_}/>
        )}
        {familyModal!==null && (
          <FamilyModal dark={dark} C={C} unitId={unit.id} initial={familyModal.id?familyModal:null}
            onClose={()=>setFamilyModal(null)}
            onSaved={()=>{ setFamilyModal(null); fetchFamilies(); }}
            toast_={toast_}/>
        )}
      </div>
    );
  }

  /* ─────────────────────── KHỐI KHÓA HỌC (accordion) ─────────────────────── */
  function LessonBlock({lesson, dark, C, confirm_, toast_, onChanged, defaultOpen}){
    const [open,setOpen] = useState(!!defaultOpen);
    const [units,setUnits] = useState([]);
    const [loaded,setLoaded] = useState(false);
    const [unitModal,setUnitModal] = useState(false);
    const [lessonModal,setLessonModal] = useState(false);

    const fetchUnits = useCallback(async ()=>{
      try{
        const { data, error } = await window.supa.from('vocab_units')
          .select('*').eq('course_id', lesson.id).order('sort_order',{ascending:true}).order('created_at',{ascending:true});
        if(error) throw error;
        setUnits(data||[]);
      } catch(e){
        console.error('[vocab-manager] fetch units error:', e);
        toast_ && toast_('Không tải được units của bài học');
      } finally { setLoaded(true); }
    },[lesson.id, toast_]);

    useEffect(()=>{ if(open && !loaded) fetchUnits(); },[open, loaded, fetchUnits]);

    async function doDeleteLesson(){
      try{
        const { error } = await window.supa.from('vocab_courses').delete().eq('id', lesson.id);
        if(error) throw error;
        toast_ && toast_('Đã xoá bài học');
        onChanged();
      } catch(e){
        console.error('[vocab-manager] delete lesson error:', e);
        toast_ && toast_('Xoá thất bại, thử lại nhé!');
      }
    }
    function handleDeleteLesson(e){
      e.stopPropagation();
      if(confirm_){
        confirm_({ title:'Xoá bài học?', message:`"${lesson.title}" và toàn bộ Unit + từ vựng bên trong sẽ bị xoá vĩnh viễn.`, confirmLabel:'Xoá', danger:true, onConfirm:doDeleteLesson });
      } else if(window.confirm(`Xoá "${lesson.title}" và toàn bộ nội dung?`)){ doDeleteLesson(); }
    }

    return(
      <div style={{
        borderRadius:22, border:`1.5px solid ${C.border}`, overflow:'hidden',
        background:dark?'rgba(255,255,255,0.02)':'rgba(168,85,247,0.02)',
        boxShadow: open ? '0 6px 22px rgba(168,85,247,0.12)' : '0 2px 8px rgba(168,85,247,0.05)',
        transition:'box-shadow .25s ease',
      }}>
        <div onClick={()=>setOpen(p=>!p)} style={{
          display:'flex', alignItems:'center', gap:10, padding:'14px 16px', cursor:'pointer',
          background: open ? C.gradSoft : 'transparent', transition:'background .2s',
        }}
          onMouseEnter={e=>{ if(!open) e.currentTarget.style.background = dark?'rgba(255,255,255,0.03)':'rgba(168,85,247,0.035)'; }}
          onMouseLeave={e=>{ if(!open) e.currentTarget.style.background = 'transparent'; }}>
          <span style={{display:'flex', color:C.lav, flexShrink:0}}><IconChevron open={open}/></span>
          <div style={{
            width:36, height:36, borderRadius:12, flexShrink:0, background:C.grad,
            display:'flex', alignItems:'center', justifyContent:'center', color:'#fff',
            boxShadow:'0 3px 10px rgba(168,85,247,0.3)',
            transform: open ? 'scale(1.06)' : 'scale(1)', transition:'transform .25s cubic-bezier(.34,1.56,.64,1)',
          }}>
            <IconBook size={17}/>
          </div>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:14.5, fontWeight:900, color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{lesson.title}</div>
            <div style={{fontSize:11.5, color:C.text3, marginTop:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
              {lesson.description || (loaded ? `${units.length} unit` : 'Bấm để xem units')}
            </div>
          </div>
          <div style={{display:'flex', gap:6, flexShrink:0}} onClick={e=>e.stopPropagation()}>
            <IconBtn onClick={()=>setLessonModal(true)} title="Sửa bài học" C={C}><IconEdit/></IconBtn>
            <IconBtn onClick={handleDeleteLesson} title="Xoá bài học" danger C={C}><IconTrash/></IconBtn>
          </div>
        </div>

        {open && (
          <div style={{padding:'12px 14px 16px', display:'flex', flexDirection:'column', gap:10, borderTop:`1.5px solid ${C.border}`, animation:'fadeUp .18s ease both'}}>
            <button onClick={()=>setUnitModal(true)} style={{
              display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'10px', borderRadius:12,
              border:`1.5px dashed ${C.lav2}`, background:'transparent', color:C.lav, fontSize:12.5, fontWeight:800,
              cursor:'pointer', fontFamily:"'Nunito',sans-serif", transition:'all .15s',
            }}
              onMouseEnter={e=>{e.currentTarget.style.background=C.lavPale;}}
              onMouseLeave={e=>{e.currentTarget.style.background='transparent';}}>
              <IconPlus/> Thêm Unit
            </button>

            {!loaded && (
              <div style={{display:'flex', flexDirection:'column', gap:8}}>
                {[0,1].map(i=>(<div key={i} style={{height:56, borderRadius:20, background:C.bg2, opacity:0.6}}/>))}
              </div>
            )}
            {loaded && units.length===0 && (
              <div style={{textAlign:'center', padding:'20px 10px', fontSize:12.5, color:C.text3, fontWeight:600}}>Chưa có Unit nào trong bài học này</div>
            )}
            {loaded && units.map(u=>(
              <UnitBlock key={u.id} unit={u} dark={dark} C={C} confirm_={confirm_} toast_={toast_} onChanged={fetchUnits}/>
            ))}
          </div>
        )}

        {unitModal && (
          <UnitModal dark={dark} C={C} courseId={lesson.id} initial={null}
            onClose={()=>setUnitModal(false)}
            onSaved={()=>{ setUnitModal(false); setOpen(true); fetchUnits(); }}
            toast_={toast_}/>
        )}
        {lessonModal && (
          <LessonModal dark={dark} C={C} initial={lesson}
            onClose={()=>setLessonModal(false)}
            onSaved={()=>{ setLessonModal(false); onChanged(); }}
            toast_={toast_}/>
        )}
      </div>
    );
  }

  /* ══ VOCABULARY MANAGER (main export) ══ */
  function VocabularyManager({dark, C, confirm_, toast_}){
    const [lessons,setLessons] = useState([]);
    const [loading,setLoading] = useState(true);
    const [search,setSearch] = useState('');
    const [lessonModal,setLessonModal] = useState(false);

    const fetchLessons = useCallback(async ()=>{
      setLoading(true);
      try{
        const { data, error } = await window.supa.from('vocab_courses')
          .select('*').order('sort_order',{ascending:true}).order('created_at',{ascending:false});
        if(error) throw error;
        setLessons(data||[]);
      } catch(e){
        console.error('[vocab-manager] fetch lessons error:', e);
        toast_ && toast_('Không tải được danh sách bài học');
      } finally { setLoading(false); }
    },[toast_]);

    useEffect(()=>{ fetchLessons(); },[fetchLessons]);

    const filtered = useMemo(()=>{
      const q = search.trim().toLowerCase();
      if(!q) return lessons;
      return lessons.filter(c=>(c.title||'').toLowerCase().includes(q) || (c.description||'').toLowerCase().includes(q));
    },[lessons,search]);

    return(
      <div style={{padding:'16px 12px 100px', display:'flex', flexDirection:'column', gap:14}} className="fade-up">
        <div style={{display:'flex', alignItems:'center', gap:10}}>
          <div style={{flex:1, position:'relative'}}>
            <span style={{position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:C.text3, display:'flex'}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm bài học..."
              style={{width:'100%', padding:'10px 12px 10px 34px', borderRadius:18, border:`1.5px solid ${C.border2}`, background:C.surface, color:C.text, fontSize:13, outline:'none', fontFamily:"'Nunito',sans-serif", fontWeight:600, boxSizing:'border-box'}}/>
          </div>
          <PrimaryBtn onClick={()=>setLessonModal(true)} C={C} style={{whiteSpace:'nowrap'}}>
            <IconPlus/> Thêm từ vựng
          </PrimaryBtn>
        </div>

        <div style={{fontSize:12, color:C.text3, fontWeight:700}}>
          {lessons.length} bài học {search && `· ${filtered.length} khớp tìm kiếm`}
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
            background:dark?'rgba(255,255,255,0.02)':'rgba(168,85,247,0.02)',
          }}>
            <span style={{
              display:'flex', color:C.lav, opacity:0.55, animation:'bb-float 3s ease-in-out infinite',
              width:64, height:64, borderRadius:'50%', background:C.lavPale, alignItems:'center', justifyContent:'center',
            }}><IconBook size={30}/></span>
            <div style={{fontSize:14.5, fontWeight:900, color:C.text2, fontFamily:"'Baloo 2',cursive"}}>{search ? 'Không tìm thấy bài học' : 'Chưa có bài học nào'}</div>
            <div style={{fontSize:12, color:C.text3}}>{search ? 'Thử từ khoá khác nhé' : 'Bấm "Thêm từ vựng" để tạo bài học đầu tiên'}</div>
          </div>
        )}

        {!loading && filtered.length>0 && (
          <div style={{display:'flex', flexDirection:'column', gap:10}}>
            {filtered.map(c=>(
              <LessonBlock key={c.id} lesson={c} dark={dark} C={C} confirm_={confirm_} toast_={toast_} onChanged={fetchLessons}/>
            ))}
          </div>
        )}

        {lessonModal && (
          <LessonModal dark={dark} C={C} initial={null}
            onClose={()=>setLessonModal(false)}
            onSaved={()=>{ setLessonModal(false); fetchLessons(); }}
            toast_={toast_}/>
        )}
      </div>
    );
  }

  window.VocabularyManager = VocabularyManager;
})();
