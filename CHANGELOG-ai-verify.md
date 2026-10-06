# Kiểm đáp án bằng AI + tìm kiếm web (chỉ admin)

## Thêm mới
- `functions/api/verify.js` — Pages Function. Tìm web → đưa kết quả cho Workers AI (mặc định `@cf/openai/gpt-oss-120b`) → trả `dung | sai | khong_chac` + lý do + nguồn.
- `admin/JS/question-editor.jsx` — nút **"Kiểm đáp án bằng AI"** ở cuối mỗi câu hỏi (mở câu ra để thấy). Hỗ trợ 4 loại: trắc nghiệm, nhiều đáp án, đúng/sai, điền khuyết.

## Thiết lập (Cloudflare Pages → Settings)
1. **Functions → Bindings → Workers AI**, Variable name: `AI` (đã có nếu `/api/chat` đang chạy).
2. **Environment variables** (Production):
   - `ADMIN_API_KEY` — đã có.
   - `SEARCH_PROVIDER` = `brave` | `tavily` | `google` (mặc định `brave`)
   - Khoá tương ứng: `BRAVE_API_KEY` / `TAVILY_API_KEY` / `GOOGLE_CSE_KEY` + `GOOGLE_CSE_CX`
   - Tuỳ chọn: `VERIFY_MODEL`, `VERIFY_DAILY_LIMIT` (mặc định 80 lượt/ngày)
3. Deploy lại.

## An toàn / tiết kiệm
- Chỉ admin: bắt buộc header `x-admin-secret` (cùng cơ chế `/api/score`, `/api/chat`). Học sinh không gọi được.
- Cache Upstash 30 ngày theo nội dung + đáp án → mỗi câu chỉ tốn 1 lượt.
- Trần `VERIFY_DAILY_LIMIT`/ngày (UTC) để không cạn 10.000 neurons miễn phí.
- Tìm web thất bại → trả `khong_chac`, **không** để AI đoán.
- URL nguồn do AI trả về được lọc: chỉ giữ URL có thật trong kết quả tìm kiếm.
- AI chỉ cảnh báo, **không tự sửa** đáp án.

## Đã kiểm thử
Chuẩn hoá 4 loại câu, parse JSON (có ```json), 3 dạng output của Workers AI, 403/405/400/503/429, cache hit, lọc nguồn bịa, lỗi tìm kiếm. Chưa gọi Workers AI/API tìm kiếm thật (môi trường không có mạng).
