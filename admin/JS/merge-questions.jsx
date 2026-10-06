import React, { useState, useEffect, useMemo, useCallback } from 'react';

/* ── helper functions ────────────────────────────────────── */
const stripHTML = (s) => (s || '').replace(/<[^>]*>/g, '');

const getQPreview = (q) => {
  switch (q.type) {
    case 'true_false': return stripHTML(q.passage) || '(Đúng/Sai)';
    case 'multiple':
    case 'multi_select': return stripHTML(q.question) || '(Trắc nghiệm)';
    case 'fill_blank': return stripHTML(q.question) || '(Điền chỗ trống)';
    default: return '(Câu hỏi)';
  }
};

const typeLabel = (t) => ({ true_false: 'ĐS', multiple: 'TN', multi_select: 'CN', fill_blank: 'ĐT' }[t] || '?');
const typeBadgeClass = (t) => ({
  true_false: 'mq-badge mq-badge-ds',
  multiple: 'mq-badge mq-badge-tn',
  multi_select: 'mq-badge mq-badge-tn',
  fill_blank: 'mq-badge mq-badge-dt'
}[t] || 'mq-badge');

/* ── SVG icons (có thể tách file) ────────────────────────── */
const CheckIcon = () => (
  <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ChevronIcon = ({ open }) => (
  <svg width={14} height={14} viewBox="0 0 20 20" fill="currentColor" className={`mq-chevron${open ? ' open' : ''}`}>
    <path d="M5 7l5 5 5-5H5z" />
  </svg>
);

const XIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
    <line x1={18} y1={6} x2={6} y2={18} />
    <line x1={6} y1={6} x2={18} y2={18} />
  </svg>
);

