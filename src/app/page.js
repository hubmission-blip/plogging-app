"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import BannerSlider from "@/components/BannerSlider";
import { getPointGrade } from "@/lib/pointCalc";

const QUICK_MENUS = [
  { href: "/map",     icon: "🗺️", label: "플로깅\n시작",  color: "bg-green-50 text-green-700" },
  { href: "/rewards", icon: "🎁", label: "리워드\n교환",  color: "bg-yellow-50 text-yellow-700" },
  { href: "/ranking", icon: "🏆", label: "지역\n랭킹",   color: "bg-blue-50 text-blue-700" },
  { href: "/history", icon: "📋", label: "내\n기록",     color: "bg-purple-50 text-purple-700" },
];

const HOW_TO = [
  { step: "01", icon: "📱", title: "앱 열기", desc: "오백원의 행복 실행" },
  { step: "02", icon: "🚶", title: "플로깅 시작", desc: "지도에서 시작 버튼 클릭" },
  { step: "03", icon: "🗑️", title: "쓰레기 줍기", desc: "걸으며 환경 지키기" },
  { step: "04", icon: "🎁", title: "포인트 적립", desc: "거리만큼 포인트 획득" },
];

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* 헤더 */}
      <div className="bg-gradient-to-b from-green-600 to-green-500 px-4 pt-12 pb-6 text-white">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-green-100 text-sm">사단법인 국제청년환경연합회</p>
            <h1 className="text-2xl font-bold">오백원의 행복 🌿</h1>
          </div>
          <Link href={user ? "/profile" : "/login"}>
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-lg">
              {user ? "👤" : "🔑"}
            </div>
          </Link>
        </div>
        {user ? (
          <p className="text-green-100 text-xs mt-2">
            환영합니다! {user.email?.split("@")[0]}님 🎉
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
        {/* 배너 슬라이더 */}
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
            <Link href="/map">
              <button className="bg-white text-green-600 px-4 py-2 rounded-xl font-bold text-sm shadow">
                시작 →
              </button>
            </Link>
          </div>
        </div>

        {/* 이용 방법 */}
        <div>
          <h2 className="font-bold text-gray-700 mb-3">이용 방법</h2>
          <div className="grid grid-cols-2 gap-3">
            {HOW_TO.map((item) => (
              <div key={item.step} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-green-500">STEP {item.step}</span>
                </div>
                <span className="text-2xl">{item.icon}</span>
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
              { label: "그룹 참여 (인원 × 5)", point: "+α P" },
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
          <p className="text-xs text-gray-400">
            사단법인 국제청년환경연합회 (GYEA)
          </p>
          <p className="text-xs text-gray-300 mt-0.5">hubmission@gmail.com</p>
        </div>
      </div>
    </div>
  );
}