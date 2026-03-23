"use client";
import { useState, useRef, useCallback } from "react";

// ─── 상수 ───────────────────────────────────────────────
const SPEED_LIMIT_KMH = 30;          // 경고 발동 속도
const AUTO_STOP_SECONDS = 5;         // N초 연속 초과 시 자동 종료
const AUTO_STOP_MS = AUTO_STOP_SECONDS * 1000;

// ─── Haversine 거리 공식 (GPS 두 점 사이 km) ──────────────
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Hook ────────────────────────────────────────────────
export function useLocation({ onSpeedViolation } = {}) {
  const [path, setPath] = useState([]);
  const [distance, setDistance] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);   // km/h (실시간)
  const [isSpeedWarning, setIsSpeedWarning] = useState(false); // 30km/h 초과 중

  const watchIdRef = useRef(null);
  const lastPositionRef = useRef(null);    // { lat, lng, timestamp }
  const violationStartRef = useRef(null);  // 초과 시작 시각
  const autoStopCalledRef = useRef(false); // 자동 종료 중복 방지

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
    setCurrentSpeed(0);
    setIsSpeedWarning(false);
    violationStartRef.current = null;
    autoStopCalledRef.current = false;
  }, []);

  const startTracking = useCallback(() => {
    // 초기화
    setPath([]);
    setDistance(0);
    setCurrentSpeed(0);
    setIsSpeedWarning(false);
    setIsTracking(true);
    lastPositionRef.current = null;
    violationStartRef.current = null;
    autoStopCalledRef.current = false;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const now = Date.now();

        // ── 속도 계산 ──────────────────────────────────────
        if (lastPositionRef.current) {
          const { lat: pLat, lng: pLng, timestamp: pTime } = lastPositionRef.current;

          const distKm = haversineDistance(pLat, pLng, lat, lng);
          const elapsedHours = (now - pTime) / 3_600_000; // ms → 시간
          const speedKmh = elapsedHours > 0 ? distKm / elapsedHours : 0;
          const roundedSpeed = Math.round(speedKmh);

          setCurrentSpeed(roundedSpeed);

          if (speedKmh > SPEED_LIMIT_KMH) {
            // ── 경고 상태 ON ──────────────────────────────
            setIsSpeedWarning(true);

            if (!violationStartRef.current) {
              violationStartRef.current = now;
            }

            // N초 연속 초과 → 자동 종료
            if (
              !autoStopCalledRef.current &&
              now - violationStartRef.current >= AUTO_STOP_MS
            ) {
              autoStopCalledRef.current = true;
              stopTracking();
              if (onSpeedViolation) onSpeedViolation();
              return; // 이후 좌표 추가 중단
            }
          } else {
            // ── 속도 정상 → 경고 해제 ─────────────────────
            setIsSpeedWarning(false);
            violationStartRef.current = null;
          }

          // 경로 거리 누적 (자동종료 중에는 추가 안 함)
          if (!autoStopCalledRef.current) {
            setDistance((prev) => prev + distKm);
          }
        }

        // 경로 포인트 추가
        if (!autoStopCalledRef.current) {
          setPath((prev) => [...prev, { lat, lng }]);
        }

        lastPositionRef.current = { lat, lng, timestamp: now };
      },
      (err) => console.error("GPS 오류:", err),
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 15000,
      }
    );
  }, [onSpeedViolation, stopTracking]);

  return {
    path,
    distance,
    isTracking,
    currentSpeed,     // km/h — 지도 화면에 표시용
    isSpeedWarning,   // true이면 경고 배너 표시
    startTracking,
    stopTracking,
  };
}