/* ══ NOTES.JSX ═════════════════════════════════════════════════════════════
   "Sổ ghi chú" — những tờ giấy note dễ thương, học sinh viết gì cũng được.

   • Nhiều tờ note, mỗi tờ có tiêu đề (tùy chọn) + nội dung tự do, 6 màu giấy pastel,
     ghim lên đầu, tìm kiếm, xóa (có hỏi lại).
   • Tự lưu khi gõ (trễ ~0,4 giây), lưu trên thiết bị này theo TỪNG học sinh
     (localStorage 'lsnotes_v1_<id học sinh>'). Không cần mạng, không đổi database.
   • Trong lúc làm bài có nút "Ghi nhanh": mở đúng tờ note của bài đó (tự tạo nếu chưa có).
   • Hộp công cụ trong tờ note: hoàn tác/làm lại, đánh số (1. 1) 1/), gạch đầu dòng, checklist ☐/☑,
     sắp xếp A→Z, đánh số lại, chép cả tờ. Bấm Enter ở dòng "1. abc" → dòng mới tự thành "2. "
     (cũng nối tiếp • và ☐; Enter ở dòng trống để thoát danh sách). Tắt/bật bằng nút "Tự đánh số".

   Dùng:
     window.NotesScreen  — màn hình đầy đủ (app.jsx: homeTab === 'notes')
     window.NotesQuick   — hộp ghi nhanh nổi (quiz-player.jsx)
   ════════════════════════════════════════════════════════════════════════ */
import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
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

/*LIST-HELPERS-START*/
/* ══ Danh sách tự đánh số (hàm thuần – dễ test) ═════════════════════════
   Nhận diện đầu dòng: "1. " "1) " "1/ " (số), "• " hoặc "- " (gạch đầu dòng), "☐ " "☑ " (việc cần làm). */
const NUM_FORMATS = ['.', ')', '/'];
const RE_NUM = /^(\s*)(\d{1,3})([.)\/])(\s+)(.*)$/;
const RE_BUL = /^(\s*)([•\-–])(\s+)(.*)$/;
const RE_CHK = /^(\s*)([☐☑])(\s*)(.*)$/;

function parseLine(line) {
  let m = RE_NUM.exec(line);
  if (m) return { kind: 'num', indent: m[1], n: parseInt(m[2], 10), delim: m[3], rest: m[5] };
  m = RE_BUL.exec(line);
  if (m) return { kind: 'bul', indent: m[1], marker: m[2], rest: m[4] };
  m = RE_CHK.exec(line);
  if (m) return { kind: 'chk', indent: m[1], marker: m[2], rest: m[4] };
  return null;
}

const lineIndent = (l) => (/^\s*/.exec(l) || [''])[0];

/** [đầu, cuối) của các dòng chứa vùng chọn s..e. */
function lineBounds(body, s, e) {
  const a = s === 0 ? 0 : body.lastIndexOf('\n', s - 1) + 1;
  const end = e > s && body[e - 1] === '\n' ? e - 1 : e;
  let b = body.indexOf('\n', end);
  if (b === -1) b = body.length;
  return [a, b];
}

function finish(body, a, b, lines, s, e) {
  const text = lines.join('\n');
  const out = body.slice(0, a) + text + body.slice(b);
  const end = a + text.length;
  return { body: out, sel: lines.length === 1 && s === e ? [end, end] : [a, end] };
}

function targetsOf(lines) {
  const t = [];
  lines.forEach((l, i) => { if (l.trim() !== '') t.push(i); });
  if (!t.length && lines.length === 1) t.push(0);
  return t;
}

const textOf = (p, line) => (p ? p.rest : line.slice(lineIndent(line).length));

