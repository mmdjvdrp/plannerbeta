const CACHE_NAME = "planner-cache-v5"; 
const assetsToCache = [
  "/",
  "/index.html",
  "/login.html",
  "/css/style.css",
  "/manifest.json",
  "/js/firebase.js",
  "/js/storage.js",
  "/js/ui.js",
  "/js/app.js",
  "/js/event.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/favicon.png"
];

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

// کش کردن فایل‌های جدید پروکسی شده
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        // اگر فایل از تونل ورسل رد شده بود، ذخیره‌اش کن
        if (event.request.url.includes("/firebase-proxy/")) {
          const resClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, resClone);
          });
        }
        return response;
      });
    }).catch(() => {
      // حالت آفلاین
    })
  );
});
