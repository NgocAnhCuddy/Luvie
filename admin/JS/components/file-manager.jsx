import React, {useState,useEffect,useCallback,useRef,useMemo} from 'react';

// ── Nạp mammoth.js / SheetJS (xlsx) từ CDN khi cần, không qua npm ──
// (tránh phải đồng bộ package-lock.json — chỉ cần fetch script 1 lần,
//  cache lại trên window để lần xem file sau không tải lại)
function loadScriptOnce(src, globalName){
  if(window[globalName]) return Promise.resolve(window[globalName]);
  if(window['__ls_' + globalName]) return window['__ls_' + globalName];
  const p = new Promise((resolve, reject)=>{
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => window[globalName] ? resolve(window[globalName]) : reject(new Error(globalName + ' không nạp được'));
    s.onerror = () => reject(new Error('Không tải được thư viện: ' + src));
    document.head.appendChild(s);
  });
  window['__ls_' + globalName] = p;
  return p;
}
const loadMammoth = () => loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js', 'mammoth');
const loadXLSX = () => loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', 'XLSX');

// ══════════════════════════════════════════════════════════════════════
//  FILE MANAGER — trang độc lập, quản lý tài liệu cho học sinh tải về
//  Hiện ở tab riêng "Tài liệu" cạnh "Bài học" / "Listening" / "Học sinh".
//  Dữ liệu lưu trong bảng Supabase riêng: learning_files
//  File thật lưu trong Supabase Storage, bucket: learning_files
//
//  Cấu trúc 1 file (1 row trong bảng learning_files):
//    { id, title, description, filename, path (public URL),
//      storage_path (path thật trong bucket, dùng để xoá),
//      size, subject, sort_order, created_at }
//
//  SQL gợi ý để tạo bảng trên Supabase:
//    create table learning_files (
//      id uuid default gen_random_uuid() primary key,
//      title text not null,
//      description text default '',
//      filename text not null,
//      path text not null,
//      storage_path text not null,
//      size bigint default 0,
//      subject text default '',
//      sort_order integer default 0,
//      created_at timestamptz default now()
//    );
//    alter table learning_files enable row level security;
//    create policy "public_read" on learning_files for select to anon, authenticated using (true);
//    create policy "admin_write" on learning_files for all to authenticated using (true) with check (true);
//
//  Storage bucket "learning_files" (public=true), policy:
//    create policy "public_read_files" on storage.objects for select to anon, authenticated
//      using (bucket_id='learning_files');
//    create policy "admin_write_files" on storage.objects for all to authenticated
//      using (bucket_id='learning_files') with check (bucket_id='learning_files');
//
//  Props nhận từ app.jsx:
//    dark, C            — theme
//    confirm_, toast_   — dùng chung toàn app
// ══════════════════════════════════════════════════════════════════════
(function(){
  const FILE_BUCKET = 'learning_files';
  const MAX_MB = 50;

  const EXT_COLORS = {
    pdf:'#ef4444', doc:'#3b82f6', docx:'#3b82f6',
    xls:'#22c55e', xlsx:'#22c55e', ppt:'#f97316', pptx:'#f97316',
    zip:'#a855f7', rar:'#a855f7',
    mp4:'#06b6d4', mp3:'#06b6d4', jpg:'#f59e0b', jpeg:'#f59e0b', png:'#f59e0b', gif:'#f59e0b', webp:'#f59e0b',
  };

  const genId = () => 'f'+Date.now()+'_'+Math.random().toString(36).slice(2,8);
  const getExt = name => String(name||'').split('.').pop().toLowerCase();
  const fmtBytes = n => {
    if(!n && n!==0) return '';
    if(n<1024) return n+' B';
    if(n<1024*1024) return (n/1024).toFixed(1)+' KB';
    return (n/(1024*1024)).toFixed(1)+' MB';
  };
  const fmtDate = d => { try{return new Date(d).toLocaleDateString('vi-VN');}catch(e){return '';} };
  const sanitizeFilename = name => String(name||'file').replace(/[^\w.\-]+/g,'_').replace(/_+/g,'_');

  /* map DB row -> UI item (đã snake_case sẵn nên gần như giữ nguyên) */
  const fromRow = r => ({
    id: r.id, title: r.title||'', description: r.description||'',
    filename: r.filename||'', path: r.path||'', storagePath: r.storage_path||'',
    size: r.size||0, subject: r.subject||'', sortOrder: r.sort_order??0,
    created_at: r.created_at,
  });

  function FileTypeIcon({ext,size=20,color}){
    const col = color || EXT_COLORS[ext] || '#9ca3af';
    const isImg = ['jpg','jpeg','png','gif','webp'].includes(ext);
    if(isImg){
      return(<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="9" r="1.6" fill={col} stroke="none"/><path d="M21 15l-5-5-9 9"/></svg>);
    }
    return(<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>);
  }

  /* ─────────────────────── FORM: thêm / sửa file ─────────────────────── */
  function FileFormModal({dark, C, initial, onClose, onSaved, toast_}){
    const isEdit = !!initial;
    const [title,setTitle] = useState(initial?.title||'');
    const [description,setDescription] = useState(initial?.description||'');
    const [subject,setSubject] = useState(initial?.subject||'');
    const [file,setFile] = useState(null);
    const [dragOver,setDragOver] = useState(false);
    const [saving,setSaving] = useState(false);
    const [err,setErr] = useState('');
    const fileRef = useRef();

    function pickFile(f){
      if(!f) return;
      if(f.size > MAX_MB*1024*1024){ setErr(`File tối đa ${MAX_MB}MB`); return; }
      setErr('');
      setFile(f);
      if(!title) setTitle(f.name.replace(/\.[^.]+$/,''));
    }

    async function handleSave(){
      if(!title.trim()){ setErr('Nhập tên tài liệu nhé!'); return; }
      if(!isEdit && !file){ setErr('Chọn file để tải lên!'); return; }
      setSaving(true);
      setErr('');
      try{
        if(file){
          // Upload file mới lên Storage
          const ext = getExt(file.name);
          const safeName = sanitizeFilename(file.name);
          const storagePath = `files/${genId()}_${safeName}`;
          const { error: upErr } = await window.supa.storage
            .from(FILE_BUCKET)
            .upload(storagePath, file, { contentType: file.type||undefined, upsert:false });
          if(upErr) throw upErr;

          // Nếu đang sửa và có file cũ -> xoá file cũ khỏi Storage
          if(isEdit && initial.storagePath){
            await window.supa.storage.from(FILE_BUCKET).remove([initial.storagePath]).catch(()=>{});
          }

          const { data: urlData } = window.supa.storage.from(FILE_BUCKET).getPublicUrl(storagePath);
          const publicUrl = urlData.publicUrl;

          const row = {
            title: title.trim(), description: description.trim(),
            subject: subject.trim(), filename: file.name,
            path: publicUrl, storage_path: storagePath, size: file.size,
          };
          if(isEdit){
            const { error } = await window.supa.from('learning_files').update(row).eq('id', initial.id);
            if(error) throw error;
          } else {
            const { error } = await window.supa.from('learning_files').insert({ id: crypto.randomUUID(), ...row, sort_order:0 });
            if(error) throw error;
          }
        } else if(isEdit){
          // Chỉ sửa metadata, không đổi file
          const { error } = await window.supa.from('learning_files')
            .update({ title: title.trim(), description: description.trim(), subject: subject.trim() })
            .eq('id', initial.id);
          if(error) throw error;
        }
        toast_ && toast_(isEdit ? 'Đã cập nhật tài liệu!' : 'Đã thêm tài liệu mới!');
        onSaved();
      } catch(e){
        console.error('[file-manager] save error:', e);
        const msg = (e.message||'').toLowerCase();
        setErr(msg.includes('bucket') ? 'Lỗi storage: tạo bucket "learning_files" trong Supabase nhé!' : (e.message || 'Có lỗi xảy ra, thử lại nhé!'));
      } finally {
        setSaving(false);
      }
    }

    const inputStyle = {
      width:'100%', padding:'10px 12px', borderRadius:12,
      border:`1.5px solid ${C.border2}`, background:C.surface, color:C.text,
      fontSize:13.5, fontFamily:"'Nunito',sans-serif", fontWeight:600,
      outline:'none', boxSizing:'border-box',
    };
    const labelStyle = { fontSize:11.5, fontWeight:800, color:C.text3, marginBottom:5, display:'block' };

    return(
      <div onClick={e=>{if(e.target===e.currentTarget && !saving) onClose();}}
        style={{position:'fixed', inset:0, zIndex:9200, background:'rgba(10,2,25,0.72)', backdropFilter:'blur(10px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16}}>
        <div style={{width:'100%', maxWidth:440, maxHeight:'88vh', overflowY:'auto', borderRadius:22, padding:'20px 18px', background:dark?'#1E0D15':'#fff', border:`1.5px solid ${C.border2}`, boxShadow:'0 24px 60px rgba(0,0,0,.3)', animation:'pop .2s ease both'}}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16}}>
            <div style={{fontSize:15.5, fontWeight:900, color:C.text, display:'flex', alignItems:'center', gap:8}}>
              <span style={{display:'flex', color:C.lav}}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              </span>
              {isEdit ? 'Sửa tài liệu' : 'Thêm tài liệu mới'}
            </div>
            <button onClick={onClose} disabled={saving} style={{width:28, height:28, borderRadius:99, border:`1.5px solid ${C.border2}`, background:C.bg2, color:C.text3, cursor:saving?'not-allowed':'pointer', fontSize:15, fontWeight:900, lineHeight:1, transition:'all .15s', opacity:saving?0.5:1}}
              onMouseEnter={e=>{if(!saving){e.currentTarget.style.background='rgba(239,68,68,0.1)';e.currentTarget.style.color='#ef4444';}}}
              onMouseLeave={e=>{e.currentTarget.style.background=C.bg2;e.currentTarget.style.color=C.text3;}}
              onMouseDown={e=>{if(!saving)e.currentTarget.style.transform='scale(0.88)';}}
              onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}>×</button>
          </div>

          {/* Dropzone */}
          <div
            onClick={()=>fileRef.current && fileRef.current.click()}
            onDragOver={e=>{e.preventDefault(); setDragOver(true);}}
            onDragLeave={()=>setDragOver(false)}
            onDrop={e=>{e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files && e.dataTransfer.files[0]);}}
            style={{
              border:`2px dashed ${dragOver?C.lav:C.border2}`, borderRadius:20, padding:'18px 14px',
              textAlign:'center', cursor:'pointer', marginBottom:14,
              background:dragOver?C.lavPale:C.bg2, transition:'all .15s',
            }}
            onMouseEnter={e=>{if(!dragOver)e.currentTarget.style.borderColor=C.lav2;}}
            onMouseLeave={e=>{if(!dragOver)e.currentTarget.style.borderColor=C.border2;}}>
            <input ref={fileRef} type="file" style={{display:'none'}}
              onChange={e=>pickFile(e.target.files && e.target.files[0])}/>
            {file ? (
              <div style={{display:'flex', alignItems:'center', gap:10, justifyContent:'center'}}>
                <FileTypeIcon ext={getExt(file.name)} size={24}/>
                <div style={{textAlign:'left', minWidth:0}}>
                  <div style={{fontSize:13, fontWeight:800, color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:220}}>{file.name}</div>
                  <div style={{fontSize:11, color:C.text3}}>{fmtBytes(file.size)}</div>
                </div>
              </div>
            ) : isEdit ? (
              <div>
                <div style={{display:'flex', justifyContent:'center', marginBottom:6}}><FileTypeIcon ext={getExt(initial.filename)} size={26}/></div>
                <div style={{fontSize:12.5, fontWeight:700, color:C.text2}}>{initial.filename}</div>
                <div style={{fontSize:11, color:C.text3, marginTop:3}}>Bấm để thay file khác (không bắt buộc)</div>
              </div>
            ) : (
              <div>
                <div style={{display:'flex', justifyContent:'center', marginBottom:6, color:C.text3}}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </div>
                <div style={{fontSize:13, fontWeight:800, color:C.text2}}>Bấm để chọn file hoặc kéo thả vào đây</div>
                <div style={{fontSize:11, color:C.text3, marginTop:3}}>Tối đa {MAX_MB}MB</div>
              </div>
            )}
          </div>

          <div style={{marginBottom:12}}>
            <label style={labelStyle}>Tên tài liệu *</label>
            <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Vd: Đề cương Unit 5" style={inputStyle}/>
          </div>
          <div style={{marginBottom:12}}>
            <label style={labelStyle}>Mô tả</label>
            <textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Vd: Ôn tập từ vựng và ngữ pháp Unit 5" rows={2} style={{...inputStyle, resize:'vertical', fontFamily:"'Nunito',sans-serif"}}/>
          </div>
          <div style={{marginBottom:16}}>
            <label style={labelStyle}>Môn học (tuỳ chọn)</label>
            <input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Vd: Tiếng Anh" style={inputStyle}/>
          </div>

          {err && <div style={{fontSize:12, fontWeight:700, color:'#ef4444', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:'8px 12px', marginBottom:14}}>{err}</div>}

          <div style={{display:'flex', gap:8}}>
            <button onClick={onClose} disabled={saving}
              style={{flex:1, padding:'11px', borderRadius:999, border:`1.5px solid ${C.border2}`, background:'transparent', color:C.text2, fontSize:13, fontWeight:800, cursor:saving?'not-allowed':'pointer', fontFamily:"'Nunito',sans-serif", transition:'all .15s', opacity:saving?0.6:1}}
              onMouseEnter={e=>{if(!saving){e.currentTarget.style.background=C.bg2;e.currentTarget.style.transform='translateY(-1px)';}}}
              onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.transform='translateY(0)';}}
              onMouseDown={e=>{if(!saving)e.currentTarget.style.transform='scale(0.96)';}}
              onMouseUp={e=>{if(!saving)e.currentTarget.style.transform='translateY(-1px)';}}>Huỷ</button>
            <button onClick={handleSave} disabled={saving}
              style={{flex:2, padding:'11px', borderRadius:999, border:'none', background:C.grad, color:'#fff', fontSize:13, fontWeight:900, cursor:saving?'default':'pointer', fontFamily:"'Nunito',sans-serif", boxShadow:'0 3px 14px rgba(168,85,247,0.3)', opacity:saving?0.7:1, transition:'all .18s'}}
              onMouseEnter={e=>{if(!saving){e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 5px 18px rgba(168,85,247,0.42)';}}}
              onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 3px 14px rgba(168,85,247,0.3)';}}
              onMouseDown={e=>{if(!saving)e.currentTarget.style.transform='scale(0.97)';}}
              onMouseUp={e=>{if(!saving)e.currentTarget.style.transform='translateY(-1px)';}}>
              {saving ? 'Đang lưu...' : (isEdit ? 'Lưu thay đổi' : 'Tải lên')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Trạng thái loading / lỗi dùng chung cho các khung preview (hỗ trợ dark mode) ── */
  function PreviewStatus({kind, label, C}){
    if(kind==='loading'){
      return (
        <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, padding:'40px 20px', width:'100%'}}>
          <span style={{
            width:34, height:34, borderRadius:'50%',
            border:'3px solid rgba(244,114,182,0.18)', borderTopColor:'#f472b6',
            display:'inline-block', animation:'bb-spin .8s linear infinite',
          }}/>
          <span style={{fontSize:12.5, fontWeight:700, color:C?.text2||'#a06080'}}>{label || 'Đang tải nội dung...'}</span>
        </div>
      );
    }
    return (
      <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, padding:'40px 20px', width:'100%'}}>
        <span style={{
          width:46, height:46, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
          background:'rgba(239,68,68,0.1)', color:'#ef4444',
        }}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16.5" x2="12.01" y2="16.5"/></svg>
        </span>
        <span style={{fontSize:13, fontWeight:700, color:C?.text2||'#6b5a68'}}>{label}</span>
      </div>
    );
  }

  /* ── Xem Word (.doc/.docx) tại chỗ bằng mammoth, không cần URL public ── */
  function DocxPreview({url, C}){
    const [html, setHtml] = useState(null);
    const [err, setErr] = useState(false);
    useEffect(()=>{
      let cancelled = false;
      setHtml(null); setErr(false);
      Promise.all([loadMammoth(), fetch(url).then(r=>r.arrayBuffer())])
        .then(([mammoth, buf])=>mammoth.convertToHtml({arrayBuffer:buf}))
        .then(res=>{ if(!cancelled) setHtml(res.value); })
        .catch(()=>{ if(!cancelled) setErr(true); });
      return ()=>{ cancelled = true; };
    },[url]);

    if(err) return <PreviewStatus kind="error" label="Không đọc được nội dung file Word." C={C}/>;
    if(html===null) return <PreviewStatus kind="loading" label="Đang đọc file Word..." C={C}/>;
    return (
      <div className="docx-preview" style={{
        width:'100%', maxHeight:'62vh', overflowY:'auto', textAlign:'left',
        background:'#fff', borderRadius:20, padding:'22px 26px', color:'#2d1420',
        fontSize:14, lineHeight:1.7, boxShadow:'0 4px 20px rgba(168,85,247,0.1)',
        border:'1px solid rgba(244,114,182,0.15)',
      }} dangerouslySetInnerHTML={{__html: html}}/>
    );
  }

  /* ── Xem Excel (.xls/.xlsx) tại chỗ bằng SheetJS, không cần URL public ── */
  function XlsxPreview({url, C}){
    const [sheets, setSheets] = useState(null);
    const [active, setActive] = useState(0);
    const [err, setErr] = useState(false);
    useEffect(()=>{
      let cancelled = false;
      setSheets(null); setErr(false); setActive(0);
      Promise.all([loadXLSX(), fetch(url).then(r=>r.arrayBuffer())])
        .then(([XLSX, buf])=>{
          const wb = XLSX.read(buf, {type:'array'});
          const parsed = wb.SheetNames.map(name=>({
            name,
            html: XLSX.utils.sheet_to_html(wb.Sheets[name], {editable:false})
          }));
          if(!cancelled) setSheets(parsed);
        })
        .catch(()=>{ if(!cancelled) setErr(true); });
      return ()=>{ cancelled = true; };
    },[url]);

    if(err) return <PreviewStatus kind="error" label="Không đọc được nội dung file Excel." C={C}/>;
    if(sheets===null) return <PreviewStatus kind="loading" label="Đang đọc file Excel..." C={C}/>;
    return (
      <div style={{width:'100%'}}>
        {sheets.length>1 && (
          <div style={{display:'flex', gap:6, flexWrap:'wrap', marginBottom:12}}>
            {sheets.map((s,i)=>(
              <button key={s.name} onClick={()=>setActive(i)}
                style={{
                  padding:'6px 14px', borderRadius:999, border:'none', cursor:'pointer',
                  fontSize:12, fontWeight:800, fontFamily:"'Nunito',sans-serif", transition:'all .16s',
                  background: i===active ? 'linear-gradient(135deg,#f472b6,#a855f7)' : (C?.bg2||'rgba(244,114,182,0.1)'),
                  color: i===active ? '#fff' : (C?.text2||'#a06080'),
                  boxShadow: i===active ? '0 3px 10px rgba(168,85,247,0.3)' : 'none',
                }}>
                {s.name}
              </button>
            ))}
          </div>
        )}
        <div className="xlsx-preview" style={{
          width:'100%', maxHeight:'56vh', overflow:'auto', background:'#fff',
          borderRadius:20, padding:14, boxShadow:'0 4px 20px rgba(168,85,247,0.1)',
          border:'1px solid rgba(244,114,182,0.15)',
        }} dangerouslySetInnerHTML={{__html: sheets[active].html}}/>
      </div>
    );
  }

  /* ── Xem ảnh, có trạng thái tải/lỗi để không bị "biến mất" khi ảnh load fail ── */
  function ImagePreview({url, C}){
    const [status, setStatus] = useState('loading'); // loading | ok | error
    useEffect(()=>{ setStatus('loading'); }, [url]);
    return (
      <div style={{width:'100%', minHeight:200, display:'flex', alignItems:'center', justifyContent:'center'}}>
        {status==='loading' && <PreviewStatus kind="loading" label="Đang tải ảnh..." C={C}/>}
        {status==='error' && <PreviewStatus kind="error" label="Không tải được ảnh." C={C}/>}
        <img src={url} onLoad={()=>setStatus('ok')} onError={()=>setStatus('error')}
          style={{
            maxWidth:'100%', maxHeight:'60vh', borderRadius:20,
            boxShadow:'0 8px 28px rgba(168,85,247,0.18)', border:'1px solid rgba(244,114,182,0.15)',
            display: status==='ok' ? 'block' : 'none',
          }}/>
      </div>
    );
  }

  /* ─────────────────────── PREVIEW: xem trước file tại chỗ ─────────────────────── */
  function FilePreviewModal({dark, C, f, onClose}){
    const ext = getExt(f.filename);
    const url = f.path;
    const isImage = ['jpg','jpeg','png','gif','webp','svg'].includes(ext);
    const isPdf = ext === 'pdf';
    const isVideo = ['mp4','webm','ogg','mov'].includes(ext);
    const isAudio = ['mp3','wav','m4a'].includes(ext);
    const isWord = ['doc','docx'].includes(ext);
    const isExcel = ['xls','xlsx'].includes(ext);

    useEffect(()=>{
      const onKey = e => { if(e.key==='Escape') onClose(); };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    },[onClose]);

    let preview;
    if(isImage){
      preview = <ImagePreview url={url} C={C}/>;
    } else if(isPdf){
      preview = <iframe src={url} style={{width:'100%', height:'62vh', border:'none', borderRadius:12, background:'#fff'}}/>;
    } else if(isVideo){
      preview = <video controls style={{maxWidth:'100%', maxHeight:'60vh', borderRadius:12}} src={url}/>;
    } else if(isAudio){
      preview = <div style={{padding:'32px 0', width:'100%'}}><audio controls style={{width:'100%'}} src={url}/></div>;
    } else if(isWord){
      preview = <DocxPreview url={url} C={C}/>;
    } else if(isExcel){
      preview = <XlsxPreview url={url} C={C}/>;
    } else {
      preview = (
        <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, padding:'36px 16px', width:'100%'}}>
          <span style={{
            width:60, height:60, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
            background: dark ? 'rgba(244,114,182,0.12)' : 'rgba(244,114,182,0.1)',
          }}>
            <FileTypeIcon ext={ext} size={28} color={C.text3}/>
          </span>
          <div style={{fontSize:13.5, color:C.text2, fontWeight:800, fontFamily:"'Baloo 2',cursive"}}>Không thể xem trước loại file này</div>
          <div style={{fontSize:12, color:C.text3}}>Bấm "Xem file" bên dưới để mở tab mới</div>
        </div>
      );
    }

    return(
      <div onClick={e=>{if(e.target===e.currentTarget) onClose();}}
        style={{position:'fixed', inset:0, zIndex:9300, background:'rgba(10,2,25,0.72)', backdropFilter:'blur(10px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16}}>
        <div style={{width:'100%', maxWidth:680, maxHeight:'90vh', overflowY:'auto', borderRadius:22, background:dark?'#1E0D15':'#fff', border:`1.5px solid ${C.border2}`, boxShadow:'0 24px 60px rgba(0,0,0,.3)', animation:'pop .2s ease both', display:'flex', flexDirection:'column'}}>
          <div style={{padding:'16px 18px', display:'flex', alignItems:'center', gap:10, borderBottom:`1.5px solid ${C.border2}`}}>
            <FileTypeIcon ext={ext} size={22}/>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:14, fontWeight:900, color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{f.title}</div>
              <div style={{fontSize:11, color:C.text3, fontWeight:700, textTransform:'uppercase', marginTop:2}}>{ext} · {fmtBytes(f.size)}</div>
            </div>
            <button onClick={onClose} style={{width:30, height:30, borderRadius:99, border:`1.5px solid ${C.border2}`, background:C.bg2, color:C.text3, cursor:'pointer', fontSize:16, fontWeight:900, lineHeight:1, flexShrink:0}}>×</button>
          </div>
          <div style={{padding:'20px 16px', background: dark ? 'rgba(255,255,255,0.02)' : 'linear-gradient(180deg,rgba(248,244,255,0.5),rgba(255,240,248,0.5))', display:'flex', justifyContent:'center', alignItems:'flex-start', minHeight:140, flex:1}}>
            {preview}
          </div>
          <div style={{padding:'10px 18px', borderTop:`1.5px solid ${C.border2}`, display:'flex', justifyContent:'center', gap:16}}>
            <a href={url} target="_blank" rel="noopener noreferrer" style={{fontSize:12, fontWeight:700, color:C.lav, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:5}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              Mở trong tab mới
            </a>
            <a href={url} download={f.title} style={{fontSize:12, fontWeight:700, color:C.text2, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:5}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/></svg>
              Tải về
            </a>
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────────── DÒNG FILE trong danh sách ─────────────────────── */
  function FileRow({f, dark, C, onEdit, onDelete, onPreview}){
    const ext = getExt(f.filename);
    const col = EXT_COLORS[ext] || C.lav;
    return(
      <div style={{
        display:'flex', alignItems:'center', gap:12, padding:'12px 14px',
        borderRadius:20, background:C.surface, border:`1.5px solid ${C.border}`,
        boxShadow:`0 2px 10px ${col}10`,
      }}>
        <div style={{width:40, height:40, borderRadius:12, flexShrink:0, background:`${col}18`, display:'flex', alignItems:'center', justifyContent:'center'}}>
          <FileTypeIcon ext={ext} size={20} color={col}/>
        </div>
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontSize:13.5, fontWeight:800, color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{f.title}</div>
          <div style={{fontSize:11.5, color:C.text3, marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{f.description || 'Không có mô tả'}</div>
          <div style={{fontSize:10, color:C.text4, marginTop:3, display:'flex', gap:6}}>
            <span style={{textTransform:'uppercase', fontWeight:800, color:col}}>{ext}</span>
            <span>· {fmtBytes(f.size)}</span>
            <span>· {fmtDate(f.created_at)}</span>
            {f.subject && <span>· {f.subject}</span>}
          </div>
        </div>
        <div style={{display:'flex', gap:6, flexShrink:0}}>
          <button onClick={()=>onPreview(f)}
            style={{width:30, height:30, borderRadius:10, border:`1.5px solid ${C.border2}`, background:C.bg2, color:C.text3, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .15s'}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=C.lav2;e.currentTarget.style.color=C.lav;e.currentTarget.style.transform='translateY(-1px)';}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border2;e.currentTarget.style.color=C.text3;e.currentTarget.style.transform='translateY(0)';}}
            title="Xem trước">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button onClick={()=>onEdit(f)} title="Sửa"
            style={{width:30, height:30, borderRadius:10, border:`1.5px solid ${C.border2}`, background:C.bg2, color:C.lav, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .15s'}}
            onMouseEnter={e=>{e.currentTarget.style.background=C.lavL;e.currentTarget.style.transform='translateY(-1px)';}}
            onMouseLeave={e=>{e.currentTarget.style.background=C.bg2;e.currentTarget.style.transform='translateY(0)';}}
            onMouseDown={e=>e.currentTarget.style.transform='scale(0.9)'}
            onMouseUp={e=>e.currentTarget.style.transform='translateY(-1px)'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button onClick={()=>onDelete(f)} title="Xoá"
            style={{width:30, height:30, borderRadius:10, border:'1.5px solid rgba(239,68,68,0.35)', background:'rgba(239,68,68,0.08)', color:'#ef4444', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .15s'}}
            onMouseEnter={e=>{e.currentTarget.style.background='rgba(239,68,68,0.18)';e.currentTarget.style.transform='translateY(-1px)';}}
            onMouseLeave={e=>{e.currentTarget.style.background='rgba(239,68,68,0.08)';e.currentTarget.style.transform='translateY(0)';}}
            onMouseDown={e=>e.currentTarget.style.transform='scale(0.9)'}
            onMouseUp={e=>e.currentTarget.style.transform='translateY(-1px)'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </div>
    );
  }

  /* ══ FILE MANAGER (main export) ══ */
  function FileManager({dark, C, confirm_, toast_}){
    const [files,setFiles] = useState([]);
    const [loading,setLoading] = useState(true);
    const [search,setSearch] = useState('');
    const [modalOpen,setModalOpen] = useState(false);
    const [editing,setEditing] = useState(null);
    const [deleting,setDeleting] = useState(null);
    const [previewing,setPreviewing] = useState(null);

    const fetchFiles = useCallback(async ()=>{
      setLoading(true);
      try{
        const { data, error } = await window.supa.from('learning_files')
          .select('*').order('sort_order',{ascending:true}).order('created_at',{ascending:false});
        if(error) throw error;
        setFiles((data||[]).map(fromRow));
      } catch(e){
        console.error('[file-manager] fetch error:', e);
        toast_ && toast_('Không tải được danh sách tài liệu');
      } finally {
        setLoading(false);
      }
    },[toast_]);

    useEffect(()=>{ fetchFiles(); },[fetchFiles]);

    const filtered = useMemo(()=>{
      const q = search.trim().toLowerCase();
      if(!q) return files;
      return files.filter(f=>(f.title||'').toLowerCase().includes(q) || (f.description||'').toLowerCase().includes(q) || (f.subject||'').toLowerCase().includes(q));
    },[files,search]);

    function openAdd(){ setEditing(null); setModalOpen(true); }
    function openEdit(f){ setEditing(f); setModalOpen(true); }
    function closeModal(){ setModalOpen(false); setEditing(null); }
    function onSaved(){ closeModal(); fetchFiles(); }

    async function doDelete(f){
      setDeleting(f.id);
      try{
        if(f.storagePath){
          await window.supa.storage.from(FILE_BUCKET).remove([f.storagePath]).catch(()=>{});
        }
        const { error } = await window.supa.from('learning_files').delete().eq('id', f.id);
        if(error) throw error;
        setFiles(prev=>prev.filter(x=>x.id!==f.id));
        toast_ && toast_('Đã xoá tài liệu');
      } catch(e){
        console.error('[file-manager] delete error:', e);
        toast_ && toast_('Xoá thất bại, thử lại nhé!');
      } finally {
        setDeleting(null);
      }
    }

    function handleDelete(f){
      if(confirm_){
        confirm_({
          title: 'Xoá tài liệu?',
          message: `"${f.title}" sẽ bị xoá vĩnh viễn khỏi hệ thống.`,
          confirmLabel: 'Xoá',
          danger: true,
          onConfirm: ()=>doDelete(f),
        });
      } else if(window.confirm(`Xoá "${f.title}"?`)){
        doDelete(f);
      }
    }

    return(
      <div style={{padding:'16px 12px 100px', display:'flex', flexDirection:'column', gap:14}} className="fade-up">
        <div style={{display:'flex', alignItems:'center', gap:10}}>
          <div style={{flex:1, position:'relative'}}>
            <span style={{position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:C.text3, display:'flex'}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm tài liệu..."
              style={{width:'100%', padding:'10px 12px 10px 34px', borderRadius:18, border:`1.5px solid ${C.border2}`, background:C.surface, color:C.text, fontSize:13, outline:'none', fontFamily:"'Nunito',sans-serif", fontWeight:600, boxSizing:'border-box'}}/>
          </div>
          <button onClick={openAdd} style={{
            display:'flex', alignItems:'center', gap:6, padding:'10px 16px', borderRadius:18, border:'none',
            background:C.grad, color:'#fff', fontSize:13, fontWeight:900, cursor:'pointer',
            boxShadow:'0 3px 14px rgba(168,85,247,0.3)', whiteSpace:'nowrap', fontFamily:"'Nunito',sans-serif",
            transition:'all .18s',
          }}
            onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 6px 20px rgba(168,85,247,0.42)';}}
            onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 3px 14px rgba(168,85,247,0.3)';}}
            onMouseDown={e=>e.currentTarget.style.transform='scale(0.96)'}
            onMouseUp={e=>e.currentTarget.style.transform='translateY(-2px)'}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Thêm file
          </button>
        </div>

        <div style={{fontSize:12, color:C.text3, fontWeight:700}}>
          {files.length} tài liệu {search && `· ${filtered.length} khớp tìm kiếm`}
        </div>

        {loading && (
          <div style={{display:'flex', flexDirection:'column', gap:10}}>
            {[0,1,2].map(i=>(<div key={i} style={{height:66, borderRadius:20, background:C.surface, border:`1.5px solid ${C.border}`, opacity:0.5}}/>))}
          </div>
        )}

        {!loading && filtered.length===0 && (
          <div style={{textAlign:'center', padding:'40px 20px', color:C.text3, borderRadius:20, border:`1.5px solid ${C.border}`}}>
            <div style={{display:'flex', justifyContent:'center', marginBottom:10, opacity:0.5}}>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div style={{fontSize:14, fontWeight:800, color:C.text2}}>{search ? 'Không tìm thấy tài liệu' : 'Chưa có tài liệu nào'}</div>
            <div style={{fontSize:12, marginTop:4}}>{search ? 'Thử từ khoá khác nhé' : 'Bấm "Thêm file" để tải tài liệu đầu tiên lên'}</div>
          </div>
        )}

        {!loading && filtered.length>0 && (
          <div style={{display:'flex', flexDirection:'column', gap:9}}>
            {filtered.map(f=>(
              <FileRow key={f.id} f={f} dark={dark} C={C} onEdit={openEdit}
                onDelete={handleDelete} onPreview={setPreviewing}/>
            ))}
          </div>
        )}

        {modalOpen && (
          <FileFormModal dark={dark} C={C} initial={editing} onClose={closeModal} onSaved={onSaved} toast_={toast_}/>
        )}
        {previewing && (
          <FilePreviewModal dark={dark} C={C} f={previewing} onClose={()=>setPreviewing(null)}/>
        )}
      </div>
    );
  }

  window.FileManager = FileManager;
})();
