/* functions/api/cache.js — Cloudflare Pages Function
   Proxy Upstash Redis REST API.
   Env vars cần có: UPSTASH_URL, UPSTASH_TOKEN

   BẢO MẬT: trước đây endpoint này chuyển TIẾP MỌI lệnh Redis từ bất kỳ ai
   (kể cả FLUSHALL, hay SET lessons_cache để thay đề bài mọi học sinh đang thấy).
   Nay chỉ cho phép:
     • lệnh  GET / SET / DEL
     • trên các khóa mà app thực sự dùng (whitelist theo tiền tố)
     • cùng-origin đối với SET/DEL, giá trị tối đa 6 MB (ảnh nền dạng data URL)
*/

const FULL = new Set(['GET', 'SET', 'DEL']);
const DEL_ONLY = new Set(['DEL']);

// Khóa app thực sự dùng, kèm lệnh được phép trên từng nhóm khóa:
//   lessons_cache                  danh sách bài học            GET/SET/DEL
//   avatar:user:<id>               ảnh đại diện                 GET/SET/DEL
//   learnsy_bg:<...>               ảnh/cài đặt nền              GET/SET/DEL
//   stu:active:<uuid>              cache trạng thái học sinh    CHỈ DEL
//       (do server ghi ở /api/score + /api/session; client chỉ được XÓA khi admin
//        khóa/xóa/sửa học sinh — KHÔNG cho SET để học sinh không tự "mở khóa" cache)
const KEY_RULES = [
  { re: /^(lessons_cache|avatar:user:[A-Za-z0-9_-]{1,64}|learnsy_bg:[A-Za-z0-9:_-]{1,120})$/, cmds: FULL },
  { re: /^stu:active:[0-9a-fA-F-]{36}$/, cmds: DEL_ONLY },
];

const MAX_BODY_BYTES = 6 * 1024 * 1024;

const J = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const reply = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: J });

function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true; // request không phải từ trình duyệt
  try { return new URL(origin).host === new URL(request.url).host; } catch { return false; }
}

/** Trả chuỗi lỗi nếu lệnh không hợp lệ, ngược lại null. */
export function validateCommand(args) {
  if (!Array.isArray(args) || args.length < 2 || args.length > 6) return 'Invalid args';
  const cmd = String(args[0]).toUpperCase();
  if (!FULL.has(cmd)) return 'Lệnh không được phép';
  const key = args[1];
  const rule = typeof key === 'string' ? KEY_RULES.find((r) => r.re.test(key)) : null;
  if (!rule) return 'Khóa không được phép';
  if (!rule.cmds.has(cmd)) return 'Lệnh không được phép trên khóa này';
  if (cmd === 'GET' || cmd === 'DEL') { if (args.length !== 2) return 'Invalid args'; }
  if (cmd === 'SET') {
    if (args.length !== 2 + 1 && args.length !== 2 + 3) return 'Invalid args'; // SET k v  |  SET k v EX n
    if (typeof args[2] !== 'string') return 'Giá trị phải là chuỗi';
    if (args.length === 5) {
      if (String(args[3]).toUpperCase() !== 'EX') return 'Tùy chọn không được phép';
      const ttl = Number(args[4]);
      if (!Number.isInteger(ttl) || ttl < 1 || ttl > 31 * 24 * 3600) return 'TTL không hợp lệ';
    }
  }
  return null;
}

export async function onRequestPost(ctx) {
  try {
    if (!sameOrigin(ctx.request)) return reply({ result: null, error: 'Origin không hợp lệ' }, 403);

    const len = Number(ctx.request.headers.get('Content-Length') || 0);
    if (len > MAX_BODY_BYTES) return reply({ result: null, error: 'Quá lớn' }, 413);

    const text = await ctx.request.text();
    if (text.length > MAX_BODY_BYTES) return reply({ result: null, error: 'Quá lớn' }, 413);
    let args;
    try { args = JSON.parse(text); } catch { return reply({ result: null, error: 'Invalid args' }, 400); }

    const bad = validateCommand(args);
    if (bad) return reply({ result: null, error: bad }, 400);

    const url = ctx.env.UPSTASH_URL;
    const token = ctx.env.UPSTASH_TOKEN;
    if (!url || !token) return reply({ result: null, error: 'Missing env vars' }, 500);

    args[0] = String(args[0]).toUpperCase();

    // Upstash REST: dùng JSON body thay vì URL path để tránh giới hạn URL length
    // (quan trọng khi SET value lớn như base64 ảnh)
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    const data = await res.json();
    return reply({ result: data.result ?? null });
  } catch (e) {
    return reply({ result: null, error: e.message }, 500);
  }
}

export async function onRequestOptions() {
  // Không còn CORS mở '*': chỉ cùng-origin dùng endpoint này.
  return new Response(null, { status: 204 });
}
