/**
 * functions/_lib/student-cache.js — cache trạng thái học sinh (tồn tại / is_active)
 *
 * /api/score (nộp bài) và /api/session (PUT gia hạn) đều phải kiểm tra học sinh
 * còn tồn tại và chưa bị khóa → mỗi lần 1 request Supabase. Cache 120 giây ở Redis.
 *
 *  • Khóa:  stu:active:<studentId>   (giá trị JSON nhỏ)
 *  • Admin khóa / xóa / sửa học sinh → admin client gọi DEL khóa này qua /api/cache
 *    (xem student-manager.jsx) nên hiệu lực gần như tức thì. Nếu bước DEL lỡ thất bại
 *    thì TTL 120s là mức trễ tối đa.
 *  • Redis lỗi / chưa cấu hình → quay về hỏi Supabase như cũ (fail-open về nguồn gốc dữ liệu).
 *  • Chỉ cache khi học sinh TỒN TẠI (không cache "không tồn tại").
 */
import { redisCmdSafe, defer } from './redis.js';

export const STUDENT_TTL_SEC = 120;
export const studentKey = (sid) => `stu:active:${sid}`;

/**
 * @param load  async () => ({ ok:boolean, status?:number, student: object|null })
 * @returns     cùng dạng với load() + cached:boolean
 */
export async function getStudentCached(env, ctx, sid, load) {
  const key = studentKey(sid);
  const hit = await redisCmdSafe(env, ['GET', key]);
  if (typeof hit === 'string') {
    try {
      const s = JSON.parse(hit);
      if (s && typeof s === 'object') return { ok: true, student: s, cached: true };
    } catch { /* khóa hỏng → bỏ qua, hỏi lại DB */ }
  }

  const r = await load();
  // hit === undefined nghĩa là Redis đang không dùng được → khỏi tốn thêm một lệnh SET
  if (r && r.ok && r.student && hit !== undefined) {
    const s = r.student;
    const slim = { id: s.id, display_name: s.display_name ?? null, username: s.username ?? null, is_active: s.is_active };
    await defer(ctx, redisCmdSafe(env, ['SET', key, JSON.stringify(slim), 'EX', STUDENT_TTL_SEC]));
  }
  return { ...r, cached: false };
}

export async function invalidateStudent(env, sid) {
  return redisCmdSafe(env, ['DEL', studentKey(sid)]);
}
