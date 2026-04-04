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
  where, getDocs, deleteDoc, limit,
} from "firebase/firestore";
import { calculatePoints } from "@/lib/pointCalc";
import { getWeekNumber, getExpiresAt, isExpired, getRouteColor } from "@/lib/routeUtils";

// ─── 인증 조건 상수 ───────────────────────────────────────
const MIN_DISTANCE_KM  = 0.5;
const MIN_DURATION_SEC = 600;
const MIN_STOPS        = 3;
const DAILY_MAX        = 3;     // A. 하루 최대 포인트 지급 횟수

// ─── 유틸 ─────────────────────────────────────────────────
function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r, dLng = (lng2 - lng1) * r;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1*r)*Math.cos(lat2*r)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function uploadToCloudinary(file) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "plogging");
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: fd }
  );
  if (!res.ok) throw new Error("이미지 업로드 실패");
  return (await res.json()).secure_url;
}

// ─── 플로깅 가능 시간 상수 ────────────────────────────────
const PLOGGING_START_HOUR = 6;  // 오전 6시
const PLOGGING_END_HOUR   = 20; // 오후 8시

function isWithinPloggingHours() {
  const hour = new Date().getHours();
  return hour >= PLOGGING_START_HOUR && hour < PLOGGING_END_HOUR;
}

// ─── 시간 제한 모달 ───────────────────────────────────────
function TimeRestrictionModal({ onClose }) {
  const hour = new Date().getHours();
  const isTooEarly = hour < PLOGGING_START_HOUR;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
        <div className="text-5xl mb-3">{isTooEarly ? "🌙" : "🌅"}</div>
        <h2 className="text-xl font-black text-gray-800 mb-1">
          {isTooEarly ? "아직 이른 시간이에요" : "오늘 플로깅은 마감됐어요"}
        </h2>
        <p className="text-gray-500 text-sm mb-1">
          플로깅 가능 시간은
        </p>
        <p className="text-green-600 font-black text-lg mb-3">
          오전 6:00 ~ 오후 8:00
        </p>
        <p className="text-gray-400 text-xs mb-5">
          {isTooEarly
            ? "안전한 플로깅을 위해 날이 밝은 후 시작해주세요 🌿"
            : "내일 아침 6시부터 다시 시작할 수 있어요 🌿"}
        </p>
        <button
          onClick={onClose}
          className="w-full bg-gray-100 text-gray-600 py-3 rounded-xl font-bold"
        >
          확인
        </button>
      </div>
    </div>
  );
}

// ─── A. 중복 플로깅 경고 모달 ────────────────────────────
function DuplicateWarningModal({ message, onContinue, onCancel }) {
  return (
    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="text-center mb-4">
          <div className="text-4xl mb-2">🔄</div>
          <h2 className="text-xl font-bold text-orange-600">중복 플로깅 감지</h2>
        </div>
        <p className="text-gray-600 text-sm text-center mb-5 whitespace-pre-line">{message}</p>
        <div className="space-y-2">
          <button onClick={onContinue}
            className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold">
            그래도 시작하기 (포인트 없음)
          </button>
          <button onClick={onCancel}
            className="w-full bg-gray-100 text-gray-600 py-2.5 rounded-xl text-sm font-medium">
            취소
          </button>
        </div>
      </div>
    </div>
  );
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
        <button onClick={onClose} className="w-full bg-red-500 text-white py-3 rounded-xl font-bold">
          확인
        </button>
      </div>
    </div>
  );
}

// ─── 준비 체크 모달 ───────────────────────────────────────
const READY_CHECKS = [
  { id: "gloves",  icon: "🧤", text: "쓰레기를 줍기 위한 집게나 장갑을 준비하셨나요?" },
  { id: "bag",     icon: "🛍️", text: "주운 쓰레기를 담을 봉투를 준비하셨나요?" },
  { id: "water",   icon: "💧", text: "활동 중 마실 물이나 음료를 챙기셨나요?" },
  { id: "comfort", icon: "👟", text: "걷기 편한 복장과 신발을 착용하셨나요?" },
];

