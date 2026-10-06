/**
 * ══════════════════════════════════════════════════════════════════
 *  /functions/api/verify-full.js  —  "AI Full": kiểm đáp án CẢ BÀI trong 1 lần (CHỈ ADMIN)
 *
 *  POST /api/verify-full   header: x-admin-secret
 *  body: { title?, subject?, questions:[ {type, ...} ], force?:boolean }
 *        (mỗi câu có đúng dạng như /api/verify: multiple | multi_select |
 *         true_false | fill_blank)
 *
 *  → { ok:true, usedSearch:false, cached, calls,
 *      summary:{ dung, sai, khong_chac, bo_qua },
 *      results:[{ n, type, verdict:'dung'|'sai'|'khong_chac', note, fix }],
 *      skipped:[{ n, reason }] }
 *
 *  Khác /api/verify:
 *   • KHÔNG tìm kiếm web theo từng câu → không tốn lượt Brave/Tavily.
 *   • Gom nhiều câu vào MỘT lần gọi Workers AI (tối đa CHUNK_MAX câu / lần),
 *     đầu ra rút gọn (câu "đúng" không kèm lời giải thích) → tiết kiệm token.
 *   • Cache 30 ngày theo nội dung từng nhóm câu → chạy lại bài không đổi = 0 token.
 *   • AI CHỈ cảnh báo, KHÔNG tự sửa đáp án.
 *
 *  Cấu hình Cloudflare Pages (giống /api/verify):
 *   • Functions → Bindings → Workers AI → Variable name: AI
 *   • ADMIN_API_KEY                 (đã có)
 *   • VERIFY_MODEL                  (tuỳ chọn) mặc định @cf/openai/gpt-oss-120b
 *   • VERIFY_FULL_DAILY_LIMIT       (tuỳ chọn) số lần gọi AI / ngày, mặc định 40
 *   • UPSTASH_URL, UPSTASH_TOKEN    (đã có) — cache + đếm lượt
 * ══════════════════════════════════════════════════════════════════
 */
import { normalizeQuestion, stripHtml, extractText } from './verify.js';

const JSON_H = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const reply = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: JSON_H });

const DEFAULT_MODEL = '@cf/openai/gpt-oss-120b';
const DEFAULT_DAILY_LIMIT = 40;     // số LẦN gọi AI / ngày (mỗi nhóm câu = 1 lần)
const CACHE_TTL_SEC = 30 * 24 * 3600;
const MAX_QUESTIONS = 60;           // trần số câu / yêu cầu
const CHUNK_MAX = 15;               // tối đa số câu / 1 lần gọi AI
const CHUNK_CHARS = 9000;           // tối đa ký tự nội dung / 1 lần gọi AI
const CTX_CHARS = 900;              // cắt mỗi câu
const enc = new TextEncoder();

const cut = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

function safeEqual(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

async function redis(env, cmd) {
  if (!env.UPSTASH_URL || !env.UPSTASH_TOKEN) return null;
  try {
    const r = await fetch(env.UPSTASH_URL, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.UPSTASH_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmd),
    });
    const d = await r.json().catch(() => null);
    return d ? d.result : null;
  } catch { return null; }
}

/** Tăng bộ đếm lượt gọi AI của AI Full trong ngày (UTC). Null nếu không có Redis. */
async function bumpDaily(env) {
  const key = `verifyfull:day:${new Date().toISOString().slice(0, 10)}`;
  const n = await redis(env, ['INCR', key]);
  if (n === 1) await redis(env, ['EXPIRE', key, 2 * 24 * 3600]);
  return typeof n === 'number' ? n : null;
}

