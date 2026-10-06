# Luvie Foundation UI (06–11/10)

## Mục tiêu
UI mềm, bo góc hơn · chữ dễ thương, thoáng · chuẩn hoá icon/button/card · bớt cảm giác "web admin" · tối ưu render.

## Thêm mới
- `index/CSS/foundation.css` (app học sinh) và `admin/CSS/foundation.css` (admin) — nạp CUỐI trong `index.html` / `admin.html`.
  - Thang bo góc: 10 / 14 / 18 / 24 / 28 / pill. Token `--v2-r-*` cũ trỏ về thang mới.
  - Icon 3 cỡ (16/20/24), SVG nét tròn (round cap/join) toàn app.
  - Nút chuẩn `.lv-btn` (+ `-soft`, `-sm`), thẻ chuẩn `.lv-card`.
  - Chữ: line-height 1.65, letter-spacing nhẹ, placeholder mềm, tiêu đề 800.
  - Admin: nền gradient hồng–tím nhạt, bảng bo góc, tab/chip/CTA bo mềm.

## Đổi trong JSX
- `borderRadius` số: 14→18, 16→20, 18→22, 20→24, 24→28 (265 chỗ, index + admin). Bán kính nhỏ (<14), 99/999 giữ nguyên.

## Render
- Thẻ bài học: `blur(16px) saturate(160%)` → `blur(8px)` (bỏ pass saturate, giảm bán kính blur trên ~20 thẻ lặp).
- `--glass-blur`: `blur(18px) saturate(160%)` → `blur(10px)`.
- Chưa đo trong sandbox: con số ~7% cần đo lại bằng Performance panel / Lighthouse trên máy thật.

## Không đổi
Logic chấm điểm, lưu kết quả, Redis, auth, build config.
