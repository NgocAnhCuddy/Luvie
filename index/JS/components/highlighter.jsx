/* ══ HIGHLIGHTER.JSX ═══════════════════════════════════════════════════════
   Học sinh tự GẠCH CHÂN / TÔ DẠ QUANG (8 màu) ngay trên đoạn tư liệu, câu hỏi
   và phần giải thích — không cần chờ admin.

   • Bôi đen chữ → hiện thanh công cụ: [Dạ quang | Gạch chân] + 8 màu + Xóa.
   • Chạm vào chữ đã tô → thanh công cụ hiện lại để đổi màu hoặc xóa.
   • Công tắc "Lưu": BẬT = ghi chú được nhớ trên thiết bị này (localStorage, theo
     học sinh + bài), lần sau vào lại vẫn còn. TẮT = chỉ tạm thời, mất khi thoát bài.
   • Vị trí lưu theo OFFSET chữ trong từng khối + đoạn trích đầu để kiểm tra; nếu
     admin sửa nội dung, ghi chú tự dò lại vị trí hoặc bỏ nếu không còn khớp.

   Dùng trong quiz-player.jsx:
     <HLProvider uid lessonKey dark> … <HLText as="p" html blockKey className style/> … </HLProvider>
   ════════════════════════════════════════════════════════════════════════ */
import React, { useState, useEffect, useLayoutEffect, useRef, useContext, useCallback, useMemo, createContext } from 'react';
import { createPortal } from 'react-dom';

/* ── 8 màu bút dạ ───────────────────────────────────────────────────────
   bg = nền sáng · dk = nền cho chế độ tối (trong suốt để chữ sáng vẫn đọc được)
   ul = màu gạch chân (đậm hơn để nhìn rõ trên nền sáng) */
export const HL_COLORS = [
  { id: 0, name: 'Vàng',       bg: '#FDE047', dk: 'rgba(253,224,71,.42)',  ul: '#EAB308' },
  { id: 1, name: 'Xanh lá',    bg: '#86EFAC', dk: 'rgba(134,239,172,.38)', ul: '#22C55E' },
  { id: 2, name: 'Xanh dương', bg: '#7DD3FC', dk: 'rgba(125,211,252,.38)', ul: '#0EA5E9' },
  { id: 3, name: 'Hồng',       bg: '#F9A8D4', dk: 'rgba(249,168,212,.40)', ul: '#EC4899' },
  { id: 4, name: 'Cam',        bg: '#FDBA74', dk: 'rgba(253,186,116,.40)', ul: '#F97316' },
  { id: 5, name: 'Tím',        bg: '#C4B5FD', dk: 'rgba(196,181,253,.40)', ul: '#8B5CF6' },
  { id: 6, name: 'Đỏ',         bg: '#FCA5A5', dk: 'rgba(252,165,165,.40)', ul: '#EF4444' },
  { id: 7, name: 'Xanh ngọc',  bg: '#5EEAD4', dk: 'rgba(94,234,212,.36)',  ul: '#14B8A6' },
];

const PREF_KEY = 'lshl_pref';
const HINT_KEY = 'lshl_hint_v1';
const SNIP = 60;   // số ký tự đầu của đoạn tô được lưu để kiểm tra vị trí

const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* đầy / bị chặn */ } };
const lsDel = (k) => { try { localStorage.removeItem(k); } catch { /* bỏ qua */ } };

let _idn = 0;
const newId = () => 'm' + (Date.now().toString(36)) + (++_idn).toString(36);

function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Khóa khối văn bản: ưu tiên id câu hỏi (bền khi admin sửa chữ), không có thì băm nội dung. */
export function hlBlockKey(q, field) {
  const base = (q && q.id != null)
    ? 'i' + String(q.id)
    : 'h' + hashStr(String((q && (q.question || q.passage)) || '').replace(/<[^>]*>/g, '').slice(0, 200));
  return base + ':' + field;
}

/* ══ Xử lý đoạn tô (hàm thuần — dễ kiểm thử) ═══════════════════════════ */

/** Trừ đoạn [s,e) khỏi các mark thuộc `kinds` (cắt bớt / tách đôi). */
export function subtractRange(marks, s, e, kinds) {
  const out = [];
  for (const m of marks) {
    if (!kinds.includes(m.k) || m.e <= s || m.s >= e) { out.push(m); continue; }
    if (m.s < s) out.push({ ...m, e: s });
    if (m.e > e) out.push({ ...m, s: e, id: m.s < s ? newId() : m.id });
  }
  return out;
}

