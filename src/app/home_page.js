"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import BannerSlider from "@/components/BannerSlider";
import CharacterGuide from "@/components/CharacterGuide";

const HOW_TO = [
  { step: 1, icon: "📍", title: "위치 허용",   desc: "앱 첫 실행 시 위치 권한을 허용해주세요" },
  { step: 2, icon: "🚶", title: "플로깅 시작", desc: "지도 페이지에서 시작 버튼을 누르세요" },
  { step: 3, icon: "🏁", title: "플로깅 종료", desc: "종료 후 거리·포인트가 자동 계산돼요" },
  { step: 4, icon: "🎁", title: "리워드 교환", desc: "모은 포인트로 리워드를 받아보세요" },
];

// localStorage 키 (첫 방문 가이드)
const GUIDE_KEY = "plogging_guide_shown";

export default function HomePage() {
  const { user } = useAuth();
  const [showGuide, setShowGuide] = useState(false);

  // 첫 방문 시에만 캐릭터 가이드 표시
  useEffect(() => {
    try {
      const shown = localStorage.getItem(GUIDE_KEY);
      if (!shown) setShowGuide(true);
    } catch {
      // localStorage 미지원 환경 무시
    }
  }, []);

  const handleGuideComplete = () => {
    try { localStorage.setItem(GUIDE_KEY, "1"); } catch {}
    setShowGuide(false);
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "오백원의 행복",
          text: "🌿 플로깅으로 지구를 지키고 포인트도 받아요!",
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert("링크가 복사됐어요! 📋");
      }
    } catch (e) {
      console.log("공유 취소");
    }
  };

  return (
    <>
      {/* ── 캐릭터 가이드 (첫 방문) ── */}
      {showGuide && <CharacterGuide onComplete={handleGuideComplete} />}

      <div
        className="min-h-screen bg-gray-50 overflow-y-auto"
        style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom, 20px))" }}
      >
        {/* ── 상단 헤더 ── */}
        <div className="bg-gradient-to-b from-green-600 to-green-500 text-white px-4 pt-12 pb-8">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h1 className="text-2xl font-black">🌿 오백원의 행복</h1>
              <p className="text-green-200 text-sm mt-0.5">즐거운 플로깅, 깨끗한 지구</p>
            </div>
            {user && (
              <Link href="/profile">
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg">
                  {user.photoURL
                    ? <img src={user.photoURL} alt="" className="w-full h-full rounded-full object-cover" />
                    : "👤"
                  }
                </div>
              </Link>
            )}
          </div>

          {/* 로그인 여부별 */}
          {user ? (
            <div className="mt-3 bg-white/15 rounded-2xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-green-200">반갑습니다!</p>
                <p className="font-bold text-sm">{user.displayName || user.email?.split("@")[0]}</p>
              </div>
              <Link
                href="/map"
                className="bg-white text-green-600 px-4 py-2 rounded-full text-sm font-black shadow"
              >
                🚶 지금 시작
              </Link>
            </div>
          ) : (
            <div className="mt-3 flex gap-2">
              <Link
                href="/login"
                className="flex-1 bg-white text-green-600 py-3 rounded-2xl font-bold text-center text-sm shadow"
              >
                로그인
              </Link>
              <Link
                href="/register"
                className="flex-1 bg-green-400 text-white py-3 rounded-2xl font-bold text-center text-sm"
              >
                회원가입
              </Link>
            </div>
          )}
        </div>

        <div className="px-4 mt-4 space-y-4">
          {/* ── 광고 배너 슬라이더 ── */}
          <BannerSlider />

          {/* ── 빠른 메뉴 ── */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { href: "/map",     icon: "🗺️",  label: "지도" },
              { href: "/ranking", icon: "🏆",  label: "랭킹" },
              { href: "/group",   icon: "👥",  label: "그룹" },
              { href: "/reward",  icon: "🎁",  label: "리워드" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="bg-white rounded-2xl py-3 flex flex-col items-center gap-1 shadow-sm active:scale-95 transition-transform"
              >
                <span className="text-2xl">{item.icon}</span>
                <span className="text-xs text-gray-600 font-medium">{item.label}</span>
              </Link>
            ))}
          </div>

          {/* ── 이번 주 내 현황 (로그인 시) ── */}
          {user && (
            <Link href="/profile" className="block">
              <div className="bg-gradient-to-r from-green-500 to-teal-500 rounded-2xl p-4 text-white shadow">
                <p className="text-xs text-green-100 mb-2">내 프로필 보기 →</p>
                <div className="flex gap-4">
                  <div className="text-center">
                    <p className="text-xl font-black">📊</p>
                    <p className="text-xs text-green-100 mt-0.5">통계 확인</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-black">🏅</p>
                    <p className="text-xs text-green-100 mt-0.5">뱃지 수집</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-black">⭐</p>
                    <p className="text-xs text-green-100 mt-0.5">레벨업</p>
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* ── 친구 초대 ── */}
          <button
            onClick={handleShare}
            className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 active:scale-98 transition-transform"
          >
            <div className="flex-1 text-left">
              <p className="font-bold text-gray-700">친구에게 앱 소개하기 📤</p>
              <p className="text-xs text-gray-400 mt-0.5">함께 플로깅하면 그룹 보너스!</p>
            </div>
            <span className="text-3xl">🌍</span>
          </button>

          {/* ── 이용 방법 ── */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold text-gray-700">이용 방법</h2>
              <button
                onClick={() => setShowGuide(true)}
                className="text-xs text-green-500 font-medium border border-green-200 px-2 py-1 rounded-full"
              >
                가이드 다시 보기
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {HOW_TO.map((item) => (
                <div key={item.step} className="bg-white rounded-2xl p-4 shadow-sm">
                  <span className="text-xs font-bold text-green-500">STEP {item.step}</span>
                  <div className="text-2xl mt-1">{item.icon}</div>
                  <p className="font-bold text-sm mt-1">{item.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── 포인트 안내 ── */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h2 className="font-bold text-gray-700 mb-3">💰 포인트 적립 기준</h2>
            <div className="space-y-2">
              {[
                { label: "거리 1km 달성",      point: "+50P" },
                { label: "2km 이상 완주",       point: "+100P 보너스" },
                { label: "그룹 참여 (인원 × 5)", point: "+αP" },
                { label: "신규 가입 환영 포인트", point: "+100P" },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center py-1.5 border-b last:border-0">
                  <span className="text-sm text-gray-600">{item.label}</span>
                  <span className="text-sm font-bold text-green-600">{item.point}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── 푸터 ── */}
          <div className="text-center py-2">
            <p className="text-xs text-gray-400">사단법인 국제청년환경연합회 (GYEA)</p>
            <p className="text-xs text-gray-300 mt-0.5">hubmission@gmail.com</p>
          </div>
        </div>
      </div>
    </>
  );
}