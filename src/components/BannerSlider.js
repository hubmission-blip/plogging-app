"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

// ─── 기본 하드코딩 배너 (Firestore 미설정 시 표시) ────────────
// priority: 낮을수록 앞에 노출 (1 = 최우선)
// region: "전국" = 모두 노출 | 특정 시/도 = 해당 지역만 노출
const BANNERS = [
  {
    id: 1, priority: 1, region: "전국",
    bg: "from-green-400 to-green-600", emoji: "🌿",
    title: "오백원의 행복", sub: "플로깅으로 지구를 지켜요",
    link: null, tag: null,
  },
  {
    id: 2, priority: 2, region: "전국",
    bg: "from-blue-400 to-blue-600", emoji: "♻️",
    title: "감탄소 파트너", sub: "탄소 절감 인증 파트너사",
    link: "https://www.gamtanso.com/", tag: "파트너",
  },
  {
    id: 3, priority: 3, region: "전국",
    bg: "from-purple-400 to-purple-600", emoji: "🏆",
    title: "이번 주 랭킹 1위", sub: "나도 도전해볼까?",
    link: "/ranking", tag: "랭킹",
  },
  {
    id: 4, priority: 4, region: "전국",
    bg: "from-orange-400 to-orange-500", emoji: "👥",
    title: "그룹 플로깅", sub: "친구와 함께 보너스 포인트!",
    link: "/group", tag: "NEW",
  },
  {
    id: 5, priority: 5, region: "전국",
    bg: "from-teal-400 to-teal-600", emoji: "🎁",
    title: "포인트 교환", sub: "모은 포인트로 리워드 받기",
    link: "/reward", tag: "리워드",
  },
  {
    id: 6, priority: 6, region: "전국",
    bg: "from-pink-400 to-pink-600", emoji: "📸",
    title: "플로깅 인증샷", sub: "사진 업로드하고 기록 남기기",
    link: "/map", tag: null,
  },
  {
    id: 7, priority: 7, region: "전국",
    bg: "from-indigo-400 to-indigo-600", emoji: "🌍",
    title: "GYEA 국제청년환경연합회", sub: "함께 만드는 깨끗한 지구",
    link: "https://gyea.kr", tag: "공식",
  },
  {
    id: 8, priority: 8, region: "전국",
    bg: "from-yellow-400 to-yellow-500", emoji: "⭐",
    title: "큐엠씨코리아 파트너", sub: "에코 리워드 파트너십",
    link: "https://example.com", tag: "파트너",
  },
  {
    id: 9, priority: 9, region: "전국",
    bg: "from-red-400 to-red-500", emoji: "🚶",
    title: "하루 30분 플로깅", sub: "매일 꾸준히, 지구도 건강하게",
    link: "/map", tag: "도전",
  },
  {
    id: 10, priority: 10, region: "전국",
    bg: "from-cyan-400 to-cyan-600", emoji: "💧",
    title: "깨끗한 수질 보호", sub: "하천 주변 플로깅 캠페인",
    link: "https://www.youtube.com/watch?v=55kCOkQlleU", tag: "캠페인",
  },
  {
    id: 11, priority: 11, region: "전국",
    bg: "from-lime-400 to-lime-600", emoji: "🌱",
    title: "신규 회원 환영", sub: "첫 플로깅 완료 시 보너스 100P",
    link: "/map", tag: "혜택",
  },
  {
    id: 12, priority: 12, region: "전국",
    bg: "from-violet-400 to-violet-600", emoji: "📱",
    title: "홈 화면에 추가하기", sub: "앱처럼 편하게 사용하세요",
    link: null, tag: "TIP",
  },
];

