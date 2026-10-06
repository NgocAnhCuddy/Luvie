import React from 'react';

/* ══ QUESTION EDITOR ══════════════════════════════════════════════════ */
(function(){
const {useState, useEffect, useRef} = React;

/* ── Ảnh minh họa cho câu hỏi ─────────────────────────────────────────
   Ảnh được nén (tối đa 1400px, WebP ~85%) rồi upload lên bucket Supabase
   "learning_files" (public — bucket này đã có sẵn cho Tài liệu, không cần
   tạo thêm). Câu hỏi chỉ lưu link: q.image = public URL.
   KHÔNG xoá file trên Storage khi bỏ ảnh khỏi câu hỏi, vì khi "nhân bản bài"
   nhiều bài có thể dùng chung 1 link ảnh — xoá sẽ làm hỏng bài còn lại. */
const IMG_BUCKET = 'learning_files';
const IMG_MAX_SIDE = 1400;
const IMG_MAX_MB = 10;

// Giải mã ảnh: thử createImageBitmap → <img> qua blob URL → <img> qua dataURL
async function decodeImage(file){
  if (typeof createImageBitmap === 'function') {
    try { const bm = await createImageBitmap(file, {imageOrientation: 'from-image'}); return {src: bm, w: bm.width, h: bm.height, close: () => { try { bm.close(); } catch (e) {} }}; } catch (e) {}
    try { const bm = await createImageBitmap(file); return {src: bm, w: bm.width, h: bm.height, close: () => { try { bm.close(); } catch (e) {} }}; } catch (e) {}
  }
  const loadImg = (href, revoke) => new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => { if (revoke) URL.revokeObjectURL(href); res({src: img, w: img.naturalWidth, h: img.naturalHeight, close: () => {}}); };
    img.onerror = () => { if (revoke) URL.revokeObjectURL(href); rej(new Error('img-error')); };
    img.src = href;
  });
  try { return await loadImg(URL.createObjectURL(file), true); } catch (e) {}
  const dataUrl = await new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = () => rej(new Error('Không đọc được file ảnh'));
    fr.readAsDataURL(file);
  });
  return await loadImg(dataUrl, false);
}

function isHeic(file){
  return /hei[cf]/i.test(file.type || '') || /\.hei[cf]$/i.test(file.name || '');
}

// Nhận diện HEIC qua "magic bytes" (Android hay trả type rỗng / tên file lạ)
async function sniffHeic(file){
  try {
    const buf = new Uint8Array(await file.slice(0, 32).arrayBuffer());
    const box = String.fromCharCode(...buf.slice(4, 8));
    const brand = String.fromCharCode(...buf.slice(8, 12));
    return box === 'ftyp' && /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1|avif)$/.test(brand) && brand !== 'avif';
  } catch (e) { return false; }
}

const HEIC_LIBS = [
  'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js',
  'https://unpkg.com/heic2any@0.0.4/dist/heic2any.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/heic2any/0.0.4/heic2any.min.js'
];
let _heicLibPromise = null;
function loadHeicLib(){
  if (window.heic2any) return Promise.resolve(window.heic2any);
  if (_heicLibPromise) return _heicLibPromise;
  _heicLibPromise = (async () => {
    for (const src of HEIC_LIBS) {
      try {
        await new Promise((res, rej) => {
          const sc = document.createElement('script');
          sc.src = src; sc.async = true;
          sc.onload = res; sc.onerror = () => { sc.remove(); rej(new Error('load-fail')); };
          document.head.appendChild(sc);
        });
        if (window.heic2any) return window.heic2any;
      } catch (e) {}
    }
    _heicLibPromise = null;
    throw new Error('Không tải được bộ chuyển HEIC (kiểm tra mạng rồi thử lại)');
  })();
  return _heicLibPromise;
}

