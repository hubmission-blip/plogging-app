"use client";

import { notifyPloggingComplete } from "@/lib/notify";
import Link from "next/link";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useKakaoLoader } from "react-kakao-maps-sdk";
import MapView from "@/components/MapView";
import { useLocation } from "@/hooks/useLocation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  doc, collection, addDoc, updateDoc, setDoc,
  increment, serverTimestamp, query,
  where, getDocs, deleteDoc
} from "firebase/firestore";
import { calculatePoints } from "@/lib/pointCalc";
import { getWeekNumber, getExpiresAt, isExpired, getRouteColor } from "@/lib/routeUtils";

// ─── 인증 조건 상수 ───────────────────────────────────────
const MIN_DISTANCE_KM  = 0.5;   // ② 최소 거리 500m
const MIN_DURATION_SEC = 600;   // ② 최소 시간 10분
const MIN_STOPS        = 3;     // ③ 최소 정지(줍기) 횟수

// ─── 시간 포맷 (초 → MM:SS) ──────────────────────────────
function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Cloudinary 업로드 ────────────────────────────────────
async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "plogging");
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );
  if (!res.ok) throw new Error("이미지 업로드 실패");
  const data = await res.json();
  return data.secure_url;
}

// ─── 이동수단 자동종료 모달 ───────────────────────────────
function SpeedViolationModal({ onClose }) {
  return (
    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
        <div className="text-5xl mb-3">🚗</div>
        <h2 className="text-xl font-bold text-red-600 mb-2">이동수단 감지!</h2>
        <p className="text-gray-600 text-sm mb-1">
          시속 <span className="font-bold text-red-500">30km/h</span>를 5초 이상 초과했어요.
        </p>
        <p className="text-gray-500 text-sm mb-5">
          플로깅은 걷거나 뛰는 활동이에요. 🚶‍♂️<br />
          이번 기록은 포인트가 지급되지 않아요.
        </p>
        <button
          onClick={onClose}
          className="w-full bg-red-500 text-white py-3 rounded-xl font-bold"
        >
          확인
        </button>
      </div>
    </div>
  );
}

