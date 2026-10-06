/* ══ NOTES.JSX ═════════════════════════════════════════════════════════════
   "Sổ ghi chú" — những tờ giấy note dễ thương, học sinh viết gì cũng được.

   • Nhiều tờ note, mỗi tờ có tiêu đề (tùy chọn) + nội dung tự do, 6 màu giấy pastel,
     ghim lên đầu, tìm kiếm, xóa (có hỏi lại).
   • Tự lưu khi gõ (trễ ~0,4 giây), lưu trên thiết bị này theo TỪNG học sinh
     (localStorage 'lsnotes_v1_<id học sinh>'). Không cần mạng, không đổi database.
   • Trong lúc làm bài có nút "Ghi nhanh": mở đúng tờ note của bài đó (tự tạo nếu chưa có).

   Dùng:
     window.NotesScreen  — màn hình đầy đủ (app.jsx: homeTab === 'notes')
     window.NotesQuick   — hộp ghi nhanh nổi (quiz-player.jsx)
   ════════════════════════════════════════════════════════════════════════ */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';

/* ── 6 màu giấy ── */
export const NOTE_COLORS = [
  { id: 0, name: 'Hồng',     paper: '#FFE4EF', dk: '#4A2A3B', edge: '#F9A8D4', tape: 'rgba(249,168,212,.75)' },
  { id: 1, name: 'Vàng',     paper: '#FFF6C9', dk: '#4A4326', edge: '#FDE047', tape: 'rgba(253,224,71,.70)' },
  { id: 2, name: 'Xanh lá',  paper: '#DDF8E6', dk: '#254233', edge: '#86EFAC', tape: 'rgba(134,239,172,.70)' },
  { id: 3, name: 'Xanh dương', paper: '#DDF0FF', dk: '#243A4D', edge: '#7DD3FC', tape: 'rgba(125,211,252,.70)' },
  { id: 4, name: 'Tím',      paper: '#EDE4FF', dk: '#3A2F58', edge: '#C4B5FD', tape: 'rgba(196,181,253,.75)' },
  { id: 5, name: 'Cam',      paper: '#FFE9D6', dk: '#4D3524', edge: '#FDBA74', tape: 'rgba(253,186,116,.75)' },
];

const MAX_NOTES = 200;
const MAX_TITLE = 80;
const MAX_BODY = 20000;

const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } };

let _idn = 0;
const newId = () => 'n' + Date.now().toString(36) + (++_idn).toString(36);

const keyFor = (uid) => `lsnotes_v1_${uid || 'anon'}`;
const uidNow = () => (window.LearnsySession?.peekUser?.() || {}).id || 'anon';

/* ══ Kho dữ liệu (hàm thuần + localStorage) ═════════════════════════════ */
export function sanitizeNotes(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const n of raw) {
    if (!n || typeof n !== 'object' || typeof n.id !== 'string') continue;
    out.push({
      id: n.id,
      title: String(n.title || '').slice(0, MAX_TITLE),
      body: String(n.body || '').slice(0, MAX_BODY),
      color: Number.isInteger(n.color) && n.color >= 0 && n.color < NOTE_COLORS.length ? n.color : 0,
      pin: !!n.pin,
      lesson: n.lesson ? String(n.lesson).slice(0, 120) : '',
      created: Number(n.created) || Date.now(),
      updated: Number(n.updated) || Date.now(),
    });
  }
  return out.slice(0, MAX_NOTES);
}

export function loadNotes(uid) {
  try {
    const raw = lsGet(keyFor(uid));
    if (!raw) return [];
    const d = JSON.parse(raw);
    return sanitizeNotes(d && d.v === 1 ? d.notes : null);
  } catch { return []; }
}

export function saveNotes(uid, notes) {
  return lsSet(keyFor(uid), JSON.stringify({ v: 1, notes }));
}

/** Pin trước, rồi mới sửa gần nhất. */
export function sortNotes(notes) {
  return [...notes].sort((a, b) => (b.pin - a.pin) || (b.updated - a.updated));
}

