"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Zap, Car, Leaf, CreditCard, ChevronUp, ChevronDown, Globe, LinkIcon, Building2, ExternalLink,
  Waves, Apple, Plane, Palette, FlaskConical, Factory, Landmark, Wheat, Mountain, TreePine,
  Flower2, TreeDeciduous, Fish, Cherry, Citrus,
  Receipt, Coffee, CupSoda, Pipette, Package, ShieldCheck, Recycle, Smartphone, Sprout,
  Bike, UtensilsCrossed, Sun, RotateCcw, ShoppingBag, Container,
  Flame, Droplets, Gauge, Award, Trophy, Bus, Coins, Lightbulb, AlertTriangle,
} from "lucide-react";

// 지역별 아이콘 매핑
const REGION_ICONS = {
  "서울특별시":     { Icon: Landmark,      color: "text-blue-500" },
  "부산광역시":     { Icon: Waves,         color: "text-sky-500" },
  "대구광역시":     { Icon: Apple,         color: "text-red-500" },
  "인천광역시":     { Icon: Plane,         color: "text-indigo-500" },
  "광주광역시":     { Icon: Palette,       color: "text-purple-500" },
  "대전광역시":     { Icon: FlaskConical,  color: "text-cyan-500" },
  "울산광역시":     { Icon: Factory,       color: "text-gray-600" },
  "세종특별자치시": { Icon: Landmark,      color: "text-emerald-500" },
  "경기도":         { Icon: Wheat,         color: "text-amber-500" },
  "강원도":         { Icon: Mountain,      color: "text-teal-600" },
  "충청북도":       { Icon: TreePine,      color: "text-green-600" },
  "충청남도":       { Icon: Flower2,       color: "text-yellow-500" },
  "전북특별자치도": { Icon: Wheat,         color: "text-lime-600" },
  "전라남도":       { Icon: Waves,         color: "text-blue-500" },
  "경상북도":       { Icon: Cherry,        color: "text-pink-500" },
  "경상남도":       { Icon: Fish,          color: "text-sky-600" },
  "제주특별자치도": { Icon: Citrus,        color: "text-orange-500" },
};

// ── 녹색생활 실천 17개 항목 ─────────────────────────────
const GREEN_ITEMS = [
  // 기존 12개
  { Icon: Receipt,         iconColor: "text-blue-500",    name: "전자영수증 발급",       point: "100원/건",    tag: "기존" },
  { Icon: Coffee,          iconColor: "text-amber-500",   name: "텀블러·다회용컵 이용",  point: "300원/회",   tag: "기존" },
  { Icon: CupSoda,         iconColor: "text-teal-500",    name: "일회용컵 반환",          point: "200원/회",   tag: "기존" },
  { Icon: Pipette,         iconColor: "text-indigo-500",  name: "리필스테이션 이용",      point: "2,000원/회", tag: "기존" },
  { Icon: Package,         iconColor: "text-violet-500",  name: "다회용기 배달 이용",     point: "1,000원/회", tag: "기존" },
  { Icon: Car,             iconColor: "text-sky-500",     name: "무공해차 대여",           point: "100원/회",   tag: "기존" },
  { Icon: ShieldCheck,     iconColor: "text-emerald-500", name: "친환경제품 구매",         point: "1,000원/건", tag: "기존" },
  { Icon: Recycle,         iconColor: "text-cyan-500",    name: "고품질 재활용품 배출",   point: "300원/회",   tag: "기존" },
  { Icon: Smartphone,      iconColor: "text-rose-500",    name: "폐휴대폰 반납",           point: "1,000원/회", tag: "기존" },
  { Icon: Sprout,          iconColor: "text-green-500",   name: "미래세대 실천행동",       point: "500원/회",   tag: "기존" },
  { Icon: Bike,            iconColor: "text-lime-500",    name: "공유자전거 이용",         point: "100원/회",   tag: "기존" },
  { Icon: UtensilsCrossed, iconColor: "text-orange-500",  name: "잔반제로 실천",          point: "1,000원/회", tag: "기존" },
  // 2026 신규 5개
  { Icon: TreePine,        iconColor: "text-green-600",   name: "나무심기 캠페인 참여",   point: "3,000원/회",  tag: "신규" },
  { Icon: Sun,             iconColor: "text-yellow-500",  name: "베란다 태양광 설치",     point: "10,000원/회", tag: "신규" },
  { Icon: RotateCcw,       iconColor: "text-teal-500",    name: "재생원료 제품 구매",     point: "100원/건",    tag: "신규" },
  { Icon: ShoppingBag,     iconColor: "text-pink-500",    name: "개인 장바구니 이용",    point: "50원/회",     tag: "신규" },
  { Icon: Container,       iconColor: "text-purple-500",  name: "개인용기 식품포장",      point: "500원/회",    tag: "신규" },
];

