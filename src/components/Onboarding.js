"use client";

import { useState } from "react";

const SLIDES = [
  {
    emoji: "🌿",
    title: "오백원의 행복에 오신걸 환영해요!",
    desc: "걸으면서 쓰레기를 줍는 플로깅으로\n환경도 지키고 포인트도 받아요",
    bg: "from-green-400 to-emerald-500",
  },
  {
    emoji: "🗺️",
    title: "내 플로깅 동선을 지도에 기록해요",
    desc: "GPS로 경로를 자동으로 기록하고\n주차별 색상으로 히스토리를 확인해요",
    bg: "from-blue-400 to-cyan-500",
  },
  {
    emoji: "🏆",
    title: "포인트 모아서 리워드 받기",
    desc: "1km = 50P, 2km 완주 = +100P\n모은 포인트로 다양한 리워드와 교환해요",
    bg: "from-yellow-400 to-orange-400",
  },
  {
    emoji: "👥",
    title: "친구와 함께하면 더 즐거워요",
    desc: "그룹 플로깅으로 보너스 포인트!\n함께 지구를 지켜요 🌍",
    bg: "from-purple-400 to-violet-500",
  },
];

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [locationGranted, setLocationGranted] = useState(false);

  const isLast = step === SLIDES.length - 1;
  const slide = SLIDES[step];

  const requestLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      () => setLocationGranted(true),
      () => setLocationGranted(false)
    );
  };

  const handleComplete = () => {
    localStorage.setItem("onboarded", "true");
    onComplete?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* 슬라이드 배경 */}
      <div className={`bg-gradient-to-b ${slide.bg} flex-1 flex flex-col items-center justify-center p-8 text-white text-center`}>
        <div className="text-8xl mb-6 animate-bounce">{slide.emoji}</div>
        <h2 className="text-2xl font-bold leading-tight mb-3">{slide.title}</h2>
        <p className="text-white/80 text-base leading-relaxed whitespace-pre-line">
          {slide.desc}
        </p>
      </div>

      {/* 하단 컨트롤 */}
      <div className="bg-white px-6 py-8">
        {/* 인디케이터 */}
        <div className="flex justify-center gap-2 mb-6">
          {SLIDES.map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === step ? "w-6 bg-green-500" : "w-2 bg-gray-200"
              }`}
            />
          ))}
        </div>

        {/* 마지막 슬라이드: 위치 권한 요청 */}
        {isLast && !locationGranted && (
          <button
            onClick={requestLocation}
            className="w-full bg-green-100 text-green-700 py-3 rounded-xl font-medium text-sm mb-3"
          >
            📍 위치 권한 허용하기 (플로깅 필수)
          </button>
        )}
        {isLast && locationGranted && (
          <div className="bg-green-50 text-green-600 text-sm text-center py-2 rounded-xl mb-3">
            ✅ 위치 권한 허용됨!
          </div>
        )}

        <div className="flex gap-3">
          {/* 건너뛰기 */}
          {!isLast && (
            <button
              onClick={handleComplete}
              className="flex-1 border border-gray-200 py-3 rounded-xl text-gray-400 font-medium"
            >
              건너뛰기
            </button>
          )}

          {/* 다음 / 시작 */}
          <button
            onClick={() => isLast ? handleComplete() : setStep((s) => s + 1)}
            className="flex-1 bg-green-500 text-white py-3 rounded-xl font-bold"
          >
            {isLast ? "🚀 시작하기!" : "다음 →"}
          </button>
        </div>
      </div>
    </div>
  );
}