export function filterNotes(notes, q) {
  const s = String(q || '').trim().toLowerCase();
  if (!s) return notes;
  return notes.filter(n => (n.title + '\n' + n.body).toLowerCase().includes(s));
}

export function makeNote(partial) {
  const now = Date.now();
  return { id: newId(), title: '', body: '', color: 0, pin: false, lesson: '', created: now, updated: now, ...partial };
}

/** Lấy (hoặc tạo) tờ note gắn với một bài học. Trả {notes, note}. */
export function ensureLessonNote(notes, lessonKey, lessonTitle) {
  const found = notes.find(n => n.lesson === lessonKey);
  if (found) return { notes, note: found };
  const note = makeNote({ title: String(lessonTitle || '').slice(0, MAX_TITLE), color: 1, lesson: lessonKey });
  return { notes: [note, ...notes].slice(0, MAX_NOTES), note };
}

const fmtDate = (t) => {
  try {
    const d = new Date(t);
    const p = (x) => String(x).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
  } catch { return ''; }
};

/* ══ Hook dùng chung: danh sách note + tự lưu ═════════════════════════ */
function useNotes(uid) {
  const [notes, setNotes] = useState(() => loadNotes(uid));
  const [saveErr, setSaveErr] = useState(false);
  const ref = useRef(notes);
  ref.current = notes;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => setSaveErr(!saveNotes(uid, ref.current)), 400);
    return () => clearTimeout(t);
  }, [notes, uid]);
  useEffect(() => {
    const flush = () => { saveNotes(uid, ref.current); };
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', onHide); flush(); };
  }, [uid]);
  const update = useCallback((id, patch) => {
    setNotes(prev => prev.map(n => (n.id === id ? { ...n, ...patch, updated: Date.now() } : n)));
  }, []);
  const remove = useCallback((id) => setNotes(prev => prev.filter(n => n.id !== id)), []);
  return { notes, setNotes, update, remove, saveErr, notesRef: ref };
}

/* ══ Giao diện ═══════════════════════════════════════════════════════════ */
const FONT = "'Nunito',sans-serif";
const HAND = "'Baloo 2','Nunito',cursive";

function theme(dark) {
  return dark
    ? { bg: 'linear-gradient(160deg,#1C0F1A 0%,#241431 100%)', text: '#F6E4EE', sub: '#B898AC', card: 'rgba(40,20,36,.85)', border: 'rgba(244,114,182,.25)', input: 'rgba(30,12,26,.8)' }
    : { bg: 'linear-gradient(160deg,#FFF1F7 0%,#F3EBFF 100%)', text: '#4A1D3A', sub: '#A0728F', card: 'rgba(255,255,255,.85)', border: 'rgba(244,114,182,.28)', input: 'rgba(255,255,255,.9)' };
}

function Icon({ name, size = 18, color = 'currentColor' }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'plus':   return <svg {...p}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
    case 'back':   return <svg {...p}><polyline points="15 18 9 12 15 6" /></svg>;
    case 'trash':  return <svg {...p}><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>;
    case 'pin':    return <svg {...p}><path d="M12 17v5" /><path d="M9 3h6l-1 6 3 3H7l3-3z" /></svg>;
    case 'search': return <svg {...p}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>;
    case 'close':  return <svg {...p}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
    case 'note':   return <svg {...p}><path d="M4 4h12l4 4v12H4z" /><path d="M16 4v4h4" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="13" y2="17" /></svg>;
    default: return null;
  }
}

/** Dải băng dính cute ở đầu tờ giấy. */
function Tape({ color, rot = -3 }) {
  return (
    <span aria-hidden="true" style={{ position: 'absolute', top: -9, left: '50%', width: 54, height: 18, marginLeft: -27, transform: `rotate(${rot}deg)`,
      backgroundColor: color, borderRadius: 4, boxShadow: '0 1px 3px rgba(0,0,0,.12)',
      backgroundImage: 'repeating-linear-gradient(90deg,rgba(255,255,255,.35) 0 4px,transparent 4px 8px)' }} />
  );
}

