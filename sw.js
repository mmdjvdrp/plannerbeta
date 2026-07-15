// sw.js
const CACHE_NAME = "planner-cache-v12";
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
  "./js/chart.min.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        assetsToCache.map(url => cache.add(url).catch(err => console.log('Cache error:', url)))
      );
    })
  );
});

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

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          throw new Error("Offline and resource not found in cache.");
        });
      })
  );
});
