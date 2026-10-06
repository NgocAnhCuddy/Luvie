import React from 'react';

// ── Nạp mammoth.js / SheetJS (xlsx) từ CDN khi cần, không qua npm ──
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
// PDF.js — render PDF ra canvas độ nét cao (khắc phục iframe PDF không mở được trên Chrome mobile)
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (window.__ls_pdfjsLib) return window.__ls_pdfjsLib;
  const p = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.js';
    s.async = true;
    s.onload = () => {
      if (!window.pdfjsLib) return reject(new Error('pdfjsLib không nạp được'));
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.js';
      resolve(window.pdfjsLib);
    };
    s.onerror = () => reject(new Error('Không tải được thư viện PDF.js'));
    document.head.appendChild(s);
  });
  window.__ls_pdfjsLib = p;
  return p;
}

/* ══ FILES-TAB.JSX — Tab "Tài liệu" cho học sinh ═══════════════════════
   Hiển thị danh sách file admin đã upload (bảng Supabase `learning_files`),
   cho phép xem trước (ảnh/pdf/video/audio/office) và tải về.

   SQL tạo bảng (chạy trong Supabase SQL Editor):
   ─────────────────────────────────────────────
   CREATE TABLE learning_files (
     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
     title text NOT NULL,
     description text DEFAULT '',
     filename text NOT NULL,     -- tên file gốc (để đoán icon/loại)
     path text NOT NULL,         -- public URL trong Supabase Storage
     storage_path text NOT NULL, -- path thật trong bucket (để xoá)
     size bigint DEFAULT 0,
     subject text DEFAULT '',
     sort_order integer DEFAULT 0,
     created_at timestamptz DEFAULT now()
   );
   ALTER TABLE learning_files ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "public_read" ON learning_files FOR SELECT TO anon, authenticated USING (true);
   CREATE POLICY "admin_write" ON learning_files FOR ALL TO authenticated USING (true) WITH CHECK (true);
   ─────────────────────────────────────────────
   Supabase Storage bucket: tên "learning_files", public=true
   Policy storage (SQL):
     CREATE POLICY "public_read_files" ON storage.objects FOR SELECT TO anon, authenticated
       USING (bucket_id='learning_files');
     CREATE POLICY "admin_write_files" ON storage.objects FOR ALL TO authenticated
       USING (bucket_id='learning_files') WITH CHECK (bucket_id='learning_files');
   ─────────────────────────────────────────────
   Props: dark, liteMode, flickerFx
   Load bằng: import './components/files-tab.jsx' TRƯỚC dashboard.jsx trong main.jsx
══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const { useState, useEffect, useCallback, useMemo } = React;

  const CL = { fg: '#2d1420', sub: '#a06080', card: 'rgba(255,255,255,0.82)', cardBorder: 'rgba(255,182,210,0.35)', accent: '#f472b6', accent2: '#a855f7', tagBg: 'rgba(244,114,182,0.12)', inputBg: 'rgba(255,255,255,0.9)' };
  const CD = { fg: '#fce4f0', sub: 'rgba(255,200,220,0.62)', card: 'rgba(255,255,255,0.07)', cardBorder: 'rgba(244,114,182,0.2)', accent: '#f472b6', accent2: '#c084fc', tagBg: 'rgba(244,114,182,0.14)', inputBg: 'rgba(255,255,255,0.08)' };

  const FILE_BUCKET = 'learning_files';

  const EXT_COLORS = {
    pdf: '#ef4444', doc: '#3b82f6', docx: '#3b82f6',
    xls: '#22c55e', xlsx: '#22c55e', ppt: '#f97316', pptx: '#f97316',
    zip: '#a855f7', rar: '#a855f7',
    mp4: '#06b6d4', mp3: '#06b6d4', jpg: '#f59e0b', jpeg: '#f59e0b', png: '#f59e0b', gif: '#f59e0b', webp: '#f59e0b',
  };

  function getExt(name) {
    return String(name || '').split('.').pop().toLowerCase();
  }

  function fmtBytes(n) {
    if (!n && n !== 0) return '';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function fmtDateVN(d) {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('vi-VN'); } catch (e) { return ''; }
  }

  /* ── Icon file theo phần mở rộng ── */
  function FileTypeIcon({ ext, size = 22 }) {
    const col = EXT_COLORS[ext] || '#9ca3af';
    const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: col, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
    const isImg = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
    if (isImg) {
      return (<svg {...common} fill={col} stroke="none"><rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke={col} strokeWidth="1.8" /><circle cx="8.5" cy="9" r="1.6" /><path d="M21 15l-5-5-9 9" fill="none" stroke={col} strokeWidth="1.8" /></svg>);
    }
    return (
      <svg {...common}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    );
  }

  /* ── Card danh sách file ── */
  function FileCard({ f, dark, onOpen, idx }) {
    const C = dark ? CD : CL;
    const ext = getExt(f.filename || f.title);
    const col = EXT_COLORS[ext] || C.accent;
    return (
      <div className="bb-card-tap" onClick={() => onOpen(f)}
        style={{
          background: C.card, borderRadius: 22, padding: '13px 14px', cursor: 'pointer',
          border: `1.5px solid ${C.cardBorder}`, display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: `0 3px 12px ${col}14`, animation: `bb-fadeUp .25s ease ${(idx % 10) * 25}ms both`,
        }}>
        <div style={{
          width: 44, height: 44, borderRadius: 18, flexShrink: 0,
          background: `${col}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <FileTypeIcon ext={ext} size={22} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 800, fontSize: 13.5, color: C.fg, fontFamily: "'Baloo 2',cursive",
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{f.title}</div>
          <div style={{ fontSize: 11.5, color: C.sub, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {f.description || 'Tài liệu học tập'}
          </div>
          <div style={{ fontSize: 10, color: C.sub, opacity: 0.75, marginTop: 3, display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ textTransform: 'uppercase', fontWeight: 800, color: col }}>{ext}</span>
            {f.size ? <span>· {fmtBytes(f.size)}</span> : null}
            {f.created_at ? <span>· {fmtDateVN(f.created_at)}</span> : null}
          </div>
        </div>
        <span style={{ display: 'flex', flexShrink: 0, color: C.sub, opacity: 0.6 }}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        </span>
      </div>
    );
  }

  /* ── Trạng thái loading / lỗi dùng chung cho các khung preview ── */
  function PreviewStatus({ kind, label }) {
    if (kind === 'loading') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '40px 20px', width: '100%' }}>
          <span style={{
            width: 34, height: 34, borderRadius: '50%',
            border: '3px solid rgba(244,114,182,0.18)', borderTopColor: '#f472b6',
            display: 'inline-block', animation: 'bb-spin .8s linear infinite',
          }} />
          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#a06080' }}>{label || 'Đang tải nội dung...'}</span>
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '40px 20px', width: '100%' }}>
        <span style={{
          width: 46, height: 46, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(239,68,68,0.1)', color: '#ef4444',
        }}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="13" /><line x1="12" y1="16.5" x2="12.01" y2="16.5" /></svg>
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#6b5a68', textAlign: 'center', wordBreak: 'break-word', maxWidth: 280 }}>{label}</span>
      </div>
    );
  }

  /* ── Xem Word (.doc/.docx) tại chỗ bằng mammoth, không cần URL public ── */
  function DocxPreview({ url }) {
    const [html, setHtml] = useState(null);
    const [err, setErr] = useState(false);
    useEffect(() => {
      let cancelled = false;
      setHtml(null); setErr(false);
      Promise.all([loadMammoth(), fetch(url).then(r => r.arrayBuffer())])
        .then(([mammoth, buf]) => mammoth.convertToHtml({ arrayBuffer: buf }))
        .then(res => { if (!cancelled) setHtml(res.value); })
        .catch(() => { if (!cancelled) setErr(true); });
      return () => { cancelled = true; };
    }, [url]);

    if (err) return <PreviewStatus kind="error" label="Không đọc được nội dung file Word." />;
    if (html === null) return <PreviewStatus kind="loading" label="Đang đọc file Word..." />;
    return (
      <div className="bb-docx-preview" style={{
        width: '100%', maxHeight: '56vh', overflowY: 'auto', textAlign: 'left',
        background: '#fff', borderRadius: 20, padding: '22px 26px', color: '#2d1420',
        fontSize: 14, lineHeight: 1.7, boxShadow: '0 4px 20px rgba(168,85,247,0.1)',
        border: '1px solid rgba(244,114,182,0.15)',
      }} dangerouslySetInnerHTML={{ __html: html }} />
    );
  }

  /* ── Xem Excel (.xls/.xlsx) tại chỗ bằng SheetJS, không cần URL public ── */
  function XlsxPreview({ url }) {
    const [sheets, setSheets] = useState(null);
    const [active, setActive] = useState(0);
    const [err, setErr] = useState(false);
    useEffect(() => {
      let cancelled = false;
      setSheets(null); setErr(false); setActive(0);
      Promise.all([loadXLSX(), fetch(url).then(r => r.arrayBuffer())])
        .then(([XLSX, buf]) => {
          const wb = XLSX.read(buf, { type: 'array' });
          const parsed = wb.SheetNames.map(name => ({
            name,
            html: XLSX.utils.sheet_to_html(wb.Sheets[name], { editable: false })
          }));
          if (!cancelled) setSheets(parsed);
        })
        .catch(() => { if (!cancelled) setErr(true); });
      return () => { cancelled = true; };
    }, [url]);

    if (err) return <PreviewStatus kind="error" label="Không đọc được nội dung file Excel." />;
    if (sheets === null) return <PreviewStatus kind="loading" label="Đang đọc file Excel..." />;
    return (
      <div style={{ width: '100%' }}>
        {sheets.length > 1 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {sheets.map((s, i) => (
              <button key={s.name} onClick={() => setActive(i)}
                style={{
                  padding: '6px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 800, fontFamily: "'Nunito',sans-serif",
                  transition: 'all .18s cubic-bezier(.22,1,.36,1)',
                  background: i === active ? 'linear-gradient(135deg,#f472b6,#a855f7)' : 'rgba(244,114,182,0.1)',
                  color: i === active ? '#fff' : '#a06080',
                  boxShadow: i === active ? '0 3px 10px rgba(168,85,247,0.3)' : 'none',
                }}>
                {s.name}
              </button>
            ))}
          </div>
        )}
        <div className="bb-xlsx-preview" style={{
          width: '100%', maxHeight: '50vh', overflow: 'auto', background: '#fff',
          borderRadius: 20, padding: 14, boxShadow: '0 4px 20px rgba(168,85,247,0.1)',
          border: '1px solid rgba(244,114,182,0.15)',
        }} dangerouslySetInnerHTML={{ __html: sheets[active].html }} />
      </div>
    );
  }

  /* ── Khung pinch-zoom / kéo dùng chung (ảnh, PDF) — zoom không nhòe vì
        el bên trong luôn giữ độ phân giải gốc, chỉ scale bằng transform ── */
  function ZoomWrap({ children, maxHeight = '62vh' }) {
    const wrapRef = useState(() => ({ current: null }))[0];
    const [scale, setScale] = useState(1);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const stateRef = useState(() => ({
      pinchDist: 0, pinchScale: 1, dragging: false, lastX: 0, lastY: 0,
      pointers: new Map(),
    }))[0];

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    function dist(pts) {
      const [a, b] = pts;
      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    function onPointerDown(e) {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      stateRef.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (stateRef.pointers.size === 2) {
        stateRef.pinchDist = dist([...stateRef.pointers.values()]);
        stateRef.pinchScale = scale;
      } else if (stateRef.pointers.size === 1) {
        stateRef.dragging = true;
        stateRef.lastX = e.clientX; stateRef.lastY = e.clientY;
      }
    }
    function onPointerMove(e) {
      if (!stateRef.pointers.has(e.pointerId)) return;
      stateRef.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (stateRef.pointers.size === 2) {
        const d = dist([...stateRef.pointers.values()]);
        if (stateRef.pinchDist > 0) {
          const next = clamp(stateRef.pinchScale * (d / stateRef.pinchDist), 1, 5);
          setScale(next);
        }
      } else if (stateRef.dragging && stateRef.pointers.size === 1) {
        const dx = e.clientX - stateRef.lastX;
        const dy = e.clientY - stateRef.lastY;
        stateRef.lastX = e.clientX; stateRef.lastY = e.clientY;
        setPos(p => ({ x: p.x + dx, y: p.y + dy }));
      }
    }
    function onPointerUp(e) {
      stateRef.pointers.delete(e.pointerId);
      if (stateRef.pointers.size < 2) stateRef.pinchDist = 0;
      if (stateRef.pointers.size === 0) stateRef.dragging = false;
    }
    function onWheel(e) {
      if (!e.ctrlKey && Math.abs(e.deltaY) < 2) return;
      e.preventDefault();
      setScale(s => clamp(s - e.deltaY * 0.0015, 1, 5));
    }
    function zoomBtn(delta) {
      setScale(s => {
        const next = clamp(s + delta, 1, 5);
        if (next === 1) setPos({ x: 0, y: 0 });
        return next;
      });
    }
    function reset() { setScale(1); setPos({ x: 0, y: 0 }); }

    return (
      <div style={{ width: '100%', position: 'relative' }}>
        <div
          onPointerDown={onPointerDown} onPointerMove={onPointerMove}
          onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel}
          style={{
            width: '100%', maxHeight, overflow: 'hidden', borderRadius: 20,
            touchAction: 'none', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            background: '#f4eef7', cursor: scale > 1 ? 'grab' : 'default',
          }}>
          <div style={{
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
            transformOrigin: 'center top', transition: stateRef.dragging || stateRef.pinchDist ? 'none' : 'transform .12s ease-out',
            willChange: 'transform',
          }}>
            {children}
          </div>
        </div>
        <div style={{
          position: 'absolute', right: 8, bottom: 8, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 2,
        }}>
          {[{ l: '+', fn: () => zoomBtn(0.4) }, { l: '−', fn: () => zoomBtn(-0.4) }, { l: '⟳', fn: reset }].map((b, i) => (
            <button key={i} onClick={b.fn} style={{
              width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: 'rgba(45,20,32,0.72)', color: '#fff', fontSize: b.l === '⟳' ? 14 : 17,
              fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
            }}>{b.l}</button>
          ))}
        </div>
      </div>
    );
  }

  /* ── Xem ảnh, có trạng thái tải/lỗi để không bị "biến mất" khi ảnh load fail.
        Ảnh giữ nguyên độ phân giải gốc (không resize xuống), ZoomWrap chỉ scale
        bằng CSS transform nên phóng to không bị nhòe ── */
  function ImagePreview({ url }) {
    const [status, setStatus] = useState('loading'); // loading | ok | error
    useEffect(() => { setStatus('loading'); }, [url]);
    return (
      <div style={{ width: '100%', minHeight: 200 }}>
        {status === 'loading' && <PreviewStatus kind="loading" label="Đang tải ảnh..." />}
        {status === 'error' && <PreviewStatus kind="error" label="Không tải được ảnh." />}
        <div style={{ display: status === 'ok' ? 'block' : 'none' }}>
          <ZoomWrap>
            <img src={url} onLoad={() => setStatus('ok')} onError={() => setStatus('error')}
              draggable={false}
              style={{
                maxWidth: '90vw', maxHeight: '58vh', borderRadius: 20, display: 'block',
                boxShadow: '0 8px 28px rgba(168,85,247,0.18)', border: '1px solid rgba(244,114,182,0.15)',
                imageRendering: 'auto',
              }} />
          </ZoomWrap>
        </div>
      </div>
    );
  }

  /* ── Xem PDF tại chỗ bằng PDF.js, render mỗi trang ra canvas ở devicePixelRatio
        thật của máy để zoom không nhòe (không dùng iframe vì Chrome mobile hay
        không mở được PDF nhúng, mà nhảy ra màn hình "Tải về / Mở") ── */
  function PdfPreview({ url }) {
    const [pages, setPages] = useState(null); // mảng canvas dataURL hoặc lỗi
    const [errDetail, setErrDetail] = useState(null);
    const [numPages, setNumPages] = useState(0);
    const [rendered, setRendered] = useState(0);

    useEffect(() => {
      let cancelled = false;
      setPages(null); setErrDetail(null); setRendered(0); setNumPages(0);
      const RENDER_SCALE = Math.min((window.devicePixelRatio || 1) * 1.8, 4); // độ nét cao, giới hạn để không quá nặng

      Promise.all([
        loadPdfJs(),
        fetch(url, { credentials: 'omit' }).then(r => {
          if (!r.ok) throw new Error('HTTP ' + r.status + ' khi tải file');
          return r.arrayBuffer();
        }),
      ])
        .then(([pdfjsLib, buf]) => pdfjsLib.getDocument({ data: buf }).promise)
        .then(async pdf => {
          if (cancelled) return;
          setNumPages(pdf.numPages);
          const canvases = [];
          for (let i = 1; i <= pdf.numPages; i++) {
            if (cancelled) return;
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: RENDER_SCALE });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;
            canvases.push(canvas.toDataURL('image/png'));
            if (!cancelled) setRendered(i);
          }
          if (!cancelled) setPages(canvases);
        })
        .catch((e) => {
          console.error('[PdfPreview]', e);
          if (!cancelled) setErrDetail((e && e.message) || 'Lỗi không xác định');
        });

      return () => { cancelled = true; };
    }, [url]);

    if (errDetail) return <PreviewStatus kind="error" label={`Không đọc được nội dung file PDF. (${errDetail})`} />;
    if (pages === null) {
      return <PreviewStatus kind="loading" label={numPages ? `Đang hiển thị trang ${rendered}/${numPages}...` : 'Đang tải PDF...'} />;
    }
    return (
      <ZoomWrap maxHeight="62vh">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          {pages.map((src, i) => (
            <img key={i} src={src} draggable={false}
              loading="lazy" decoding="async"
              style={{
                maxWidth: '90vw', width: 'auto', height: 'auto', display: 'block',
                borderRadius: 8, boxShadow: '0 4px 16px rgba(168,85,247,0.15)',
                border: '1px solid rgba(244,114,182,0.15)', background: '#fff',
              }} />
          ))}
        </div>
      </ZoomWrap>
    );
  }

  /* ── Overlay xem trước file ── */
  function FilePreviewOverlay({ f, onClose }) {
    if (!f) return null;
    const ext = getExt(f.filename || f.title);
    const url = f.path;
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
    const isPdf = ext === 'pdf';
    const isVideo = ['mp4', 'webm', 'ogg', 'mov'].includes(ext);
    const isAudio = ['mp3', 'wav', 'm4a'].includes(ext);
    const isWord = ['doc', 'docx'].includes(ext);
    const isExcel = ['xls', 'xlsx'].includes(ext);

    useEffect(() => {
      const onKey = (e) => { if (e.key === 'Escape') onClose(); };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    let preview;
    if (isImage) {
      preview = <ImagePreview url={url} />;
    } else if (isPdf) {
      preview = <PdfPreview url={url} />;
    } else if (isVideo) {
      preview = <video controls style={{ maxWidth: '100%', maxHeight: '52vh', borderRadius: 12 }} src={url} />;
    } else if (isAudio) {
      preview = <div style={{ padding: '32px 0', width: '100%' }}><audio controls style={{ width: '100%' }} src={url} /></div>;
    } else if (isWord) {
      preview = <DocxPreview url={url} />;
    } else if (isExcel) {
      preview = <XlsxPreview url={url} />;
    } else {
      preview = (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '44px 20px', width: '100%' }}>
          <span style={{
            width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(244,114,182,0.1)',
          }}>
            <FileTypeIcon ext={ext} size={30} />
          </span>
          <div style={{ fontSize: 14.5, color: '#6b5a68', fontWeight: 800, fontFamily: "'Baloo 2',cursive" }}>Không thể xem trước loại file này</div>
          <div style={{ fontSize: 12.5, color: '#9c8695' }}>Tải về để mở nhé!</div>
        </div>
      );
    }

    return (
      <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        style={{
          position: 'fixed', inset: 0, zIndex: 9995, background: 'rgba(40,20,60,0.5)',
          backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '76px 12px 84px', boxSizing: 'border-box',
        }}>
        <div style={{
          background: 'rgba(255,248,252,0.98)', border: '1.5px solid rgba(255,160,200,0.25)',
          borderRadius: 28, width: '100%', maxWidth: 680, maxHeight: '100%',
          boxShadow: '0 24px 64px rgba(180,100,160,0.25)',
          overflowY: 'auto', animation: 'bb-fadeUp .3s ease',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            padding: '16px 18px 13px', background: 'linear-gradient(135deg,rgba(255,200,225,0.35),rgba(210,190,255,0.25))',
            borderBottom: '1.5px solid rgba(255,160,200,0.15)', display: 'flex', alignItems: 'center', gap: 12,
            position: 'sticky', top: 0, zIndex: 1, borderRadius: '24px 24px 0 0',
          }}>
            <FileTypeIcon ext={ext} size={30} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 900, color: '#2d1420', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.title}</div>
              <div style={{ fontSize: 11.5, color: '#a06080', fontWeight: 700, marginTop: 2, textTransform: 'uppercase' }}>{ext} · Tài liệu học tập</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <a href={url} download={f.title} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 16px',
                background: 'linear-gradient(135deg,#f472b6,#a855f7)', color: '#fff', borderRadius: 999,
                fontSize: 12.5, fontWeight: 800, textDecoration: 'none', boxShadow: '0 3px 12px rgba(155,114,239,0.25)',
                transition: 'all .2s cubic-bezier(.22,1,.36,1)',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 5px 16px rgba(155,114,239,0.38)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 3px 12px rgba(155,114,239,0.25)'; }}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /></svg>
                Tải về
              </a>
              <button onClick={onClose} style={{
                width: 34, height: 34, border: 'none', background: 'rgba(255,112,150,0.12)',
                color: '#f43f7e', borderRadius: '50%', fontSize: 16, cursor: 'pointer', fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                transition: 'all .18s cubic-bezier(.22,1,.36,1)',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,112,150,0.22)'; e.currentTarget.style.transform = 'scale(1.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,112,150,0.12)'; e.currentTarget.style.transform = 'scale(1)'; }}>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
          </div>
          <div style={{ padding: '18px 16px', background: 'linear-gradient(180deg,rgba(248,244,255,0.5),rgba(255,240,248,0.5))', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', minHeight: 140, flex: 1 }}>
            {preview}
          </div>
          <div style={{
            padding: '11px 18px', borderTop: '1.5px solid rgba(255,160,200,0.12)', display: 'flex', justifyContent: 'center',
            position: 'sticky', bottom: 0, background: 'rgba(255,248,252,0.98)', borderRadius: '0 0 24px 24px',
          }}>
            <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, fontWeight: 700, color: '#a855f7', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
              Mở trong tab mới
            </a>
          </div>
        </div>
      </div>
    );
  }

  /* ══ TAB FILES ══ */
  function TabFiles({ dark, liteMode, flickerFx }) {
    const C = dark ? CD : CL;
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errMsg, setErrMsg] = useState('');
    const [search, setSearch] = useState('');
    const [openFile, setOpenFile] = useState(null);

    const fetchFiles = useCallback(async () => {
      setLoading(true);
      setErrMsg('');
      try {
        await window.__configReady;
        if (!window.supa) throw new Error('Chưa kết nối được cơ sở dữ liệu');
        const { data, error } = await window.supa
          .from('learning_files')
          .select('*')
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: false });
        if (error) throw error;
        setFiles(data || []);
      } catch (e) {
        console.error('[files-tab] load error:', e);
        setErrMsg('Không tải được danh sách tài liệu. Thử lại nhé!');
      } finally {
        setLoading(false);
      }
    }, []);

    useEffect(() => { fetchFiles(); }, [fetchFiles]);

    const filtered = useMemo(() => {
      const q = search.trim().toLowerCase();
      if (!q) return files;
      return files.filter(f =>
        (f.title || '').toLowerCase().includes(q) ||
        (f.description || '').toLowerCase().includes(q) ||
        (f.subject || '').toLowerCase().includes(q)
      );
    }, [files, search]);

    function handleOpen(f) {
      setOpenFile(f);
      // FIX 🟡 Đã bỏ POST /api/track-file-view: endpoint này KHÔNG tồn tại trong functions/api
      // (luôn 404) nên mỗi lần mở tài liệu chỉ tốn thêm 1 request thừa + dòng đỏ trong Console.
    }

    return (
      <div style={{ padding: '14px 14px 100px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{ display: 'inline-flex', color: C.accent }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
          </span>
          <span className="bb-section-title" style={{ color: C.fg, fontWeight: 900, fontFamily: "'Baloo 2',cursive", fontSize: 16 }}>
            Tài liệu {files.length > 0 ? `(${files.length})` : ''}
          </span>
        </div>

        {files.length > 3 && (
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', color: dark ? 'rgba(244,114,182,0.45)' : 'rgba(200,100,140,0.45)' }}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            </span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Tìm tài liệu..." className="bb-input"
              style={{
                width: '100%', padding: '10px 14px 10px 36px', borderRadius: 18,
                border: `1.5px solid ${dark ? 'rgba(244,114,182,0.22)' : 'rgba(244,114,182,0.28)'}`,
                background: C.inputBg, color: C.fg, fontSize: 13, outline: 'none',
                fontFamily: 'Nunito,sans-serif', fontWeight: 600, boxSizing: 'border-box',
              }} />
          </div>
        )}

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ height: 70, borderRadius: 22, background: C.card, border: `1.5px solid ${C.cardBorder}`, opacity: 0.5, animation: 'bb-pulse 1.4s ease-in-out infinite' }} />
            ))}
          </div>
        )}

        {!loading && errMsg && (
          <div style={{ textAlign: 'center', padding: 32, color: '#ef4444', fontSize: 13, fontWeight: 700 }}>{errMsg}</div>
        )}

        {!loading && !errMsg && filtered.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            minHeight: '40vh', gap: 14, padding: 32, textAlign: 'center', animation: 'bb-fadeUp .3s ease both',
            borderRadius: 22, border: `1.5px solid ${C.cardBorder}`,
          }}>
            <span style={{ display: 'inline-flex', color: 'rgba(244,114,182,0.5)', animation: 'bb-float 3s ease-in-out infinite' }}>
              <svg viewBox="0 0 24 24" width="52" height="52" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
            </span>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.fg, fontFamily: "'Baloo 2',cursive" }}>
              {search ? 'Không tìm thấy tài liệu' : 'Chưa có tài liệu nào'}
            </div>
            <div style={{ fontSize: 13, color: C.sub }}>
              {search ? 'Thử từ khoá khác nhé~' : 'Giáo viên sẽ đăng tài liệu học tập ở đây'}
            </div>
          </div>
        )}

        {!loading && !errMsg && filtered.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((f, i) => <FileCard key={f.id} f={f} dark={dark} onOpen={handleOpen} idx={i} />)}
          </div>
        )}

        {openFile && <FilePreviewOverlay f={openFile} onClose={() => setOpenFile(null)} />}
      </div>
    );
  }

  window.bbTabFiles = TabFiles;
})();
