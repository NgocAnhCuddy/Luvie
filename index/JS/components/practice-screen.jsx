/* ══ PRACTICE-SCREEN.JSX ══
   Tab ẩn "Ôn tập riêng" cho Student — chỉ được app.jsx render khi
   practiceLessons.length > 0 (xem index/JS/app.jsx: onGoPractice chỉ có
   giá trị khi có ít nhất 1 bài, và Dashboard/TabBar tự ẩn nút khi
   onGoPractice undefined).

   Tương đương TabPractice.kt bên app Android:
   - Card gradient hồng→tím pastel (khác card phẳng của bài học thường)
     để đánh dấu trực quan "khu vực đặc biệt"
   - Badge số bài cạnh tiêu đề, icon sparkle
   - Trạng thái rỗng: minh hoạ + text ấm áp thay vì icon khoá lạnh lùng

   Nguồn dữ liệu: lessons đã được app.jsx lọc sẵn
   (category==='practice' && is_published), nên component này không cần
   tự lọc lại — chỉ nhận và hiển thị.

   Props: dark, lessons, loading, onPlay, onBack
*/
import React, { useMemo } from 'react';
(function () {
  try {
    const { useMemo } = React;

    const IconSparkle = ({ size = 20, color = '#F472B6' }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
        <path d="M12 2l1.8 5.8L19.5 9.6l-5.7 1.8L12 17.2l-1.8-5.8L4.5 9.6l5.7-1.8z" />
      </svg>
    );
    const IconChevronRight = ({ size = 16, color }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    );
    const IconBack = ({ size = 11 }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    );
    // Minh hoạ "hộp trống" — dùng SVG thay vì ảnh mascot PNG (web không có
    // sẵn asset ảnh như app), giữ tinh thần ấm áp/dễ thương tương đương.
    const EmptyBoxIllustration = ({ size = 96 }) => (
      <svg width={size} height={size} viewBox="0 0 96 96" fill="none">
        <rect x="18" y="42" width="60" height="38" rx="6" fill="#F0E6FF" stroke="#C084FC" strokeWidth="2" />
        <path d="M18 48 L48 60 L78 48" stroke="#C084FC" strokeWidth="2" fill="none" />
        <path d="M18 42 L30 24 L66 24 L78 42 Z" fill="#FFE4ED" stroke="#F472B6" strokeWidth="2" />
        <line x1="48" y1="42" x2="48" y2="80" stroke="#C084FC" strokeWidth="1.5" opacity="0.5" />
        <circle cx="30" cy="16" r="3" fill="#FDE68A" />
        <circle cx="66" cy="14" r="2" fill="#FDE68A" />
        <circle cx="48" cy="10" r="2.4" fill="#FDE68A" />
      </svg>
    );

    function PracticeHeader({ count, dark }) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 4px 6px' }}>
          <span style={{ display: 'inline-flex', animation: 'ps-wiggle 2.4s ease-in-out infinite' }}>
            <IconSparkle size={20} />
          </span>
          <span style={{ fontSize: 17, fontWeight: 900, color: dark ? '#F2EAFF' : '#2D1245', fontFamily: "'Baloo 2',cursive" }}>
            Ôn tập riêng
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            minWidth: 22, height: 20, padding: '0 7px', borderRadius: 999,
            background: 'linear-gradient(135deg,#F472B6,#A855F7)', color: '#fff',
            fontSize: 12, fontWeight: 900, fontFamily: "'Baloo 2',cursive",
          }}>{count}</span>
        </div>
      );
    }

    function PracticeLessonCard({ lesson, dark, onClick, index }) {
      const bgGradient = dark
        ? 'linear-gradient(135deg,#3A1030,#2A1240)'
        : 'linear-gradient(135deg,#FDF0F7,#F6EEFC)';
      return (
        <div className="ripple-host ls-lesson-card" onClick={onClick}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
            background: bgGradient,
            border: `1.5px solid ${dark ? 'rgba(244,114,182,0.28)' : 'rgba(244,114,182,0.22)'}`,
            borderRadius: 18, padding: '11px 14px',
            boxShadow: dark ? '0 1px 2px rgba(0,0,0,0.18), 0 4px 12px rgba(244,114,182,0.1)' : '0 1px 2px rgba(120,40,90,0.04), 0 4px 12px rgba(244,114,182,0.12)',
            animation: `fadeUp .22s ease ${Math.min(index * 0.05, 0.3)}s both`,
          }}>
          <div className="ls-play-btn" style={{
            width: 48, height: 48, borderRadius: 20, flexShrink: 0,
            background: 'linear-gradient(135deg,#F472B6,#A855F7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 3px 10px rgba(244,114,182,0.35)',
          }}>
            <IconSparkle size={22} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 14, fontWeight: 900, color: dark ? '#F2EAFF' : '#2D1245',
              fontFamily: "'Baloo 2',cursive", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {lesson.title || 'Bài ôn tập'}
            </div>
            <div style={{ fontSize: 11, color: dark ? '#C898B8' : '#8060A0', marginTop: 2, fontWeight: 600 }}>
              {(lesson.subject || 'Tiếng Anh')} · {lesson.questionCount ?? (lesson.questions || []).length} câu
            </div>
          </div>
          <span style={{ flexShrink: 0, opacity: 0.7 }}><IconChevronRight color="#F472B6" /></span>
        </div>
      );
    }

    function EmptyPracticeState({ dark }) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 10, padding: '60px 20px 20px', textAlign: 'center',
        }}>
          <div style={{ animation: 'ps-float 2.4s ease-in-out infinite' }}>
            <EmptyBoxIllustration size={96} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 900, color: dark ? '#F2EAFF' : '#2D1245', fontFamily: "'Baloo 2',cursive" }}>
            Chưa có bài ôn tập nào
          </div>
          <div style={{ fontSize: 12.5, color: dark ? '#9B7FC0' : '#8060A0', fontWeight: 600 }}>
            Bài mới sẽ hiện ở đây khi có nhé~
          </div>
        </div>
      );
    }

    function PracticeScreen({ dark, lessons = [], loading, onPlay, onBack }) {
      const keyframes = (
        <style>{`
          @keyframes ps-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
          @keyframes ps-wiggle { 0%,100% { transform: rotate(-8deg); } 50% { transform: rotate(8deg); } }
        `}</style>
      );

      const headerBg = dark ? 'rgba(30,13,21,0.82)' : 'rgba(255,255,255,0.86)';
      const headerBorder = dark ? '#421526' : '#F5D5E8';
      const navBtnBg = dark ? 'rgba(255,150,200,0.07)' : 'rgba(255,107,149,0.06)';
      const navBtnBorder = dark ? 'rgba(255,150,200,0.28)' : 'rgba(255,107,149,0.28)';
      const navBtnText = dark ? '#FBAFCE' : '#E8547A';

      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          {keyframes}
          <div style={{
            padding: '11px 15px 10px', background: headerBg, borderBottom: `1.5px solid ${headerBorder}`,
            position: 'sticky', top: 0, zIndex: 60, backdropFilter: 'blur(20px) saturate(160%)', WebkitBackdropFilter: 'blur(20px) saturate(160%)',
            boxShadow: dark ? '0 1px 2px rgba(0,0,0,0.2), 0 6px 24px rgba(0,0,0,0.22)' : '0 1px 2px rgba(120,40,90,0.04), 0 6px 24px rgba(255,100,150,0.09)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={onBack} style={{
                padding: '6px 14px', borderRadius: 999, border: `1.5px solid ${navBtnBorder}`,
                background: navBtnBg, color: navBtnText, fontSize: 12, fontWeight: 800, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4, transition: 'all .2s cubic-bezier(.22,1,.36,1)',
              }}>
                <IconBack /> Quay lại
              </button>
              <div style={{ fontSize: 14, fontWeight: 900, color: dark ? '#F2EAFF' : '#2D1245', display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconSparkle size={15} /> Ôn tập
              </div>
              <div style={{ width: 70 }} />
            </div>
          </div>

          <div style={{ flex: 1, padding: '0 14px 100px' }}>
            {loading && lessons.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 0' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ height: 64, borderRadius: 18, background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(244,114,182,0.06)', opacity: 0.6 }} />
                ))}
              </div>
            ) : lessons.length === 0 ? (
              <EmptyPracticeState dark={dark} />
            ) : (
              <>
                <PracticeHeader count={lessons.length} dark={dark} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
                  {lessons.map((lesson, i) => (
                    <PracticeLessonCard key={lesson.id} lesson={lesson} dark={dark} index={i} onClick={() => onPlay(lesson)} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      );
    }

    window.PracticeScreen = PracticeScreen;
  } catch (e) {
    console.error('[practice-screen] INIT ERROR:', e);
  }
})();
