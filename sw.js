const CACHE_NAME = "planner-cache-v6"; // بخشی از sw.js
const assetsToCache = [
  "/",
  "/index.html",
  "/login.html",
  "/css/style.css",
  "/manifest.json",
  "/js/app.js",
  "/js/event.js",
  "/js/supabase.js", // تغییر به supabase
  "/js/storage.js",
  "/js/ui.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

// بخش Fetch در sw.js
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        // کش کردن کتابخانه سوپابیس از CDN برای استفاده به صورت آفلاین
        if (event.request.url.startsWith("https://cdn.jsdelivr.net/")) {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, response.clone());
            return response;
          });
        }
        return response;
      });
    }).catch(() => {})
  );
});
// نصب سرویس‌ورکر و فورس کردن برای فعال‌سازی آنی
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(assetsToCache);
    })
  );
});

// فعال‌سازی و در دست گرفتن کنترل تمام صفحات باز
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// کش کردن فایل‌های سایت
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request);
    }).catch(() => {
      // حالت آفلاین
    })
  );
});
