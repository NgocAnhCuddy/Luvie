-- ══════════════════════════════════════════════════════════════════
--  Learnsy · Migration: điểm số chính xác + lịch sử làm bài thật
--  Chạy MỘT LẦN trong Supabase → SQL Editor. An toàn chạy lại nhiều lần.
--
--  Làm gì:
--   1. score/total đổi sang NUMERIC(8,2)  → giữ được 7.75 (trước là số nguyên
--      nên bị làm tròn thành 8).
--   2. Thêm attempt_id  → chống lưu trùng khi mạng chập chờn / gửi lại.
--   3. Thêm deleted_at  → xóa mềm; xóa rồi thì không hiện lại ở học sinh.
--   4. Bỏ UNIQUE(student_id, lesson_id) → mỗi lần làm là 1 dòng (có lịch sử).
--   5. Thêm các cột diem10/pct/xep_loai/per_q/... nếu còn thiếu.
--   6. Index cho truy vấn lịch sử.
-- ══════════════════════════════════════════════════════════════════

begin;

-- 0) Kiểm tra bảng tồn tại. Nếu chưa có, DỪNG với thông báo rõ ràng thay vì lỗi khó hiểu.
do $$
begin
  if to_regclass('public.quiz_results') is null then
    raise exception 'Bảng public.quiz_results chưa tồn tại. Tạo bảng trước (id, student_id, student_name, lesson_id, lesson_title, score, total, created_at) rồi chạy lại migration này.';
  end if;
end $$;

-- 0b) Bản sao lưu MỘT LẦN trước khi đổi kiểu cột (an toàn nếu cần quay lại).
--     Xóa bảng này sau khi bạn đã kiểm tra xong:  drop table public.quiz_results_backup_20260921;
create table if not exists public.quiz_results_backup_20260921 as
  select * from public.quiz_results;

-- 1) Kiểu số thực cho điểm (giữ 7.75 thay vì làm tròn)
alter table public.quiz_results
  alter column score type numeric(8,2) using score::numeric,
  alter column total type numeric(8,2) using total::numeric;

-- 2) Các cột bổ sung (nếu chưa có)
alter table public.quiz_results add column if not exists attempt_id     text;
alter table public.quiz_results add column if not exists deleted_at     timestamptz;
alter table public.quiz_results add column if not exists diem10         numeric(4,2);
alter table public.quiz_results add column if not exists pct            integer;
alter table public.quiz_results add column if not exists xep_loai       text;
alter table public.quiz_results add column if not exists per_q          jsonb   default '[]'::jsonb;
alter table public.quiz_results add column if not exists question_count integer;
alter table public.quiz_results add column if not exists duration_sec   integer;
alter table public.quiz_results add column if not exists submitted_at   timestamptz default now();

-- 3) Bỏ ràng buộc UNIQUE cũ (student_id, lesson_id) — nó khiến làm lại bài
--    ghi đè lần trước. Tìm theo định nghĩa để không phụ thuộc tên constraint.
do $$
declare r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.quiz_results'::regclass
      and c.contype = 'u'
      and (
        select array_agg(a.attname::text order by a.attname)
        from unnest(c.conkey) k
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k
      ) = array['lesson_id','student_id']
  loop
    execute format('alter table public.quiz_results drop constraint %I', r.conname);
  end loop;
end $$;

-- Có thể còn là UNIQUE INDEX (không phải constraint)
do $$
declare r record;
begin
  for r in
    select i.indexname
    from pg_indexes i
    where i.schemaname = 'public' and i.tablename = 'quiz_results'
      and i.indexdef ilike '%unique%'
      and i.indexdef ilike '%student_id%' and i.indexdef ilike '%lesson_id%'
      and i.indexdef not ilike '%attempt_id%'
  loop
    execute format('drop index if exists public.%I', r.indexname);
  end loop;
end $$;

-- 4) Điền dữ liệu cũ còn thiếu
update public.quiz_results
set submitted_at = coalesce(submitted_at, created_at, now())
where submitted_at is null;

update public.quiz_results
set diem10 = round(least(1, greatest(0, score / nullif(total,0))) * 10, 2)
where diem10 is null and total > 0;

update public.quiz_results
set pct = round(least(1, greatest(0, score / nullif(total,0))) * 100)
where pct is null and total > 0;

-- 4b) Dữ liệu cũ không thể hiện ở lịch sử của ai (student_id rỗng): đánh dấu đã xóa mềm
--     để không xuất hiện trong thống kê admin. Vẫn còn trong bảng sao lưu ở trên.
update public.quiz_results
set deleted_at = coalesce(deleted_at, now())
where student_id is null and deleted_at is null;

-- 5) Chống trùng: 1 attempt_id / học sinh chỉ có 1 dòng
create unique index if not exists quiz_results_attempt_uniq
  on public.quiz_results (student_id, attempt_id)
  where attempt_id is not null;

-- 6) Index cho lịch sử (chỉ dòng chưa xóa)
create index if not exists quiz_results_student_hist_idx
  on public.quiz_results (student_id, submitted_at desc)
  where deleted_at is null;

create index if not exists quiz_results_lesson_idx
  on public.quiz_results (lesson_id, submitted_at desc)
  where deleted_at is null;

commit;

-- ══════════════════════════════════════════════════════════════════
--  KIỂM TRA SAU KHI CHẠY (tùy chọn)
--    select column_name, data_type from information_schema.columns
--    where table_name = 'quiz_results' order by ordinal_position;
--
--  LƯU Ý RLS: server (Cloudflare Function) dùng SUPA_KEY. Nếu key đó là
--  anon/publishable, bảng quiz_results cần policy cho phép SELECT/INSERT/
--  UPDATE qua key này; hoặc dùng service_role key cho Function (khuyên dùng,
--  vì Function chạy phía server, không lộ ra trình duyệt).
-- ══════════════════════════════════════════════════════════════════
