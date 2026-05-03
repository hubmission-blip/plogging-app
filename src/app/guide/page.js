"use client";

import Link from "next/link";
import { ArrowLeft, Navigation, Footprints, Flag, Camera, Trophy, HeartHandshake, Leaf, ChevronRight } from "lucide-react";

const STEPS = [
  {
    step: 1, Icon: Navigation, title: "위치 허용",
    desc: "앱 첫 실행 시 위치 권한을 허용해주세요. GPS를 사용해 플로깅 거리를 자동으로 측정합니다.",
    detail: "iOS: 설정 → 오백원의 행복 → 위치 → '앱 사용 중' 허용",
  },
  {
    step: 2, Icon: Footprints, title: "플로깅 시작",
    desc: "지도 페이지에서 '시작' 버튼을 누르면 플로깅이 시작됩니다. 걸으면서 주변 쓰레기를 주워주세요.",
    detail: "플로깅 가능 시간: 오전 6:00 ~ 오후 10:00",
  },
  {
    step: 3, Icon: Flag, title: "플로깅 종료",
    desc: "종료 버튼을 누르면 이동 거리와 시간이 자동으로 계산됩니다.",
    detail: "1km 달성 시 +50P, 2km 이상 완주 시 +100P 보너스",
  },
  {
    step: 4, Icon: Camera, title: "AI 사진 인증",
    desc: "쓰레기를 담은 봉투와 함께 인증샷을 찍어주세요. AI가 자동으로 사진을 검증합니다.",
    detail: "갤러리 사진은 사용할 수 없어요. 방금 촬영한 사진만 인증 가능합니다.",
  },
  {
    step: 5, Icon: Trophy, title: "리워드 교환",
    desc: "모은 포인트로 편의점 상품권, 커피 쿠폰 등 다양한 리워드를 받아보세요.",
    detail: "내 정보 → 리워드 교환에서 포인트를 사용할 수 있어요",
  },
  {
    step: 6, Icon: HeartHandshake, title: "포인트 후원",
    desc: "포인트를 환경단체, 기아대책 등에 기부할 수 있습니다. 작은 실천이 큰 변화를 만들어요.",
    detail: "리워드 교환 페이지에서 '기부' 카테고리를 선택하세요",
  },
];

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
          <Link href="/" className="p-1"><ArrowLeft size={22} strokeWidth={2} className="text-gray-600" /></Link>
          <h1 className="font-black text-base text-gray-800">이용 방법</h1>
          <div className="w-8" />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* 상단 안내 */}
        <div className="text-center mb-2">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50">
            <Leaf size={18} strokeWidth={2} style={{ color: "#8dc63f" }} />
            <span className="text-sm font-bold" style={{ color: "#8dc63f" }}>6단계로 시작하는 즐거운 플로깅</span>
          </div>
        </div>

        {/* 스텝 카드 */}
        {STEPS.map((item) => (
          <div key={item.step} className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "#8dc63f20" }}>
                <item.Icon size={26} strokeWidth={1.8} style={{ color: "#8dc63f" }} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-black px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: "#8dc63f" }}>
                    STEP {item.step}
                  </span>
                  <span className="font-bold text-gray-800">{item.title}</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
              </div>
            </div>
            {item.detail && (
              <div className="mt-3 ml-[4.5rem] bg-gray-50 rounded-xl px-3 py-2">
                <p className="text-xs text-gray-500">{item.detail}</p>
              </div>
            )}
          </div>
        ))}

        {/* 하단 CTA */}
        <Link href="/map"
          className="block w-full text-center text-white font-bold py-4 rounded-2xl active:scale-95 transition-transform"
          style={{ backgroundColor: "#8dc63f" }}>
          지금 플로깅 시작하기
          <ChevronRight size={18} className="inline ml-1 -mt-0.5" />
        </Link>
      </div>
    </div>
  );
}
