import React from 'react';

/* ══ LEARNSY PARSERS & FACTORIES – NÂNG CẤP TOÀN DIỆN 2026 ═════════════════ */
(function(){
  const LETTERS = ['A','B','C','D','E','F'];
  const stripHTML = s => (s||'').replace(/<[^>]*>/g, '');

  // ──────────────────────────────────────────────
  // 1. NHẬN DIỆN DÒNG CÂU HỎI (RE_Q)
  // ──────────────────────────────────────────────
  const RE_Q = /^(?:(?:câu|cau|question|bài|phần)\s*\d+\s*(?:\([^)]{0,10}\))?\s*[.):\-–—]|\bq\d+[.:]\s*|\(\s*\d+\s*\)\s*\S|\[\s*\d+\s*\]\s*\S|\d+\s*[.)]\s+\S)/i;

  const RE_Q_LOOSE = /^[\p{L}]{2,12}\s*(?:tập|số)?\s*\d+\s*[.):\-–—]/iu;

  // ──────────────────────────────────────────────
  // 2. NHẬN DIỆN ĐOẠN / PHẦN
  // ──────────────────────────────────────────────
  const RE_SECTION = /^(?:exercise|section|part|bài\s*tập|phần)\s*[IVXLC\d]+\b\s*[:.\-–—]?\s*/i;

  // ──────────────────────────────────────────────
  // 3. NHẬN DIỆN DÒNG ĐÁP ÁN – SIÊU MẠNH
  // ──────────────────────────────────────────────
  const RE_ANS = /^(?:(?:đ[aá]p\s*[aá]n|đ\s*a|đ\s*á|đ\/a|đ\.a|đ\-a|đ–a|đa|da|answer|ans|key|correct|chọn|đúng|kết\s*quả|trả\s*lời)\s*(?:đúng\s*)?\s*[:\-–—=\.]?\s*(?:là\s*)?\s*)(.+)$/i;

  // ──────────────────────────────────────────────
  // 4. NHẬN DIỆN OPTION A. B. C. D.
  // ──────────────────────────────────────────────
  const RE_OPT = /^[A-Fa-f][.):]\s*\S/;
  const RE_TF_ITEM = /^[a-fA-F][.)]\s*\S/;

  // ──────────────────────────────────────────────
  // 5. NHẬN DIỆN ĐÚNG/SAI (TRUE/FALSE)
  // ──────────────────────────────────────────────
  const RE_TF_TAG = /^([a-fA-F])[.)]\s*(.*?)[\s\u00a0]+[(\[]?(Đ|S|Đúng|Sai|True|False|đúng|sai|true|false)[)\]]?\s*$/;

  // ──────────────────────────────────────────────
  // 6. HÀM PHỤ: XOÁ SỐ CÂU HỎI Ở ĐẦU DÒNG
  // ──────────────────────────────────────────────
  function stripQNum(s) {
    return s
      .replace(/^(?:câu|cau|question|bài|phần)\s*\d+\s*(?:\([^)]{0,10}\))?\s*[.):\-–—]\s*/i, '')
      .replace(/^[IVXLC]+\.\d+[.):\s]+/, '')
      .replace(/^\(\s*\d+\s*\)\s*/, '')
      .replace(/^\[\s*\d+\s*\]\s*/, '')
      .replace(/^\d+\s*[.)]\s+/, '')
      .trim();
  }

  // ──────────────────────────────────────────────
  // 7. TRÍCH XUẤT CHỮ CÁI ĐÁP ÁN TỪ CHUỖI BẨN
  // ──────────────────────────────────────────────
  function extractAnswerLetters(captureRaw) {
    // Chuẩn hoá: loại bỏ dấu câu thừa, dấu ngoặc
    let cleaned = captureRaw
      .replace(/^[\(\[]\s*/, '')
      .replace(/\s*[\)\]\.\,\;\:\!\?]*\s*$/, '')
      .trim();

    // Nếu là chuỗi kiểu "A", "A và B", "A, C", "A/C", "A B", "AC"
    const multiSep = cleaned.replace(/[,;/&]|(?:\s+(?:v[àa]|and)\s+)|[\s\u00a0]+/gi, '');
    if (multiSep.length >= 1 && multiSep.length <= 6 && /^[A-Fa-f]+$/.test(multiSep)) {
      return [...new Set(multiSep.toUpperCase().split(''))];
    }

    // Tìm chữ cái đầu tiên đứng một mình
    const lead = cleaned.match(/(?:^|[^A-Za-z])([A-Fa-f])(?:[^A-Za-z]|$)/);
    if (lead) return [lead[1].toUpperCase()];

    return null;
  }

  // ──────────────────────────────────────────────
  // 8. TÁCH OPTION DỒN CHUNG 1 DÒNG (VD: "A. 2  B. 3  C. 4")
  // ──────────────────────────────────────────────
  const RE_INLINE_MARKER = /(?:^|\s)([A-Fa-f])[.)]\s*(?=\S)/g;
  function splitInlineOptions(line) {
    const ms = [...line.matchAll(RE_INLINE_MARKER)];
    if (ms.length < 2) return [line];
    const letters = ms.map(m => m[1].toUpperCase());
    if (letters[0] !== 'A') return [line];
    for (let i = 1; i < letters.length; i++) {
      if (letters[i].charCodeAt(0) !== letters[i-1].charCodeAt(0) + 1) return [line];
    }
    const starts = ms.map(m => m.index + m[0].indexOf(m[1]));
    const out = [];
    for (let i = 0; i < starts.length; i++) {
      const s = starts[i];
      const e = i + 1 < starts.length ? starts[i+1] : line.length;
      out.push(line.slice(s, e).trim());
    }
    return out;
  }

  // ──────────────────────────────────────────────
  // 9. XỬ LÝ BẢNG ĐÁP ÁN CUỐI ĐỀ (1-A, 2-B, ...)
  // ──────────────────────────────────────────────
  const RE_GRID = /(?:^|\s)(\d+)\s*[.\-–—:)]\s*([A-Fa-f])(?=\s|$)/g;
  function isGridLine(l) {
    return [...l.matchAll(RE_GRID)].length >= 3;
  }
  function buildAnswerKeyMap(lines) {
    const map = {};
    for (const l of lines) {
      const ms = [...l.matchAll(RE_GRID)];
      if (ms.length < 3) continue;
      for (const m of ms) {
        if (!(m[1] in map)) map[m[1]] = m[2].toUpperCase();
      }
    }
    return Object.keys(map).length ? map : null;
  }

  // ──────────────────────────────────────────────
  // 10. TRÍCH SỐ CÂU HỎI TỪ DÒNG ĐẦU
  // ──────────────────────────────────────────────
  function extractQNum(line) {
    const m = line.match(/^(?:(?:câu|cau|question|bài|phần)\s*(\d+)|(\d+)\s*[.)])/i);
    return m ? (m[1] || m[2] || null) : null;
  }

  // ──────────────────────────────────────────────
  // 11. HÀM CHÍNH: PARSE VĂN BẢN THÀNH CÂU HỎI
  // ──────────────────────────────────────────────
  function parseText(raw) {
    const results = [];
    const text = String(raw || '').replace(/\r\n?/g, '\n');
    const rawLines = text.split('\n').map(l => l.trim());
    const answerKeyMap = buildAnswerKeyMap(rawLines);

    // Tách options inline trước khi xử lý
    const lines = rawLines.flatMap(l => splitInlineOptions(l));
    const nonEmpty = lines.filter(Boolean);

    const strictHits = nonEmpty.filter(l => RE_Q.test(l)).length;
    const looseHits = nonEmpty.filter(l => RE_Q_LOOSE.test(l)).length;
    const qRe = strictHits > 0 ? RE_Q : (looseHits > 0 ? RE_Q_LOOSE : null);

    let blocks;
    if (qRe) {
      blocks = [];
      let cur = [];
      let sectionLabel = null;
      for (const l of lines) {
        if (!l) continue;
        if (isGridLine(l)) continue; // bỏ qua dòng bảng đáp án
        if (RE_SECTION.test(l)) {
          sectionLabel = l.replace(/[:.\-–—]\s*$/, '');
          continue;
        }
        if (qRe.test(l)) {
          if (cur.length) blocks.push({ lines: cur, section: sectionLabel });
          cur = [l];
        } else if (cur.length) {
          cur.push(l);
        }
      }
      if (cur.length) blocks.push({ lines: cur, section: sectionLabel });
    } else {
      // Fallback: không có số câu rõ ràng -> tách theo đoạn
      blocks = text.split(/\n{2,}/g)
        .map(s => s.trim())
        .filter(s => s.length > 10)
        .map(s => ({
          lines: s.split('\n').flatMap(x => splitInlineOptions(x.trim())).filter(Boolean),
          section: null
        }));
    }

    // ── Xử lý từng khối ──
    for (const { lines: blk, section } of blocks) {
      if (!blk.length) continue;

      const hasABCD = blk.some(l => RE_OPT.test(l));
      const tfLines = blk.filter(l => {
        const m = l.match(RE_TF_TAG);
        return m && RE_TF_ITEM.test(l) && m[2].trim().length >= 2;
      });
      const hasTF = tfLines.length >= 2;
      const hasFill = !hasTF && !hasABCD && (
        /___+/.test(blk.join(' ')) ||
        /^(điền|fill\s*in)/i.test(blk[0])
      );

      if (hasTF) {
        // True/False
        const items = tfLines.map(l => {
          const m = l.match(RE_TF_TAG);
          const bodyText = (m ? m[2] : l.replace(/^[a-fA-F][.)]\s*/, '')).trim();
          const tag = (m ? m[3] : '').toLowerCase();
          const answer = (tag === 's' || tag === 'sai' || tag === 'false') ? false : true;
          return { text: bodyText, answer };
        });
        const firstIdx = blk.findIndex(l => RE_TF_ITEM.test(l));
        const passageRaw = blk.slice(0, firstIdx).join(' ');
        const cleanPassage = stripQNum(passageRaw)
          .replace(/^(Cho đoạn tư liệu|Đọc đoạn|Dựa vào đoạn)[^:]*:\s*/i, '')
          .trim();
        if (items.length >= 2) {
          results.push({
            id: Date.now() + Math.random(),
            type: 'true_false',
            passage: cleanPassage,
            source: section || '',
            items: items.length >= 4 ? items : [...items, ...Array(4 - items.length).fill({ text: '', answer: true })]
          });
        }
      } else if (hasABCD) {
        // Multiple Choice (single hoặc multi-select)
        const optLines = blk.filter(l => RE_OPT.test(l));
        const markedIdxs = [];
        const options = optLines.map((l, idx) => {
          let body = l.replace(/^[A-Fa-f][.):]\s*/, '').trim();
          if (/^\*|\*$|[✔✓]/.test(body)) {
            markedIdxs.push(idx);
            body = body.replace(/^\*+\s*|\s*\*+$|[✔✓]/g, '').trim();
          }
          return body;
        });

        // Tìm đáp án từ dòng "Đáp án: ..." hoặc từ ký hiệu *
        let idxs = [];

        // 1. Từ dòng đáp án tường minh
        const ansLine = blk.find(l => RE_ANS.test(l));
        if (ansLine) {
          const match = ansLine.match(RE_ANS);
          const capture = match[1].trim();
          const letters = extractAnswerLetters(capture);
          if (letters) {
            idxs = letters.map(c => LETTERS.indexOf(c)).filter(i => i >= 0);
          } else {
            // So khớp nội dung text của option
            const norm = s => s.toLowerCase().replace(/[.,;:!?]+$/, '').trim();
            const hit = options.findIndex(o => norm(o) === norm(capture));
            if (hit >= 0) idxs = [hit];
          }
        }

        // 2. Từ dấu * hoặc ✔ trong option
        if (!idxs.length && markedIdxs.length) {
          idxs = markedIdxs;
        }

        // 3. Từ bảng đáp án cuối đề (nếu có số câu khớp)
        if (!idxs.length && answerKeyMap) {
          const qnum = extractQNum(blk[0]);
          if (qnum && answerKeyMap[qnum]) {
            const li = LETTERS.indexOf(answerKeyMap[qnum]);
            if (li >= 0) idxs = [li];
          }
        }

        // Fallback mặc định
        if (!idxs.length) idxs = [0];

        const firstOptIdx = blk.findIndex(l => RE_OPT.test(l));
        const question = stripQNum(blk.slice(0, firstOptIdx).join(' '));
        if (options.length >= 2) {
          if (idxs.length > 1) {
            // Multi-select
            results.push({
              id: Date.now() + Math.random(),
              type: 'multi_select',
              question,
              options: options.length >= 4 ? options : [...options, ...Array(4 - options.length).fill('')],
              correct: idxs
            });
          } else {
            // Single choice
            results.push({
              id: Date.now() + Math.random(),
              type: 'multiple',
              question,
              options: options.length >= 4 ? options : [...options, ...Array(4 - options.length).fill('')],
              correct: idxs[0]
            });
          }
        }
      } else if (hasFill) {
        // Điền vào chỗ trống
        const ansLine = blk.find(l => RE_ANS.test(l));
        const answer = ansLine ? ansLine.match(RE_ANS)[1].trim() : '';
        const question = stripQNum(blk.filter(l => l !== ansLine).join(' '));
        results.push({
          id: Date.now() + Math.random(),
          type: 'fill_blank',
          question,
          answer,
          hint: ''
        });
      }
    }

    // Fallback cuối cùng nếu không parse được gì
    if (!results.length && text.trim().length > 10) {
      results.push({
        id: Date.now() + Math.random(),
        type: 'multiple',
        question: text.trim().slice(0, 200),
        options: ['', '', '', ''],
        correct: 0
      });
    }

    return results;
  }

  /* ── JSON Importer (nâng cấp) ── */
  function importJSON(raw) {
    const data = JSON.parse(raw);
    const arr = Array.isArray(data) ? data : (data.questions || data.data || Object.values(data));
    return arr.map(q => {
      const id = Date.now() + Math.random();
      const t = (q.type || '').toLowerCase();
      const autoTF = !t && q.passage && Array.isArray(q.items) && q.items.length > 0 && 'answer' in (q.items[0] || {});
      const isTF = t === 'true_false' || t === 'trueFalse' || t === 'dung_sai' || autoTF;
      if (isTF) return {
        id,
        type: 'true_false',
        passage: q.passage || q.content || q.doantulieu || '',
        source: q.source || q.nguon || '',
        items: (q.items || q.statements || []).map(it => ({
          text: it.text || it.content || it.statement || '',
          answer: it.answer === true || it.answer === 'true' || it.answer === 'Đúng' || it.answer === 1
        }))
      };
      if (!isTF && (t === 'multi_select' || t === 'multiselect' || t === 'checkbox')) return {
        id,
        type: 'multi_select',
        question: q.question || q.content || q.câu_hỏi || '',
        options: (q.options || q.choices || q.answers || []).map(o => typeof o === 'object' ? (o.text || o.content || o || '') : String(o || '')),
        correct: q.correct || q.correctAnswers || q.answers_correct || [0]
      };
      if (!isTF && (t === 'fill_blank' || t === 'fillblank' || t === 'fill')) return {
        id,
        type: 'fill_blank',
        question: q.question || q.content || '',
        answer: q.answer || q.correct_answer || q.key || '',
        hint: q.hint || q.goi_y || ''
      };
      const opts = q.options || q.choices || [];
      const optsArr = opts.map(o => typeof o === 'object' ? (o.text || o.content || o.label || '') : String(o || ''));
      let correct = 0;
      if (typeof q.correct === 'number') correct = q.correct;
      else if (typeof q.correct === 'string') correct = Math.max(0, LETTERS.indexOf(q.correct.toUpperCase()));
      else if (typeof q.correctAnswer === 'string') correct = Math.max(0, LETTERS.indexOf(q.correctAnswer.toUpperCase()));
      else if (typeof q.answer === 'number') correct = q.answer;
      return {
        id,
        type: 'multiple',
        question: q.question || q.content || q.câu_hỏi || '',
        options: optsArr.length >= 4 ? optsArr : [...optsArr, ...Array(Math.max(0, 4 - optsArr.length)).fill('')],
        correct
      };
    }).map((r, i) => {
      // Giữ lại ảnh minh họa nếu file JSON có (image / imageUrl / img)
      const src = arr[i] || {};
      const im = src.image || src.imageUrl || src.img;
      return im ? {...r, image: String(im)} : r;
    }).filter(q => q.passage || q.question);
  }

  /* ── Empty Factories ── */
  const emptyTF = () => ({
    id: Date.now() + Math.random(),
    type: 'true_false',
    passage: '',
    source: '',
    items: [{text:'', answer:true}, {text:'', answer:false}, {text:'', answer:true}, {text:'', answer:false}]
  });
  const emptyMC = () => ({
    id: Date.now() + Math.random(),
    type: 'multiple',
    question: '',
    options: ['','','',''],
    correct: 0
  });
  const emptyMS = () => ({
    id: Date.now() + Math.random(),
    type: 'multi_select',
    question: '',
    options: ['','','',''],
    correct: [0]
  });
  const emptyFB = () => ({
    id: Date.now() + Math.random(),
    type: 'fill_blank',
    question: '',
    answer: '',
    hint: ''
  });
  const newQ = t => t === 'true_false' ? emptyTF() : t === 'multiple' ? emptyMC() : t === 'multi_select' ? emptyMS() : emptyFB();

  /* ── Exports ── */
  window.LETTERS = LETTERS;
  window.stripHTML = stripHTML;
  window.parseText = parseText;
  window.importJSON = importJSON;
  window.emptyTF = emptyTF;
  window.emptyMC = emptyMC;
  window.emptyMS = emptyMS;
  window.emptyFB = emptyFB;
  window.newQ = newQ;
})();
        
