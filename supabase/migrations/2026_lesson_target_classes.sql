-- ══════════════════════════════════════════════════════════════════
--  Learnsy · Migration: chỉ định bài học theo lớp
--  Chạy MỘT LẦN trong Supabase → SQL Editor. An toàn chạy lại nhiều lần.
--
--  target_classes:
--    NULL          → bài dành cho TẤT CẢ học sinh (mọi bài cũ giữ nguyên)
--    {'11A7','11A8'} → chỉ học sinh thuộc các lớp đó thấy bài
--    {}            → chưa chọn lớp nào (chưa học sinh nào thấy)
--  Tên lớp lấy từ students.class_name (cùng nguồn với tab "Học sinh").
-- ══════════════════════════════════════════════════════════════════
alter table public.lessons
  add column if not exists target_classes text[] default null;
