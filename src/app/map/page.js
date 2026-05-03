"use client";

import { notifyPloggingComplete } from "@/lib/notify";
import Link from "next/link";
import { MapPin as MapPinIcon, Timer, Gauge, Radio, CheckCircle, Square, Sun, Footprints as FootprintsIcon, AlertTriangle as AlertTriangleIcon, Flag as FlagIcon, Users as UsersIcon, Smartphone as SmartphoneIcon, Coffee, Leaf, X as XIcon, Navigation, Phone } from "lucide-react";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useKakaoLoader } from "react-kakao-maps-sdk";
import MapView from "@/components/MapView";
import { useLocation } from "@/hooks/useLocation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  doc, collection, addDoc, updateDoc, setDoc, getDoc,
  increment, serverTimestamp, query,
  where, getDocs, deleteDoc, limit,
} from "firebase/firestore";
import { calculatePoints, TRASH_CATEGORIES, TUMBLER_BONUS } from "@/lib/pointCalc";
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

import { uploadToCloudinary } from "@/lib/cloudinary";

// ─── 플로깅 가능 시간 상수 ────────────────────────────────
const PLOGGING_START_HOUR = 6;  // 오전 6시
const PLOGGING_END_HOUR   = 22; // 오후 10시

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
          오전 6:00 ~ 오후 10:00
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

// ─── EXIF 타임스탬프 파서 (라이브러리 없이 직접 구현) ────
async function readExifTimestamp(file) {
  try {
    const buf = await file.arrayBuffer();
    const view = new DataView(buf);
    // JPEG 시그니처 확인
    if (view.getUint16(0) !== 0xFFD8) return null;

    let offset = 2;
    while (offset < view.byteLength - 4) {
      const marker = view.getUint16(offset);
      if (marker === 0xFFE1) {
        // APP1 마커 (EXIF)
        const segLen = view.getUint16(offset + 2);
        const exifHeader = String.fromCharCode(
          view.getUint8(offset + 4), view.getUint8(offset + 5),
          view.getUint8(offset + 6), view.getUint8(offset + 7)
        );
        if (exifHeader === "Exif") {
          const tiffStart = offset + 10;
          const byteOrder = view.getUint16(tiffStart);
          const le = byteOrder === 0x4949;
          const readU16 = (o) => le ? view.getUint16(tiffStart + o, true) : view.getUint16(tiffStart + o, false);
          const readU32 = (o) => le ? view.getUint32(tiffStart + o, true) : view.getUint32(tiffStart + o, false);

          const ifdOffset = readU32(4);
          const entryCount = readU16(ifdOffset);

          for (let i = 0; i < entryCount; i++) {
            const entryOffset = ifdOffset + 2 + i * 12;
            const tag = readU16(entryOffset);
            // 0x9003 = DateTimeOriginal, 0x9004 = DateTimeDigitized, 0x0132 = DateTime
            if (tag === 0x9003 || tag === 0x9004 || tag === 0x0132) {
              const valOffset = readU32(entryOffset + 8);
              let str = "";
              for (let c = 0; c < 19; c++) {
                const ch = view.getUint8(tiffStart + valOffset + c);
                if (ch === 0) break;
                str += String.fromCharCode(ch);
              }
              // 포맷: "YYYY:MM:DD HH:MM:SS"
              if (/^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/.test(str)) {
                const [datePart, timePart] = str.split(" ");
                const [y, mo, d] = datePart.split(":");
                const iso = `${y}-${mo}-${d}T${timePart}`;
                return new Date(iso);
              }
            }
          }
        }
        offset += 2 + segLen;
      } else if ((marker & 0xFF00) === 0xFF00) {
        offset += 2 + view.getUint16(offset + 2);
      } else {
        break;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ─── AI 쓰레기봉투 검증 API 호출 ──────────────────────────
async function verifyPhotoWithAI(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64 = e.target.result.split(",")[1];
        const mimeType = file.type || "image/jpeg";
        const res = await fetch("/api/verify-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mimeType }),
        });
        const data = await res.json();
        resolve(data);
      } catch {
        // 네트워크 오류 등 → 통과 처리
        resolve({ valid: true, confidence: "low", reason: "검증 네트워크 오류", skipped: true });
      }
    };
    reader.readAsDataURL(file);
  });
}

