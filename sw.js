const CACHE_NAME = "planner-cache-v2";
const assetsToCache = [
  "/",
  "/index.html",
  "/login.html",
  "/css/style.css",
  "/manifest.json",
  "/js/app.js",
  "/js/event.js",
  "/js/firebase.js",
  "/js/storage.js",
  "/js/ui.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

// نصب سرویس‌ورکر و کش کردن فایل‌های اصلی پوسته اپلیکیشن
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(assetsToCache);
    })
  );
});

// فعال‌سازی و پاک کردن کش‌های قدیمی در صورت آپدیت نسخه جدید
self.addEventListener("activate", (event) => {
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

// مدیریت درخواست‌ها و کش کردن فایل‌های CDN فایربیس هنگام اولین لود آنلاین
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        // اگر درخواست مربوط به کتابخانه‌های فایربیس بود، آن را برای استفاده آفلاین بعدی کش کن
        if (event.request.url.startsWith("https://www.gstatic.com/")) {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, response.clone());
            return response;
          });
        }
        return response;
      });
    }).catch(() => {
      // در حالت آفلاین کامل، اگر منبعی پیدا نشد، خطایی ایجاد نشود
    })
  );
});
