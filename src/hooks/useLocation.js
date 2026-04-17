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
const GPS_GAP_THRESHOLD_SEC  = 15;   // 15초 이상 갭 → 거리/속도 계산 건너뜀 (점핑 방지)
const GPS_RESUME_SETTLE      = 3;    // 갭 후 연속 3회 정상 수신해야 다시 기록 시작

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

// ─── Capacitor 네이티브 환경 감지 ────────────────────────
// window.Capacitor가 있고 네이티브 플랫폼(iOS/Android)이면 true
function isNativePlatform() {
  try {
    return typeof window !== "undefined"
      && window.Capacitor
      && window.Capacitor.isNativePlatform
      && window.Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

// ─── 백그라운드 위치 플러그인 동적 로드 ──────────────────
// 웹에서는 import 실패해도 에러 없이 null 반환
let _bgGeoPlugin = null;
async function getBgGeoPlugin() {
  if (_bgGeoPlugin) return _bgGeoPlugin;
  try {
    const mod = await import("@capgo/background-geolocation");
    _bgGeoPlugin = mod.BackgroundGeolocation || mod.default;
    return _bgGeoPlugin;
  } catch {
    // 플러그인 미설치 또는 웹 환경 → null
    return null;
  }
}

// ─── Hook ────────────────────────────────────────────────
// backgroundModeEnabled: 관리자가 Firestore에서 ON/OFF 한 설정값
export function useLocation({ onSpeedViolation, backgroundModeEnabled = false } = {}) {
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

  // ── 백그라운드 모드 실제 사용 여부 ─────────────────────
  const [bgNativeActive, setBgNativeActive] = useState(false);

  const watchIdRef          = useRef(null);
  const lastPositionRef     = useRef(null);
  const violationStartRef   = useRef(null);
  const autoStopCalledRef   = useRef(false);
  const goodReadingsRef     = useRef(0);   // 연속 정상 수신 횟수 (워밍업용)
  const bgWatcherIdRef      = useRef(null); // 네이티브 백그라운드 워처 ID
  const gapSettleRef        = useRef(0);   // GPS 갭 후 재안정화 카운터

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

  // 네이티브 백그라운드 사용 조건: 관리자 ON + Capacitor 네이티브
  const useNativeBg = backgroundModeEnabled && isNativePlatform();

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

  // ─── 공통 위치 처리 함수 (웹/네이티브 공용) ──────────
  const processPosition = useCallback((lat, lng, accuracy, now) => {
    // ── [필터 1] 정확도 체크 ─────────────────────────────
    setGpsAccuracy(Math.round(accuracy));
    if (accuracy > GPS_ACCURACY_THRESHOLD) {
      goodReadingsRef.current = 0;
      gapSettleRef.current = 0;
      setGpsReady(false);
      return;
    }

    // ── [필터 2] GPS 워밍업 (최초 시작 시) ───────────────
    if (goodReadingsRef.current < GPS_WARMUP_COUNT) {
      goodReadingsRef.current += 1;
      lastPositionRef.current = { lat, lng, timestamp: now };
      if (goodReadingsRef.current < GPS_WARMUP_COUNT) return;
      setGpsReady(true);
    }

    if (lastPositionRef.current) {
      const { lat: pLat, lng: pLng, timestamp: pTime } = lastPositionRef.current;
      const elapsedSec = Math.max((now - pTime) / 1000, 0.001);

      // ── [필터 3] GPS 갭 감지 (신호 끊김 후 복귀) ────────
      // 15초 이상 갭이 발생하면 → 위치만 갱신, 거리/속도 계산 건너뜀
      // 이후 연속 3회 정상 수신될 때까지 재안정화 기간
      if (elapsedSec > GPS_GAP_THRESHOLD_SEC) {
        gapSettleRef.current = 0; // 재안정화 카운터 리셋
        lastPositionRef.current = { lat, lng, timestamp: now };
        setCurrentSpeed(0);
        setIsSpeedWarning(false);
        violationStartRef.current = null;
        // 경로에는 추가 (선 연결은 유지하되 거리는 미계산)
        if (!autoStopCalledRef.current) {
          setPath((prev) => [...prev, { lat, lng }]);
        }
        return;
      }

      // ── [필터 3-1] 갭 후 재안정화 기간 ─────────────────
      // 갭 복귀 직후 GPS가 불안정할 수 있으므로 3회 연속 정상 수신 확인
      if (gapSettleRef.current < GPS_RESUME_SETTLE) {
        gapSettleRef.current += 1;
        lastPositionRef.current = { lat, lng, timestamp: now };
        if (!autoStopCalledRef.current) {
          setPath((prev) => [...prev, { lat, lng }]);
        }
        return;
      }

      const distKm     = haversineDistance(pLat, pLng, lat, lng);
      const distM      = distKm * 1000;
      const elapsedH   = elapsedSec / 3600;
      const speedKmh   = distKm / elapsedH;
      const speedMs    = distM / elapsedSec;

      // ── [필터 4] 이상치(순간이동) 감지 ──────────────────
      if (speedMs > GPS_OUTLIER_MAX_MS) return;

      const roundedSpeed = Math.round(speedKmh);
      setCurrentSpeed(roundedSpeed);

      // ── 이동수단 감지 (30km/h 초과) ──────────────────────
      if (onSpeedViolation) {
        if (speedKmh > SPEED_LIMIT_KMH) {
          setIsSpeedWarning(true);
          if (!violationStartRef.current) violationStartRef.current = now;
          if (!autoStopCalledRef.current && now - violationStartRef.current >= AUTO_STOP_MS) {
            autoStopCalledRef.current = true;
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

    // 정상 수신 → 갭 카운터 유지 (이미 settle 완료 상태)
    gapSettleRef.current = GPS_RESUME_SETTLE;
    lastPositionRef.current = { lat, lng, timestamp: now };
  }, [onSpeedViolation]);

  // ─── 네이티브 백그라운드 워처 중지 ────────────────────
  const stopNativeBgWatcher = useCallback(async () => {
    if (bgWatcherIdRef.current != null) {
      try {
        const plugin = await getBgGeoPlugin();
        if (plugin) {
          await plugin.removeWatcher({ id: bgWatcherIdRef.current });
        }
      } catch (e) {
        console.warn("[BgGeo] 워처 제거 실패:", e);
      }
      bgWatcherIdRef.current = null;
      setBgNativeActive(false);
    }
  }, []);

  // ─── stopTracking ─────────────────────────────────────
  const stopTracking = useCallback(() => {
    // 웹 워처 중지
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    // 네이티브 백그라운드 워처 중지
    stopNativeBgWatcher();

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
    gapSettleRef.current       = 0;
    releaseWakeLock();
  }, [releaseWakeLock, stopNativeBgWatcher]);

  // ─── 네이티브 백그라운드 워처 시작 ────────────────────
  // 포그라운드에서는 웹 GPS가 담당, 백그라운드 진입 시에만 네이티브가 위치 수신
  const startNativeBgWatcher = useCallback(async () => {
    const plugin = await getBgGeoPlugin();
    if (!plugin) {
      console.warn("[BgGeo] 플러그인 없음 — 웹 모드로 동작");
      return false;
    }
    try {
      const watcherId = await plugin.addWatcher(
        {
          backgroundMessage: "플로깅 경로를 기록하고 있어요",
          backgroundTitle: "오백원의 행복 — 플로깅 진행 중",
          requestPermissions: true,
          stale: false,
          distanceFilter: 5, // 5m 이동마다 업데이트
        },
        // 위치 콜백 — 백그라운드에서만 위치 처리 (포그라운드는 웹 GPS가 담당)
        (location, error) => {
          if (error) {
            console.warn("[BgGeo] 위치 오류:", error);
            return;
          }
          if (location && document.visibilityState === "hidden") {
            // 백그라운드 상태일 때만 네이티브 위치 데이터 사용
            processPosition(
              location.latitude,
              location.longitude,
              location.accuracy || 10,
              Date.now()
            );
          }
        }
      );
      bgWatcherIdRef.current = watcherId;
      setBgNativeActive(true);
      return true;
    } catch (e) {
      console.warn("[BgGeo] 워처 시작 실패:", e);
      return false;
    }
  }, [processPosition]);

  // ─── startTracking ────────────────────────────────────
  const startTracking = useCallback(async (reset = true) => {
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
    gapSettleRef.current       = 0;

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

    // ── 네이티브 백그라운드 모드 (보조) ────────────────────
    // 웹 GPS와 병행 — 포그라운드는 웹 GPS, 백그라운드는 네이티브가 담당
    if (useNativeBg) {
      startNativeBgWatcher().then((started) => {
        if (started) {
          console.log("[BgGeo] 네이티브 백그라운드 GPS 대기 중 (백그라운드 진입 시 활성화)");
        }
      });
    }

    // ── 웹 기본 GPS 추적 (항상 실행) ────────────────────
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        processPosition(
          pos.coords.latitude,
          pos.coords.longitude,
          pos.coords.accuracy,
          Date.now()
        );

        // 속도 위반으로 자동 종료된 경우 처리
        if (autoStopCalledRef.current && onSpeedViolation) {
          stopTracking();
          onSpeedViolation();
        }
      },
      (err) => console.error("GPS 오류:", err),
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 15000,
      }
    );
  }, [onSpeedViolation, stopTracking, requestWakeLock, useNativeBg, startNativeBgWatcher, processPosition]);

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
    bgNativeActive,   // 네이티브 백그라운드 GPS 활성 여부 — UI 표시용
    gpsAccuracy,      // 현재 GPS 오차 반경 (m) — UI 표시용
    gpsReady,         // 워밍업 완료 여부 — UI 표시용
    startTracking,
    stopTracking,
  };
}
