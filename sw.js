// sw.js
const CACHE_NAME = "planner-cache-v8"; // ارتقا نسخه کش جهت همگام‌سازی آنی تمام مراجع
const assetsToCache = [
  "/",
  "/index.html",
  "/login.html",
  "/css/style.css",
  "/manifest.json",
  "/js/supabase.js",
  "/js/storage.js",
  "/js/helpers.js",
  "/js/render.js",
  "/js/planner.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

// ۱. نصب سرویس‌ورکر و کش کردن فایل‌های اصلی پوسته
self.addEventListener("install", (event) => {
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(assetsToCache);
    })
  );
});

// ۲. فعال‌سازی سرویس‌ورکر، پاک کردن کش‌های قدیمی و در دست گرفتن صفحات باز
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(), 
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cache) => {
            if (cache !== CACHE_NAME) {
              return caches.delete(cache); 
            }
          })
        );
      })
    ])
  );
});

// ۳. مدیریت درخواست‌ها و واکشی کش آفلاین بدون ایجاد ارور unhandled
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((response) => {
        if (response && response.status === 200 && event.request.url.startsWith("https://cdn.jsdelivr.net/")) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      });
    })
  );
});