function ReadyCheckModal({ onStart, onCancel }) {
  const [checked, setChecked] = useState({});
  const toggle = (id) => setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  const allChecked = READY_CHECKS.every((c) => checked[c.id]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-[200]">
      <div className="bg-white rounded-t-3xl w-full shadow-2xl overflow-hidden">
        {/* 핸들 */}
        <div className="pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* 헤더 */}
        <div className="px-5 pt-2 pb-4 border-b border-gray-100 text-center">
          <div className="text-4xl mb-2">🌿</div>
          <h2 className="text-lg font-black text-gray-800">플로깅 시작 전 체크리스트</h2>
          <p className="text-xs text-gray-400 mt-1">준비를 마치고 함께 깨끗한 지구를 만들어요!</p>
        </div>

        {/* 체크리스트 */}
        <div className="px-5 py-4 space-y-3">
          {READY_CHECKS.map((item) => (
            <button
              key={item.id}
              onClick={() => toggle(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all active:scale-[0.98]
                ${checked[item.id]
                  ? "bg-green-50 border-green-400"
                  : "bg-gray-50 border-gray-200"}`}
            >
              <span className="text-2xl flex-shrink-0">{item.icon}</span>
              <p className={`text-sm text-left flex-1 font-medium leading-snug
                ${checked[item.id] ? "text-green-700" : "text-gray-600"}`}>
                {item.text}
              </p>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all
                ${checked[item.id]
                  ? "bg-green-500 border-green-500 text-white"
                  : "border-gray-300"}`}>
                {checked[item.id] && <span className="text-xs font-black">✓</span>}
              </div>
            </button>
          ))}
        </div>

        {/* 버튼 */}
        <div className="px-5 pt-2 space-y-2" style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 16px))" }}>
          <button
            onClick={onStart}
            className={`w-full py-4 rounded-2xl font-black text-base transition-all
              ${allChecked
                ? "bg-gradient-to-r from-green-500 to-teal-500 text-white shadow-md active:scale-95"
                : "bg-green-500 text-white active:scale-95 shadow-md"}`}
          >
            {allChecked ? "✅ 준비 완료! 플로깅 시작" : "🚶 그냥 시작하기"}
          </button>
          <button
            onClick={onCancel}
            className="w-full py-3 rounded-2xl text-gray-400 text-sm font-medium bg-gray-100 active:bg-gray-200"
          >
            취소
          </button>
        </div>
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
          <button onClick={onRetry} className="w-full bg-green-500 text-white py-3 rounded-xl font-bold">
            🚶 계속 플로깅하기
          </button>
          <button onClick={onForceStop} className="w-full bg-gray-100 text-gray-500 py-2.5 rounded-xl text-sm">
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
            플로깅 포인트 지급을 위해<br />수거한 쓰레기 사진을 촬영해주세요
          </p>
        </div>
        {preview ? (
          <div className="relative mb-4">
            <img src={preview} alt="인증 사진" className="w-full h-48 object-cover rounded-2xl" />
            <button onClick={() => { setFile(null); setPreview(null); }}
              className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm">
              ✕
            </button>
          </div>
        ) : (
          <button onClick={() => inputRef.current?.click()}
            className="w-full h-36 border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center gap-2 mb-4 active:bg-gray-50">
            <span className="text-3xl">🗑️</span>
            <span className="text-sm text-gray-500 font-medium">카메라로 찍기 / 사진 선택</span>
          </button>
        )}
        <input ref={inputRef} type="file" accept="image/*" capture="environment"
          onChange={handleFileChange} className="hidden" />
        <div className="space-y-2">
          <button onClick={() => file && onConfirm(file)} disabled={!file || uploading}
            className={`w-full py-3.5 rounded-2xl font-bold transition-colors
              ${file && !uploading ? "bg-green-500 text-white" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}>
            {uploading ? "업로드 중... ⏳" : "✅ 인증 완료 (포인트 지급)"}
          </button>
          <button onClick={onSkip} disabled={uploading}
            className="w-full py-2.5 rounded-2xl text-sm text-gray-400">
            건너뛰기 (포인트 지급 안 됨)
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── B. 제휴 상점 상세 팝업 ──────────────────────────────
function PartnerDetailSheet({ partner, onClose }) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-30 p-4">
      <div className="bg-white rounded-3xl p-6 shadow-2xl border border-gray-100">
        {/* 상단 핸들 */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

        <div className="flex items-center gap-3 mb-3">
          <div className="text-4xl w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center">
            {partner.icon || "🏪"}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-gray-800 text-lg">{partner.name}</h2>
              {partner.badge && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${partner.badgeColor || "bg-green-100 text-green-700"}`}>
                  {partner.badge}
                </span>
              )}
            </div>
            {partner.address && (
              <p className="text-xs text-gray-400 mt-0.5">📍 {partner.address}</p>
            )}
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-3">{partner.desc}</p>

        <div className="bg-green-50 rounded-xl p-3 mb-4">
          <p className="text-xs text-gray-500 mb-0.5">파트너 혜택</p>
          <p className="text-sm font-medium text-green-700">🎁 {partner.benefit}</p>
        </div>

        {/* 거리 표시 */}
        {partner.distanceKm !== undefined && (
          <div className="bg-blue-50 rounded-xl p-2.5 mb-4 flex items-center gap-2">
            <span className="text-lg">📍</span>
            <span className="text-sm text-blue-700 font-medium">
              현재 위치에서 약 {(partner.distanceKm * 1000).toFixed(0)}m
            </span>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-2xl font-bold">
            닫기
          </button>
          {partner.contact && (
            <a href={partner.contact} target="_blank" rel="noopener noreferrer"
              className="flex-1 bg-green-500 text-white py-3 rounded-2xl font-bold text-center">
              바로가기 →
            </a>
          )}
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

  const [result, setResult]         = useState(null);
  const [pastRoutes, setPastRoutes] = useState([]);
  const [savedRouteId, setSavedRouteId] = useState(null);

  // 준비 체크 모달
  const [showReadyCheck, setShowReadyCheck] = useState(false);

  // 시간 제한 모달
  const [showTimeRestriction, setShowTimeRestriction] = useState(false);

  // A. 중복 방지
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicateMsg, setDuplicateMsg]                 = useState("");
  const noPointsOverride = useRef(false); // 경고 무시하고 시작할 때

  // B. 파트너 마커
  const [partnerMarkers, setPartnerMarkers]   = useState([]);
  const [selectedPartner, setSelectedPartner] = useState(null);

  // C. 타인 최근 경로
  const [nearbyRoutes, setNearbyRoutes] = useState([]);
  const [showNearby, setShowNearby]         = useState(true); // 타인 경로 토글
  const [showPastRoutes, setShowPastRoutes] = useState(true); // 내 지난 경로 토글

  // 사진/검증
  const [speedViolationStop, setSpeedViolationStop] = useState(false);
  const [showValidationFail, setShowValidationFail] = useState(false);
  const [validationErrors, setValidationErrors]     = useState([]);
  const [showPhotoModal, setShowPhotoModal]         = useState(false);
  const [uploading, setUploading]                   = useState(false);
  const pendingDataRef = useRef(null);

  const handleSpeedViolation = useCallback(() => {
    setSpeedViolationStop(true);
  }, []);

  const {
    path, distance, isTracking, currentSpeed,
    isSpeedWarning, duration, stopCount,
    startTracking, stopTracking,
  } = useLocation({ onSpeedViolation: handleSpeedViolation });

  // ─── A. 하루 플로깅 횟수 체크 ────────────────────────
  const checkPloggingLimit = useCallback(async () => {
    if (!user) return null;
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const q = query(
        collection(db, "routes"),
        where("userId", "==", user.uid),
        where("createdAt", ">=", todayStart)
      );
      const snap = await getDocs(q);
      const todayCount = snap.size;

      if (todayCount >= DAILY_MAX) {
        return `오늘 이미 ${todayCount}회 플로깅을 완료했어요.\n하루 최대 ${DAILY_MAX}회까지 포인트가 지급돼요.\n(추가 플로깅은 기록되지만 포인트 0)`;
      }
      return null;
    } catch (e) {
      console.error("횟수 체크 실패:", e);
      return null;
    }
  }, [user]);

  // ─── B. 파트너 마커 조회 ─────────────────────────────
  const fetchPartnerMarkers = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, "partners"));
      const list = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data.lat && data.lng && data.active !== false) {
          list.push({ id: d.id, ...data });
        }
      });
      setPartnerMarkers(list);
    } catch (e) {
      console.error("파트너 조회 실패:", e);
    }
  }, []);

  // ─── C. 타인 최근 경로 조회 ──────────────────────────
  const fetchNearbyRoutes = useCallback(async () => {
    if (!user) return;
    try {
      // 현재 위치 취득 (10km 필터용)
      let userLat = null, userLng = null;
      try {
        const pos = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
        );
        userLat = pos.coords.latitude;
        userLng = pos.coords.longitude;
      } catch {
        // GPS 권한 없거나 타임아웃 시 필터 없이 전체 조회
      }

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // 여유있게 불러온 후 클라이언트에서 거리 필터
      const q = query(
        collection(db, "routes"),
        where("createdAt", ">=", sevenDaysAgo),
        limit(150)
      );
      const snap = await getDocs(q);
      const RADIUS_KM = 10; // ← 반경 10km 이내만 표시
      const routes = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data.userId === user.uid || !data.coords || data.coords.length < 2) return;

        // 10km 반경 필터 (GPS 위치 있을 때만 적용)
        if (userLat !== null && data.coords[0]) {
          const dist = haversineKm(userLat, userLng, data.coords[0].lat, data.coords[0].lng);
          if (dist > RADIUS_KM) return;
        }

        routes.push({ id: d.id, coords: data.coords });
      });
      setNearbyRoutes(routes);
    } catch (e) {
      console.error("타인 경로 조회 실패:", e);
    }
  }, [user]);

  // ─── 내 과거 경로 조회 ───────────────────────────────
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
          // ── 주차 색상: createdAt 기준 실제 경과 일수로 계산 ──
          // (weekNumber 저장값은 ISO주 기준이라 불일치 발생 → 직접 계산)
          const WEEK_COLORS = ["#4CAF50", "#2196F3", "#FF9800", "#9C27B0"];
          const createdMs   = data.createdAt?.toMillis?.() || Date.now();
          const daysAgo     = Math.floor((Date.now() - createdMs) / (1000 * 60 * 60 * 24));
          const weeksAgo    = Math.min(Math.floor(daysAgo / 7), 3); // 0~3
          const routeColor  = WEEK_COLORS[weeksAgo];

          routes.push({
            id: data.id, coords: data.coords,
            color: routeColor,
            weekNumber: data.weekNumber, distance: data.distance,
          });
        }
      });
      for (const id of expiredIds) await deleteDoc(doc(db, "routes", id));
      setPastRoutes(routes);
    } catch (e) { console.error("동선 불러오기 실패:", e); }
  }, [user]);

  useEffect(() => {
    if (!user || loading) return;
    fetchPastRoutes();
    fetchNearbyRoutes();  // C. 타인 경로
    fetchPartnerMarkers(); // B. 파트너 마커
  }, [user, loading, fetchPastRoutes, fetchNearbyRoutes, fetchPartnerMarkers]);

  // ─── Firestore 저장 ──────────────────────────────────
  const saveRoute = useCallback(async ({
    routePath, routeDistance, routeDuration, routeStopCount,
    points, photoUrl = null,
  }) => {
    const weekNumber = getWeekNumber();
    const expiresAt  = getExpiresAt();
    try {
      const routeDoc = await addDoc(collection(db, "routes"), {
        userId: user?.uid || "anonymous",
        coords: routePath, distance: routeDistance,
        points, duration: routeDuration, stopCount: routeStopCount,
        photoUrl, weekNumber, expiresAt,
        verified: !!photoUrl,
        createdAt: serverTimestamp(),
      });
      setSavedRouteId(routeDoc.id);

      if (user && points > 0) {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
          totalPoints:   increment(points),
          totalDistance: increment(routeDistance),
          ploggingCount: increment(1),
        }).catch(async () => {
          await setDoc(doc(db, "users", user.uid), {
            uid: user.uid, email: user.email || "",
            totalPoints: points, totalDistance: routeDistance,
            ploggingCount: 1, createdAt: serverTimestamp(),
          });
        });
      }
      notifyPloggingComplete(routeDistance, points);
      fetchPastRoutes();
    } catch (e) {
      console.error("저장 실패:", e);
      alert("저장 중 오류가 발생했습니다");
    }
  }, [user, fetchPastRoutes]);

  // ─── 시작 버튼 (시간 체크 → 중복 체크 포함) ──────────
  const handleStart = async () => {
    // 1. 시간 제한 체크 (오전 6시 ~ 오후 8시)
    if (!isWithinPloggingHours()) {
      setShowTimeRestriction(true);
      return;
    }
    if (noPointsOverride.current) {
      // 경고 확인 후 포인트 없이 시작
      noPointsOverride.current = false;
      startTracking();
      return;
    }
    // 2. 중복 플로깅 체크
    const msg = await checkPloggingLimit();
    if (msg) {
      setDuplicateMsg(msg);
      setShowDuplicateWarning(true);
      return;
    }
    startTracking();
  };

  // ─── 종료 버튼 ───────────────────────────────────────
  const handleStop = () => {
    stopTracking();
    if (path.length < 2) return;

    const errors = [];
    if (!noPointsOverride.current) {
      if (distance < MIN_DISTANCE_KM)
        errors.push(`최소 거리 부족: ${(distance*1000).toFixed(0)}m (최소 500m)`);
      if (duration < MIN_DURATION_SEC)
        errors.push(`최소 시간 부족: ${formatDuration(duration)} (최소 10분)`);
      if (stopCount < MIN_STOPS)
        errors.push(`쓰레기 줍기 횟수 부족: ${stopCount}회 (최소 3회)`);
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      setShowValidationFail(true);
      return;
    }

    const { total, breakdown } = calculatePoints({ distanceKm: distance, groupSize });
    const earnedPoints = noPointsOverride.current ? 0 : total;
    const earnedBreakdown = noPointsOverride.current
      ? [{ label: "하루 횟수 초과 (포인트 미지급)", points: 0 }]
      : breakdown;

    pendingDataRef.current = {
      routePath: [...path], routeDistance: distance,
      routeDuration: duration, routeStopCount: stopCount,
      total: earnedPoints, breakdown: earnedBreakdown,
    };

    if (earnedPoints === 0) {
      // 포인트 없음 → 사진 건너뛰고 바로 저장
      saveRoute({ routePath: [...path], routeDistance: distance,
        routeDuration: duration, routeStopCount: stopCount,
        points: 0, photoUrl: null });
      setResult({ distance, total: 0, breakdown: earnedBreakdown, verified: false });
      pendingDataRef.current = null;
    } else {
      setShowPhotoModal(true);
    }
  };

  const handlePhotoConfirm = async (file) => {
    const p = pendingDataRef.current;
    if (!p) return;
    setUploading(true);
    try {
      const photoUrl = await uploadToCloudinary(file);
      await saveRoute({ ...p, points: p.total, photoUrl });
      setShowPhotoModal(false);
      setResult({ distance: p.routeDistance, total: p.total, breakdown: p.breakdown, verified: true });
    } catch (e) { alert("사진 업로드 실패: " + e.message); }
    finally { setUploading(false); pendingDataRef.current = null; }
  };

  const handlePhotoSkip = async () => {
    const p = pendingDataRef.current;
    if (!p) return;
    // 사진 미인증 → Firestore 저장 안 함 (DB 순수성 유지)
    setShowPhotoModal(false);
    setResult({ distance: p.routeDistance, total: 0,
      breakdown: [{ label: "사진 미인증 (포인트 미지급)", points: 0 }], verified: false });
    pendingDataRef.current = null;
  };

  const handleRetryPlogging = () => {
    setShowValidationFail(false);
    startTracking(false); // false = 거리·시간·줍기 횟수 유지하고 재개
  };

  const handleForceStop = () => {
    setShowValidationFail(false);
    // 조건 미달 기록 → Firestore 저장 안 함 (DB 순수성 유지)
    setResult({ distance, total: 0,
      breakdown: [{ label: "인증 조건 미달 (포인트 미지급)", points: 0 }], verified: false });
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

      {/* ── 지도 (nearbyRoutes, partnerMarkers 전달) ──── */}
      <MapView
        currentPath={path}
        pastRoutes={showPastRoutes ? pastRoutes : []}
        nearbyRoutes={showNearby ? nearbyRoutes : []}
        partnerMarkers={partnerMarkers}
        onPartnerClick={(partner) => setSelectedPartner(partner)}
      />

      {/* ── 상단 정보바 ─────────────────────────────────── */}
      <div className="absolute top-4 left-0 right-0 flex justify-center z-10 px-4">
        <div className="bg-white rounded-2xl px-4 py-2.5 shadow-lg flex items-center gap-2.5 flex-wrap justify-center">
          <span className="text-sm font-bold text-green-700">📍 {distance.toFixed(2)} km</span>
          {isTracking && (
            <>
              <span className="text-gray-300">|</span>
              <span className={`text-sm font-bold ${duration >= MIN_DURATION_SEC ? "text-green-500" : "text-gray-600"}`}>
                ⏱ {formatDuration(duration)}
              </span>
              <span className="text-gray-300">|</span>
              <span className={`text-sm font-bold ${isSpeedWarning ? "text-red-500" : "text-blue-500"}`}>
                🚀 {currentSpeed} km/h
              </span>
              <span className="text-xs text-red-500 animate-pulse basis-full text-center">● 기록 중</span>
            </>
          )}
        </div>
      </div>

      {/* ── 인증 조건 진행 상황 ─────────────────────────── */}
      {isTracking && (
        <div className="absolute top-20 left-4 right-4 z-10">
          <div className="bg-white/90 rounded-2xl px-3 py-2 shadow flex items-center justify-around text-xs">
            {[
              { label: "500m 이상", ok: distance >= MIN_DISTANCE_KM, val: `${(distance*1000).toFixed(0)}m` },
              { label: "10분 이상", ok: duration >= MIN_DURATION_SEC, val: formatDuration(duration) },
              { label: "3회 이상 줍기", ok: stopCount >= MIN_STOPS, val: `${stopCount}회` },
            ].map((item, i) => (
              <div key={i} className={`flex flex-col items-center ${item.ok ? "text-green-600" : "text-gray-400"}`}>
                <span>{item.ok ? "✅" : "⬜"}</span>
                <span>{item.label}</span>
                <span className="font-bold">{item.val}</span>
              </div>
            ))}
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

      {/* ── 그룹 플로깅 표시 ─────────────────────────────── */}
      {groupId && isTracking && !isSpeedWarning && (
        <div className="absolute top-36 left-0 right-0 flex justify-center z-10">
          <div className="bg-purple-500 text-white rounded-full px-4 py-1 text-xs font-bold shadow">
            👥 그룹 플로깅 중 · {groupSize}명 · +{groupSize * 5}P 보너스
          </div>
        </div>
      )}

      {/* ── 주차별 색상 범례 + 경로 토글 ────────────────── */}
      {!isTracking && (
        <div className="absolute top-20 right-3 bg-white rounded-xl p-2 shadow-lg z-10 min-w-[88px]">
          {/* 내 동선 색상 범례 */}
          <p className="text-xs font-bold text-gray-500 mb-1">내 동선</p>
          {[
            { color: "#4CAF50", label: "이번 주 (0~6일)" },
            { color: "#2196F3", label: "1주 전 (7~13일)" },
            { color: "#FF9800", label: "2주 전 (14~20일)" },
            { color: "#9C27B0", label: "3주+ (21일~)" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5 mb-0.5">
              <div className="w-4 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-gray-600">{item.label}</span>
            </div>
          ))}

          {/* 토글 버튼 그룹 */}
          <div className="border-t mt-1.5 pt-1.5 flex flex-col gap-1">

            {/* 내 지난 경로 토글 */}
            <button
              onClick={() => setShowPastRoutes((v) => !v)}
              className={`flex items-center gap-1.5 text-xs font-medium w-full rounded-lg px-1 py-0.5 transition-colors
                ${showPastRoutes ? "text-green-600 bg-green-50" : "text-gray-300 bg-gray-50"}`}
            >
              <div
                className="w-4 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: showPastRoutes ? "#4CAF50" : "#D1D5DB" }}
              />
              <span>{showPastRoutes ? "내경로 ON" : "내경로 OFF"}</span>
            </button>

            {/* 타인 경로 토글 */}
            <button
              onClick={() => setShowNearby((v) => !v)}
              className={`flex items-center gap-1.5 text-xs font-medium w-full rounded-lg px-1 py-0.5 transition-colors
                ${showNearby ? "text-slate-600 bg-slate-50" : "text-gray-300 bg-gray-50"}`}
            >
              <div
                className="w-4 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: showNearby ? "#94A3B8" : "#D1D5DB" }}
              />
              <span>{showNearby ? "타인경로 ON" : "타인경로 OFF"}</span>
            </button>

          </div>
        </div>
      )}

      {/* ── 하단 버튼 ────────────────────────────────────── */}
      <div className="absolute bottom-24 left-0 right-0 flex justify-center z-10">
        {!isTracking ? (
          <button onClick={() => setShowReadyCheck(true)}
            className="bg-green-500 text-white px-10 py-4 rounded-full text-lg font-bold shadow-xl active:scale-95 transition-transform">
            🚶 플로깅 시작
          </button>
        ) : (
          <button onClick={handleStop}
            className="bg-red-500 text-white px-10 py-4 rounded-full text-lg font-bold shadow-xl active:scale-95 transition-transform">
            🏁 플로깅 종료
          </button>
        )}
      </div>

      {/* ── 모달들 ──────────────────────────────────────── */}
      {showTimeRestriction && (
        <TimeRestrictionModal onClose={() => setShowTimeRestriction(false)} />
      )}

      {showReadyCheck && (
        <ReadyCheckModal
          onStart={() => { setShowReadyCheck(false); handleStart(); }}
          onCancel={() => setShowReadyCheck(false)}
        />
      )}

      {showDuplicateWarning && (
        <DuplicateWarningModal
          message={duplicateMsg}
          onContinue={() => {
            setShowDuplicateWarning(false);
            noPointsOverride.current = true;
            startTracking();
          }}
          onCancel={() => setShowDuplicateWarning(false)}
        />
      )}

      {speedViolationStop && (
        <SpeedViolationModal onClose={() => { setSpeedViolationStop(false); fetchPastRoutes(); }} />
      )}

      {showValidationFail && (
        <ValidationFailModal
          errors={validationErrors}
          onRetry={handleRetryPlogging}
          onForceStop={handleForceStop}
        />
      )}

      {showPhotoModal && (
        <PhotoRequiredModal
          onConfirm={handlePhotoConfirm}
          onSkip={handlePhotoSkip}
          uploading={uploading}
        />
      )}

      {/* ── B. 제휴 상점 팝업 (플로깅 중에도 표시) ──────── */}
      {selectedPartner && (
        <PartnerDetailSheet
          partner={selectedPartner}
          onClose={() => setSelectedPartner(null)}
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
                {result.total > 0 ? "획득 포인트" : "조건 미충족"}
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
              <button onClick={() => setResult(null)}
                className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-bold">닫기</button>
              <button onClick={() => router.push("/history")}
                className="flex-1 bg-green-500 text-white py-3 rounded-xl font-bold">기록 보기 →</button>
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