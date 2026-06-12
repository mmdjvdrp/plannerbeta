const CACHE_NAME = "planner-cache-v1";
const assetsToCache = [
  "./",
  "./index.html",
  "./login.html",
  "./css/style.css"
  // اگر فایل جاوا اسکریپت جداگانه‌ای داری، آدرسش رو اینجا اضافه کن
];

// هنگام نصب PWA، فایل‌های اصلی کش می‌شوند
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(assetsToCache);
    })
  );
});

// استفاده از فایل‌های کش شده برای سرعت بیشتر
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // اگر در کش بود همون رو برگردون، در غیر این صورت از اینترنت بگیر
      return response || fetch(event.request);
    })
  );
});