/** Gom các câu đã chuẩn hoá thành nhóm theo số câu + số ký tự. */
export function makeChunks(items) {
  const chunks = [];
  let cur = [], chars = 0;
  for (const it of items) {
    const len = it.text.length;
    if (cur.length && (cur.length >= CHUNK_MAX || chars + len > CHUNK_CHARS)) {
      chunks.push(cur); cur = []; chars = 0;
    }
    cur.push(it); chars += len;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

const SYSTEM_PROMPT = `Bạn là trợ lý kiểm tra đáp án cho giáo viên (website ôn tập của học sinh Việt Nam).
Bạn nhận NHIỀU câu hỏi đánh số, mỗi câu kèm đáp án giáo viên đang đặt. Với MỖI câu, đánh giá đáp án đó bằng kiến thức chắc chắn của bạn.
Quy tắc bắt buộc:
- v = "dung" nếu đáp án đặt đúng; "sai" CHỈ khi bạn chắc chắn nó sai; còn mơ hồ, thiếu dữ kiện, nhiều đáp án hợp lý, cần tra cứu → "khong_chac". Không đoán.
- Với câu nhiều ý đúng/sai: chỉ cần MỘT ý sai là v = "sai" và nêu ý nào trong note.
- note: tiếng Việt, TỐI ĐA 15 từ, nêu căn cứ. Nếu v = "dung" thì để chuỗi rỗng.
- fix: chỉ khi v = "sai", ghi đáp án bạn cho là đúng (ngắn gọn); còn lại để chuỗi rỗng.
- n phải đúng số thứ tự câu đã cho. Trả lời đủ MỌI câu.
Chỉ trả về MỘT mảng JSON, không kèm văn bản nào khác:
[{"n":1,"v":"dung","note":"","fix":""}]`;

/** Tách các đối tượng {"n":..} từ văn bản — chịu được ```json … ```, chữ thừa và mảng bị cắt giữa chừng. */
export function parseBatch(text) {
  const out = new Map();
  const s = String(text || '');
  const objs = s.match(/\{[^{}]*\}/g) || [];
  for (const raw of objs) {
    let o;
    try { o = JSON.parse(raw); } catch { continue; }
    const n = Number(o && o.n);
    if (!Number.isInteger(n) || n < 1) continue;
    const verdict = ['dung', 'sai', 'khong_chac'].includes(o.v) ? o.v : 'khong_chac';
    out.set(n, {
      verdict,
      note: verdict === 'dung' ? '' : cut(stripHtml(o.note), 220),
      fix: verdict === 'sai' ? cut(stripHtml(o.fix), 200) : '',
    });
  }
  return out;
}

async function askAI(env, model, userText) {
  const body = {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userText },
    ],
    max_tokens: 2600,
    temperature: 0.1,
  };
  try {
    // Cố gắng giảm "suy luận" để tiết kiệm token; nếu model không nhận tham số này thì chạy lại bình thường.
    return await env.AI.run(model, { ...body, reasoning: { effort: 'low' } });
  } catch {
    return await env.AI.run(model, body);
  }
}

