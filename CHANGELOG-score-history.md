# Sửa lỗi điểm số / lịch sử / tự đăng xuất

## BẮT BUỘC trước khi deploy
1. Supabase → SQL Editor → chạy `supabase/migrations/2026_score_history.sql` (chạy lại nhiều lần an toàn).
2. Cloudflare Pages → biến môi trường (thêm mới: **SESSION_SECRET**):
   - `SESSION_SECRET` = chuỗi ngẫu nhiên ≥ 32 ký tự (`openssl rand -hex 32`). Dùng để ký token
     đăng nhập 72h. Chưa đặt → API điểm chạy chế độ cũ (không token) và ghi cảnh báo vào log;
     `/api/session` trả 500 và app tự dùng đường đăng nhập cũ. Đặt rồi thì BẮT BUỘC token.
     Học sinh đang đăng nhập bằng phiên cũ sẽ phải đăng nhập lại 1 lần.
   - `SUPA_KEY` nên là **service_role** cho Function (chỉ chạy phía server), hoặc bảng
     `quiz_results` phải có policy cho SELECT/INSERT/UPDATE.
   - `ADMIN_API_KEY` đã đặt (admin xoá kết quả dùng key này).
3. `npm run build`, deploy. Trình duyệt sẽ tự nhận service worker mới (v2).

## Cách kiểm tra nhanh
- Nộp bài → Lịch sử hiện 1 dòng. Làm lại → 2 dòng.
- Xoá 1 dòng / xoá tất cả → tải lại trang, đăng xuất rồi đăng nhập lại: KHÔNG hiện lại.
- Admin xoá kết quả → học sinh làm mới trang cũng không thấy.
- Đổi đồng hồ máy +73h (hoặc sửa `lastActive` trong `ls_session_v2`) → mở lại app bị đăng xuất.

## Xác thực (mới)
- `POST /api/session` gọi lại Edge Function `student-login` rồi cấp token HMAC-SHA256 hạn 72h.
- `/api/score`: nộp/xem/xóa lịch sử của học sinh yêu cầu token đúng chủ tài khoản.
  Xem theo bài (mọi học sinh) chỉ dành cho admin (`x-admin-secret`).
- Token hết hạn/sai → 401 → app đăng xuất; điểm chưa gửi được giữ trong hàng đợi, gửi lại sau khi đăng nhập.

## Bảo mật bổ sung (phát hiện khi rà soát)
- **`/api/cache`** trước đây chuyển tiếp MỌI lệnh Redis từ bất kỳ ai (FLUSHALL, hay SET `lessons_cache` để
  thay đề bài mọi học sinh). Nay chỉ cho GET/SET/DEL trên các khóa app dùng (`lessons_cache`,
  `avatar:user:*`, `learnsy_bg:*`), cùng-origin, TTL hợp lệ, tối đa 6 MB.
- **`/api/config`** trước đây trả `ADMIN_API_KEY` cho mọi người, mà khóa giải mã lại nằm công khai trong
  `index.html` → học sinh nào cũng lấy được khóa admin. Nay chỉ trả khi request kèm JWT Supabase Auth hợp lệ
  của admin (học sinh không dùng Supabase Auth nên không có). `admin.html` nạp khóa sau khi đăng nhập.
  Tùy chọn: đặt `ADMIN_EMAILS=a@x.com,b@y.com` để chỉ những email này nhận khóa.
- ⚠️ `window.__ENC_KEY` vẫn nằm cứng trong `index.html`/`admin.html`. Nay nó chỉ che `supaUrl`/`supaKey`
  (vốn là khóa công khai/anon) nên không còn nghiêm trọng, nhưng không nên coi là bí mật.
  Nếu bạn từng công khai repo này, hãy ĐỔI `ADMIN_API_KEY`, `CONFIG_SECRET` và mọi khóa liên quan.

