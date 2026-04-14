"use client";

import Link from "next/link";

const SECTIONS = [
  {
    id: "energy",
    icon: "⚡",
    label: "에너지",
    color: "from-yellow-400 to-orange-500",
    badgeColor: "bg-orange-100 text-orange-700",
    title: "탄소중립포인트 에너지",
    subtitle: "전기·가스·수도 절약으로 포인트 적립",
    url: "https://cpoint.or.kr",
    urlLabel: "cpoint.or.kr",
    desc: "가정·상업용 건물에서 전기, 도시가스, 상수도 사용량을 전년 대비 절감하면 포인트가 지급됩니다. 지자체를 통해 현금·상품권·지역화폐 등으로 환급받을 수 있어요.",
    items: [
      { label: "전기 절약", point: "최대 90,000원/년" },
      { label: "도시가스 절약", point: "최대 90,000원/년" },
      { label: "상수도 절약", point: "최대 30,000원/년" },
    ],
    howto: [
      "탄소중립포인트 에너지 누리집 접속",
      "회원가입 후 참여 신청",
      "에너지 사용량 자동 집계",
      "반기별 절감량 확인 후 인센티브 수령",
    ],
  },
  {
    id: "car",
    icon: "🚗",
    label: "자동차",
    color: "from-blue-400 to-blue-600",
    badgeColor: "bg-blue-100 text-blue-700",
    title: "탄소중립포인트 자동차",
    subtitle: "연간 주행거리 줄이면 최대 10만원",
    url: "https://car.cpoint.or.kr",
    urlLabel: "car.cpoint.or.kr",
    desc: "비사업용 12인승 이하 승용·승합차량을 대상으로, 전년 대비 주행거리를 줄이면 포인트가 지급됩니다. 매년 참여 신청이 필요합니다.",
    items: [
      { label: "주행거리 감축 5%", point: "약 30,000원" },
      { label: "주행거리 감축 10%", point: "약 60,000원" },
      { label: "주행거리 감축 15% 이상", point: "최대 100,000원" },
    ],
    howto: [
      "자동차 탄소중립포인트 누리집 접속",
      "회원가입 후 차량 등록",
      "연간 주행거리 자동 집계",
      "다음 해 감축량 확인 후 포인트 수령",
    ],
    note: "⚠️ 전기·수소·하이브리드 차량 및 영업용 차량은 제외",
  },
  {
    id: "green",
    icon: "🌿",
    label: "녹색생활",
    color: "from-green-400 to-green-600",
    badgeColor: "bg-green-100 text-green-700",
    title: "탄소중립포인트 녹색생활 실천",
    subtitle: "일상 속 친환경 실천으로 포인트 적립",
    url: "https://www.cpoint.or.kr/netzero/main.do",
    urlLabel: "cpoint.or.kr/netzero",
    desc: "텀블러 사용, 전자영수증 발급, 다회용기 이용 등 일상 속 친환경 행동으로 포인트를 쌓을 수 있어요. 2026년부터 17개 항목으로 확대되었습니다.",
    items: [
      { label: "전자영수증 발급", point: "100원/건" },
      { label: "텀블러·다회용컵 이용", point: "300원/회" },
      { label: "고품질 재활용품 배출", point: "300원/회" },
      { label: "나무심기 캠페인 참여", point: "3,000원/회" },
      { label: "베란다 태양광 설치", point: "10,000원/회" },
      { label: "공유자전거 이용", point: "100원/회" },
      { label: "개인 장바구니 이용", point: "50원/회" },
      { label: "다회용기 식품포장", point: "500원/회" },
    ],
    howto: [
      "녹색생활 실천 누리집 또는 앱 설치",
      "회원가입 후 참여 신청",
      "제휴 매장에서 실천 후 앱으로 인증",
      "적립 포인트 → 현금·상품권 교환",
    ],
  },
];

export default function CarbonPage() {
  return (
    <div
      className="min-h-screen bg-gray-50 overflow-y-auto"
      style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom, 20px))" }}
    >
      {/* ── 헤더 ── */}
      <div className="bg-gradient-to-br from-green-500 to-teal-600 px-4 pt-10 pb-8 text-white relative">
        <Link href="/" className="absolute top-4 left-4 text-white/80 text-sm flex items-center gap-1">
          ← 홈
        </Link>
        <div className="text-center mt-4">
          <div className="text-5xl mb-3">🌍</div>
          <h1 className="text-2xl font-black leading-tight">탄소중립포인트</h1>
          <p className="text-green-100 text-sm mt-1">친환경 실천으로 포인트도 받고 지구도 지켜요!</p>
        </div>

        {/* 요약 뱃지 */}
        <div className="flex justify-center gap-2 mt-4">
          {["에너지", "자동차", "녹색생활"].map((t) => (
            <span key={t} className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="px-4 mt-4 space-y-4">

        {/* ── 소개 카드 ── */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border-l-4 border-green-400">
          <p className="text-sm text-gray-700 leading-relaxed">
            <strong className="text-green-600">탄소중립포인트</strong>는 환경부에서 운영하는 제도로,
            일상 속 온실가스 감축 활동을 실천하면 포인트를 지급하는 국가 인센티브 프로그램이에요.
            에너지·자동차·녹색생활 3가지 분야에 모두 중복 참여 가능합니다.
          </p>
        </div>

        {/* ── 각 분야별 카드 ── */}
        {SECTIONS.map((sec) => (
          <div key={sec.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">

            {/* 카드 헤더 */}
            <div className={`bg-gradient-to-r ${sec.color} px-4 py-4 text-white`}>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{sec.icon}</span>
                <div>
                  <p className="font-black text-lg leading-tight">{sec.title}</p>
                  <p className="text-white/80 text-xs mt-0.5">{sec.subtitle}</p>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {/* 설명 */}
              <p className="text-sm text-gray-600 leading-relaxed">{sec.desc}</p>

              {/* 주의사항 */}
              {sec.note && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  <p className="text-xs text-red-600">{sec.note}</p>
                </div>
              )}

              {/* 포인트 혜택 */}
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2">💰 포인트 혜택</p>
                <div className="space-y-1.5">
                  {sec.items.map((item) => (
                    <div key={item.label} className="flex justify-between items-center bg-gray-50 rounded-xl px-3 py-2">
                      <span className="text-sm text-gray-600">{item.label}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sec.badgeColor}`}>
                        {item.point}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 참여 방법 */}
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2">📋 참여 방법</p>
                <div className="space-y-1.5">
                  {sec.howto.map((step, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className={`text-xs font-black w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5
                        bg-gradient-to-br ${sec.color} text-white`}>
                        {i + 1}
                      </span>
                      <p className="text-xs text-gray-600 leading-relaxed">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 바로가기 버튼 */}
              <a
                href={sec.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white
                  bg-gradient-to-r ${sec.color} active:opacity-80 transition-opacity`}
              >
                <span>🔗 {sec.urlLabel} 바로가기</span>
              </a>
            </div>
          </div>
        ))}

        {/* ── 플로깅 연계 안내 ── */}
        <div className="bg-gradient-to-br from-green-50 to-teal-50 border border-green-200 rounded-2xl p-4">
          <p className="text-sm font-bold text-green-700 mb-2">🌿 오백원의행복 + 탄소중립포인트</p>
          <p className="text-xs text-gray-600 leading-relaxed">
            오백원의행복 앱으로 플로깅하면서 포인트를 적립하고,
            탄소중립포인트 녹색생활 실천 프로그램에도 함께 참여해보세요.
            두 가지 포인트를 동시에 모을 수 있어요! 💪
          </p>
        </div>

      </div>
    </div>
  );
}
