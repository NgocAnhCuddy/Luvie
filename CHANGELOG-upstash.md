# Tận dụng Upstash Redis (UPSTASH_URL / UPSTASH_TOKEN)

Không cần biến môi trường mới. Chưa cấu hình Upstash hoặc Redis lỗi/timeout (1,5s) → mọi chỗ dưới đây
tự quay về đường Supabase cũ (fail-open), không chặn học sinh.

## Mới / đổi
| Chỗ | Trước | Nay |
|---|---|---|
| `POST /api/score` | 3 request Supabase trước khi ghi (tra học sinh, tra trùng `attemptId`, đếm rate-limit) | Trạng thái học sinh cache 120s · rate-limit `INCR+EXPIRE NX` · trùng lặp: kết quả lưu 7 ngày + khóa `SET NX` chống nộp song song. Khóa bị nhả nếu ghi DB lỗi |
| `PUT /api/session` | tra `students` mỗi lần gia hạn | dùng chung cache học sinh với `/api/score` |
| `GET /api/score?all=1` / `?lessonId=` (admin) | truy vấn Supabase mỗi lần mở | cache 30s; nộp mới / xóa điểm làm cache hết hiệu lực (khóa phiên bản `score:ver`). Header `X-Redis-Cache: HIT/MISS` |
| `/api/tts` | không giới hạn, không cache | rate-limit theo IP (mặc định 120/phút, env `TTS_RATE_PER_MIN`) · audio cache 7 ngày bằng Cloudflare Cache API (không nhét mp3 vào Redis) |
| `/api/analytics` | 2 request (`INCR`, `EXPIRE`), TTL bị đẩy lùi mỗi lần | 1 pipeline, `EXPIRE NX` · thêm đếm số học sinh hoạt động/ngày bằng HyperLogLog (client gửi kèm token) · `GET ?days=14` cho admin |
| `/api/session` đăng nhập | tới 4 request nối tiếp khi ghi lần sai, 2 khi kiểm tra | 1 pipeline mỗi bước |
| Dashboard admin | — | thẻ "Lượt học 14 ngày" (mở trong tab Kết quả) |

## Phải biết
- **Admin khóa / mở khóa / xóa / sửa học sinh** → `student-manager.jsx` gọi `DEL stu:active:<id>` qua `/api/cache`
  để có hiệu lực ngay. Nếu bước này lỡ lỗi, cache hết hạn sau tối đa 120s.
- `/api/cache` chỉ cho client **DEL** khóa `stu:active:*` (không GET/SET) để học sinh không tự ghi cache.
- Số đếm "học sinh hoạt động" chỉ tính từ khi deploy bản này và chỉ khi học sinh đang đăng nhập (có token).
- Số lệnh Redis/ngày: mỗi lần nộp bài ≈ 5–7 lệnh (gom trong pipeline nên ít request hơn). Xem quota gói Upstash.

## Kiểm tra
`npm test` — 12 test với Upstash + Supabase giả (nộp trùng, race, rate-limit, khóa học sinh, cache admin,
analytics, TTS, Redis sập). `npm run build` đã chạy qua.
