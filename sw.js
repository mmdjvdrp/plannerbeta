const CACHE_NAME = "planner-cache-v6";
const assetsToCache = [
  "/",
  "/index.html",
  "/login.html",
  "/css/style.css",
  "/manifest.json",
  "/js/app.js",
  "/js/event.js",
  "/js/supabase.js",
  "/js/storage.js",
  "/js/ui.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

// ۱. نصب سرویس‌ورکر و کش کردن فایل‌های اصلی پوسته
self.addEventListener("install", (event) => {
  self.skipWaiting(); // فعال‌سازی آنی نسخه جدید بدون منتظر ماندن
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
      self.clients.claim(), // کنترل آنی تب‌های باز بدون نیاز به رفرش
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cache) => {
            if (cache !== CACHE_NAME) {
              return caches.delete(cache); // حذف نسخه‌های قدیمی کش
            }
          })
        );
      })
    ])
  );
});

// ۳. مدیریت درخواست‌ها (ادغام دو بخش Fetch قبلی)
self.addEventListener("fetch", (event) => {
  // فقط درخواست‌های متد GET را مدیریت و کش می‌کنیم
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // اگر فایل در کش موجود بود، همان را برگردان
      if (cachedResponse) {
        return cachedResponse;
      }

      // در غیر این صورت، فایل را از شبکه دریافت کن
      return fetch(event.request).then((response) => {
        // اگر فایل مربوط به کتابخانه سوپابیس از CDN بود، آن را برای استفاده‌های بعدی کش کن
        if (response && response.status === 200 && event.request.url.startsWith("https://cdn.jsdelivr.net/")) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      });
    }).catch(() => {
      // این بخش زمانی اجرا می‌شود که دسترسی به اینترنت کاملاً قطع باشد و فایل هم در کش نباشد
    })
  );
});
