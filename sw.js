// ── Service Worker cho DOCX/PDF → Quiz Parser ──────────────────────────────
// Mục tiêu: sau lần đầu mở trang (có mạng), các thư viện nặng (jszip,
// tesseract.js, pdf.js + worker, heic-to) được cache lại trong trình duyệt.
// Những lần sau — kể cả khi mạng trường học chặn/chậm CDN quốc tế
// (cdnjs.cloudflare.com, cdn.jsdelivr.net) — trang vẫn mở và parse được
// Word/PDF vì các thư viện được phục vụ từ cache, không cần tải lại từ CDN.
//
// LƯU Ý KHI DEPLOY: file này phải nằm CÙNG THƯ MỤC với file HTML chính trên
// server (Cloudflare Pages / Vercel / VPS) — Service Worker chỉ kiểm soát
// được các request trong phạm vi (scope) nơi nó được đăng ký, mặc định là
// thư mục chứa file sw.js. Nếu đổi version thư viện trong LIB_URLS ở file
// HTML chính, nhớ cập nhật CDN_URLS dưới đây cho khớp, và tăng SW_VERSION
// lên để buộc trình duyệt xoá cache cũ và tải bản mới.

const SW_VERSION = 'v2';
const RUNTIME_CACHE = `quiz-parser-cdn-${SW_VERSION}`;

// Phải khớp (hoặc là tập con) của LIB_URLS trong file HTML chính.
const CDN_URLS = [
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',
  'https://cdn.jsdelivr.net/npm/heic-to@1.5.2/dist/iife/heic-to.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(RUNTIME_CACHE).then((cache) =>
      Promise.all(
        CDN_URLS.map((url) =>
          // 1 thư viện lỗi lúc cài (CDN đổi version, mạng chặn đúng lúc...)
          // không được làm fail toàn bộ install — các thư viện khác vẫn cache.
          cache.add(url).catch(() => {})
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== RUNTIME_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const isCdnLib = CDN_URLS.some((u) => req.url === u || req.url.startsWith(u));
  if (isCdnLib) {
    // Cache-first: các URL này gắn version cố định (jszip@3.10.1,
    // tesseract@5, pdf.js@3.11.174...) nên nội dung dưới 1 URL không đổi —
    // ưu tiên cache vừa nhanh vừa chạy được khi mất mạng/CDN bị chặn.
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, copy));
            return res;
          })
          .catch(() => cached); // mất mạng + chưa từng cache → để request fail tự nhiên
      })
    );
    return;
  }

  // ── /api/* KHÔNG BAO GIỜ được cache ──
  // Trước đây các GET như /api/score?studentId=... rơi vào nhánh
  // network-first bên dưới và được lưu lại; khi mạng chập chờn, học sinh
  // nhận lại bản lịch sử CŨ (kể cả bản đã xóa) từ cache. Với API, để trình
  // duyệt đi thẳng ra mạng và tự lỗi nếu mất mạng — app đã có cache riêng
  // (localStorage) và xử lý lỗi mạng đúng cách.
  try {
    const u = new URL(req.url);
    if (u.origin === self.location.origin && u.pathname.startsWith('/api/')) return;
  } catch (e) {}

  // Trang HTML chính và tài nguyên same-origin khác: network-first kèm
  // fallback cache — luôn lấy bản mới nhất khi có mạng (tránh "kẹt" bản cũ
  // sau khi sửa file), nhưng vẫn mở được khi mất mạng nếu đã từng tải qua.
  let sameOrigin = false;
  try { sameOrigin = new URL(req.url).origin === self.location.origin; } catch (e) {}
  if (sameOrigin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
  }
});
