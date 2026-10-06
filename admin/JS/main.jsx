// ★ Vite entry point — thay thế toàn bộ loadModule chain
// Giữ nguyên thứ tự load y chang cũ

// CSS — import ở đây để Vite bundle vào assets
import '../CSS/toast.css'
import '../CSS/banh-beo-ui.css'
import '../CSS/themes.css'
import '../CSS/merge-questions.css'
import '../CSS/app.css'

// 0. Babel loader — chạy trước tất cả (setup transform/runtime nếu cần)
import './babel-loader.jsx'

// 0.5. Password gate — chặn render tới khi nhập đúng pass
import './pw-gate.jsx'

// 1. Globals TRƯỚC TIÊN
import './learnsy-colors.jsx'             // CL, CD, window.C
import './learnsy-parsers.jsx'            // parseText, importJSON, emptyTF/MC/MS/FB, newQ
import './components/ui-components.jsx'   // SVG icons + Inp/RichInp/MiniRichInp/Fld/Pill

// 2. UI utilities (plain JS, không JSX)
import './toast.jsx'
import './banh-beo-ui.jsx'
import './themes.jsx'
import './sounds.jsx'
import './easter-eggs.jsx'
import './ux-nung.jsx'
import './export-builder.jsx'
import './merge-questions.jsx'
import './confirm-dialog.jsx'
import './components/admin-background-settings.jsx'

// 3. Các module phụ thuộc globals
import './learnsy-login.jsx'
import './question-editor.jsx'
import './components/preview-panel.jsx'
import './components/listening-panel.jsx'
import './components/file-manager.jsx'
import './components/vocabulary-manager.jsx'
import './components/irregular-verb-manager.jsx'

// 4. Student manager + Dashboard
import './student-manager.jsx'
import './components/dashboard.jsx'

// 5. App chính — render toàn bộ UI
import './app.jsx'

console.log('[admin] v3 ✅ loaded!')

// ── CustomEvent Bridge ───────────────────────────────────────────
let _renderingLessons = false
window.addEventListener('learnsy:render-lessons', () => {
  if (_renderingLessons || typeof window.renderLessons !== 'function') return
  _renderingLessons = true
  try {
    const r = window.renderLessons()
    if (r && typeof r.catch === 'function') {
      r.catch(e => console.error('[bridge] renderLessons async error:', e))
    }
  } catch(e) { console.error('[bridge] renderLessons error:', e) }
  finally { _renderingLessons = false }
})

window.setLessonsFromBridge = function(lessons) {
  window.dispatchEvent(new CustomEvent('learnsy:set-lessons', { detail: { lessons } }))
}