/** Gộp các mark liền kề cùng loại + màu + trạng thái lưu. */
export function mergeAdjacent(marks) {
  const sorted = [...marks].sort((a, b) => a.s - b.s || a.e - b.e);
  const out = [];
  for (const m of sorted) {
    const prev = out[out.length - 1];
    if (prev && prev.k === m.k && prev.c === m.c && prev.p === m.p && m.s <= prev.e) {
      out[out.length - 1] = { ...prev, e: Math.max(prev.e, m.e), t: undefined };
    } else out.push({ ...m });
  }
  return out;
}

/** Thêm mark mới; phần giao với mark cùng loại bị thay thế. */
export function addMark(marks, { k, c, s, e, p }) {
  const next = subtractRange(marks, s, e, [k]);
  next.push({ id: newId(), k, c, s, e, p: p ? 1 : 0 });
  return mergeAdjacent(next);
}

/** Xóa mọi gạch/tô trong [s,e). */
export function eraseRange(marks, s, e) {
  return mergeAdjacent(subtractRange(marks, s, e, ['h', 'u']));
}

/** Kiểm tra mark với văn bản hiện tại của khối; dò lại vị trí nếu chữ đã dịch, bỏ nếu không còn. */
export function validateMarks(marks, plain) {
  if (!marks || !marks.length || !plain) return marks || [];
  const out = [];
  for (const m of marks) {
    const len = m.e - m.s;
    if (len <= 0) continue;
    if (m.t) {
      if (m.e <= plain.length && plain.slice(m.s, m.s + m.t.length) === m.t) { out.push(m); continue; }
      const idx = plain.indexOf(m.t);
      if (idx >= 0 && idx + len <= plain.length) out.push({ ...m, s: idx, e: idx + len });
      continue;                       // không còn khớp → bỏ
    }
    if (m.e <= plain.length) out.push(m);
  }
  return out;
}

/** Gắn lại đoạn trích đầu (t) cho mark chưa có, dựa trên văn bản khối. */
function withSnippets(marks, plain) {
  if (!plain) return marks;
  return marks.map(m => (m.t ? m : { ...m, t: plain.slice(m.s, Math.min(m.e, m.s + SNIP)) }));
}

/* ══ Đọc / ghi localStorage ═══════════════════════════════════════════ */
function loadMarks(skey) {
  try {
    const raw = lsGet(skey);
    if (!raw) return {};
    const d = JSON.parse(raw);
    if (!d || d.v !== 1 || !d.b) return {};
    const out = {};
    for (const [bk, rows] of Object.entries(d.b)) {
      if (!Array.isArray(rows)) continue;
      out[bk] = rows
        .filter(r => Array.isArray(r) && (r[0] === 'h' || r[0] === 'u') && Number.isInteger(r[2]) && Number.isInteger(r[3]) && r[3] > r[2])
        .map(r => ({ id: newId(), k: r[0], c: Math.max(0, Math.min(7, r[1] | 0)), s: r[2], e: r[3], t: r[4] || undefined, p: 1 }));
    }
    return out;
  } catch { return {}; }
}

function serializeMarks(marks, plains) {
  const b = {};
  for (const [bk, list] of Object.entries(marks)) {
    const rows = (list || []).filter(m => m.p).map(m =>
      [m.k, m.c, m.s, m.e, m.t || (plains[bk] ? plains[bk].slice(m.s, Math.min(m.e, m.s + SNIP)) : '')]);
    if (rows.length) b[bk] = rows;
  }
  return Object.keys(b).length ? JSON.stringify({ v: 1, b }) : null;
}

function loadPref() {
  const d = { mode: 'h', color: 0, persist: true };
  try {
    const p = JSON.parse(lsGet(PREF_KEY) || 'null');
    if (p && typeof p === 'object') {
      if (p.mode === 'h' || p.mode === 'u') d.mode = p.mode;
      if (Number.isInteger(p.color) && p.color >= 0 && p.color < 8) d.color = p.color;
      if (typeof p.persist === 'boolean') d.persist = p.persist;
    }
  } catch { /* dùng mặc định */ }
  return d;
}

