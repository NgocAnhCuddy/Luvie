/* ══════════════════════════════════════════════════════════════════
   functions/api/tts.js — Cloudflare Pages Function
   Proxy gọi sang Worker Edge TTS (DIYgod/cloudflare-edge-tts) để tránh
   CORS — browser chỉ cần gọi cùng-origin '/api/tts'.
   Cấu hình: vào Cloudflare Pages → Settings → Environment variables,
   thêm EDGE_TTS_WORKER_URL = https://<tên-worker-của-em>.workers.dev
   (URL này có được sau khi `wrangler deploy` repo cloudflare-edge-tts.)
══════════════════════════════════════════════════════════════════ */

import { rateCount, shaKey, defer } from '../_lib/redis.js';

/* Bổ sung (Upstash):
   • Rate-limit theo IP bằng Redis (INCR + EXPIRE NX). Mặc định 120 yêu cầu/phút/IP
     (cả lớp thường chung 1 IP mạng trường) — đổi bằng env TTS_RATE_PER_MIN.
     Chỉ tính các lần THẬT SỰ gọi worker TTS; lần trúng cache không tính.
   • Cache audio: dùng Cloudflare Cache API (caches.default) chứ KHÔNG nhét mp3 vào Redis —
     mỗi đoạn nghe vài trăm KB, sẽ nhanh chóng ngốn dung lượng/băng thông gói Upstash.
     Cùng (giọng + văn bản) → 1 lần gọi worker, các lần sau phát từ cache 7 ngày.
   • Redis lỗi/chưa cấu hình → bỏ qua rate-limit (fail-open), TTS vẫn chạy bình thường. */

const DEFAULT_RATE_PER_MIN = 120;
const AUDIO_CACHE_TTL_SEC = 7 * 24 * 3600;
const AUDIO_CACHE_MAX_BYTES = 8 * 1024 * 1024;

const DEFAULT_VOICE = 'en-US-AvaMultilingualNeural'; // giọng nữ AI, tự nhiên
const MAX_CHARS = 4000; // chặn text quá dài (đoạn nghe thường < 1000 ký tự)

// Client chỉ gửi `text` (không gửi voice). Chỉ cho phép các giọng đã duyệt để
// không ai dùng endpoint này làm proxy gọi giọng/tham số tùy ý tới worker TTS.
const ALLOWED_VOICES = new Set([
  'en-US-AvaMultilingualNeural',
  'en-US-AndrewMultilingualNeural',
  'en-US-JennyNeural',
  'en-US-GuyNeural',
  'en-GB-SoniaNeural',
  'en-GB-RyanNeural',
]);

function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  try { return new URL(origin).host === new URL(request.url).host; } catch { return false; }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // Chỉ trang này được gọi (chống trang khác nhúng dùng quota TTS của bạn)
  if (!sameOrigin(request)) return new Response('Forbidden', { status: 403 });

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const text = (body?.text || '').toString().trim();
  if (!text) return new Response('Missing "text"', { status: 400 });
  if (text.length > MAX_CHARS) {
    return new Response(`Text quá dài (>${MAX_CHARS} ký tự)`, { status: 400 });
  }

  const reqVoice = (body?.voice || DEFAULT_VOICE).toString();
  const voice = ALLOWED_VOICES.has(reqVoice) ? reqVoice : DEFAULT_VOICE;
  const upstream = env.EDGE_TTS_WORKER_URL;
  if (!upstream) {
    return new Response(
      'Chưa cấu hình EDGE_TTS_WORKER_URL trong Cloudflare Pages env vars',
      { status: 500 }
    );
  }

  // ── Cache audio (Cache API) ─────────────────────────────────
  const edgeCache = (typeof caches !== 'undefined' && caches.default) ? caches.default : null;
  const cacheReq = edgeCache
    ? new Request('https://tts-cache.internal/v1/' + await shaKey(voice + '\n' + text, 32))
    : null;
  if (edgeCache) {
    try {
      const hit = await edgeCache.match(cacheReq);
      if (hit) {
        const h = new Headers(hit.headers);
        h.set('X-TTS-Cache', 'HIT');
        return new Response(hit.body, { status: 200, headers: h });
      }
    } catch { /* cache lỗi → gọi worker như thường */ }
  }

  // ── Rate-limit theo IP (chỉ khi thật sự gọi worker) ─────────
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for') || 'unknown';
  const limit = Number(env.TTS_RATE_PER_MIN) || DEFAULT_RATE_PER_MIN;
  const n = await rateCount(env, 'rl:tts:' + await shaKey(ip), 60);
  if (n !== undefined && n > limit) {
    return new Response('Quá nhiều yêu cầu giọng đọc, thử lại sau ít phút', {
      status: 429, headers: { 'Retry-After': '30' },
    });
  }

  let res;
  try {
    res = await fetch(`${upstream.replace(/\/$/, '')}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
    });
  } catch (e) {
    console.error('[tts] gọi worker lỗi:', e?.message ?? e);
    return new Response('Không gọi được dịch vụ giọng đọc', { status: 502 });
  }

  if (!res.ok || !res.body) {
    return new Response('Edge TTS worker lỗi: ' + res.status, { status: 502 });
  }

  // Đọc hết audio để vừa trả về cho client vừa lưu cache
  const audio = await res.arrayBuffer();
  if (!audio.byteLength) return new Response('Edge TTS worker trả về rỗng', { status: 502 });

  if (edgeCache && audio.byteLength <= AUDIO_CACHE_MAX_BYTES) {
    await defer(context, edgeCache.put(cacheReq, new Response(audio.slice(0), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=' + AUDIO_CACHE_TTL_SEC,
      },
    })));
  }

  return new Response(audio, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'private, max-age=86400', // trình duyệt cache 1 ngày
      'X-TTS-Cache': 'MISS',
    },
  });
}

export async function onRequestOptions() {
  // Không mở CORS: chỉ cùng-origin dùng endpoint này.
  return new Response(null, { status: 204 });
}