const MergeIcon = ({ size = 18, color = '#A855F7' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h4" />
    <path d="M16 7h4a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-4" />
    <path d="M8 12h8" />
    <path d="M12 7v10" />
    <circle cx={8} cy={12} r={2} fill={color} stroke="none" />
    <circle cx={16} cy={12} r={2} fill={color} stroke="none" />
  </svg>
);

/* ── LessonRow component ──────────────────────────────────── */
const LessonRow = ({ lesson, selected, onToggleQ, onSelectAll, expanded, onToggleExpand }) => {
  const questions = lesson.questions || [];
  const selectedCount = questions.filter(q => selected.has(q.id)).length;
  const allSelected = questions.length > 0 && selectedCount === questions.length;

  const tfCount = questions.filter(q => q.type === 'true_false').length;
  const tnCount = questions.filter(q => q.type === 'multiple' || q.type === 'multi_select').length;
  const dtCount = questions.filter(q => q.type === 'fill_blank').length;

  return (
    <div className={`mq-lesson-row${expanded ? ' expanded' : ''}`}>
      {/* header */}
      <div className="mq-lesson-header" onClick={onToggleExpand}>
        <div className="mq-lesson-icon">
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#A855F7" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            <line x1={9} y1={9} x2={15} y2={9} />
            <line x1={9} y1={13} x2={13} y2={13} />
          </svg>
        </div>

        <div className="mq-lesson-info">
          <div className="mq-lesson-name">{lesson.title || 'Chưa đặt tên'}</div>
          <div className="mq-lesson-meta">
            <span>{lesson.subject || 'Tiếng Anh'}</span>
            <span className="mq-lesson-meta-dot">•</span>
            <span>{questions.length} câu</span>
            {tfCount > 0 && <span className="mq-badge mq-badge-ds">{tfCount} ĐS</span>}
            {tnCount > 0 && <span className="mq-badge mq-badge-tn">{tnCount} TN</span>}
            {dtCount > 0 && <span className="mq-badge mq-badge-dt">{dtCount} ĐT</span>}
          </div>
        </div>

        {selectedCount > 0 && (
          <span style={{ fontSize:11, fontWeight:900, color:'#fff', background:'#A855F7', padding:'2px 9px', borderRadius:999, flexShrink:0 }}>
            +{selectedCount}
          </span>
        )}

        <button
          className={`mq-select-all-btn${allSelected ? ' all-selected' : ''}`}
          onClick={(e) => { e.stopPropagation(); onSelectAll(lesson, !allSelected); }}
        >
          <span className="mq-switch" />
          {allSelected ? 'Đã chọn tất' : 'Chọn tất'}
        </button>

        <ChevronIcon open={expanded} />
      </div>

      {/* question list */}
      {expanded && questions.length > 0 && (
        <div className="mq-q-list">
          {questions.map((q, qi) => {
            const isSel = selected.has(q.id);
            return (
              <div key={q.id || qi} className={`mq-q-row${isSel ? ' selected' : ''}`} onClick={() => onToggleQ(q)}>
                <div className="mq-q-check">{isSel && <CheckIcon />}</div>
                <span className={typeBadgeClass(q.type)}>{typeLabel(q.type)}</span>
                <span className="mq-q-text">{getQPreview(q)}</span>
              </div>
            );
          })}
        </div>
      )}
      {expanded && questions.length === 0 && <div className="mq-empty">Bộ này chưa có câu hỏi nào.</div>}
    </div>
  );
};

/* ══ Main Modal ═════════════════════════════════════════════ */
const MergeQuestionsModal = ({ lessons, currentLessonId, onClose, onMerge, dark }) => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [expanded, setExpanded] = useState(new Set());
  const [qMap, setQMap] = useState({});
  const [merging, setMerging] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Bộ lọc loại câu hỏi (mảng rỗng = hiện tất cả)
  const [typeFilters, setTypeFilters] = useState([]); // ['true_false', 'multiple', ...]

  const toast = (msg, type = 'error', ms = 3500) => {
    (window.showDiToast || window.showToast)?.(msg, type, ms);
  };

  useEffect(() => {
    const map = {};
    lessons.forEach(l => (l.questions || []).forEach(q => { map[q.id] = q; }));
    setQMap(map);
  }, [lessons]);

  // Lọc bài & câu hỏi theo search + type filters
  const filteredLessons = useMemo(() => {
    const query = search.trim().toLowerCase();
    return lessons
      .filter(l => l.id !== currentLessonId && l.questions?.length > 0)
      .map(l => {
        // Lọc câu hỏi theo loại nếu có filter
        let filteredQs = l.questions || [];
        if (typeFilters.length > 0) {
          filteredQs = filteredQs.filter(q => typeFilters.includes(q.type));
        }
        // Nếu có search text, lọc theo tiêu đề bài hoặc nội dung câu hỏi
        if (query) {
          const matchLesson = (l.title || '').toLowerCase().includes(query) ||
                              (l.subject || '').toLowerCase().includes(query);
          if (matchLesson) return { ...l, questions: filteredQs }; // giữ lại để xem toàn bộ câu sau khi lọc type
          filteredQs = filteredQs.filter(q => getQPreview(q).toLowerCase().includes(query));
        }
        return { ...l, questions: filteredQs };
      })
      .filter(l => l.questions.length > 0); // chỉ giữ bài còn ít nhất 1 câu sau lọc
  }, [lessons, currentLessonId, search, typeFilters]);

  const totalAvailable = useMemo(
    () => filteredLessons.reduce((sum, l) => sum + l.questions.length, 0),
    [filteredLessons]
  );

  const toggleQ = useCallback((q) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(q.id) ? next.delete(q.id) : next.add(q.id);
      return next;
    });
  }, []);

  const selectAll = useCallback((lesson, shouldSelect) => {
    setSelected(prev => {
      const next = new Set(prev);
      (lesson.questions || []).forEach(q => {
        shouldSelect ? next.add(q.id) : next.delete(q.id);
      });
      return next;
    });
  }, []);

  const toggleExpand = useCallback((lessonId) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(lessonId) ? next.delete(lessonId) : next.add(lessonId);
      return next;
    });
  }, []);

  // Hàm bỏ chọn 1 câu từ preview
  const removeFromSelected = useCallback((qId) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.delete(qId);
      return next;
    });
  }, []);

  const doMerge = useCallback(async () => {
    if (selected.size === 0 || merging) return;
    setMerging(true);
    setConfirming(false);
    const toAdd = [];
    lessons.forEach(l => {
      (l.questions || []).forEach(q => {
        if (selected.has(q.id)) {
          toAdd.push({ ...q, id: 'mq' + Date.now() + Math.random() });
        }
      });
    });
    let mergeError = null;
    try {
      await onMerge(toAdd);
    } catch (e) {
      mergeError = e;
    }
    if (mergeError) {
      console.warn('merge questions:', mergeError);
      toast('Gộp câu hỏi thất bại, thử lại nhé!', 'error', 3500);
      setMerging(false);
      return;
    }
    onClose();
  }, [selected, lessons, onMerge, onClose, merging]);

  const askConfirm = useCallback(() => {
    if (selected.size === 0 || merging) return;
    setConfirming(true);
  }, [selected, merging]);

  const cancelConfirm = useCallback(() => setConfirming(false), []);

  // Toggle type filter
  const toggleTypeFilter = (type) => {
    setTypeFilters(prev => {
      if (prev.includes(type)) return prev.filter(t => t !== type);
      return [...prev, type];
    });
  };

  // Danh sách câu đã chọn (để hiển thị preview)
  const selectedQuestions = useMemo(() => {
    const result = [];
    lessons.forEach(l => (l.questions || []).forEach(q => {
      if (selected.has(q.id)) result.push(q);
    }));
    return result;
  }, [lessons, selected]);

  return (
    <div className="mq-overlay" onClick={merging || confirming ? undefined : onClose}>
      <div className={`mq-sheet${dark ? ' mq-dark' : ''}`} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="mq-header">
          <div className="mq-header-icon">
            <MergeIcon size={20} color="#A855F7" />
          </div>
          <div style={{ flex:1 }}>
            <div className="mq-title" style={{ color: dark ? '#F0DCE8' : '#3D1830' }}>
              Gộp câu hỏi từ bài khác
            </div>
            <div className="mq-subtitle" style={{ fontSize:11.5, color: dark ? '#8A6080' : '#A07090', marginTop:3, fontWeight:600 }}>
              Chọn câu hỏi từ các bộ đề khác để thêm vào bài đang soạn
            </div>
          </div>
          <button
            className="mq-close-btn"
            onClick={merging || confirming ? undefined : onClose}
            disabled={merging || confirming}
            style={{ color: dark ? '#8A6080' : '#A07090', opacity: merging || confirming ? 0.5 : 1, cursor: merging || confirming ? 'not-allowed' : 'pointer' }}
            aria-label="Đóng"
          >
            <XIcon size={14} />
          </button>
        </div>

        {/* Search + Type filters */}
        <div className="mq-search-wrap">
          <div className="mq-search-inner">
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#C8A0B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx={11} cy={11} r={8} />
              <line x1={21} y1={21} x2={16.65} y2={16.65} />
            </svg>
            <input
              className="mq-search-input"
              placeholder="Tìm bài hoặc câu hỏi..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ color: dark ? '#F0DCE8' : '#3D1830' }}
            />
            {search && (
              <button onClick={() => setSearch('')}
                style={{ background:'none', border:'none', cursor:'pointer', color:'#C8A0B8', padding:2, borderRadius:999, display:'flex', alignItems:'center', transition:'color .15s,background .15s,transform .15s' }}
                onMouseEnter={e=>{e.currentTarget.style.color='#A855F7';e.currentTarget.style.background='rgba(168,85,247,.1)';}}
                onMouseLeave={e=>{e.currentTarget.style.color='#C8A0B8';e.currentTarget.style.background='none';}}
                onMouseDown={e=>e.currentTarget.style.transform='scale(0.85)'}
                onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}
                aria-label="Xoá tìm kiếm">
                <XIcon size={13} />
              </button>
            )}
          </div>

          {/* Bộ lọc loại câu hỏi */}
          <div className="mq-filter-bar">
            {[
              { type: 'true_false', label: 'Đúng/Sai' },
              { type: 'multiple', label: 'Trắc nghiệm' },
              { type: 'multi_select', label: 'Chọn nhiều' },
              { type: 'fill_blank', label: 'Điền từ' }
            ].map(({ type, label }) => {
              const active = typeFilters.length === 0 || typeFilters.includes(type);
              return (
                <button
                  key={type}
                  className={`mq-filter-chip${typeFilters.includes(type) ? ' active' : ''}`}
                  onClick={() => toggleTypeFilter(type)}
                  style={{ opacity: active ? 1 : 0.5 }}
                >
                  {typeLabel(type)} {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Lesson list */}
        <div className="mq-lesson-list">
          {filteredLessons.length === 0 ? (
            <div className="mq-empty" style={{ color: dark ? '#503040' : '#C8A0B8' }}>
              {search || typeFilters.length > 0 ? 'Không tìm thấy bài nào phù hợp.' : 'Không có bài nào khác để gộp.'}
            </div>
          ) : (
            filteredLessons.map(l => (
              <LessonRow
                key={l.id}
                lesson={l}
                selected={selected}
                expanded={expanded.has(l.id)}
                onToggleExpand={() => toggleExpand(l.id)}
                onToggleQ={toggleQ}
                onSelectAll={selectAll}
              />
            ))
          )}
          <div style={{ height: 8, flexShrink: 0 }} />
        </div>

        {/* Selected questions preview bar */}
        {selectedQuestions.length > 0 && (
          <div className="mq-selected-preview">
            <span className="mq-selected-count">Đã chọn {selected.size} câu</span>
            <div className="mq-selected-chips">
              {selectedQuestions.map(q => (
                <div key={q.id} className="mq-selected-chip" title={getQPreview(q)}>
                  <span className={typeBadgeClass(q.type)}>{typeLabel(q.type)}</span>
                  <span className="mq-selected-chip-text">{getQPreview(q)}</span>
                  <button className="mq-selected-remove" onClick={() => removeFromSelected(q.id)} aria-label="Bỏ chọn">
                    <XIcon size={10} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mq-footer" style={{ position:'relative' }}>
          {!confirming ? (
            <>
              <div className="mq-counter" style={{ color: dark ? '#C898B8' : '#6B3050' }}>
                {selected.size === 0 ? (
                  <span style={{ fontSize:13, color: dark ? '#503040' : '#C8A0B8', fontWeight:700 }}>Đã chọn 0/{totalAvailable} câu</span>
                ) : (
                  <span>Đã chọn <span>{selected.size}</span>/{totalAvailable} câu</span>
                )}
              </div>
              <button className="mq-cancel-btn" onClick={merging ? undefined : onClose} disabled={merging} style={{ color: dark ? '#C898B8' : '#6B3050', borderColor: dark ? '#421526' : '#F5D5E8', opacity: merging ? 0.5 : 1, cursor: merging ? 'not-allowed' : 'pointer' }}>Huỷ</button>
              <button className="mq-merge-btn" disabled={selected.size === 0 || merging} onClick={askConfirm} style={{ opacity: merging ? 0.75 : 1, cursor: (selected.size === 0 || merging) ? 'not-allowed' : 'pointer' }}>
                {merging ? (
                  <span style={{ width:13, height:13, border:'2px solid rgba(255,255,255,.4)', borderTopColor:'#fff', borderRadius:'50%', display:'inline-block', animation:'bb-spin .6s linear infinite' }} />
                ) : (
                  <MergeIcon size={14} color="#fff" />
                )}
                {merging ? 'Đang gộp...' : `Gộp ${selected.size > 0 ? selected.size + ' câu' : ''}`}
              </button>
            </>
          ) : (
            <div style={{ display:'flex', alignItems:'center', gap:10, width:'100%' }}>
              <span style={{ flex:1, fontSize:12.5, fontWeight:800, color: dark ? '#F0DCE8' : '#3D1830' }}>
                Gộp {selected.size} câu vào bài đang soạn?
              </span>
              <button onClick={cancelConfirm} aria-label="Huỷ gộp"
                style={{ width:36, height:36, borderRadius:12, flexShrink:0, cursor:'pointer', border:`1.5px solid ${dark ? '#421526' : '#F5D5E8'}`, background: dark ? 'rgba(255,255,255,.04)' : '#fff', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .15s' }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor='#F472B6';e.currentTarget.style.background=dark?'rgba(244,114,182,.1)':'rgba(255,100,150,.07)';}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=dark?'#421526':'#F5D5E8';e.currentTarget.style.background=dark?'rgba(255,255,255,.04)':'#fff';}}
                onMouseDown={e=>e.currentTarget.style.transform='scale(0.9)'}
                onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}>
                <XIcon size={15} />
              </button>
              <button onClick={doMerge} aria-label="Xác nhận gộp"
                style={{ width:36, height:36, borderRadius:12, flexShrink:0, cursor:'pointer', border:'none', background:'linear-gradient(135deg,#A855F7,#7C3AED)', boxShadow:'0 2px 10px rgba(168,85,247,.4)', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .15s' }}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 4px 16px rgba(168,85,247,.55)';}}
                onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 2px 10px rgba(168,85,247,.4)';}}
                onMouseDown={e=>e.currentTarget.style.transform='scale(0.9)'}
                onMouseUp={e=>e.currentTarget.style.transform='translateY(-1px)'}>
                <CheckIcon />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MergeQuestionsModal;
window.MergeQuestionsModal = MergeQuestionsModal;
