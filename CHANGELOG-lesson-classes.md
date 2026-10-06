# Soạn bài: đối tượng "Tất cả" / "Theo lớp"

- `supabase/migrations/2026_lesson_target_classes.sql`: thêm cột `lessons.target_classes text[]` (NULL = tất cả học sinh). **Chạy SQL này trước khi deploy.**
- `admin/JS/app.jsx`: thêm hàng "Đối tượng: Tất cả | Theo lớp" trong trình soạn bài; chọn nhiều lớp bằng chip (danh sách lớp lấy từ `students.class_name`). Tự lưu cùng các trường khác, nhân bản bài giữ nguyên đối tượng, thẻ bài hiện nhãn "Lớp ...".
- `index/JS/app.jsx` + `components/student-app.jsx` (hai file giống hệt): học sinh chỉ thấy bài "Tất cả" hoặc bài có lớp của mình (so khớp không phân biệt hoa thường). Áp dụng cho cả "Bài học" và "Ôn tập riêng".
- Lưu ý: lọc ở phía client giống cơ chế ẩn/công khai hiện tại; chưa chặn ở RLS.
