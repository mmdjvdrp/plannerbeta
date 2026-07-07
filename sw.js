// sw.js
const CACHE_NAME = "planner-cache-v10";
const assetsToCache = [
  "./",
  "./index.html",
  "./login.html",
  "./css/style.css",
  "./manifest.json",
  "./js/supabase.js",
  "./js/storage.js",
  "./js/helpers.js",
  "./js/render.js",
  "./js/planner.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// ۱. نصب سرویس‌ورکر و کش کردن فایل‌های اصلی
self.addEventListener("install", (event) => {
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // استفاده از Promise.allSettled تا اگر فایلی پیدا نشد، کل فرآیند نصب متوقف نشود
      return Promise.allSettled(
        assetsToCache.map(url => cache.add(url).catch(err => console.log('خطا در کش:', url)))
      );
    })
  );
});

// ۲. فعال‌سازی و پاک کردن کش‌های قدیمی
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

// ۳. مدیریت درخواست‌ها و واکشی کش آفلاین
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        return response;
      }).catch(() => {
        console.log("درخواست با خطا مواجه شد (آفلاین)");
      });
    })
  );
});