/* ══ Vẽ mark lên DOM ═══════════════════════════════════════════════════
   Giữ nguyên chuỗi chữ (chỉ bọc <mark> quanh từng đoạn text node) nên offset
   luôn tính trên textContent gốc. */
function markCss(h, u, dark) {
  let css = 'color:inherit;border-radius:3px;-webkit-box-decoration-break:clone;box-decoration-break:clone;cursor:pointer;';
  css += h ? `background:${dark ? HL_COLORS[h.c].dk : HL_COLORS[h.c].bg};padding:1px 0;` : 'background:transparent;';
  if (u) css += `text-decoration:underline;text-decoration-color:${HL_COLORS[u.c].ul};text-decoration-thickness:2.5px;text-underline-offset:3px;text-decoration-skip-ink:none;`;
  return css;
}

export function applyMarks(root, marks, dark) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let pos = 0, n;
  while ((n = walker.nextNode())) {
    const len = n.nodeValue.length;
    if (len) nodes.push({ n, s: pos, e: pos + len });
    pos += len;
  }
  const total = pos;
  const ms = marks.filter(m => m.e > m.s && m.s < total).map(m => ({ ...m, e: Math.min(m.e, total) }));
  if (!ms.length) return;
  const pts = new Set();
  ms.forEach(m => { pts.add(m.s); pts.add(m.e); });
  const bounds = [...pts].sort((a, b) => a - b);

  for (const nd of nodes) {
    const cuts = [nd.s, ...bounds.filter(b => b > nd.s && b < nd.e), nd.e];
    const pieces = [];
    let styled = false;
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i], b = cuts[i + 1];
      const h = ms.find(m => m.k === 'h' && m.s <= a && m.e >= b);
      const u = ms.find(m => m.k === 'u' && m.s <= a && m.e >= b);
      if (h || u) styled = true;
      pieces.push({ a, b, h, u });
    }
    if (!styled) continue;
    const frag = document.createDocumentFragment();
    const text = nd.n.nodeValue;
    for (const p of pieces) {
      const t = text.slice(p.a - nd.s, p.b - nd.s);
      if (!p.h && !p.u) { frag.appendChild(document.createTextNode(t)); continue; }
      const el = document.createElement('mark');
      el.className = 'ls-hl';
      if (p.h) el.setAttribute('data-h', p.h.id);
      if (p.u) el.setAttribute('data-u', p.u.id);
      el.setAttribute('data-s', String(Math.min(p.h ? p.h.s : 1e9, p.u ? p.u.s : 1e9)));
      el.setAttribute('data-e', String(Math.max(p.h ? p.h.e : -1, p.u ? p.u.e : -1)));
      el.style.cssText = markCss(p.h, p.u, dark);
      el.textContent = t;
      frag.appendChild(el);
    }
    nd.n.parentNode.replaceChild(frag, nd.n);
  }
}

/* ══ Context ═══════════════════════════════════════════════════════════ */
const HLCtx = createContext(null);

function closestBlock(node) {
  if (!node) return null;
  const el = node.nodeType === 1 ? node : node.parentElement;
  return el && el.closest ? el.closest('[data-hl-block]') : null;
}

// Cho quiz-player biết đang có chữ được bôi đen trong khối → không coi thao tác kéo là vuốt chuyển câu.
if (typeof window !== 'undefined') {
  window.LSHL = {
    hasSelection() {
      try {
        const s = window.getSelection();
        return !!s && !s.isCollapsed && !!closestBlock(s.anchorNode);
      } catch { return false; }
    },
  };
}

/** Khối văn bản có thể tô. Ngoài HLProvider thì render HTML bình thường. */
export function HLText({ as: Tag = 'p', html, blockKey, className, style }) {
  const ctx = useContext(HLCtx);
  const ref = useRef(null);
  const marks = ctx ? ctx.marks[blockKey] : null;
  const dark = ctx ? ctx.dark : false;
  const register = ctx ? ctx.register : null;
  const openMark = ctx ? ctx.openMark : null;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = html || '';
    if (!register) return;
    const plain = el.textContent || '';
    register(blockKey, plain);
    const list = validateMarks(marks || [], plain);
    if (list.length) applyMarks(el, list, dark);
  }, [html, blockKey, marks, dark, register]);

  if (!ctx) return <Tag className={className} style={style} dangerouslySetInnerHTML={{ __html: html || '' }} />;

  return (
    <Tag ref={ref} className={className} style={style} data-hl-block={blockKey}
      onClick={(e) => {
        const m = e.target && e.target.closest ? e.target.closest('mark.ls-hl') : null;
        if (!m || !ref.current || !ref.current.contains(m)) return;
        const s = window.getSelection();
        if (s && !s.isCollapsed) return;          // đang bôi đen → để thanh công cụ chọn lo
        openMark(blockKey, m);
      }} />
  );
}