// ─── YouTube URL → embed ID 추출 ──────────────────────────────
// 지원 형식: youtube.com/watch?v=XXX | youtu.be/XXX | youtube.com/shorts/XXX
function getYouTubeId(url) {
  const patterns = [
    /youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

// ─── 컴포넌트 ─────────────────────────────────────────────────
// userRegion: 감지된 사용자 시/도 (예: "부산광역시") | null = 미감지
export default function BannerSlider({ userRegion = null, autoInterval = 4000 }) {
  const [current,      setCurrent]      = useState(0);
  const [paused,       setPaused]       = useState(false);
  const [allBanners,   setAllBanners]   = useState(null); // null = 아직 로드 전
  const [bannerList,   setBannerList]   = useState(BANNERS);
  const [ytVideoId,    setYtVideoId]    = useState(null);  // YouTube 모달용
  const [ytIsShorts,   setYtIsShorts]   = useState(false); // Shorts 여부 (9:16)
  const timerRef = useRef(null);

  // ── Firestore 실시간 리스너 (onSnapshot) ────────────────────
  // getDocs 대신 onSnapshot 사용 → 관리자가 배너 수정 즉시 앱에 반영
  useEffect(() => {
    const q = query(collection(db, "banners"), where("active", "==", true));
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!snap.empty) {
          const loaded = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setAllBanners(loaded);
        } else {
          // Firestore에 활성 배너 없으면 기본 배너 사용
          setAllBanners([]);
        }
      },
      (err) => {
        console.warn("배너 로드 실패, 기본 배너 사용:", err.message);
        setAllBanners([]); // 오류 시 기본 배너 표시
      }
    );
    return () => unsub(); // 컴포넌트 언마운트 시 리스너 해제
  }, []);

  // ── 지역 필터 + 중요도 정렬 + 항상 12개 유지 ────────────────
  useEffect(() => {
    // Firestore 로드 전 → 기본 12개 그라디언트 배너 바로 표시
    if (allBanners === null) {
      setBannerList(BANNERS);
      setCurrent(0);
      return;
    }

    // 1. Firestore 배너 지역 필터
    const firestoreFiltered = allBanners.filter((b) => {
      const r = b.region || "전국";
      return r === "전국" || (userRegion && r === userRegion);
    });

    // 2. priority 오름차순 정렬
    const sorted = [...firestoreFiltered].sort(
      (a, b) => (a.priority ?? a.order ?? 99) - (b.priority ?? b.order ?? 99)
    );

    // 3. 12개 미만이면 기본 그라디언트 배너로 나머지 채우기
    //    (Firestore 배너가 이미 12개 이상이면 그대로 사용)
    const needed = Math.max(0, 12 - sorted.length);
    const padded = needed > 0 ? BANNERS.slice(0, needed) : [];
    const finalList = [...sorted, ...padded];

    setBannerList(finalList.length > 0 ? finalList : BANNERS);
    setCurrent(0);
  }, [allBanners, userRegion]);

  const total = bannerList.length;

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % total);
  }, [total]);

  const prev = useCallback(() => {
    setCurrent((prev) => (prev - 1 + total) % total);
  }, [total]);

  // ── 자동 슬라이드 ────────────────────────────────────────────
  useEffect(() => {
    if (paused) return;
    timerRef.current = setInterval(next, autoInterval);
    return () => clearInterval(timerRef.current);
  }, [paused, next, autoInterval]);

  const handleBannerClick = (banner) => {
    if (!banner.link) return;
    // YouTube 링크 → 앱 내 임베드 모달로 재생 (창 이중 열림 문제 방지)
    if (banner.link.includes("youtube.com") || banner.link.includes("youtu.be")) {
      const id = getYouTubeId(banner.link);
      if (id) {
        const isShorts = banner.link.includes("/shorts/");
        setYtVideoId(id);
        setYtIsShorts(isShorts);
        setPaused(true);
        return;
      }
    }
    // 일반 외부 링크
    if (banner.link.startsWith("http")) {
      window.open(banner.link, "_blank");
    } else {
      // 앱 내부 경로
      window.location.href = banner.link;
    }
  };

  const handleCloseYt = () => { setYtVideoId(null); setYtIsShorts(false); setPaused(false); };

  const banner = bannerList[current];

  return (
    <>
    {/* ── YouTube 임베드 모달 ── */}
    {ytVideoId && (
      <div
        className="fixed inset-0 bg-black/85 z-[500] flex flex-col items-center justify-center p-4"
        onClick={handleCloseYt}
      >
        <div
          className={`bg-black rounded-2xl overflow-hidden shadow-2xl
            ${ytIsShorts
              ? "w-full max-w-xs"      // 쇼츠: 좁고 세로로 긺
              : "w-full max-w-lg"}`}   // 일반: 가로로 넓음
          onClick={(e) => e.stopPropagation()}
        >
          {/* 모달 헤더 */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900">
            <div className="flex items-center gap-2">
              <span className="text-red-500 text-lg">▶</span>
              <p className="text-white text-sm font-bold">
                YouTube {ytIsShorts && <span className="text-xs text-gray-400 ml-1">Shorts</span>}
              </p>
            </div>
            <button
              onClick={handleCloseYt}
              className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center text-lg leading-none active:bg-white/20"
            >
              ×
            </button>
          </div>

          {/* 영상 영역 — 쇼츠: 9:16 세로 / 일반: 16:9 가로 */}
          <div style={{ aspectRatio: ytIsShorts ? "9/16" : "16/9" }}>
            <iframe
              src={`https://www.youtube.com/embed/${ytVideoId}?autoplay=1&rel=0&playsinline=1&enablejsapi=1`}
              className="w-full h-full"
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen
              title={ytIsShorts ? "YouTube Shorts" : "YouTube 영상"}
            />
          </div>

          {/* 닫기 버튼 */}
          <button
            onClick={handleCloseYt}
            className="w-full py-3 bg-gray-900 text-gray-300 text-sm font-bold active:bg-gray-800"
          >
            ✕ 닫고 돌아가기
          </button>
        </div>
        <p className="text-white/40 text-xs mt-3">배경을 탭해도 닫혀요</p>
      </div>
    )}

    <div
      className="relative w-full rounded-2xl overflow-hidden select-none"
      style={{ aspectRatio: "5/2", minHeight: "160px", maxHeight: "220px" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      {/* ── 배너 슬라이드 ── */}
      {bannerList.map((b, idx) => (
        <div
          key={b.id}
          onClick={() => handleBannerClick(b)}
          className={`absolute inset-0 transition-opacity duration-500
            ${idx === current ? "opacity-100 z-10" : "opacity-0 z-0"}
            ${b.link ? "cursor-pointer" : "cursor-default"}`}
        >
          {/* 이미지 배너 */}
          {b.image ? (
            <img
              key={b.image}
              src={b.image.includes("?") ? b.image : `${b.image}?v=${b.updatedAt?.seconds || b.id}`}
              alt={b.title || "배너"}
              className="w-full h-full object-cover"
            />
          ) : (
            /* 그라디언트 + 텍스트 배너 */
            <div className={`w-full h-full bg-gradient-to-r ${b.bg} flex items-center px-5`}>
              {b.tag && (
                <span className="absolute top-3 right-3 bg-white/30 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {b.tag}
                </span>
              )}
              {/* 지역 배너 표시 (전국이 아닐 때) */}
              {b.region && b.region !== "전국" && (
                <span className="absolute top-3 left-3 bg-orange-500/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  📍 {b.region.slice(0, 2)}
                </span>
              )}
              <div className="text-5xl mr-4 flex-shrink-0">{b.emoji}</div>
              <div>
                <p className="text-white font-bold text-lg leading-tight">{b.title}</p>
                <p className="text-white/80 text-sm mt-0.5">{b.sub}</p>
                {b.link && (
                  <p className="text-white/60 text-xs mt-1.5">탭하여 이동 →</p>
                )}
              </div>
            </div>
          )}
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
        {bannerList.map((_, idx) => (
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
    </>
  );
}