## Các lỗi khác đã sửa (rà soát lần cuối)
- **Đăng nhập chống dò mật khẩu:** `/api/session` khóa tạm 15 phút sau 5 lần sai/tên đăng nhập hoặc 60 lần sai/IP
  (cần `UPSTASH_URL`/`UPSTASH_TOKEN`; chưa cấu hình thì bỏ qua, không khóa nhầm). Ngưỡng IP cao vì cả lớp thường
  chung 1 IP mạng trường. Redis lỗi → vẫn cho đăng nhập (fail-open).
- **`/api/chat`** không có màn hình nào dùng nhưng mở công khai chạy Workers AI (tốn quota). Nay chỉ admin dùng được.
- **`/api/analytics`** không tồn tại (mỗi lượt học phí 1-2 request 404). Đã tạo, nhận sự kiện có kiểm soát,
  KHÔNG lưu điểm (điểm chính thức chỉ ở `/api/score`).
- **`/api/tts`** chỉ nhận từ cùng trang, giọng đọc theo danh sách duyệt, không lộ lỗi nội bộ.
- **Luyện từ vựng:** ngày ghi tiến độ dùng UTC (học 0h–7h sáng bị ghi sang hôm trước) → nay dùng giờ địa phương;
  trước chỉ ghi 1 lần/ngày/unit nên học thêm không được cập nhật → nay ghi khi có tiến bộ.
- **Khóa localStorage theo máy** (`vmaster_`, `ivbest_`, `quizstate_`, `vocabsave_`) → nay gắn theo học sinh; bài làm
  dở gắn theo ID bài (trước là tiêu đề + số câu nên 2 bài trùng tên trộn đáp án).

## Đã kiểm chứng bằng trình duyệt thật (Chromium/Playwright)
Toàn bộ luồng dưới đây đã chạy trên build thật (esbuild) trong Chromium, không chỉ đọc code:
- Học sinh: đăng nhập sai/đúng, làm đủ 3 loại câu (trắc nghiệm, đúng/sai, điền khuyết), nộp bài — điểm
  server nhận đúng 2.75/3 = 9.17/10 (không làm tròn thành 3/3 như code cũ).
- Làm lại cùng bài cùng điểm → ghi 2 lần riêng biệt, không ghi đè.
- Xóa 1 dòng / xóa hết lịch sử → tải lại trang → dòng đã xóa **không hiện lại**, cache cũng rỗng.
- Không hoạt động 71h → còn phiên; 73h → tự đăng xuất, xóa sạch dữ liệu phiên, hiện thông báo giải thích
  (cả khi mở lại app sau khi đóng, lẫn khi đang mở tab mà quá hạn).
- Admin: đăng nhập, nhận đúng ADMIN_API_KEY sau khi có phiên Supabase Auth, xem đủ kết quả qua server
  (có gửi kèm x-admin-secret), xóa từng dòng / xóa tất cả — sau đó học sinh tải lại KHÔNG còn thấy các
  kết quả đó nữa (đã xác nhận vòng khép kín admin→học sinh).
- Không có lỗi JavaScript nào xuất hiện trong toàn bộ các luồng trên.

## Đã biết / chưa làm
- `ADMIN_API_KEY` được `admin.html` đưa xuống trình duyệt admin (kiến trúc có sẵn), nên ai mở được
  trang admin đều có key này. Muốn chặt hơn cần đăng nhập admin phía server.
- Admin xem kết quả qua `GET /api/score?all=1` (x-admin-secret), không còn đọc thẳng Supabase.

## Gia hạn phiên theo hoạt động
- `PUT /api/session` đổi token còn hạn lấy token mới 72h (client tự gọi khi token > 12h tuổi và
  người dùng còn hoạt động). Dùng đều đặn thì không bao giờ bị đá ra; bỏ 72h thì phải đăng nhập lại.
- Tài khoản bị khóa/xóa thì không gia hạn được. Lỗi mạng/Supabase tạm thời thì giữ token cũ, không đăng xuất nhầm.
