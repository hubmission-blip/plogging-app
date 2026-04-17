"use client";

import { useState } from "react";

// ─── 캐릭터 / 가이드 스텝 ─────────────────────────────────
const GUIDE_STEPS = [
  {
    id: 1,
    emoji: "🌱",
    character: "새싹이",
    title: "안녕하세요! 저는 새싹이예요",
    desc: "**오백원의행복** 앱에 오신 걸 환영해요!\n플로깅은 조깅하면서 쓰레기를 줍는 환경 캠페인이에요.",
    tip: null,
    bg: "from-green-400 to-green-600",
  },
  {
    id: 2,
    emoji: "📍",
    character: "위치기반",
    title: "GPS로 내 위치를 추적해요",
    desc: "지도 페이지에서 '플로깅 시작'을 누르면\n실시간으로 내 이동 경로가 지도에 그려져요!",
    tip: "💡 TIP: 위치 권한을 허용해야 동선이 기록돼요",
    bg: "from-blue-400 to-blue-600",
  },
  {
    id: 3,
    emoji: "💰",
    character: "모아 모아",
    title: "걸으면 포인트가 쌓여요!",
    desc: "플로깅 거리에 따라 포인트가 적립돼요.\n1km = 50P, 2km 이상이면 보너스 100P 추가!",
    tip: "💡 TIP: 친구와 그룹 플로깅하면 보너스가 더 붙어요",
    bg: "from-yellow-400 to-orange-500",
  },
  {
    id: 4,
    emoji: "👥",
    character: "친구들",
    title: "함께하면 더 즐거운 플로깅!",
    desc: "그룹 방을 만들고 친구를 초대해보세요.\n참여 인원 × 5P 보너스 포인트가 지급돼요.",
    tip: "💡 TIP: 그룹 코드를 카카오톡으로 공유해보세요",
    bg: "from-purple-400 to-purple-600",
  },
  {
    id: 5,
    emoji: "🚗",
    character: "경고! 경고!",
    title: "이건 안 돼요!",
    desc: "시속 30km/h 이상으로 이동하면 자동으로\n플로깅이 종료되고 포인트가 지급되지 않아요.",
    tip: "⚠️ 걷거나 뛰는 속도로만 플로깅이 인정돼요",
    bg: "from-red-400 to-red-600",
  },
  {
    id: 6,
    emoji: "🤖",
    character: "AI 인증",
    title: "AI 사진 인증 시스템",
    desc: "플로깅 완료 후 주운 쓰레기를 담은 봉투와 함께\n인증샷을 찍어보세요!\n**AI가 자동으로 사진을 분석**해서\n인증이 완료되면 포인트가 즉시 지급돼요! 📸",
    tip: "💡 TIP: 쓰레기가 잘 보이도록 찍으면 인증률이 높아요",
    bg: "from-teal-400 to-teal-600",
  },
  {
    id: 7,
    emoji: "🎁",
    character: "행복한 선물",
    title: "포인트로 리워드 받기",
    desc: "모은 포인트로 선물, 쿠폰 등\n**다양한 리워드로 교환**할 수 있어요!\n기아대책, 환경활동 등\n**좋은 일에 기부**할 수도 있어요 💚",
    tip: "💡 TIP: 리워드 페이지에서 다양한 혜택을 확인하세요",
    bg: "from-pink-400 to-pink-600",
  },
  {
    id: 8,
    emoji: "🌍",
    character: "지구환경 지킴이",
    title: "모두함께 만드는 깨끗한 지구",
    desc: "당신의 플로깅 한 걸음이\n더 깨끗한 지구를 만들어요.\n오늘도 함께해주셔서 감사해요! 🌿",
    tip: null,
    bg: "from-indigo-400 to-indigo-600",
  },
];

// ─── **bold** 마커 렌더링 헬퍼 ───────────────────────────
function renderDesc(text) {
  return text.split("\n").map((line, lineIdx) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span key={lineIdx}>
        {lineIdx > 0 && <br />}
        {parts.map((part, i) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={i} className="font-black text-gray-900">
              {part.slice(2, -2)}
            </strong>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  });
}

// ─── 컴포넌트 ─────────────────────────────────────────────
export default function CharacterGuide({ onComplete }) {
  const [step, setStep] = useState(0);
  const total   = GUIDE_STEPS.length;
  const current = GUIDE_STEPS[step];
  const isLast  = step === total - 1;

  const handleNext = () => {
    if (isLast) {
      if (onComplete) onComplete();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handlePrev = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  return (
    // ✅ 핵심 수정 1: z-[200] → BottomNav(z-50)보다 확실히 위에 렌더
    <div className="fixed inset-0 bg-black/60 flex items-end z-[200]">

      {/* ✅ 핵심 수정 2: overflow-hidden 제거, max-h로 스크롤 허용 */}
      <div className="w-full bg-white rounded-t-3xl shadow-2xl max-h-[88vh] flex flex-col">

        {/* ── 캐릭터 배경 (스크롤 불가 고정 영역) ── */}
        <div className={`bg-gradient-to-br ${current.bg} px-6 pt-8 pb-6 text-white text-center flex-shrink-0 rounded-t-3xl`}>
          <div className="text-7xl mb-2">{current.emoji}</div>
          <p className="text-sm opacity-80 mb-1">{current.character}</p>
          <h2 className="text-xl font-black leading-tight">{current.title}</h2>
        </div>

        {/* ── 내용 (스크롤 가능) ── */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          <p className="text-gray-600 text-sm leading-relaxed">
            {renderDesc(current.desc)}
          </p>
          {current.tip && (
            <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2.5">
              <p className="text-sm text-yellow-700">{current.tip}</p>
            </div>
          )}
        </div>

        {/* ── 진행 인디케이터 (고정) ── */}
        <div className="flex justify-center gap-1.5 py-2 flex-shrink-0">
          {GUIDE_STEPS.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setStep(idx)}
              className={`rounded-full transition-all duration-300
                ${idx === step ? "w-5 h-2 bg-green-500" : "w-2 h-2 bg-gray-200"}`}
            />
          ))}
        </div>

        {/* ── 버튼 영역 (고정, safe-area 패딩 포함) ── */}
        {/* ✅ 핵심 수정 3: style로 safe-area-inset-bottom 적용 → iOS 홈 인디케이터 대응 */}
        <div
          className="flex gap-2 px-6 pt-2 flex-shrink-0"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 12px) + 20px)" }}
        >
          {step > 0 && (
            <button
              onClick={handlePrev}
              className="flex-1 bg-gray-100 text-gray-600 py-3.5 rounded-2xl font-bold"
            >
              ← 이전
            </button>
          )}
          <button
            onClick={handleNext}
            className={`py-3.5 rounded-2xl font-bold text-white
              bg-gradient-to-r ${current.bg}
              ${step > 0 ? "flex-1" : "w-full"}`}
          >
            {isLast ? "🚶 플로깅 시작하기!" : "다음 →"}
          </button>
        </div>

        {/* ── 건너뛰기 / 시작하기 (전 페이지 공통) ── */}
        <button
          onClick={() => { if (onComplete) onComplete(); }}
          className="w-full text-center text-xs text-gray-300 pb-3 flex-shrink-0"
        >
          {isLast ? "🌿 지금 바로 시작하기" : "건너뛰기"}
        </button>
      </div>
    </div>
  );
}