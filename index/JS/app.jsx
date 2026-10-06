import React, { useState, useEffect, useRef, useCallback } from 'react'
import ReactDOM from 'react-dom/client'
import { loadSession, saveSession, clearSession, touchSession, startSessionWatcher, stopSessionWatcher, consumeExpiredFlag } from './session.js'

/* ══ APP.JS ══  Updated to use Dashboard */ 
;(function(){
const {useState,useEffect,useRef,useCallback,useMemo}=React;
const Dashboard=window.Dashboard;
const PwGate=window.PwGate;
const HistDetailModal=window.HistDetailModal;
// ★ Perf: QuizPlayer/ListeningPractice/VocabPractice/PracticeScreen không
// còn đọc thẳng từ window.X ở đây — 4 file này không còn eager-import
// trong main.jsx (xem giải thích ở đó). Dùng state + import() động bên
// dưới, chỉ tải khi màn hình tương ứng lần đầu được cần tới.

// ★ Perf: fallback nhẹ hiện trong lúc chờ import() động của 1 trong 4
// màn hình lớn (QuizPlayer/ListeningPractice/VocabPractice/PracticeScreen)
// tải xong — thường chỉ vài trăm ms trên mạng bình thường. Dùng @keyframes
// spin đã có sẵn ở index.html, không thêm animation mới.
function LazyScreenFallback({dark}){
  return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'60vh'}}>
      <div style={{
        width:34,height:34,borderRadius:'50%',
        border:`3px solid ${dark?'rgba(255,255,255,0.15)':'rgba(168,85,247,0.15)'}`,
        borderTopColor:dark?'#F472B6':'#A855F7',
        animation:'spin .7s linear infinite',
      }}/>
    </div>
  );
}