// HEIC/HEIF → JPEG (chạy ngay trên máy, không gửi đi đâu)
async function heicToJpeg(file){
  const conv = await loadHeicLib();
  let out;
  try { out = await conv({blob: file, toType: 'image/jpeg', quality: 0.9}); }
  catch (e) { throw new Error('Không chuyển được ảnh HEIC này — hãy thử ảnh khác hoặc đổi sang JPG'); }
  const blob = Array.isArray(out) ? out[0] : out;
  if (!blob) throw new Error('Không chuyển được ảnh HEIC này');
  return new File([blob], (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg', {type: 'image/jpeg'});
}

async function compressImage(file){
  if (file.type === 'image/gif') return {blob: file, ext: 'gif', type: 'image/gif'};
  if (isHeic(file) || await sniffHeic(file)) file = await heicToJpeg(file);
  let dec;
  try { dec = await decodeImage(file); }
  catch (e) {
    // Có thể là HEIC đội lốt .jpg → thử chuyển đổi rồi giải mã lại
    if (!file._heicTried && await sniffHeic(file)) { file = await heicToJpeg(file); file._heicTried = true; return compressImage(file); }
    // Không giải mã được: nếu là JPG/PNG/WebP thì tải nguyên file gốc (trình duyệt vẫn hiển thị được)
    const t = (file.type || '').toLowerCase();
    if (!isHeic(file) && /^image\/(jpeg|jpg|png|webp)$/.test(t)) {
      return {blob: file, ext: t === 'image/png' ? 'png' : t === 'image/webp' ? 'webp' : 'jpg', type: t};
    }
    throw new Error('Không đọc được file ảnh');
  }
  try {
    const k = Math.min(1, IMG_MAX_SIDE / Math.max(dec.w, dec.h));
    const w = Math.max(1, Math.round(dec.w * k)), h = Math.max(1, Math.round(dec.h * k));
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(dec.src, 0, 0, w, h);
    const toBlob = (type, q) => new Promise(r => cv.toBlob(r, type, q));
    let b = await toBlob('image/webp', 0.85);
    // Không mã hoá được WebP → toBlob trả PNG (rất nặng với ảnh chụp) → thử lại bằng JPEG
    if (b && b.type === 'image/png' && file.type !== 'image/png') b = await toBlob('image/jpeg', 0.85) || b;
    if (!b) throw new Error('Không xử lý được ảnh');
    const ext = b.type === 'image/webp' ? 'webp' : b.type === 'image/png' ? 'png' : 'jpg';
    return {blob: b, ext, type: b.type};
  } finally { dec.close(); }
}

function QImageField({q, onUp, C}){
  const {Fld} = window;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [drag, setDrag] = useState(false);
  const [broken, setBroken] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { setBroken(false); }, [q.image]);

  async function handleFile(f){
    if (!f) return;
    if (!/^image\//.test(f.type) && !isHeic(f)) { setErr('Chỉ nhận file ảnh (JPG, PNG, WebP, GIF)'); return; }
    if (f.size > IMG_MAX_MB * 1024 * 1024) { setErr('Ảnh tối đa ' + IMG_MAX_MB + 'MB'); return; }
    if (!window.supa) { setErr('Chưa kết nối Supabase — không thể tải ảnh lên'); return; }
    setBusy(true); setErr('');
    try {
      const {blob, ext, type} = await compressImage(f);
      const path = 'question-images/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.' + ext;
      const {error} = await window.supa.storage.from(IMG_BUCKET)
        .upload(path, blob, {contentType: type, upsert: false, cacheControl: '31536000'});
      if (error) throw error;
      const {data} = window.supa.storage.from(IMG_BUCKET).getPublicUrl(path);
      onUp('image', data.publicUrl);
    } catch (e) {
      setErr('Tải ảnh thất bại: ' + ((e && e.message) || 'lỗi không rõ'));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const pickBtn = {display:'flex', alignItems:'center', gap:5, padding:'6px 14px', borderRadius:999, border:`1.5px dashed ${C.lav2}`, background: C.lavL, color: C.lav, fontSize:12, fontWeight:800, cursor: busy ? 'default' : 'pointer', transition:'all .15s', opacity: busy ? .6 : 1};
  const iconImg = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.lav} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="9" r="1.6" fill={C.lav} stroke="none"/><path d="M21 15l-5-5-9 9"/></svg>;

  return (
    <Fld label="Ảnh minh họa (tùy chọn)" icon={iconImg}>
      <input ref={inputRef} type="file" accept="image/*" style={{display:'none'}} onChange={e => handleFile(e.target.files && e.target.files[0])}/>
      {q.image ? (
        <div style={{display:'flex', flexDirection:'column', gap:8}}>
          <div style={{borderRadius:18, overflow:'hidden', border:`1.5px solid ${C.border}`, background: C.bg, textAlign:'center', padding:6}}>
            {broken
              ? <div style={{padding:'18px 8px', fontSize:12, color: C.text4, fontWeight:700}}>Không hiển thị được ảnh — hãy tải lại ảnh khác</div>
              : <img src={q.image} alt="Ảnh minh họa" onError={() => setBroken(true)} style={{display:'block', maxWidth:'100%', maxHeight:220, margin:'0 auto', objectFit:'contain', borderRadius:10}}/>}
          </div>
          <div style={{display:'flex', gap:7, flexWrap:'wrap'}}>
            <button disabled={busy} onClick={() => inputRef.current && inputRef.current.click()} style={{...pickBtn, border:`1.5px solid ${C.lav2}`}}>
              {busy ? 'Đang tải lên…' : 'Đổi ảnh'}
            </button>
            <button disabled={busy} onClick={() => { setErr(''); onUp('image', ''); }}
              style={{display:'flex', alignItems:'center', gap:5, padding:'6px 14px', borderRadius:999, border:'1.5px solid #FECDD3', background: C.rosePale, color:'#EF4444', fontSize:12, fontWeight:800, cursor:'pointer'}}>
              Xoá ảnh
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => !busy && inputRef.current && inputRef.current.click()}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); if (!busy) handleFile(e.dataTransfer.files && e.dataTransfer.files[0]); }}
          style={{border:`1.5px dashed ${drag ? C.lav : C.lav2}`, background: drag ? '#EDE9FE' : C.lavL, borderRadius:18, padding:'14px 10px', textAlign:'center', cursor: busy ? 'default' : 'pointer', transition:'all .15s'}}>
          <div style={{fontSize:12, fontWeight:800, color: C.lav}}>{busy ? 'Đang tải ảnh lên…' : '+ Thêm ảnh minh họa'}</div>
          <div style={{fontSize:11, color: C.text4, marginTop:3, fontWeight:600}}>Bấm để chọn hoặc kéo thả ảnh vào đây · tự nén nhỏ trước khi tải lên</div>
        </div>
      )}
      {err && <div style={{marginTop:6, fontSize:12, color:'#EF4444', fontWeight:700}}>{err}</div>}
    </Fld>
  );
}

