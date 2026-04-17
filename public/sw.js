const CACHE_NAME = "plogging-v7";

const urlsToCache = ["/", "/manifest.json"];

// 설치 시 즉시 활성화 — 이전 SW 즉시 교체
self.addEventListener("install", (event) => {
  console.log("[SW] v7 설치 중 — 이전 버전 즉시 교체");
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

// 이전 캐시 전부 삭제 + 즉시 모든 클라이언트 제어
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log("🗑️ 이전 캐시 삭제:", name);
              return caches.delete(name);
            })
        )
      )
      .then(() => self.clients.claim())
  );
});

// Network-first 전략: 항상 최신 코드 우선, 오프라인일 때만 캐시
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (event.request.url.includes("/api/")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 네트워크 성공 → 캐시 업데이트 후 반환
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => {
        // 오프라인 → 캐시에서 반환
        return caches.match(event.request);
      })
  );
});

// SKIP_WAITING 메시지 수신
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});