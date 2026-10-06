import React from 'react';

/* ══ STUDENT-MANAGER.JSX — Quản lý tài khoản học sinh ══════════════════
   Lưu vào Supabase bảng `students`:
     id uuid, username text, password_hash text, display_name text,
     class_name text, created_at timestamptz, is_active bool

   SQL tạo bảng (chạy trong Supabase SQL Editor):
   ─────────────────────────────────────────────
   CREATE TABLE students (
     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
     username text UNIQUE NOT NULL,
     password_hash text NOT NULL,
     display_name text,
     class_name text DEFAULT '',
     created_at timestamptz DEFAULT now(),
     is_active boolean DEFAULT true
   );
   ALTER TABLE students ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "admin_all" ON students FOR ALL TO authenticated USING (true) WITH CHECK (true);
   ─────────────────────────────────────────────
   Supabase Storage bucket: tên "avatars", public=false
   Path mỗi file: avatars/<student_id>.jpg
   Policy storage (SQL):
     CREATE POLICY "admin_rw" ON storage.objects FOR ALL TO authenticated
       USING (bucket_id='avatars') WITH CHECK (bucket_id='avatars');
   ─────────────────────────────────────────────
══════════════════════════════════════════════════════════════════════ */
(function(){
const {useState, useEffect, useCallback, useRef, useMemo} = React;

/* ── SHA-256 helper ── */
async function sha256(str){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
window._sha256 = sha256;

/* ── Google-style password generator ── */
const _GP_UPPER = 'ABCDEFGHJKLMNPQRTUVWXYZ';
const _GP_LOWER = 'abcdefghjkmnpqrtuvwxyz';
const _GP_DIGIT = '2346789';
const _GP_ALL = _GP_UPPER + _GP_LOWER + _GP_DIGIT;

function _gpChar(cs){
  const max = Math.floor(256 / cs.length) * cs.length;
  const b = new Uint8Array(1);
  let v;
  do { crypto.getRandomValues(b); v = b[0]; } while (v >= max);
  return cs[v % cs.length];
}

function _gpSegment(len = 3){
  const ch = [
    _gpChar(_GP_UPPER), _gpChar(_GP_LOWER), _gpChar(_GP_DIGIT),
    ...Array.from({length: Math.max(0, len - 3)}, () => _gpChar(_GP_ALL)),
  ];
  const idx = new Uint32Array(ch.length);
  crypto.getRandomValues(idx);
  for (let i = ch.length - 1; i > 0; i--) {
    const j = idx[i] % (i + 1);
    [ch[i], ch[j]] = [ch[j], ch[i]];
  }
  return ch.join('');
}

function genPass(segments = 4, segLen = 3, sep = '-'){
  return Array.from({length: segments}, () => _gpSegment(segLen)).join(sep);
}

/* ── Export CSV ── */
function exportCSV(students){
  const header = 'Username,Tên hiển thị,Lớp,Trạng thái,Ngày tạo';
  const rows = students.map(s => [
    s.username,
    '"' + (s.display_name || '').replace(/"/g, '""') + '"',
    s.class_name || '',
    s.is_active ? 'Hoạt động' : 'Khoá',
    s.created_at ? new Date(s.created_at).toLocaleDateString('vi-VN') : '',
  ].join(','));
  const csv = '\uFEFF' + [header, ...rows].join('\n'); // BOM cho Excel đọc được tiếng Việt
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type: 'text/csv;charset=utf-8'}));
  a.download = 'students_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

function StudentManager({dark, C}){
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState(''); // '' = tất cả
  const [filterStatus, setFilterStatus] = useState(''); // '' | 'active' | 'locked'
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'name' | 'class'
  const [modal, setModal] = useState(null); // null | 'add' | 'edit' | 'view'
  const [selected, setSelected] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null); // null | student | 'bulk'

  // Bulk select
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState(new Set());

  // Form state
  const [fUser, setFUser] = useState('');
  const [fName, setFName] = useState('');
  const [fClass, setFClass] = useState('');
  const [fPass, setFPass] = useState('');
  const [fShow, setFShow] = useState(false);
  const [plainPassView, setPlainPassView] = useState({});

  // Avatar
  const [avatarUrls, setAvatarUrls] = useState({});
  const [avatarUploading, setAvatarUploading] = useState(null);
  const avatarInputRef = useRef(null);
  const [avatarTargetId, setAvatarTargetId] = useState(null);

  // Inline edit
  const [editingCell, setEditingCell] = useState(null); // {id, field}
  const [editVal, setEditVal] = useState('');
  const editRef = useRef(null);

  // ── Mini status bar: server / ping / giờ UTC+7 ──
  const [srvStatus, setSrvStatus] = useState('checking'); // 'online' | 'offline' | 'checking'
  const [pingMs, setPingMs] = useState(null);
  const [nowUTC7, setNowUTC7] = useState('');
  const [statusOpen, setStatusOpen] = useState(false);
  const [activityLog, setActivityLog] = useState([]); // [{ts, type, msg}]
  const lastPingAtRef = useRef(null);

  const logActivity = useCallback((type, msg) => {
    setActivityLog(p => [{ts: Date.now(), type, msg}, ...p].slice(0, 12));
  }, []);

  const showToast = (msg, type = 'auto') => {
    if (typeof window.showToast === 'function') {
      window.showToast(msg, type, 2800);
    } else {
      console.log('[StudentManager toast]', msg);
    }
  };

  /* ── Avatar helpers ── */
  const AVATAR_TTL_MS = 3600 * 1000;

  const readAvatarCache = (id) => {
    const raw = localStorage.getItem('ls_avatar_' + id);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.url && parsed?.exp && parsed.exp > Date.now()) return parsed.url;
    } catch (e) {
      // dữ liệu cache kiểu cũ (chỉ là string URL, không có exp) -> coi như hết hạn, xóa đi
    }
    localStorage.removeItem('ls_avatar_' + id);
    return null;
  };

  const writeAvatarCache = (id, url) => {
    localStorage.setItem('ls_avatar_' + id, JSON.stringify({ url, exp: Date.now() + AVATAR_TTL_MS - 60000 }));
  };

  const loadAvatar = useCallback(async (id) => {
    const cached = readAvatarCache(id);
    if (cached) { setAvatarUrls(p => ({...p, [id]: cached})); return; }
    const { data } = await window.supa.storage.from('avatars').createSignedUrl('avatars/' + id + '.jpg', 3600);
    if (data?.signedUrl) {
      writeAvatarCache(id, data.signedUrl);
      setAvatarUrls(p => ({...p, [id]: data.signedUrl}));
    }
  }, []);

  /* Server cache trạng thái học sinh (tồn tại / bị khóa / tên) ở Redis 120s.
     Mỗi lần admin sửa / khóa / xóa phải xóa khóa này để có hiệu lực ngay.
     Lỗi cũng không sao (upstashCmd tự nuốt lỗi) — TTL 120s là mức trễ tối đa. */
  const dropStudentCache = (ids) =>
    Promise.all([].concat(ids).map(id => window.upstashCmd('DEL', 'stu:active:' + id)));

  const doUploadAvatar = async (file, studentId) => {
    if (!file || !studentId) return;
    if (!file.type.startsWith('image/')) { showToast('Chỉ chấp nhận file ảnh!', 'warn'); return; }
    if (file.size > 2 * 1024 * 1024) { showToast('Ảnh tối đa 2MB!', 'warn'); return; }
    setAvatarUploading(studentId);
    const resized = await resizeImage(file, 256);
    const { error } = await window.supa.storage.from('avatars').upload('avatars/' + studentId + '.jpg', resized, {contentType: 'image/jpeg', upsert: true});
    if (error) { showToast('Lỗi upload ảnh!', 'error'); setAvatarUploading(null); return; }
    localStorage.removeItem('ls_avatar_' + studentId);
    try { await window.upstashCmd('DEL', 'avatar:user:' + studentId); } catch (e) {}
    const { data } = await window.supa.storage.from('avatars').createSignedUrl('avatars/' + studentId + '.jpg', 3600);
    if (data?.signedUrl) {
      writeAvatarCache(studentId, data.signedUrl);
      setAvatarUrls(p => ({...p, [studentId]: data.signedUrl}));
    }
    showToast('Đã cập nhật ảnh đại diện!', 'success');
    setAvatarUploading(null);
  };

  function resizeImage(file, size){
    return new Promise(res => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = size;
        c.height = size;
        const ctx = c.getContext('2d');
        const s = Math.min(img.width, img.height);
        const sx = (img.width - s) / 2, sy = (img.height - s) / 2;
        ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
        URL.revokeObjectURL(url);
        c.toBlob(b => res(b), 'image/jpeg', 0.88);
      };
      img.src = url;
    });
  }

  /* ── Load students ── */
  const load = useCallback(async () => {
    setLoading(true);
    const t0 = performance.now();
    const { data, error } = await window.supa.from('students').select('*').order('created_at', {ascending: false});
    if (!error) { setStudents(data || []); logActivity('get', `GET students — ${data ? data.length : 0} bản ghi (${Math.round(performance.now() - t0)}ms)`); }
    else { logActivity('error', 'GET students lỗi: ' + error.message); }
    setLoading(false);
  }, [logActivity]);

  useEffect(() => { load(); }, [load]);

  /* ── Ping server (Supabase) định kỳ để đo trạng thái + độ trễ ── */
  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      const t0 = performance.now();
      try {
        const { error } = await window.supa.from('students').select('id', {count: 'exact', head: true});
        if (cancelled) return;
        lastPingAtRef.current = Date.now();
        if (error) { setSrvStatus('offline'); setPingMs(null); logActivity('error', 'Ping thất bại: ' + error.message); }
        else { const ms = Math.round(performance.now() - t0); setSrvStatus('online'); setPingMs(ms); logActivity('ping', `Ping server — ${ms}ms`); }
      } catch (e) {
        if (cancelled) return;
        lastPingAtRef.current = Date.now();
        setSrvStatus('offline'); setPingMs(null);
        logActivity('error', 'Mất kết nối mạng');
      }
    };
    ping();
    const iv = setInterval(ping, 3600000); // 1 giờ
    const onOnline = () => { logActivity('info', 'Trình duyệt: có mạng trở lại'); ping(); };
    const onOffline = () => { setSrvStatus('offline'); setPingMs(null); logActivity('error', 'Trình duyệt: mất mạng'); };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { cancelled = true; clearInterval(iv); window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, [logActivity]);

  /* ── Đồng hồ UTC+7 ── */
  useEffect(() => {
    const tick = () => {
      const utcMs = Date.now() + new Date().getTimezoneOffset() * 60000;
      const vn = new Date(utcMs + 7 * 3600000);
      const hh = String(vn.getHours()).padStart(2, '0');
      const mm = String(vn.getMinutes()).padStart(2, '0');
      const ss = String(vn.getSeconds()).padStart(2, '0');
      setNowUTC7(`${hh}:${mm}:${ss}`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (students.length === 0) return;
    students.forEach(s => loadAvatar(s.id));
  }, [students, loadAvatar]);

  /* Focus inline edit input */
  useEffect(() => {
    if (editingCell && editRef.current) editRef.current.focus();
  }, [editingCell]);

  /* ── Add student ── */
  const doAdd = async () => {
    if (!fUser.trim()) { showToast('Nhập username!', 'warn'); return; }
    if (saving) return; // chặn bấm đúp gây double-submit
    setSaving(true);
    let insertedId = null;
    try {
      const { data, error } = await window.supa.from('students').insert({
        username: fUser.trim().toLowerCase(),
        password_hash: 'PENDING',
        display_name: fName.trim() || fUser.trim(),
        class_name: fClass.trim(),
        is_active: true,
      }).select().single();
      if (error) {
        showToast(error.code === '23505' ? 'Username đã tồn tại!' : 'Lỗi: ' + error.message, 'error');
        logActivity('error', 'INSERT students lỗi: ' + error.message);
        return;
      }
      insertedId = data.id;
      logActivity('insert', `INSERT students — @${data.username}`);

      const fnBody = fPass.trim() ? {studentId: data.id, password: fPass.trim()} : {studentId: data.id};
      // Timeout thủ công: supa.functions.invoke() không có timeout mặc định,
      // nếu Edge Function bị treo (cold start, lỗi CORS âm thầm...) nút sẽ xoay vòng vô hạn.
      const timeoutMs = 12000;
      // Edge Function xác thực bằng header x-admin-secret (= window.ADMIN_API_KEY).
      // Khóa này CHỈ được /api/config cấp sau khi admin đăng nhập Supabase Auth
      // (xem window.__loadAdminKey trong admin.html).
      const invokePromise = window.supa.functions.invoke('student-set-password', {
        body: fnBody,
        headers: { 'x-admin-secret': window.ADMIN_API_KEY || '' },
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs)
      );
      const { data: fnData, error: fnErr } = await Promise.race([invokePromise, timeoutPromise]);

      if (fnErr) {
        await window.supa.from('students').delete().eq('id', data.id);
        showToast('Lỗi tạo mật khẩu! Thử lại nhé.', 'error');
        // Lấy chi tiết lỗi thật từ Edge Function để biết nguyên nhân gốc (CORS, JWT, bcrypt, 500...)
        let detail = fnErr.message || 'Không rõ nguyên nhân';
        try {
          if (fnErr.context && typeof fnErr.context.json === 'function') {
            const body = await fnErr.context.json();
            if (body?.error) detail = body.error;
          } else if (fnErr.context?.status) {
            detail += ` (HTTP ${fnErr.context.status})`;
          }
        } catch (_) {}
        logActivity('error', `Edge Function student-set-password lỗi: ${detail}`);
        console.error('[doAdd] fnErr:', fnErr);
        return;
      }
      logActivity('fn', 'Edge Function student-set-password — OK');
      const plain = fPass.trim() || (fnData && fnData.generatedPassword) || '';
      setStudents(p => [data, ...p]);
      if (plain) setPlainPassView(p => ({...p, [data.id]: plain}));
      showToast('Đã tạo tài khoản!', 'success');
      window.dispatchEvent(new CustomEvent('learnsy:student-saved'));
      setModal('view');
      setSelected({...data, _plainPass: plain});
      resetForm();
    } catch (e) {
      // Bắt cả lỗi network/CORS bị "nuốt" lẫn lỗi TIMEOUT ở trên
      if (insertedId) {
        try { await window.supa.from('students').delete().eq('id', insertedId); } catch (_) {}
      }
      showToast(
        e && e.message === 'TIMEOUT'
          ? 'Server không phản hồi, thử lại nhé!'
          : 'Lỗi kết nối! Kiểm tra mạng và thử lại.',
        'error'
      );
      console.error('[doAdd] lỗi:', e);
      logActivity('error', e && e.message === 'TIMEOUT' ? 'Timeout Edge Function (12s), đã rollback' : 'Lỗi mạng khi tạo tài khoản');
    } finally {
      setSaving(false); // luôn tắt loading dù thành công, lỗi hay timeout
    }
  };

  /* ── Edit student (tên + lớp) ── */
  const doEdit = async () => {
    if (!selected) return;
    setSaving(true);
    const upd = {display_name: fName.trim() || selected.username, class_name: fClass.trim()};
    const { error } = await window.supa.from('students').update(upd).eq('id', selected.id);
    if (!error) {
      await dropStudentCache(selected.id);
      setStudents(p => p.map(s => s.id === selected.id ? {...s, ...upd} : s));
      showToast('Đã lưu thay đổi!', 'success');
      logActivity('update', `UPDATE students — @${selected.username}`);
      setModal(null);
      setSelected(null);
    } else {
      showToast('Lỗi: ' + error.message, 'error');
      logActivity('error', 'UPDATE students lỗi: ' + error.message);
    }
    setSaving(false);
  };

  /* ── Inline edit commit ── */
  const commitInlineEdit = async () => {
    if (!editingCell) return;
    const { id, field } = editingCell;
    const val = editVal.trim();
    setEditingCell(null);
    if (!val) return;
    const upd = {[field]: val};
    const { error } = await window.supa.from('students').update(upd).eq('id', id);
    if (!error) {
      await dropStudentCache(id);
      setStudents(p => p.map(s => s.id === id ? {...s, ...upd} : s));
    } else {
      showToast('Lỗi cập nhật!', 'error');
    }
  };

  /* ── Reset password ── */
  const doResetPass = async (student, newPass) => {
    setSaving(true);
    const fnBody = newPass ? {studentId: student.id, password: newPass} : {studentId: student.id};
    const { data: fnData, error } = await window.supa.functions.invoke('student-set-password', {
      body: fnBody,
      headers: { 'x-admin-secret': window.ADMIN_API_KEY || '' },
    });
    if (!error) {
      const plain = newPass || (fnData && fnData.generatedPassword) || '';
      if (plain) setPlainPassView(p => ({...p, [student.id]: plain}));
      showToast('Đã đổi mật khẩu!', 'success');
    } else {
      showToast('Lỗi: ' + (error.message || 'Không xác định'), 'error');
    }
    setSaving(false);
  };

  /* ── Toggle active ── */
  const doToggle = async (student) => {
    const next = !student.is_active;
    const { error } = await window.supa.from('students').update({is_active: next}).eq('id', student.id);
    if (!error) {
      await dropStudentCache(student.id);
      setStudents(p => p.map(s => s.id === student.id ? {...s, is_active: next} : s));
      logActivity('update', `${next ? 'Mở khoá' : 'Khoá'} @${student.username}`);
    } else {
      showToast('Lỗi cập nhật!', 'error');
      logActivity('error', 'Toggle is_active lỗi: ' + error.message);
    }
  };

  /* ── Delete (single) ──
     quiz_results được DB tự xóa qua FK ON DELETE CASCADE
     (fk_quiz_results_student), không cần xóa tay ở đây nữa. */
  const doDelete = async (id) => {
    await window.supa.storage.from('avatars').remove(['avatars/' + id + '.jpg']);
    try { await window.upstashCmd('DEL', 'avatar:user:' + id); } catch (e) {}
    localStorage.removeItem('ls_avatar_' + id);
    const { error } = await window.supa.from('students').delete().eq('id', id);
    if (!error) {
      await dropStudentCache(id);
      setStudents(p => p.filter(s => s.id !== id));
      showToast('Đã xóa tài khoản!', 'success');
      logActivity('delete', `DELETE students — id ${id.slice(0,8)}…`);
      window.dispatchEvent(new CustomEvent('learnsy:student-deleted'));
    } else {
      showToast('Lỗi xóa tài khoản!', 'error');
      logActivity('error', 'DELETE students lỗi: ' + error.message);
    }
    setConfirmDel(null);
  };

  /* ── Bulk delete ── */
  const doBulkDelete = async () => {
    const ids = [...bulkSelected];
    setSaving(true);
    let ok = 0, fail = 0;
    for (const id of ids) {
      await window.supa.storage.from('avatars').remove(['avatars/' + id + '.jpg']);
      localStorage.removeItem('ls_avatar_' + id);
      const { error } = await window.supa.from('students').delete().eq('id', id);
      if (!error) { ok++; await dropStudentCache(id); } else fail++;
    }
    setStudents(p => p.filter(s => !bulkSelected.has(s.id)));
    setBulkSelected(new Set());
    setBulkMode(false);
    showToast(`Đã xóa ${ok} tài khoản${fail ? ` (${fail} lỗi)` : ''}!`, fail ? 'warn' : 'success');
    logActivity(fail ? 'error' : 'delete', `Bulk DELETE — ${ok} OK${fail ? `, ${fail} lỗi` : ''}`);
    setConfirmDel(null);
    setSaving(false);
    window.dispatchEvent(new CustomEvent('learnsy:student-deleted'));
  };

  /* ── Bulk toggle ── */
  const doBulkToggle = async (active) => {
    const ids = [...bulkSelected];
    const { error } = await window.supa.from('students').update({is_active: active}).in('id', ids);
    if (!error) {
      await dropStudentCache(ids);
      setStudents(p => p.map(s => bulkSelected.has(s.id) ? {...s, is_active: active} : s));
      showToast(`Đã ${active ? 'mở khoá' : 'khoá'} ${ids.length} tài khoản!`, 'success');
      setBulkSelected(new Set());
      setBulkMode(false);
    } else {
      showToast('Lỗi cập nhật!', 'error');
    }
  };

  const resetForm = () => { setFUser(''); setFName(''); setFClass(''); setFPass(''); setFShow(false); };
  const openAdd = () => { resetForm(); setFPass(genPass()); setModal('add'); };
  const openEdit = (s) => { setSelected(s); setFName(s.display_name || ''); setFClass(s.class_name || ''); setModal('edit'); };

  /* ── Derived lists ── */
  const classes = useMemo(() => [...new Set(students.map(s => s.class_name).filter(Boolean))].sort(), [students]);

  const filtered = useMemo(() => {
    let list = students.filter(s => {
      const q = search.toLowerCase();
      const matchQ = !q || s.username.includes(q) || (s.display_name || '').toLowerCase().includes(q) || (s.class_name || '').toLowerCase().includes(q);
      const matchC = !filterClass || s.class_name === filterClass;
      const matchS = !filterStatus || (filterStatus === 'active' ? s.is_active : !s.is_active);
      return matchQ && matchC && matchS;
    });
    if (sortBy === 'name') {
      list = [...list].sort((a, b) => (a.display_name || a.username).localeCompare(b.display_name || b.username, 'vi'));
    } else if (sortBy === 'class') {
      list = [...list].sort((a, b) => (a.class_name || '').localeCompare(b.class_name || '', 'vi'));
    }
    return list;
  }, [students, search, filterClass, filterStatus, sortBy]);

  // ── Colors ──
  const bord = dark ? 'rgba(255,100,150,0.10)' : 'rgba(244,114,182,0.14)';
  const cardShadow = dark ? '0 4px 16px rgba(0,0,0,0.35)' : '0 4px 16px rgba(216,120,170,0.10)';
  const card = dark ? 'rgba(38,16,24,0.97)' : '#fff';
  const tMain = dark ? '#F0DCE8' : '#3D1830';
  const tSub = dark ? '#8A6080' : '#A07090';
  const inBg = dark ? 'rgba(255,255,255,0.05)' : 'rgba(255,240,248,0.7)';
  const inBgF = dark ? 'rgba(255,255,255,0.08)' : '#fff';

  const inputSt = {width:'100%', padding:'7px 14px', border:`1.5px solid ${bord}`, borderRadius:12, fontSize:13, fontWeight:700, color:tMain, background:inBg, outline:'none', fontFamily:"'Nunito',sans-serif", transition:'all .2s'};
  const labelSt = {display:'block', fontSize:10, fontWeight:900, color:tSub, letterSpacing:.8, textTransform:'uppercase', marginBottom:4};
  const btnPrimary = {padding:'10px 18px', borderRadius:999, border:'none', background:'linear-gradient(135deg,#F472B6,#A855F7)', color:'#fff', fontSize:13, fontWeight:900, fontFamily:"'Nunito',sans-serif", cursor:'pointer', boxShadow:'0 3px 14px rgba(168,85,247,0.28)', transition:'all .2s', display:'flex', alignItems:'center', gap:5};
  const btnGhost = {padding:'9px 16px', borderRadius:999, border:`1.5px solid ${bord}`, background:'transparent', color:tSub, fontSize:13, fontWeight:800, fontFamily:"'Nunito',sans-serif", cursor:'pointer', transition:'all .2s'};
  const selSt = {padding:'5px 10px', border:`1.5px solid ${bord}`, borderRadius:10, fontSize:12, fontWeight:700, color:tMain, background:inBg, outline:'none', fontFamily:"'Nunito',sans-serif", cursor:'pointer'};
  // hover/press dùng chung cho các nút inline-style trong file này — nhấc nhẹ khi hover, thu nhỏ khi bấm
  const liftHover = e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.filter='brightness(1.06)';};
  const liftLeave = e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.filter='none';};
  const pressDown = e=>e.currentTarget.style.transform='scale(0.95)';
  const pressUp   = e=>e.currentTarget.style.transform='translateY(-1px)';

  const active = students.filter(s => s.is_active).length;
  const locked = students.length - active;

  return (
    <div style={{padding:'14px 12px 100px'}}>

      {/* ══ STATS BAR ══ */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:7, marginBottom:14}}>
        {[
          {label:'Tổng', val:students.length, color:'#A855F7'},
          {label:'Hoạt động', val:active, color:'#10B981'},
          {label:'Khoá', val:locked, color:'#EF4444'},
          {label:'Lớp', val:classes.length, color:'#F472B6'},
        ].map(({label, val, color}) => (
          <div key={label} style={{background:card, border:`1px solid ${bord}`, borderRadius:22, padding:'12px 8px', textAlign:'center', boxShadow:cardShadow}}>
            <div style={{fontSize:20, fontWeight:900, color, lineHeight:1}}>{val}</div>
            <div style={{fontSize:10, fontWeight:800, color:tSub, marginTop:3, letterSpacing:.5}}>{label.toUpperCase()}</div>
          </div>
        ))}
      </div>

      {/* ── Header row ── */}
      <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:20}}>
        <div style={{flex:1, fontSize:15, fontWeight:900, color:tMain}}>Tài khoản học sinh</div>

        {/* Nút mini: trạng thái server — bấm để bung panel chi tiết */}
        <button onClick={() => setStatusOpen(v => !v)} title="Trạng thái hệ thống" style={{
          width:32, height:32, borderRadius:10, border:`1.5px solid ${srvStatus === 'online' ? 'rgba(16,185,129,0.3)' : srvStatus === 'offline' ? 'rgba(239,68,68,0.3)' : bord}`,
          background: statusOpen ? (srvStatus === 'online' ? '#10B981' : srvStatus === 'offline' ? '#EF4444' : '#A0A0AA') : (srvStatus === 'online' ? 'rgba(16,185,129,0.1)' : srvStatus === 'offline' ? 'rgba(239,68,68,0.1)' : 'rgba(160,160,170,0.1)'),
          cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', flexShrink:0, transition:'all .2s',
        }} onMouseEnter={liftHover} onMouseLeave={liftLeave} onMouseDown={pressDown} onMouseUp={pressUp}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={statusOpen ? '#fff' : (srvStatus === 'online' ? '#059669' : srvStatus === 'offline' ? '#EF4444' : '#A0A0AA')} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="7" rx="1.6"/><rect x="2" y="13" width="20" height="7" rx="1.6"/><circle cx="6.5" cy="7.5" r="1" fill={statusOpen ? '#fff' : (srvStatus === 'online' ? '#059669' : srvStatus === 'offline' ? '#EF4444' : '#A0A0AA')}/><circle cx="6.5" cy="16.5" r="1" fill={statusOpen ? '#fff' : (srvStatus === 'online' ? '#059669' : srvStatus === 'offline' ? '#EF4444' : '#A0A0AA')}/>
          </svg>
          {srvStatus === 'online' && !statusOpen && (
            <span style={{position:'absolute', top:-2, right:-2, width:7, height:7, borderRadius:99, background:'#10B981', border:`1.5px solid ${dark ? '#1a0a12' : '#fff'}`}} />
          )}
        </button>

        <button onClick={() => exportCSV(filtered)} title="Xuất CSV" style={{...btnGhost, width:32, height:32, padding:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(168,85,247,0.1)', border:'1.5px solid rgba(168,85,247,0.2)', color:'#A855F7', flexShrink:0}}
          onMouseEnter={liftHover} onMouseLeave={liftLeave} onMouseDown={pressDown} onMouseUp={pressUp}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
        <button onClick={() => { setBulkMode(b => !b); setBulkSelected(new Set()); }} title="Chọn nhiều" style={{
          ...btnGhost, width: bulkMode ? 'auto' : 32, height:32, padding: bulkMode ? '0 10px' : 0, display:'flex', alignItems:'center', justifyContent:'center', gap:4, fontSize:12,
          background:'rgba(168,85,247,0.1)', border:'1.5px solid rgba(168,85,247,0.2)', color:'#A855F7', flexShrink:0,
          ...(bulkMode ? {background:'#A855F7', border:'1.5px solid #A855F7', color:'#fff'} : {}),
        }} onMouseEnter={liftHover} onMouseLeave={liftLeave} onMouseDown={pressDown} onMouseUp={pressUp}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          {bulkMode && `${bulkSelected.size} chọn`}
        </button>
        <button onClick={openAdd} style={btnPrimary} onMouseEnter={liftHover} onMouseLeave={liftLeave} onMouseDown={pressDown} onMouseUp={pressUp}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Thêm
        </button>
      </div>

      {/* ══ PANEL TRẠNG THÁI HỆ THỐNG — bung ra khi bấm nút mini ══ */}
      {statusOpen && (
        <div style={{
          background:card, border:`1.5px solid ${bord}`, borderRadius:22, padding:14, marginBottom:16,
          boxShadow:cardShadow, animation:'slideIn .22s ease both',
        }}>
          {/* 4 chỉ số nhanh */}
          <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginBottom:12}}>
            <div style={{textAlign:'center', padding:'8px 4px', borderRadius:12, background: srvStatus === 'online' ? 'rgba(16,185,129,0.1)' : srvStatus === 'offline' ? 'rgba(239,68,68,0.1)' : 'rgba(160,160,170,0.1)'}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={srvStatus === 'online' ? '#059669' : srvStatus === 'offline' ? '#EF4444' : '#A0A0AA'} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{margin:'0 auto 3px', display:'block'}}><rect x="2" y="4" width="20" height="7" rx="1.6"/><rect x="2" y="13" width="20" height="7" rx="1.6"/></svg>
              <div style={{fontSize:11, fontWeight:900, color: srvStatus === 'online' ? '#059669' : srvStatus === 'offline' ? '#EF4444' : tSub}}>{srvStatus === 'online' ? 'Online' : srvStatus === 'offline' ? 'Offline' : '...'}</div>
            </div>
            <div style={{textAlign:'center', padding:'8px 4px', borderRadius:12, background:dark?'rgba(255,255,255,0.05)':'rgba(255,240,248,0.6)'}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tSub} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{margin:'0 auto 3px', display:'block'}}><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/></svg>
              <div style={{fontSize:11, fontWeight:900, color:tMain}}>{pingMs != null ? `${pingMs}ms` : '—'}</div>
            </div>
            <div style={{textAlign:'center', padding:'8px 4px', borderRadius:12, background: saving ? 'rgba(168,85,247,0.1)' : 'rgba(16,185,129,0.08)'}}>
              {saving
                ? <span className="spin" style={{display:'inline-flex', margin:'0 auto 3px'}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A855F7" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg></span>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{margin:'0 auto 3px', display:'block'}}><path d="M20 6L9 17l-5-5"/></svg>}
              <div style={{fontSize:11, fontWeight:900, color: saving ? '#A855F7' : '#059669'}}>{saving ? 'Đang lưu' : 'Đã lưu'}</div>
            </div>
            <div style={{textAlign:'center', padding:'8px 4px', borderRadius:12, background:dark?'rgba(255,255,255,0.05)':'rgba(255,240,248,0.6)'}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tSub} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{margin:'0 auto 3px', display:'block'}}><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>
              <div style={{fontSize:11, fontWeight:900, color:tMain, fontVariantNumeric:'tabular-nums'}}>{nowUTC7 || '--:--:--'}</div>
            </div>
          </div>

          {/* Chi tiết kết nối */}
          <div style={{display:'flex', flexDirection:'column', gap:6, padding:'10px 12px', borderRadius:12, background:dark?'rgba(255,255,255,0.03)':'rgba(255,240,248,0.4)', marginBottom:12, fontSize:11.5}}>
            <div style={{display:'flex', justifyContent:'space-between'}}><span style={{color:tSub, fontWeight:700}}>Backend</span><span style={{color:tMain, fontWeight:800}}>Supabase (PostgREST)</span></div>
            <div style={{display:'flex', justifyContent:'space-between'}}><span style={{color:tSub, fontWeight:700}}>Bảng đang theo dõi</span><span style={{color:tMain, fontWeight:800}}>students</span></div>
            <div style={{display:'flex', justifyContent:'space-between'}}><span style={{color:tSub, fontWeight:700}}>Số học sinh tải được</span><span style={{color:tMain, fontWeight:800}}>{students.length}</span></div>
            <div style={{display:'flex', justifyContent:'space-between'}}><span style={{color:tSub, fontWeight:700}}>Ping gần nhất</span><span style={{color:tMain, fontWeight:800}}>{lastPingAtRef.current ? new Date(lastPingAtRef.current).toLocaleTimeString('vi-VN') : '—'}</span></div>
            <div style={{display:'flex', justifyContent:'space-between'}}><span style={{color:tSub, fontWeight:700}}>Tự ping mỗi</span><span style={{color:tMain, fontWeight:800}}>1 giờ</span></div>
          </div>

          {/* Log hoạt động gần đây */}
          <div>
            <div style={{fontSize:10, fontWeight:900, color:tSub, letterSpacing:.6, textTransform:'uppercase', marginBottom:6, display:'flex', alignItems:'center', gap:4}}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={tSub} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-6"/></svg>
              Hoạt động gần đây
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:4, maxHeight:180, overflowY:'auto'}}>
              {activityLog.length === 0 ? (
                <div style={{fontSize:11.5, color:tSub, padding:'8px 0', textAlign:'center'}}>Chưa có hoạt động nào</div>
              ) : activityLog.map((item, i) => {
                const iconColor = item.type === 'error' ? '#EF4444' : item.type === 'insert' ? '#A855F7' : item.type === 'delete' ? '#EF4444' : item.type === 'update' ? '#F59E0B' : item.type === 'fn' ? '#F472B6' : item.type === 'ping' ? tSub : '#059669';
                return (
                  <div key={item.ts + '-' + i} style={{display:'flex', alignItems:'center', gap:7, fontSize:11, padding:'5px 2px'}}>
                    <span style={{width:6, height:6, borderRadius:99, background:iconColor, flexShrink:0}} />
                    <span style={{flex:1, color:tMain, fontWeight:700}}>{item.msg}</span>
                    <span style={{color:tSub, fontWeight:700, flexShrink:0, fontVariantNumeric:'tabular-nums'}}>
                      {new Date(item.ts).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit', second:'2-digit'})}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk actions bar ── */}
      {bulkMode && bulkSelected.size > 0 && (
        <div style={{display:'flex', gap:7, marginBottom:10, padding:'10px 12px', background:dark?'rgba(168,85,247,0.12)':'rgba(168,85,247,0.07)', border:`1.5px solid rgba(168,85,247,0.25)`, borderRadius:18, alignItems:'center'}}>
          <span style={{fontSize:12, fontWeight:800, color:'#A855F7', flex:1}}>Đã chọn {bulkSelected.size}</span>
          <button onClick={() => doBulkToggle(true)} style={{fontSize:11, fontWeight:800, padding:'6px 10px', borderRadius:8, border:'none', background:'rgba(16,185,129,0.15)', color:'#10B981', cursor:'pointer', fontFamily:"'Nunito',sans-serif", transition:'all .15s'}}
            onMouseEnter={liftHover} onMouseLeave={liftLeave} onMouseDown={pressDown} onMouseUp={pressUp}>Mở khoá</button>
          <button onClick={() => doBulkToggle(false)} style={{fontSize:11, fontWeight:800, padding:'6px 10px', borderRadius:8, border:'none', background:'rgba(239,68,68,0.1)', color:'#EF4444', cursor:'pointer', fontFamily:"'Nunito',sans-serif", transition:'all .15s'}}
            onMouseEnter={liftHover} onMouseLeave={liftLeave} onMouseDown={pressDown} onMouseUp={pressUp}>Khoá</button>
          <button onClick={() => setConfirmDel('bulk')} style={{fontSize:11, fontWeight:800, padding:'6px 10px', borderRadius:8, border:'none', background:'rgba(239,68,68,0.15)', color:'#EF4444', cursor:'pointer', fontFamily:"'Nunito',sans-serif", transition:'all .15s'}}
            onMouseEnter={liftHover} onMouseLeave={liftLeave} onMouseDown={pressDown} onMouseUp={pressUp}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:'middle', marginRight:3}}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            Xoá {bulkSelected.size}
          </button>
        </div>
      )}

      {/* ── Search + Filters ── */}
      <div style={{display:'flex', flexDirection:'column', gap:7, marginBottom:12}}>
        <div style={{position:'relative'}}>
          <svg style={{position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none'}} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tSub} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm username, tên, lớp..."
            style={{...inputSt, paddingLeft:36}}
            onFocus={e => { e.target.style.borderColor = '#F472B6'; e.target.style.background = inBgF; }}
            onBlur={e => { e.target.style.borderColor = bord; e.target.style.background = inBg; }} />
          {search && <button onClick={() => setSearch('')} aria-label="Xoá tìm kiếm" style={{position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:tSub, fontSize:16, lineHeight:1, transition:'color .15s'}}
            onMouseEnter={e=>e.currentTarget.style.color='#F472B6'} onMouseLeave={e=>e.currentTarget.style.color=tSub}>×</button>}
        </div>
        <div style={{display:'flex', gap:7}}>
          <select value={filterClass} onChange={e => setFilterClass(e.target.value)} style={{...selSt, flex:1}}>
            <option value=''>Tất cả lớp</option>
            {classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{...selSt, flex:1}}>
            <option value=''>Tất cả trạng thái</option>
            <option value='active'>Hoạt động</option>
            <option value='locked'>Khoá</option>
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{...selSt, flex:1}}>
            <option value='newest'>Mới nhất</option>
            <option value='name'>Tên A→Z</option>
            <option value='class'>Lớp</option>
          </select>
        </div>
      </div>

      {/* ── Student list ── */}
      {loading ? (
        <div style={{textAlign:'center', padding:40, color:tSub, fontSize:13, fontWeight:700}}>
          <span className="spin" style={{display:'inline-flex', marginBottom:8}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C?.rose || '#FF6B95'} strokeWidth="2.5" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          </span>
          <div>Đang tải...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{textAlign:'center', padding:40, color:tSub}}>
          <div style={{fontSize:32, marginBottom:8}}>👩‍🎓</div>
          <div style={{fontSize:13, fontWeight:700}}>{search || filterClass || filterStatus ? 'Không tìm thấy' : 'Chưa có tài khoản nào'}</div>
          {!(search || filterClass || filterStatus) && <div style={{fontSize:12, marginTop:4}}>Nhấn "+ Thêm" để tạo tài khoản đầu tiên</div>}
          {(search || filterClass || filterStatus) && <button onClick={() => { setSearch(''); setFilterClass(''); setFilterStatus(''); }} style={{marginTop:10, fontSize:12, fontWeight:700, color:'#F472B6', background:'none', border:'none', cursor:'pointer', textDecoration:'underline', transition:'opacity .15s'}}
            onMouseEnter={e=>e.currentTarget.style.opacity='0.7'} onMouseLeave={e=>e.currentTarget.style.opacity='1'}>Xoá bộ lọc</button>}
        </div>
      ) : (
        <div style={{display:'flex', flexDirection:'column', gap:7}}>
          {filtered.map(s => {
            const isBulkSel = bulkSelected.has(s.id);
            return (
            <div key={s.id} style={{
              background:card,
              border:`1px solid ${isBulkSel ? '#A855F7' : bord}`,
              borderRadius:20, padding:'12px 14px', display:'flex', alignItems:'center', gap:10,
              boxShadow:isBulkSel ? '0 0 0 3px rgba(168,85,247,0.15)' : cardShadow,
              opacity:s.is_active ? 1 : 0.55, transition:'all .2s',
            }}>
              {/* Bulk checkbox */}
              {bulkMode && (
                <div onClick={() => setBulkSelected(prev => { const n = new Set(prev); isBulkSel ? n.delete(s.id) : n.add(s.id); return n; })}
                  style={{width:20, height:20, borderRadius:6, border:`2px solid ${isBulkSel ? '#A855F7' : bord}`, background:isBulkSel ? '#A855F7' : 'transparent', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', transition:'all .18s'}}>
                  {isBulkSel && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
              )}

              {/* Avatar */}
              <div title="Click để đổi ảnh đại diện"
                onClick={() => { if (bulkMode) return; setAvatarTargetId(s.id); avatarInputRef.current?.click(); }}
                style={{width:40, height:40, borderRadius:13, flexShrink:0, background:'linear-gradient(135deg,#F472B6,#A855F7)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:900, color:'#fff', cursor:bulkMode ? 'default' : 'pointer', position:'relative', overflow:'hidden', border: avatarUrls[s.id] ? '2px solid #fff' : 'none', boxShadow: avatarUrls[s.id] ? '0 2px 8px rgba(168,85,247,0.3)' : '0 2px 8px rgba(168,85,247,0.22)', transition:'box-shadow .2s'}}
                onMouseEnter={e => { if (!bulkMode) { const o = e.currentTarget.querySelector('.av-overlay'); if (o) o.style.opacity = 1; }}}
                onMouseLeave={e => { const o = e.currentTarget.querySelector('.av-overlay'); if (o) o.style.opacity = 0; }}>
                {avatarUrls[s.id]
                  ? <img src={avatarUrls[s.id]} alt="" loading="lazy" decoding="async" style={{width:'100%', height:'100%', objectFit:'cover', borderRadius:13, display:'block'}} onError={() => { localStorage.removeItem('ls_avatar_' + s.id); setAvatarUrls(p => { const n = {...p}; delete n[s.id]; return n; }); loadAvatar(s.id); }} />
                  : avatarUploading === s.id
                    ? <span className="spin" style={{display:'inline-flex'}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg></span>
                    : <span style={{userSelect:'none'}}>{(s.display_name || s.username).charAt(0).toUpperCase()}</span>
                }
                <div className="av-overlay" style={{position:'absolute', inset:0, borderRadius:13, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', opacity:0, transition:'opacity .18s', pointerEvents:'none'}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </div>
              </div>

              {/* Info — double click để inline edit */}
              <div style={{flex:1, minWidth:0}}>
                {editingCell?.id === s.id && editingCell.field === 'display_name' ? (
                  <input ref={editRef} value={editVal} onChange={e => setEditVal(e.target.value)}
                    onBlur={commitInlineEdit}
                    onKeyDown={e => { if (e.key === 'Enter') commitInlineEdit(); if (e.key === 'Escape') setEditingCell(null); }}
                    style={{...inputSt, padding:'3px 7px', fontSize:13, fontWeight:900, width:'100%', borderRadius:7, marginBottom:2}} />
                ) : (
                  <div onDoubleClick={() => { if (bulkMode) return; setEditingCell({id:s.id, field:'display_name'}); setEditVal(s.display_name || s.username); }}
                    title="Double-click để đổi tên"
                    style={{fontSize:13, fontWeight:900, color:tMain, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', cursor:'text'}}>
                    {s.display_name || s.username}
                  </div>
                )}
                <div style={{fontSize:11, color:tSub, fontWeight:600, marginTop:1, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap'}}>
                  <span>@{s.username}</span>
                  {editingCell?.id === s.id && editingCell.field === 'class_name' ? (
                    <input ref={editRef} value={editVal} onChange={e => setEditVal(e.target.value)}
                      onBlur={commitInlineEdit}
                      onKeyDown={e => { if (e.key === 'Enter') commitInlineEdit(); if (e.key === 'Escape') setEditingCell(null); }}
                      style={{...inputSt, padding:'2px 6px', fontSize:11, fontWeight:700, width:70, borderRadius:6}} />
                  ) : s.class_name ? (
                    <span onDoubleClick={() => { if (bulkMode) return; setEditingCell({id:s.id, field:'class_name'}); setEditVal(s.class_name || ''); }}
                      title="Double-click để đổi lớp"
                      style={{cursor:'text', background:dark ? 'rgba(168,85,247,0.13)' : 'rgba(168,85,247,0.08)', borderRadius:6, padding:'1px 6px', color:'#A855F7', fontWeight:800}}>
                      {s.class_name}
                    </span>
                  ) : null}
                  {!s.is_active && <span style={{color:'#EF4444', fontSize:10, fontWeight:900, background:'rgba(239,68,68,0.1)', borderRadius:99, padding:'1px 6px'}}>Khoá</span>}
                  {s.created_at && <span style={{opacity:.5, fontSize:10}}>{new Date(s.created_at).toLocaleDateString('vi-VN')}</span>}
                </div>
                {plainPassView[s.id] && (
                  <div style={{marginTop:4, display:'flex', alignItems:'center', gap:5, background:'rgba(244,114,182,0.08)', border:'1px solid rgba(244,114,182,0.2)', borderRadius:8, padding:'3px 8px', fontSize:11, fontWeight:800, color: C?.rose || '#FF6B95'}}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    {plainPassView[s.id]}
                    <button onClick={() => { navigator.clipboard?.writeText(plainPassView[s.id]); showToast('Đã copy!', 'success'); }} aria-label="Copy mật khẩu" style={{background:'none', border:'none', cursor:'pointer', color: C?.lav || '#A855F7', padding:'0 2px', display:'flex', alignItems:'center', transition:'transform .15s'}}
                      onMouseEnter={e=>e.currentTarget.style.transform='scale(1.2)'} onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    </button>
                    <button onClick={() => setPlainPassView(p => { const n = {...p}; delete n[s.id]; return n; })} aria-label="Ẩn mật khẩu" style={{background:'none', border:'none', cursor:'pointer', color:tSub, padding:'0 2px', fontSize:12, lineHeight:1, marginLeft:'auto', transition:'color .15s'}}
                      onMouseEnter={e=>e.currentTarget.style.color='#EF4444'} onMouseLeave={e=>e.currentTarget.style.color=tSub}>×</button>
                  </div>
                )}
              </div>

              {/* Actions */}
              {!bulkMode && (
              <div style={{display:'flex', gap:5, flexShrink:0}}>
                <button title="Sửa thông tin" onClick={() => openEdit(s)}
                  style={{width:30, height:30, borderRadius:9, border:'1.5px solid rgba(168,85,247,0.28)', background:'rgba(168,85,247,0.08)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#A855F7', transition:'all .2s'}}
                  onMouseEnter={liftHover} onMouseLeave={liftLeave} onMouseDown={pressDown} onMouseUp={pressUp}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button title="Đặt lại mật khẩu" onClick={() => {
                  if (typeof window.showConfirm === 'function') {
                    window.showConfirm({iconType:'key', title:'Đặt lại mật khẩu?', message:'Tài khoản <b>@' + s.username + '</b><br/>Mật khẩu mới sẽ được tạo tự động theo định dạng Google.', confirmLabel:'Đặt lại', confirmColor:'#A855F7', onConfirm: () => doResetPass(s)});
                  } else { if (window.confirm('Đặt lại mật khẩu cho @' + s.username + '?')) doResetPass(s); }
                }} style={{width:30, height:30, borderRadius:9, border:`1.5px solid ${dark ? 'rgba(160,160,170,0.3)' : '#E2E2E8'}`, background:dark ? 'rgba(160,160,170,0.08)' : 'rgba(160,160,170,0.1)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:tSub, transition:'all .2s'}}
                  onMouseEnter={liftHover} onMouseLeave={liftLeave} onMouseDown={pressDown} onMouseUp={pressUp}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                </button>
                <button title={s.is_active ? 'Khoá tài khoản' : 'Mở khoá'} onClick={() => doToggle(s)}
                  style={{width:30, height:30, borderRadius:9, border:`1.5px solid ${s.is_active ? 'rgba(245,158,11,0.32)' : 'rgba(16,185,129,0.4)'}`, background:s.is_active ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.16)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:s.is_active ? '#F59E0B' : '#059669', transition:'all .2s'}}
                  onMouseEnter={liftHover} onMouseLeave={liftLeave} onMouseDown={pressDown} onMouseUp={pressUp}>
                  {s.is_active
                    ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0"/></svg>}
                </button>
                <button title="Xoá" onClick={() => setConfirmDel(s)}
                  style={{width:30, height:30, borderRadius:9, border:'1.5px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.08)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#EF4444', transition:'all .2s'}}
                  onMouseEnter={e=>{e.currentTarget.style.background='rgba(239,68,68,0.2)';e.currentTarget.style.transform='translateY(-1px)';}}
                  onMouseLeave={e=>{e.currentTarget.style.background='rgba(239,68,68,0.08)';e.currentTarget.style.transform='translateY(0)';}}
                  onMouseDown={pressDown} onMouseUp={pressUp}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>
              </div>
              )}
            </div>
          );})}
        </div>
      )}

      {/* ══ MODAL ADD ══ */}
      {modal === 'add' && (
        <div style={{position:'fixed', inset:0, zIndex:9000, display:'flex', alignItems:'flex-end', justifyContent:'center', background:dark?'rgba(12,4,18,0.88)':'rgba(255,240,248,0.82)', backdropFilter:'blur(18px)'}}>
          <div style={{background:card, border:`1.5px solid ${bord}`, borderRadius:'24px 24px 0 0', padding:'20px 20px 36px', width:'100%', maxWidth:480, boxShadow:'0 -8px 40px rgba(168,85,247,0.15)', animation:'slideIn .3s ease both'}}>
            <div style={{width:36, height:4, borderRadius:99, background:bord, margin:'0 auto 18px'}} />
            <div style={{fontSize:16, fontWeight:900, color:tMain, marginBottom:16, display:'flex', alignItems:'center', gap:7}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C?.rose || '#FF6B95'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
              Tạo tài khoản học sinh
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:10}}>
              <div>
                <label style={labelSt}>Username <span style={{color:'#EF4444'}}>*</span></label>
                <input value={fUser} onChange={e => setFUser(e.target.value.replace(/\s/g, ''))} placeholder="vd: nguyenvana" style={inputSt}
                  onFocus={e => { e.target.style.borderColor = '#F472B6'; e.target.style.background = inBgF; }}
                  onBlur={e => { e.target.style.borderColor = bord; e.target.style.background = inBg; }} />
              </div>
              <div>
                <label style={labelSt}>Tên hiển thị</label>
                <input value={fName} onChange={e => setFName(e.target.value)} placeholder="vd: Nguyễn Văn A" style={inputSt}
                  onFocus={e => { e.target.style.borderColor = '#F472B6'; e.target.style.background = inBgF; }}
                  onBlur={e => { e.target.style.borderColor = bord; e.target.style.background = inBg; }} />
              </div>
              <div>
                <label style={labelSt}>Lớp</label>
                <input value={fClass} onChange={e => setFClass(e.target.value)} placeholder="vd: 11A7" style={inputSt}
                  onFocus={e => { e.target.style.borderColor = '#F472B6'; e.target.style.background = inBgF; }}
                  onBlur={e => { e.target.style.borderColor = bord; e.target.style.background = inBg; }}
                  list="class-datalist" />
                <datalist id="class-datalist">{classes.map(c => <option key={c} value={c} />)}</datalist>
              </div>
              <div>
                <label style={labelSt}>Mật khẩu <span style={{color:tSub, fontWeight:600, textTransform:'none', letterSpacing:0}}>(để trống = tự sinh)</span></label>
                <div style={{position:'relative'}}>
                  <input value={fPass} onChange={e => setFPass(e.target.value)} type={fShow ? 'text' : 'password'} placeholder="Mật khẩu..." style={{...inputSt, paddingRight:80}}
                    onFocus={e => { e.target.style.borderColor = '#F472B6'; e.target.style.background = inBgF; }}
                    onBlur={e => { e.target.style.borderColor = bord; e.target.style.background = inBg; }} />
                  <div style={{position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', display:'flex', gap:4}}>
                    <button onClick={() => setFShow(s => !s)} tabIndex={-1} aria-label={fShow ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} style={{background:'none', border:'none', cursor:'pointer', padding:4, color:tSub, display:'flex', alignItems:'center', transition:'color .15s'}}
                      onMouseEnter={e=>e.currentTarget.style.color='#A855F7'} onMouseLeave={e=>e.currentTarget.style.color=tSub}>
                      {fShow ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                    </button>
                    <button onClick={() => setFPass(genPass())} tabIndex={-1} title="Tạo mật khẩu ngẫu nhiên" aria-label="Tạo mật khẩu ngẫu nhiên"
                      style={{background:'none', border:'none', cursor:'pointer', padding:4, color: C?.lav || '#A855F7', display:'flex', alignItems:'center', transition:'transform .15s'}}
                      onMouseEnter={e=>e.currentTarget.style.transform='rotate(-25deg) scale(1.15)'} onMouseLeave={e=>e.currentTarget.style.transform='rotate(0deg) scale(1)'}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                    </button>
                  </div>
                </div>
                <div style={{fontSize:10, color:tSub, marginTop:4, fontWeight:600}}>🔒 Mã hoá bcrypt+pepper (cost 12) — admin không thể đọc lại</div>
              </div>
            </div>
            <div style={{display:'flex', gap:8, marginTop:18}}>
              <button onClick={() => { setModal(null); resetForm(); }} style={{...btnGhost, flex:1}}
                onMouseEnter={e=>{e.currentTarget.style.background=inBg;e.currentTarget.style.transform='translateY(-1px)';}}
                onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.transform='translateY(0)';}}
                onMouseDown={pressDown} onMouseUp={e=>e.currentTarget.style.transform='translateY(-1px)'}>Huỷ</button>
              <button onClick={doAdd} disabled={saving} style={{...btnPrimary, flex:2, justifyContent:'center'}}
                onMouseEnter={e=>{if(!saving){e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 5px 20px rgba(168,85,247,0.4)';}}}
                onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 3px 14px rgba(168,85,247,0.28)';}}
                onMouseDown={e=>{if(!saving)e.currentTarget.style.transform='scale(0.97)';}}
                onMouseUp={e=>{if(!saving)e.currentTarget.style.transform='translateY(-1px)';}}>
                {saving ? <><span className="spin" style={{display:'inline-flex'}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg></span>Đang lưu...</> : <>Tạo tài khoản ✨</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL EDIT ══ */}
      {modal === 'edit' && selected && (
        <div style={{position:'fixed', inset:0, zIndex:9000, display:'flex', alignItems:'flex-end', justifyContent:'center', background:dark?'rgba(12,4,18,0.88)':'rgba(255,240,248,0.82)', backdropFilter:'blur(18px)'}}>
          <div style={{background:card, border:`1.5px solid ${bord}`, borderRadius:'24px 24px 0 0', padding:'20px 20px 36px', width:'100%', maxWidth:480, boxShadow:'0 -8px 40px rgba(168,85,247,0.15)', animation:'slideIn .3s ease both'}}>
            <div style={{width:36, height:4, borderRadius:99, background:bord, margin:'0 auto 18px'}} />
            <div style={{display:'flex', alignItems:'center', gap:14, marginBottom:18}}>
              <div onClick={() => { setAvatarTargetId(selected.id); avatarInputRef.current?.click(); }}
                style={{width:56, height:56, borderRadius:17, background:'linear-gradient(135deg,#F472B6,#A855F7)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:900, color:'#fff', cursor:'pointer', position:'relative', overflow:'hidden', flexShrink:0, boxShadow:'0 4px 16px rgba(168,85,247,0.3)'}}>
                {avatarUrls[selected.id]
                  ? <img src={avatarUrls[selected.id]} alt="" style={{width:'100%', height:'100%', objectFit:'cover'}} onError={() => { localStorage.removeItem('ls_avatar_' + selected.id); setAvatarUrls(p => { const n = {...p}; delete n[selected.id]; return n; }); loadAvatar(selected.id); }} />
                  : <span>{(selected.display_name || selected.username).charAt(0).toUpperCase()}</span>}
                <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', opacity:0, transition:'opacity .18s'}}
                  onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </div>
              </div>
              <div>
                <div style={{fontSize:16, fontWeight:900, color:tMain}}>Sửa thông tin</div>
                <div style={{fontSize:12, color:tSub, marginTop:2}}>@{selected.username}</div>
              </div>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:10}}>
              <div>
                <label style={labelSt}>Tên hiển thị</label>
                <input value={fName} onChange={e => setFName(e.target.value)} placeholder="Tên hiển thị" style={inputSt}
                  onFocus={e => { e.target.style.borderColor = '#F472B6'; e.target.style.background = inBgF; }}
                  onBlur={e => { e.target.style.borderColor = bord; e.target.style.background = inBg; }} />
              </div>
              <div>
                <label style={labelSt}>Lớp</label>
                <input value={fClass} onChange={e => setFClass(e.target.value)} placeholder="vd: 11A7" style={inputSt}
                  onFocus={e => { e.target.style.borderColor = '#F472B6'; e.target.style.background = inBgF; }}
                  onBlur={e => { e.target.style.borderColor = bord; e.target.style.background = inBg; }}
                  list="class-datalist" />
              </div>
            </div>
            <div style={{display:'flex', gap:8, marginTop:18}}>
              <button onClick={() => { setModal(null); setSelected(null); resetForm(); }} style={{...btnGhost, flex:1}}
                onMouseEnter={e=>{e.currentTarget.style.background=inBg;e.currentTarget.style.transform='translateY(-1px)';}}
                onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.transform='translateY(0)';}}
                onMouseDown={pressDown} onMouseUp={e=>e.currentTarget.style.transform='translateY(-1px)'}>Huỷ</button>
              <button onClick={doEdit} disabled={saving} style={{...btnPrimary, flex:2, justifyContent:'center'}}
                onMouseEnter={e=>{if(!saving){e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 5px 20px rgba(168,85,247,0.4)';}}}
                onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 3px 14px rgba(168,85,247,0.28)';}}
                onMouseDown={e=>{if(!saving)e.currentTarget.style.transform='scale(0.97)';}}
                onMouseUp={e=>{if(!saving)e.currentTarget.style.transform='translateY(-1px)';}}>
                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL VIEW — sau khi tạo ══ */}
      {modal === 'view' && selected && (
        <div onClick={() => { setModal(null); setSelected(null); }} style={{position:'fixed', inset:0, zIndex:9000, display:'flex', alignItems:'flex-end', justifyContent:'center', background:dark?'rgba(12,4,18,0.88)':'rgba(255,240,248,0.82)', backdropFilter:'blur(18px)'}}>
          <div onClick={e => e.stopPropagation()} style={{background:card, border:`1.5px solid ${bord}`, borderRadius:'24px 24px 0 0', padding:'20px 20px 36px', width:'100%', maxWidth:480, boxShadow:'0 -8px 40px rgba(168,85,247,0.15)', animation:'slideIn .3s ease both'}}>
            <div style={{width:36, height:4, borderRadius:99, background:bord, margin:'0 auto 18px'}} />
            <div style={{textAlign:'center', marginBottom:16}}>
              <div style={{fontSize:32, marginBottom:6}}>🎉</div>
              <div style={{fontSize:16, fontWeight:900, color:tMain}}>Đã tạo tài khoản!</div>
              <div style={{fontSize:12, color:tSub, marginTop:2}}>Lưu lại mật khẩu — sẽ không hiện lại sau khi đóng</div>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:10, marginBottom:8}}>
              <div>
                <label style={labelSt}>Tài khoản</label>
                <div style={{...inputSt, display:'flex', alignItems:'center', gap:6}}>
                  <span>@{selected.username}</span>
                  {selected.display_name && <span style={{color:tSub, fontWeight:600}}>· {selected.display_name}</span>}
                  {selected.class_name && <span style={{color:tSub, fontWeight:600}}>· {selected.class_name}</span>}
                </div>
              </div>
              <div>
                <label style={labelSt}>Mật khẩu</label>
                <div style={{position:'relative'}}>
                  <div style={{...inputSt, paddingRight:44, color: C?.rose || '#FF6B95', fontWeight:900, letterSpacing:.5}}>
                    {selected._plainPass || '(đã đặt riêng, không hiển thị)'}
                  </div>
                  {selected._plainPass && (
                    <button onClick={() => { navigator.clipboard?.writeText(selected._plainPass); showToast('Đã copy mật khẩu!', 'success'); }}
                      title="Copy" aria-label="Copy mật khẩu" style={{position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', padding:4, color: C?.lav || '#A855F7', display:'flex', alignItems:'center', transition:'transform .15s'}}
                      onMouseEnter={e=>e.currentTarget.style.transform='translateY(-50%) scale(1.2)'} onMouseLeave={e=>e.currentTarget.style.transform='translateY(-50%) scale(1)'}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
            <button onClick={() => { setModal(null); setSelected(null); }} style={{...btnPrimary, width:'100%', justifyContent:'center', marginTop:8}}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 5px 20px rgba(168,85,247,0.4)';}}
              onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 3px 14px rgba(168,85,247,0.28)';}}
              onMouseDown={pressDown} onMouseUp={e=>e.currentTarget.style.transform='translateY(-1px)'}>Đã lưu, đóng lại</button>
          </div>
        </div>
      )}

      {/* ══ HIDDEN FILE INPUT ══ */}
      <input ref={avatarInputRef} type="file" accept="image/*" capture="user" style={{display:'none'}}
        onChange={async e => {
          const file = e.target.files[0];
          e.target.value = '';
          if (file && avatarTargetId) await doUploadAvatar(file, avatarTargetId);
          setAvatarTargetId(null);
        }} />

      {/* ══ CONFIRM DELETE (single) ══ */}
      {confirmDel && confirmDel !== 'bulk' && (
        <div style={{position:'fixed', inset:0, zIndex:9100, display:'flex', alignItems:'center', justifyContent:'center', padding:20, background:'rgba(10,2,25,0.85)', backdropFilter:'blur(16px)'}}>
          <div style={{background:card, border:`1.5px solid rgba(239,68,68,0.3)`, borderRadius:28, padding:'24px 20px', maxWidth:300, width:'100%', textAlign:'center', animation:'pop .22s ease both'}}>
            <div style={{fontSize:32, marginBottom:10}}>🗑️</div>
            <div style={{fontSize:15, fontWeight:900, color:tMain, marginBottom:6}}>Xoá tài khoản?</div>
            <div style={{fontSize:12, color:tSub, marginBottom:18}}><b>@{confirmDel.username}</b> · {confirmDel.display_name}<br/>Hành động này không thể hoàn tác.</div>
            <div style={{display:'flex', gap:8}}>
              <button onClick={() => setConfirmDel(null)} style={{...btnGhost, flex:1}}
                onMouseEnter={e=>e.currentTarget.style.background=inBg} onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                onMouseDown={pressDown} onMouseUp={e=>e.currentTarget.style.transform='translateY(0)'}>Huỷ</button>
              <button onClick={() => doDelete(confirmDel.id)} disabled={saving} style={{flex:1, padding:'10px', borderRadius:999, border:'none', background:'linear-gradient(135deg,#EF4444,#DC2626)', color:'#fff', fontSize:13, fontWeight:900, fontFamily:"'Nunito',sans-serif", cursor:'pointer', transition:'all .15s'}}
                onMouseEnter={e=>{if(!saving){e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 4px 16px rgba(239,68,68,0.4)';}}}
                onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';}}
                onMouseDown={e=>{if(!saving)e.currentTarget.style.transform='scale(0.96)';}}
                onMouseUp={e=>{if(!saving)e.currentTarget.style.transform='translateY(-1px)';}}>Xoá</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ CONFIRM BULK DELETE ══ */}
      {confirmDel === 'bulk' && (
        <div style={{position:'fixed', inset:0, zIndex:9100, display:'flex', alignItems:'center', justifyContent:'center', padding:20, background:'rgba(10,2,25,0.85)', backdropFilter:'blur(16px)'}}>
          <div style={{background:card, border:`1.5px solid rgba(239,68,68,0.3)`, borderRadius:28, padding:'24px 20px', maxWidth:300, width:'100%', textAlign:'center', animation:'pop .22s ease both'}}>
            <div style={{fontSize:32, marginBottom:10}}>🗑️</div>
            <div style={{fontSize:15, fontWeight:900, color:tMain, marginBottom:6}}>Xoá {bulkSelected.size} tài khoản?</div>
            <div style={{fontSize:12, color:tSub, marginBottom:18}}>Toàn bộ lịch sử bài làm và ảnh đại diện sẽ bị xóa vĩnh viễn.</div>
            <div style={{display:'flex', gap:8}}>
              <button onClick={() => setConfirmDel(null)} style={{...btnGhost, flex:1}}
                onMouseEnter={e=>e.currentTarget.style.background=inBg} onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                onMouseDown={pressDown} onMouseUp={e=>e.currentTarget.style.transform='translateY(0)'}>Huỷ</button>
              <button onClick={doBulkDelete} disabled={saving} style={{flex:1, padding:'10px', borderRadius:999, border:'none', background:'linear-gradient(135deg,#EF4444,#DC2626)', color:'#fff', fontSize:13, fontWeight:900, fontFamily:"'Nunito',sans-serif", cursor:'pointer', transition:'all .15s'}}
                onMouseEnter={e=>{if(!saving){e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 4px 16px rgba(239,68,68,0.4)';}}}
                onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';}}
                onMouseDown={e=>{if(!saving)e.currentTarget.style.transform='scale(0.96)';}}
                onMouseUp={e=>{if(!saving)e.currentTarget.style.transform='translateY(-1px)';}}>{saving ? 'Đang xoá...' : 'Xoá tất cả'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

window.StudentManager = StudentManager;
})();