/**
 * ══════════════════════════════════════════════════════════════════
 *  /functions/api/verify.js  —  Kiểm đáp án bằng AI + tìm kiếm web (CHỈ ADMIN)
 *
 *  POST /api/verify   header: x-admin-secret
 *  body: { question }   — object câu hỏi đúng như trong trình soạn:
 *     multiple      { type, question, options[], correct:number }
 *     multi_select  { type, question, options[], correct:number[] }
 *     true_false    { type, passage, items:[{text, answer:boolean}] }
 *     fill_blank    { type, question, answer }
 *
 *  → { ok:true, verdict:'dung'|'sai'|'khong_chac', confidence:0-1,
 *      reason, suggestion, sources:[{title,url}], cached, usedSearch }
 *
 *  Luồng: tìm kiếm web → đưa kết quả cho Workers AI → AI trả JSON.
 *  AI KHÔNG tự sửa đáp án; chỉ cảnh báo để admin quyết định.
 *
 *  Cấu hình Cloudflare Pages (Settings):
 *   • Functions → Bindings → Workers AI → Variable name: AI
 *   • Environment variables:
 *       ADMIN_API_KEY            (đã có — dùng chung với /api/chat)
 *       SEARCH_PROVIDER          'brave' | 'tavily' | 'google'   (mặc định 'brave')
 *       BRAVE_API_KEY            nếu dùng brave
 *       TAVILY_API_KEY           nếu dùng tavily
 *       GOOGLE_CSE_KEY, GOOGLE_CSE_CX   nếu dùng google
 *       VERIFY_MODEL             (tuỳ chọn) mặc định @cf/openai/gpt-oss-120b
 *       VERIFY_DAILY_LIMIT       (tuỳ chọn) mặc định 80 lượt/ngày
 *       UPSTASH_URL, UPSTASH_TOKEN   (đã có) — cache kết quả + đếm lượt/ngày
 * ══════════════════════════════════════════════════════════════════
 */

const JSON_H = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const reply = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: JSON_H });

const DEFAULT_MODEL = '@cf/openai/gpt-oss-120b';
const DEFAULT_DAILY_LIMIT = 80;
const CACHE_TTL_SEC = 30 * 24 * 3600;
const MAX_TEXT = 1200;          // cắt mỗi đoạn văn bản gửi lên
const MAX_ITEMS = 8;
const SEARCH_RESULTS = 5;
const SNIPPET_CHARS = 420;
const enc = new TextEncoder();

