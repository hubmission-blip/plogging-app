"use client";

import { useState } from "react";
import Link from "next/link";

// ── 17개 시/도 데이터 ──────────────────────────────────
const REGIONS = [
  {
    id: "seoul",
    name: "서울특별시",
    emoji: "🗼",
    type: "독자운영",
    typeBg: "bg-blue-100 text-blue-700",
    program: "서울시 에코마일리지",
    url: "https://ecomileage.seoul.go.kr",
    desc: "서울시가 독자적으로 운영하는 에너지 절감 마일리지 제도. 전국 유일의 독립 운영 시스템으로 탄소중립포인트 에너지와 중복 가입 불가.",
    incentives: ["전기·수도·가스 절감 → 1~5만 마일리지/반기", "승용차 주행거리 감축 → 최대 1만 마일리지", "녹색실천 마일리지 → 최대 5,000 마일리지 (2026 신설)"],
    usage: ["상품권", "ETAX포인트(지방세)", "아파트 관리비 차감", "기부"],
    note: "2026년 참여신청제 도입 — 반기별 누리집에서 직접 신청 필요",
  },
  {
    id: "busan",
    name: "부산광역시",
    emoji: "🌊",
    type: "탄소중립포인트",
    typeBg: "bg-green-100 text-green-700",
    program: "탄소중립포인트 에너지",
    url: "https://cpoint.or.kr",
    desc: "환경부 탄소중립포인트 에너지 제도에 참여. 전기·도시가스·수도 사용량 절감 시 반기별 인센티브 지급.",
    incentives: ["전기 절감 5% 이상 → 최대 90,000원/년", "도시가스 절감 5% 이상 → 최대 90,000원/년", "수도 절감 5% 이상 → 최대 30,000원/년"],
    usage: ["현금", "상품권", "종량제 봉투", "지방세 납부"],
    note: "cpoint.or.kr에서 부산광역시 선택 후 가입",
  },
  {
    id: "daegu",
    name: "대구광역시",
    emoji: "🍎",
    type: "탄소중립포인트",
    typeBg: "bg-green-100 text-green-700",
    program: "탄소중립포인트 에너지",
    url: "https://cpoint.or.kr",
    desc: "환경부 탄소중립포인트 에너지 제도 참여. 대구시 자체 추가 인센티브 운영.",
    incentives: ["전기·가스·수도 절감 → 연 최대 210,000원", "감축률 5% 이상 시 감축 인센티브 지급"],
    usage: ["현금", "상품권", "종량제 봉투"],
    note: "cpoint.or.kr에서 대구광역시 선택 후 가입",
  },
  {
    id: "incheon",
    name: "인천광역시",
    emoji: "✈️",
    type: "탄소중립포인트",
    typeBg: "bg-green-100 text-green-700",
    program: "탄소중립포인트 에너지",
    url: "https://cpoint.or.kr",
    desc: "환경부 탄소중립포인트 에너지 제도 참여. 인천시 거주자 대상 반기별 에너지 절감 인센티브.",
    incentives: ["전기·가스·수도 절감 → 연 최대 210,000원"],
    usage: ["현금", "상품권", "지역화폐(인천e음)"],
    note: "cpoint.or.kr에서 인천광역시 선택 후 가입",
  },
  {
    id: "gwangju",
    name: "광주광역시",
    emoji: "🎨",
    type: "탄소중립포인트",
    typeBg: "bg-green-100 text-green-700",
    program: "탄소중립포인트 에너지",
    url: "https://cpoint.or.kr",
    desc: "환경부 탄소중립포인트 에너지 제도 참여.",
    incentives: ["전기·가스·수도 절감 → 연 최대 210,000원"],
    usage: ["현금", "상품권", "종량제 봉투"],
    note: "cpoint.or.kr에서 광주광역시 선택 후 가입",
  },
  {
    id: "daejeon",
    name: "대전광역시",
    emoji: "🔬",
    type: "탄소중립포인트",
    typeBg: "bg-green-100 text-green-700",
    program: "탄소중립포인트 에너지",
    url: "https://cpoint.or.kr",
    desc: "환경부 탄소중립포인트 에너지 제도 참여.",
    incentives: ["전기·가스·수도 절감 → 연 최대 210,000원"],
    usage: ["현금", "상품권", "교통카드 충전"],
    note: "cpoint.or.kr에서 대전광역시 선택 후 가입",
  },
  {
    id: "ulsan",
    name: "울산광역시",
    emoji: "🏭",
    type: "탄소중립포인트",
    typeBg: "bg-green-100 text-green-700",
    program: "탄소중립포인트 에너지",
    url: "https://cpoint.or.kr",
    desc: "환경부 탄소중립포인트 에너지 제도 참여.",
    incentives: ["전기·가스·수도 절감 → 연 최대 210,000원"],
    usage: ["현금", "상품권", "종량제 봉투"],
    note: "cpoint.or.kr에서 울산광역시 선택 후 가입",
  },
  {
    id: "sejong",
    name: "세종특별자치시",
    emoji: "🏛️",
    type: "탄소중립포인트",
    typeBg: "bg-green-100 text-green-700",
    program: "탄소중립포인트 에너지",
    url: "https://cpoint.or.kr",
    desc: "환경부 탄소중립포인트 에너지 제도 참여.",
    incentives: ["전기·가스·수도 절감 → 연 최대 210,000원"],
    usage: ["현금", "상품권"],
    note: "cpoint.or.kr에서 세종특별자치시 선택 후 가입",
  },
  {
    id: "gyeonggi",
    name: "경기도",
    emoji: "🌾",
    type: "탄소중립포인트",
    typeBg: "bg-green-100 text-green-700",
    program: "탄소중립포인트 에너지",
    url: "https://cpoint.or.kr",
    desc: "전국 최대 인구의 경기도. 환경부 탄소중립포인트 에너지 제도 참여. 시/군별 추가 인센티브 운영 가능.",
    incentives: ["전기·가스·수도 절감 → 연 최대 210,000원", "시/군별 추가 인센티브 별도 제공 가능"],
    usage: ["현금", "상품권", "지역화폐", "종량제 봉투"],
    note: "경기도 내 거주 시/군 선택 후 가입 (수원시·성남시 등 별도 운영 가능)",
  },
  {
    id: "gangwon",
    name: "강원특별자치도",
    emoji: "⛰️",
    type: "탄소중립포인트",
    typeBg: "bg-green-100 text-green-700",
    program: "탄소중립포인트 에너지",
    url: "https://cpoint.or.kr",
    desc: "환경부 탄소중립포인트 에너지 제도 참여.",
    incentives: ["전기·가스·수도 절감 → 연 최대 210,000원"],
    usage: ["현금", "상품권", "종량제 봉투"],
    note: "cpoint.or.kr에서 강원특별자치도 선택 후 가입",
  },
  {
    id: "chungbuk",
    name: "충청북도",
    emoji: "🌲",
    type: "탄소중립포인트",
    typeBg: "bg-green-100 text-green-700",
    program: "탄소중립포인트 에너지",
    url: "https://cpoint.or.kr",
    desc: "환경부 탄소중립포인트 에너지 제도 참여.",
    incentives: ["전기·가스·수도 절감 → 연 최대 210,000원"],
    usage: ["현금", "상품권", "종량제 봉투"],
    note: "cpoint.or.kr에서 충청북도 선택 후 가입",
  },
  {
    id: "chungnam",
    name: "충청남도",
    emoji: "🌻",
    type: "탄소중립포인트",
    typeBg: "bg-green-100 text-green-700",
    program: "탄소중립포인트 에너지",
    url: "https://cpoint.or.kr",
    desc: "환경부 탄소중립포인트 에너지 제도 참여.",
    incentives: ["전기·가스·수도 절감 → 연 최대 210,000원"],
    usage: ["현금", "상품권", "지역사랑상품권"],
    note: "cpoint.or.kr에서 충청남도 선택 후 가입",
  },
  {
    id: "jeonbuk",
    name: "전북특별자치도",
    emoji: "🌾",
    type: "탄소중립포인트",
    typeBg: "bg-green-100 text-green-700",
    program: "탄소중립포인트 에너지",
    url: "https://cpoint.or.kr",
    desc: "환경부 탄소중립포인트 에너지 제도 참여.",
    incentives: ["전기·가스·수도 절감 → 연 최대 210,000원"],
    usage: ["현금", "상품권", "종량제 봉투"],
    note: "cpoint.or.kr에서 전북특별자치도 선택 후 가입",
  },
  {
    id: "jeonnam",
    name: "전라남도",
    emoji: "🎋",
    type: "탄소중립포인트",
    typeBg: "bg-green-100 text-green-700",
    program: "탄소중립포인트 에너지",
    url: "https://cpoint.or.kr",
    desc: "환경부 탄소중립포인트 에너지 제도 참여.",
    incentives: ["전기·가스·수도 절감 → 연 최대 210,000원"],
    usage: ["현금", "상품권", "전남사랑상품권"],
    note: "cpoint.or.kr에서 전라남도 선택 후 가입",
  },
  {
    id: "gyeongbuk",
    name: "경상북도",
    emoji: "🍑",
    type: "탄소중립포인트",
    typeBg: "bg-green-100 text-green-700",
    program: "탄소중립포인트 에너지",
    url: "https://cpoint.or.kr",
    desc: "환경부 탄소중립포인트 에너지 제도 참여.",
    incentives: ["전기·가스·수도 절감 → 연 최대 210,000원"],
    usage: ["현금", "상품권", "종량제 봉투"],
    note: "cpoint.or.kr에서 경상북도 선택 후 가입",
  },
  {
    id: "gyeongnam",
    name: "경상남도",
    emoji: "🌸",
    type: "탄소중립포인트",
    typeBg: "bg-green-100 text-green-700",
    program: "탄소중립포인트 에너지",
    url: "https://cpoint.or.kr",
    desc: "환경부 탄소중립포인트 에너지 제도 참여.",
    incentives: ["전기·가스·수도 절감 → 연 최대 210,000원"],
    usage: ["현금", "상품권", "경남사랑상품권"],
    note: "cpoint.or.kr에서 경상남도 선택 후 가입",
  },
  {
    id: "jeju",
    name: "제주특별자치도",
    emoji: "🍊",
    type: "탄소중립포인트",
    typeBg: "bg-green-100 text-green-700",
    program: "탄소중립포인트 에너지",
    url: "https://cpoint.or.kr",
    desc: "환경부 탄소중립포인트 에너지 제도 참여. 탄소 없는 섬 정책과 연계한 추가 환경 인센티브 운영.",
    incentives: ["전기·가스·수도 절감 → 연 최대 210,000원", "탄소없는 섬 정책 연계 추가 혜택 가능"],
    usage: ["현금", "상품권", "탐라사랑상품권"],
    note: "cpoint.or.kr에서 제주특별자치도 선택 후 가입",
  },
];

