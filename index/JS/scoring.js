/* ══════════════════════════════════════════════════════════════════
   SCORING.JS · Learnsy · MỘT nguồn sự thật cho việc chấm điểm
   ─────────────────────────────────────────────────────────────────
   Trước đây điểm được tính ở 3 nơi với 3 cách khác nhau
   (quiz-player, save-result, server) nên dễ lệch. Giờ mọi nơi dùng
   chung các hàm này.

   Quy ước điểm:
   - Trắc nghiệm 1 đáp án / nhiều đáp án / điền khuyết: 1 điểm/câu.
   - Đúng-sai (nhiều ý): mỗi ý đúng = 0.25 điểm.
   - Điểm thang 10 = score / total * 10, làm tròn 2 chữ số thập phân
     (KHÔNG làm tròn score/total thành số nguyên).
   ══════════════════════════════════════════════════════════════════ */

const TF_UNIT = 0.25;

/** Chuẩn hóa chuỗi điền khuyết: bỏ HTML, thường hóa, gộp khoảng trắng, chuẩn hóa dấu / và ' . */
export function normText(s) {
  return String(s == null ? '' : s)
    .replace(/<[^>]*>/g, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\u2018\u2019`\u00B4]/g, "'")   // ’ ‘ ` ´ → '
    .replace(/\s*[\/\uFF0F]\s*/g, '/')        // "A / B" = "A/B" = "A /B"
    .replace(/\s+/g, ' ')
    .replace(/[.!?]+$/, '')                     // bỏ dấu chấm cuối
    .trim();
}

function sameSet(a, b) {
  const x = [...(a || [])].map(Number).sort((p, q) => p - q);
  const y = [...(b || [])].map(Number).sort((p, q) => p - q);
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

function strip(s) {
  return String(s == null ? '' : s).replace(/<[^>]*>/g, '').trim();
}

/**
 * Chấm 1 câu. Trả về:
 *  { got, max, ok, partial, correctAns, userAns, qText, type }
 */
export function gradeQuestion(q, ans) {
  const type = q.type;
  const qText = strip(q.question || q.passage || q.content || '').slice(0, 120);
  const out = { type, qText, got: 0, max: 0, ok: false, partial: false, correctAns: '', userAns: '' };

  if (type === 'true_false') {
    const items = q.items || [];
    const arr = Array.isArray(ans) ? ans : [];
    const right = items.filter((it, i) => arr[i] === it.answer).length;
    out.max = items.length * TF_UNIT;
    out.got = right * TF_UNIT;
    out.ok = items.length > 0 && right === items.length;
    out.partial = !out.ok && right > 0;
    out.correctAns = items.map((it, i) => `${String.fromCharCode(97 + i)}:${it.answer ? 'Đ' : 'S'}`).join(' ');
    out.userAns = items.map((_, i) => `${String.fromCharCode(97 + i)}:${arr[i] === true ? 'Đ' : arr[i] === false ? 'S' : '–'}`).join(' ');
  } else if (type === 'multiple') {
    out.max = 1;
    out.ok = ans === q.correct;
    out.got = out.ok ? 1 : 0;
    out.correctAns = strip(q.options?.[q.correct] ?? String(q.correct));
    out.userAns = ans == null ? '' : strip(q.options?.[ans] ?? String(ans));
  } else if (type === 'multi_select') {
    const a = Array.isArray(ans) ? ans : [];
    const c = q.correct || [];
    out.max = 1;
    out.ok = sameSet(a, c);
    out.got = out.ok ? 1 : 0;
    out.partial = !out.ok && a.some(x => c.includes(x));
    out.correctAns = c.map(i => strip(q.options?.[i] ?? i)).join(', ');
    out.userAns = a.map(i => strip(q.options?.[i] ?? i)).join(', ');
  } else if (type === 'fill_blank') {
    out.max = 1;
    out.ok = normText(ans) !== '' && normText(ans) === normText(q.answer);
    out.got = out.ok ? 1 : 0;
    out.correctAns = strip(q.answer || '');
    out.userAns = strip(ans || '');
  }
  // Loại câu khác (đoạn văn, tiêu đề…) → max=0, không tính điểm.
  return out;
}

/**
 * Chấm cả bài.
 * @returns {{ s:number, t:number, perQ:Array, diem10:number, pct:number }}
 *   s = điểm đạt, t = tổng điểm (đều là số thực, KHÔNG làm tròn nguyên)
 */
export function gradeAll(questions, answers) {
  let s = 0, t = 0;
  const perQ = (questions || []).map((q, i) => {
    const g = gradeQuestion(q, (answers || [])[i]);
    s += g.got;
    t += g.max;
    return g;
  });
  // Loại lỗi dấu phẩy động (0.25*3 = 0.75 chính xác, nhưng cộng dồn có thể lệch)
  s = Math.round(s * 100) / 100;
  t = Math.round(t * 100) / 100;
  return { s, t, perQ, ...toScale(s, t) };
}

/** Quy đổi (score,total) → điểm thang 10 và phần trăm. */
export function toScale(score, total) {
  const sc = Number(score), tt = Number(total);
  if (!Number.isFinite(sc) || !Number.isFinite(tt) || tt <= 0) return { diem10: 0, pct: 0 };
  const ratio = Math.min(1, Math.max(0, sc / tt));
  return {
    diem10: Math.round(ratio * 1000) / 100, // 2 chữ số thập phân, vd 7.75
    pct: Math.round(ratio * 100),
  };
}

/** Xếp loại theo điểm thang 10. */
export function xepLoai(diem10) {
  if (diem10 >= 9)   return { label: 'Xuất sắc',    emoji: '🏆', color: '#10b981' };
  if (diem10 >= 8)   return { label: 'Giỏi',        emoji: '🥇', color: '#f59e0b' };
  if (diem10 >= 6.5) return { label: 'Khá',         emoji: '🥈', color: '#a855f7' };
  if (diem10 >= 5)   return { label: 'Trung bình',  emoji: '👍', color: '#f472b6' };
  return               { label: 'Cần cố gắng', emoji: '📚', color: '#ef4444' };
}

/** Định dạng: 10 thay vì 10.00, 7.75 giữ nguyên, 7.5 thay vì 7.50. */
export function fmtNum(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0';
  return String(Math.round(n * 100) / 100);
}

if (typeof window !== 'undefined') {
  window.LearnsyScoring = { gradeAll, gradeQuestion, toScale, xepLoai, normText, fmtNum };
}