// ─── 사진 인증 필수 모달 (AI 검증 포함) ──────────────────
function PhotoRequiredModal({ onConfirm, onSkip, uploading, aiEnabled = true }) {
  const [file, setFile]         = useState(null);
  const [preview, setPreview]   = useState(null);
  const [step, setStep]         = useState("capture"); // capture | verifying | result
  const [verifyResult, setVerifyResult] = useState(null); // {valid, confidence, reason, exifFail}
  const inputRef                = useRef(null);

  // 분리수거 카테고리 상태
  const [trashCounts, setTrashCounts] = useState({
    pet: 0, can: 0, bottle: 0, paper: 0, vinyl: 0, general: 0,
  });


  const updateTrashCount = (id, delta) => {
    setTrashCounts(prev => ({
      ...prev,
      [id]: Math.max(0, Math.min(99, (prev[id] || 0) + delta)),
    }));
  };

  const getSelectedTrash = () => {
    return Object.entries(trashCounts)
      .filter(([, count]) => count > 0)
      .map(([id, count]) => ({ id, count }));
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;

    // ── 갤러리 사진 차단: 파일 수정 시간이 10분 초과 시 거부 ──────
    const ageMin = (Date.now() - f.lastModified) / 60000;
    if (ageMin > 10) {
      e.target.value = "";
      alert(
        `📷 방금 찍은 사진만 인증이 가능합니다.\n\n갤러리에 저장된 사진은 사용할 수 없어요.\n카메라를 열어 지금 바로 촬영해주세요!`
      );
      return;
    }

    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setStep("capture");
    setVerifyResult(null);
  };

  const handleVerify = async () => {
    if (!file) return;
    setStep("verifying");

    try {
      // 1. EXIF 시간 신선도 체크 (30분 이내) — AI ON/OFF 무관하게 항상 실행
      const exifDate = await readExifTimestamp(file);
      if (exifDate) {
        const diffMin = (Date.now() - exifDate.getTime()) / 60000;
        if (diffMin > 30) {
          setVerifyResult({
            valid: false,
            confidence: "high",
            reason: `사진이 ${Math.round(diffMin)}분 전에 촬영됐어요. 방금 찍은 사진(30분 이내)이어야 해요.`,
            exifFail: true,
          });
          setStep("result");
          return;
        }
      }

      // 2. AI 쓰레기봉투 인식 (관리자 설정으로 ON/OFF)
      if (aiEnabled) {
        const aiResult = await verifyPhotoWithAI(file);
        setVerifyResult(aiResult);
      } else {
        // AI 검증 OFF → 바로 통과
        setVerifyResult({
          valid: true,
          confidence: "low",
          reason: "AI 검증이 비활성화되어 있습니다. 사진이 정상 등록됩니다.",
          skipped: true,
        });
      }
      setStep("result");
    } catch {
      // 예외 시 통과
      setVerifyResult({ valid: true, confidence: "low", reason: "검증 중 오류 발생", skipped: true });
      setStep("result");
    }
  };

  const handleRetake = () => {
    setFile(null);
    setPreview(null);
    setStep("capture");
    setVerifyResult(null);
    setTimeout(() => inputRef.current?.click(), 100);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-[200]">
      <div className="bg-white rounded-t-3xl w-full shadow-2xl overflow-hidden" style={{ maxHeight: "85vh" }}>
        {/* 핸들 */}
        <div className="pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="px-5 pt-2 pb-6 overflow-y-auto" style={{ maxHeight: "calc(85vh - 2rem)", paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 16px))" }}>

          {/* ── STEP 1: 촬영 ── */}
          {step === "capture" && (
            <>
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">📸</div>
                <h2 className="text-lg font-black text-gray-800">수거 사진 인증</h2>
                <p className="text-gray-500 text-sm mt-1">
                  쓰레기 봉투가 보이도록 촬영해주세요<br />
                  <span className="text-xs text-gray-400">봉투를 들고 찍어도 OK · AI가 자동 확인합니다</span>
                </p>
                <div className="mt-2 inline-flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-full px-3 py-1">
                  <span className="text-xs">📷</span>
                  <span className="text-xs font-bold text-orange-600">카메라 직접 촬영만 가능 · 갤러리 사용 불가</span>
                </div>
              </div>

              {preview ? (
                <div className="relative mb-4">
                  <img src={preview} alt="인증 사진" className="w-full h-52 object-cover rounded-2xl" />
                  <button onClick={() => { setFile(null); setPreview(null); }}
                    className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                    ✕
                  </button>
                  {/* EXIF 없음 안내 */}
                  <div className="absolute bottom-2 left-2 right-2 bg-black/40 rounded-xl px-3 py-1.5 text-center">
                    <p className="text-white text-xs">📍 사진 선택됨 · AI 검증 버튼을 눌러주세요</p>
                  </div>
                </div>
              ) : (
                <button onClick={() => inputRef.current?.click()}
                  className="w-full h-40 border-2 border-dashed border-green-300 rounded-2xl flex flex-col items-center justify-center gap-2 mb-4 active:bg-green-50 bg-green-50/30">
                  <span className="text-4xl">🗑️</span>
                  <span className="text-sm text-green-600 font-bold">카메라로 찍기</span>
                  <span className="text-xs text-gray-400">방금 수거한 쓰레기 봉투를 촬영해주세요</span>
                </button>
              )}

              <input ref={inputRef} type="file" accept="image/*" capture="environment"
                onChange={handleFileChange} className="hidden" />

              <div className="space-y-2">
                <button onClick={handleVerify} disabled={!file}
                  className={`w-full py-4 rounded-2xl font-black text-base transition-all
                    ${file ? "bg-gradient-to-r from-green-500 to-teal-500 text-white shadow-md active:scale-95" : "bg-gray-100 text-gray-300 cursor-not-allowed"}`}>
                  {aiEnabled ? "🔍 AI 사진 검증하기" : "✅ 사진 확인하기"}
                </button>
                <button onClick={onSkip}
                  className="w-full py-3 rounded-2xl text-gray-400 text-sm font-medium bg-gray-50 active:bg-gray-100">
                  건너뛰기 (포인트 지급 안 됨)
                </button>
              </div>
            </>
          )}

          {/* ── STEP 2: 검증 중 ── */}
          {step === "verifying" && (
            <div className="py-8 text-center">
              <div className="text-5xl mb-4 animate-bounce">🤖</div>
              <h2 className="text-lg font-black text-gray-800 mb-2">AI 사진 분석 중...</h2>
              <p className="text-gray-400 text-sm mb-1">쓰레기 봉투 여부를 확인하고 있어요</p>
              <p className="text-gray-300 text-xs">잠시만 기다려주세요</p>
              <div className="flex justify-center gap-1.5 mt-6">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}

          {/* ── STEP 3: 결과 ── */}
          {step === "result" && verifyResult && (() => {
            const isConfigError  = !!verifyResult.configError;
            const isServerError  = !!verifyResult.serverError;
            const isExifFail     = !!verifyResult.exifFail;
            const isSystemIssue  = isConfigError || isServerError;

            return (
              <>
                {/* 결과 카드 */}
                <div className={`rounded-2xl p-5 mb-4 text-center ${
                  verifyResult.valid
                    ? "bg-green-50 border border-green-200"
                    : isSystemIssue
                      ? "bg-orange-50 border border-orange-200"
                      : "bg-red-50 border border-red-200"
                }`}>
                  <div className="text-4xl mb-2">
                    {verifyResult.valid ? "✅" : isConfigError ? "⚙️" : isServerError ? "🔧" : isExifFail ? "🕐" : "❌"}
                  </div>
                  <h2 className={`text-lg font-black mb-1 ${
                    verifyResult.valid ? "text-green-700"
                      : isSystemIssue ? "text-orange-600"
                      : "text-red-600"
                  }`}>
                    {verifyResult.valid
                      ? "인증 통과! 🎉"
                      : isConfigError ? "AI 검증 미설정"
                      : isServerError ? "AI 서버 오류"
                      : isExifFail    ? "사진 시간 오류"
                      : "인증 실패"}
                  </h2>
                  <p className={`text-sm leading-relaxed ${
                    verifyResult.valid ? "text-green-600"
                      : isSystemIssue ? "text-orange-500"
                      : "text-red-500"
                  }`}>
                    {verifyResult.reason}
                  </p>
                  {verifyResult.confidence && !isSystemIssue && (
                    <div className={`mt-2 inline-block px-3 py-0.5 rounded-full text-xs font-bold
                      ${verifyResult.confidence === "high" ? "bg-green-200 text-green-800"
                        : verifyResult.confidence === "medium" ? "bg-yellow-100 text-yellow-700"
                        : "bg-gray-100 text-gray-500"}`}>
                      신뢰도: {verifyResult.confidence === "high" ? "높음" : verifyResult.confidence === "medium" ? "보통" : "낮음"}
                    </div>
                  )}
                </div>

                {preview && !isSystemIssue && (
                  <div className="mb-4 relative">
                    <img src={preview} alt="인증 사진" className="w-full h-36 object-cover rounded-2xl opacity-80" />
                  </div>
                )}

                {/* ── 분리수거 카테고리 선택 (인증 통과 시) ── */}
                {verifyResult.valid && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base">♻️</span>
                      <h3 className="text-sm font-black text-gray-700">수거한 쓰레기 분류</h3>
                      <span className="text-xs text-gray-400">(선택사항)</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {TRASH_CATEGORIES.map(cat => {
                        const count = trashCounts[cat.id] || 0;
                        const active = count > 0;
                        return (
                          <div key={cat.id}
                            className={`rounded-xl border-2 p-2 text-center transition-all ${
                              active ? cat.color + " border-current" : "bg-gray-50 text-gray-400 border-gray-200"
                            }`}>
                            <div className="text-lg leading-none mb-1">{cat.icon}</div>
                            <div className={`text-xs font-bold mb-1.5 ${active ? "" : "text-gray-500"}`}>{cat.label}</div>
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => updateTrashCount(cat.id, -1)}
                                className="w-6 h-6 rounded-full bg-white border border-gray-300 text-gray-500 text-sm font-bold flex items-center justify-center active:bg-gray-100">−</button>
                              <span className={`w-6 text-center text-sm font-black ${active ? "text-gray-800" : "text-gray-400"}`}>{count}</span>
                              <button onClick={() => updateTrashCount(cat.id, 1)}
                                className="w-6 h-6 rounded-full bg-white border border-gray-300 text-gray-500 text-sm font-bold flex items-center justify-center active:bg-gray-100">+</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {getSelectedTrash().filter(c => c.id !== "general").length > 0 && (
                      <div className="mt-2 text-center">
                        <span className="inline-flex items-center gap-1 bg-green-50 border border-green-200 rounded-full px-3 py-1 text-xs font-bold text-green-600">
                          ♻️ 분리수거 보너스 +{getSelectedTrash().filter(c => c.id !== "general").reduce((s, c) => s + c.count, 0) * 5}P
                        </span>
                      </div>
                    )}
                  </div>
                )}


                <div className="space-y-2">
                  {/* 통과: 포인트 받기 */}
                  {verifyResult.valid && (
                    <button onClick={() => onConfirm(file, getSelectedTrash())} disabled={uploading}
                      className={`w-full py-4 rounded-2xl font-black text-base transition-all
                        ${uploading ? "bg-gray-100 text-gray-400" : "bg-gradient-to-r from-green-500 to-teal-500 text-white shadow-md active:scale-95"}`}>
                      {uploading ? "저장 중... ⏳" : "✅ 완료! 포인트 받기"}
                    </button>
                  )}

                  {/* 실패 (일반): 다시 촬영 / 같은 사진 재검증 */}
                  {!verifyResult.valid && !isSystemIssue && !isExifFail && (
                    <>
                      <button onClick={handleVerify}
                        className="w-full py-4 rounded-2xl font-black text-base bg-gradient-to-r from-blue-400 to-blue-600 text-white shadow-md active:scale-95">
                        🔄 같은 사진으로 다시 검증
                      </button>
                      <button onClick={handleRetake}
                        className="w-full py-3 rounded-2xl font-bold text-base border-2 border-orange-300 text-orange-500 bg-white active:bg-orange-50">
                        📷 다른 사진 찍기
                      </button>
                    </>
                  )}
                  {/* EXIF 실패: 새로 촬영만 허용 */}
                  {!verifyResult.valid && isExifFail && (
                    <button onClick={handleRetake}
                      className="w-full py-4 rounded-2xl font-black text-base bg-gradient-to-r from-orange-400 to-red-400 text-white shadow-md active:scale-95">
                      📷 지금 새로 촬영하기
                    </button>
                  )}

                  {/* 서버 오류: 재시도 */}
                  {isServerError && (
                    <button onClick={handleVerify}
                      className="w-full py-4 rounded-2xl font-black text-base bg-gradient-to-r from-blue-400 to-blue-500 text-white shadow-md active:scale-95">
                      🔄 다시 시도하기
                    </button>
                  )}

                  {/* 설정 오류: 안내만 */}
                  {isConfigError && (
                    <div className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 text-center">
                      <p className="text-xs text-orange-600 font-medium">관리자 페이지 → 유지관리 → AI 사진 검증 OFF로 설정하거나 API 키를 추가해주세요</p>
                    </div>
                  )}

                  {/* 공통: 포인트 없이 종료 */}
                  <button onClick={onSkip} disabled={uploading}
                    className="w-full py-3 rounded-2xl text-gray-400 text-sm font-medium bg-gray-50 active:bg-gray-100">
                    {verifyResult.valid ? "건너뛰기 (포인트 없음)" : "포인트 없이 종료하기"}
                  </button>
                </div>
              </>
            );
          })()}

        </div>
      </div>
    </div>
  );
}

// ─── 텀블러/다회용컵 인증 모달 ──────────────────────────────
function TumblerCertModal({ onConfirm, onClose, isPlogging }) {
  const [step, setStep]                   = useState("guide"); // guide | cert
  const [cafeName, setCafeName]           = useState("");
  const [tumblerPhoto, setTumblerPhoto]   = useState(null);
  const [tumblerPreview, setTumblerPreview] = useState(null);
  const [receiptPhoto, setReceiptPhoto]   = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [uploading, setUploading]         = useState(false);
  const tumblerRef = useRef(null);
  const receiptRef = useRef(null);

  const handleFileSelect = (e, setFile, setPreview, allowGallery = false) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const ageMin = (Date.now() - f.lastModified) / 60000;
    if (!allowGallery) {
      // 텀블러 사진: 10분 이내 직접 촬영만
      if (ageMin > 10) {
        e.target.value = "";
        alert("방금 찍은 사진만 인증이 가능합니다.\n갤러리 사진은 사용할 수 없어요.");
        return;
      }
    } else {
      // 주문내역 캡처: 2시간(120분) 이내 스크린샷만
      if (ageMin > 120) {
        e.target.value = "";
        alert("2시간 이내의 주문내역만 인증 가능합니다.\n최근 스크린샷을 선택해주세요.");
        return;
      }
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async () => {
    if (!tumblerPhoto) { alert("텀블러 사진을 촬영해주세요"); return; }
    if (!cafeName.trim()) { alert("카페명을 입력해주세요"); return; }
    setUploading(true);
    try {
      const photoUrl = await uploadToCloudinary(tumblerPhoto);
      let receiptUrl = null;
      if (receiptPhoto) {
        try { receiptUrl = await uploadToCloudinary(receiptPhoto); }
        catch { /* 영수증 업로드 실패해도 진행 */ }
      }
      onConfirm({
        cafeName: cafeName.trim(),
        photoUrl,
        receiptUrl,
        certifiedAt: new Date().toISOString(),
      });
    } catch (e) { alert("사진 업로드 실패: " + e.message); }
    finally { setUploading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-[210]">
      <div className="bg-white rounded-t-3xl w-full shadow-2xl overflow-hidden" style={{ maxHeight: "85vh" }}>
        <div className="pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
        <div className="px-5 pt-2 pb-6 overflow-y-auto" style={{ maxHeight: "calc(85vh - 2rem)", paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 16px))" }}>

          {/* ══ STEP 1: 안내 가이드 ══ */}
          {step === "guide" && (
            <>
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">☕</div>
                <h2 className="text-lg font-black text-gray-800">텀블러/다회용컵 인증</h2>
                <p className="text-gray-500 text-sm mt-1">
                  텀블러 사용을 인증하고 포인트를 받아보세요!
                </p>
                {isPlogging && (
                  <div className="mt-2 inline-flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-3 py-1">
                    <span className="text-xs">🏃</span>
                    <span className="text-xs font-bold text-green-600">플로깅 진행 중 · 인증 후 계속됩니다</span>
                  </div>
                )}
              </div>

              {/* 인증 방법 안내 카드 */}
              <div className="space-y-2.5 mb-4">
                {/* 키오스크 주문 */}
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3.5">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl mt-0.5">🖥️</span>
                    <div className="flex-1">
                      <h3 className="text-sm font-black text-blue-800 mb-1.5">키오스크로 주문한 경우</h3>
                      <div className="space-y-1.5 text-xs text-blue-700 leading-relaxed">
                        <div className="flex items-start gap-1.5">
                          <span className="font-black text-blue-400 mt-px">1</span>
                          <span>키오스크 <span className="font-bold">주문 완료 화면을 먼저 촬영</span>해주세요</span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <span className="font-black text-blue-400 mt-px">2</span>
                          <span>음료를 받은 후 <span className="font-bold">텀블러 사진을 촬영</span>해주세요</span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <span className="font-black text-blue-400 mt-px">3</span>
                          <span>주문내역은 <span className="font-bold">갤러리에서 아까 찍은 사진을 선택</span>하면 돼요</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 앱 주문 */}
                <div className="bg-green-50 border border-green-200 rounded-2xl p-3.5">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl mt-0.5">📱</span>
                    <div className="flex-1">
                      <h3 className="text-sm font-black text-green-800 mb-1.5">카페 앱으로 주문한 경우</h3>
                      <div className="space-y-1.5 text-xs text-green-700 leading-relaxed">
                        <div className="flex items-start gap-1.5">
                          <span className="font-black text-green-400 mt-px">1</span>
                          <span>카페 앱에서 <span className="font-bold">주문내역 화면을 스크린샷</span> 찍어두세요</span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <span className="font-black text-green-400 mt-px">2</span>
                          <span>음료를 받은 후 <span className="font-bold">텀블러 사진을 촬영</span>해주세요</span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <span className="font-black text-green-400 mt-px">3</span>
                          <span>주문내역은 <span className="font-bold">갤러리에서 스크린샷을 선택</span>하면 돼요</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 보너스 안내 */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-4 text-center">
                <span className="text-xs font-bold text-amber-700">
                  ☕ 텀블러 사용 인증 시 <span className="text-amber-500">+30 포인트</span> 적립!
                </span>
                <p className="text-xs text-amber-500 mt-1">탄소중립포인트 녹색생활 실천 연계 항목</p>
              </div>

              {/* 버튼 */}
              <div className="space-y-2">
                <button onClick={() => setStep("cert")}
                  className="w-full py-4 rounded-2xl font-black text-base bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md active:scale-95 transition-all">
                  인증 시작하기
                </button>
                <button onClick={onClose}
                  className="w-full py-3 rounded-2xl text-gray-400 text-sm font-medium bg-gray-50 active:bg-gray-100">
                  취소
                </button>
              </div>
            </>
          )}

          {/* ══ STEP 2: 인증 입력 ══ */}
          {step === "cert" && (
            <>
              <div className="text-center mb-4">
                <h2 className="text-lg font-black text-gray-800">텀블러 인증하기</h2>
                <p className="text-gray-400 text-xs mt-1">텀블러 사진(필수)과 주문내역(선택)을 올려주세요</p>
              </div>

              {/* ── 2장 사진 나란히 ── */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                {/* 텀블러 사진 (필수) */}
                <div>
                  <label className="text-xs font-bold text-amber-700 mb-1 block">텀블러 사진 <span className="text-red-400">*</span></label>
                  {tumblerPreview ? (
                    <div className="relative">
                      <img src={tumblerPreview} alt="텀블러" className="w-full h-32 object-cover rounded-xl" />
                      <button onClick={() => { setTumblerPhoto(null); setTumblerPreview(null); }}
                        className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">✕</button>
                    </div>
                  ) : (
                    <button onClick={() => tumblerRef.current?.click()}
                      className="w-full h-32 border-2 border-dashed border-amber-300 rounded-xl flex flex-col items-center justify-center gap-1 active:bg-amber-50 bg-amber-50/30">
                      <span className="text-2xl">🥤</span>
                      <span className="text-xs text-amber-600 font-bold">텀블러 촬영</span>
                      <span className="text-xs text-gray-400">음료가 담긴 모습</span>
                    </button>
                  )}
                  <input ref={tumblerRef} type="file" accept="image/*" capture="environment"
                    onChange={(e) => handleFileSelect(e, setTumblerPhoto, setTumblerPreview)} className="hidden" />
                </div>

                {/* 주문내역 (선택) */}
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">주문내역 <span className="text-gray-400 font-normal">(선택)</span></label>
                  {receiptPreview ? (
                    <div className="relative">
                      <img src={receiptPreview} alt="주문내역" className="w-full h-32 object-cover rounded-xl" />
                      <button onClick={() => { setReceiptPhoto(null); setReceiptPreview(null); }}
                        className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">✕</button>
                    </div>
                  ) : (
                    <button onClick={() => receiptRef.current?.click()}
                      className="w-full h-32 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1 active:bg-gray-50 bg-gray-50/30">
                      <span className="text-2xl">📱</span>
                      <span className="text-xs text-gray-500 font-bold">주문내역 인증</span>
                      <span className="text-xs text-gray-400">캡처 또는 화면촬영</span>
                    </button>
                  )}
                  <input ref={receiptRef} type="file" accept="image/*"
                    onChange={(e) => handleFileSelect(e, setReceiptPhoto, setReceiptPreview, true)} className="hidden" />
                </div>
              </div>

              {/* 카페명 입력 */}
              <div className="mb-4">
                <label className="text-sm font-bold text-gray-700 mb-1.5 block">카페명 <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={cafeName}
                  onChange={(e) => setCafeName(e.target.value)}
                  placeholder="예) 스타벅스 강남점, 이디야 역삼점"
                  className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 text-sm bg-white focus:outline-none focus:border-amber-400 placeholder:text-gray-300"
                />
              </div>

              {/* 버튼 */}
              <div className="space-y-2">
                <button onClick={handleSubmit} disabled={uploading || !tumblerPhoto}
                  className={`w-full py-4 rounded-2xl font-black text-base transition-all
                    ${uploading ? "bg-gray-100 text-gray-400"
                      : tumblerPhoto ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md active:scale-95"
                      : "bg-gray-100 text-gray-300 cursor-not-allowed"}`}>
                  {uploading ? "인증 중... ⏳" : "☕ 텀블러 인증 완료"}
                </button>
                <button onClick={() => setStep("guide")}
                  className="w-full py-3 rounded-2xl text-gray-400 text-sm font-medium bg-gray-50 active:bg-gray-100">
                  이전으로
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── [컵반환·다회용기·무공해차·공유자전거·범용 모달은 /eco 페이지로 이동됨]
// ─── B. 제휴 상점 상세 팝업 ──────────────────────────────
const ECO_CAT_STYLE = {
  eco_store:   { label: "🌿 친환경매장",   bg: "bg-green-100",  text: "text-green-700",  headerBg: "from-green-400 to-emerald-500" },
  recycle_bin: { label: "♻️ 재활용수거기",  bg: "bg-blue-100",   text: "text-blue-700",   headerBg: "from-blue-400 to-cyan-500" },
  smart_bin:   { label: "🗑️ 스마트휴지통", bg: "bg-purple-100", text: "text-purple-700", headerBg: "from-purple-400 to-violet-500" },
};

function PartnerDetailSheet({ partner, onClose }) {
  const cat = ECO_CAT_STYLE[partner.category] || ECO_CAT_STYLE.eco_store;
  const distM = partner.distanceKm !== undefined
    ? partner.distanceKm < 1
      ? `${(partner.distanceKm * 1000).toFixed(0)}m`
      : `${partner.distanceKm.toFixed(1)}km`
    : null;

  return (
    <>
      {/* 반투명 딤 배경 — 탭바도 덮음 */}
      <div className="fixed inset-0 bg-black/40 z-[98]" onClick={onClose} />
      {/* 시트 본체 */}
      <div className="fixed inset-x-0 bottom-0 z-[99] p-3"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}>
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
        {/* 컬러 헤더 배너 (광고 영역) */}
        <div className={`bg-gradient-to-r ${cat.headerBg} p-4 text-white relative`}>
          <button onClick={onClose}
            className="absolute top-3 right-3 w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-white text-sm font-bold">
            ✕
          </button>
          <div className="flex items-center gap-3">
            <div className="text-4xl w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
              {partner.icon || cat.label.split(" ")[0]}
            </div>
            <div className="flex-1 min-w-0">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium bg-white/20 text-white mb-1 inline-block`}>
                {cat.label}
              </span>
              <h2 className="font-black text-white text-lg leading-tight">{partner.name}</h2>
              {partner.address && (
                <p className="text-xs text-white/80 mt-0.5 truncate">📍 {partner.address}</p>
              )}
            </div>
          </div>
          {distM && (
            <div className="mt-2 bg-white/20 rounded-xl px-3 py-1.5 inline-flex items-center gap-1.5">
              <span className="text-sm">📍</span>
              <span className="text-xs font-bold text-white">내 위치에서 약 {distM}</span>
            </div>
          )}
        </div>

        {/* 본문 */}
        <div className="p-4 space-y-3">
          {partner.desc && (
            <p className="text-sm text-gray-600 leading-relaxed">{partner.desc}</p>
          )}

          {partner.benefit && (
            <div className="bg-green-50 rounded-2xl p-3 flex items-start gap-2">
              <span className="text-xl">🎁</span>
              <div>
                <p className="text-xs text-gray-400 font-medium mb-0.5">플로거 특별 혜택</p>
                <p className="text-sm font-bold text-green-700">{partner.benefit}</p>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
              className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-2xl font-bold text-sm">
              닫기
            </button>
            {partner.contact && (
              <a href={partner.contact} target="_blank" rel="noopener noreferrer"
                className={`flex-1 bg-gradient-to-r ${cat.headerBg} text-white py-3 rounded-2xl font-bold text-sm text-center`}>
                바로가기 →
              </a>
            )}
          </div>
        </div>
      </div>
      </div>
    </>
  );
}

// ─── 메인 맵 페이지 ──────────────────────────────────────
function MapPageInner() {
  const [loading, error] = useKakaoLoader({
    appkey: process.env.NEXT_PUBLIC_KAKAO_MAP_KEY,
    libraries: ["services"],
  });

  const router       = useRouter();
  const searchParams = useSearchParams();
  const groupId      = searchParams.get("groupId");
  const groupSize    = parseInt(searchParams.get("groupSize") || "1");
  const groupType    = searchParams.get("groupType"); // "club" 이면 동아리 플로깅
  const ecoAction    = searchParams.get("eco"); // "tumbler" 등 녹색생활 진입
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

  // B. 파트너 마커 (에코스팟)
  const [allPartners,    setAllPartners]    = useState([]);   // 전체 목록 (필터 전)
  const [partnerMarkers, setPartnerMarkers] = useState([]);   // 지역 필터 후
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [mapUserPos,      setMapUserPos]    = useState(null); // GPS 위치 (거리 표시용)
  const [ecoUserRegion,   setEcoUserRegion] = useState(null); // 지역 필터용 시/도

  // C. 타인 최근 경로
  const [nearbyRoutes, setNearbyRoutes] = useState([]);
  const [showNearby, setShowNearby]         = useState(true); // 타인 경로 토글
  const [showPastRoutes, setShowPastRoutes] = useState(true); // 내 지난 경로 토글

  // D. 녹색매장 검색
  const [greenCategories, setGreenCategories]     = useState([]); // Firestore에서 로드
  const [activeGreenCats, setActiveGreenCats]     = useState([]); // 선택된 카테고리 ID
  const [greenStoreMarkers, setGreenStoreMarkers] = useState([]); // 카카오 검색 결과
  const [greenSearching, setGreenSearching]       = useState(false);
  const [selectedGreenStore, setSelectedGreenStore] = useState(null); // 선택된 녹색매장 정보
  const [greenBrandPanel, setGreenBrandPanel]     = useState(null); // 브랜드 선택 패널용 카테고리
  const [selectedBrand, setSelectedBrand]         = useState(null); // 현재 선택된 브랜드 키워드
  const [greenDrawerOpen, setGreenDrawerOpen]     = useState(false); // 녹색매장 드로어 열림 여부

  // 사진/검증
  const [speedViolationStop, setSpeedViolationStop] = useState(false);
  const [showValidationFail, setShowValidationFail] = useState(false);
  const [validationErrors, setValidationErrors]     = useState([]);
  const [showPhotoModal, setShowPhotoModal]         = useState(false);
  const [uploading, setUploading]                   = useState(false);
  const pendingDataRef = useRef(null);

  // ── 플로깅 종료 후 인증 대기 데이터 복원 ─────────────────────
  const PENDING_KEY = "pendingPloggingData";
  const PENDING_EXPIRY_MS = 60 * 60 * 1000; // 1시간

  // 페이지 마운트 시 pending 데이터가 있으면 복원
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      // 만료 체크
      if (Date.now() - saved.savedAt > PENDING_EXPIRY_MS) {
        localStorage.removeItem(PENDING_KEY);
        return;
      }
      // 유효한 데이터 → 복원 (언마운트 체크)
      if (!mountedRef.current) return;
      pendingDataRef.current = saved.data;
      if (Array.isArray(saved.tumblerCerts) && saved.tumblerCerts.length > 0) setSessionTumblerCerts(saved.tumblerCerts);
      setShowPhotoModal(true);
    } catch { /* 파싱 실패 → 무시 */ }
    return () => { mountedRef.current = false; };
  }, []);

  // ── 텀블러/다회용컵 인증 ──────────────────────────────────
  const [showTumblerModal, setShowTumblerModal]     = useState(false);
  const [sessionTumblerCerts, setSessionTumblerCerts] = useState([]); // 플로깅 중 텀블러 인증 기록
  const [sessionCupReturnCerts, setSessionCupReturnCerts] = useState([]); // 플로깅 중 컵 반환 인증 기록

  // 메인 퀵메뉴에서 텀블러 인증 진입 시 자동 오픈
  useEffect(() => {
    if (ecoAction === "tumbler" && user && !loading) {
      setShowTumblerModal(true);
    }
  }, [ecoAction, user, loading]);

  // ── 앱 설정 (Firestore settings/app) ────────────────────
  const [speedLimitEnabled,      setSpeedLimitEnabled]      = useState(true);
  const [aiVerificationEnabled,  setAiVerificationEnabled]  = useState(true);
  const [backgroundModeEnabled,  setBackgroundModeEnabled]  = useState(false);
  const [timeLimitEnabled,       setTimeLimitEnabled]       = useState(true);

  // ── 에코마일리지 연동 상태 ────────────────────────────────
  const [ecomileageLinked, setEcomileageLinked] = useState(false);

  useEffect(() => {
    getDoc(doc(db, "settings", "app"))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setSpeedLimitEnabled(data.speedLimitEnabled !== false);
          setAiVerificationEnabled(data.aiVerificationEnabled !== false);
          setBackgroundModeEnabled(data.backgroundModeEnabled === true);
          setTimeLimitEnabled(data.timeLimitEnabled !== false);
        }
      })
      .catch(() => {}); // 로드 실패 시 기본값 유지
  }, []);

  // 에코마일리지 연동 여부 로드
  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.uid))
      .then((snap) => {
        if (snap.exists()) {
          setEcomileageLinked(snap.data().ecomileageLinked === true);
        }
      })
      .catch(() => {});
  }, [user]);

  const handleSpeedViolation = useCallback(() => {
    setSpeedViolationStop(true);
  }, []);

  const {
    path, distance, isTracking, currentSpeed,
    isSpeedWarning, duration, stopCount,
    wakeLockActive, isBackground, bgNativeActive,
    gpsAccuracy, gpsReady,
    startTracking, stopTracking,
  } = useLocation({
    onSpeedViolation: speedLimitEnabled ? handleSpeedViolation : undefined,
    backgroundModeEnabled,
  });

  // ─── A. 하루 플로깅 횟수 체크 ────────────────────────
  const checkPloggingLimit = useCallback(async () => {
    if (!user) return null;
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      let todayCount = 0;
      try {
        // userId만으로 조회 후 클라이언트에서 날짜 필터 (인덱스 불필요)
        const q = query(
          collection(db, "routes"),
          where("userId", "==", user.uid)
        );
        const snap = await getDocs(q);
        snap.forEach(d => {
          const ca = d.data().createdAt;
          if (ca) {
            const docDate = ca.toDate ? ca.toDate() : new Date(ca);
            if (docDate >= todayStart) todayCount++;
          }
        });
      } catch {
        // 쿼리 실패 시 체크 건너뜀
        return null;
      }

      if (todayCount >= DAILY_MAX) {
        return `오늘 이미 ${todayCount}회 플로깅을 완료했어요.\n하루 최대 ${DAILY_MAX}회까지 포인트가 지급돼요.\n(추가 플로깅은 기록되지만 포인트 0)`;
      }
      return null;
    } catch (e) {
      console.error("횟수 체크 실패:", e);
      return null;
    }
  }, [user]);

  // ─── B. 에코스팟 조회 ────────────────────────────────
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
      setAllPartners(list);
    } catch (e) {
      console.error("에코스팟 조회 실패:", e);
    }
  }, []);

  // ─── D. 녹색매장 카테고리 로드 ──────────────────────────
  const fetchGreenCategories = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, "greenCategories"));
      const arr = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((c) => c.active !== false)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      setGreenCategories(arr);
    } catch (e) { console.error("녹색매장 카테고리 로드 실패:", e); }
  }, []);

  // ─── D. 카카오 Places 단일 키워드 검색 ──────────────────
  const searchGreenBrand = useCallback(async (keyword, cat) => {
    if (!mapUserPos || !keyword) {
      setGreenStoreMarkers([]);
      return;
    }
    setGreenSearching(true);
    try {
      const ps = new window.kakao.maps.services.Places();
      const results = [];

      await new Promise((resolve) => {
        ps.keywordSearch(keyword, (data, status) => {
          if (status === window.kakao.maps.services.Status.OK) {
            data.forEach((place) => {
              results.push({
                ...place,
                icon: cat.icon,
                color: cat.color,
                category_name: cat.name,
                categoryId: cat.id,
                brandKeyword: keyword,
              });
            });
          }
          resolve();
        }, {
          location: new window.kakao.maps.LatLng(mapUserPos.lat, mapUserPos.lng),
          radius: 3000,
          size: 15,
        });
      });

      setGreenStoreMarkers(results);
    } catch (e) {
      console.error("녹색매장 검색 실패:", e);
    } finally {
      setGreenSearching(false);
    }
  }, [mapUserPos]);

  // ─── D. 카테고리 칩 클릭 → 브랜드 선택 패널 열기 ──────
  const handleToggleGreenCat = useCallback((catId) => {
    const cat = greenCategories.find((c) => c.id === catId);
    if (!cat) return;

    // 이미 같은 카테고리가 열려있으면 닫기
    if (greenBrandPanel?.id === catId) {
      setGreenBrandPanel(null);
      setSelectedBrand(null);
      setActiveGreenCats([]);
      setGreenStoreMarkers([]);
      return;
    }

    // 브랜드 선택 패널 열기
    setGreenBrandPanel(cat);
    setSelectedBrand(null);
    setActiveGreenCats([catId]);
    setGreenStoreMarkers([]);
  }, [greenCategories, greenBrandPanel]);

  // ─── D. 브랜드 선택 → 해당 브랜드만 검색 ─────────────
  const handleSelectBrand = useCallback((keyword) => {
    if (!greenBrandPanel) return;

    if (selectedBrand === keyword) {
      // 같은 브랜드 다시 탭 → 해제
      setSelectedBrand(null);
      setGreenStoreMarkers([]);
      return;
    }

    setSelectedBrand(keyword);
    searchGreenBrand(keyword, greenBrandPanel);
  }, [greenBrandPanel, selectedBrand, searchGreenBrand]);

  // ─── GPS 위치 취득 (거리 표시용) + 지역 감지 ──────────
  useEffect(() => {
    // 1) sessionStorage 캐시 우선 사용 (홈페이지에서 이미 감지된 경우)
    try {
      const cached = sessionStorage.getItem("user_region");
      if (cached) setEcoUserRegion(cached);
    } catch {}

    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setMapUserPos({ lat, lng });

        // 캐시 없으면 Nominatim 역지오코딩으로 시/도 감지
        if (!sessionStorage.getItem("user_region")) {
          try {
            const KOREAN_REGIONS = [
              "서울특별시", "부산광역시", "대구광역시", "인천광역시",
              "광주광역시", "대전광역시", "울산광역시", "세종특별자치시",
              "경기도", "강원도", "충청북도", "충청남도",
              "전북특별자치도", "전라남도", "경상북도", "경상남도", "제주특별자치도",
            ];
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ko`,
              { headers: { "User-Agent": "plogging-app/1.0" }, signal: AbortSignal.timeout(5000) }
            );
            if (res.ok) {
              const data = await res.json();
              const raw = data.address?.state || data.address?.province || data.address?.city || "";
              const found = KOREAN_REGIONS.find((r) => raw.includes(r) || r.startsWith(raw.slice(0, 2)));
              if (found) {
                setEcoUserRegion(found);
                try { sessionStorage.setItem("user_region", found); } catch {}
              }
            }
          } catch {}
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 60000 }
    );
  }, []);

  // ─── 지역 기반 필터 (ecoUserRegion or allPartners 변경 시) ──
  useEffect(() => {
    if (allPartners.length === 0) { setPartnerMarkers([]); return; }

    const filtered = allPartners.filter((p) => {
      const r = p.region || "전국";
      return r === "전국" || !ecoUserRegion || r === ecoUserRegion;
    });

    // 거리 정보 첨부 (mapUserPos 있을 때만)
    const withDist = mapUserPos
      ? filtered.map((p) => ({ ...p, distanceKm: haversineKm(mapUserPos.lat, mapUserPos.lng, p.lat, p.lng) }))
              .sort((a, b) => a.distanceKm - b.distanceKm)
      : filtered;

    setPartnerMarkers(withDist);
  }, [ecoUserRegion, allPartners, mapUserPos]);

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
          const WEEK_COLORS = ["#4CAF50", "#FF9800", "#FF5722", "#B71C1C"];
          const createdMs   = data.createdAt?.toMillis?.() || Date.now();
          const daysAgo     = Math.floor((Date.now() - createdMs) / (1000 * 60 * 60 * 24));
          const weeksAgo    = Math.min(Math.floor(daysAgo / 7), 3); // 0~3
          const routeColor  = WEEK_COLORS[weeksAgo];

          routes.push({
            id: data.id, coords: data.coords,
            color: routeColor,
            weeksAgo,   // 최신순 렌더링 정렬용
            createdMs,  // 최신순 렌더링 정렬용
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
    fetchGreenCategories(); // D. 녹색매장 카테고리
  }, [user, loading, fetchPastRoutes, fetchNearbyRoutes, fetchPartnerMarkers, fetchGreenCategories]);

  // ─── Firestore 저장 ──────────────────────────────────
  const saveRoute = useCallback(async ({
    routePath, routeDistance, routeDuration, routeStopCount,
    points, photoUrl = null, trashCategories = [], tumblerInfo = null,
  }) => {
    const weekNumber = getWeekNumber();
    const expiresAt  = getExpiresAt();
    try {
      const routeData = {
        userId: user?.uid || "anonymous",
        coords: routePath, distance: routeDistance,
        points, duration: routeDuration, stopCount: routeStopCount,
        photoUrl, weekNumber, expiresAt,
        verified: !!photoUrl,
        createdAt: serverTimestamp(),
      };
      // 분리수거 데이터가 있으면 저장
      if (trashCategories && trashCategories.length > 0) {
        routeData.trashCategories = trashCategories;
      }
      // 텀블러/다회용컵 데이터가 있으면 저장
      if (tumblerInfo) {
        routeData.tumblerInfo = tumblerInfo;
      }
      const routeDoc = await addDoc(collection(db, "routes"), routeData);
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
      // ── 동아리 플로깅 기록 저장 ──────────────────────────
      if (groupId && groupType === "club" && user) {
        try {
          const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
          await addDoc(collection(db, "clubs", groupId, "history"), {
            uid:      user.uid,
            name:     user.displayName || user.email?.split("@")[0] || "멤버",
            photoURL: user.photoURL || "",
            distance: routeDistance,
            duration: routeDuration,
            points,
            verified: !!photoUrl,
            sessionDate: today,
            createdAt: serverTimestamp(),
          });
          await updateDoc(doc(db, "clubs", groupId), {
            totalPloggings: increment(1),
            totalDistance:  increment(routeDistance),
            totalDuration:  increment(routeDuration),
            status: "active", // 플로깅 종료 → 대기 상태로 복귀
          }).catch(() => {}); // 필드 없으면 무시
        } catch (e2) { console.error("클럽 기록 저장 실패:", e2); }
      }

      // ── 1회성 그룹 플로깅 종료 처리 ──────────────────────
      if (groupId && groupType !== "club") {
        try {
          await updateDoc(doc(db, "groups", groupId), { status: "finished" }).catch(() => {});
          // 그룹 종료 → localStorage 정리 (그룹 페이지 복귀 시 복원 방지)
          try { localStorage.removeItem("activeGroupCode"); } catch {}
        } catch (e3) { console.error("그룹 상태 업데이트 실패:", e3); }
      }

      notifyPloggingComplete(routeDistance, points);
      fetchPastRoutes();
    } catch (e) {
      console.error("저장 실패:", e);
      alert("저장 중 오류가 발생했습니다");
    }
  }, [user, fetchPastRoutes, groupId, groupType]);

  // ─── 시작 버튼 (시간 체크 → 중복 체크 포함) ──────────
  const handleStart = async () => {
    // 1. 시간 제한 체크 (오전 6시 ~ 오후 10시) — 관리자 OFF 시 무시
    if (timeLimitEnabled && !isWithinPloggingHours()) {
      setShowTimeRestriction(true);
      return;
    }
    if (noPointsOverride.current) {
      // 경고 확인 후 포인트 없이 시작
      noPointsOverride.current = false;
      setSessionTumblerCerts([]); // 텀블러 인증 초기화
      startTracking();
      return;
    }
    // 2. 중복 플로깅 체크 (실패해도 시작은 진행)
    try {
      const msg = await checkPloggingLimit();
      if (msg) {
        setDuplicateMsg(msg);
        setShowDuplicateWarning(true);
        return;
      }
    } catch (e) {
      console.error("중복 체크 실패, 무시하고 진행:", e);
    }
    setSessionTumblerCerts([]); // 텀블러 인증 초기화
    setSessionCupReturnCerts([]); // 컵 반환 인증 초기화
    startTracking();
  };

  // ─── 종료 버튼 ───────────────────────────────────────
  const stoppingRef = useRef(false); // 더블탭 방지
  const handleStop = async () => {
    if (stoppingRef.current) return; // 중복 클릭 방지
    stoppingRef.current = true;
    stopTracking();

    if (path.length < 2) {
      stoppingRef.current = false;
      return;
    }

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
      stoppingRef.current = false;
      return;
    }

    const { total, breakdown } = calculatePoints({ distanceKm: distance, groupSize: Math.max(1, groupSize || 1), ecomileageLinked });
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
      try {
        await saveRoute({ routePath: [...path], routeDistance: distance,
          routeDuration: duration, routeStopCount: stopCount,
          points: 0, photoUrl: null });
      } catch (e) { console.error("저장 실패:", e); }
      setResult({ distance, total: 0, breakdown: earnedBreakdown, verified: false });
      pendingDataRef.current = null;
      try { localStorage.removeItem(PENDING_KEY); } catch {}
      noPointsOverride.current = false; // 다음 세션을 위해 초기화
    } else {
      // localStorage에 인증 대기 데이터 저장 (페이지 이탈 대비)
      try {
        const toSave = { ...pendingDataRef.current };
        // 좌표 경량화: 소수점 5자리 (약 1m 정밀도)
        if (toSave.routePath) {
          toSave.routePath = toSave.routePath.map(p => ({
            lat: Math.round(p.lat * 1e5) / 1e5,
            lng: Math.round(p.lng * 1e5) / 1e5,
          }));
        }
        localStorage.setItem(PENDING_KEY, JSON.stringify({
          data: toSave,
          tumblerCerts: sessionTumblerCerts.length > 0 ? sessionTumblerCerts : null,
          groupId: groupId || null,
          groupType: groupType || null,
          savedAt: Date.now(),
        }));
      } catch {}
      setShowPhotoModal(true);
    }
    stoppingRef.current = false;
  };

  const handlePhotoConfirm = async (file, trashCategories = []) => {
    const p = pendingDataRef.current;
    if (!p) return;
    setUploading(true);
    try {
      const photoUrl = await uploadToCloudinary(file);

      // 보너스 포인트 재계산
      let finalPoints = p.total;
      let finalBreakdown = [...p.breakdown];

      // 분리수거 보너스
      if (trashCategories.length > 0) {
        const recycleItems = trashCategories.filter(c => c.id !== "general");
        const totalRecycleCount = recycleItems.reduce((sum, c) => sum + (c.count || 0), 0);
        if (totalRecycleCount > 0) {
          const recycleBonus = totalRecycleCount * 5;
          finalPoints += recycleBonus;
          finalBreakdown.push({ label: `분리수거 보너스 ♻️ (${totalRecycleCount}개)`, points: recycleBonus });
        }
      }

      // 플로깅 중 텀블러 인증이 있으면 보너스 추가
      if (sessionTumblerCerts.length > 0) {
        finalPoints += TUMBLER_BONUS * sessionTumblerCerts.length;
        finalBreakdown.push({ label: `텀블러 보너스 ☕ (${sessionTumblerCerts.length}회)`, points: TUMBLER_BONUS * sessionTumblerCerts.length });
      }

      await saveRoute({ ...p, points: finalPoints, photoUrl, trashCategories,
        tumblerInfo: sessionTumblerCerts.length > 0 ? sessionTumblerCerts : null });
      setShowPhotoModal(false);
      setResult({ distance: p.routeDistance, total: finalPoints, breakdown: finalBreakdown, verified: true });
    } catch (e) { alert("사진 업로드 실패: " + e.message); }
    finally {
      setUploading(false);
      pendingDataRef.current = null;
      try { localStorage.removeItem(PENDING_KEY); } catch {}
    }
  };

  const handlePhotoSkip = async () => {
    const p = pendingDataRef.current;
    if (!p) return;
    // 사진 미인증 → Firestore 저장 안 함 (DB 순수성 유지)
    setShowPhotoModal(false);
    setResult({ distance: p.routeDistance, total: 0,
      breakdown: [{ label: "사진 미인증 (포인트 미지급)", points: 0 }], verified: false });
    pendingDataRef.current = null;
    try { localStorage.removeItem(PENDING_KEY); } catch {}
  };

  // ─── 텀블러 인증 처리 (플로깅 중 / 독립) ──────────────
  const handleTumblerConfirm = async (certData) => {
    if (isTracking) {
      // 플로깅 중 → 세션에 기록, 종료 시 보너스 합산
      setSessionTumblerCerts(prev => [...prev, certData]);
      setShowTumblerModal(false);
      alert("☕ 텀블러 인증 완료! 플로깅을 계속하세요.\n종료 시 보너스 포인트가 합산됩니다.");
    } else {
      // 독립 인증 → ecoActions 컬렉션에 바로 저장 + 포인트 지급
      try {
        await addDoc(collection(db, "ecoActions"), {
          userId: user?.uid || "anonymous",
          type: "tumbler",
          cafeName: certData.cafeName,
          photoUrl: certData.photoUrl,
          receiptUrl: certData.receiptUrl || null,
          points: TUMBLER_BONUS,
          certifiedAt: certData.certifiedAt,
          createdAt: serverTimestamp(),
        });
        // 사용자 포인트 업데이트
        if (user) {
          const userRef = doc(db, "users", user.uid);
          await updateDoc(userRef, {
            totalPoints: increment(TUMBLER_BONUS),
          }).catch(() => {});
        }
        setShowTumblerModal(false);
        alert(`☕ 텀블러 인증 완료!\n+${TUMBLER_BONUS} 포인트가 적립되었습니다.`);
      } catch (e) {
        alert("저장 실패: " + e.message);
      }
    }
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
        greenStoreMarkers={greenStoreMarkers}
        onPartnerClick={(partner) => setSelectedPartner(partner)}
        onGreenStoreClick={(store) => setSelectedGreenStore(store)}
        isPlogging={isTracking}
      />

      {/* ── 상단 정보바 ─────────────────────────────────── */}
      <div className="absolute top-4 right-3 z-10" style={{ left: greenCategories.length > 0 ? 56 : 12 }}>
        <div className="bg-white rounded-2xl px-3 py-2 shadow-lg flex items-center gap-2 flex-wrap justify-center">
          <span className="text-sm font-bold text-green-700 flex items-center gap-1"><MapPinIcon className="w-3.5 h-3.5 inline" strokeWidth={2} /> {distance.toFixed(2)} km</span>
          {isTracking && (
            <>
              <span className="text-gray-300">|</span>
              <span className={`text-sm font-bold flex items-center gap-1 ${duration >= MIN_DURATION_SEC ? "text-green-500" : "text-gray-600"}`}>
                <Timer className="w-3.5 h-3.5 inline" strokeWidth={2} /> {formatDuration(duration)}
              </span>
              <span className="text-gray-300">|</span>
              <span className={`text-sm font-bold flex items-center gap-1 ${isSpeedWarning ? "text-red-500" : "text-blue-500"}`}>
                <Gauge className="w-3.5 h-3.5 inline" strokeWidth={2} /> {currentSpeed} km/h
              </span>
              {/* GPS 상태 표시 */}
              {!gpsReady ? (
                <span className="text-xs text-orange-500 animate-pulse basis-full text-center flex items-center justify-center gap-1">
                  <Radio className="w-3 h-3 inline" strokeWidth={2} /> GPS 신호 확인 중… {gpsAccuracy ? `(오차 ${gpsAccuracy}m)` : ""}
                </span>
              ) : (
                <span className="text-xs text-red-500 animate-pulse basis-full text-center">
                  ● 기록 중 {gpsAccuracy ? `· GPS ${gpsAccuracy}m` : ""}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── 인증 조건 진행 상황 ─────────────────────────── */}
      {isTracking && (
        <div className="absolute top-20 right-3 z-10" style={{ left: greenCategories.length > 0 ? 56 : 12 }}>
          <div className="bg-white/90 rounded-2xl px-3 py-2 shadow flex items-center justify-around text-xs">
            {[
              { label: "500m 이상", ok: distance >= MIN_DISTANCE_KM, val: `${(distance*1000).toFixed(0)}m` },
              { label: "10분 이상", ok: duration >= MIN_DURATION_SEC, val: formatDuration(duration) },
              { label: "3회 이상 줍기", ok: stopCount >= MIN_STOPS, val: `${stopCount}회` },
            ].map((item, i) => (
              <div key={i} className={`flex flex-col items-center ${item.ok ? "text-green-600" : "text-gray-400"}`}>
                <span>{item.ok ? <CheckCircle className="w-4 h-4 text-green-600" strokeWidth={2} /> : <Square className="w-4 h-4 text-gray-300" strokeWidth={1.5} />}</span>
                <span>{item.label}</span>
                <span className="font-bold">{item.val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 백그라운드 전환 경고 배너 (관리자 설정 ON 시만 표시) ── */}
      {backgroundModeEnabled && isBackground && isTracking && (
        <div className="absolute inset-0 bg-black/70 z-[60] flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-xs w-full">
            <SmartphoneIcon className="w-12 h-12 text-gray-700 mx-auto mb-3" strokeWidth={1.5} />
            {bgNativeActive ? (
              <>
                <h3 className="font-black text-gray-800 text-lg mb-2">백그라운드에서도 기록 중!</h3>
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                  화면을 꺼도 GPS 추적이 계속됩니다.<br />
                  플로깅이 끝나면 앱으로 돌아와 종료해주세요.
                </p>
                <p className="text-xs text-blue-500 font-medium bg-blue-50 rounded-xl px-3 py-2 flex items-center justify-center gap-1">
                  <Sun className="w-3.5 h-3.5 inline flex-shrink-0" strokeWidth={2} /> 백그라운드 GPS가 정상 작동 중이에요
                </p>
              </>
            ) : (
              <>
                <h3 className="font-black text-gray-800 text-lg mb-2">앱이 백그라운드로 전환됐어요</h3>
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                  다른 앱으로 전환되면 GPS 추적이 중단될 수 있어요.<br />
                  플로깅 중에는 이 앱을 화면에 띄워두세요.
                </p>
                <p className="text-xs text-orange-500 font-medium bg-orange-50 rounded-xl px-3 py-2 flex items-center justify-center gap-1">
                  <AlertTriangleIcon className="w-3.5 h-3.5 inline flex-shrink-0" strokeWidth={2} /> 화면을 끄고 주머니에 넣는 건 괜찮아요<br />(화면 꺼짐 방지 기능이 작동 중)
                </p>
              </>
            )}
          </div>
        </div>
      )}


      {/* ── 속도 경고 배너 ──────────────────────────────── */}
      {speedLimitEnabled && isSpeedWarning && isTracking && (
        <div className="absolute top-36 left-0 right-0 flex justify-center z-10 px-4">
          <div className="bg-red-500 text-white rounded-2xl px-5 py-3 shadow-xl flex items-center gap-2 animate-pulse">
            <AlertTriangleIcon className="w-6 h-6 text-white flex-shrink-0" strokeWidth={2} />
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
            <UsersIcon className="w-3.5 h-3.5 inline -mt-0.5" strokeWidth={2} /> 그룹 플로깅 중 · {groupSize}명 · +{groupSize * 5}P 보너스
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
            { color: "#FF9800", label: "1주 전 (7~13일)" },
            { color: "#FF5722", label: "2주 전 (14~20일)" },
            { color: "#B71C1C", label: "3주+ (21일~)" },
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

      {/* ── 녹색매장 슬라이드 드로어 ─────────────────────── */}
      {greenCategories.length > 0 && (
        <>
          {/* 배경 오버레이 (열렸을 때 지도 터치로 닫기) */}
          {greenDrawerOpen && (
            <div
              className="absolute inset-0 z-[14]"
              onClick={() => setGreenDrawerOpen(false)}
            />
          )}

          {/* 드로어 본체 */}
          <div
            className="absolute z-[15] transition-transform duration-300 ease-in-out"
            style={{
              top: 16,
              left: 0,
              transform: greenDrawerOpen ? "translateX(0)" : "translateX(-100%)",
            }}
          >
            <div className="bg-white/95 backdrop-blur-sm rounded-r-2xl shadow-lg border-r border-t border-b border-gray-200 px-3 py-3 flex flex-col gap-2" style={{ width: 150, maxHeight: "60vh", overflowY: "auto" }}>
              {/* 드로어 헤더 */}
              <div className="flex items-center justify-between pb-1.5 border-b border-gray-100">
                <span className="text-xs font-bold text-green-700 flex items-center gap-1">🌿 녹색매장</span>
                <button onClick={() => setGreenDrawerOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">‹</button>
              </div>

              {/* 카테고리 칩 */}
              <div className="flex flex-col gap-1.5">
                {greenCategories.map((cat) => {
                  const isActive = activeGreenCats.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => handleToggleGreenCat(cat.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap
                        ${isActive
                          ? "text-white shadow-md"
                          : "bg-gray-50 text-gray-600 border border-gray-200"
                        }`}
                      style={isActive ? { backgroundColor: cat.color } : {}}
                    >
                      <span className="text-sm">{cat.icon}</span>
                      {cat.name}
                      {isActive && !greenBrandPanel && greenSearching && <span className="animate-spin ml-1">⏳</span>}
                    </button>
                  );
                })}
              </div>

              {/* 브랜드 선택 */}
              {greenBrandPanel && greenBrandPanel.keywords && greenBrandPanel.keywords.length > 0 && (
                <div className="pt-1.5 border-t border-gray-100 flex flex-col gap-1">
                  <span className="text-xs text-gray-400 font-medium px-1">브랜드 선택</span>
                  {greenBrandPanel.keywords.map((keyword) => {
                    const isSel = selectedBrand === keyword;
                    return (
                      <button
                        key={keyword}
                        onClick={() => handleSelectBrand(keyword)}
                        className={`text-left px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap
                          ${isSel
                            ? "text-white shadow-md"
                            : "bg-gray-50 text-gray-600 border border-gray-200"
                          }`}
                        style={isSel ? { backgroundColor: greenBrandPanel.color } : {}}
                      >
                        {keyword}
                        {isSel && greenSearching && <span className="animate-spin ml-1">⏳</span>}
                        {isSel && !greenSearching && greenStoreMarkers.length > 0 && (
                          <span className="text-xs ml-1 opacity-80">{greenStoreMarkers.length}</span>
                        )}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => { setGreenBrandPanel(null); setSelectedBrand(null); setActiveGreenCats([]); setGreenStoreMarkers([]); }}
                    className="px-3 py-1 rounded-xl text-xs text-gray-400 bg-gray-50 border border-gray-200 mt-0.5"
                  >
                    초기화
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 탭 버튼 (닫혀있을 때 왼쪽 가장자리에 표시 — 상단 정보바와 높이 동일) */}
          {!greenDrawerOpen && (
            <button
              onClick={() => setGreenDrawerOpen(true)}
              className="absolute z-[15] bg-white/95 backdrop-blur-sm rounded-r-2xl shadow-lg border-r border-t border-b border-gray-200 px-2 flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform"
              style={{ top: 16, left: 0, height: isTracking ? 60 : 40 }}
            >
              <Leaf className="w-4 h-4 text-green-600" strokeWidth={2} />
              <span className="text-xs font-bold text-green-700 leading-none">녹색</span>
              {activeGreenCats.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-green-500 text-white flex items-center justify-center" style={{ fontSize: 9 }}>{activeGreenCats.length}</span>
              )}
            </button>
          )}
        </>
      )}

      {/* ── 녹색매장 상세 팝업 ─────────────────────────────── */}
      {selectedGreenStore && (
        <div className="absolute bottom-40 left-4 right-4 z-20">
          <div className="bg-white rounded-2xl p-4 shadow-2xl border border-gray-100">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                  style={{ backgroundColor: (selectedGreenStore.color || "#16A34A") + "20" }}>
                  {selectedGreenStore.icon || "🌿"}
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 text-sm">{selectedGreenStore.place_name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{selectedGreenStore.category_name}</p>
                </div>
              </div>
              <button onClick={() => setSelectedGreenStore(null)} className="text-gray-300 p-1">
                <XIcon className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>
            <div className="mt-2.5 space-y-1.5">
              {selectedGreenStore.road_address_name && (
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                  <MapPinIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" strokeWidth={2} />
                  {selectedGreenStore.road_address_name}
                </p>
              )}
              {!selectedGreenStore.road_address_name && selectedGreenStore.address_name && (
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                  <MapPinIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" strokeWidth={2} />
                  {selectedGreenStore.address_name}
                </p>
              )}
              {selectedGreenStore.phone && (
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" strokeWidth={2} />
                  {selectedGreenStore.phone}
                </p>
              )}
              {selectedGreenStore.distance && (
                <p className="text-xs text-green-600 font-medium mt-1">
                  현재 위치에서 약 {selectedGreenStore.distance}m
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 하단 버튼 ────────────────────────────────────── */}
      <div className="absolute bottom-32 left-0 right-0 flex flex-col items-center gap-2 z-10">
        {!isTracking ? (
          <>
            <p className="text-xs text-white bg-black/40 rounded-full px-3 py-1 flex items-center gap-1">
              <Sun className="w-3.5 h-3.5 inline" strokeWidth={2} /> 시작 시 화면 꺼짐이 자동으로 방지돼요
            </p>
            <div className="relative w-full flex justify-center">
              <button onClick={() => setShowReadyCheck(true)}
                className="text-white px-10 py-4 rounded-full text-lg font-bold shadow-xl active:scale-95 transition-transform flex items-center gap-2"
                style={{ backgroundColor: "#8dc63f" }}>
                <FootprintsIcon className="w-5 h-5" strokeWidth={2} /> 플로깅 시작
              </button>
              <button onClick={() => setShowTumblerModal(true)}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white border-2 border-amber-300 shadow-lg flex flex-col items-center justify-center active:scale-95 transition-transform">
                <Coffee className="w-5 h-5 text-amber-500" strokeWidth={2} />
                <span className="text-[8px] font-bold text-amber-700 leading-none mt-0.5">텀블러</span>
              </button>
            </div>
          </>
        ) : (
          <>
            {backgroundModeEnabled && (
              <div className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow
                ${bgNativeActive ? "bg-blue-500 text-white" : wakeLockActive ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"}`}>
                {bgNativeActive
                  ? <><Sun className="w-3.5 h-3.5 inline" strokeWidth={2} /> 백그라운드 GPS 활성</>
                  : wakeLockActive
                    ? <><Sun className="w-3.5 h-3.5 inline" strokeWidth={2} /> 화면 켜짐 유지</>
                    : <><AlertTriangleIcon className="w-3.5 h-3.5 inline" strokeWidth={2} /> 화면 꺼짐 주의</>
                }
              </div>
            )}
            <div className="relative w-full flex justify-center">
              <button onClick={handleStop}
                className="bg-red-500 text-white px-10 py-4 rounded-full text-lg font-bold shadow-xl active:scale-95 transition-transform flex items-center gap-2">
                <FlagIcon className="w-5 h-5" strokeWidth={2} /> 플로깅 종료
              </button>
              <button onClick={() => setShowTumblerModal(true)}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white border-2 border-amber-300 shadow-lg flex flex-col items-center justify-center active:scale-95 transition-transform">
                <Coffee className="w-5 h-5 text-amber-500" strokeWidth={2} />
                <span className="text-[8px] font-bold text-amber-700 leading-none mt-0.5">텀블러</span>
                {sessionTumblerCerts.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {sessionTumblerCerts.length}
                  </span>
                )}
              </button>
            </div>
          </>
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
            setSessionTumblerCerts([]);
            setSessionCupReturnCerts([]);
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
          aiEnabled={aiVerificationEnabled}
        />
      )}

      {/* ── 텀블러 인증 모달 ───────────────────────────── */}
      {showTumblerModal && (
        <TumblerCertModal
          onConfirm={handleTumblerConfirm}
          onClose={() => setShowTumblerModal(false)}
          isPlogging={isTracking}
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
              {result.breakdown.map((item, i) => {
                const isEcoBonus = item.label.includes("에코마일리지");
                return (
                  <div key={i} className={`flex justify-between text-sm rounded-lg px-2 py-1
                    ${isEcoBonus ? "bg-green-50" : ""}`}>
                    <span className={isEcoBonus ? "text-green-700 font-bold" : "text-gray-600"}>
                      {item.label}
                    </span>
                    <span className={`font-medium ${item.points > 0 ? "text-green-600" : "text-gray-400"}`}>
                      {item.points > 0 ? `+${item.points}P` : "0P"}
                    </span>
                  </div>
                );
              })}
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