function App(){
  const [dark,setDark]=useState(()=>{
    if(window.__darkInit!==undefined)return window.__darkInit;
    try{
      var stored=localStorage.getItem('learnsy_dark');
      if(stored==='1')return true;
      if(stored==='0')return false;
    }catch(e){}
    return window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches;
  });
  const [screen,setScreen]=useState('dashboard');// 'dashboard'|'pw'|'playing'
  const [homeTab,setHomeTab]=useState('lessons');// 'lessons'|'listening' — tab giống bên admin
  const [lessons,setLessons]=useState([]);
  // Bài "Ôn tập riêng" (category='practice') được TÁCH RIÊNG khỏi danh sách
  // "Bài học" thường — không cho lẫn vào tab home, và chỉ hiện cho học sinh
  // khi is_published=true, y hệt cơ chế fetchLessons()/fetchPracticeLessons()
  // bên app Android (LessonRepository.kt).
  const [loading,setLoading]=useState(true);
  const [fetchError,setFetchError]=useState(false);
  const [currentLesson,setCurrentLesson]=useState(null);
  const [pendingLesson,setPendingLesson]=useState(null);
  // ★ Học vui / Học cấp tốc: {lesson,mode} + chế độ chờ mở khóa mật khẩu
  const [funSession,setFunSession]=useState(null);
  const [pendingMode,setPendingMode]=useState(null);
  // Lịch sử luôn theo TỪNG học sinh (khóa ls_student_hist_<id>), nạp sau khi
  // biết đang đăng nhập là ai — không dùng khóa chung nữa (trước đây học sinh
  // A đăng xuất, học sinh B đăng nhập trên cùng máy có thể thấy lịch sử của A).
  const [history,setHistory]=useState([]);
  const [historyLoading,setHistoryLoading]=useState(false);
  // Mở lại app sau >72h: loadSession() (chạy ở useState bên dưới) đã dọn phiên và ghi cờ;
  // nếu có cờ thì hiện thông báo để học sinh hiểu vì sao phải đăng nhập lại.
  const [sessionNotice,setSessionNotice]=useState('');
  const [histDetail,setHistDetail]=useState(null);
  const [shuffleQ,setShuffleQ]=useState(false);
  const [shuffleA,setShuffleA]=useState(false);

  // ── Student Auth ──
  // loadSession(): trả null nếu phiên đã quá 72h không hoạt động (và tự dọn sạch).
  const [student,setStudent]=useState(()=>loadSession());
  const [authChecked,setAuthChecked]=useState(false);

  // ── Lớp của học sinh (lấy từ bảng students, khớp với tab "Học sinh" bên admin) ──
  // Bài có target_classes = mảng → chỉ học sinh thuộc các lớp đó thấy; null/không có = tất cả học sinh.
  const [studentClass,setStudentClass]=useState(()=>String(student?.class_name||'').trim());
  useEffect(()=>{
    if(!student?.id&&!student?.username){setStudentClass('');return;}
    let alive=true;
    const load=async()=>{
      try{
        const q=student?.id
          ?window.supa.from('students').select('class_name').eq('id',student.id).maybeSingle()
          :window.supa.from('students').select('class_name').eq('username',student.username).maybeSingle();
        const{data,error}=await q;
        if(alive&&!error&&data)setStudentClass(String(data.class_name||'').trim());
      }catch(e){}
    };
    load();
    window.addEventListener('learnsy:student-saved',load);
    return()=>{alive=false;window.removeEventListener('learnsy:student-saved',load);};
  },[student?.id,student?.username]);
  const canSeeLesson=useCallback(l=>{
    if(!Array.isArray(l.target_classes))return true;
    const mine=studentClass.toLowerCase();
    return !!mine&&l.target_classes.some(c=>String(c||'').trim().toLowerCase()===mine);
  },[studentClass]);
  // Bài "Ôn tập riêng" (category='practice') tách riêng khỏi "Bài học" thường, chỉ hiện khi is_published=true
  const normalLessons=useMemo(()=>lessons.filter(l=>l.category!=='practice'&&canSeeLesson(l)),[lessons,canSeeLesson]);
  const practiceLessons=useMemo(()=>lessons.filter(l=>l.category==='practice'&&l.is_published&&canSeeLesson(l)),[lessons,canSeeLesson]);
  useEffect(()=>{
    if(consumeExpiredFlag())setSessionNotice('Phiên đăng nhập đã hết hạn do 72 giờ không hoạt động. Vui lòng đăng nhập lại.');
  },[]);

  // ★ Perf: lazy-load 4 màn hình lớn (QuizPlayer, ListeningPractice,
  // VocabPractice, PracticeScreen) — chỉ import() khi thật sự cần, không
  // phải lúc app mount. Mỗi file tự gán window.X ở cuối module (side
  // effect của import), nên chỉ cần "đợi import xong" rồi đọc lại
  // window.X là có component, không cần đổi cách các file kia export.
  const [lazyReady,setLazyReady]=useState({
    QuizPlayer:window.QuizPlayer||null,
    ListeningPractice:window.ListeningPractice||null,
    VocabPractice:window.VocabPractice||null,
    PracticeScreen:window.PracticeScreen||null,
    FunStudy:window.FunStudy||null,
  });
  const loadingLazyRef=useRef({});
  const ensureLazy=useCallback((name,importer)=>{
    if(window[name]||loadingLazyRef.current[name])return;
    loadingLazyRef.current[name]=true;
    importer().then(()=>{
      setLazyReady(prev=>({...prev,[name]:window[name]||null}));
    }).catch(e=>{
      loadingLazyRef.current[name]=false;
      console.error(`[app] lazy-load ${name} thất bại:`,e);
    });
  },[]);

  const doStudentLogin=useCallback(async(username,password)=>{
    try{
      // /api/session: kiểm tra mật khẩu (qua Edge Function cũ) rồi cấp token ký 72h
      let data=null;
      try{
        const res=await fetch('/api/session',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({username,password}),
        });
        data=await res.json().catch(()=>null);
        // 429 = bị khóa tạm vì sai quá nhiều lần: hiện thông báo, KHÔNG rơi xuống đường cũ
        // (nếu rơi xuống Edge Function trực tiếp thì việc khóa vô nghĩa).
        if(res.status===429)return{ok:false,msg:(data&&data.msg)||'Sai quá nhiều lần, vui lòng thử lại sau.'};
        if(res.status===500||res.status===404)data=null; // chưa cấu hình → dùng đường cũ
      }catch{data=null;}

      if(data&&data.ok){
        saveSession(data.student,data.token);
        setSessionNotice('');
        setStudent(data.student);
        return{ok:true};
      }
      if(data&&data.ok===false)return{ok:false,msg:data.msg||'Đăng nhập thất bại!'};

      // Đường cũ (dự phòng khi /api/session chưa sẵn sàng): không có token
      const {data:d2,error}=await supa.functions.invoke('student-login',{body:{username,password}});
      if(error){console.error('[doStudentLogin] Edge Function error:',error);return{ok:false,msg:'Lỗi kết nối, thử lại nhé!'};}
      if(!d2?.ok)return{ok:false,msg:d2?.msg||'Đăng nhập thất bại!'};
      saveSession(d2.student,null);
      setSessionNotice('');
      setStudent(d2.student);
      return{ok:true};
    }catch(e){console.error('[doStudentLogin]',e);return{ok:false,msg:'Lỗi kết nối, thử lại nhé!'};}
  },[]);

  // Đăng xuất: dọn phiên + cache lịch sử của user này. KHÔNG xóa dữ liệu trên
  // server (lịch sử vẫn còn cho lần đăng nhập sau — đúng ý nghĩa "đăng xuất").
  const doStudentLogout=useCallback((reason)=>{
    const uid=(loadSession()||{}).id;
    clearSession();
    try{
      if(uid)localStorage.removeItem('ls_student_hist_'+uid);
      localStorage.removeItem('ls_student_hist'); // khóa chung đời cũ
    }catch{}
    setStudent(null);
    setHistory([]);
    setScreen('dashboard');
    setCurrentLesson(null);
    if(reason==='expired')setSessionNotice('Phiên đăng nhập đã hết hạn do 72 giờ không hoạt động. Vui lòng đăng nhập lại.');
    else if(reason==='deleted')setSessionNotice('Tài khoản này không còn tồn tại. Hãy liên hệ giáo viên.');
    else if(reason==='locked')setSessionNotice('Tài khoản đang bị khóa. Hãy liên hệ giáo viên.');
  },[]);

  // Server báo token hết hạn/không hợp lệ (401) → bắt đăng nhập lại
  useEffect(()=>{
    const onUnauth=()=>{
      if(!loadSession())return;
      doStudentLogout('expired');
    };
    window.addEventListener('learnsy:unauthorized',onUnauth);
    return()=>window.removeEventListener('learnsy:unauthorized',onUnauth);
  },[doStudentLogout]);

  // ── Theo dõi phiên: hết 72h không hoạt động → tự đăng xuất ──
  useEffect(()=>{
    if(!student)return;
    touchSession(true);
    const stop=startSessionWatcher((why)=>doStudentLogout(why==='other-tab'?'other-tab':'expired'));
    return()=>{stop();};
  },[student?.id,doStudentLogout]);

  useEffect(()=>setAuthChecked(true),[]);

  // ── Sync background settings ngay khi login/logout ──
  useEffect(()=>{
    if(typeof window.__setBgSyncId==='function'){
      window.__setBgSyncId(student?.id||null);
    }
  },[student?.id]);

  // ── Nạp lịch sử: cache local hiện ngay, server là nguồn sự thật ──
  // Quy tắc quan trọng: server trả DANH SÁCH RỖNG là thông tin hợp lệ (đã xóa
  // hết) → phải xóa cache theo. Chỉ khi LỖI mạng/server mới giữ nguyên cache.
  const refreshHistory=useCallback(async()=>{
    const uid=student?.id;
    if(!uid||typeof window.loadQuizHistory!=='function')return;
    const cacheKey='ls_student_hist_'+uid;
    setHistoryLoading(true);
    const res=await window.loadQuizHistory(uid);
    setHistoryLoading(false);
    if(!res.ok)return;                       // lỗi mạng → giữ cache, không ghi đè
    setHistory(res.rows);
    try{
      if(res.rows.length)localStorage.setItem(cacheKey,JSON.stringify(res.rows));
      else localStorage.removeItem(cacheKey); // server rỗng → cache cũng phải rỗng
    }catch{}
  },[student?.id]);

  useEffect(()=>{
    if(!student?.id){setHistory([]);return;}
    const cacheKey='ls_student_hist_'+student.id;
    try{
      const cached=JSON.parse(localStorage.getItem(cacheKey)||'[]');
      setHistory(Array.isArray(cached)?cached:[]);
    }catch{setHistory([]);}
    refreshHistory();
  },[student?.id,refreshHistory]);

  // Đồng bộ lại khi: quay lại tab, có mạng lại, hoặc hàng đợi offline vừa gửi xong
  useEffect(()=>{
    if(!student?.id)return;
    const onVis=()=>{if(document.visibilityState==='visible')refreshHistory();};
    const onSynced=()=>refreshHistory();
    document.addEventListener('visibilitychange',onVis);
    window.addEventListener('online',onSynced);
    window.addEventListener('learnsy:results-synced',onSynced);
    return()=>{
      document.removeEventListener('visibilitychange',onVis);
      window.removeEventListener('online',onSynced);
      window.removeEventListener('learnsy:results-synced',onSynced);
    };
  },[student?.id,refreshHistory]);

  C=dark?CD:CL;
  useEffect(()=>{
    document.body.classList.toggle('dark',dark);
    document.documentElement.classList.toggle('dark',dark);
    // Persist để pre-init script đọc đúng lần sau
    try{localStorage.setItem('learnsy_dark',dark?'1':'0');}catch(e){}
    // Đồng bộ lại background sau khi dark class thay đổi từ React
    if(typeof window.applyBackground==='function'&&typeof window.loadBgSettings==='function'){
      window.applyBackground(window.loadBgSettings(),dark);
    }
  },[dark]);

  // ── Fetch lessons: Upstash cache → Supabase (nguồn thật) ──
  // Đã bỏ bước gọi /api/lessons: endpoint đó KHÔNG tồn tại trong
  // functions/api (luôn 404) nên mỗi lần mở app chỉ tốn thêm 1 request thừa.
  useEffect(()=>{
    const mapRow=r=>({id:r.id,title:r.title||'',subject:r.subject||'Tiếng Anh',password:r.password||'',timerLimit:r.timerLimit||0,questions:r.questions||[],questionCount:(r.questions||[]).length,category:r.category||'normal',is_published:!!r.is_published,target_classes:Array.isArray(r.target_classes)?r.target_classes:null});
    let alive=true;
    (async()=>{
      try{
        const cached=await upstashCmd('GET',CACHE_KEY);
        if(cached){
          const data=JSON.parse(cached);
          if(Array.isArray(data)&&data.length){
            if(alive){setLessons(data.map(mapRow));setLoading(false);}
            return;
          }
        }
      }catch(e){}
      // Thử tối đa 3 lần (mạng di động hay chập chờn); ghi lại lý do lỗi để hiện lên màn hình
      let lastMsg='';
      for(let attempt=0;attempt<3&&alive;attempt++){
        try{
          const{data,error}=await supa.from('lessons').select('*').order('created_at');
          if(!alive)return;
          if(error){lastMsg=error.message||String(error.code||'lỗi không rõ');console.error('[lessons] tải lỗi (lần '+(attempt+1)+'):',error);}
          else if(!data?.length){lastMsg='Máy chủ trả về 0 bài (kiểm tra quyền đọc bảng lessons / RLS)';console.warn('[lessons] '+lastMsg);}
          else{
            setFetchError(false);
            setLessons(data.map(mapRow));
            try{upstashCmd('SET',CACHE_KEY,JSON.stringify(data),'EX',CACHE_TTL);}catch(e){}
            lastMsg='';
            break;
          }
        }catch(e){
          lastMsg=(e&&e.message)||'Mất kết nối';console.error('[lessons] ngoại lệ:',e);
        }
        if(attempt<2)await new Promise(r=>setTimeout(r,800*(attempt+1)));
      }
      if(alive&&lastMsg)setFetchError(lastMsg);
      if(alive)setLoading(false);
    })();
    return()=>{alive=false;};
  },[]);

  const playLesson=async(lessonMeta)=>{
    ensureLazy('QuizPlayer',()=>import('./components/quiz-player.jsx'));
    if(lessonMeta.password){setPendingLesson(lessonMeta);setScreen('pw');return;}
    await loadAndPlay(lessonMeta);
  };

  const startFun=(lessonMeta,mode)=>{
    setFunSession({lesson:lessonMeta,mode});
    setScreen('fun');
    trackEvent({event:'lesson_start',lessonId:lessonMeta.id,subject:lessonMeta.subject,mode});
  };
  const playLessonMode=(lessonMeta,mode)=>{
    ensureLazy('FunStudy',()=>import('./components/fun-study.jsx'));
    if(lessonMeta.password){setPendingMode(mode);setPendingLesson(lessonMeta);setScreen('pw');return;}
    startFun(lessonMeta,mode);
  };

  const loadAndPlay=async(lessonMeta)=>{
    try{
      const prepared={...applyShuffleToLesson(lessonMeta,shuffleQ,shuffleA),timeLimit:lessonMeta.timerLimit||lessonMeta.timeLimit||0};
      setCurrentLesson(prepared);
      setScreen('playing');
      trackEvent({event:'lesson_start',lessonId:lessonMeta.id,subject:lessonMeta.subject});
    }catch(e){alert('Không thể tải bài này. Vui lòng thử lại!');}
  };

  const onUnlockPw=async()=>{
    const pl=pendingLesson,pm=pendingMode;
    setPendingLesson(null);setPendingMode(null);setScreen('dashboard');
    if(pl&&pm){startFun(pl,pm);return;}
    if(pl)await loadAndPlay(pl);
  };

  // ── Lưu lịch sử: MỖI BÀI 1 DÒNG — làm lại thì ghi đè lần trước ──
  // Cùng 1 lần nộp (attemptId) không bị thêm 2 lần.
  const saveHistory=(rec)=>{
    const uid=student?.id;
    if(!uid)return;
    const entry={...rec,ts:rec.ts||new Date().toISOString()};
    trackEvent({event:'quiz_complete',lessonId:entry.lessonTitle,subject:entry.subject||'',score:entry.score,total:entry.total,pct:entry.pct});
    setHistory(prev=>{
      if(entry.attemptId&&prev.some(h=>h.attemptId===entry.attemptId))return prev;
      // Mỗi bài chỉ giữ 1 dòng: lần làm mới ĐÈ lên lần cũ của cùng bài (khớp theo ID bài, không có thì theo tên)
      const same=h=>entry.lessonId?String(h.lessonId)===String(entry.lessonId):(!!entry.lessonTitle&&h.lessonTitle===entry.lessonTitle);
      const updated=[entry,...prev.filter(h=>!same(h))].slice(0,200);
      try{localStorage.setItem('ls_student_hist_'+uid,JSON.stringify(updated));}catch{}
      return updated;
    });
    // Sau khi server lưu xong, kéo lại để có id thật (phục vụ xóa từng dòng)
    setTimeout(refreshHistory,1500);
  };

  // ── Xóa lịch sử: XÓA Ở SERVER trước, rồi mới xóa cache ──
  // Trước đây chỉ xóa localStorage nên lần tải sau lịch sử "hiện lại".
  // ids (tùy chọn): chỉ xóa các bản ghi này; bỏ trống = xóa toàn bộ.
  const clearHistory=async(ids)=>{
    const uid=student?.id;
    if(!uid)return{ok:false};
    const list=Array.isArray(ids)&&ids.length?ids.filter(x=>x!=null):null;
    const res=await window.deleteQuizHistory(uid,list);
    if(!res.ok){
      alert('Không xóa được lịch sử trên máy chủ. Kiểm tra mạng rồi thử lại nhé!');
      return{ok:false};
    }
    setHistory(prev=>{
      const next=list?prev.filter(h=>!list.includes(h.id)):[];
      try{
        if(next.length)localStorage.setItem('ls_student_hist_'+uid,JSON.stringify(next));
        else localStorage.removeItem('ls_student_hist_'+uid);
      }catch{}
      return next;
    });
    // Dọn cả hàng đợi offline của user này để bản chưa gửi không "hồi sinh"
    if(!list){
      try{
        const K='learnsy_pending_results_v2';
        const q=JSON.parse(localStorage.getItem(K)||'[]').filter(p=>p.studentId!==uid);
        if(q.length)localStorage.setItem(K,JSON.stringify(q));else localStorage.removeItem(K);
      }catch{}
    }
    return{ok:true,deleted:res.deleted};
  };

  if(!authChecked)return null;
  if(!student)return <StudentLoginScreen dark={dark} onLogin={doStudentLogin} notice={sessionNotice}/>;

  return(
    <>
      {screen==='pw'&&pendingLesson&&(
        <PwGate lesson={pendingLesson} dark={dark}
          onUnlock={onUnlockPw}
          onCancel={()=>{setPendingLesson(null);setPendingMode(null);setScreen('dashboard');}}/>
      )}
      {screen==='playing'&&currentLesson&&(()=>{
        const Comp=lazyReady.QuizPlayer;
        return Comp
          ? <Comp lesson={currentLesson} dark={dark} setDark={setDark}
              student={student}
              onBack={()=>setScreen('dashboard')}
              onSaveHistory={saveHistory}/>
          : <LazyScreenFallback dark={dark}/>;
      })()}
      {screen==='fun'&&funSession&&(()=>{
        const Comp=lazyReady.FunStudy;
        return Comp
          ? <Comp lesson={funSession.lesson} mode={funSession.mode} dark={dark} student={student}
              onBack={()=>{setScreen('dashboard');setFunSession(null);}}/>
          : <LazyScreenFallback dark={dark}/>;
      })()}
      {screen==='dashboard'&&(
        <>
          <div style={{display:homeTab==='lessons'?'block':'none'}}>
            <Dashboard
              student={student}
              lessons={normalLessons}
              loading={loading}
              fetchError={fetchError}
              history={history}
              historyLoading={historyLoading}
              onRefreshHistory={refreshHistory}
              dark={dark}
              setDark={setDark}
              onPlay={playLesson}
              onPlayMode={playLessonMode}
              onClearHistory={clearHistory}
              onHistDetail={setHistDetail}
              shuffleQ={shuffleQ} setShuffleQ={setShuffleQ}
              shuffleA={shuffleA} setShuffleA={setShuffleA}
              onLogout={(r)=>doStudentLogout(typeof r==='string'?r:undefined)}
              onGoListening={()=>{ensureLazy('ListeningPractice',()=>import('./components/listening-practice.jsx'));setHomeTab('listening');}}
              onGoVocab={()=>{ensureLazy('VocabPractice',()=>import('./components/vocab-practice.jsx'));setHomeTab('vocab');}}
              onGoPractice={practiceLessons.length?()=>{ensureLazy('PracticeScreen',()=>import('./components/practice-screen.jsx'));setHomeTab('practice');}:undefined}
              practiceCount={practiceLessons.length}
            />
          </div>
          {homeTab==='listening'&&(()=>{
            const Comp=lazyReady.ListeningPractice;
            return Comp ? <Comp dark={dark} onBack={()=>setHomeTab('lessons')}/> : <LazyScreenFallback dark={dark}/>;
          })()}
          {homeTab==='vocab'&&(()=>{
            const Comp=lazyReady.VocabPractice;
            return Comp ? <Comp dark={dark} student={student} onBack={()=>setHomeTab('lessons')}/> : <LazyScreenFallback dark={dark}/>;
          })()}
          {homeTab==='practice'&&(()=>{
            const Comp=lazyReady.PracticeScreen;
            return Comp ? <Comp dark={dark} lessons={practiceLessons} loading={loading} onPlay={playLesson} onBack={()=>setHomeTab('lessons')}/> : <LazyScreenFallback dark={dark}/>;
          })()}
        </>
      )}
      {histDetail&&<HistDetailModal h={histDetail} dark={dark} onClose={()=>setHistDetail(null)}/>}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
})();