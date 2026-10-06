import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import fs from 'fs'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-sw',
      closeBundle() {
        // FIX 🔴 Build lỗi ENOENT trên sw.js dù file vẫn tồn tại trong repo:
        // __dirname không còn hoạt động đúng khi Vite dùng
        // configLoader:'native' (từ Vite v8) — config giờ chạy như ESM
        // thuần, không còn được bundle qua cầu nối CJS như trước để
        // __dirname được polyfill. Kết quả: resolve(__dirname, 'sw.js')
        // trả về đường dẫn sai (rỗng/undefined), fs.copyFileSync không
        // tìm thấy file nguồn dù nó vẫn nằm đúng chỗ trên GitHub.
        // Sửa: dùng import.meta.dirname (chuẩn ESM, Node 20.11+) thay
        // cho __dirname — đúng theo khuyến nghị của chính warning Vite in ra.
        // Bọc thêm try/catch: nếu sau này sw.js thật sự bị thiếu vì lý do
        // khác, build không nên chết hẳn — chỉ cảnh báo để dễ phát hiện.
        try{
          fs.copyFileSync(resolve(import.meta.dirname, 'sw.js'), resolve(import.meta.dirname, 'dist/sw.js'));
        }catch(err){
          console.warn('[copy-sw] Không copy được sw.js:', err.message);
        }
      }
    }
  ],
  build: {
    outDir: 'dist',
    // ── Terser thay cho esbuild mặc định của Vite ─────────────────────
    // esbuild minify nhanh nhưng nông (chỉ rút gọn tên biến + xoá khoảng
    // trắng cơ bản). Terser nén sâu hơn nhiều: nhiều pass compress, loại
    // console.log/debugger, dead-code elimination mạnh hơn — gần với độ
    // sâu tối ưu mà R8 làm cho bytecode Kotlin/Java.
    // Lưu ý an toàn: KHÔNG bật unsafe/unsafe_math — codebase này dùng
    // window.X (learnsy-colors.jsx, learnsy-parsers.jsx, ui-components.jsx...)
    // để chia sẻ biến giữa các file theo đúng thứ tự import trong main.jsx.
    // Các cờ "unsafe" của Terser có thể sắp xếp lại side-effect hoặc rút gọn
    // sai object property access, dễ làm vỡ chuỗi phụ thuộc window.* ngầm này.
    minify: 'terser',
    terserOptions: {
      compress: {
        passes: 3,               // nhiều lượt nén hơn mặc định (2) — dọn sâu hơn
        // Không dùng drop_console:true — cờ đó xoá TẤT CẢ console.*, kể cả
        // console.error/warn. Codebase có 22 chỗ dùng console.error để báo
        // lỗi thật (vd. invalidateCache thất bại, lỗi lưu bài) — xoá đi sẽ
        // làm mất manh mối debug khi có sự cố trên production. Chỉ xoá
        // console.log/debug (log phát triển) qua pure_funcs bên dưới.
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.debug'],
        dead_code: true,
        unused: true,
        booleans_as_integers: false, // giữ false: an toàn hơn cho code có so sánh kiểu lỏng lẻo
      },
      mangle: {
        // giữ nguyên tên property (obj.foo) — bắt buộc vì rất nhiều chỗ
        // trong admin/JS đọc property qua window.C.lav, l.questions, v.v.
        // Terser không tự biết đâu là property "an toàn" để đổi tên khi
        // code truy cập động qua chuỗi hoặc qua nhiều file rời — mangle
        // properties ở đây rủi ro cao hơn lợi ích thu được.
        properties: false,
      },
      format: {
        comments: false, // xoá hết comment (kể cả comment tiếng Việt giải thích) khỏi bundle production
      },
    },
    rollupOptions: {
      input: {
        main: 'index.html',
        admin: 'admin.html',
        docx: 'docx.html',
        create: 'create.html',
        blur: 'blur.html',
      }
    }
  }
})
