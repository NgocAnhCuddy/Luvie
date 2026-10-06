// Chạy:  node --test tests/
// Upstash + Supabase giả (stub global fetch) để kiểm tra lớp Redis của các Function.
import test from 'node:test';
import assert from 'node:assert/strict';
import { signToken } from '../functions/api/session.js';
import * as score from '../functions/api/score.js';
import * as cacheFn from '../functions/api/cache.js';
import * as analytics from '../functions/api/analytics.js';
import * as tts from '../functions/api/tts.js';

const SID = '11111111-1111-4111-8111-111111111111';
const SECRET = 'x'.repeat(40);
const realFetch = globalThis.fetch;

function makeWorld({ redisDown = false } = {}) {
  const kv = new Map();         // key -> {v, exp}
  const hll = new Map();        // key -> Set
  const calls = { supa: [], redis: [], tts: 0 };
  const db = { students: [{ id: SID, display_name: 'An', username: 'an', is_active: true }], results: [] };
  const alive = (k) => { const e = kv.get(k); if (!e) return null; if (e.exp && e.exp < Date.now()) { kv.delete(k); return null; } return e; };

  function run(cmd) {
    const [c, k, ...a] = cmd; const C = String(c).toUpperCase();
    if (C === 'GET') { const e = alive(k); return e ? e.v : null; }
    if (C === 'SET') {
      const opts = a.slice(1).map(String); const nx = opts.includes('NX');
      if (nx && alive(k)) return null;
      const exI = opts.indexOf('EX');
      kv.set(k, { v: String(a[0]), exp: exI >= 0 ? Date.now() + Number(opts[exI + 1]) * 1000 : 0 });
      return 'OK';
    }
    if (C === 'DEL') return kv.delete(k) ? 1 : 0;
    if (C === 'INCR') { const e = alive(k); const n = (e ? Number(e.v) : 0) + 1; kv.set(k, { v: String(n), exp: e ? e.exp : 0 }); return n; }
    if (C === 'EXPIRE') {
      const e = alive(k); if (!e) return 0;
      if (String(a[1]).toUpperCase() === 'NX' && e.exp) return 0;
      e.exp = Date.now() + Number(a[0]) * 1000; return 1;
    }
    if (C === 'PFADD') { const s = hll.get(k) || new Set(); s.add(a[0]); hll.set(k, s); return 1; }
    if (C === 'PFCOUNT') return (hll.get(k) || new Set()).size;
    if (C === 'TTL') { const e = alive(k); return e && e.exp ? Math.ceil((e.exp - Date.now()) / 1000) : -1; }
    throw new Error('lệnh chưa giả lập: ' + C);
  }

  globalThis.fetch = async (url, init = {}) => {
    url = String(url);
    if (url.startsWith('https://redis.test')) {
      if (redisDown) throw new Error('redis down');
      const body = JSON.parse(init.body);
      calls.redis.push(url.endsWith('/pipeline') ? body.map(x => x[0]) : [body[0]]);
      const out = url.endsWith('/pipeline') ? body.map(c => ({ result: run(c) })) : { result: run(body) };
      return new Response(JSON.stringify(out), { status: 200 });
    }
    if (url.startsWith('https://supa.test/rest/v1')) {
      const u = new URL(url); const path = u.pathname.replace('/rest/v1', ''); const method = init.method || 'GET';
      calls.supa.push(method + ' ' + path + (u.search.includes('attempt_id') ? '?attempt' : ''));
      const j = (d, s = 200) => new Response(JSON.stringify(d), { status: s });
      if (path === '/students') return j(db.students.filter(s => u.search.includes('id=eq.' + s.id)));
      if (path === '/quiz_results') {
        if (method === 'POST') {
          const row = JSON.parse(init.body);
          if (row.attempt_id && db.results.some(r => r.attempt_id === row.attempt_id && r.student_id === row.student_id)) return j({ code: '23505' }, 409);
          const saved = { id: 'r' + (db.results.length + 1), ...row, deleted_at: null }; db.results.push(saved); return j([saved], 201);
        }
        if (method === 'PATCH') {
          const body = JSON.parse(init.body); const id = u.searchParams.get('id')?.replace('eq.', '');
          const hit = db.results.filter(r => r.id === id || (u.searchParams.get('id') || '').startsWith('in.'));
          hit.forEach(r => Object.assign(r, body)); return j(hit);
        }
        if (u.search.includes('attempt_id=eq.')) {
          const a = u.searchParams.get('attempt_id').replace('eq.', '');
          return j(db.results.filter(r => r.attempt_id === a));
        }
        if (u.search.includes('submitted_at=gte')) return j(db.results.map(r => ({ id: r.id })));
        if (u.search.includes('lesson_id=eq.') && u.search.includes('select=id')) {
          const l = u.searchParams.get('lesson_id').replace('eq.', '');
          return j(db.results.filter(r => !r.deleted_at && r.lesson_id === l).map(r => ({ id: r.id })));
        }
        return j(db.results.filter(r => !r.deleted_at));
      }
    }
    throw new Error('fetch chưa giả lập: ' + url);
  };
  const env = { SUPA_URL: 'https://supa.test', SUPA_KEY: 'k', SESSION_SECRET: SECRET, ADMIN_API_KEY: 'adm',
    UPSTASH_URL: 'https://redis.test', UPSTASH_TOKEN: 't' };
  return { env, kv, hll, calls, db };
}