/* ══ Provider + thanh công cụ nổi ═════════════════════════════════════ */
export function HLProvider({ uid, lessonKey, dark, children }) {
  const skey = `lshl_v1_${uid || 'anon'}_${lessonKey}`;
  const [marks, setMarks] = useState(() => loadMarks(skey));
  const [pref, setPref] = useState(loadPref);
  const [sel, setSel] = useState(null);                 // {blockKey,s,e,rect,edit}
  const plains = useRef({});
  const selRef = useRef(null);
  const holdUntil = useRef(0);
  const marksRef = useRef(marks);
  marksRef.current = marks;

  const register = useCallback((bk, plain) => { plains.current[bk] = plain; }, []);

  /* ── Lưu xuống localStorage (chỉ các mark p=1) ── */
  const flush = useCallback(() => {
    const s = serializeMarks(marksRef.current, plains.current);
    if (s) lsSet(skey, s); else lsDel(skey);
  }, [skey]);
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const t = setTimeout(flush, 250);
    return () => clearTimeout(t);
  }, [marks, flush]);
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', onHide); flush(); };
  }, [flush]);
  useEffect(() => { lsSet(PREF_KEY, JSON.stringify(pref)); }, [pref]);

  /* ── Đọc vùng đang bôi đen ── */
  const readSelection = useCallback(() => {
    try {
      const s = window.getSelection();
      if (!s || s.rangeCount === 0 || s.isCollapsed) return null;
      const r = s.getRangeAt(0);
      const el = closestBlock(r.commonAncestorContainer);
      if (!el) return null;
      const pre = document.createRange();
      pre.selectNodeContents(el);
      pre.setEnd(r.startContainer, r.startOffset);
      const text = r.toString();
      const lead = text.length - text.trimStart().length;
      const trimmed = text.trim();
      if (!trimmed) return null;
      const start = pre.toString().length + lead;
      const rc = r.getBoundingClientRect();
      return {
        blockKey: el.getAttribute('data-hl-block'), s: start, e: start + trimmed.length,
        rect: { top: rc.top, bottom: rc.bottom, left: rc.left, width: rc.width },
      };
    } catch { return null; }
  }, []);

  useEffect(() => {
    let timer = null;
    const onChange = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const v = readSelection();
        if (v) { selRef.current = v; setSel(v); return; }
        if (Date.now() < holdUntil.current) return;     // đang bấm vào thanh công cụ → giữ nguyên
        setSel(prev => (prev && prev.edit ? prev : null));
        if (!(selRef.current && selRef.current.edit)) selRef.current = null;
      }, 140);
    };
    document.addEventListener('selectionchange', onChange);
    return () => { clearTimeout(timer); document.removeEventListener('selectionchange', onChange); };
  }, [readSelection]);

  /* Chạm ra ngoài khi đang ở chế độ sửa mark → đóng; cuộn → cập nhật vị trí */
  useEffect(() => {
    const onDown = (e) => {
      const cur = selRef.current;
      if (!cur || !cur.edit) return;
      if (e.target.closest && (e.target.closest('[data-hl-toolbar]') || e.target.closest('mark.ls-hl'))) return;
      selRef.current = null; setSel(null);
    };
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const cur = selRef.current;
        if (!cur) return;
        if (cur.edit) {
          if (!cur.el || !cur.el.isConnected) { selRef.current = null; setSel(null); return; }
          const rc = cur.el.getBoundingClientRect();
          const nv = { ...cur, rect: { top: rc.top, bottom: rc.bottom, left: rc.left, width: rc.width } };
          selRef.current = nv; setSel(nv);
        } else {
          const v = readSelection();
          if (v) { selRef.current = v; setSel(v); }
        }
      });
    };
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [readSelection]);

  const finish = useCallback(() => {
    try { const s = window.getSelection(); if (s) s.removeAllRanges(); } catch { /* bỏ qua */ }
    selRef.current = null;
    setSel(null);
  }, []);

  const openMark = useCallback((blockKey, el) => {
    const s = parseInt(el.getAttribute('data-s'), 10);
    const e = parseInt(el.getAttribute('data-e'), 10);
    if (!(e > s)) return;
    const rc = el.getBoundingClientRect();
    const v = { blockKey, s, e, edit: true, el, rect: { top: rc.top, bottom: rc.bottom, left: rc.left, width: rc.width } };
    selRef.current = v;
    setSel(v);
  }, []);

  /* ── Hành động ── */
  const apply = useCallback((kind, color) => {
    const t = selRef.current;
    if (!t) return;
    setMarks(prev => {
      const plain = plains.current[t.blockKey] || '';
      const base = validateMarks(prev[t.blockKey] || [], plain);
      const next = addMark(base, { k: kind, c: color, s: t.s, e: t.e, p: pref.persist });
      return { ...prev, [t.blockKey]: withSnippets(next, plain) };
    });
    finish();
  }, [pref.persist, finish]);

  const erase = useCallback(() => {
    const t = selRef.current;
    if (!t) return;
    setMarks(prev => {
      const plain = plains.current[t.blockKey] || '';
      const base = validateMarks(prev[t.blockKey] || [], plain);
      return { ...prev, [t.blockKey]: withSnippets(eraseRange(base, t.s, t.e), plain) };
    });
    finish();
  }, [finish]);

  const clearAll = useCallback(() => {
    setMarks({});
    lsDel(skey);
    finish();
  }, [skey, finish]);

  const hasAny = useMemo(() => Object.values(marks).some(l => l && l.length), [marks]);

  const ctxValue = useMemo(() => ({ marks, dark: !!dark, register, openMark }), [marks, dark, register, openMark]);

  return (
    <HLCtx.Provider value={ctxValue}>
      {children}
      <HLHint dark={dark} />
      {sel && createPortal(
        <HLToolbar sel={sel} pref={pref} setPref={setPref} apply={apply} erase={erase} clearAll={clearAll}
          hasAny={hasAny} dark={dark} hold={() => { holdUntil.current = Date.now() + 800; }} />,
        document.body)}
    </HLCtx.Provider>
  );
}

