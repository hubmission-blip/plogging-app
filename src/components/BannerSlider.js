"use client";

import { useState, useEffect } from "react";

const BANNERS = [
  {
    id: 1,
    bg: "from-green-400 to-emerald-600",
    emoji: "🌿",
    title: "함께하는 플로깅",
    subtitle: "사단법인 국제청년환경연합회 (GYEA)",
    link: null,
  },
  {
    id: 2,
    bg: "from-blue-400 to-cyan-600",
    emoji: "🌍",
    title: "지구를 지키는 500원",
    subtitle: "플로깅 1회 완료 시 포인트 적립!",
    link: null,
  },
  {
    id: 3,
    bg: "from-orange-400 to-amber-500",
    emoji: "🏆",
    title: "이달의 플로깅 챔피언",
    subtitle: "지역 랭킹에 도전하세요",
    link: null,
  },
  {
    id: 4,
    bg: "from-purple-400 to-violet-600",
    emoji: "♻️",
    title: "감탄소와 함께",
    subtitle: "에코 파트너십 캠페인",
    link: null,
  },
  {
    id: 5,
    bg: "from-pink-400 to-rose-500",
    emoji: "👥",
    title: "그룹 플로깅 모집",
    subtitle: "함께하면 보너스 포인트!",
    link: null,
  },
];

export default function BannerSlider() {
  const [current, setCurrent] = useState(0);

  // 자동 슬라이드 (3초)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % BANNERS.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const banner = BANNERS[current];

  return (
    <div className="relative w-full overflow-hidden rounded-2xl">
      {/* 배너 */}
      <div
        className={`bg-gradient-to-r ${banner.bg} text-white p-6 h-40 flex flex-col justify-between transition-all duration-500`}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm opacity-80">{banner.subtitle}</p>
            <h3 className="text-xl font-bold mt-1">{banner.title}</h3>
          </div>
          <span className="text-5xl">{banner.emoji}</span>
        </div>

        {/* 인디케이터 */}
        <div className="flex gap-1.5">
          {BANNERS.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === current ? "w-6 bg-white" : "w-1.5 bg-white/50"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}