// ========================================
// service-worker.js - オフライン対応
// ========================================

const CACHE_NAME = "saitama-walk-v1";
const CACHE_FILES = [
  "./",
  "./index.html",
  "./data.js",
  "./cards.js",
  "./properties.js",
  "./events.js",
  "./sound.js",
  "./cpu.js",
  "./main.js",
  "./start.js",
  "./manifest.json",
  "./icon.svg",
];

// インストール時にキャッシュ
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CACHE_FILES).catch((err) => {
        console.warn("Cache add error:", err);
      });
    }).then(() => self.skipWaiting())
  );
});

// アクティベート時に古いキャッシュを削除
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// fetch時にキャッシュ優先（オフラインでも動く）
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        // 正常なレスポンスのみキャッシュ
        if (!response || response.status !== 200 ||
            response.type === "opaque") {
          return response;
        }
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      }).catch(() => {
        // オフライン時はindex.htmlにフォールバック
        if (event.request.mode === "navigate") {
          return caches.match("./index.html");
        }
      });
    })
  );
});