export async function onRequest(ctx) {
  const { request, env } = ctx;
  if (request.method !== 'POST') return reply({ error: 'Method Not Allowed' }, 405);

  const key = (env.ADMIN_API_KEY || '').trim();
  if (!key || !safeEqual(request.headers.get('x-admin-secret'), key)) {
    return reply({ error: 'Forbidden' }, 403);
  }
  if (!env.AI) return reply({ error: 'Chưa gắn binding Workers AI (tên biến: AI)' }, 503);

  try {
    const body = await request.json().catch(() => null);
    const list = body && Array.isArray(body.questions) ? body.questions : null;
    if (!list || !list.length) return reply({ error: 'Bài chưa có câu hỏi nào để kiểm' }, 400);
    if (list.length > MAX_QUESTIONS) {
      return reply({ error: `Bài có ${list.length} câu, AI Full kiểm tối đa ${MAX_QUESTIONS} câu / lần. Hãy tách bài ra.` }, 400);
    }

    const model = (env.VERIFY_MODEL || DEFAULT_MODEL).trim();
    const subject = cut(stripHtml(body.subject), 60);
    const lessonTitle = cut(stripHtml(body.title), 120);

    // 1) Chuẩn hoá từng câu; câu thiếu nội dung/đáp án thì bỏ qua (không tốn token)
    const skipped = [];
    const items = [];
    list.forEach((q, i) => {
      const n = i + 1;
      const nq = normalizeQuestion(q);
      if (!nq) { skipped.push({ n, reason: 'Thiếu nội dung câu hỏi hoặc chưa chọn đáp án' }); return; }
      const text = `#${n} [${nq.type}]\n${cut(nq.context, CTX_CHARS)}\n${nq.claim}`;
      items.push({ n, type: nq.type, text });
    });
    if (!items.length) return reply({ error: 'Chưa có câu nào đủ nội dung và đáp án để kiểm' }, 400);

    const header = (subject || lessonTitle)
      ? `Bài: ${[lessonTitle, subject && `môn ${subject}`].filter(Boolean).join(' — ')}\n\n` : '';

    // 2) Chia nhóm; mỗi nhóm = 1 lần gọi AI (thường cả bài chỉ 1 lần)
    const chunks = makeChunks(items);
    const limit = Number(env.VERIFY_FULL_DAILY_LIMIT) || DEFAULT_DAILY_LIMIT;

    const results = new Map();   // n → {verdict,note,fix}
    let calls = 0, cachedChunks = 0, quotaHit = false;

    const runChunk = async (chunk) => {
      const userText = header + chunk.map(c => c.text).join('\n\n');
      const ck = 'verifyfull:v1:' + await sha256Hex(model + '\n' + userText);

      if (!body.force) {
        const hit = await redis(env, ['GET', ck]);
        if (hit) {
          try {
            const arr = JSON.parse(hit);
            if (Array.isArray(arr)) { arr.forEach(([n, v]) => results.set(n, v)); cachedChunks++; return; }
          } catch { /* cache hỏng → chạy lại */ }
        }
      }

      const used = await bumpDaily(env);
      if (used !== null && used > limit) { quotaHit = true; return; }

      calls++;
      const ai = await askAI(env, model, userText);
      const parsed = parseBatch(extractText(ai));
      const toCache = [];
      for (const c of chunk) {
        const r = parsed.get(c.n) || { verdict: 'khong_chac', note: 'AI không trả lời câu này, thử chạy lại', fix: '' };
        results.set(c.n, r);
        if (parsed.has(c.n)) toCache.push([c.n, r]);
      }
      // Chỉ cache khi AI trả đủ mọi câu của nhóm
      if (toCache.length === chunk.length) await redis(env, ['SET', ck, JSON.stringify(toCache), 'EX', CACHE_TTL_SEC]);
    };

    await Promise.all(chunks.map(runChunk));

    if (quotaHit && !results.size) {
      return reply({ error: `Đã hết ${limit} lượt AI Full hôm nay (đặt lại 00:00 UTC). Thử lại ngày mai.` }, 429);
    }

    // 3) Tổng hợp
    const out = [];
    const summary = { dung: 0, sai: 0, khong_chac: 0, bo_qua: skipped.length };
    for (const it of items) {
      const r = results.get(it.n);
      if (!r) { skipped.push({ n: it.n, reason: 'Hết lượt AI hôm nay, chưa kiểm được câu này' }); summary.bo_qua++; continue; }
      summary[r.verdict]++;
      out.push({ n: it.n, type: it.type, verdict: r.verdict, note: r.note, fix: r.fix });
    }
    skipped.sort((a, b) => a.n - b.n);

    return reply({
      ok: true, usedSearch: false, calls, cached: calls === 0 && cachedChunks > 0,
      partial: quotaHit, summary, results: out, skipped,
    });
  } catch (e) {
    console.error('[verify-full]', e && e.message || e);
    return reply({ error: 'Lỗi xử lý' }, 500);
  }
}
