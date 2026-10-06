# Learnsy UI 2.0

## Thêm mới
- `index/CSS/v2.css` — lớp thiết kế 2.0 (token, thang bo góc 10/14/20, chữ làm bài to hơn, dock, tiến độ). Được nạp sau `shared-2026.css` trong `index.html`.

## Màn làm bài (`index/JS/components/quiz-player.jsx`)
- Header: nút Quay lại thành nút icon 40px (có aria-label); nút Tuỳ chọn 40px, dùng gradient thương hiệu.
- Tiến độ: thanh 8px màu thương hiệu + số "câu hiện tại / tổng" ngay cạnh; bỏ số đếm trùng ở hàng badge.
- Thẻ câu hỏi: bỏ nhãn loại câu viết hoa bị lặp (badge ở header đã có), chữ câu hỏi 16–18px, bo góc 20.
- Đáp án: vùng chạm tối thiểu 56px, viền 2px, chip chữ cái 32px, chữ 14.5–16px.
- Dock dưới: gộp thanh điều hướng câu + nút Nộp bài thành một khối; nút Trước/Sau 44px; chấm số câu 28px.
- Nhãn "Đoạn tư liệu", "Giải thích" viết thường (bỏ ALL-CAPS).
- Gợi ý phím tắt tự ẩn trên màn cảm ứng.
- Bảng màu `QC` mới: chữ tối hơn (tương phản tốt hơn), thẻ trắng rõ nét ở light mode.

## Trang chủ
- Thẻ bài học bo góc 20, nút phát 14, tiêu đề/mô tả to hơn (qua class sẵn có, không đổi JSX).

## Không đổi
- Toàn bộ logic chấm điểm, lưu kết quả, timer, âm thanh, chế độ cuộn.
- Admin panel chưa nâng cấp ở đợt này.

## Cơ chế làm bài mới (chỉ khi bật "Luyện tập" — chế độ Thi cử giữ nguyên)
- **XP + combo**: câu đúng +10 XP; chuỗi đúng liên tiếp cộng thêm (3 câu +5, 5 câu +10, 8 câu +15); trả lời trong ≤6 giây +3. Chỉ tính **lần chọn đầu** của mỗi câu nên đổi đáp án để "săn" điểm không có tác dụng. Câu đã làm từ autosave không bị tính lại.
- **50:50**: 2 lượt mỗi bài, loại 2 đáp án sai của câu trắc nghiệm (đáp án bị gạch mờ, không chọn được, phím tắt cũng bị chặn). Không loại đáp án đúng; câu chỉ có 1 đáp án sai thì bỏ qua.
- Chip **XP** trên header, popup điểm nổi (+XP / Combo / "Chưa đúng"), dòng **Tổng XP** trong bảng thống kê cuối bài.
- Sửa lỗi cũ: chuỗi streak, âm thanh đúng/sai và thời gian/câu trước đây không bao giờ được kích hoạt (hàm chấm nằm đó nhưng không được gọi). Nay chạy ở Luyện tập.
- Chưa tính XP cho câu **nhiều đáp án** (không có tín hiệu "đã xong" rõ ràng).

## Hoạt ảnh
- Đáp án đúng nảy nhẹ, đáp án sai rung; đáp án bị 50:50 loại mờ dần.
- Popup điểm bay lên, chip XP/streak nảy khi số đổi, ngọn lửa streak nhấp nháy.
- Thanh tiến độ có vệt sáng chạy; nút Nộp bài "thở" khi đã làm hết các câu.
- Tất cả tắt khi thiết bị bật "giảm chuyển động".

## Admin → khu vực "Bài học" (tiêu đề, tìm kiếm, tab, bộ lọc)
Vấn đề cũ: 3 khối gradient đặc tranh nhau (nút thêm, tab đang chọn, chip đang chọn); hai thanh bo tròn lồng khung; viền hồng + chữ nâu đỏ + nút tím lệch tông; đường kẻ thừa dưới tiêu đề.
- Nút **Thêm bài mới** là phần tử gradient DUY NHẤT; bo 14, cao 42.
- Tiêu đề 22px màu mực tím đậm; bỏ đường kẻ dưới tiêu đề.
- Ô tìm kiếm: bo 14, cao 46, viền tím trung tính, vòng sáng khi focus, nút xoá 28px.
- "Bài học thường / Ôn tập riêng" → **tab gạch chân** (thanh gradient trượt vào dưới tab đang chọn), số lượng là badge nhỏ.
- Lọc môn → **chip phẳng**: đang chọn dùng nền tím nhạt + chữ tím, không gradient. Chip 0 bài mờ đi.
- Sắp xếp: icon mũi tên lên/xuống (thay icon phễu gây hiểu nhầm); màn <460px chỉ còn icon.
- Chế độ tối: chữ phụ sáng hơn để đủ tương phản.
- File mới `admin/CSS/admin-v2.css` (class `av2-*`, nạp trong `admin.html`). Logic lọc/sắp xếp giữ nguyên.
