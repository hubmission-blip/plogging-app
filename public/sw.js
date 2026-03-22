const CACHE_NAME = "plogging-v1";
const STATIC_ASSETS = [
  "/",
  "/map",
  "/ranking",
  "/profile",
];

// 설치: 정적 파일 캐시
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// 활성화: 오래된 캐시 삭제
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: 네트워크 우선, 실패 시 캐시
self.addEventListener("fetch", (event) => {
  // Firebase / Kakao API는 캐시 제외
  if (
    event.request.url.includes("firestore") ||
    event.request.url.includes("firebase") ||
    event.request.url.includes("kakao")
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 성공 응답은 캐시에 저장
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clone);
        });
        return response;
      })
      .catch(() => {
        // 오프라인이면 캐시에서 응답
        return caches.match(event.request);
      })
  );
});