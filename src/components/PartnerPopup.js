"use client";

import { useState } from "react";

// ─── 파트너 상점/기관 목록 ───────────────────────────────────
// 실제 파트너 추가 시 여기에 데이터 추가
const PARTNERS = [
  {
    id: 1,
    category: "환경",
    icon: "🌿",
    name: "감탄소",
    desc: "탄소 절감 인증 및 에코 포인트 파트너",
    benefit: "플로깅 인증 시 탄소 크레딧 추가 적립",
    contact: "https://example.com",
    badge: "공식 파트너",
    badgeColor: "bg-green-100 text-green-700",
  },
  {
    id: 2,
    category: "환경",
    icon: "♻️",
    name: "큐엠씨코리아",
    desc: "친환경 소재 제조 및 에코 리워드 파트너사",
    benefit: "에코백·친환경 제품 포인트 교환 가능",
    contact: "https://example.com",
    badge: "공식 파트너",
    badgeColor: "bg-green-100 text-green-700",
  },
  {
    id: 3,
    category: "카페",
    icon: "☕",
    name: "그린카페 (예시)",
    desc: "친환경 텀블러 할인 제공 파트너 카페",
    benefit: "1000P 교환 시 아메리카노 1잔 무료",
    contact: null,
    badge: "리워드",
    badgeColor: "bg-orange-100 text-orange-700",
  },
  {
    id: 4,
    category: "기관",
    icon: "🏛️",
    name: "국제청년환경연합회 (GYEA)",
    desc: "사단법인 국제청년환경연합회 공식 운영",
    benefit: "환경 캠페인 참여 기회 제공",
    contact: "mailto:hubmission@gmail.com",
    badge: "운영기관",
    badgeColor: "bg-blue-100 text-blue-700",
  },
  {
    id: 5,
    category: "기관",
    icon: "🌊",
    name: "해양 정화 캠페인단 (예시)",
    desc: "해양 쓰레기 수거 전문 NGO",
    benefit: "포인트 기부 시 해양 정화 활동 지원",
    contact: null,
    badge: "기부처",
    badgeColor: "bg-cyan-100 text-cyan-700",
  },
];

const CATEGORIES = ["전체", "환경", "카페", "기관"];

// ─── 파트너 신청 모달 ─────────────────────────────────────
function ApplyModal({ onClose }) {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", contact: "", desc: "" });

  const handleSubmit = (e) => {
    e.preventDefault();
    // 실제 구현 시: Firestore partner_requests 컬렉션에 저장
    console.log("파트너 신청:", form);
    setSent(true);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50 p-4">
      <div className="bg-white w-full rounded-3xl p-6 shadow-2xl">
        {sent ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-3">✅</div>
            <h2 className="font-bold text-gray-800 text-lg">신청 완료!</h2>
            <p className="text-sm text-gray-500 mt-1 mb-4">
              검토 후 3~5 영업일 이내 연락드릴게요.
            </p>
            <button onClick={onClose} className="w-full bg-green-500 text-white py-3 rounded-2xl font-bold">
              확인
            </button>
          </div>
        ) : (
          <>
            <h2 className="font-bold text-gray-800 text-lg mb-1">파트너 신청</h2>
            <p className="text-sm text-gray-400 mb-4">
              오백원의 행복과 함께할 파트너를 모집합니다!
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                required
                placeholder="기업/기관명"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm"
              />
              <input
                required
                placeholder="연락처 (이메일 또는 전화번호)"
                value={form.contact}
                onChange={(e) => setForm((p) => ({ ...p, contact: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm"
              />
              <textarea
                placeholder="협업 희망 내용을 간단히 설명해주세요"
                value={form.desc}
                onChange={(e) => setForm((p) => ({ ...p, desc: e.target.value }))}
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none"
              />
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={onClose}
                  className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-2xl font-bold">
                  취소
                </button>
                <button type="submit"
                  className="flex-1 bg-green-500 text-white py-3 rounded-2xl font-bold">
                  신청하기
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────
export default function PartnerPopup() {
  const [category, setCategory] = useState("전체");
  const [selected, setSelected] = useState(null);
  const [applyOpen, setApplyOpen] = useState(false);

  const filtered = category === "전체"
    ? PARTNERS
    : PARTNERS.filter((p) => p.category === category);

  return (
    <>
      <div className="space-y-3">
        {/* ── 카테고리 필터 ── */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors
                ${category === cat
                  ? "bg-green-500 text-white border-green-500"
                  : "bg-white text-gray-500 border-gray-200"
                }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* ── 파트너 카드 목록 ── */}
        {filtered.map((partner) => (
          <button
            key={partner.id}
            onClick={() => setSelected(partner)}
            className="w-full bg-white rounded-2xl p-4 shadow-sm text-left flex items-center gap-3 active:scale-98 transition-transform"
          >
            <div className="text-3xl w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center flex-shrink-0">
              {partner.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="font-bold text-gray-800 text-sm">{partner.name}</p>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${partner.badgeColor}`}>
                  {partner.badge}
                </span>
              </div>
              <p className="text-xs text-gray-400 truncate">{partner.desc}</p>
              <p className="text-xs text-green-600 mt-0.5 font-medium">🎁 {partner.benefit}</p>
            </div>
            <span className="text-gray-300 text-lg flex-shrink-0">›</span>
          </button>
        ))}

        {/* ── 파트너 신청 버튼 ── */}
        <button
          onClick={() => setApplyOpen(true)}
          className="w-full border-2 border-dashed border-green-300 rounded-2xl py-4 text-green-500 font-medium text-sm"
        >
          + 파트너 신청하기
        </button>
      </div>

      {/* ── 파트너 상세 팝업 ── */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50 p-4">
          <div className="bg-white w-full rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-4xl w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center">
                {selected.icon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-gray-800 text-lg">{selected.name}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${selected.badgeColor}`}>
                    {selected.badge}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{selected.category}</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-3">{selected.desc}</p>

            <div className="bg-green-50 rounded-xl p-3 mb-4">
              <p className="text-xs text-gray-500 mb-0.5">파트너 혜택</p>
              <p className="text-sm font-medium text-green-700">🎁 {selected.benefit}</p>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setSelected(null)}
                className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-2xl font-bold">
                닫기
              </button>
              {selected.contact && (
                <a
                  href={selected.contact}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-green-500 text-white py-3 rounded-2xl font-bold text-center"
                >
                  바로가기 →
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 파트너 신청 모달 ── */}
      {applyOpen && <ApplyModal onClose={() => setApplyOpen(false)} />}
    </>
  );
}