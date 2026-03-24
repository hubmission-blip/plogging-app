"use client";

import { useState, useEffect } from "react";
import { Map, Polyline, CustomOverlayMap } from "react-kakao-maps-sdk";

// ─── MapView Props ─────────────────────────────────────────
// currentPath    : [{ lat, lng }, ...]  현재 플로깅 경로
// pastRoutes     : [{ id, coords, color }, ...]  내 과거 경로
// nearbyRoutes   : [{ id, coords }, ...]  타인 최근 경로 (회색 반투명)
// partnerMarkers : [{ id, lat, lng, icon, name, ... }]  제휴 상점 마커
// onPartnerClick : (partner) => void  마커 클릭 콜백

export default function MapView({
  currentPath    = [],
  pastRoutes     = [],
  nearbyRoutes   = [],
  partnerMarkers = [],
  onPartnerClick,
}) {
  const DEFAULT_CENTER = { lat: 37.5665, lng: 126.9780 }; // 서울 시청
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [userPos, setUserPos] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // ── 현재 위치 추적 ──────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return;

    const wid = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserPos(p);
        // 플로깅 미시작 상태에서만 센터 이동
        if (currentPath.length === 0) setCenter(p);
      },
      (err) => console.warn("GPS:", err.message),
      { enableHighAccuracy: true, maximumAge: 2000 }
    );

    // 최초 1회 즉시 위치 요청
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserPos(p);
        setCenter(p);
      },
      () => {},
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(wid);
  }, []); // eslint-disable-line

  // ── 플로깅 중 마지막 위치로 센터 이동 ──────────────────
  useEffect(() => {
    if (currentPath.length > 1) {
      setCenter(currentPath[currentPath.length - 1]);
    }
  }, [currentPath]);

  return (
    <Map
      center={center}
      style={{ width: "100%", height: "100%" }}
      level={4}
      onCreate={() => setMapLoaded(true)}
    >
      {/* ── C. 타인 최근 경로 (회색 반투명) ───────────────── */}
      {mapLoaded && nearbyRoutes.map((route) => (
        <Polyline
          key={`nearby-${route.id}`}
          path={route.coords}
          strokeWeight={2}
          strokeColor="#94A3B8"
          strokeOpacity={0.3}
          strokeStyle="solid"
        />
      ))}

      {/* ── 내 과거 경로 (주차별 색상) ─────────────────────── */}
      {mapLoaded && pastRoutes.map((route) => (
        <Polyline
          key={`past-${route.id}`}
          path={route.coords}
          strokeWeight={4}
          strokeColor={route.color || "#4CAF50"}
          strokeOpacity={0.6}
          strokeStyle="solid"
        />
      ))}

      {/* ── 현재 플로깅 경로 (굵은 초록) ─────────────────── */}
      {mapLoaded && currentPath.length > 1 && (
        <Polyline
          path={currentPath}
          strokeWeight={6}
          strokeColor="#16A34A"
          strokeOpacity={1}
          strokeStyle="solid"
        />
      )}

      {/* ── 현재 위치 마커 (초록 원) ──────────────────────── */}
      {mapLoaded && userPos && (
        <CustomOverlayMap position={userPos} zIndex={20}>
          <div style={{
            width: 18, height: 18,
            borderRadius: "50%",
            background: "#22C55E",
            border: "3px solid white",
            boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
            position: "relative",
          }}>
            {/* 펄스 효과 */}
            <div style={{
              position: "absolute",
              inset: -6,
              borderRadius: "50%",
              background: "rgba(34,197,94,0.2)",
              animation: "pulse 2s infinite",
            }} />
          </div>
        </CustomOverlayMap>
      )}

      {/* ── B. 제휴 상점 마커 ────────────────────────────── */}
      {mapLoaded && partnerMarkers.map((partner) => (
        <CustomOverlayMap
          key={`partner-${partner.id}`}
          position={{ lat: partner.lat, lng: partner.lng }}
          zIndex={15}
        >
          <button
            onClick={() => onPartnerClick && onPartnerClick(partner)}
            style={{
              background: "white",
              border: "2.5px solid #22C55E",
              borderRadius: "50%",
              width: 44,
              height: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              cursor: "pointer",
              boxShadow: "0 3px 10px rgba(0,0,0,0.25)",
              transition: "transform 0.15s",
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.15)"}
            onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
            title={partner.name}
          >
            {partner.icon || "🏪"}
          </button>
          {/* 상점명 라벨 */}
          <div style={{
            marginTop: 2,
            background: "white",
            borderRadius: 8,
            padding: "2px 6px",
            fontSize: 10,
            fontWeight: 700,
            color: "#166534",
            boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
            whiteSpace: "nowrap",
            textAlign: "center",
          }}>
            {partner.name}
          </div>
        </CustomOverlayMap>
      ))}

      {/* 펄스 애니메이션 */}
      <style>{`
        @keyframes pulse {
          0%   { transform: scale(1);   opacity: 0.6; }
          50%  { transform: scale(1.6); opacity: 0.2; }
          100% { transform: scale(1);   opacity: 0.6; }
        }
      `}</style>
    </Map>
  );
}