// ── 섹션 데이터 ─────────────────────────────────────────
const SECTIONS = [
  {
    id: "energy",
    Icon: Zap,
    title: "탄소중립포인트 에너지",
    subtitle: "전기·도시가스·수도 절약",
    color: "from-orange-400 to-pink-500",
    bgLight: "bg-pink-50",
    borderColor: "border-pink-200",
    textColor: "text-pink-700",
    badgeBg: "bg-pink-100 text-pink-700",
    url: "https://cpoint.or.kr",
    urlLabel: "cpoint.or.kr",
    overview: "가정·상업용 건물에서 전기, 도시가스, 상수도 사용량을 전년 대비 절감하면 반기마다 인센티브를 지급하는 제도입니다. 지자체를 통해 현금·상품권·지역화폐 등으로 환급받을 수 있어요.",
    targets: [
      { label: "참여 대상", value: "가정 및 상업용 건물 (전국)" },
      { label: "측정 방법", value: "전년 동기 대비 사용량 비교" },
      { label: "지급 주기", value: "반기별 1회 (상반기→10월말, 하반기→4월말)" },
      { label: "지급 방법", value: "현금·상품권·지역화폐 (지자체별 상이)" },
    ],
    incentives: [
      { Icon: Zap,      iconColor: "text-yellow-500", label: "전기 절감 5% 이상",    point: "최대 90,000원/년" },
      { Icon: Flame,    iconColor: "text-orange-500", label: "도시가스 절감 5% 이상", point: "최대 90,000원/년" },
      { Icon: Droplets, iconColor: "text-blue-400",   label: "상수도 절감 5% 이상",   point: "최대 30,000원/년" },
    ],
    howto: [
      "cpoint.or.kr 접속 후 회원가입",
      "참여 신청 (지자체 선택)",
      "에너지 사용량 자동 집계",
      "반기별 절감량 확인 후 인센티브 수령",
    ],
    tip: "감축률 5% 이상이면 감축 인센티브, 5% 미만이라도 연속 달성 시 유지 인센티브 지급",
  },
  {
    id: "car",
    Icon: Car,
    title: "탄소중립포인트 자동차",
    subtitle: "연간 주행거리 감축",
    color: "from-yellow-400 to-orange-500",
    bgLight: "bg-orange-50",
    borderColor: "border-orange-200",
    textColor: "text-orange-700",
    badgeBg: "bg-orange-100 text-orange-700",
    url: "https://car.cpoint.or.kr",
    urlLabel: "car.cpoint.or.kr",
    overview: "차량의 연간 주행거리를 줄이면 최대 10만 원의 인센티브를 지급하는 제도입니다. 매년 신청 기간에 참여 신청을 해야 하며, 비사업용 12인승 이하 승용·승합 차량이 대상입니다.",
    targets: [
      { label: "참여 대상", value: "비사업용 12인승 이하 승용·승합 차량" },
      { label: "제외 차량", value: "전기·수소·하이브리드 차량, 영업용 차량, 서울시 등록 차량" },
      { label: "측정 방법", value: "신청일 계기판 주행거리 vs 확인일 주행거리 비교" },
      { label: "지급 주기", value: "연 1회 (10월 기준 정산)" },
    ],
    incentives: [
      { Icon: Gauge,   iconColor: "text-orange-500", label: "감축량/감축률 중 유리한 방식 적용", point: "최소 20,000원" },
      { Icon: Award,   iconColor: "text-gray-400",   label: "주행거리 감축 달성",                 point: "20,000~100,000원" },
      { Icon: Trophy,  iconColor: "text-yellow-500",  label: "최대 인센티브",                      point: "최대 100,000원/년" },
    ],
    howto: [
      "car.cpoint.or.kr 접속 후 회원가입",
      "차량 등록 및 참여 신청 (신청 기간 확인 필수)",
      "신청 시 계기판 주행거리 사진 등록",
      "10월 확인 시 계기판 사진 재등록 후 인센티브 수령",
    ],
    tip: "전기·수소·하이브리드 등 친환경 차량과 영업용 차량은 참여 불가",
  },
  {
    id: "green",
    Icon: Leaf,
    title: "탄소중립포인트 녹색생활 실천",
    subtitle: "일상 속 17가지 친환경 실천",
    color: "from-green-400 to-green-600",
    bgLight: "bg-green-50",
    borderColor: "border-green-200",
    textColor: "text-green-700",
    badgeBg: "bg-green-100 text-green-700",
    url: "https://www.cpoint.or.kr/netzero/main.do",
    urlLabel: "cpoint.or.kr/netzero",
    overview: "일상 속 친환경 행동 17가지를 실천하고 포인트를 적립하는 제도입니다. 2026년부터 기존 12개 항목에 5개가 추가되어 총 17개 항목으로 확대 운영됩니다. 예산도 전년 대비 13.1% 증가한 181억 원으로 늘었어요.",
    targets: [
      { label: "참여 대상", value: "전 국민 누구나" },
      { label: "실천 방법", value: "제휴 매장 방문 후 앱으로 인증" },
      { label: "지급 방법", value: "현금·상품권·기부 등 선택" },
      { label: "2026 예산", value: "181억 원 (전년 대비 13.1% 증가)" },
    ],
    howto: [
      "cpoint.or.kr/netzero 접속 또는 앱 설치",
      "회원가입 후 참여 신청",
      "제휴 매장에서 실천 후 앱으로 인증",
      "적립된 포인트로 현금·상품권 교환 또는 기부",
    ],
    tip: "항목별 포인트는 예산 및 실적에 따라 변동될 수 있으니 공식 누리집에서 최신 단가를 확인하세요",
  },
  {
    id: "greencard",
    Icon: CreditCard,
    title: "그린카드 (에코머니)",
    subtitle: "친환경 소비로 포인트 적립",
    customGradient: "linear-gradient(to right, #8dc63f, #4cb748)",
    iconColor: "#1a5c1a",
    bgLight: "bg-emerald-50",
    borderColor: "border-emerald-200",
    textColor: "text-emerald-700",
    badgeBg: "bg-emerald-100 text-emerald-700",
    url: "https://www.green-card.co.kr",
    urlLabel: "green-card.co.kr",
    overview: "환경부가 도입한 친환경 신용·체크카드로, 친환경 제품 구매 및 대중교통 이용 시 에코머니 포인트가 적립됩니다. 탄소중립포인트와도 연계되며, 국립공원·휴양림 등 공공시설 할인 혜택도 받을 수 있어요.",
    targets: [
      { label: "발급 대상", value: "전 국민 (만 14세 이상)" },
      { label: "발급 카드사", value: "BC·농협·기업·KB국민·수협·우리·하나·롯데 등" },
      { label: "포인트 명칭", value: "에코머니 포인트 (현금처럼 사용 가능)" },
      { label: "연계 제도", value: "탄소중립포인트·에코마일리지 연동 가능" },
    ],
    incentives: [
      { Icon: ShieldCheck, iconColor: "text-emerald-500", label: "친환경 인증제품 구매 시",     point: "추가 포인트 적립" },
      { Icon: Bus,         iconColor: "text-blue-500",    label: "대중교통 이용 시",             point: "최대 20% 적립" },
      { Icon: Zap,         iconColor: "text-yellow-500",  label: "전기차 충전 시 (V3 카드)",     point: "최대 40% 적립" },
      { Icon: TreeDeciduous, iconColor: "text-green-500", label: "국립공원·휴양림 이용 시",    point: "무료입장 또는 할인" },
    ],
    howto: [
      "green-card.co.kr 접속 후 카드사 선택",
      "원하는 카드사에서 그린카드 발급 신청",
      "탄소중립포인트·에코마일리지 계정과 연동",
      "친환경 소비 시 에코머니 포인트 자동 적립",
    ],
    tip: "그린카드로 탄소중립포인트 인센티브를 에코머니 포인트로 받으면 현금처럼 사용 가능",
  },
];