/** Bật/tắt đánh số 1. 2. 3. cho các dòng đang chọn (1 dòng: nối tiếp số của dòng trên). */
function toggleNumber(body, s, e, fmt) {
  const [a, b] = lineBounds(body, s, e);
  const lines = body.slice(a, b).split('\n');
  const P = lines.map(parseLine);
  const T = targetsOf(lines);
  if (!T.length) return null;
  if (T.every(i => P[i] && P[i].kind === 'num')) {
    T.forEach(i => { lines[i] = P[i].indent + P[i].rest; });
  } else {
    let n = 1;
    let delim = fmt || '.';
    if (T.length === 1 && a > 0) {
      const prevEnd = a - 1;
      const ps = prevEnd === 0 ? 0 : body.lastIndexOf('\n', prevEnd - 1) + 1;
      const pp = parseLine(body.slice(ps, prevEnd));
      if (pp && pp.kind === 'num') { n = pp.n + 1; delim = pp.delim; }
    }
    T.forEach(i => {
      const indent = P[i] ? P[i].indent : lineIndent(lines[i]);
      lines[i] = indent + n + delim + ' ' + textOf(P[i], lines[i]);
      n += 1;
    });
  }
  return finish(body, a, b, lines, s, e);
}

function toggleSimple(body, s, e, kind, marker) {
  const [a, b] = lineBounds(body, s, e);
  const lines = body.slice(a, b).split('\n');
  const P = lines.map(parseLine);
  const T = targetsOf(lines);
  if (!T.length) return null;
  if (T.every(i => P[i] && P[i].kind === kind)) {
    T.forEach(i => { lines[i] = P[i].indent + P[i].rest; });
  } else {
    T.forEach(i => {
      const indent = P[i] ? P[i].indent : lineIndent(lines[i]);
      const mk = P[i] && P[i].kind === kind ? P[i].marker : marker;
      lines[i] = indent + mk + ' ' + textOf(P[i], lines[i]);
    });
  }
  return finish(body, a, b, lines, s, e);
}
const toggleBullet = (body, s, e) => toggleSimple(body, s, e, 'bul', '•');
const toggleCheck = (body, s, e) => toggleSimple(body, s, e, 'chk', '☐');

/** Tick ☐ ↔ ☑ (dòng chưa là checklist sẽ thành ☑). */
function tickLines(body, s, e) {
  const [a, b] = lineBounds(body, s, e);
  const lines = body.slice(a, b).split('\n');
  const P = lines.map(parseLine);
  const T = targetsOf(lines);
  if (!T.length) return null;
  const allDone = T.every(i => P[i] && P[i].kind === 'chk' && P[i].marker === '☑');
  const mk = allDone ? '☐' : '☑';
  T.forEach(i => {
    const indent = P[i] ? P[i].indent : lineIndent(lines[i]);
    lines[i] = indent + mk + ' ' + textOf(P[i], lines[i]);
  });
  return finish(body, a, b, lines, s, e);
}

/** Sắp xếp A→Z (bấm lần nữa: Z→A). Không chọn gì → sắp cả cụm dòng liền nhau quanh con trỏ. */
function sortLines(body, s, e) {
  let [a, b] = lineBounds(body, s, e);
  if (s === e) {
    if (!body.slice(a, b).trim()) return null;
    while (a > 0) {
      const ps = a - 1 === 0 ? 0 : body.lastIndexOf('\n', a - 2) + 1;
      if (!body.slice(ps, a - 1).trim()) break;
      a = ps;
    }
    while (b < body.length) {
      let ne = body.indexOf('\n', b + 1);
      if (ne === -1) ne = body.length;
      if (!body.slice(b + 1, ne).trim()) break;
      b = ne;
    }
  }
  const lines = body.slice(a, b).split('\n');
  const idx = [];
  lines.forEach((l, i) => { if (l.trim()) idx.push(i); });
  if (idx.length < 2) return null;
  const P = lines.map(parseLine);
  const key = (i) => (P[i] ? P[i].rest : lines[i]).trim().toLowerCase();
  const sorted = [...idx].sort((x, y) => key(x).localeCompare(key(y), 'vi', { numeric: true, sensitivity: 'base' }));
  const order = sorted.every((v, k) => v === idx[k]) ? [...sorted].reverse() : sorted;
  const allNum = idx.every(i => P[i] && P[i].kind === 'num');
  const n0 = allNum ? P[idx[0]].n : 0;
  const d0 = allNum ? P[idx[0]].delim : '.';
  const out = lines.slice();
  idx.forEach((slot, k) => {
    const src = order[k];
    out[slot] = allNum ? P[src].indent + (n0 + k) + d0 + ' ' + P[src].rest : lines[src];
  });
  return finish(body, a, b, out, s, e);
}