/* ── Soạn một tờ note (dùng cho cả màn đầy đủ và ghi nhanh) ── */
function NoteEditor({ note, dark, onChange, onDelete, onClose, compact }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const bodyRef = useRef(null);
  const col = NOTE_COLORS[note.color] || NOTE_COLORS[0];
  const paper = dark ? col.dk : col.paper;
  const ink = dark ? '#F6E4EE' : '#4A1D3A';
  const T = theme(dark);

  useEffect(() => { const t = setTimeout(() => { try { bodyRef.current && bodyRef.current.focus(); } catch { /* bỏ qua */ } }, 120); return () => clearTimeout(t); }, [note.id]);
  useEffect(() => { if (!confirmDel) return; const t = setTimeout(() => setConfirmDel(false), 3000); return () => clearTimeout(t); }, [confirmDel]);

  const lined = `repeating-linear-gradient(transparent 0 25px, ${dark ? 'rgba(255,255,255,.10)' : 'rgba(160,100,140,.20)'} 25px 26px)`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, flex: 1 }}>
      {/* thanh công cụ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={onClose} aria-label="Đóng" className="bb-btn-tap"
          style={{ width: 38, height: 38, borderRadius: '50%', border: `1.5px solid ${T.border}`, background: T.card, color: T.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name={compact ? 'close' : 'back'} size={17} />
        </button>
        <div style={{ display: 'flex', gap: 7, flex: 1, justifyContent: 'center' }}>
          {NOTE_COLORS.map(c => (
            <button key={c.id} onClick={() => onChange({ color: c.id })} aria-label={'Giấy ' + c.name} title={c.name}
              style={{ width: 24, height: 24, borderRadius: '50%', padding: 0, cursor: 'pointer', background: dark ? c.dk : c.paper,
                border: note.color === c.id ? `2.5px solid ${c.edge}` : `2px solid ${dark ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.10)'}`,
                boxShadow: note.color === c.id ? `0 0 0 2px ${dark ? '#241431' : '#fff'}, 0 0 0 4px ${c.edge}88` : 'none', transition: 'transform .15s', transform: note.color === c.id ? 'scale(1.12)' : 'scale(1)' }} />
          ))}
        </div>
        <button onClick={() => onChange({ pin: !note.pin })} aria-label={note.pin ? 'Bỏ ghim' : 'Ghim lên đầu'} title={note.pin ? 'Bỏ ghim' : 'Ghim lên đầu'} className="bb-btn-tap"
          style={{ width: 38, height: 38, borderRadius: '50%', border: `1.5px solid ${note.pin ? '#A855F7' : T.border}`, background: note.pin ? 'rgba(168,85,247,.16)' : T.card, color: note.pin ? '#A855F7' : T.sub, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="pin" size={16} />
        </button>
        <button onClick={() => { if (confirmDel) onDelete(); else setConfirmDel(true); }} aria-label="Xóa tờ note" className="bb-btn-tap"
          style={{ height: 38, minWidth: 38, padding: confirmDel ? '0 12px' : 0, borderRadius: 999, border: `1.5px solid ${confirmDel ? '#EF4444' : T.border}`, background: confirmDel ? 'rgba(239,68,68,.12)' : T.card, color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 12, fontWeight: 800, fontFamily: FONT, flexShrink: 0 }}>
          <Icon name="trash" size={16} />{confirmDel && 'Xóa?'}
        </button>
      </div>

      {/* tờ giấy */}
      <div style={{ position: 'relative', flex: 1, minHeight: compact ? 220 : 320, display: 'flex', flexDirection: 'column', background: paper, borderRadius: 22, padding: '22px 16px 12px',
        border: `2px solid ${col.edge}`, boxShadow: dark ? '0 10px 28px rgba(0,0,0,.45)' : `0 10px 26px ${col.edge}66`, transform: 'rotate(-.4deg)' }}>
        <Tape color={col.tape} />
        <input value={note.title} maxLength={MAX_TITLE} onChange={e => onChange({ title: e.target.value })} placeholder="Tiêu đề (không bắt buộc)"
          style={{ border: 'none', outline: 'none', background: 'transparent', color: ink, fontFamily: HAND, fontSize: 20, fontWeight: 800, padding: '0 0 6px', marginBottom: 4, borderBottom: `2px dashed ${col.edge}`, width: '100%', boxSizing: 'border-box' }} />
        <textarea ref={bodyRef} value={note.body} maxLength={MAX_BODY} onChange={e => onChange({ body: e.target.value })} placeholder="Viết gì cũng được nhé… từ mới, công thức, việc cần nhớ…"
          style={{ flex: 1, minHeight: compact ? 150 : 240, border: 'none', outline: 'none', resize: 'none', backgroundColor: 'transparent', backgroundImage: lined, backgroundAttachment: 'local', color: ink, fontFamily: HAND, fontSize: 17, fontWeight: 600, lineHeight: '26px', padding: 0, width: '100%', boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, fontWeight: 700, color: dark ? 'rgba(255,255,255,.5)' : 'rgba(74,29,58,.5)', paddingTop: 6, fontFamily: FONT }}>
          <span>{note.lesson ? 'Ghi chú của bài học' : 'Sổ ghi chú'}</span>
          <span>Tự lưu · {fmtDate(note.updated)}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Thẻ note nhỏ trong lưới ── */