/* ── Gợi ý hiện 1 lần ── */
function HLHint({ dark }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (lsGet(HINT_KEY)) return;
    const t1 = setTimeout(() => setShow(true), 1400);
    const t2 = setTimeout(() => { setShow(false); lsSet(HINT_KEY, '1'); }, 10400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  if (!show) return null;
  const close = () => { setShow(false); lsSet(HINT_KEY, '1'); };
  return createPortal(
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 'calc(env(safe-area-inset-bottom,0px) + 92px)', zIndex: 90, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 8, maxWidth: '88vw', padding: '9px 10px 9px 14px', borderRadius: 999,
        background: dark ? 'rgba(48,24,40,.96)' : 'rgba(255,255,255,.97)', color: dark ? '#F0DCE8' : '#3D1830',
        border: '1.5px solid rgba(176,124,240,.4)', boxShadow: '0 6px 22px rgba(124,58,237,.22)', fontSize: 12.5, fontWeight: 700 }}>
        <span>Bôi đen chữ để gạch chân hoặc tô dạ quang</span>
        <button onClick={close} aria-label="Đóng gợi ý"
          style={{ width: 24, height: 24, borderRadius: '50%', border: 'none', background: 'rgba(176,124,240,.18)', color: '#8B5CF6', fontWeight: 900, cursor: 'pointer', lineHeight: 1 }}>×</button>
      </div>
    </div>, document.body);
}