/** Đánh số lại cả tờ: mỗi cụm dòng số liền nhau được đếm lại 1,2,3… (giữ số bắt đầu của cụm). */
function renumberAll(body, s) {
  const orig = body.split('\n');
  const lines = orig.slice();
  const before = body.slice(0, s);
  const ci = before.split('\n').length - 1;
  const col = s - (before.lastIndexOf('\n') + 1);
  let run = null;
  let changed = false;
  for (let i = 0; i < lines.length; i++) {
    const p = parseLine(lines[i]);
    if (p && p.kind === 'num') {
      const n = run && run.indent === p.indent && run.delim === p.delim ? run.n + 1 : p.n;
      if (n !== p.n) { lines[i] = p.indent + n + p.delim + ' ' + p.rest; changed = true; }
      run = { indent: p.indent, delim: p.delim, n };
    } else run = null;
  }
  if (!changed) return null;
  const lineStart = lines.slice(0, ci).reduce((t, l) => t + l.length + 1, 0);
  const newCol = Math.max(0, lines[ci].length - (orig[ci].length - col));
  const caret = lineStart + newCol;
  return { body: lines.join('\n'), sel: [caret, caret] };
}

/** Vừa bấm Enter (v đã chứa "\n" tại c-1): nối tiếp số / • / ☐ cho dòng mới. Trả null nếu dòng trên không phải danh sách. */
function continueList(v, c) {
  const ls = c >= 2 ? v.lastIndexOf('\n', c - 2) + 1 : 0;
  const p = parseLine(v.slice(ls, c - 1));
  if (!p) return null;
  // dòng danh sách còn trống + Enter → thoát danh sách (xóa đầu dòng)
  if (!p.rest.trim()) return { body: v.slice(0, ls) + v.slice(c), caret: ls };
  let pre;
  if (p.kind === 'num') pre = p.indent + (p.n + 1) + p.delim + ' ';
  else if (p.kind === 'bul') pre = p.indent + p.marker + ' ';
  else pre = p.indent + '☐ ';
  let body = v.slice(0, c) + pre + v.slice(c);
  if (p.kind === 'num') {
    // chèn giữa danh sách → đánh số lại các dòng số liền ngay bên dưới
    const lines = body.split('\n');
    const idx = v.slice(0, c).split('\n').length - 1;
    let n = p.n + 1;
    for (let i = idx + 1; i < lines.length; i++) {
      const q = parseLine(lines[i]);
      if (!q || q.kind !== 'num' || q.indent !== p.indent || q.delim !== p.delim) break;
      n += 1;
      if (q.n !== n) lines[i] = q.indent + n + q.delim + ' ' + q.rest;
    }
    body = lines.join('\n');
  }
  return { body, caret: c + pre.length };
}

/** Vị trí con trỏ hợp lý sau undo/redo: cuối đoạn vừa thay đổi. */
function diffCaret(oldB, newB) {
  const m = Math.min(oldB.length, newB.length);
  let p = 0;
  while (p < m && oldB[p] === newB[p]) p++;
  let q = 0;
  while (q < m - p && oldB[oldB.length - 1 - q] === newB[newB.length - 1 - q]) q++;
  return newB.length - q;
}
/*LIST-HELPERS-END*/

/* ── Tùy chọn hộp công cụ (dùng chung mọi tờ note, lưu trên máy) ── */
const PREF_KEY = 'lsnotes_prefs_v1';
function loadPrefs() {
  try {
    const d = JSON.parse(lsGet(PREF_KEY) || '{}') || {};
    return { auto: d.auto !== false, fmt: NUM_FORMATS.includes(d.fmt) ? d.fmt : '.' };
  } catch { return { auto: true, fmt: '.' }; }
}

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
    case 'undo':   return <svg {...p}><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-15-6.7L3 13" /></svg>;
    case 'redo':   return <svg {...p}><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 15-6.7L21 13" /></svg>;
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