const post = async (env, attemptId, extra = {}) => {
  const token = await signToken(SID, SECRET);
  const req = new Request('https://app.test/api/score', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ attemptId, lessonId: 'L1', lessonTitle: 'Bài 1', studentId: SID, score: 3, total: 4, perQ: [], ...extra }) });
  return score.onRequest({ request: req, env });
};
const getAdmin = (env, qs) => score.onRequest({ request: new Request('https://app.test/api/score?' + qs, { headers: { 'x-admin-secret': 'adm' } }), env });

test.afterEach(() => { globalThis.fetch = realFetch; });

test('nộp bài: lần 2 cùng attemptId trả kết quả từ Redis, không chạm Supabase', async () => {
  const w = makeWorld();
  const r1 = await (await post(w.env, 'attempt-0001')).json();
  assert.equal(r1.ok, true); assert.equal(r1.diem10, 7.5);
  const supaBefore = w.calls.supa.length;
  const r2 = await (await post(w.env, 'attempt-0001')).json();
  assert.equal(r2.duplicate, true); assert.equal(r2.diem10, 7.5);
  assert.equal(w.calls.supa.length, supaBefore, 'lần trùng không được gọi Supabase');
  assert.equal(w.db.results.length, 1);
});

test('nộp bài: học sinh được cache → lần nộp 2 không tra bảng students lại', async () => {
  const w = makeWorld();
  await post(w.env, 'attempt-0001'); await post(w.env, 'attempt-0002');
  assert.equal(w.calls.supa.filter(c => c.endsWith('/students')).length, 1);
});

test('khóa học sinh: DEL stu:active qua /api/cache có hiệu lực ngay', async () => {
  const w = makeWorld();
  await post(w.env, 'attempt-0001');
  w.db.students[0].is_active = false;
  // chưa DEL → vẫn dùng cache cũ (tối đa 120s)
  assert.equal((await post(w.env, 'attempt-0002')).status, 200);
  const del = await cacheFn.onRequestPost({ request: new Request('https://app.test/api/cache', { method: 'POST', body: JSON.stringify(['DEL', 'stu:active:' + SID]) }), env: w.env });
  assert.equal(del.status, 200);
  const r = await post(w.env, 'attempt-0003');
  assert.equal(r.status, 403);
});

test('/api/cache: stu:active chỉ cho DEL, không cho GET/SET', () => {
  const k = 'stu:active:' + SID;
  assert.equal(cacheFn.validateCommand(['DEL', k]), null);
  assert.ok(cacheFn.validateCommand(['SET', k, '{"is_active":true}']));
  assert.ok(cacheFn.validateCommand(['GET', k]));
  assert.equal(cacheFn.validateCommand(['GET', 'lessons_cache']), null);
  assert.ok(cacheFn.validateCommand(['FLUSHALL', 'x']));
});

test('rate-limit: lần thứ 9 trong 60s bị 429 (Redis)', async () => {
  const w = makeWorld(); const codes = [];
  for (let i = 0; i < 9; i++) codes.push((await post(w.env, 'attempt-' + String(i).padStart(4, '0'))).status);
  assert.deepEqual(codes.slice(0, 8), Array(8).fill(200)); assert.equal(codes[8], 429);
});

test('nộp song song cùng attemptId: chỉ 1 dòng, request thứ hai không mất điểm', async () => {
  const w = makeWorld();
  const [a, b] = await Promise.all([post(w.env, 'attempt-race1'), post(w.env, 'attempt-race1')]);
  assert.equal(w.db.results.length, 1);
  assert.ok([a.status, b.status].includes(200));
  assert.ok([a.status, b.status].every(s => s === 200 || s === 429), 'request còn lại phải là 200 hoặc 429 (để client gửi lại)');
});

