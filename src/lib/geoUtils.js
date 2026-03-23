// src/lib/geoUtils.js
// GeoHash 기반 위치 쿼리 유틸리티
// 설치 필요: npm install geofire-common

import {
  geohashForLocation,
  geohashQueryBounds,
  distanceBetween,
} from "geofire-common";
import {
  collection, query, orderBy, startAt, endAt, getDocs, where,
} from "firebase/firestore";

// ─── 1. 동선 저장 시 GeoHash 생성 ────────────────────────────
// 동선의 시작 좌표를 기준으로 GeoHash 값을 생성합니다.
// addDoc 할 때 geohash 필드를 함께 저장하세요.
//
// 사용 예:
//   const geohash = getStartGeohash(path);
//   await addDoc(collection(db, "routes"), { ..., geohash });

export function getStartGeohash(coords) {
  if (!coords || coords.length === 0) return null;
  const { lat, lng } = coords[0];
  return geohashForLocation([lat, lng]);
}

// ─── 2. 반경 N km 내 동선 조회 ───────────────────────────────
// center: { lat, lng }
// radiusKm: 반경 (기본 2km)
//
// 사용 예:
//   const nearby = await getNearbyRoutes(db, { lat, lng }, 2);

export async function getNearbyRoutes(db, center, radiusKm = 2) {
  const radiusM = radiusKm * 1000;
  const bounds = geohashQueryBounds([center.lat, center.lng], radiusM);

  const promises = bounds.map((b) =>
    getDocs(
      query(
        collection(db, "routes"),
        orderBy("geohash"),
        startAt(b[0]),
        endAt(b[1])
      )
    )
  );

  const snapshots = await Promise.all(promises);
  const matchingDocs = [];

  snapshots.forEach((snap) => {
    snap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (!data.coords || data.coords.length === 0) return;

      // GeoHash 범위는 사각형이므로 실제 원형 반경 필터링 추가
      const start = data.coords[0];
      const distKm = distanceBetween(
        [start.lat, start.lng],
        [center.lat, center.lng]
      );

      if (distKm <= radiusKm) {
        matchingDocs.push({ id: docSnap.id, ...data, distKm });
      }
    });
  });

  // 거리 가까운 순 정렬
  return matchingDocs.sort((a, b) => a.distKm - b.distKm);
}

// ─── 3. 두 좌표 사이 거리 계산 (km) ─────────────────────────
// geofire-common의 distanceBetween 래퍼
export function getDistanceKm(coord1, coord2) {
  return distanceBetween(
    [coord1.lat, coord1.lng],
    [coord2.lat, coord2.lng]
  );
}

// ─── 4. 현재 위치 기반 내 동선 조회 (반경 5km) ──────────────
// 지도 화면에서 현재 위치 주변의 다른 유저 동선을 표시할 때 사용
export async function getRoutesNearMe(db, userLat, userLng) {
  return getNearbyRoutes(db, { lat: userLat, lng: userLng }, 5);
}

// ─── 5. 사용 방법 안내 ───────────────────────────────────────
//
// [설치]
//   npm install geofire-common
//
// [동선 저장 시 geohash 필드 추가] - map/page.js의 handleStop 함수에서:
//   import { getStartGeohash } from "@/lib/geoUtils";
//
//   const routeDoc = await addDoc(collection(db, "routes"), {
//     ...기존 필드들...,
//     geohash: getStartGeohash(path),   // ← 이 줄 추가
//   });
//
// [Firestore 인덱스 설정] - Firebase 콘솔 → Firestore → 인덱스:
//   컬렉션: routes
//   필드: geohash (오름차순), createdAt (내림차순)
//
// [주변 동선 조회 예시]
//   import { getNearbyRoutes } from "@/lib/geoUtils";
//   const nearby = await getNearbyRoutes(db, { lat: 37.5, lng: 127.0 }, 2);
//   setPastRoutes(nearby);