/* Nút nhỏ trong hộp công cụ — giữ nguyên con trỏ/bàn phím của ô soạn khi bấm. */
function Chip({ children, onClick, label, active, disabled, dark, col, ink, pressed }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} aria-pressed={pressed}
      onMouseDown={e => e.preventDefault()} onClick={onClick} className="bb-btn-tap"
      style={{ flexShrink: 0, height: 32, minWidth: 32, padding: '0 10px', borderRadius: 999, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.35 : 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontFamily: FONT, fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', color: ink,
        background: active ? col.edge : (dark ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.62)'),
        border: `1.5px solid ${active ? col.edge : (dark ? 'rgba(255,255,255,.18)' : col.edge + '99')}` }}>
      {children}
    </button>
  );
}

/* ── Soạn một tờ note (dùng cho cả màn đầy đủ và ghi nhanh) ── */
function NoteEditor({ note, dark, onChange, onDelete, onClose, compact }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const bodyRef = useRef(null);
  const [prefs, setPrefsState] = useState(loadPrefs);
  const [copied, setCopied] = useState(null);
  const [, setTick] = useState(0);
  const pendingSel = useRef(null);
  const hist = useRef({ st: [{ body: note.body }], i: 0, last: 0, typing: false });
  const copyTimer = useRef(null);
  const col = NOTE_COLORS[note.color] || NOTE_COLORS[0];
  const paper = dark ? col.dk : col.paper;
  const ink = dark ? '#F6E4EE' : '#4A1D3A';
  const T = theme(dark);

  useEffect(() => { const t = setTimeout(() => { try { bodyRef.current && bodyRef.current.focus(); } catch { /* bỏ qua */ } }, 120); return () => clearTimeout(t); }, [note.id]);
  useEffect(() => { if (!confirmDel) return; const t = setTimeout(() => setConfirmDel(false), 3000); return () => clearTimeout(t); }, [confirmDel]);

  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);

  // Đặt lại con trỏ sau khi nội dung bị thay bằng code (đánh số, undo…)
  useLayoutEffect(() => {
    const sel = pendingSel.current;
    if (!sel) return;
    pendingSel.current = null;
    try { bodyRef.current && bodyRef.current.setSelectionRange(sel[0], sel[1]); } catch { /* bỏ qua */ }
  }, [note.body]);

  const setPref = (patch) => {
    const n = { ...prefs, ...patch };
    setPrefsState(n);
    lsSet(PREF_KEY, JSON.stringify(n));
  };

  /* Lịch sử hoàn tác: gõ liên tục (<0,8s) gộp thành 1 bước; thao tác công cụ là 1 bước riêng */
  const record = (body, force) => {
    const h = hist.current;
    if (h.st[h.i].body === body) return;
    h.st = h.st.slice(0, h.i + 1);
    if (!force && h.typing && Date.now() - h.last < 800) {
      h.st[h.i] = { body };
    } else {
      h.st.push({ body });
      h.i = h.st.length - 1;
      if (h.st.length > 100) { h.st.shift(); h.i -= 1; }
    }
    h.last = Date.now();
    h.typing = !force;
    setTick(t => t + 1);
  };

  const commitBody = (body, sel, force) => {
    const nb = body.slice(0, MAX_BODY);
    record(nb, force);
    const ta = bodyRef.current;
    const fixed = sel ? [Math.min(sel[0], nb.length), Math.min(sel[1], nb.length)] : null;
    if (nb === note.body) {
      if (fixed && ta) { try { ta.setSelectionRange(fixed[0], fixed[1]); } catch { /* bỏ qua */ } }
      return;
    }
    pendingSel.current = fixed;
    onChange({ body: nb });
  };

  const handleBodyChange = (e) => {
    const ta = e.target;
    const v = ta.value;
    const prev = note.body;
    const c = ta.selectionStart;
    // Vừa bấm Enter (đúng 1 ký tự xuống dòng được chèn tại con trỏ) → nối tiếp danh sách
    if (prefs.auto && v.length === prev.length + 1 && c > 0 && v[c - 1] === '\n' && v.slice(0, c - 1) + v.slice(c) === prev) {
      const r = continueList(v, c);
      if (r) { commitBody(r.body, [r.caret, r.caret], true); return; }
    }
    commitBody(v, null, false);
  };

  const runTool = (fn, ...args) => {
    const ta = bodyRef.current;
    if (!ta) return;
    const r = fn(note.body, ta.selectionStart, ta.selectionEnd, ...args);
    if (!r) return;
    commitBody(r.body, r.sel, true);
    try { ta.focus(); } catch { /* bỏ qua */ }
  };

  const gotoHist = (i) => {
    const h = hist.current;
    if (i < 0 || i >= h.st.length) return;
    h.i = i;
    h.typing = false;
    const body = h.st[i].body;
    if (body !== note.body) {
      const c = diffCaret(note.body, body);
      pendingSel.current = [c, c];
      onChange({ body });
    }
    setTick(t => t + 1);
    try { bodyRef.current && bodyRef.current.focus(); } catch { /* bỏ qua */ }
  };

  const copyAll = async () => {
    const text = (note.title ? note.title + '\n\n' : '') + note.body;
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch { /* thử cách khác */ }
    if (!ok) {
      try {
        const t = document.createElement('textarea');
        t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
        document.body.appendChild(t); t.select();
        ok = document.execCommand('copy');
        document.body.removeChild(t);
      } catch { /* bỏ qua */ }
    }
    setCopied(ok ? 'Đã chép!' : 'Không chép được');
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(null), 1600);
  };

  const canUndo = hist.current.i > 0;
  const canRedo = hist.current.i < hist.current.st.length - 1;
  const cc = { dark, col, ink };
  const divider = <span aria-hidden="true" style={{ flexShrink: 0, width: 1.5, height: 18, borderRadius: 1, background: dark ? 'rgba(255,255,255,.18)' : col.edge + '99' }} />;

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
        {/* hộp công cụ */}
        <div role="toolbar" aria-label="Công cụ soạn ghi chú"
          style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0 8px', overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          <Chip {...cc} label="Hoàn tác" disabled={!canUndo} onClick={() => gotoHist(hist.current.i - 1)}><Icon name="undo" size={16} /></Chip>
          <Chip {...cc} label="Làm lại" disabled={!canRedo} onClick={() => gotoHist(hist.current.i + 1)}><Icon name="redo" size={16} /></Chip>
          {divider}
          <Chip {...cc} label="Đánh số dòng" onClick={() => runTool(toggleNumber, prefs.fmt)}>{'1' + prefs.fmt}</Chip>
          <Chip {...cc} label="Đổi kiểu số: 1.  1)  1/" onClick={() => setPref({ fmt: NUM_FORMATS[(NUM_FORMATS.indexOf(prefs.fmt) + 1) % NUM_FORMATS.length] })}>Đổi kiểu</Chip>
          <Chip {...cc} label="Gạch đầu dòng" onClick={() => runTool(toggleBullet)}>•</Chip>
          <Chip {...cc} label="Checklist" onClick={() => runTool(toggleCheck)}>☐</Chip>
          <Chip {...cc} label="Tick xong / chưa xong" onClick={() => runTool(tickLines)}>☑</Chip>
          {divider}
          <Chip {...cc} label="Sắp xếp A đến Z (bấm lại: Z đến A)" onClick={() => runTool(sortLines)}>A→Z</Chip>
          <Chip {...cc} label="Đánh số lại cả tờ" onClick={() => runTool(renumberAll)}>Đánh số lại</Chip>
          <Chip {...cc} label="Chép cả tờ note" onClick={copyAll} active={!!copied}>{copied || 'Chép'}</Chip>
          {divider}
          <Chip {...cc} label="Tự đánh số khi xuống dòng" pressed={prefs.auto} active={prefs.auto} onClick={() => setPref({ auto: !prefs.auto })}>
            {prefs.auto ? '●' : '○'} Tự đánh số
          </Chip>
        </div>
        <textarea ref={bodyRef} value={note.body} maxLength={MAX_BODY} onChange={handleBodyChange} placeholder="Viết gì cũng được nhé… Gõ &quot;1. &quot; rồi Enter để tự đánh số"
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
