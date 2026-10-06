// ★ Vite entry point cho index.html
// Thay thế toàn bộ babel-loader.js + loadModule chain
// Giữ nguyên thứ tự load y chang cũ

import * as Tone from 'tone'
window.Tone = Tone

// ★ Perf: PixiJS (~500KB+) KHÔNG import eager ở đây nữa. Nó chỉ dùng cho
// hiệu ứng hạt "Plavsky" (learnsy-sparkle-settings.jsx), mặc định TẮT với
// hầu hết người dùng. File đó giờ tự `import('pixi.js')` động ngay khi
// startPlavsky() được gọi (người dùng bật sparkle) — giảm JS phải tải/parse
// lúc mở trang cho tất cả mọi người, quan trọng nhất trên máy yếu.

import React from 'react'
import ReactDOM from 'react-dom/client'

// Expose as globals cho các component dùng window.React / ReactDOM trực tiếp
window.React = React
window.ReactDOM = ReactDOM

import './ripple-haptic.jsx'   // phải nạp trước home-screen/quiz-player (window.useRipple/haptic/useSwipe)
import './components/globals.jsx'
import './toast.jsx'
import './session.js'
import './scoring.js'
import './components/save-result.jsx'
import './components/pw-gate.jsx'
import './components/student-login.jsx'
import './components/home-screen.jsx'
import './components/hist-detail.jsx'
import './components/avatar.jsx'
import './components/files-tab.jsx'
import './components/dashboard.jsx'
import './export-builder.jsx'
import './components/background-settings.jsx'
import './components/learnsy-sparkle-settings.jsx'
import './components/learnsy-dev-icon.jsx'
import './components/learnsy-dev-island.jsx'
// ★ Perf: quiz-player / listening-practice / vocab-practice / practice-screen
// KHÔNG import eager ở đây nữa. Đây là 4 file JSX lớn nhất của user site
// (~400KB nguồn tổng cộng) nhưng người dùng chỉ cần ĐÚNG MỘT trong số đó
// tại một thời điểm (tuỳ bấm vào bài học hay chuyển tab). app.jsx giờ tự
// `import()` động từng file, chỉ khi màn hình tương ứng lần đầu được cần
// tới — giảm đáng kể JS phải tải/parse lúc mở trang lần đầu, quan trọng
// nhất trên máy yếu/mạng chậm. Mỗi file vẫn tự gán window.X ở cuối module
// như cũ nên không đổi cách các nơi khác truy cập chúng.
import './app.jsx'

