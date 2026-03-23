"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import BannerSlider from "@/components/BannerSlider";
import Onboarding from "@/components/Onboarding";

const QUICK_MENUS = [
  { href: "/map",     icon: "🗺️", label: "플로깅\n시작",  color: "bg-green-50 text-green-700" },
  { href: "/rewards", icon: "🎁", label: "리워드\n교환",  color: "bg-yellow-50 text-yellow-700" },
  { href: "/ranking", icon: "🏆", label: "지역\n랭킹",   color: "bg-blue-50 text-blue-700" },
  { href: "/group",   icon: "👥", label: "그룹\n플로깅", color: "bg-purple-50 text-purple-700" },
];

const HOW_TO = [
  { step: "01", icon: "📱", title: "앱 열기",    desc: "오백원의 행복 실행" },
  { step: "02", icon: "🚶", title: "플로깅 시작", desc: "지도에서 시작 버튼" },
  { step: "03", icon: "🗑️", title: "쓰레기 줍기", desc: "걸으며 환경 지키기" },
  { step: "04", icon: "🎁", title: "포인트 적립", desc: "거리만큼 포인트 획득" },
];

export default function HomePage() {
  const { user } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const onboarded = localStorage.getItem("onboarded");
    if (!onboarded) setShowOnboarding(true);
  }, []);

  // ✅ try/catch로 공유 취소·클립보드 오류 처리
  const handleShare = async () => {
    const shareData = {
      title: "오백원의 행복",
      text: "🌿 플로깅으로 환경도 지키고 포인트도 받아요! 함께해요 😊",
      url: "https://plogging-app-rose.vercel.app",
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url);
        alert("링크가 복사됐습니다! 📋");
      }
    } catch (err) {
      // 사용자가 공유 취소 시 조용히 무시 (AbortError)
      if (err.name !== "AbortError") {
        console.error("공유 오류:", err);
      }
    }
  };

  return (
    <>
      {showOnboarding && (
        <Onboarding onComplete={() => setShowOnboarding(false)} />
      )}

      <div className="min-h-screen bg-gray-50 pb-32">
        {/* 헤더 */}
        <div className="bg-gradient-to-b from-green-600 to-green-500 px-4 pt-12 pb-6 text-white">
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className="text-green-100 text-sm">사단법인 국제청년환경연합회</p>
              <h1 className="text-2xl font-bold">오백원의 행복 🌿</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleShare}
                className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-lg"
              >
                📤
              </button>
              <Link href={user ? "/profile" : "/login"}>
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-lg">
                  {user ? "👤" : "🔑"}
                </div>
              </Link>
            </div>
          </div>
          {user ? (
            <p className="text-green-100 text-xs mt-2">
              환영해요, {user.displayName || user.email?.split("@")[0]}님! 🎉
            </p>
          ) : (
            <Link href="/login">
              <p className="text-green-100 text-xs mt-2 underline">
                로그인하고 포인트 적립하기 →
              </p>
            </Link>
          )}
        </div>

        <div className="px-4 -mt-2 space-y-5">
          <BannerSlider />

          {/* 빠른 메뉴 */}
          <div>
            <h2 className="font-bold text-gray-700 mb-3">빠른 메뉴</h2>
            <div className="grid grid-cols-4 gap-3">
              {QUICK_MENUS.map((menu) => (
                <Link key={menu.href} href={menu.href}>
                  <div className={`${menu.color} rounded-2xl p-3 text-center aspect-square flex flex-col items-center justify-center gap-1`}>
                    <span className="text-2xl">{menu.icon}</span>
                    <span className="text-xs font-medium leading-tight whitespace-pre-line">
                      {menu.label}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* 오늘의 미션 */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-xs font-medium">오늘의 미션</p>
                <p className="font-bold text-lg mt-0.5">2km 플로깅 완주하기</p>
                <p className="text-green-100 text-sm mt-1">완주 시 +200P 보너스!</p>
              </div>
              {/* ✅ Link 안에 button 제거 → Link 자체를 버튼처럼 스타일링 */}
              <Link
                href="/map"
                className="bg-white text-green-600 px-4 py-2 rounded-xl font-bold text-sm shadow"
              >
                시작 →
              </Link>
            </div>
          </div>

          {/* 앱 공유 배너 */}
          <button
            onClick={handleShare}
            className="w-full bg-white rounded-2xl shadow-sm p-4 flex items-center justify-between"
          >
            <div className="text-left">
              <p className="font-bold text-gray-700">친구에게 앱 소개하기 📤</p>
              <p className="text-xs text-gray-400 mt-0.5">함께 플로깅하면 그룹 보너스!</p>
            </div>
            <span className="text-3xl">🌍</span>
          </button>

          {/* 이용 방법 */}
          <div>
            <h2 className="font-bold text-gray-700 mb-3">이용 방법</h2>
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

          {/* 포인트 안내 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h2 className="font-bold text-gray-700 mb-3">💰 포인트 적립 기준</h2>
            <div className="space-y-2">
              {[
                { label: "거리 1km 달성", point: "+50P" },
                { label: "2km 이상 완주", point: "+100P 보너스" },
                { label: "그룹 참여 (인원 × 5)", point: "+αP" },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center py-1.5 border-b last:border-0">
                  <span className="text-sm text-gray-600">{item.label}</span>
                  <span className="text-sm font-bold text-green-600">{item.point}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 푸터 */}
          <div className="text-center py-2">
            <p className="text-xs text-gray-400">사단법인 국제청년환경연합회 (GYEA)</p>
            <p className="text-xs text-gray-300 mt-0.5">hubmission@gmail.com</p>
          </div>
        </div>
      </div>
    </>
  );
}