// ── 지역 카드 컴포넌트 ──────────────────────────────────
function RegionCard({ region }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3.5"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{region.emoji}</span>
          <div className="text-left">
            <p className="font-bold text-sm text-gray-800">{region.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${region.typeBg}`}>
                {region.type}
              </span>
              <span className="text-[10px] text-gray-400">{region.program}</span>
            </div>
          </div>
        </div>
        <span className="text-gray-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
          {/* 설명 */}
          <p className="text-xs text-gray-600 leading-relaxed">{region.desc}</p>

          {/* 인센티브 */}
          <div>
            <p className="text-[11px] font-bold text-gray-500 mb-1.5">💰 인센티브</p>
            <div className="space-y-1">
              {region.incentives.map((item, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span className="text-green-500 text-xs mt-0.5 flex-shrink-0">✓</span>
                  <p className="text-xs text-gray-600">{item}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 사용처 */}
          <div>
            <p className="text-[11px] font-bold text-gray-500 mb-1.5">🎁 인센티브 사용처</p>
            <div className="flex flex-wrap gap-1">
              {region.usage.map((u) => (
                <span key={u} className="bg-gray-100 text-gray-600 text-[10px] font-medium px-2 py-0.5 rounded-full">
                  {u}
                </span>
              ))}
            </div>
          </div>

          {/* 비고 */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2">
            <p className="text-[11px] text-yellow-700 leading-relaxed">💡 {region.note}</p>
          </div>

          {/* 바로가기 */}
          <a
            href={region.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-sky-500 to-cyan-500 active:opacity-80"
          >
            🔗 신청하기
          </a>
        </div>
      )}
    </div>
  );
}

// ── 메인 페이지 ─────────────────────────────────────────
export default function EcomileagePage() {
  const [search, setSearch] = useState("");

  const filtered = REGIONS.filter((r) =>
    r.name.includes(search) || r.program.includes(search)
  );

  return (
    <div
      className="min-h-screen bg-gray-50 overflow-y-auto"
      style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom, 20px))" }}
    >
      {/* ── 헤더 ── */}
      <div className="bg-gradient-to-br from-sky-500 to-cyan-600 px-4 pt-10 pb-8 text-white relative">
        <Link href="/" className="absolute top-4 left-4 text-white/80 text-sm flex items-center gap-1">
          ← 홈
        </Link>
        <span className="absolute top-4 right-4 text-7xl opacity-80">🏙️</span>
        <div className="relative mt-8">
          <h1 className="text-2xl font-black leading-tight">지자체별 에코마일리지</h1>
          <p className="text-sky-100 text-sm mt-1">전국 17개 시/도 에너지 절감 인센티브 안내</p>
        </div>
        <div className="flex justify-center gap-2 mt-4">
          <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">서울 독자운영 1곳</span>
          <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">탄소중립포인트 16곳</span>
        </div>
      </div>

      <div className="px-4 mt-4 space-y-3">

        {/* ── 제도 구조 안내 ── */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border-l-4 border-sky-400">
          <p className="text-xs font-bold text-sky-600 mb-1">📌 전국 에코마일리지 구조</p>
          <p className="text-sm text-gray-700 leading-relaxed">
            전국 에너지 절감 인센티브 제도는 크게 두 가지로 운영됩니다.
            <strong className="text-blue-600"> 서울시</strong>는 독자 에코마일리지를,
            <strong className="text-green-600"> 나머지 16개 시/도</strong>는 환경부 탄소중립포인트 에너지를 통해 참여합니다.
            <strong className="text-red-500"> 두 제도는 중복 가입이 불가</strong>하니 본인 거주지 기준으로 가입하세요.
          </p>
        </div>

        {/* ── 2가지 제도 비교 ── */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3">
            <p className="text-xs font-black text-blue-700 mb-1">🗼 서울시 에코마일리지</p>
            <p className="text-[10px] text-blue-600 leading-relaxed">서울 거주자 전용<br/>독자 시스템 운영<br/>ecomileage.seoul.go.kr</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-2xl p-3">
            <p className="text-xs font-black text-green-700 mb-1">🌍 탄소중립포인트 에너지</p>
            <p className="text-[10px] text-green-600 leading-relaxed">서울 외 16개 시/도<br/>환경부·한국환경공단 운영<br/>cpoint.or.kr</p>
          </div>
        </div>

        {/* ── 검색 ── */}
        <div className="relative">
          <input
            type="text"
            placeholder="🔍 지역명 검색 (예: 경기, 부산)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-sky-400 shadow-sm"
          />
        </div>

        {/* ── 안내 ── */}
        <p className="text-xs text-gray-400 text-center">▼ 지역을 탭하면 상세 내용 확인</p>

        {/* ── 지역 카드 목록 ── */}
        {filtered.length > 0
          ? filtered.map((region) => <RegionCard key={region.id} region={region} />)
          : (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm">검색 결과가 없습니다</p>
            </div>
          )
        }

        {/* ── 공통 안내 ── */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-600 mb-2">📋 공통 참여 안내</p>
          <div className="space-y-2">
            {[
              { icon: "1️⃣", text: "주민등록상 거주지 기준으로 하나의 제도만 가입 가능" },
              { icon: "2️⃣", text: "가입 후 에너지 사용량은 자동으로 수집·비교됨" },
              { icon: "3️⃣", text: "인센티브는 반기별 1회 지급 (상반기→10월, 하반기→4월)" },
              { icon: "4️⃣", text: "지자체별 인센티브 종류 다름 — 가입 시 원하는 방식 선택" },
              { icon: "5️⃣", text: "자동차·녹색생활 실천 프로그램과 중복 참여 가능" },
            ].map((item) => (
              <div key={item.icon} className="flex items-start gap-2">
                <span className="text-sm">{item.icon}</span>
                <p className="text-xs text-gray-600 leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── 탄소중립포인트 페이지 연결 ── */}
        <Link
          href="/carbon"
          className="flex items-center justify-between bg-gradient-to-r from-green-500 to-teal-500 rounded-2xl px-4 py-3.5 shadow-sm active:scale-95 transition-transform"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌍</span>
            <div>
              <p className="font-black text-sm text-white leading-tight">탄소중립포인트 전체 안내</p>
              <p className="text-xs text-green-100 mt-0.5">에너지·자동차·녹색생활·그린카드</p>
            </div>
          </div>
          <span className="text-white/70 text-lg">→</span>
        </Link>

      </div>
    </div>
  );
}