// ─── 조건 미달 모달 ───────────────────────────────────────
function ValidationFailModal({ errors, onRetry, onForceStop }) {
  return (
    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="text-center mb-4">
          <div className="text-4xl mb-2">⚠️</div>
          <h2 className="text-xl font-bold text-orange-600">플로깅 인증 조건 미달</h2>
          <p className="text-gray-500 text-sm mt-1">아래 조건을 충족해야 포인트가 지급돼요</p>
        </div>

        <div className="space-y-2 mb-5">
          {errors.map((e, i) => (
            <div key={i} className="flex items-start gap-2 bg-orange-50 rounded-xl px-3 py-2">
              <span className="text-orange-500 mt-0.5">✗</span>
              <span className="text-sm text-gray-700">{e}</span>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <button
            onClick={onRetry}
            className="w-full bg-green-500 text-white py-3 rounded-xl font-bold"
          >
            🚶 계속 플로깅하기
          </button>
          <button
            onClick={onForceStop}
            className="w-full bg-gray-100 text-gray-500 py-2.5 rounded-xl text-sm"
          >
            그냥 종료하기 (포인트 없음)
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 사진 인증 필수 모달 ─────────────────────────────────
function PhotoRequiredModal({ onConfirm, onSkip, uploading }) {
  const [file, setFile]       = useState(null);
  const [preview, setPreview] = useState(null);
  const inputRef              = useRef(null);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  return (
    <div className="absolute inset-0 bg-black/70 flex items-end justify-center z-20 p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
        <div className="text-center mb-4">
          <div className="text-4xl mb-2">📸</div>
          <h2 className="text-lg font-bold text-gray-800">수거 사진 인증</h2>
          <p className="text-gray-500 text-sm mt-1">
            플로깅 포인트 지급을 위해<br />
            수거한 쓰레기 사진을 촬영해주세요
          </p>
        </div>

        {/* 사진 미리보기 or 촬영 버튼 */}
        {preview ? (
          <div className="relative mb-4">
            <img
              src={preview}
              alt="인증 사진"
              className="w-full h-48 object-cover rounded-2xl"
            />
            <button
              onClick={() => { setFile(null); setPreview(null); }}
              className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full h-36 border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center gap-2 mb-4 active:bg-gray-50"
          >
            <span className="text-3xl">🗑️</span>
            <span className="text-sm text-gray-500 font-medium">카메라로 찍기 / 사진 선택</span>
          </button>
        )}

        {/* 숨겨진 파일 입력 (카메라 우선) */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* 버튼 */}
        <div className="space-y-2">
          <button
            onClick={() => file && onConfirm(file)}
            disabled={!file || uploading}
            className={`w-full py-3.5 rounded-2xl font-bold transition-colors
              ${file && !uploading
                ? "bg-green-500 text-white"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
          >
            {uploading ? "업로드 중... ⏳" : "✅ 인증 완료 (포인트 지급)"}
          </button>
          <button
            onClick={onSkip}
            disabled={uploading}
            className="w-full py-2.5 rounded-2xl text-sm text-gray-400"
          >
            건너뛰기 (포인트 지급 안 됨)
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 맵 페이지 ──────────────────────────────────────
function MapPageInner() {
  const [loading, error] = useKakaoLoader({
    appkey: process.env.NEXT_PUBLIC_KAKAO_MAP_KEY,
  });

  const router       = useRouter();
  const searchParams = useSearchParams();
  const groupId      = searchParams.get("groupId");
  const groupSize    = parseInt(searchParams.get("groupSize") || "1");
  const { user }     = useAuth();

  const [result, setResult]                     = useState(null);
  const [pastRoutes, setPastRoutes]             = useState([]);
  const [savedRouteId, setSavedRouteId]         = useState(null);

  // 속도 위반 자동종료
  const [speedViolationStop, setSpeedViolationStop] = useState(false);

  // 조건 미달 모달
  const [showValidationFail, setShowValidationFail] = useState(false);
  const [validationErrors, setValidationErrors]     = useState([]);

  // 사진 인증 모달
  const [showPhotoModal, setShowPhotoModal]     = useState(false);
  const [pendingData, setPendingData]           = useState(null); // 조건 통과 후 임시 저장
  const [uploading, setUploading]               = useState(false);

  const savedPathRef     = useRef([]);
  const savedDistanceRef = useRef(0);

  const handleSpeedViolation = useCallback(() => {
    setSpeedViolationStop(true);
  }, []);

  const {
    path,
    distance,
    isTracking,
    currentSpeed,
    isSpeedWarning,
    duration,    // ② 경과 시간 (초)
    stopCount,   // ③ 정지 횟수
    startTracking,
    stopTracking,
  } = useLocation({ onSpeedViolation: handleSpeedViolation });

  useEffect(() => {
    if (isTracking) {
      savedPathRef.current     = path;
      savedDistanceRef.current = distance;
    }
  }, [path, distance, isTracking]);

  const fetchPastRoutes = useCallback(async () => {
    if (!user) return;
    try {
      const q    = query(collection(db, "routes"), where("userId", "==", user.uid));
      const snap = await getDocs(q);
      const routes = [];
      const expiredIds = [];

      snap.forEach((docSnap) => {
        const data = { id: docSnap.id, ...docSnap.data() };
        if (isExpired(data.expiresAt)) {
          expiredIds.push(docSnap.id);
        } else {
          routes.push({
            id:         data.id,
            coords:     data.coords,
            color:      getRouteColor(data.weekNumber),
            weekNumber: data.weekNumber,
            distance:   data.distance,
          });
        }
      });

      for (const id of expiredIds) {
        await deleteDoc(doc(db, "routes", id));
      }
      setPastRoutes(routes);
    } catch (e) {
      console.error("동선 불러오기 실패:", e);
    }
  }, [user]);

  useEffect(() => {
    if (!user || loading) return;
    fetchPastRoutes();
  }, [user, loading, fetchPastRoutes]);

  // ─── Firestore 저장 + 포인트 지급 ──────────────────────
  const saveRoute = useCallback(async ({ points, photoUrl = null }) => {
    if (!pendingData) return;
    const { path: savedPath, distance: savedDist, duration: savedDur, stopCount: savedStops, groupSz } = pendingData;
    const weekNumber = getWeekNumber();
    const expiresAt  = getExpiresAt();

    try {
      const routeDoc = await addDoc(collection(db, "routes"), {
        userId:    user?.uid || "anonymous",
        coords:    savedPath,
        distance:  savedDist,
        points:    points,
        duration:  savedDur,
        stopCount: savedStops,
        photoUrl:  photoUrl,
        weekNumber,
        expiresAt,
        verified:  !!photoUrl,   // 사진 인증 여부
        createdAt: serverTimestamp(),
      });
      setSavedRouteId(routeDoc.id);

      if (user && points > 0) {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
          totalPoints:   increment(points),
          totalDistance: increment(savedDist),
          ploggingCount: increment(1),
        }).catch(async () => {
          await setDoc(doc(db, "users", user.uid), {
            uid:           user.uid,
            email:         user.email || "",
            totalPoints:   points,
            totalDistance: savedDist,
            ploggingCount: 1,
            createdAt:     serverTimestamp(),
          });
        });
      }

      notifyPloggingComplete(savedDist, points);
      fetchPastRoutes();
    } catch (e) {
      console.error("저장 실패:", e);
      alert("저장 중 오류가 발생했습니다");
    }
  }, [pendingData, user, fetchPastRoutes]);

  // ─── 종료 버튼 핸들러 ──────────────────────────────────
  const handleStop = async () => {
    stopTracking();
    if (path.length < 2) return;

    // ── 조건 ② ③ 검증 ──────────────────────────────────
    const errors = [];

    if (distance < MIN_DISTANCE_KM) {
      errors.push(
        `최소 거리 부족: ${(distance * 1000).toFixed(0)}m 이동 (최소 500m 필요)`
      );
    }
    if (duration < MIN_DURATION_SEC) {
      errors.push(
        `최소 시간 부족: ${formatDuration(duration)} 활동 (최소 10분 필요)`
      );
    }
    if (stopCount < MIN_STOPS) {
      errors.push(
        `쓰레기 줍기 횟수 부족: ${stopCount}회 감지 (최소 3회 필요)`
      );
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      setShowValidationFail(true);
      return; // 포인트 미지급, 사진 모달 안 띄움
    }

    // ── 조건 통과 → 사진 인증 단계로 ──────────────────
    const { total, breakdown } = calculatePoints({ distanceKm: distance, groupSize });
    setPendingData({
      path:       [...path],
      distance,
      duration,
      stopCount,
      groupSz:    groupSize,
      total,
      breakdown,
    });
    setShowPhotoModal(true);
  };

  // ─── 사진 인증 완료 → 포인트 지급 ─────────────────────
  const handlePhotoConfirm = async (file) => {
    setUploading(true);
    try {
      const photoUrl = await uploadToCloudinary(file);
      const { total, breakdown } = pendingData;

      await saveRoute({ points: total, photoUrl });
      setShowPhotoModal(false);
      setResult({ distance: pendingData.distance, total, breakdown, verified: true });
    } catch (e) {
      alert("사진 업로드 실패: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  // ─── 사진 건너뛰기 → 포인트 0 ─────────────────────────
  const handlePhotoSkip = async () => {
    const { distance: d, breakdown } = pendingData;
    await saveRoute({ points: 0, photoUrl: null });
    setShowPhotoModal(false);
    setResult({
      distance: d,
      total:    0,
      breakdown: [{ label: "사진 미인증 (포인트 미지급)", points: 0 }],
      verified: false,
    });
    setPendingData(null);
  };

  // ─── 조건 미달 → 계속 플로깅 ──────────────────────────
  const handleRetryPlogging = () => {
    setShowValidationFail(false);
    // 다시 트래킹 시작 (기존 거리·경로 유지 불가 → 새로 시작)
    startTracking();
  };

  // ─── 조건 미달 → 강제 종료 (포인트 없음) ──────────────
  const handleForceStop = async () => {
    setShowValidationFail(false);
    // 경로 저장은 하되 points=0
    if (path.length >= 2) {
      setPendingData({
        path:       [...path],
        distance,
        duration,
        stopCount,
        groupSz:    groupSize,
        total:      0,
        breakdown:  [{ label: "인증 조건 미달 (포인트 미지급)", points: 0 }],
      });
      await saveRoute({ points: 0, photoUrl: null });
      setResult({ distance, total: 0, breakdown: [{ label: "인증 조건 미달", points: 0 }], verified: false });
    }
  };

  // ─── Early returns ─────────────────────────────────────
  if (!user) return (
    <div className="flex flex-col items-center justify-center h-screen gap-4 p-6 text-center">
      <div className="text-6xl">🔑</div>
      <h2 className="text-xl font-bold text-gray-700">로그인이 필요해요</h2>
      <p className="text-gray-400 text-sm">플로깅 기록과 포인트 적립을 위해 로그인해주세요</p>
      <Link href="/login" className="bg-green-500 text-white px-8 py-3 rounded-full font-bold">
        로그인하기
      </Link>
    </div>
  );

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-lg">🗺️ 지도 로딩 중...</p>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-red-500">❌ 지도 로드 실패: {String(error)}</p>
    </div>
  );

  return (
    <div className="relative w-full h-screen">
      <MapView currentPath={path} pastRoutes={pastRoutes} />

      {/* ── 상단 정보바 ─────────────────────────────────── */}
      <div className="absolute top-4 left-0 right-0 flex justify-center z-10 px-4">
        <div className="bg-white rounded-2xl px-4 py-2.5 shadow-lg flex items-center gap-2.5 flex-wrap justify-center">
          {/* 거리 */}
          <span className="text-sm font-bold text-green-700">
            📍 {distance.toFixed(2)} km
          </span>

          {isTracking && (
            <>
              {/* 경과 시간 */}
              <span className="text-gray-300">|</span>
              <span className={`text-sm font-bold ${duration >= MIN_DURATION_SEC ? "text-green-500" : "text-gray-600"}`}>
                ⏱ {formatDuration(duration)}
              </span>

              {/* 줍기 횟수 */}
              <span className="text-gray-300">|</span>
              <span className={`text-sm font-bold ${stopCount >= MIN_STOPS ? "text-green-500" : "text-orange-500"}`}>
                🗑️ {stopCount}회
              </span>

              {/* 현재 속도 */}
              <span className="text-gray-300">|</span>
              <span className={`text-sm font-bold ${isSpeedWarning ? "text-red-500" : "text-blue-500"}`}>
                🚀 {currentSpeed} km/h
              </span>

              <span className="text-xs text-red-500 animate-pulse">● 기록 중</span>
            </>
          )}
        </div>
      </div>

      {/* ── 인증 조건 진행 상황 (추적 중에만) ─────────────── */}
      {isTracking && (
        <div className="absolute top-20 left-4 right-4 z-10">
          <div className="bg-white/90 rounded-2xl px-3 py-2 shadow flex items-center justify-around text-xs">
            <div className={`flex flex-col items-center ${distance >= MIN_DISTANCE_KM ? "text-green-600" : "text-gray-400"}`}>
              <span>{distance >= MIN_DISTANCE_KM ? "✅" : "⬜"}</span>
              <span>500m 이상</span>
              <span className="font-bold">{(distance * 1000).toFixed(0)}m</span>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className={`flex flex-col items-center ${duration >= MIN_DURATION_SEC ? "text-green-600" : "text-gray-400"}`}>
              <span>{duration >= MIN_DURATION_SEC ? "✅" : "⬜"}</span>
              <span>10분 이상</span>
              <span className="font-bold">{formatDuration(duration)}</span>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className={`flex flex-col items-center ${stopCount >= MIN_STOPS ? "text-green-600" : "text-gray-400"}`}>
              <span>{stopCount >= MIN_STOPS ? "✅" : "⬜"}</span>
              <span>3회 이상 줍기</span>
              <span className="font-bold">{stopCount}회</span>
            </div>
          </div>
        </div>
      )}

      {/* ── 속도 경고 배너 ──────────────────────────────── */}
      {isSpeedWarning && isTracking && (
        <div className="absolute top-36 left-0 right-0 flex justify-center z-10 px-4">
          <div className="bg-red-500 text-white rounded-2xl px-5 py-3 shadow-xl flex items-center gap-2 animate-pulse">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-bold text-sm">이동수단 감지!</p>
              <p className="text-xs opacity-90">시속 30km/h 초과 — 5초 지속 시 자동 종료됩니다</p>
            </div>
          </div>
        </div>
      )}

      {/* ── 그룹 플로깅 표시 ────────────────────────────── */}
      {groupId && !isSpeedWarning && !isTracking && (
        <div className="absolute top-36 left-0 right-0 flex justify-center z-10">
          <div className="bg-purple-500 text-white rounded-full px-4 py-1 text-xs font-bold shadow">
            👥 그룹 플로깅 중 · {groupSize}명 · +{groupSize * 5}P 보너스
          </div>
        </div>
      )}

      {/* ── 주차별 색상 범례 ─────────────────────────────── */}
      {pastRoutes.length > 0 && !isTracking && (
        <div className="absolute top-20 right-3 bg-white rounded-xl p-2 shadow-lg z-10">
          <p className="text-xs font-bold text-gray-500 mb-1">내 동선</p>
          {[
            { color: "#4CAF50", label: "이번 주" },
            { color: "#2196F3", label: "2주 전" },
            { color: "#FF9800", label: "3주 전" },
            { color: "#9C27B0", label: "4주 전" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5 mb-0.5">
              <div className="w-4 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-gray-600">{item.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── 하단 버튼 ────────────────────────────────────── */}
      <div className="absolute bottom-24 left-0 right-0 flex justify-center z-10">
        {!isTracking ? (
          <button
            onClick={startTracking}
            className="bg-green-500 text-white px-10 py-4 rounded-full text-lg font-bold shadow-xl active:scale-95 transition-transform"
          >
            🚶 플로깅 시작
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="bg-red-500 text-white px-10 py-4 rounded-full text-lg font-bold shadow-xl active:scale-95 transition-transform"
          >
            🏁 플로깅 종료
          </button>
        )}
      </div>

      {/* ── 이동수단 자동종료 모달 ──────────────────────── */}
      {speedViolationStop && (
        <SpeedViolationModal
          onClose={() => {
            setSpeedViolationStop(false);
            fetchPastRoutes();
          }}
        />
      )}

      {/* ── 조건 미달 모달 ──────────────────────────────── */}
      {showValidationFail && (
        <ValidationFailModal
          errors={validationErrors}
          onRetry={handleRetryPlogging}
          onForceStop={handleForceStop}
        />
      )}

      {/* ── 사진 인증 필수 모달 ─────────────────────────── */}
      {showPhotoModal && (
        <PhotoRequiredModal
          onConfirm={handlePhotoConfirm}
          onSkip={handlePhotoSkip}
          uploading={uploading}
        />
      )}

      {/* ── 결과 모달 ────────────────────────────────────── */}
      {result && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">{result.verified ? "🎉" : "📋"}</div>
              <h2 className="text-xl font-bold text-green-700">
                {result.verified ? "플로깅 인증 완료!" : "플로깅 종료"}
              </h2>
              {result.verified && (
                <span className="inline-block bg-green-100 text-green-700 text-xs font-bold px-3 py-0.5 rounded-full mt-1">
                  ✅ 사진 인증됨
                </span>
              )}
            </div>

            <div className={`rounded-xl p-4 mb-4 text-center ${result.total > 0 ? "bg-green-50" : "bg-gray-50"}`}>
              <p className={`text-3xl font-bold ${result.total > 0 ? "text-green-600" : "text-gray-400"}`}>
                {result.total > 0 ? `+${result.total} P` : "포인트 없음"}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {result.total > 0 ? "획득 포인트" : "사진 인증 필요"}
              </p>
            </div>

            <div className="space-y-2 mb-4">
              {result.breakdown.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-600">{item.label}</span>
                  <span className={`font-medium ${item.points > 0 ? "text-green-600" : "text-gray-400"}`}>
                    {item.points > 0 ? `+${item.points}P` : "0P"}
                  </span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between font-bold">
                <span>총 거리</span>
                <span>{result.distance.toFixed(2)} km</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setResult(null); setPendingData(null); }}
                className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-bold"
              >
                닫기
              </button>
              <button
                onClick={() => router.push("/history")}
                className="flex-1 bg-green-500 text-white py-3 rounded-xl font-bold"
              >
                기록 보기 →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg">🗺️ 지도 로딩 중...</p>
      </div>
    }>
      <MapPageInner />
    </Suspense>
  );
}