// ── 아코디언 섹션 컴포넌트 ──────────────────────────────
function SectionCard({ sec, greenItems }) {
  const [open, setOpen] = useState(false);
  const [showAllGreen, setShowAllGreen] = useState(false);

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* 헤더 */}
      <button
        className={`w-full px-4 py-4 text-white flex items-center justify-between ${sec.customGradient ? "" : `bg-gradient-to-r ${sec.color}`}`}
        style={sec.customGradient ? { backgroundImage: sec.customGradient } : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <sec.Icon className="w-8 h-8" strokeWidth={1.8} style={sec.iconColor ? { color: sec.iconColor } : { color: "rgba(255,255,255,0.9)" }} />
          <div className="text-left">
            <p className="font-black text-base leading-tight" style={sec.iconColor ? { color: sec.iconColor } : undefined}>{sec.title}</p>
            <p className={`text-xs mt-0.5 ${sec.iconColor ? "" : "text-white/80"}`} style={sec.iconColor ? { color: sec.iconColor, opacity: 0.7 } : undefined}>{sec.subtitle}</p>
          </div>
        </div>
        {open
          ? <ChevronUp className="w-5 h-5 text-white/70" strokeWidth={2} />
          : <ChevronDown className="w-5 h-5 text-white/70" strokeWidth={2} />
        }
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {/* 개요 */}
          <p className="text-sm text-gray-600 leading-relaxed">{sec.overview}</p>

          {/* 참여 정보 */}
          <div className={`${sec.bgLight} border ${sec.borderColor} rounded-xl p-3 space-y-2`}>
            {sec.targets.map((t) => (
              <div key={t.label} className="flex gap-2 text-xs">
                <span className={`font-bold ${sec.textColor} w-20 flex-shrink-0`}>{t.label}</span>
                <span className="text-gray-600">{t.value}</span>
              </div>
            ))}
          </div>

          {/* 인센티브 */}
          {sec.incentives && sec.incentives.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1"><Coins size={13} className="text-yellow-500" strokeWidth={2} /> 인센티브 혜택</p>
              <div className="space-y-1.5">
                {sec.incentives.map((item) => (
                  <div key={item.label} className="flex justify-between items-center bg-gray-50 rounded-xl px-3 py-2">
                    <span className="text-xs text-gray-600 flex items-center gap-1.5">
                      <item.Icon size={14} className={item.iconColor} strokeWidth={1.8} />{item.label}
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sec.badgeBg}`}>
                      {item.point}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 녹색생활 실천 17개 항목 */}
          {sec.id === "green" && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-gray-500 flex items-center gap-1"><Sprout size={13} className="text-green-500" strokeWidth={2} /> 17개 실천 항목 (2026년 기준)</p>
                <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full">
                  신규 5개 추가
                </span>
              </div>
              <div className="space-y-1.5">
                {(showAllGreen ? greenItems : greenItems.slice(0, 8)).map((item) => (
                  <div key={item.name} className="flex justify-between items-center bg-gray-50 rounded-xl px-3 py-2">
                    <span className="text-xs text-gray-600 flex items-center gap-1.5">
                      <item.Icon size={14} className={item.iconColor} strokeWidth={1.8} />{item.name}
                      {item.tag === "신규" && (
                        <span className="bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">NEW</span>
                      )}
                    </span>
                    <span className="text-xs font-bold text-green-700">{item.point}</span>
                  </div>
                ))}
              </div>
              {!showAllGreen && (
                <button
                  onClick={() => setShowAllGreen(true)}
                  className="w-full text-xs text-green-600 font-bold mt-2 py-2 border border-green-200 rounded-xl bg-green-50"
                >
                  전체 {greenItems.length}개 보기 ▼
                </button>
              )}
            </div>
          )}

          {/* 참여 방법 */}
          <div>
            <p className="text-xs font-bold text-gray-500 mb-2">📋 참여 방법</p>
            <div className="space-y-1.5">
              {sec.howto.map((step, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={`text-xs font-black w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5
                    ${sec.customGradient ? "text-white" : `bg-gradient-to-br ${sec.color} text-white`}`}
                    style={sec.customGradient ? { backgroundImage: sec.customGradient } : undefined}>
                    {i + 1}
                  </span>
                  <p className="text-xs text-gray-600 leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 팁 */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2 flex items-start gap-1.5">
            <Lightbulb size={14} className="text-yellow-500 flex-shrink-0 mt-0.5" strokeWidth={2} />
            <p className="text-xs text-yellow-700 leading-relaxed">{sec.tip}</p>
          </div>

          {/* 바로가기 */}
          <a
            href={sec.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white
              ${sec.customGradient ? "" : `bg-gradient-to-r ${sec.color}`} active:opacity-80 transition-opacity`}
            style={sec.customGradient ? { backgroundImage: sec.customGradient } : undefined}
          >
            <ExternalLink className="w-4 h-4 inline" strokeWidth={2} /> {sec.urlLabel} 바로가기
          </a>
        </div>
      )}
    </div>
  );
}

