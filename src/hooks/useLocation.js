"use client";
import { useState, useRef, useCallback, useEffect } from "react";

// ─── 상수 ───────────────────────────────────────────────
const SPEED_LIMIT_KMH   = 30;    // 이동수단 경고 속도
const AUTO_STOP_SECONDS = 5;     // N초 연속 초과 시 자동 종료
const AUTO_STOP_MS      = AUTO_STOP_SECONDS * 1000;

// 정지 패턴 감지 임계값
const MOVE_SPEED_MS = 1.0;   // m/s 이상 → "이동 중" 판정 (≈ 3.6 km/h)
const STOP_SPEED_MS = 0.5;   // m/s 이하 → "정지" 판정 (≈ 1.8 km/h)

// ─── GPS 정확도 필터 상수 ────────────────────────────────
const GPS_ACCURACY_THRESHOLD = 50;   // 50m 이상 오차면 무시
const GPS_OUTLIER_MAX_MS     = 30;   // 30m/s(108km/h) 이상 순간이동이면 GPS 오류로 판단
const GPS_WARMUP_COUNT       = 3;    // 연속 3회 정상 신호 확인 후 기록 시작

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
  const [path, setPath]                 = useState([]);
  const [distance, setDistance]         = useState(0);
  const [isTracking, setIsTracking]     = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [isSpeedWarning, setIsSpeedWarning] = useState(false);

  // 경과 시간 (초)
  const [duration, setDuration]   = useState(0);
  // 정지(줍기) 횟수
  const [stopCount, setStopCount] = useState(0);

  // ── GPS 정확도 상태 ────────────────────────────────────
  const [gpsAccuracy, setGpsAccuracy] = useState(null);  // 현재 정확도 (m)
  const [gpsReady,    setGpsReady]    = useState(false);  // 워밍업 완료 여부

  const watchIdRef          = useRef(null);
  const lastPositionRef     = useRef(null);
  const violationStartRef   = useRef(null);
  const autoStopCalledRef   = useRef(false);
  const goodReadingsRef     = useRef(0);   // 연속 정상 수신 횟수 (워밍업용)

  // ── Wake Lock (화면 꺼짐 방지) ─────────────────────────
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [isBackground,   setIsBackground]   = useState(false);
  const wakeLockRef     = useRef(null);
  const bgTimerRef      = useRef(null);
  const isTrackingRef   = useRef(false);

  // 정지 패턴 감지용 ref
  const wasMovingRef        = useRef(false);
  // 타이머 ref
  const trackingStartRef    = useRef(null);
  const durationIntervalRef = useRef(null);
  const durationRef         = useRef(0);

  // ─── Wake Lock 요청 ──────────────────────────────────
  const requestWakeLock = useCallback(async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        setWakeLockActive(true);
        wakeLockRef.current.addEventListener("release", () => {
          setWakeLockActive(false);
        });
      }
    } catch (e) {
      setWakeLockActive(false);
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
    setWakeLockActive(false);
  }, []);

  // ─── 화면 복귀 시 Wake Lock 재요청 ────────────────────
  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState === "hidden") {
        if (isTrackingRef.current) setIsBackground(true);
      } else {
        setIsBackground(false);
        if (bgTimerRef.current) { clearTimeout(bgTimerRef.current); bgTimerRef.current = null; }
        if (isTrackingRef.current && !wakeLockRef.current) {
          await requestWakeLock();
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [requestWakeLock]);

  // ─── stopTracking ─────────────────────────────────────
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    setIsTracking(false);
    setCurrentSpeed(0);
    setIsSpeedWarning(false);
    setIsBackground(false);
    setGpsReady(false);
    setGpsAccuracy(null);
    violationStartRef.current  = null;
    autoStopCalledRef.current  = false;
    wasMovingRef.current       = false;
    isTrackingRef.current      = false;
    goodReadingsRef.current    = 0;
    releaseWakeLock();
  }, [releaseWakeLock]);

  // ─── startTracking ────────────────────────────────────
  const startTracking = useCallback((reset = true) => {
    if (reset) {
      setPath([]);
      setDistance(0);
      setDuration(0);
      durationRef.current        = 0;
      setStopCount(0);
      lastPositionRef.current    = null;
      trackingStartRef.current   = Date.now();
    } else {
      lastPositionRef.current    = null;
      trackingStartRef.current   = Date.now() - (durationRef.current * 1000);
    }

    setCurrentSpeed(0);
    setIsSpeedWarning(false);
    setIsBackground(false);
    setGpsReady(false);
    setGpsAccuracy(null);
    violationStartRef.current  = null;
    autoStopCalledRef.current  = false;
    wasMovingRef.current       = false;
    isTrackingRef.current      = true;
    goodReadingsRef.current    = 0;

    requestWakeLock();

    // 1초 타이머
    durationIntervalRef.current = setInterval(() => {
      if (trackingStartRef.current) {
        const d = Math.floor((Date.now() - trackingStartRef.current) / 1000);
        durationRef.current = d;
        setDuration(d);
      }
    }, 1000);

    setIsTracking(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        const now = Date.now();

        // ── [필터 1] 정확도 체크 ─────────────────────────────
        // accuracy가 50m 초과면 신호 불안정 → 무시
        setGpsAccuracy(Math.round(accuracy));
        if (accuracy > GPS_ACCURACY_THRESHOLD) {
          goodReadingsRef.current = 0;   // 워밍업 카운트 리셋
          setGpsReady(false);
          return;
        }

        // ── [필터 3] GPS 워밍업 ──────────────────────────────
        // 정확도 OK 신호가 연속 3회 들어와야 기록 시작
        if (goodReadingsRef.current < GPS_WARMUP_COUNT) {
          goodReadingsRef.current += 1;
          // 워밍업 중이지만 마지막 위치는 저장해 다음 거리 계산 기준으로 사용
          lastPositionRef.current = { lat, lng, timestamp: now };
          if (goodReadingsRef.current < GPS_WARMUP_COUNT) return;
          // 3회 달성 → 기록 시작
          setGpsReady(true);
        }

        if (lastPositionRef.current) {
          const { lat: pLat, lng: pLng, timestamp: pTime } = lastPositionRef.current;

          const distKm     = haversineDistance(pLat, pLng, lat, lng);
          const distM      = distKm * 1000;
          const elapsedSec = Math.max((now - pTime) / 1000, 0.001);
          const elapsedH   = elapsedSec / 3600;
          const speedKmh   = distKm / elapsedH;
          const speedMs    = distM / elapsedSec;

          // ── [필터 2] 이상치(순간이동) 감지 ──────────────────
          // 물리적으로 불가능한 속도(30m/s = 108km/h)면 GPS 튐으로 판단 → 무시
          if (speedMs > GPS_OUTLIER_MAX_MS) {
            // 이상치는 버리되 lastPosition은 유지 (기준점 변경 없음)
            return;
          }

          const roundedSpeed = Math.round(speedKmh);
          setCurrentSpeed(roundedSpeed);

          // ── 이동수단 감지 (30km/h 초과) ──────────────────────
          if (onSpeedViolation) {
            if (speedKmh > SPEED_LIMIT_KMH) {
              setIsSpeedWarning(true);
              if (!violationStartRef.current) violationStartRef.current = now;
              if (!autoStopCalledRef.current && now - violationStartRef.current >= AUTO_STOP_MS) {
                autoStopCalledRef.current = true;
                stopTracking();
                onSpeedViolation();
                return;
              }
            } else {
              setIsSpeedWarning(false);
              violationStartRef.current = null;
            }
          } else {
            setIsSpeedWarning(false);
            violationStartRef.current = null;
          }

          // ── 정지 패턴 감지 (쓰레기 줍기) ─────────────────────
          if (speedMs >= MOVE_SPEED_MS) {
            wasMovingRef.current = true;
          } else if (speedMs < STOP_SPEED_MS && wasMovingRef.current) {
            wasMovingRef.current = false;
            if (!autoStopCalledRef.current) {
              setStopCount((prev) => prev + 1);
            }
          }

          // ── 경로 거리 누적 ────────────────────────────────────
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
    currentSpeed,
    isSpeedWarning,
    duration,
    stopCount,
    wakeLockActive,
    isBackground,
    gpsAccuracy,   // 현재 GPS 오차 반경 (m) — UI 표시용
    gpsReady,      // 워밍업 완료 여부 — UI 표시용
    startTracking,
    stopTracking,
  };
}
