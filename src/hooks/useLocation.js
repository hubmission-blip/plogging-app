"use client";
import { useState, useRef, useCallback, useEffect } from "react";

// ─── 상수 ───────────────────────────────────────────────
const SPEED_LIMIT_KMH   = 30;    // 이동수단 경고 속도
const AUTO_STOP_SECONDS = 5;     // N초 연속 초과 시 자동 종료
const AUTO_STOP_MS      = AUTO_STOP_SECONDS * 1000;

// ③ 정지 패턴 감지 임계값
const MOVE_SPEED_MS = 1.0;   // m/s 이상 → "이동 중" 판정 (≈ 3.6 km/h)
const STOP_SPEED_MS = 0.5;   // m/s 이하 → "정지" 판정 (≈ 1.8 km/h)

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
  const [currentSpeed, setCurrentSpeed] = useState(0);      // km/h 표시용
  const [isSpeedWarning, setIsSpeedWarning] = useState(false);

  // ② 경과 시간 (초) — 1초 인터벌로 업데이트
  const [duration, setDuration]   = useState(0);
  // ③ 정지(줍기) 횟수
  const [stopCount, setStopCount] = useState(0);

  const watchIdRef          = useRef(null);
  const lastPositionRef     = useRef(null);    // { lat, lng, timestamp }
  const violationStartRef   = useRef(null);    // 속도 초과 시작 시각
  const autoStopCalledRef   = useRef(false);   // 자동 종료 중복 방지

  // ── Wake Lock (화면 꺼짐 방지) ─────────────────────────
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [isBackground,   setIsBackground]   = useState(false); // 백그라운드 전환 여부
  const wakeLockRef     = useRef(null);
  const bgTimerRef      = useRef(null);       // 백그라운드 경과 시간 타이머
  const isTrackingRef   = useRef(false);      // 백그라운드 핸들러에서 참조용

  // ③ 정지 패턴 감지용 ref
  const wasMovingRef        = useRef(false);   // 직전 상태가 "이동 중"이었는지
  // ② 타이머 ref
  const trackingStartRef    = useRef(null);
  const durationIntervalRef = useRef(null);
  // 계속 플로깅하기 재개를 위해 현재 duration을 ref로 미러링
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
      // Wake Lock 거부 또는 미지원 — 조용히 실패
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
        // 백그라운드 전환
        if (isTrackingRef.current) setIsBackground(true);
      } else {
        // 포그라운드 복귀
        setIsBackground(false);
        if (bgTimerRef.current) { clearTimeout(bgTimerRef.current); bgTimerRef.current = null; }
        // Wake Lock은 화면 꺼지면 자동 해제되므로 복귀 시 재요청
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
    // 타이머 정지
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    setIsTracking(false);
    setCurrentSpeed(0);
    setIsSpeedWarning(false);
    setIsBackground(false);
    violationStartRef.current  = null;
    autoStopCalledRef.current  = false;
    wasMovingRef.current       = false;
    isTrackingRef.current      = false;
    releaseWakeLock();
  }, [releaseWakeLock]);

  // ─── startTracking ────────────────────────────────────
  // reset=true  → 처음 시작 (모든 값 초기화)
  // reset=false → 계속 플로깅하기 (거리·시간·줍기 횟수 유지하고 재개)
  const startTracking = useCallback((reset = true) => {
    if (reset) {
      // 처음 시작: 전체 초기화
      setPath([]);
      setDistance(0);
      setDuration(0);
      durationRef.current        = 0;
      setStopCount(0);
      lastPositionRef.current    = null;
      trackingStartRef.current   = Date.now();
    } else {
      // 재개: 누적값 유지, 타이머 시작 시각만 보정
      // (이미 경과한 시간을 빼서 타이머가 이어서 올라가도록)
      lastPositionRef.current    = null;
      trackingStartRef.current   = Date.now() - (durationRef.current * 1000);
    }

    setCurrentSpeed(0);
    setIsSpeedWarning(false);
    setIsBackground(false);
    violationStartRef.current  = null;
    autoStopCalledRef.current  = false;
    wasMovingRef.current       = false;
    isTrackingRef.current      = true;

    // Wake Lock 요청 (화면 꺼짐 방지)
    requestWakeLock();

    // ② 1초 타이머 시작
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
        const { latitude: lat, longitude: lng } = pos.coords;
        const now = Date.now();

        if (lastPositionRef.current) {
          const { lat: pLat, lng: pLng, timestamp: pTime } = lastPositionRef.current;

          const distKm    = haversineDistance(pLat, pLng, lat, lng);
          const elapsedSec = (now - pTime) / 1000;
          const elapsedH  = elapsedSec / 3600;

          const speedKmh  = elapsedH > 0 ? distKm / elapsedH : 0;
          const speedMs   = elapsedSec > 0 ? (distKm * 1000) / elapsedSec : 0; // m/s
          const roundedSpeed = Math.round(speedKmh);

          setCurrentSpeed(roundedSpeed);

          // ── ① 이동수단 감지 (30km/h 초과) — onSpeedViolation이 있을 때만 작동 ──
          if (onSpeedViolation) {
            if (speedKmh > SPEED_LIMIT_KMH) {
              setIsSpeedWarning(true);
              if (!violationStartRef.current) {
                violationStartRef.current = now;
              }
              if (
                !autoStopCalledRef.current &&
                now - violationStartRef.current >= AUTO_STOP_MS
              ) {
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
            // 속도제한 OFF → 경고 상태 항상 해제
            setIsSpeedWarning(false);
            violationStartRef.current = null;
          }

          // ── ③ 정지 패턴 감지 (쓰레기 줍기 행동) ──────────────
          if (speedMs >= MOVE_SPEED_MS) {
            // 이동 중
            wasMovingRef.current = true;
          } else if (speedMs < STOP_SPEED_MS && wasMovingRef.current) {
            // 이동 → 정지 전환 감지 → 줍기 행동으로 카운트
            wasMovingRef.current = false;
            if (!autoStopCalledRef.current) {
              setStopCount((prev) => prev + 1);
            }
          }

          // ── 경로 거리 누적 ──────────────────────────────────
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
    currentSpeed,      // km/h — 화면 표시용
    isSpeedWarning,    // true 이면 경고 배너
    duration,          // 경과 시간 (초) — ② 조건 검증용
    stopCount,         // 정지 횟수 — ③ 줍기 횟수 검증용
    wakeLockActive,    // Wake Lock 활성 여부
    isBackground,      // 백그라운드 전환 여부
    startTracking,
    stopTracking,
  };
}