// ── 메인 페이지 ─────────────────────────────────────────
export default function CarbonPage() {
  return (
    <div
      className="min-h-screen bg-gray-50 overflow-y-auto"
      style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom, 20px))" }}
    >
      {/* ── 헤더 ── */}
      <div className="px-4 pt-10 pb-8 text-white relative" style={{ backgroundImage: "linear-gradient(to bottom right, #8dc63f, #4cb748)" }}>
        <Link href="/" className="absolute top-4 left-4 text-white/80 text-sm flex items-center gap-1">
          ← 홈
        </Link>
        <span className="absolute top-4 right-4 text-7xl opacity-80">🌍</span>
        <div className="relative mt-8">
          <h1 className="text-2xl font-black leading-tight">탄소중립포인트</h1>
          <p className="text-green-100 text-sm mt-1">환경부 운영 · 친환경 실천 국가 인센티브</p>
        </div>
        <div className="flex justify-center gap-2 mt-4 flex-wrap">
          {["에너지", "자동차", "녹색생활 실천", "그린카드"].map((t) => (
            <span key={t} className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="px-4 mt-4 space-y-4">

        {/* ── 제도 소개 ── */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border-l-4" style={{ borderLeftColor: "#8dc63f" }}>
          <p className="text-xs font-bold text-green-600 mb-1">📌 탄소중립포인트제란?</p>
          <p className="text-sm text-gray-700 leading-relaxed">
            환경부(기후에너지환경부)가 운영하는 국가 인센티브 제도로,
            온실가스 감축 활동을 실천하면 포인트를 지급합니다.
            <strong className="text-green-600"> 에너지·자동차·녹색생활 3개 분야</strong>에 중복 참여 가능하며,
            현금·상품권·지역화폐 등으로 환급받을 수 있어요.
          </p>
        </div>

        {/* ── 빠른 요약 카드 ── */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { Icon: Zap,  label: "에너지",   sub: "최대\n21만원/년",  color: "bg-pink-50 border-pink-200",     iconColor: "text-pink-500" },
            { Icon: Car,  label: "자동차",   sub: "최대\n10만원/년",  color: "bg-orange-50 border-orange-200", iconColor: "text-orange-500" },
            { Icon: Leaf, label: "녹색생활", sub: "17가지\n실천항목", color: "bg-green-50 border-green-200",   iconColor: "text-green-500" },
          ].map((c) => (
            <div key={c.label} className={`${c.color} border rounded-2xl p-3 text-center`}>
              <c.Icon className={`w-6 h-6 mx-auto ${c.iconColor}`} strokeWidth={1.8} />
              <p className="text-xs font-bold text-gray-700 mt-1">{c.label}</p>
              <p className="text-[10px] text-gray-500 mt-0.5 whitespace-pre-line leading-tight">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* ── 섹션별 상세 카드 ── */}
        <p className="text-xs text-gray-400 text-center">▼ 각 항목을 눌러 상세 내용 확인</p>
        {SECTIONS.map((sec) => (
          <SectionCard key={sec.id} sec={sec} greenItems={GREEN_ITEMS} />
        ))}

        {/* ── 중복참여 안내 ── */}
        <div className="rounded-2xl p-4 text-white" style={{ backgroundImage: "linear-gradient(to right, #8dc63f, #4cb748)" }}>
          <p className="font-black text-sm mb-2">✅ 중복 참여로 혜택 극대화!</p>
          <p className="text-xs text-green-100 leading-relaxed">
            에너지 + 자동차 + 녹색생활 + 그린카드를 모두 활용하면
            연간 최대 <strong className="text-white">30만원 이상</strong>의 인센티브를 받을 수 있어요.
          </p>
          <div className="mt-2 bg-white/20 rounded-xl px-3 py-2">
            <p className="text-[11px] text-white/90 leading-relaxed">
              💡 거주 지역별 에코마일리지 프로그램은 아래 <strong>지자체 에코마일리지 바로가기</strong>를 확인하세요.
            </p>
          </div>
        </div>

        {/* ── 플로깅 연계 안내 ── */}
        <div className="bg-white border border-green-200 rounded-2xl p-4">
          <p className="text-sm font-bold text-green-700 mb-2 flex items-center gap-1.5"><Leaf className="w-4 h-4 text-green-600" strokeWidth={2} /> 오백원의행복 + 탄소중립포인트</p>
          <p className="text-xs text-gray-600 leading-relaxed">
            오백원의행복으로 플로깅하면서 포인트를 적립하고,
            탄소중립포인트 녹색생활 실천(공유자전거, 텀블러 등)에도 함께 참여하면
            두 가지 포인트를 동시에 모을 수 있어요! 💪
          </p>
        </div>

        {/* ── 공식 링크 모음 ── */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-500 mb-3 flex items-center gap-1.5"><LinkIcon className="w-3.5 h-3.5" strokeWidth={2} /> 공식 누리집 바로가기</p>
          <div className="space-y-2">
            {[
              { label: "탄소중립포인트 에너지",       Icon: Zap,        url: "https://cpoint.or.kr",                      sub: "cpoint.or.kr" },
              { label: "탄소중립포인트 자동차",        Icon: Car,        url: "https://car.cpoint.or.kr",                  sub: "car.cpoint.or.kr" },
              { label: "탄소중립포인트 녹색생활 실천", Icon: Leaf,       url: "https://www.cpoint.or.kr/netzero/main.do",  sub: "cpoint.or.kr/netzero" },
              { label: "그린카드 (에코머니)",          Icon: CreditCard, url: "https://www.green-card.co.kr",              sub: "green-card.co.kr" },
            ].map((link) => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5 active:bg-gray-100"
              >
                <div className="flex items-center gap-2">
                  <link.Icon className="w-4 h-4 text-gray-500 flex-shrink-0" strokeWidth={1.8} />
                  <div>
                    <p className="text-xs font-bold text-gray-700">{link.label}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{link.sub}</p>
                  </div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-gray-400" strokeWidth={2} />
              </a>
            ))}
          </div>
        </div>

        {/* ── 지자체별 에코마일리지 바로가기 ── */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-bold text-gray-700 flex items-center gap-1.5"><Building2 className="w-4 h-4 text-gray-600" strokeWidth={1.8} /> 지자체별 에코마일리지 바로가기</p>
            <Link
              href="/ecomileage"
              className="text-xs text-sky-600 font-bold border border-sky-200 px-2.5 py-1 rounded-full bg-sky-50"
            >
              전체 안내 →
            </Link>
          </div>
          <p className="text-xs text-gray-400 mb-3">거주 지역을 선택해 해당 프로그램으로 이동하세요</p>

          {/* 서울 (독자 운영) */}
          <div className="mb-3">
            <p className="text-[10px] font-bold text-blue-500 mb-1.5 px-1">🔵 독자 운영</p>
            <a
              href="https://ecomileage.seoul.go.kr"
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 active:opacity-80"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Landmark size={16} className="text-blue-500" strokeWidth={1.8} />
                </div>
                <div>
                  <p className="text-xs font-bold text-blue-700">서울특별시</p>
                  <p className="text-[10px] text-blue-400">서울시 에코마일리지</p>
                </div>
              </div>
              <span className="text-blue-400 text-sm">→</span>
            </a>
          </div>

          {/* 나머지 16개 시/도 (탄소중립포인트 연계) */}
          <div>
            <p className="text-[10px] font-bold text-green-500 mb-1.5 px-1">🟢 탄소중립포인트 연계</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                "부산광역시", "대구광역시", "인천광역시", "광주광역시",
                "대전광역시", "울산광역시", "세종특별자치시", "경기도",
                "강원도", "충청북도", "충청남도", "전북특별자치도",
                "전라남도", "경상북도", "경상남도", "제주특별자치도",
              ].map((name) => {
                const ri = REGION_ICONS[name] || { Icon: Building2, color: "text-gray-500" };
                const RIcon = ri.Icon;
                return (
                  <a
                    key={name}
                    href="https://cpoint.or.kr"
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-2.5 py-2 active:opacity-80"
                  >
                    <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                      <RIcon size={14} className={ri.color} strokeWidth={1.8} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-700 truncate">{name}</p>
                      <p className="text-[10px] text-gray-400">cpoint.or.kr</p>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
