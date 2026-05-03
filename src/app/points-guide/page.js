"use client";

import Link from "next/link";
import { ArrowLeft, Footprints, UserPlus, ShoppingBag, Link2, Leaf, Trophy, ChevronRight } from "lucide-react";

const CATEGORIES = [
  {
    emoji: "🏃", title: "플로깅", Icon: Footprints,
    color: "#8dc63f",
    items: [
      { label: "거리 1km 달성", point: "+50P" },
      { label: "2km 이상 완주 보너스", point: "+100P" },
      { label: "그룹 참여 (인원 × 5)", point: "+αP" },
    ],
  },
  {
    emoji: "🌿", title: "녹색생활 인증", Icon: Leaf,
    color: "#22c55e",
    items: [
      { label: "전자영수증 발급", point: "+20P" },
      { label: "텀블러/다회용컵 이용", point: "+30P" },
      { label: "일회용컵 반환", point: "컵당 +10P" },
      { label: "다회용기 배달 이용", point: "+30P" },
      { label: "무공해차 대여", point: "+50P" },
      { label: "친환경제품 구매", point: "+30P" },
      { label: "고품질 재활용품 배출", point: "+20P" },
      { label: "공유자전거 이용", point: "+30P" },
      { label: "잔반제로 실천", point: "+20P" },
      { label: "개인장바구니 이용", point: "+20P" },
      { label: "개인용기 식품포장", point: "+20P" },
      { label: "나무심기 캠페인 참여", point: "+50P" },
      { label: "베란다 태양광 설치", point: "+50P" },
    ],
  },
  {
    emoji: "👋", title: "가입 & 추천", Icon: UserPlus,
    color: "#3b82f6",
    items: [
      { label: "신규 가입 환영 포인트", point: "+100P" },
      { label: "추천인 코드 입력 (신규 회원)", point: "+50P" },
      { label: "내 추천 코드로 가입 시 (추천인)", point: "+100P" },
    ],
  },
  {
    emoji: "🛒", title: "친환경 쇼핑", Icon: ShoppingBag,
    color: "#f59e0b",
    items: [
      { label: "제휴 상품 구매 시 보너스", point: "+20~100P" },
    ],
  },
  {
    emoji: "🔗", title: "연동 보너스", Icon: Link2,
    color: "#8b5cf6",
    items: [
      { label: "에코마일리지 / 탄소중립포인트 연동", point: "+20% 추가" },
    ],
  },
];

export default function PointsGuidePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
          <Link href="/" className="p-1"><ArrowLeft size={22} strokeWidth={2} className="text-gray-600" /></Link>
          <h1 className="font-black text-base text-gray-800">포인트 적립 기준</h1>
          <div className="w-8" />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 pb-24 space-y-4">
        {/* 상단 안내 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
          <p className="text-2xl mb-1">🪙</p>
          <p className="font-bold text-gray-700">다양한 활동으로 포인트를 적립하세요</p>
          <p className="text-sm text-gray-400 mt-1">적립한 포인트는 리워드 교환, 기부에 사용할 수 있어요</p>
        </div>

        {/* 카테고리별 포인트 */}
        {CATEGORIES.map((cat) => (
          <div key={cat.title} className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-50"
              style={{ backgroundColor: cat.color + "10" }}>
              <cat.Icon size={20} strokeWidth={2} style={{ color: cat.color }} />
              <h2 className="font-bold text-gray-800">{cat.emoji} {cat.title}</h2>
            </div>
            <div className="px-5 py-2">
              {cat.items.map((item, i) => (
                <div key={item.label}
                  className={`flex justify-between items-center py-3 ${i < cat.items.length - 1 ? "border-b border-gray-50" : ""}`}>
                  <span className="text-sm text-gray-600">{item.label}</span>
                  <span className="text-sm font-bold" style={{ color: cat.color }}>{item.point}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* 하단 CTA */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/eco"
            className="block text-center text-white font-bold py-3.5 rounded-2xl text-sm active:scale-95 transition-transform bg-green-500">
            녹색생활 인증
            <ChevronRight size={16} className="inline ml-0.5 -mt-0.5" />
          </Link>
          <Link href="/reward"
            className="block text-center text-white font-bold py-3.5 rounded-2xl text-sm active:scale-95 transition-transform"
            style={{ backgroundColor: "#8dc63f" }}>
            리워드 교환
            <ChevronRight size={16} className="inline ml-0.5 -mt-0.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
