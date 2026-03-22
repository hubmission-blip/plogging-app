"use client";

import { Map, Polyline, MapMarker } from "react-kakao-maps-sdk";
import { useState, useEffect } from "react";

export default function MapView({ pastRoutes = [], currentPath = [] }) {
  const [center, setCenter] = useState({ lat: 37.5665, lng: 126.9780 });
  const [myPos, setMyPos] = useState(null);
  const [mapReady, setMapReady] = useState(false); // ✅ 추가

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCenter(loc);
          setMyPos(loc);
        },
        (err) => {
          console.warn("위치 정보 없음:", err.message);
          // 기본 위치(서울) 사용
        }
      );
    }
    setMapReady(true); // ✅ 추가
  }, []);

  useEffect(() => {
    if (currentPath.length > 0) {
      const last = currentPath[currentPath.length - 1];
      setCenter(last);
      setMyPos(last);
    }
  }, [currentPath]);

  if (!mapReady) return null; // ✅ SDK 준비 전 렌더 방지

  return (
    <Map
      center={center}
      style={{ width: "100%", height: "100vh" }}
      level={3}
    >
      {/* 과거 동선 (주차별 색상) */}
      {pastRoutes.map((route, index) => (
        <Polyline
          key={route.id ?? `past-route-${index}`} // ✅ id 없으면 index 사용
          path={route.coords}
          strokeWeight={4}
          strokeColor={route.color}
          strokeOpacity={0.7}
          strokeStyle="solid"
        />
      ))}

      {/* 현재 추적 중인 동선 (빨간색) */}
      {currentPath.length > 1 && (
        <Polyline
          path={currentPath}
          strokeWeight={5}
          strokeColor="#FF0000"
          strokeOpacity={0.9}
          strokeStyle="solid"
        />
      )}

      {/* 내 현재 위치 마커 */}
      {myPos && (
        <MapMarker
          position={myPos}
          image={{
            src: "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png",
            size: { width: 24, height: 35 },
          }}
        />
      )}
    </Map>
  );
}