/* ── Thanh công cụ nổi ── */
function HLToolbar({ sel, pref, setPref, apply, erase, clearAll, hasAny, dark, hold }) {
  const [confirmClear, setConfirmClear] = useState(false);
  useEffect(() => {
    if (!confirmClear) return;
    const t = setTimeout(() => setConfirmClear(false), 3000);
    return () => clearTimeout(t);
  }, [confirmClear]);

  const W = Math.min(288, window.innerWidth - 16);
  const H = 150;
  const vw = window.innerWidth, vh = window.innerHeight;
  let top = sel.rect.bottom + 36;                          // chừa chỗ cho núm kéo chọn chữ của hệ điều hành
  if (top + H > vh - 8) top = sel.rect.top - H - 14;
  if (top < 8) top = 8;
  const left = Math.min(Math.max(8, sel.rect.left + sel.rect.width / 2 - W / 2), vw - W - 8);

  const C = dark
    ? { bg: '#2A1520', text: '#F0DCE8', sub: '#B898AC', border: 'rgba(196,148,220,.35)', chip: 'rgba(255,255,255,.07)' }
    : { bg: '#FFFFFF', text: '#3D1830', sub: '#8A6478', border: 'rgba(176,124,240,.35)', chip: 'rgba(176,124,240,.10)' };

  const seg = (id, label) => {
    const on = pref.mode === id;
    return (
      <button onClick={() => setPref(p => ({ ...p, mode: id }))}
        style={{ flex: 1, height: 30, border: 'none', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 800,
          background: on ? 'linear-gradient(135deg,#C084FC,#A855F7)' : 'transparent', color: on ? '#fff' : C.sub }}>
        {id === 'u' ? <span style={{ textDecoration: 'underline', textDecorationThickness: 2, textUnderlineOffset: 3 }}>{label}</span> : label}
      </button>
    );
  };

  return (
    <div data-hl-toolbar="1"
      onPointerDown={(e) => { e.preventDefault(); hold(); }}
      onMouseDown={(e) => e.preventDefault()}
      style={{ position: 'fixed', top, left, width: W, zIndex: 9999, background: C.bg, color: C.text, border: `1.5px solid ${C.border}`,
        borderRadius: 22, padding: '10px 10px 9px', boxShadow: '0 10px 34px rgba(80,30,120,.28)', userSelect: 'none', WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
      {/* Hàng 1: kiểu + xóa */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', flex: 1, background: C.chip, borderRadius: 999, padding: 2 }}>
          {seg('h', 'Dạ quang')}
          {seg('u', 'Gạch chân')}
        </div>
        <button onClick={erase} title="Xóa gạch/tô ở đoạn này"
          style={{ height: 30, padding: '0 12px', borderRadius: 999, border: `1.5px solid ${C.border}`, background: 'transparent', color: '#EF4444', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
          Xóa
        </button>
      </div>
      {/* Hàng 2: 8 màu */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {HL_COLORS.map(c => {
          const on = pref.color === c.id;
          return (
            <button key={c.id} onClick={() => { setPref(p => ({ ...p, color: c.id })); apply(pref.mode, c.id); }}
              title={c.name} aria-label={c.name}
              style={{ width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', padding: 0, flexShrink: 0,
                background: pref.mode === 'u' ? c.bg : c.bg,
                border: on ? `2.5px solid ${c.ul}` : '2px solid rgba(0,0,0,.08)',
                boxShadow: on ? `0 0 0 2px ${C.bg}, 0 0 0 4px ${c.ul}55` : 'none' }}>
              {pref.mode === 'u' && <span style={{ display: 'block', margin: '0 auto', width: 14, height: 3, borderRadius: 2, background: c.ul }} />}
            </button>
          );
        })}
      </div>
      {/* Hàng 3: lưu / không lưu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button role="switch" aria-checked={pref.persist} onClick={() => setPref(p => ({ ...p, persist: !p.persist }))}
          style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
          <span style={{ position: 'relative', width: 34, height: 20, borderRadius: 99, flexShrink: 0, background: pref.persist ? '#10B981' : 'rgba(128,128,128,.4)', transition: 'background .2s' }}>
            <span style={{ position: 'absolute', top: 2, left: pref.persist ? 16 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.3)', transition: 'left .2s' }} />
          </span>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: C.sub, lineHeight: 1.3 }}>
            {pref.persist ? 'Lưu trên máy này, lần sau vẫn còn' : 'Không lưu, mất khi thoát bài'}
          </span>
        </button>
        {hasAny && (
          <button onClick={() => { if (confirmClear) clearAll(); else setConfirmClear(true); }}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 10.5, fontWeight: 800, color: confirmClear ? '#EF4444' : C.sub, padding: '4px 2px', flexShrink: 0 }}>
            {confirmClear ? 'Chắc chắn xóa?' : 'Xóa hết bài'}
          </button>
        )}
      </div>
    </div>
  );
}
