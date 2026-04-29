const CACHE_VERSION = "1777436927383";
const CACHE_NAME = `plogging-${CACHE_VERSION}`;

const urlsToCache = ["/", "/manifest.json"];

// 설치 시 즉시 활성화 — 이전 SW 즉시 교체
self.addEventListener("install", (event) => {
  console.log(`[SW] ${CACHE_NAME} 설치 중 — 이전 버전 즉시 교체`);
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
              console.log("[SW] 이전 캐시 삭제:", name);
              return caches.delete(name);
            })
        )
      )
      .then(() => {
        // claim만 수행 — 리로드는 layout.js의 updatefound 핸들러가 담당
        // client.navigate()를 여기서 하면 layout.js의 reload()와 이중 충돌 발생
        return self.clients.claim();
      })
  );
});

// 하이브리드 캐시 전략:
// - 정적 자원(_next/static, 이미지, 폰트): 캐시 우선 → 즉시 로딩
// - HTML/페이지: 네트워크 우선 → 항상 최신
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (event.request.url.includes("/api/")) return;
  if (event.request.url.includes("sw.js")) return;

  const url = new URL(event.request.url);

  // 정적 자원 → Cache-First (Stale-While-Revalidate)
  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    /\.(js|css|woff2?|ttf|png|jpg|jpeg|gif|svg|ico|webp)$/.test(url.pathname);

  if (isStatic) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetchPromise = fetch(event.request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // HTML/페이지 → Network-First
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// SKIP_WAITING 메시지 수신
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
