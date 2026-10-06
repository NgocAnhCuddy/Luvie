# Đợt sửa lỗi tháng 10/2026 (3.23.7)

## Đã sửa
- `index/JS/ripple-haptic.jsx` + `index/JS/main.jsx`: `useRipple` và `haptic` chỉ là biến cục bộ của module nên
  `home-screen.jsx` (gọi `useRipple()` trần) và `quiz-player.jsx` (kiểm tra `typeof useRipple`) không thấy được →
  hiệu ứng ripple/rung ở màn làm bài bị tắt, có thể lỗi ở bản build Vite/terser. Nay gán lên `window`, nạp trước các component.
- `admin/JS/ux-nung.jsx`: gõ email/mật khẩu/tìm kiếm bị tính là "vừa soạn bài" → ngay sau đăng nhập admin hiện toast
  "Lưu rồi! Admin giỏi lắm 💕" dù chưa lưu gì. Nay bỏ qua các ô password/email/search.
- `index/JS/components/files-tab.jsx`: bỏ `POST /api/track-file-view` (endpoint không tồn tại, luôn 404 mỗi lần mở tài liệu).

## Đã kiểm thử (Chromium + Supabase/API giả, Tone/Pixi giả — chưa chạy `vite build` thật)
Học sinh: trang chủ, 5 tab, làm bài 4 loại câu, nộp bài + gửi điểm, Học vui, Học cấp tốc, Từ vựng (6 chế độ), Luyện nghe.
Admin: đăng nhập, 5 khu vực, trình soạn bài. Không có lỗi JS.

## Chưa làm / cần bạn kiểm tra
- Chưa chạy `npm run build` (máy kiểm thử không có mạng) → build thử trước khi deploy.
- `/api/verify`, `/api/tts` và các Cloudflare Function chưa chạy thử thật.
- Admin panel ngoài khu "Bài học" chưa lên giao diện 2.0.
- Chưa có danh sách lỗi cụ thể từ bạn nên chưa sửa lỗi nào ngoài các mục trên.

## Logo "Luvie"
- Chữ logo đổi Learnsy / TA&NA → **Luvie** (header học sinh, đăng nhập học sinh, mục giới thiệu, admin, file HTML xuất ra).
- Font viết tay **Satisfy** (Google Fonts, đã thêm vào index.html, admin.html, export-builder), màu chuyển xanh lá → cam
  theo ảnh mẫu, không còn hiệu ứng ánh màu chạy. Đổi font: sửa chuỗi `'Satisfy'` trong `.logo-learnsy` / `.bb-logo-taNa`.
- Chưa đổi: `<title>` trang, nhãn toast, câu trích dẫn, tên repo/package.
- Chưa xem được dáng chữ thật (sandbox thiếu font); chỉ xác nhận chữ + gradient hiển thị đúng.
