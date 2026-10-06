import React, {useState,useEffect,useRef,useCallback} from 'react';

(function(){
/* ══ PREVIEW PANEL v2 ══════════════════════════════════════════════════
   Nâng cấp: Timer đếm ngược, thống kê chi tiết, streak, progress bar
   ════════════════════════════════════════════════════════════════════ */

window.PreviewPanel=function PreviewPanel({title,questions,answers,setAnswers,submitted,setSubmitted,cur,setCur,modal,setModal,onBack,lessonTitle,onSaveHistory,timeLimit=0,dark}){
  const total=questions.length;
  const [feedback,setFeedback]=useState(null);
  const [confetti,setConfetti]=useState([]);
  const [warnModal,setWarnModal]=useState(null);
  const [timeLeft,setTimeLeft]=useState(timeLimit>0?timeLimit*60:null);
  const [streak,setStreak]=useState(0);
  const [bestStreak,setBestStreak]=useState(0);
  const [answerTimes,setAnswerTimes]=useState({});
  const [qStartTime,setQStartTime]=useState(Date.now());
  const [showStats,setShowStats]=useState(false);
  const timerRef=useRef(null);
  const LETTERS=['A','B','C','D','E','F'];

  // Timer countdown
  useEffect(()=>{
    if(timeLeft===null||submitted)return;
    if(timeLeft<=0){doSubmit();return;}
    timerRef.current=setTimeout(()=>setTimeLeft(t=>t-1),1000);
    return()=>clearTimeout(timerRef.current);
  },[timeLeft,submitted]);

  // Track time per question
  useEffect(()=>{setQStartTime(Date.now());},[cur]);

  const recordAnswerTime=useCallback(()=>{
    const elapsed=Math.round((Date.now()-qStartTime)/1000);
    setAnswerTimes(prev=>({...prev,[cur]:elapsed}));
  },[cur,qStartTime]);

  const fmtTime=s=>{
    const m=Math.floor(s/60),sec=s%60;
    return `${m}:${String(sec).padStart(2,'0')}`;
  };
  const timerColor=timeLeft===null?'#6EE7B7':timeLeft<60?'#EF4444':timeLeft<120?'#F59E0B':'#6EE7B7';

  /* Sounds */
  const _withTone=(fn)=>{try{if(typeof Tone==='undefined')return;Tone.start().then(fn).catch(()=>{});}catch(e){}};
  const playSound=(ok)=>{
    _withTone(()=>{
      try{
        if(ok){
          const synth=new Tone.PolySynth(Tone.Synth,{oscillator:{type:'triangle'},envelope:{attack:.01,decay:.18,sustain:.08,release:.25},volume:-10}).toDestination();
          const now=Tone.now();
          synth.triggerAttackRelease('C5',.28,now);synth.triggerAttackRelease('E5',.28,now+.11);synth.triggerAttackRelease('G5',.38,now+.22);
          setTimeout(()=>synth.dispose(),1200);
        }else{
          const synth=new Tone.Synth({oscillator:{type:'sawtooth'},envelope:{attack:.01,decay:.28,sustain:.04,release:.2},volume:-13}).toDestination();
          const now=Tone.now();
          synth.triggerAttackRelease('E4',.28,now);synth.triggerAttackRelease('C4',.38,now+.22);
          setTimeout(()=>synth.dispose(),1000);
        }
      }catch(e){}
    });
  };
  const playFanfare=()=>{_withTone(()=>{try{const synth=new Tone.PolySynth(Tone.Synth,{oscillator:{type:'sine'},envelope:{attack:.01,decay:.2,sustain:.1,release:.28},volume:-11}).toDestination();const now=Tone.now();[[['C5','E5'],0],[['E5','G5'],.12],[['G5','C6'],.24],[['C5','E5','G5','C6'],.38]].forEach(([ns,t])=>synth.triggerAttackRelease(ns,.28,now+t));setTimeout(()=>synth.dispose(),1800);}catch(e){}});};
  const playSad=()=>{_withTone(()=>{try{const synth=new Tone.PolySynth(Tone.Synth,{oscillator:{type:'triangle'},envelope:{attack:.02,decay:.3,sustain:.06,release:.3},volume:-13}).toDestination();const now=Tone.now();synth.triggerAttackRelease('G4',.32,now);synth.triggerAttackRelease('E4',.32,now+.22);synth.triggerAttackRelease('D4',.32,now+.46);synth.triggerAttackRelease('C4',.45,now+.72);setTimeout(()=>synth.dispose(),2000);}catch(e){}});};

  const spawnConfetti=()=>{
    const pieces=Array.from({length:36},(_,i)=>({id:i,x:Math.random()*100,delay:Math.random()*0.7,color:['#F472B6','#A855F7','#6EE7B7','#FCD34D','#FB923C','#60A5FA','#34D399','#F9A8D4'][i%8],size:5+Math.random()*8,rot:Math.random()*360}));
    setConfetti(pieces);setTimeout(()=>setConfetti([]),2400);
  };

  const calcScore=()=>{
    let s=0,t=0;
    questions.forEach((q,qi)=>{
      if(q.type==='true_false'){t+=q.items.length*0.25;s+=q.items.filter((it,ii)=>answers[qi]?.[ii]===it.answer).length*0.25;}
      else if(q.type==='multiple'){t+=1;if(answers[qi]===q.correct)s+=1;}
      else if(q.type==='multi_select'){t+=1;const a=answers[qi]||[];if(JSON.stringify([...a].sort())===JSON.stringify([...q.correct].sort()))s+=1;}
      else if(q.type==='fill_blank'){t+=1;if((answers[qi]||'').trim().toLowerCase()===q.answer.trim().toLowerCase())s+=1;}
    });
    return{s,t};
  };
  const {s,t}=calcScore();
  const pct=t>0?s/t:0;
  const rc=pct>=0.8?'#10B981':pct>=0.5?'#F59E0B':'#EF4444';

  // Per-question result
  const getQResult=(q,qi)=>{
    if(q.type==='true_false') return q.items.every((it,ii)=>answers[qi]?.[ii]===it.answer);
    if(q.type==='multiple') return answers[qi]===q.correct;
    if(q.type==='multi_select') return JSON.stringify([...(answers[qi]||[])].sort())===JSON.stringify([...(q.correct||[])].sort());
    return (answers[qi]||'').trim().toLowerCase()===(q.answer||'').trim().toLowerCase();
  };

  // Answered count
  const answeredCount=questions.filter((q,qi)=>{
    if(q.type==='multiple') return answers[qi]!==null&&answers[qi]!==undefined;
    if(q.type==='multi_select') return (answers[qi]||[]).length>0;
    if(q.type==='fill_blank') return !!(answers[qi]||'').trim();
    if(q.type==='true_false') return answers[qi]&&answers[qi].some(v=>v!==null);
    return false;
  }).length;

  const q=questions[cur];if(!q)return null;
  const ti={true_false:{l:'Đúng / Sai',c:'#C084FC'},multiple:{l:'Trắc nghiệm',c:'#F9A8D4'},multi_select:{l:'Chọn nhiều',c:'#6EE7B7'},fill_blank:{l:'Điền chỗ trống',c:'#FED7AA'}};
  const info=ti[q.type]||ti.multiple;

  const setA=v=>{const n=[...answers];n[cur]=v;setAnswers(n);};

  const checkCurrent=(ans)=>{
    if(q.type==='multiple') return ans===q.correct;
    if(q.type==='multi_select') return JSON.stringify([...ans].sort())===JSON.stringify([...(q.correct||[])].sort());
    if(q.type==='fill_blank') return (ans||'').trim().toLowerCase()===q.answer.trim().toLowerCase();
    if(q.type==='true_false') return q.items.filter((it,ii)=>ans?.[ii]===it.answer).length===q.items.length;
    return false;
  };

  const handleAnswer=(v,immediate=false)=>{
    setA(v);
    recordAnswerTime();
    if(immediate){
      const ok=checkCurrent(v);
      playSound(ok);
      setFeedback({ok,key:Date.now()});
      setTimeout(()=>setFeedback(null),900);
      if(ok){
        const newStreak=streak+1;
        setStreak(newStreak);
        setBestStreak(bs=>Math.max(bs,newStreak));
      } else {
        setStreak(0);
      }
    }
  };

  const getUnanswered=()=>questions.reduce((acc,q,qi)=>{
    let empty=false;
    if(q.type==='multiple') empty=answers[qi]===null||answers[qi]===undefined;
    else if(q.type==='multi_select') empty=!(answers[qi]||[]).length;
    else if(q.type==='fill_blank') empty=!(answers[qi]||'').trim();
    else if(q.type==='true_false') empty=!(answers[qi])||answers[qi].some(v=>v===null);
    if(empty)acc.push(qi+1);
    return acc;
  },[]);

  const doSubmit=()=>{
    clearTimeout(timerRef.current);
    setSubmitted(true);
    const {s:hs,t:ht}=calcScore();
    const hpct=ht>0?hs/ht:0;
    const _strip=s=>(s||'').replace(/<[^>]*>/g,'').trim();
    const totalTime=Object.values(answerTimes).reduce((a,b)=>a+b,0);
    const perQ=questions.map((q,qi)=>{
      let ok=false,partial=false,qText='',correctAns='';
      if(q.type==='true_false'){const full=q.items.every((it,ii)=>answers[qi]?.[ii]===it.answer);const half=q.items.some((it,ii)=>answers[qi]?.[ii]===it.answer);ok=full;partial=half&&!full;qText=_strip(q.passage).slice(0,90);const wrongItems=q.items.filter((it,ii)=>answers[qi]?.[ii]!==it.answer);correctAns=wrongItems.map(it=>(it.answer?'Đúng':'Sai')+': '+_strip(it.text).slice(0,40)).join(' | ');}
      else if(q.type==='multiple'){ok=answers[qi]===q.correct;qText=_strip(q.question).slice(0,90);correctAns=q.options[q.correct]||'';}
      else if(q.type==='multi_select'){const a=answers[qi]||[];ok=JSON.stringify([...a].sort())===JSON.stringify([...(q.correct||[])].sort());qText=_strip(q.question).slice(0,90);correctAns=(q.correct||[]).map(i=>q.options[i]).join(', ');}
      else{ok=(answers[qi]||'').trim().toLowerCase()===(q.answer||'').trim().toLowerCase();qText=_strip(q.question).slice(0,90);correctAns=q.answer||'';}
      return{type:q.type,ok,partial,qText,correctAns,time:answerTimes[qi]||0};
    });
    if(onSaveHistory)onSaveHistory({id:Date.now(),ts:new Date().toISOString(),lessonTitle:lessonTitle||title||'Không tên',score:hs,total:ht,pct:hpct,qCount:questions.length,perQ,bestStreak,totalTime});
    setTimeout(()=>{setModal(true);if(hpct>=0.7){playFanfare();spawnConfetti();}else playSad();},80);
  };

  const handleSubmit=()=>{const un=getUnanswered();if(un.length>0){setWarnModal(un);return;}doSubmit();};

  const resetAll=()=>{
    setAnswers(questions.map(q=>{if(q.type==='true_false')return q.items.map(()=>null);if(q.type==='multi_select')return[];return null;}));
    setSubmitted(false);setModal(false);setCur(0);setFeedback(null);setStreak(0);setBestStreak(0);setAnswerTimes({});
    if(timeLimit>0)setTimeLeft(timeLimit*60);
  };

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',background:'linear-gradient(160deg,#120430,#1A0838,#0A1030)',color:'#F0E6FF',minHeight:'calc(100vh - 100px)',position:'relative'}}>

      {/* Confetti */}
      {confetti.length>0&&(
        <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:9998,overflow:'hidden'}}>
          <style>{`@keyframes cfDrop{0%{transform:translateY(-20px) rotate(0deg);opacity:1}100%{transform:translateY(110vh) rotate(720deg);opacity:0}}`}</style>
          {confetti.map(c=>(
            <div key={c.id} style={{position:'absolute',left:c.x+'%',top:0,width:c.size,height:c.size,background:c.color,borderRadius:c.size>9?'50%':2,transform:`rotate(${c.rot}deg)`,animation:`cfDrop ${1.4+Math.random()*0.6}s ease-in ${c.delay}s both`}}/>
          ))}
        </div>
      )}

      {/* Feedback flash */}
      {feedback&&(
        <div key={feedback.key} style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:9990,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <style>{`@keyframes fbPop{0%{transform:scale(0.5);opacity:0}40%{transform:scale(1.18);opacity:1}70%{transform:scale(0.95);opacity:1}100%{transform:scale(1.1);opacity:0}}`}</style>
          <div style={{animation:'fbPop 0.85s ease both',background:feedback.ok?'rgba(16,185,129,0.22)':'rgba(239,68,68,0.18)',border:`3px solid ${feedback.ok?'#10B981':'#EF4444'}`,borderRadius:28,padding:'18px 32px',textAlign:'center',backdropFilter:'blur(8px)'}}>
            <div style={{fontSize:42}}>{feedback.ok?'✓':'✗'}</div>
            <div style={{fontSize:15,fontWeight:900,color:feedback.ok?'#6EE7B7':'#FCA5A5',marginTop:6}}>
              {feedback.ok?`Chính xác! 🔥 ${streak+1} liên tiếp`:'Sai rồi!'}
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div style={{padding:'10px 14px 8px',background:'rgba(255,255,255,0.04)',borderBottom:'1px solid rgba(196,181,253,0.15)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:7}}>
          <button onClick={onBack} style={{padding:'6px 13px',borderRadius:999,border:'1.5px solid rgba(255,150,200,0.3)',background:'rgba(255,150,200,0.08)',color:'#F9A8D4',fontSize:12,fontWeight:800,cursor:'pointer',transition:'all .15s'}}
            onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,150,200,0.18)';e.currentTarget.style.transform='translateY(-1px)';}}
            onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,150,200,0.08)';e.currentTarget.style.transform='translateY(0)';}}
            onMouseDown={e=>e.currentTarget.style.transform='scale(0.95)'}
            onMouseUp={e=>e.currentTarget.style.transform='translateY(-1px)'}>← Quay lại</button>

          <div style={{display:'flex',alignItems:'center',gap:8}}>
            {/* Timer */}
            {timeLeft!==null&&(
              <div style={{display:'flex',alignItems:'center',gap:5,padding:'4px 12px',borderRadius:999,background:`rgba(${timeLeft<60?'239,68,68':timeLeft<120?'245,158,11':'16,185,129'},0.15)`,border:`1.5px solid ${timerColor}`,transition:'all .5s'}}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={timerColor} strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span style={{fontSize:13,fontWeight:900,color:timerColor,fontVariantNumeric:'tabular-nums'}}>{fmtTime(timeLeft)}</span>
              </div>
            )}
            {/* Streak badge */}
            {streak>=2&&!submitted&&(
              <div style={{display:'flex',alignItems:'center',gap:4,padding:'4px 10px',borderRadius:999,background:'rgba(252,211,77,0.15)',border:'1.5px solid #FCD34D'}}>
                <span style={{fontSize:12}}>🔥</span>
                <span style={{fontSize:12,fontWeight:900,color:'#FCD34D'}}>{streak}</span>
              </div>
            )}
            {submitted&&<div style={{padding:'5px 14px',borderRadius:999,fontSize:13,fontWeight:900,color:'#fff',background:rc,boxShadow:'0 3px 12px rgba(0,0,0,0.25)'}}>{s.toFixed(2)} / {t}</div>}
          </div>
        </div>

        {/* Progress bar double */}
        <div style={{position:'relative',height:6,background:'rgba(255,150,200,0.12)',borderRadius:99,overflow:'hidden',marginBottom:4}}>
          {/* answered progress */}
          <div style={{position:'absolute',inset:0,width:`${answeredCount/total*100}%`,background:'rgba(196,181,253,0.3)',borderRadius:99,transition:'width .3s'}}/>
          {/* current position */}
          <div style={{position:'absolute',inset:0,width:`${(cur+1)/total*100}%`,background:'linear-gradient(90deg,#F472B6,#A855F7,#6EE7B7)',borderRadius:99,transition:'width .4s ease'}}/>
        </div>

        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontSize:11,fontWeight:800,color:info.c,background:'rgba(255,255,255,0.06)',padding:'2px 9px',borderRadius:999}}>{info.l}</span>
          <span style={{fontSize:11,color:'#9D7AB8',fontWeight:700}}>
            {answeredCount}/{total} đã trả lời · Câu {cur+1}/{total}
          </span>
        </div>
      </div>

      {/* ── QUESTION AREA ── */}
      <div style={{flex:1,padding:'13px',overflowY:'auto'}} className="fade-up" key={cur}>

        {q.type==='true_false'&&(
          <div style={{background:'rgba(196,181,253,0.07)',border:'1.5px solid rgba(196,181,253,0.2)',borderRadius:15,padding:'13px 15px',marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:900,color:'#C084FC',letterSpacing:.8,marginBottom:7,display:'flex',alignItems:'center',gap:5}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#C084FC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>ĐOẠN TƯ LIỆU
            </div>
            <p style={{fontSize:13,lineHeight:1.8,fontStyle:'italic',color:'#E2D9F3',marginBottom:q.source?5:0}} dangerouslySetInnerHTML={{__html:q.passage}}/>
            {q.source&&<p style={{fontSize:11,color:'#9D7AB8',fontWeight:700,marginTop:4}}>{q.source}</p>}
          </div>
        )}
        {q.type!=='true_false'&&(
          <div style={{background:'rgba(255,255,255,0.05)',border:'1.5px solid rgba(196,181,253,0.2)',borderRadius:15,padding:'13px 15px',marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:900,color:info.c,letterSpacing:.8,marginBottom:7}}>{info.l.toUpperCase()}</div>
            <p style={{fontSize:14,fontWeight:700,lineHeight:1.7,color:'#F0E6FF'}} dangerouslySetInnerHTML={{__html:q.question}}/>
            {q.type==='multi_select'&&<p style={{fontSize:11,color:'#9D7AB8',marginTop:5,fontWeight:700}}>☑ Chọn tất cả đáp án đúng</p>}
          </div>
        )}

        {/* TF items */}
        {q.image&&<div style={{marginBottom:12,borderRadius:15,overflow:'hidden',border:'1.5px solid rgba(196,181,253,0.2)',textAlign:'center'}}><img src={q.image} alt="Ảnh minh họa" loading="lazy" style={{display:'block',maxWidth:'100%',maxHeight:260,margin:'0 auto',objectFit:'contain'}}/></div>}
        {q.type==='true_false'&&(
          <div style={{display:'flex',flexDirection:'column',gap:9}}>
            {q.items.map((item,ii)=>{
              const sv=answers[cur]?.[ii];const ok=submitted&&sv===item.answer;const bad=submitted&&sv!==null&&sv!==item.answer;
              return(
                <div key={ii} style={{background:ok?'rgba(16,185,129,0.12)':bad?'rgba(239,68,68,0.1)':sv===true?'rgba(16,185,129,0.08)':sv===false?'rgba(239,68,68,0.08)':'rgba(255,255,255,0.04)',border:'1.5px solid '+(ok?'#10B981':bad?'#EF4444':sv===true?'#6EE7B7':sv===false?'#FCA5A5':'rgba(196,181,253,0.2)'),borderRadius:13,padding:'11px 13px',transition:'all .2s'}}>
                  <div style={{display:'flex',gap:8,marginBottom:9}}>
                    <span style={{fontSize:13,fontWeight:900,color:'#C084FC',flexShrink:0}}>{String.fromCharCode(97+ii)}.</span>
                    <p style={{fontSize:13,lineHeight:1.7,margin:0,color:'#E2D9F3'}}>{item.text}</p>
                  </div>
                  <div style={{display:'flex',gap:7,flexWrap:'wrap',alignItems:'center'}}>
                    <button onClick={()=>{if(submitted)return;const n=[...(answers[cur]||q.items.map(()=>null))];n[ii]=n[ii]===true?null:true;setA(n);}} style={{padding:'5px 14px',borderRadius:999,fontSize:12,fontWeight:800,transition:'all .18s',background:sv===true?(submitted?(ok?'#10B981':'#EF4444'):'#10B981'):'rgba(16,185,129,0.1)',color:sv===true?'#fff':'#6EE7B7',border:'1.5px solid '+(sv===true?'transparent':'#6EE7B7'),cursor:submitted?'default':'pointer'}}
                      onMouseEnter={e=>{if(!submitted&&sv!==true)e.currentTarget.style.transform='translateY(-1px)';}}
                      onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';}}
                      onMouseDown={e=>{if(!submitted)e.currentTarget.style.transform='scale(0.93)';}}
                      onMouseUp={e=>{if(!submitted)e.currentTarget.style.transform='translateY(-1px)';}}>✓ Đúng</button>
                    <button onClick={()=>{if(submitted)return;const n=[...(answers[cur]||q.items.map(()=>null))];n[ii]=n[ii]===false?null:false;setA(n);}} style={{padding:'5px 14px',borderRadius:999,fontSize:12,fontWeight:800,transition:'all .18s',background:sv===false?(submitted?(ok?'#10B981':'#EF4444'):'#EF4444'):'rgba(239,68,68,0.1)',color:sv===false?'#fff':'#FCA5A5',border:'1.5px solid '+(sv===false?'transparent':'#FCA5A5'),cursor:submitted?'default':'pointer'}}
                      onMouseEnter={e=>{if(!submitted&&sv!==false)e.currentTarget.style.transform='translateY(-1px)';}}
                      onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';}}
                      onMouseDown={e=>{if(!submitted)e.currentTarget.style.transform='scale(0.93)';}}
                      onMouseUp={e=>{if(!submitted)e.currentTarget.style.transform='translateY(-1px)';}}>✗ Sai</button>
                    {submitted&&<span style={{fontSize:11,fontWeight:800,color:'#C084FC',background:'rgba(196,181,253,0.15)',padding:'2px 9px',borderRadius:999,marginLeft:'auto'}}>Đáp án: {item.answer?'✓':'✗'}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* MC / MS */}
        {(q.type==='multiple'||q.type==='multi_select')&&(
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {q.options.map((opt,i)=>{
              const sv=q.type==='multiple'?answers[cur]:(answers[cur]||[]);
              const isSel=q.type==='multiple'?sv===i:sv.includes(i);
              const isCor=q.type==='multiple'?q.correct===i:(q.correct||[]).includes(i);
              const ok=submitted&&isSel&&isCor;const bad=submitted&&isSel&&!isCor;const missed=submitted&&!isSel&&isCor;
              return(
                <button key={i} onClick={()=>{
                  if(submitted)return;
                  if(q.type==='multiple'){
                    const newVal=sv===i?null:i;
                    handleAnswer(newVal,newVal!==null);
                  } else {
                    setA(sv.includes(i)?sv.filter(x=>x!==i):[...sv,i]);
                    recordAnswerTime();
                  }
                }}
                  style={{display:'flex',alignItems:'center',gap:10,background:ok?'rgba(16,185,129,0.15)':bad?'rgba(239,68,68,0.12)':missed?'rgba(245,158,11,0.12)':isSel?'rgba(196,181,253,0.15)':'rgba(255,255,255,0.04)',border:'1.5px solid '+(ok?'#10B981':bad?'#EF4444':missed?'#F59E0B':isSel?'#C084FC':'rgba(196,181,253,0.2)'),borderRadius:13,padding:'11px 12px',cursor:submitted?'default':'pointer',textAlign:'left',transition:'all .2s',width:'100%'}}
                  onMouseEnter={e=>{if(!submitted&&!isSel){e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.borderColor='#C084FC';}}}
                  onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.borderColor=isSel?'#C084FC':'rgba(196,181,253,0.2)';}}
                  onMouseDown={e=>{if(!submitted)e.currentTarget.style.transform='scale(0.98)';}}
                  onMouseUp={e=>{if(!submitted)e.currentTarget.style.transform='translateY(-1px)';}}>
                  <span style={{width:27,height:27,borderRadius:q.type==='multiple'?'50%':8,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:900,background:isSel?(submitted?(ok?'#10B981':bad?'#EF4444':'#A855F7'):'#A855F7'):'rgba(196,181,253,0.15)',color:isSel?'#fff':'#C084FC'}}>{LETTERS[i]}</span>
                  <span style={{fontSize:13,lineHeight:1.65,color:'#E2D9F3',flex:1}}>{opt}</span>
                  {submitted&&isCor&&<span style={{color:'#6EE7B7',fontWeight:900,fontSize:14}}>✓</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Fill blank */}
        {q.type==='fill_blank'&&(
          <div>
            <input value={answers[cur]||''} onChange={e=>{if(!submitted)setA(e.target.value);}}
              onKeyDown={e=>{if(e.key==='Enter'&&!submitted&&(answers[cur]||'').trim()){const ok=(answers[cur]||'').trim().toLowerCase()===q.answer.trim().toLowerCase();playSound(ok);setFeedback({ok,key:Date.now()});setTimeout(()=>setFeedback(null),900);recordAnswerTime();if(ok){const ns=streak+1;setStreak(ns);setBestStreak(bs=>Math.max(bs,ns));}else setStreak(0);}}}
              placeholder="Nhập câu trả lời... (Enter để kiểm tra)"
              style={{width:'100%',padding:'12px 15px',borderRadius:13,fontSize:14,fontWeight:700,color:'#F0E6FF',background:submitted?((answers[cur]||'').trim().toLowerCase()===q.answer.trim().toLowerCase()?'rgba(16,185,129,0.12)':'rgba(239,68,68,0.1)'):'rgba(255,255,255,0.07)',border:'1.5px solid '+(submitted?((answers[cur]||'').trim().toLowerCase()===q.answer.trim().toLowerCase()?'#10B981':'#EF4444'):'rgba(196,181,253,0.3)'),outline:'none',fontFamily:'Nunito,sans-serif'}}/>
            {submitted&&<div style={{marginTop:8,fontSize:13,fontWeight:800,color:(answers[cur]||'').trim().toLowerCase()===q.answer.trim().toLowerCase()?'#6EE7B7':'#FCA5A5',display:'flex',alignItems:'center',gap:5}}>
              {(answers[cur]||'').trim().toLowerCase()===q.answer.trim().toLowerCase()?<>✓ Chính xác!</>:<>✗ Đáp án đúng: <strong>{q.answer}</strong></>}
            </div>}
            {!submitted&&q.hint&&<div style={{marginTop:6,fontSize:12,color:'#9D7AB8',fontWeight:700}}>💡 {q.hint}</div>}
          </div>
        )}

        {/* Nav dots */}
        <div style={{display:'flex',alignItems:'center',gap:8,padding:'13px 0 5px'}}>
          <button onClick={()=>setCur(p=>Math.max(0,p-1))} disabled={cur===0} style={{flexShrink:0,padding:'7px 14px',borderRadius:999,fontSize:12,fontWeight:800,background:'rgba(255,150,200,0.08)',border:'1.5px solid rgba(255,150,200,0.25)',color:'#F9A8D4',opacity:cur===0?0.3:1,cursor:cur===0?'default':'pointer',transition:'all .15s'}}
            onMouseEnter={e=>{if(cur!==0)e.currentTarget.style.background='rgba(255,150,200,0.18)';}}
            onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,150,200,0.08)';}}
            onMouseDown={e=>{if(cur!==0)e.currentTarget.style.transform='scale(0.92)';}}
            onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}>←</button>
          <div style={{flex:1,overflowX:'auto',display:'flex',gap:4,alignItems:'center',scrollbarWidth:'none',padding:'4px 2px'}}>
            {questions.map((qq,i)=>{
              const isAnswered=(()=>{if(qq.type==='multiple')return answers[i]!==null&&answers[i]!==undefined;if(qq.type==='multi_select')return(answers[i]||[]).length>0;if(qq.type==='fill_blank')return!!(answers[i]||'').trim();if(qq.type==='true_false')return answers[i]&&answers[i].some(v=>v!==null);return false;})();
              const isCorrect=submitted&&getQResult(qq,i);
              const isWrong=submitted&&!getQResult(qq,i);
              return(
                <button key={i} onClick={()=>setCur(i)}
                  style={{flexShrink:0,width:i===cur?26:isAnswered?10:8,height:i===cur?8:isAnswered?10:8,borderRadius:999,border:i===cur?'none':'1.5px solid '+(isCorrect?'#10B981':isWrong?'#EF4444':'transparent'),padding:0,cursor:'pointer',
                    background:i===cur?'#F472B6':isCorrect?'#10B981':isWrong?'#EF4444':isAnswered?'rgba(196,181,253,0.6)':'rgba(255,150,200,0.3)',
                    transition:'all .25s'}}
                  onMouseEnter={e=>{if(i!==cur)e.currentTarget.style.opacity='0.7';}}
                  onMouseLeave={e=>{e.currentTarget.style.opacity='1';}}/>
              );
            })}
          </div>
          <button onClick={()=>setCur(p=>Math.min(total-1,p+1))} disabled={cur===total-1} style={{flexShrink:0,padding:'7px 14px',borderRadius:999,fontSize:12,fontWeight:800,background:'rgba(255,150,200,0.08)',border:'1.5px solid rgba(255,150,200,0.25)',color:'#F9A8D4',opacity:cur===total-1?0.3:1,cursor:cur===total-1?'default':'pointer',transition:'all .15s'}}
            onMouseEnter={e=>{if(cur!==total-1)e.currentTarget.style.background='rgba(255,150,200,0.18)';}}
            onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,150,200,0.08)';}}
            onMouseDown={e=>{if(cur!==total-1)e.currentTarget.style.transform='scale(0.92)';}}
            onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}>→</button>
        </div>
      </div>

      {/* ── SUBMIT BAR ── */}
      <div style={{position:'sticky',bottom:0,padding:'10px 14px 20px',borderTop:'1px solid rgba(196,181,253,0.15)',background:'rgba(18,4,48,0.94)',backdropFilter:'blur(16px)',display:'flex',gap:8}}>
        {!submitted?(
          <button onClick={handleSubmit} style={{flex:1,padding:13,borderRadius:999,border:'none',background:'linear-gradient(135deg,#F472B6,#A855F7)',color:'#fff',fontSize:15,fontWeight:900,boxShadow:'0 4px 20px rgba(168,85,247,0.35)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:7,transition:'all .18s'}}
            onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 6px 26px rgba(168,85,247,0.5)';}}
            onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 4px 20px rgba(168,85,247,0.35)';}}
            onMouseDown={e=>e.currentTarget.style.transform='scale(0.97)'}
            onMouseUp={e=>e.currentTarget.style.transform='translateY(-2px)'}>
            ♡ Nộp bài ({answeredCount}/{total})
          </button>
        ):(
          <>
            <button onClick={resetAll} style={{flex:1,padding:13,borderRadius:999,border:'1.5px solid rgba(255,150,200,0.3)',background:'rgba(255,150,200,0.08)',color:'#F9A8D4',fontSize:14,fontWeight:900,cursor:'pointer',transition:'all .15s'}}
              onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,150,200,0.18)';e.currentTarget.style.transform='translateY(-1px)';}}
              onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,150,200,0.08)';e.currentTarget.style.transform='translateY(0)';}}
              onMouseDown={e=>e.currentTarget.style.transform='scale(0.96)'}
              onMouseUp={e=>e.currentTarget.style.transform='translateY(-1px)'}>↺ Làm lại</button>
            <button onClick={()=>setShowStats(true)} style={{flex:1,padding:13,borderRadius:999,border:'none',background:'linear-gradient(135deg,#10B981,#6EE7B7)',color:'#fff',fontSize:14,fontWeight:900,cursor:'pointer',transition:'all .18s'}}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 6px 20px rgba(16,185,129,0.4)';}}
              onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';}}
              onMouseDown={e=>e.currentTarget.style.transform='scale(0.96)'}
              onMouseUp={e=>e.currentTarget.style.transform='translateY(-2px)'}>📊 Thống kê</button>
          </>
        )}
      </div>

      {/* ── WARN MODAL ── */}
      {warnModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(10,2,25,0.88)',backdropFilter:'blur(12px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:10000,padding:20}}>
          <div style={{background:'linear-gradient(160deg,#1E0845,#120330)',border:'1.5px solid rgba(252,211,77,0.35)',borderRadius:28,padding:'26px 22px',maxWidth:300,width:'100%',textAlign:'center',boxShadow:'0 24px 70px rgba(0,0,0,0.75)',animation:'pop .28s ease both'}}>
            <div style={{fontSize:36,marginBottom:10}}>⚠️</div>
            <div style={{fontSize:16,fontWeight:900,color:'#FCD34D',marginBottom:8}}>Còn câu chưa làm!</div>
            <div style={{fontSize:13,color:'#B090C8',lineHeight:1.65,marginBottom:18}}>
              {warnModal.length===1?`Câu ${warnModal[0]} chưa được trả lời.`:`${warnModal.length} câu chưa trả lời: câu ${warnModal.join(', ')}.`}
            </div>
            <div style={{display:'flex',gap:9}}>
              <button onClick={()=>{setCur(warnModal[0]-1);setWarnModal(null);}} style={{flex:1,padding:'10px 0',borderRadius:999,border:'1.5px solid rgba(255,150,200,0.3)',background:'transparent',color:'#F9A8D4',fontSize:13,fontWeight:800,cursor:'pointer',transition:'all .15s'}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(255,150,200,0.1)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                onMouseDown={e=>e.currentTarget.style.transform='scale(0.96)'}
                onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}>← Xem lại</button>
              <button onClick={()=>{setWarnModal(null);doSubmit();}} style={{flex:1,padding:'10px 0',borderRadius:999,border:'none',background:'linear-gradient(135deg,#F472B6,#A855F7)',color:'#fff',fontSize:13,fontWeight:800,cursor:'pointer',transition:'all .18s'}}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 4px 16px rgba(168,85,247,0.4)';}}
                onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';}}
                onMouseDown={e=>e.currentTarget.style.transform='scale(0.96)'}
                onMouseUp={e=>e.currentTarget.style.transform='translateY(-1px)'}>Nộp thôi!</button>
            </div>
          </div>
        </div>
      )}

      {/* ── STATS MODAL ── */}
      {showStats&&submitted&&(
        <div onClick={()=>setShowStats(false)} style={{position:'fixed',inset:0,background:'rgba(10,2,25,0.85)',backdropFilter:'blur(14px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:16}}>
          <div onClick={e=>e.stopPropagation()} style={{background:'linear-gradient(160deg,#1E0845,#120330)',border:'1.5px solid rgba(196,181,253,0.2)',borderRadius:28,padding:'20px 18px',maxWidth:340,width:'100%',maxHeight:'85vh',overflowY:'auto',boxShadow:'0 24px 70px rgba(0,0,0,0.6)',animation:'pop .25s ease both'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16}}>
              <span style={{fontSize:16,fontWeight:900,color:'#F0E6FF',flex:1}}>📊 Thống kê chi tiết</span>
              <button onClick={()=>setShowStats(false)} style={{background:'none',border:'none',color:'#9D7AB8',fontSize:18,cursor:'pointer',transition:'all .15s',borderRadius:999,width:26,height:26}}
                onMouseEnter={e=>{e.currentTarget.style.color='#F9A8D4';e.currentTarget.style.background='rgba(255,150,200,0.12)';}}
                onMouseLeave={e=>{e.currentTarget.style.color='#9D7AB8';e.currentTarget.style.background='none';}}>×</button>
            </div>

            {/* Score ring */}
            <div style={{textAlign:'center',marginBottom:16}}>
              <div style={{fontSize:40,fontWeight:900,color:rc,lineHeight:1}}>{Math.round(pct*100)}%</div>
              <div style={{fontSize:13,color:'#9D7AB8',marginTop:2}}>{s.toFixed(2)} / {t} điểm</div>
              <div style={{height:6,background:'rgba(255,255,255,0.08)',borderRadius:99,margin:'10px 0 4px',overflow:'hidden'}}>
                <div style={{height:'100%',width:`${pct*100}%`,borderRadius:99,background:pct>=0.8?'linear-gradient(90deg,#10B981,#6EE7B7)':pct>=0.5?'linear-gradient(90deg,#F59E0B,#FCD34D)':'linear-gradient(90deg,#EF4444,#FCA5A5)',transition:'width .8s ease'}}/>
              </div>
            </div>

            {/* Stats grid */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
              {[
                ['🔥 Streak tốt nhất',`${bestStreak} câu`,'#FCD34D'],
                ['✓ Đúng',`${questions.filter((q,qi)=>getQResult(q,qi)).length}/${total}`,'#10B981'],
                ['⏱ Thời gian TB',`${Math.round(Object.values(answerTimes).reduce((a,b)=>a+b,0)/Math.max(Object.keys(answerTimes).length,1))}s/câu`,'#C084FC'],
                ['📝 Đã trả lời',`${answeredCount}/${total}`,'#F9A8D4'],
              ].map(([label,val,c])=>(
                <div key={label} style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(196,181,253,0.1)',borderRadius:12,padding:'10px 12px',textAlign:'center'}}>
                  <div style={{fontSize:10,color:'#9D7AB8',marginBottom:3}}>{label}</div>
                  <div style={{fontSize:16,fontWeight:900,color:c}}>{val}</div>
                </div>
              ))}
            </div>

            {/* Per-question breakdown */}
            <div style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(196,181,253,0.1)',borderRadius:18,padding:'10px 12px',marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:900,color:'#9D7AB8',marginBottom:8,letterSpacing:.5}}>TỪNG CÂU</div>
              {questions.map((qq,qi)=>{
                const ok=getQResult(qq,qi);
                const t2=answerTimes[qi];
                return(
                  <div key={qi} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:qi<questions.length-1?'1px solid rgba(255,255,255,0.05)':'none'}}>
                    <span style={{color:'#9D7AB8',fontSize:12}}>Câu {qi+1} <span style={{fontSize:9,color:'rgba(255,255,255,0.25)'}}>{qq.type==='true_false'?'ĐS':qq.type==='multiple'?'TN':qq.type==='multi_select'?'CN':'ĐT'}</span></span>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      {t2&&<span style={{fontSize:10,color:'#9D7AB8'}}>{t2}s</span>}
                      <span style={{color:ok?'#6EE7B7':'#FCA5A5',fontWeight:800,fontSize:12}}>{ok?'✓ Đúng':'✗ Sai'}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <button onClick={resetAll} style={{width:'100%',padding:'11px',borderRadius:999,border:'none',background:'linear-gradient(135deg,#F472B6,#A855F7)',color:'#fff',fontSize:13,fontWeight:900,cursor:'pointer',transition:'all .18s'}}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 6px 20px rgba(168,85,247,0.4)';}}
              onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';}}
              onMouseDown={e=>e.currentTarget.style.transform='scale(0.97)'}
              onMouseUp={e=>e.currentTarget.style.transform='translateY(-1px)'}>↺ Làm lại</button>
          </div>
        </div>
      )}

      {/* ── SCORE MODAL ── */}
      {modal&&(
        <div onClick={()=>setModal(false)} style={{position:'fixed',inset:0,background:'rgba(10,2,25,0.82)',backdropFilter:'blur(12px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:999,padding:20}}>
          <style>{`
            @keyframes scoreIn{0%{transform:scale(0.7) translateY(30px);opacity:0}60%{transform:scale(1.06) translateY(-4px);opacity:1}100%{transform:scale(1) translateY(0);opacity:1}}
            @keyframes scoreNum{0%{transform:scale(0.5);opacity:0}70%{transform:scale(1.12);opacity:1}100%{transform:scale(1);opacity:1}}
            @keyframes starSpin{0%{transform:rotate(0deg) scale(0)}60%{transform:rotate(200deg) scale(1.2)}100%{transform:rotate(360deg) scale(1)}}
          `}</style>
          <div onClick={e=>e.stopPropagation()} style={{background:'linear-gradient(160deg,#1E0845,#120330)',border:'1.5px solid rgba(255,150,200,0.25)',borderRadius:28,padding:'28px 22px 24px',maxWidth:330,width:'100%',textAlign:'center',boxShadow:'0 30px 80px rgba(0,0,0,0.7)',animation:'scoreIn 0.55s cubic-bezier(0.34,1.56,0.64,1) both'}}>
            <div style={{marginBottom:14}}>
              {pct>=0.8?(<div style={{animation:'starSpin 0.7s ease both',animationDelay:'0.2s',display:'inline-block'}}>
                <svg width="72" height="72" viewBox="0 0 72 72">{[0,60,120,180,240,300].map((deg,i)=>(<ellipse key={i} cx="36" cy="14" rx="5" ry="10" fill={['#F472B6','#A855F7','#6EE7B7','#FCD34D','#FB923C','#60A5FA'][i]} opacity="0.85" transform={`rotate(${deg} 36 36)`}/>))}<circle cx="36" cy="36" r="16" fill="rgba(16,185,129,0.2)" stroke="#10B981" strokeWidth="2.5"/><polyline points="26 36 33 43 46 28" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>):pct>=0.5?(<div style={{animation:'starSpin 0.7s ease both',animationDelay:'0.2s',display:'inline-block'}}>
                <svg width="72" height="72" viewBox="0 0 72 72"><circle cx="36" cy="36" r="30" fill="rgba(245,158,11,0.12)" stroke="#F59E0B" strokeWidth="2.5"/><path d="M36 18L40.9 29.1L53 30.7L44 39.4L46.2 51.5L36 45.9L25.8 51.5L28 39.4L19 30.7L31.1 29.1Z" fill="#F59E0B" opacity="0.9"/></svg>
              </div>):(<div style={{animation:'scoreIn 0.5s ease both',display:'inline-block'}}>
                <svg width="72" height="72" viewBox="0 0 72 72"><circle cx="36" cy="36" r="30" fill="rgba(239,68,68,0.12)" stroke="#EF4444" strokeWidth="2.5"/><path d="M36 20 Q38 32 36 38 Q34 32 36 20Z" fill="#EF4444" opacity="0.9"/><circle cx="36" cy="46" r="3" fill="#EF4444"/></svg>
              </div>)}
            </div>
            <div style={{fontSize:38,fontWeight:900,color:rc,marginBottom:4,animation:'scoreNum 0.5s ease both',animationDelay:'0.3s',lineHeight:1}}>
              {s.toFixed(2)} <span style={{fontSize:20,color:'rgba(255,255,255,0.3)'}}>/</span> <span style={{fontSize:24}}>{t}</span>
            </div>
            <div style={{height:7,background:'rgba(255,255,255,0.08)',borderRadius:99,margin:'10px 0 8px',overflow:'hidden'}}>
              <div style={{height:'100%',width:`${pct*100}%`,borderRadius:99,background:pct>=0.8?'linear-gradient(90deg,#10B981,#6EE7B7)':pct>=0.5?'linear-gradient(90deg,#F59E0B,#FCD34D)':'linear-gradient(90deg,#EF4444,#FCA5A5)',transition:'width 0.8s ease 0.5s'}}/>
            </div>
            <div style={{fontSize:12,color:'rgba(255,255,255,0.4)',marginBottom:6}}>{Math.round(pct*100)}%</div>
            {bestStreak>=3&&<div style={{fontSize:12,color:'#FCD34D',marginBottom:6}}>🔥 Streak tốt nhất: {bestStreak} câu liên tiếp!</div>}
            <div style={{fontSize:14,fontWeight:800,color:pct>=0.8?'#6EE7B7':pct>=0.5?'#FCD34D':'#FCA5A5',marginBottom:6}}>
              {pct>=0.8?'Xuất sắc! Giỏi lắm!':pct>=0.5?'Khá tốt, cố lên!':'Cần ôn lại nhé!'}
            </div>
            <div style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(196,181,253,0.12)',borderRadius:18,padding:'9px 12px',marginBottom:18,maxHeight:130,overflowY:'auto'}}>
              {questions.map((q2,qi)=>{
                const ok=getQResult(q2,qi);
                return(<div key={qi} style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:12,fontWeight:700,padding:'3px 0',borderBottom:qi<questions.length-1?'1px solid rgba(255,255,255,0.05)':'none'}}>
                  <span style={{color:'#9D7AB8'}}>Câu {qi+1}</span>
                  <span style={{color:ok?'#6EE7B7':'#FCA5A5'}}>{ok?'✓ Đúng':'✗ Sai'}</span>
                </div>);
              })}
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={resetAll} style={{flex:1,padding:'10px 0',borderRadius:999,border:'1.5px solid rgba(255,150,200,0.3)',background:'transparent',color:'#F9A8D4',fontSize:13,fontWeight:800,cursor:'pointer',transition:'all .15s'}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(255,150,200,0.1)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                onMouseDown={e=>e.currentTarget.style.transform='scale(0.96)'}
                onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}>↺ Làm lại</button>
              <button onClick={()=>{setModal(false);setShowStats(true);}} style={{flex:1,padding:'10px 0',borderRadius:999,border:'none',background:'linear-gradient(135deg,#10B981,#6EE7B7)',color:'#fff',fontSize:13,fontWeight:800,cursor:'pointer',transition:'all .18s'}}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 4px 16px rgba(16,185,129,0.4)';}}
                onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';}}
                onMouseDown={e=>e.currentTarget.style.transform='scale(0.96)'}
                onMouseUp={e=>e.currentTarget.style.transform='translateY(-1px)'}>📊 Thống kê</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
})();
