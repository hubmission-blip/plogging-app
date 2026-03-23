"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ─── 배너 데이터 ────────────────────────────────────────
// 실제 배너 이미지/링크는 여기서 수정하세요
const BANNERS = [
  {
    id: 1,
    bg: "from-green-400 to-green-600",
    emoji: "🌿",
    title: "오백원의 행복",
    sub: "플로깅으로 지구를 지켜요",
    link: null,
    tag: null,
  },
  {
    id: 2,
    bg: "from-blue-400 to-blue-600",
    emoji: "♻️",
    title: "감탄소 파트너",
    sub: "탄소 절감 인증 파트너사",
    link: "https://example.com",
    tag: "파트너",
  },
  {
    id: 3,
    bg: "from-purple-400 to-purple-600",
    emoji: "🏆",
    title: "이번 주 랭킹 1위",
    sub: "나도 도전해볼까?",
    link: "/ranking",
    tag: "랭킹",
  },
  {
    id: 4,
    bg: "from-orange-400 to-orange-500",
    emoji: "👥",
    title: "그룹 플로깅",
    sub: "친구와 함께 보너스 포인트!",
    link: "/group",
    tag: "NEW",
  },
  {
    id: 5,
    bg: "from-teal-400 to-teal-600",
    emoji: "🎁",
    title: "포인트 교환",
    sub: "모은 포인트로 리워드 받기",
    link: "/reward",
    tag: "리워드",
  },
  {
    id: 6,
    bg: "from-pink-400 to-pink-600",
    emoji: "📸",
    title: "플로깅 인증샷",
    sub: "사진 업로드하고 기록 남기기",
    link: "/map",
    tag: null,
  },
  {
    id: 7,
    bg: "from-indigo-400 to-indigo-600",
    emoji: "🌍",
    title: "GYEA 국제청년환경연합회",
    sub: "함께 만드는 깨끗한 지구",
    link: "https://gyea.kr",
    tag: "공식",
  },
  {
    id: 8,
    bg: "from-yellow-400 to-yellow-500",
    emoji: "⭐",
    title: "큐엠씨코리아 파트너",
    sub: "에코 리워드 파트너십",
    link: "https://example.com",
    tag: "파트너",
  },
  {
    id: 9,
    bg: "from-red-400 to-red-500",
    emoji: "🚶",
    title: "하루 30분 플로깅",
    sub: "매일 꾸준히, 지구도 건강하게",
    link: "/map",
    tag: "도전",
  },
  {
    id: 10,
    bg: "from-cyan-400 to-cyan-600",
    emoji: "💧",
    title: "깨끗한 수질 보호",
    sub: "하천 주변 플로깅 캠페인",
    link: null,
    tag: "캠페인",
  },
  {
    id: 11,
    bg: "from-lime-400 to-lime-600",
    emoji: "🌱",
    title: "신규 회원 환영",
    sub: "첫 플로깅 완료 시 보너스 100P",
    link: "/map",
    tag: "혜택",
  },
  {
    id: 12,
    bg: "from-violet-400 to-violet-600",
    emoji: "📱",
    title: "홈 화면에 추가하기",
    sub: "앱처럼 편하게 사용하세요",
    link: null,
    tag: "TIP",
  },
];

// ─── 컴포넌트 ─────────────────────────────────────────────
export default function BannerSlider({ autoInterval = 4000 }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused]   = useState(false);
  const timerRef = useRef(null);

  const total = BANNERS.length;

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % total);
  }, [total]);

  const prev = useCallback(() => {
    setCurrent((prev) => (prev - 1 + total) % total);
  }, [total]);

  // ── 자동 슬라이드 ────────────────────────────────────────
  useEffect(() => {
    if (paused) return;
    timerRef.current = setInterval(next, autoInterval);
    return () => clearInterval(timerRef.current);
  }, [paused, next, autoInterval]);

  const handleBannerClick = (banner) => {
    if (!banner.link) return;
    if (banner.link.startsWith("http")) {
      window.open(banner.link, "_blank");
    } else {
      window.location.href = banner.link;
    }
  };

  const banner = BANNERS[current];

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden select-none"
      style={{ height: "140px" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      {/* ── 배너 슬라이드 (애니메이션) ── */}
      {BANNERS.map((b, idx) => (
        <div
          key={b.id}
          onClick={() => handleBannerClick(b)}
          className={`absolute inset-0 bg-gradient-to-r ${b.bg} flex items-center px-5
            transition-opacity duration-500
            ${idx === current ? "opacity-100 z-10" : "opacity-0 z-0"}
            ${b.link ? "cursor-pointer" : "cursor-default"}`}
        >
          {/* 태그 */}
          {b.tag && (
            <span className="absolute top-3 right-3 bg-white/30 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {b.tag}
            </span>
          )}

          {/* 이모지 */}
          <div className="text-5xl mr-4 flex-shrink-0">{b.emoji}</div>

          {/* 텍스트 */}
          <div>
            <p className="text-white font-bold text-lg leading-tight">{b.title}</p>
            <p className="text-white/80 text-sm mt-0.5">{b.sub}</p>
            {b.link && (
              <p className="text-white/60 text-xs mt-1.5">탭하여 이동 →</p>
            )}
          </div>
        </div>
      ))}

      {/* ── 좌우 화살표 ── */}
      <button
        onClick={(e) => { e.stopPropagation(); prev(); }}
        className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 bg-black/20 rounded-full text-white flex items-center justify-center text-xs"
      >
        ‹
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); next(); }}
        className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 bg-black/20 rounded-full text-white flex items-center justify-center text-xs"
      >
        ›
      </button>

      {/* ── 하단 인디케이터 ── */}
      <div className="absolute bottom-2.5 left-0 right-0 flex justify-center gap-1 z-20">
        {BANNERS.map((_, idx) => (
          <button
            key={idx}
            onClick={(e) => { e.stopPropagation(); setCurrent(idx); }}
            className={`rounded-full transition-all duration-300
              ${idx === current ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/50"}`}
          />
        ))}
      </div>

      {/* ── 순서 표시 ── */}
      <div className="absolute bottom-2.5 right-3 z-20 text-white/50 text-xs">
        {current + 1}/{total}
      </div>
    </div>
  );
}