function QEditor({q, qi, onUp, onUpItem, onAddItem, onRemItem, onUpOpt, onAddOpt, onRemOpt, onRemove, canRemove, autoAI, onAIAnswer, dark}){
  const [open, setOpen] = useState(false);
  const [cardBlur, setCardBlur] = useState(() => {
    try { return localStorage.getItem('learnsy_card_blur') || 'off'; }
    catch { return 'off'; }
  });

  useEffect(() => {
    const handler = (e) => { if (e.detail?.value) setCardBlur(e.detail.value); };
    window.addEventListener('learnsy:card-blur', handler);
    return () => window.removeEventListener('learnsy:card-blur', handler);
  }, []);

  const blurStyle = cardBlur === 'off' ? {} : {
    backdropFilter: `blur(${cardBlur === '85' ? '22px' : '10px'})`,
    WebkitBackdropFilter: `blur(${cardBlur === '85' ? '22px' : '10px'})`,
    background: cardBlur === '85'
      ? (dark ? 'rgba(30,13,21,0.55)' : 'rgba(255,255,255,0.5)')
      : (dark ? 'rgba(30,13,21,0.75)' : 'rgba(255,255,255,0.72)'),
  };

  const C = window.C;
  const {LETTERS, stripHTML} = window;
  const {Inp, RichInp, MiniRichInp, Fld} = window;
  const info = window.getTypes()[q.type] || window.getTypes().true_false;
  const accentColor = info.color;

  return (
    <div className="fade-up" style={{background: C.surface, ...blurStyle, border:`1.5px solid ${C.border}`, borderRadius: 22, overflow:'hidden', boxShadow:'0 3px 16px rgba(255,100,150,0.06)', borderTop:`3px solid ${accentColor}`, marginBottom:14}}>
      {/* Header row */}
      <div onClick={() => setOpen(p => !p)}
        style={{display:'flex', alignItems:'center', gap:9, padding:'11px 13px', cursor:'pointer', background: open ? C.surface : C.bg, transition:'background .16s'}}>
        <div style={{width:26, height:26, borderRadius:9, flexShrink:0, background:'linear-gradient(135deg,#F472B6,#A855F7)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:900, color:'#fff', boxShadow:'0 2px 8px rgba(168,85,247,0.25)'}}>
          {qi + 1}
        </div>
        {/* Loại câu hỏi — gộp icon + nhãn vào 1 pill duy nhất thay vì 2 khối rời */}
        <div style={{display:'flex', alignItems:'center', gap:4, flexShrink:0, padding:'3px 8px 3px 4px', borderRadius:999, background: info.bg, border:`1px solid ${info.border}`}}>
          <span style={{width:15, height:15, display:'flex', alignItems:'center', justifyContent:'center', color: info.color}}>{info.icon}</span>
          <span style={{fontSize:10, fontWeight:900, color: info.color}}>{info.short}</span>
        </div>
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontSize:12, fontWeight:700, color: C.text2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
            {q.type === 'true_false' ? (stripHTML(q.passage).slice(0, 52) || '(Chưa nhập đoạn tư liệu...') : (stripHTML(q.question || '').slice(0, 52) || '(Chưa nhập câu hỏi...)')}
          </div>
        </div>
        {q.image && <span title="Có ảnh minh họa" style={{display:'flex', alignItems:'center', color: C.lav, flexShrink:0}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="9" r="1.6" fill="currentColor" stroke="none"/><path d="M21 15l-5-5-9 9"/></svg></span>}
        <div style={{display:'flex', alignItems:'center', gap:5, flexShrink:0}}>
          {autoAI && (
            <button onClick={e => { e.stopPropagation(); onAIAnswer?.(); }}
              title="AI tự điền đáp án đúng"
              style={{height:26, padding:'0 9px', borderRadius:999, border:'none',
                background:'linear-gradient(135deg,#6EE7B7,#10B981)', color:'#fff',
                fontSize:11, fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', gap:3, flexShrink:0,
                boxShadow:'0 2px 8px rgba(16,185,129,0.3)', transition:'all .15s'}}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 4px 12px rgba(16,185,129,0.42)';}}
              onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 2px 8px rgba(16,185,129,0.3)';}}
              onMouseDown={e=>e.currentTarget.style.transform='scale(0.94)'}
              onMouseUp={e=>e.currentTarget.style.transform='translateY(-1px)'}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/></svg>
              AI
            </button>
          )}
          {canRemove && (
            <button onClick={e => { e.stopPropagation(); onRemove(); }}
              title="Xoá câu hỏi"
              style={{width:26, height:26, borderRadius:999, border:`1.5px solid #FECDD3`, background: C.rosePale, color:'#EF4444', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all .15s'}}
              onMouseEnter={e=>{e.currentTarget.style.background='#FEE2E2';e.currentTarget.style.transform='scale(1.08)';}}
              onMouseLeave={e=>{e.currentTarget.style.background=C.rosePale;e.currentTarget.style.transform='scale(1)';}}
              onMouseDown={e=>e.currentTarget.style.transform='scale(0.9)'}
              onMouseUp={e=>e.currentTarget.style.transform='scale(1.08)'}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
          <div style={{width:22, height:22, borderRadius:999, background: open ? C.lavL : 'transparent', color: open ? C.lav : C.text4, display:'flex', alignItems:'center', justifyContent:'center', transition:'all .2s', flexShrink:0}}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{transition:'transform .2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)'}}><path d="M5 7l5 5 5-5"/></svg>
          </div>
        </div>
      </div>

      {/* Body */}
      {open && (
        <div style={{padding:'11px 13px 14px', borderTop:`1px solid ${C.border}`}}>
          {q.type === 'true_false' && (<>
            <Fld label="Đoạn tư liệu" icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.lav} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>}>
              <RichInp value={q.passage} onChange={e => onUp('passage', e.target.value)} placeholder="Nhập đoạn trích tư liệu lịch sử..."/>
            </Fld>
            <Fld label="Nguồn (tùy chọn)" icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.lav2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>}>
              <Inp value={q.source || ''} onChange={e => onUp('source', e.target.value)} placeholder="(NXB, năm, trang...)"/>
            </Fld>
            <QImageField q={q} onUp={onUp} C={C}/>
            <Fld label="Các ý — bấm ✓ ✗ để đặt đáp án" icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.rose} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>}>
              <div style={{display:'flex', flexDirection:'column', gap:7}}>
                {(q.items || []).map((it, ii) => (
                  <div key={ii} style={{display:'flex', gap:6, alignItems:'flex-start'}}>
                    <span style={{width:22, height:22, borderRadius:7, flexShrink:0, marginTop:9, background: C.lavL, color: C.lav, fontSize:11, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', border:`1px solid ${C.border2}`}}>
                      {String.fromCharCode(97 + ii)}
                    </span>
                    <MiniRichInp value={it.text} onChange={e => onUpItem(ii, 'text', e.target.value)} placeholder={`Ý ${String.fromCharCode(97 + ii)}...`}/>
                    <div style={{display:'flex', gap:4, flexShrink:0, marginTop:4}}>
                      <button onClick={() => onUpItem(ii, 'answer', true)} title="Đúng" style={{width:34, height:34, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', transition:'all .15s', background: it.answer ? '#10B981' : C.mintL, color: it.answer ? '#fff' : C.mint, border:`1.5px solid ${it.answer ? 'transparent' : '#BBF7D0'}`, boxShadow: it.answer ? '0 2px 8px rgba(16,185,129,0.3)' : 'none'}}
                        onMouseEnter={e=>{if(!it.answer)e.currentTarget.style.background='#D1FAE5';e.currentTarget.style.transform='translateY(-1px)';}}
                        onMouseLeave={e=>{if(!it.answer)e.currentTarget.style.background=C.mintL;e.currentTarget.style.transform='translateY(0)';}}
                        onMouseDown={e=>e.currentTarget.style.transform='scale(0.9)'}
                        onMouseUp={e=>e.currentTarget.style.transform='translateY(-1px)'}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </button>
                      <button onClick={() => onUpItem(ii, 'answer', false)} title="Sai" style={{width:34, height:34, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', transition:'all .15s', background: !it.answer ? '#EF4444' : C.rosePale, color: !it.answer ? '#fff' : '#EF4444', border:`1.5px solid ${!it.answer ? 'transparent' : '#FECDD3'}`, boxShadow: !it.answer ? '0 2px 8px rgba(239,68,68,0.3)' : 'none'}}
                        onMouseEnter={e=>{if(it.answer)e.currentTarget.style.background='#FEE2E2';e.currentTarget.style.transform='translateY(-1px)';}}
                        onMouseLeave={e=>{if(it.answer)e.currentTarget.style.background=C.rosePale;e.currentTarget.style.transform='translateY(0)';}}
                        onMouseDown={e=>e.currentTarget.style.transform='scale(0.9)'}
                        onMouseUp={e=>e.currentTarget.style.transform='translateY(-1px)'}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                      {(q.items || []).length > 2 && <button onClick={() => onRemItem(ii)} title="Xoá ý" style={{width:30, height:34, borderRadius:9, border:`1.5px solid ${C.border}`, background: C.bg, color: C.text4, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .15s'}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor='#FECDD3';e.currentTarget.style.color='#EF4444';e.currentTarget.style.background=C.rosePale;}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.text4;e.currentTarget.style.background=C.bg;}}
                        onMouseDown={e=>e.currentTarget.style.transform='scale(0.9)'}
                        onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      </button>}
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={onAddItem} style={{marginTop:8, display:'flex', alignItems:'center', gap:5, padding:'6px 14px', borderRadius:999, border:`1.5px dashed ${C.lav2}`, background: C.lavL, color: C.lav, fontSize:12, fontWeight:800, cursor:'pointer', transition:'all .15s'}}
                onMouseEnter={e=>{e.currentTarget.style.background='#EDE9FE';e.currentTarget.style.transform='translateY(-1px)';}}
                onMouseLeave={e=>{e.currentTarget.style.background=C.lavL;e.currentTarget.style.transform='translateY(0)';}}
                onMouseDown={e=>e.currentTarget.style.transform='scale(0.96)'}
                onMouseUp={e=>e.currentTarget.style.transform='translateY(-1px)'}>
                <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path d="M11 9h4v2h-4v4H9v-4H5V9h4V5h2v4z"/></svg>
                Thêm ý
              </button>
            </Fld>
          </>)}

          {(q.type === 'multiple' || q.type === 'multi_select') && (<>
            <Fld label="Câu hỏi" icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.rose} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}>
              <RichInp value={q.question || ''} onChange={e => onUp('question', e.target.value)} placeholder="Nhập nội dung câu hỏi..."/>
            </Fld>
            <QImageField q={q} onUp={onUp} C={C}/>
            <Fld label={q.type === 'multiple' ? 'Lựa chọn — bấm chữ cái để chọn đáp án đúng' : 'Lựa chọn — bấm để chọn nhiều đáp án đúng'}
              icon={q.type === 'multiple'
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.rose} strokeWidth="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5" fill={C.rose} stroke="none"/></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.rose} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><polyline points="8 12 11 15 16 9"/></svg>}>
              <div style={{display:'flex', flexDirection:'column', gap:7}}>
                {(q.options || []).map((opt, i) => {
                  const isCor = q.type === 'multiple' ? q.correct === i : (q.correct || []).includes(i);
                  const togCor = () => {
                    if (q.type === 'multiple') {
                      onUp('correct', i);
                    } else {
                      const c = q.correct || [];
                      onUp('correct', c.includes(i) ? c.filter(x => x !== i) : [...c, i]);
                    }
                  };
                  return (
                    <div key={i} style={{display:'flex', gap:7, alignItems:'center'}}>
                      <button onClick={togCor} style={{width:30, height:30, borderRadius: q.type === 'multiple' ? '50%' : 9, flexShrink:0, border:'none', cursor:'pointer', fontSize:12, fontWeight:900, transition:'all .15s', background: isCor ? '#10B981' : C.lavL, color: isCor ? '#fff' : C.lav, boxShadow: isCor ? '0 2px 8px rgba(16,185,129,0.3)' : 'none'}}
                        onMouseEnter={e=>{if(!isCor)e.currentTarget.style.background='#E9D5FF';e.currentTarget.style.transform='translateY(-1px)';}}
                        onMouseLeave={e=>{if(!isCor)e.currentTarget.style.background=C.lavL;e.currentTarget.style.transform='translateY(0)';}}
                        onMouseDown={e=>e.currentTarget.style.transform='scale(0.88)'}
                        onMouseUp={e=>e.currentTarget.style.transform='translateY(-1px)'}>
                        {LETTERS[i]}
                      </button>
                      <MiniRichInp value={opt} onChange={e => onUpOpt(i, e.target.value)} placeholder={`Lựa chọn ${LETTERS[i]}...`}/>
                      {(q.options || []).length > 2 && <button onClick={() => onRemOpt(i)} title="Xoá lựa chọn" style={{width:26, height:26, borderRadius:8, border:`1.5px solid ${C.border}`, background: C.bg, color: C.text4, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all .15s'}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor='#FECDD3';e.currentTarget.style.color='#EF4444';e.currentTarget.style.background=C.rosePale;}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.text4;e.currentTarget.style.background=C.bg;}}
                        onMouseDown={e=>e.currentTarget.style.transform='scale(0.9)'}
                        onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>}
                    </div>
                  );
                })}
              </div>
              {(q.options || []).length < 6 && <button onClick={onAddOpt} style={{marginTop:8, display:'flex', alignItems:'center', gap:5, padding:'6px 14px', borderRadius:999, border:`1.5px dashed ${C.lav2}`, background: C.lavL, color: C.lav, fontSize:12, fontWeight:800, cursor:'pointer', transition:'all .15s'}}
                onMouseEnter={e=>{e.currentTarget.style.background='#EDE9FE';e.currentTarget.style.transform='translateY(-1px)';}}
                onMouseLeave={e=>{e.currentTarget.style.background=C.lavL;e.currentTarget.style.transform='translateY(0)';}}
                onMouseDown={e=>e.currentTarget.style.transform='scale(0.96)'}
                onMouseUp={e=>e.currentTarget.style.transform='translateY(-1px)'}>
                <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path d="M11 9h4v2h-4v4H9v-4H5V9h4V5h2v4z"/></svg>
                Thêm lựa chọn
              </button>}
            </Fld>
          </>)}

          {q.type === 'fill_blank' && (<>
            <Fld label="Câu hỏi (dùng ___ cho chỗ trống)" icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.peach} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}>
              <RichInp value={q.question || ''} onChange={e => onUp('question', e.target.value)} placeholder='Ví dụ: Ngô Quyền đánh tan quân ___ năm 938.'/>
            </Fld>
            <QImageField q={q} onUp={onUp} C={C}/>
            <Fld label="Đáp án đúng" icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.mint} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}>
              <Inp value={q.answer || ''} onChange={e => onUp('answer', e.target.value)} placeholder="Nhập đáp án chính xác..."/>
            </Fld>
            <Fld label="Gợi ý (tùy chọn)" icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>}>
              <Inp value={q.hint || ''} onChange={e => onUp('hint', e.target.value)} placeholder="Gợi ý dành cho học sinh..."/>
            </Fld>
          </>)}
          <QVerify q={q} C={C}/>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   QVerify — nút "Kiểm đáp án bằng AI + web" (chỉ admin)
   Gọi POST /api/verify (x-admin-secret). AI chỉ CẢNH BÁO, không tự sửa đáp án.
   ══════════════════════════════════════════════════════════════════ */
function QVerify({q, C}){
  const [st, setSt] = useState({busy:false, res:null, err:'', sig:''});
  const abortRef = useRef(null);

  // Chữ ký nội dung+đáp án: đổi câu hỏi/đáp án → kết quả cũ hết hiệu lực
  const sig = JSON.stringify([q.type, q.question, q.passage, q.options, q.correct, q.items, q.answer]);
  const stale = !!st.res && st.sig !== sig;

  const hasAnswer = q.type === 'multiple' ? Number.isInteger(q.correct)
    : q.type === 'multi_select' ? (q.correct || []).length > 0
    : q.type === 'true_false' ? (q.items || []).length > 0
    : q.type === 'fill_blank' ? !!String(q.answer || '').replace(/<[^>]*>/g,'').trim()
    : false;
  const hasStem = q.type === 'true_false'
    ? !!String(q.passage || '').replace(/<[^>]*>/g,'').trim() || (q.items || []).some(i => String(i.text || '').replace(/<[^>]*>/g,'').trim())
    : !!String(q.question || '').replace(/<[^>]*>/g,'').trim();
  const ready = hasAnswer && hasStem;

  async function run(force){
    if(st.busy || !ready) return;
    if(abortRef.current) abortRef.current.abort();
    const ac = new AbortController(); abortRef.current = ac;
    setSt(p => ({...p, busy:true, err:''}));
    try{
      const r = await fetch('/api/verify', {
        method:'POST', signal: ac.signal,
        headers:{'Content-Type':'application/json','x-admin-secret': window.ADMIN_API_KEY || ''},
        body: JSON.stringify({question:q, force: !!force}),
      });
      const d = await r.json().catch(() => ({}));
      if(!r.ok || d.error) throw new Error(d.error || ('Lỗi ' + r.status));
      setSt({busy:false, res:d, err:'', sig});
    }catch(e){
      if(e && e.name === 'AbortError') return;
      setSt(p => ({...p, busy:false, err: e.message || 'Không kiểm được'}));
    }
  }
  useEffect(() => () => { if(abortRef.current) abortRef.current.abort(); }, []);

  const V = {
    dung:       {c:'#059669', bg:'#D1FAE5', t:'Có vẻ đúng'},
    sai:        {c:'#DC2626', bg:'#FEE2E2', t:'Có thể sai — nên xem lại'},
    khong_chac: {c:'#B45309', bg:'#FEF3C7', t:'Chưa đủ căn cứ'},
  };
  const v = st.res ? (V[st.res.verdict] || V.khong_chac) : null;

  return (
    <div style={{marginTop:6, paddingTop:12, borderTop:`1px dashed ${C.border}`}}>
      <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
        <button onClick={() => run(false)} disabled={!ready || st.busy}
          title={ready ? 'AI tìm trên web rồi đối chiếu đáp án' : 'Cần có nội dung câu hỏi và đáp án trước'}
          style={{height:34, padding:'0 14px', borderRadius:999, border:'none',
            background: !ready ? C.border : 'linear-gradient(135deg,#6EE7B7,#10B981)', color: !ready ? C.text4 : '#fff',
            fontSize:12, fontWeight:800, cursor: !ready || st.busy ? 'default' : 'pointer',
            display:'flex', alignItems:'center', gap:6, opacity: st.busy ? .7 : 1,
            boxShadow: !ready ? 'none' : '0 2px 8px rgba(16,185,129,0.3)'}}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>
          {st.busy ? 'Đang tìm & kiểm…' : (st.res ? 'Kiểm lại' : 'Kiểm đáp án bằng AI')}
        </button>
        {!ready && <span style={{fontSize:11, color:C.text4, fontWeight:600}}>Nhập câu hỏi và chọn đáp án để kiểm</span>}
      </div>

      {st.err && (
        <div style={{marginTop:9, padding:'9px 11px', borderRadius:12, background:'#FEE2E2', color:'#B91C1C', fontSize:12, fontWeight:700, lineHeight:1.5}}>
          {st.err}
        </div>
      )}

      {st.res && v && (
        <div style={{marginTop:9, padding:'11px 12px', borderRadius:18, background:v.bg, color:'#1F1433', opacity: stale ? .55 : 1, border:`1.5px solid ${v.c}33`}}>
          <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:6}}>
            <span style={{fontSize:12.5, fontWeight:900, color:v.c}}>{v.t}</span>
            <span style={{fontSize:11, fontWeight:700, color:v.c, opacity:.85}}>độ tin cậy {Math.round((st.res.confidence||0)*100)}%</span>
            {st.res.cached && <span style={{fontSize:10.5, fontWeight:700, color:'#6B5A8E'}}>· từ bộ nhớ đệm</span>}
            {!st.res.usedSearch && <span style={{fontSize:10.5, fontWeight:800, color:'#B45309'}}>· KHÔNG có dữ liệu web</span>}
          </div>
          {stale && <div style={{fontSize:11, fontWeight:800, color:'#B45309', marginBottom:5}}>Bạn đã sửa câu này sau lần kiểm — bấm "Kiểm lại".</div>}
          {st.res.reason && <div style={{fontSize:12.5, lineHeight:1.6, fontWeight:600}}>{st.res.reason}</div>}
          {st.res.verdict === 'sai' && st.res.suggestion && (
            <div style={{marginTop:6, fontSize:12.5, fontWeight:800}}>AI đề xuất: <span style={{fontWeight:600}}>{st.res.suggestion}</span></div>
          )}
          {(st.res.sources || []).length > 0 && (
            <div style={{marginTop:8, display:'flex', flexDirection:'column', gap:3}}>
              {st.res.sources.map((s, i) => (
                <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                  style={{fontSize:11.5, color:'#4C1D95', fontWeight:700, textDecoration:'underline', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                  {s.title || s.url}
                </a>
              ))}
            </div>
          )}
          <div style={{marginTop:8, fontSize:10.5, fontWeight:700, color:'#6B5A8E'}}>AI có thể sai — luôn đối chiếu nguồn trước khi sửa đáp án.</div>
          {!st.res.cached ? null : (
            <button onClick={() => run(true)} disabled={st.busy}
              style={{marginTop:6, background:'none', border:'none', padding:0, fontSize:11, fontWeight:800, color:'#4C1D95', textDecoration:'underline', cursor:'pointer'}}>
              Bỏ qua bộ nhớ đệm, kiểm mới
            </button>
          )}
        </div>
      )}
    </div>
  );
}

window.QEditor = QEditor;
})();