function NoteCard({ note, dark, onOpen, idx }) {
  const col = NOTE_COLORS[note.color] || NOTE_COLORS[0];
  const paper = dark ? col.dk : col.paper;
  const ink = dark ? '#F6E4EE' : '#4A1D3A';
  const rot = [-1.4, 1.1, -0.6, 1.6, -1.0, 0.7][idx % 6];
  return (
    <button onClick={onOpen} className="bb-btn-tap"
      style={{ position: 'relative', textAlign: 'left', cursor: 'pointer', background: paper, color: ink, border: `2px solid ${col.edge}`, borderRadius: 20, padding: '18px 12px 10px',
        minHeight: 118, maxHeight: 190, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 4, transform: `rotate(${rot}deg)`,
        boxShadow: dark ? '0 6px 16px rgba(0,0,0,.4)' : `0 6px 16px ${col.edge}66`, fontFamily: HAND, transition: 'transform .18s cubic-bezier(.34,1.56,.64,1)' }}>
      <Tape color={col.tape} rot={rot * 2} />
      {note.pin && <span style={{ position: 'absolute', top: 6, right: 8, color: '#A855F7' }}><Icon name="pin" size={13} /></span>}
      <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.25, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', wordBreak: 'break-word' }}>
        {note.title || (note.body ? note.body.split('\n')[0].slice(0, 40) : 'Tờ note trống')}
      </div>
      {note.title && note.body && (
        <div style={{ fontSize: 13, fontWeight: 600, opacity: .78, lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{note.body}</div>
      )}
      <div style={{ marginTop: 'auto', fontSize: 10, fontWeight: 700, opacity: .55, fontFamily: FONT }}>{fmtDate(note.updated)}</div>
    </button>
  );
}

/* ══ Màn hình Sổ ghi chú ═══════════════════════════════════════════════ */
function NotesScreen({ dark, student, onBack, embedded }) {
  const uid = (student && student.id) || uidNow();
  const { notes, setNotes, update, remove, saveErr, notesRef } = useNotes(uid);
  const [openId, setOpenId] = useState(null);
  const [q, setQ] = useState('');
  const T = theme(dark);
  const cur = notes.find(n => n.id === openId) || null;
  // Rời tab khi đang soạn dở → tờ trống vẫn được dọn (tab bị gỡ khỏi màn hình)
  const curRef = useRef(null); curRef.current = cur;
  useEffect(() => () => {
    const c = curRef.current;
    if (c && !c.title.trim() && !c.body.trim()) saveNotes(uid, notesRef.current.filter(n => n.id !== c.id));
  }, [uid, notesRef]);
  const list = useMemo(() => sortNotes(filterNotes(notes, q)), [notes, q]);

  const addNote = () => {
    if (notes.length >= MAX_NOTES) { try { alert(`Sổ đã đầy (${MAX_NOTES} tờ). Hãy xóa bớt tờ cũ nhé!`); } catch { /* bỏ qua */ } return; }
    const n = makeNote({ color: notes.length % NOTE_COLORS.length });
    setNotes(prev => [n, ...prev]);
    setOpenId(n.id);
  };

  // Tờ note trống bị bỏ lại khi đóng → tự xóa cho gọn sổ
  const closeEditor = () => {
    if (cur && !cur.title.trim() && !cur.body.trim()) remove(cur.id);
    setOpenId(null);
  };

  // embedded = nằm trong tab "Ghi chú" của Dashboard (thanh dưới vẫn hiện, trang tự cuộn);
  // không embedded = màn hình phủ kín riêng (dùng khi cần mở độc lập).
  const rootStyle = embedded
    ? { position: 'relative', color: T.text, fontFamily: FONT, display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 190px)', paddingBottom: 96 }
    : { position: 'fixed', inset: 0, zIndex: 50, background: T.bg, color: T.text, fontFamily: FONT, display: 'flex', flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top,0px)', paddingBottom: 'env(safe-area-inset-bottom,0px)' };
  const scrollStyle = embedded ? {} : { flex: 1, minHeight: 0, overflowY: 'auto' };

  return (
    <div style={rootStyle}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px 8px' }}>
        {(!embedded || cur) && (
          <button onClick={cur ? closeEditor : onBack} aria-label="Quay lại" className="bb-btn-tap"
            style={{ width: 40, height: 40, borderRadius: '50%', border: `1.5px solid ${T.border}`, background: T.card, color: T.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="back" size={18} />
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 900, fontFamily: HAND, lineHeight: 1.1 }}>Sổ ghi chú</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.sub }}>{notes.length ? `${notes.length} tờ note` : 'Viết gì cũng được'}</div>
        </div>
        {!cur && (
          <button onClick={addNote} className="bb-btn-tap"
            style={{ height: 40, padding: '0 16px', borderRadius: 999, border: 'none', cursor: 'pointer', color: '#fff', fontWeight: 800, fontSize: 13, fontFamily: FONT, display: 'flex', alignItems: 'center', gap: 6,
              background: 'linear-gradient(135deg,#F472B6,#A855F7)', boxShadow: '0 4px 14px rgba(244,114,182,.4)' }}>
            <Icon name="plus" size={16} color="#fff" />Tờ mới
          </button>
        )}
      </div>

      {saveErr && (
        <div style={{ margin: '0 14px 6px', padding: '8px 12px', borderRadius: 12, background: 'rgba(239,68,68,.12)', color: '#EF4444', fontSize: 12, fontWeight: 800 }}>
          Không lưu được vào máy (bộ nhớ đầy hoặc bị chặn). Hãy chép nội dung quan trọng ra nơi khác nhé.
        </div>
      )}

      {cur ? (
        <div style={{ ...scrollStyle, flex: embedded ? undefined : 1, padding: '6px 14px 18px', display: 'flex', flexDirection: 'column' }}>
          <NoteEditor key={cur.id} note={cur} dark={dark} onChange={(p) => update(cur.id, p)} onDelete={() => { remove(cur.id); setOpenId(null); }} onClose={closeEditor} />
        </div>
      ) : (
        <div style={{ ...scrollStyle, flex: embedded ? undefined : 1, padding: '4px 14px 24px' }}>
          {notes.length > 0 && (
            <div style={{ position: 'relative', margin: '4px 0 14px' }}>
              <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: T.sub, display: 'flex' }}><Icon name="search" size={16} /></span>
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm trong sổ…"
                style={{ width: '100%', boxSizing: 'border-box', height: 42, borderRadius: 999, border: `1.5px solid ${T.border}`, background: T.input, color: T.text, padding: '0 14px 0 38px', fontSize: 14, fontWeight: 700, fontFamily: FONT, outline: 'none' }} />
            </div>
          )}
          {notes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '56px 24px', color: T.sub }}>
              <div style={{ display: 'inline-flex', width: 84, height: 84, alignItems: 'center', justifyContent: 'center', borderRadius: 28, background: dark ? NOTE_COLORS[0].dk : NOTE_COLORS[0].paper, border: `2px solid ${NOTE_COLORS[0].edge}`, transform: 'rotate(-5deg)', marginBottom: 14, color: '#EC4899' }}>
                <Icon name="note" size={38} />
              </div>
              <div style={{ fontSize: 17, fontWeight: 900, color: T.text, fontFamily: HAND, marginBottom: 6 }}>Sổ còn trống nè</div>
              <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.5, marginBottom: 18 }}>Bấm "Tờ mới" để viết từ mới, công thức,<br />hay bất cứ điều gì bạn muốn nhớ.</div>
              <button onClick={addNote} className="bb-btn-tap"
                style={{ height: 42, padding: '0 22px', borderRadius: 999, border: 'none', cursor: 'pointer', color: '#fff', fontWeight: 800, fontSize: 14, fontFamily: FONT, background: 'linear-gradient(135deg,#F472B6,#A855F7)', boxShadow: '0 4px 14px rgba(244,114,182,.4)' }}>
                Viết tờ đầu tiên
              </button>
            </div>
          ) : list.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: T.sub, fontSize: 13, fontWeight: 700 }}>Không có tờ note nào khớp "{q}".</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16, paddingTop: 6 }}>
              {list.map((n, i) => <NoteCard key={n.id} note={n} dark={dark} idx={i} onOpen={() => setOpenId(n.id)} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ══ Ghi nhanh trong lúc làm bài ═════════════════════════════════════════ */
function NotesQuick({ dark, lessonKey, lessonTitle, student }) {
  const uid = (student && student.id) || uidNow();
  const [open, setOpen] = useState(false);
  const T = theme(dark);
  const { notes, setNotes, update, remove } = useNotes(uid);
  const [noteId, setNoteId] = useState(null);

  const openSheet = () => {
    const r = ensureLessonNote(notes, lessonKey, lessonTitle);
    if (r.notes !== notes) setNotes(r.notes);
    setNoteId(r.note.id);
    setOpen(true);
  };
  const note = notes.find(n => n.id === noteId) || notes.find(n => n.lesson === lessonKey) || null;

  const close = () => {
    if (note && !note.title.trim() && !note.body.trim()) remove(note.id);
    setOpen(false);
  };

  return (
    <>
      <button onClick={openSheet} aria-label="Ghi nhanh" title="Ghi nhanh" className="bb-btn-tap"
        style={{ position: 'fixed', right: 14, bottom: 'calc(env(safe-area-inset-bottom,0px) + 86px)', zIndex: 60, width: 46, height: 46, borderRadius: 20, cursor: 'pointer', padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B45309', background: dark ? '#4A4326' : '#FFF6C9', border: '2px solid #FDE047',
          boxShadow: '0 6px 16px rgba(250,204,21,.45)', transform: 'rotate(4deg)' }}>
        <Icon name="note" size={22} />
      </button>
      {open && note && createPortal(
        <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 9990, background: 'rgba(30,10,30,.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 520, maxHeight: '82vh', display: 'flex', flexDirection: 'column', background: T.bg, color: T.text, fontFamily: FONT, borderRadius: '24px 24px 0 0',
              padding: '14px 14px calc(env(safe-area-inset-bottom,0px) + 14px)', boxShadow: '0 -10px 36px rgba(168,85,247,.28)', overflowY: 'auto' }}>
            <NoteEditor note={note} dark={dark} compact onChange={(p) => update(note.id, p)} onDelete={() => { remove(note.id); setOpen(false); }} onClose={close} />
          </div>
        </div>, document.body)}
    </>
  );
}

window.NotesScreen = NotesScreen;
window.NotesQuick = NotesQuick;
export { NotesScreen, NotesQuick };