function safeEqual(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Bỏ thẻ HTML + entity cơ bản (câu hỏi lưu dạng HTML từ trình soạn rich-text). */
export function stripHtml(s) {
  return String(s ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
const cut = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/**
 * Chuẩn hoá câu hỏi thành { claim, context, query } hoặc null nếu không hợp lệ.
 *  claim   = "đáp án mà admin đang đặt" (để AI đối chiếu)
 *  context = nội dung câu hỏi đầy đủ
 *  query   = chuỗi tìm kiếm ngắn
 */
export function normalizeQuestion(q) {
  if (!q || typeof q !== 'object') return null;
  const type = q.type;

  if (type === 'multiple' || type === 'multi_select') {
    const stem = stripHtml(q.question);
    const opts = Array.isArray(q.options) ? q.options.slice(0, 8).map(o => cut(stripHtml(o), 300)) : [];
    if (!stem || opts.length < 2) return null;
    const idx = type === 'multiple' ? [q.correct] : (Array.isArray(q.correct) ? q.correct : []);
    const valid = idx.filter(i => Number.isInteger(i) && i >= 0 && i < opts.length);
    if (!valid.length) return null;
    const claim = valid.map(i => `${LETTERS[i]}. ${opts[i]}`).join(' | ');
    const context = `Câu hỏi: ${cut(stem, MAX_TEXT)}\n` + opts.map((o, i) => `${LETTERS[i]}. ${o}`).join('\n');
    const query = cut(`${stem} ${valid.map(i => opts[i]).join(' ')}`, 200);
    return { type, claim: `Đáp án đang đặt: ${claim}`, context, query };
  }

  if (type === 'true_false') {
    const passage = stripHtml(q.passage);
    const items = Array.isArray(q.items) ? q.items.slice(0, MAX_ITEMS) : [];
    if (!items.length) return null;
    const lines = items.map((it, i) => `${String.fromCharCode(97 + i)}) ${cut(stripHtml(it?.text), 400)} → đang đặt: ${it?.answer ? 'ĐÚNG' : 'SAI'}`);
    const context = (passage ? `Tư liệu: ${cut(passage, MAX_TEXT)}\n` : '') + 'Các ý:\n' + lines.join('\n');
    const query = cut(`${passage} ${items.map(it => stripHtml(it?.text)).join(' ')}`, 200);
    return { type, claim: 'Các ý và đáp án đang đặt: xem bên trên', context, query };
  }

  if (type === 'fill_blank') {
    const stem = stripHtml(q.question);
    const ans = stripHtml(q.answer);
    if (!stem || !ans) return null;
    return {
      type,
      claim: `Đáp án đang đặt: ${cut(ans, 200)}`,
      context: `Câu hỏi điền khuyết: ${cut(stem, MAX_TEXT)}`,
      query: cut(`${stem} ${ans}`, 200),
    };
  }
  return null;
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

/** Tăng bộ đếm lượt gọi AI trong ngày (UTC). Trả số lượt SAU khi tăng; null nếu không có Redis. */
async function bumpDaily(env) {
  const key = `verify:day:${new Date().toISOString().slice(0, 10)}`;
  const n = await redis(env, ['INCR', key]);
  if (n === 1) await redis(env, ['EXPIRE', key, 2 * 24 * 3600]);
  return typeof n === 'number' ? n : null;
}

/* ── Tìm kiếm web: chọn nhà cung cấp qua SEARCH_PROVIDER ─────────── */
async function webSearch(env, query) {
  const provider = String(env.SEARCH_PROVIDER || 'brave').toLowerCase();
  const timeout = AbortSignal.timeout(9000);

  if (provider === 'tavily') {
    if (!env.TAVILY_API_KEY) throw new Error('Thiếu TAVILY_API_KEY');
    const r = await fetch('https://api.tavily.com/search', {
      method: 'POST', signal: timeout,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.TAVILY_API_KEY },
      body: JSON.stringify({ query, max_results: SEARCH_RESULTS, search_depth: 'basic' }),
    });
    if (!r.ok) throw new Error('Tavily ' + r.status);
    const d = await r.json();
    return (d.results || []).map(x => ({ title: x.title, url: x.url, snippet: x.content }));
  }

  if (provider === 'google') {
    if (!env.GOOGLE_CSE_KEY || !env.GOOGLE_CSE_CX) throw new Error('Thiếu GOOGLE_CSE_KEY / GOOGLE_CSE_CX');
    const u = new URL('https://www.googleapis.com/customsearch/v1');
    u.searchParams.set('key', env.GOOGLE_CSE_KEY);
    u.searchParams.set('cx', env.GOOGLE_CSE_CX);
    u.searchParams.set('q', query);
    u.searchParams.set('num', String(SEARCH_RESULTS));
    u.searchParams.set('hl', 'vi');
    const r = await fetch(u, { signal: timeout });
    if (!r.ok) throw new Error('Google CSE ' + r.status);
    const d = await r.json();
    return (d.items || []).map(x => ({ title: x.title, url: x.link, snippet: x.snippet }));
  }

  // mặc định: brave
  if (!env.BRAVE_API_KEY) throw new Error('Thiếu BRAVE_API_KEY');
  const u = new URL('https://api.search.brave.com/res/v1/web/search');
  u.searchParams.set('q', query);
  u.searchParams.set('count', String(SEARCH_RESULTS));
  u.searchParams.set('country', 'vn');
  u.searchParams.set('search_lang', 'vi');
  const r = await fetch(u, {
    signal: timeout,
    headers: { Accept: 'application/json', 'X-Subscription-Token': env.BRAVE_API_KEY },
  });
  if (!r.ok) throw new Error('Brave ' + r.status);
  const d = await r.json();
  return ((d.web && d.web.results) || []).map(x => ({ title: x.title, url: x.url, snippet: x.description }));
}

const SYSTEM_PROMPT = `Bạn là người kiểm tra đáp án cho một website ôn tập của học sinh Việt Nam.
Nhiệm vụ: đối chiếu đáp án giáo viên đang đặt với KẾT QUẢ TÌM KIẾM được cung cấp.
Quy tắc bắt buộc:
- Chỉ kết luận "dung" hoặc "sai" khi kết quả tìm kiếm hoặc kiến thức chắc chắn của bạn xác nhận rõ ràng.
- Nếu nguồn không đủ, mâu thuẫn nhau, hoặc câu hỏi mơ hồ → trả "khong_chac". Không đoán.
- Với câu nhiều ý đúng/sai: nếu CÓ ÍT NHẤT MỘT ý sai hoặc không chắc, nêu cụ thể ý nào trong "reason".
- "sources" chỉ gồm URL có trong kết quả tìm kiếm. Không bịa URL.
- "reason" tối đa 3 câu, tiếng Việt, nói rõ căn cứ.
- "suggestion": nếu verdict là "sai", ghi đáp án bạn cho là đúng; ngược lại để chuỗi rỗng.
Chỉ trả về MỘT đối tượng JSON, không kèm văn bản nào khác:
{"verdict":"dung|sai|khong_chac","confidence":0.0,"reason":"...","suggestion":"...","sources":["https://..."]}`;

/** Lấy văn bản trả lời từ nhiều dạng output khác nhau của Workers AI. */
export function extractText(r) {
  if (!r) return '';
  if (typeof r === 'string') return r;
  if (typeof r.response === 'string' && r.response) return r.response;
  const c = r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content;
  if (typeof c === 'string' && c) return c;
  if (Array.isArray(r.output)) {
    const parts = [];
    for (const o of r.output) {
      if (o && Array.isArray(o.content)) for (const p of o.content) if (p && typeof p.text === 'string') parts.push(p.text);
    }
    if (parts.length) return parts.join('');
  }
  return '';
}

/** Tách đối tượng JSON đầu tiên từ văn bản (chịu được ```json … ``` và chữ thừa). */
export function parseVerdict(text) {
  const m = String(text || '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  let o;
  try { o = JSON.parse(m[0]); } catch { return null; }
  const verdict = ['dung', 'sai', 'khong_chac'].includes(o.verdict) ? o.verdict : 'khong_chac';
  let confidence = Number(o.confidence);
  if (!Number.isFinite(confidence)) confidence = 0;
  confidence = Math.max(0, Math.min(1, confidence));
  return {
    verdict,
    confidence,
    reason: cut(String(o.reason || ''), 600),
    suggestion: cut(String(o.suggestion || ''), 300),
    sources: Array.isArray(o.sources) ? o.sources.filter(u => typeof u === 'string').slice(0, 5) : [],
  };
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
    const nq = normalizeQuestion(body && body.question);
    if (!nq) return reply({ error: 'Câu hỏi không hợp lệ hoặc chưa có đáp án' }, 400);

    const model = (env.VERIFY_MODEL || DEFAULT_MODEL).trim();

    // 1) Cache — cùng nội dung + cùng đáp án thì không tốn thêm lượt nào
    const ck = 'verify:v1:' + await sha256Hex(model + '\n' + nq.context + '\n' + nq.claim);
    const hit = await redis(env, ['GET', ck]);
    if (hit && !body.force) {
      try { return reply({ ok: true, cached: true, ...JSON.parse(hit) }); } catch { /* cache hỏng → chạy lại */ }
    }

    // 2) Giới hạn lượt/ngày — bảo vệ hạn mức neurons miễn phí
    const limit = Number(env.VERIFY_DAILY_LIMIT) || DEFAULT_DAILY_LIMIT;
    const used = await bumpDaily(env);
    if (used !== null && used > limit) {
      return reply({ error: `Đã hết ${limit} lượt kiểm hôm nay (đặt lại 00:00 UTC). Thử lại ngày mai.` }, 429);
    }

    // 3) Tìm kiếm web
    let results = [];
    let searchError = '';
    try { results = await webSearch(env, nq.query); }
    catch (e) { searchError = String(e && e.message || e); }
    results = results.filter(r => r && r.url).slice(0, SEARCH_RESULTS);

    if (!results.length) {
      // Không có nguồn → không để AI đoán. Trả "không chắc" và báo rõ lý do.
      return reply({
        ok: true, cached: false, usedSearch: false,
        verdict: 'khong_chac', confidence: 0, suggestion: '', sources: [],
        reason: searchError
          ? 'Không tìm kiếm được trên web (' + searchError + '). Chưa thể đối chiếu.'
          : 'Tìm kiếm không trả về kết quả nào. Chưa thể đối chiếu.',
      });
    }

    const evidence = results.map((r, i) =>
      `[${i + 1}] ${cut(stripHtml(r.title), 140)}\nURL: ${r.url}\n${cut(stripHtml(r.snippet), SNIPPET_CHARS)}`).join('\n\n');

    // 4) Hỏi AI
    const ai = await env.AI.run(model, {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `${nq.context}\n\n${nq.claim}\n\nKẾT QUẢ TÌM KIẾM:\n${evidence}` },
      ],
      max_tokens: 700,
      temperature: 0.1,
    });
    const parsed = parseVerdict(extractText(ai));
    if (!parsed) return reply({ error: 'AI trả về định dạng không đọc được, thử lại.' }, 502);

    // Chỉ giữ nguồn có thật trong kết quả tìm kiếm (chặn URL do AI bịa)
    const known = new Map(results.map(r => [r.url, stripHtml(r.title)]));
    const sources = parsed.sources.filter(u => known.has(u)).map(u => ({ title: known.get(u), url: u }));
    const out = {
      usedSearch: true,
      verdict: parsed.verdict,
      confidence: parsed.confidence,
      reason: parsed.reason,
      suggestion: parsed.suggestion,
      sources: sources.length ? sources : results.slice(0, 2).map(r => ({ title: stripHtml(r.title), url: r.url })),
    };
    await redis(env, ['SET', ck, JSON.stringify(out), 'EX', CACHE_TTL_SEC]);
    return reply({ ok: true, cached: false, ...out });
  } catch (e) {
    console.error('[verify]', e && e.message || e);
    return reply({ error: 'Lỗi xử lý' }, 500);
  }
}