test('Redis sập → nộp bài vẫn chạy bằng đường Supabase (fail-open)', async () => {
  const w = makeWorld({ redisDown: true });
  const r1 = await (await post(w.env, 'attempt-0001')).json();
  assert.equal(r1.ok, true);
  const r2 = await (await post(w.env, 'attempt-0001')).json();
  assert.equal(r2.duplicate, true);
  assert.equal(w.db.results.length, 1);
});

test('admin ?all=1: cache 30s, nộp mới làm cache hết hiệu lực', async () => {
  const w = makeWorld();
  await post(w.env, 'attempt-0001');
  const a = await getAdmin(w.env, 'all=1&limit=50');
  assert.equal(a.headers.get('X-Redis-Cache'), 'MISS');
  const n1 = w.calls.supa.length;
  const b = await getAdmin(w.env, 'all=1&limit=50');
  assert.equal(b.headers.get('X-Redis-Cache'), 'HIT'); assert.equal(w.calls.supa.length, n1);
  assert.equal((await b.json()).count, 1);
  await post(w.env, 'attempt-0002', { lessonId: 'L2' });
  const c = await getAdmin(w.env, 'all=1&limit=50');
  assert.equal(c.headers.get('X-Redis-Cache'), 'MISS'); assert.equal((await c.json()).count, 2);
});

test('admin: không có x-admin-secret thì không lấy được cache', async () => {
  const w = makeWorld(); await post(w.env, 'attempt-0001'); await getAdmin(w.env, 'all=1');
  const r = await score.onRequest({ request: new Request('https://app.test/api/score?all=1'), env: w.env });
  assert.equal(r.status, 403);
});

test('analytics: đếm lượt + học sinh hoạt động (HLL), admin đọc được', async () => {
  const w = makeWorld(); const token = await signToken(SID, SECRET);
  const ev = (headers = {}) => analytics.onRequestPost({ request: new Request('https://app.test/api/analytics', { method: 'POST', headers, body: JSON.stringify({ event: 'lesson_start' }) }), env: w.env });
  assert.equal((await ev({ Authorization: 'Bearer ' + token })).status, 204);
  await ev({ Authorization: 'Bearer ' + token }); await ev();
  const r = await analytics.onRequestGet({ request: new Request('https://app.test/api/analytics?days=2', { headers: { 'x-admin-secret': 'adm' } }), env: w.env });
  const today = (await r.json()).days[0];
  assert.equal(today.lesson_start, 3); assert.equal(today.active, 1);
  const denied = await analytics.onRequestGet({ request: new Request('https://app.test/api/analytics'), env: w.env });
  assert.equal(denied.status, 403);
});

test('analytics: EXPIRE NX → TTL không bị đẩy lùi mỗi lần đếm', async () => {
  const w = makeWorld();
  const send = () => analytics.onRequestPost({ request: new Request('https://app.test/api/analytics', { method: 'POST', body: JSON.stringify({ event: 'quiz_complete' }) }), env: w.env });
  await send(); const key = [...w.kv.keys()].find(k => k.includes('quiz_complete'));
  const exp1 = w.kv.get(key).exp; await new Promise(r => setTimeout(r, 15)); await send();
  assert.equal(w.kv.get(key).exp, exp1);
});

test('tts: rate-limit theo IP trả 429 khi vượt ngưỡng; Redis sập thì vẫn chạy', async () => {
  const w = makeWorld(); w.env.EDGE_TTS_WORKER_URL = 'https://tts.test'; w.env.TTS_RATE_PER_MIN = '2';
  const inner = globalThis.fetch;
  globalThis.fetch = async (u, i) => String(u).startsWith('https://tts.test') ? new Response(new Uint8Array([1, 2, 3]), { status: 200 }) : inner(u, i);
  const call = (text, env = w.env) => tts.onRequestPost({ request: new Request('https://app.test/api/tts', { method: 'POST', headers: { 'CF-Connecting-IP': '9.9.9.9' }, body: JSON.stringify({ text }) }), env });
  assert.equal((await call('a')).status, 200); assert.equal((await call('b')).status, 200);
  assert.equal((await call('c')).status, 429);
  const down = makeWorld({ redisDown: true }); down.env.EDGE_TTS_WORKER_URL = 'https://tts.test';
  const inner2 = globalThis.fetch;
  globalThis.fetch = async (u, i) => String(u).startsWith('https://tts.test') ? new Response(new Uint8Array([1]), { status: 200 }) : inner2(u, i);
  assert.equal((await call('d', down.env)).status, 200);
});
