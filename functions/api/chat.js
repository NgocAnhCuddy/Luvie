/**
 * Cloudflare Pages Function — /api/chat
 * Binding cần tạo trong Pages dashboard:
 *   Workers AI → Variable name: "AI"
 *
 * POST /api/chat   { messages: [{role, content}] }   + header x-admin-secret
 * → trả về { reply: "..." }
 *
 * BẢO MẬT: không có màn hình nào của app gọi endpoint này, nhưng trước đây nó
 * mở công khai (CORS *) và chạy Workers AI cho bất kỳ ai → tốn quota/tiền và
 * có thể bị lạm dụng làm chatbot miễn phí. Nay chỉ admin (x-admin-secret) dùng
 * được, giới hạn độ dài, và chỉ nhận role user/assistant.
 */

const JSON_H = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const reply = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: JSON_H });

const MAX_MESSAGES = 10;
const MAX_CONTENT_CHARS = 2000;

function safeEqual(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Làm sạch danh sách tin nhắn; trả null nếu không hợp lệ. */
export function sanitizeMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return null;
  const out = [];
  for (const m of messages.slice(-MAX_MESSAGES)) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) return null; // không cho role "system"
    if (typeof m.content !== 'string' || !m.content.trim()) return null;
    out.push({ role: m.role, content: m.content.slice(0, MAX_CONTENT_CHARS) });
  }
  return out;
}

export async function onRequest(ctx) {
  const { request, env } = ctx;

  if (request.method !== 'POST') return reply({ error: 'Method Not Allowed' }, 405);

  const key = (env.ADMIN_API_KEY || '').trim();
  if (!key || !safeEqual(request.headers.get('x-admin-secret'), key)) {
    return reply({ error: 'Forbidden' }, 403);
  }
  if (!env.AI) return reply({ error: 'AI not bound' }, 503);

  try {
    const body = await request.json().catch(() => null);
    const msgs = sanitizeMessages(body?.messages);
    if (!msgs) return reply({ error: 'messages không hợp lệ' }, 400);

    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: msgs,
      max_tokens: 512,
    });
    return reply({ reply: response.response || '(Không có phản hồi)' });
  } catch (e) {
    console.error('[chat]', e?.message ?? e);
    return reply({ error: 'Lỗi xử lý' }, 500); // không lộ chi tiết nội bộ
  }
}
