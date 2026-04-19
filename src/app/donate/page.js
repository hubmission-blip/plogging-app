"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Leaf, Monitor, Cloud, Lightbulb, Medal, Star, Megaphone, Mail, UserRound, Coins, Landmark, Info, PenLine } from "lucide-react";

// ── 후원 계좌 정보 ─────────────────────────────────────────────
const ACCOUNTS = [
  { bank: "우리은행", number: "1005-504-709367", holder: "(사)국제청년환경연합회", color: "bg-blue-600", icon: "🔵" },
];

// ── 후원 금액 프리셋 ──────────────────────────────────────────
const AMOUNTS = [
  { label: "500원",    value: 500 },
  { label: "5,000원",  value: 5000 },
  { label: "10,000원", value: 10000 },
  { label: "30,000원", value: 30000 },
  { label: "50,000원", value: 50000 },
  { label: "직접입력", value: 0 },
];

// ── 후원자 혜택 ────────────────────────────────────────────────
const BENEFITS = [
  { Icon: Medal,     title: "후원자 배지",     desc: "프로필에 특별 배지가\n표시돼요" },
  { Icon: Star,      title: "포인트 보너스",   desc: "월 300P 추가 적립\n(정기 후원자)" },
  { Icon: Megaphone, title: "개발 참여",       desc: "신기능 우선 체험 및\n의견 반영" },
  { Icon: Mail,      title: "감사 메시지",     desc: "후원자 명단에\n이름을 올려드려요" },
];

// ── 프로젝트 현황 ──────────────────────────────────────────────
const PROJECT_STATS = [
  { Icon: CalendarDays, label: "서비스 시작",  value: "2025년" },
  { Icon: Leaf,         label: "환경 미션",    value: "쓰레기 줍기" },
  { Icon: Monitor,      label: "운영 주체",    value: "GYEA·HubM" },
  { Icon: Cloud,        label: "서버 비용",    value: "월 약 5만원" },
];

export default function DonatePage() {
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [customAmount,   setCustomAmount]   = useState("");
  const [copiedBank,     setCopiedBank]     = useState(null);
  const [showThanks,     setShowThanks]     = useState(false);

  const finalAmount = selectedAmount?.value === 0
    ? parseInt(customAmount.replace(/,/g, ""), 10) || 0
    : selectedAmount?.value || 0;

  const handleCopy = async (account) => {
    // 금액이 선택된 경우 계좌 + 금액 + 예금주 통합 복사
    const copyText = finalAmount > 0
      ? `${account.bank} ${account.number}\n예금주: ${account.holder}\n후원금액: ${finalAmount.toLocaleString()}원`
      : `${account.bank} ${account.number}\n예금주: ${account.holder}`;
    try {
      await navigator.clipboard.writeText(copyText);
      setCopiedBank(account.bank);
      setTimeout(() => setCopiedBank(null), 2500);
    } catch {
      alert(copyText);
    }
  };

  return (
    <div
      className="min-h-screen bg-gray-50"
      style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom, 20px))" }}
    >
      {/* ── 헤더 ── */}
      <div className="bg-gradient-to-b from-orange-400 to-orange-500 px-4 pt-12 pb-8 text-white relative overflow-hidden">
        {/* 배경 장식 */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-10 translate-x-10" />
        <div className="absolute bottom-0 left-0 w-28 h-28 bg-white/5 rounded-full translate-y-8 -translate-x-8" />

        <Link href="/" className="flex items-center gap-1.5 text-orange-100 text-sm mb-6 relative">
          ← 홈으로
        </Link>

        <span className="absolute top-4 right-4 text-7xl opacity-80">🧡</span>
        <div className="relative mt-8">
          <h1 className="text-2xl font-black leading-tight mb-2">
            오백원의 행복을<br />응원해주세요
          </h1>
          <p className="text-sm text-orange-100 leading-relaxed">
            플로깅으로 지구를 지키는 이 프로젝트는<br />
            여러분의 후원으로 계속될 수 있습니다
          </p>
        </div>
      </div>

      <div className="px-4 mt-2 space-y-4">

        {/* ── 프로젝트 소개 카드 ── */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-sm font-bold text-gray-700 mb-3">🌿 오백원의 행복이란?</p>
          <p className="text-sm text-gray-600 leading-relaxed">
            <strong className="text-green-600">플로깅(Plogging)</strong>이란 조깅하며 쓰레기를 줍는 환경 운동이에요.
            오백원의 행복은 이 작은 실천을 앱으로 기록하고,
            포인트로 보상하며, 더 많은 사람들이 환경 보호에 동참하도록 돕는 서비스입니다.
          </p>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {PROJECT_STATS.map((s) => (
              <div key={s.label} className="bg-orange-50 rounded-xl px-3 py-2.5">
                <s.Icon className="w-5 h-5 text-orange-500" strokeWidth={1.8} />
                <p className="text-xs text-orange-400 mt-0.5">{s.label}</p>
                <p className="text-sm font-bold text-orange-700">{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── 후원이 필요한 이유 ── */}
        <div className="bg-orange-50 rounded-2xl p-4">
          <p className="text-sm font-bold text-orange-700 mb-2 flex items-center gap-1.5"><Lightbulb className="w-4 h-4" strokeWidth={2} /> 후원금은 이렇게 쓰여요</p>
          <div className="space-y-2">
            {[
              { pct: 50, label: "서버·인프라 비용",  color: "bg-orange-500" },
              { pct: 25, label: "앱 기능 개발",      color: "bg-amber-400" },
              { pct: 15, label: "환경 단체 기부",    color: "bg-green-500"  },
              { pct: 10, label: "운영·홍보",         color: "bg-blue-400"   },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-gray-600">{item.label}</span>
                  <span className="text-xs font-bold text-gray-700">{item.pct}%</span>
                </div>
                <div className="h-2 bg-white rounded-full overflow-hidden">
                  <div
                    className={`h-full ${item.color} rounded-full`}
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 후원자 혜택 ── */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5"><UserRound className="w-4 h-4 text-gray-600" strokeWidth={2} /> 후원자 혜택</p>
          <div className="grid grid-cols-2 gap-2">
            {BENEFITS.map((b) => (
              <div key={b.title} className="bg-gray-50 rounded-xl p-3 flex items-start gap-2.5">
                <b.Icon className="w-8 h-8 text-orange-500 flex-shrink-0" strokeWidth={1.6} />
                <div className="flex-1 text-right">
                  <p className="text-xs font-bold text-gray-700">{b.title}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed whitespace-pre-line">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 mt-3 text-center">
            ※ 혜택 적용은 입금 확인 후 1~3일 내 처리됩니다
          </p>
        </div>

        {/* ── 후원 금액 선택 ── */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5"><Coins className="w-4 h-4 text-gray-600" strokeWidth={2} /> 후원 금액 선택</p>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {AMOUNTS.map((a) => (
              <button
                key={a.label}
                onClick={() => { setSelectedAmount(a); if (a.value !== 0) setCustomAmount(""); }}
                className={`rounded-xl py-2.5 px-1 text-center transition-all border
                  ${selectedAmount?.value === a.value && selectedAmount?.label === a.label
                    ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                    : "bg-gray-50 text-gray-700 border-gray-100"}`}
              >
                <p className="text-sm font-black">{a.label}</p>
              </button>
            ))}
          </div>

          {/* 직접 입력 */}
          {selectedAmount?.value === 0 && (
            <div className="flex items-center gap-2 bg-orange-50 rounded-xl px-3 py-2.5 mb-3">
              <input
                type="number"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="금액을 입력해주세요"
                className="flex-1 bg-transparent text-sm font-bold text-orange-700 outline-none placeholder:text-orange-300"
              />
              <span className="text-sm text-orange-500 font-bold">원</span>
            </div>
          )}

          {/* 선택된 금액 표시 */}
          {finalAmount > 0 && (
            <div className="bg-orange-50 rounded-xl px-4 py-3 text-center mb-1">
              <p className="text-xl font-black text-orange-600">
                {finalAmount.toLocaleString()}원
              </p>
              <p className="text-xs text-orange-400 mt-0.5">아래 계좌로 입금해주세요</p>
            </div>
          )}
        </div>

        {/* ── 계좌 정보 ── */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5"><Landmark className="w-4 h-4 text-gray-600" strokeWidth={2} /> 후원 계좌</p>
          <div className="space-y-2">
            {ACCOUNTS.map((acc) => (
              <div
                key={acc.bank}
                className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3"
              >
                <div className={`w-9 h-9 ${acc.color} rounded-full flex items-center justify-center text-white font-black text-xs flex-shrink-0`}>
                  {acc.bank.slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400">{acc.bank}</p>
                  <p className="text-sm font-black text-gray-800">{acc.number}</p>
                  <p className="text-[11px] text-gray-400">{acc.holder}</p>
                </div>
                <button
                  onClick={() => handleCopy(acc)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                    ${copiedBank === acc.bank
                      ? "bg-green-500 text-white"
                      : finalAmount > 0
                        ? "bg-orange-500 text-white"
                        : "bg-orange-100 text-orange-600"}`}
                >
                  {copiedBank === acc.bank
                    ? "✓ 복사됨"
                    : finalAmount > 0
                      ? `${finalAmount.toLocaleString()}원 복사`
                      : "계좌 복사"}
                </button>
              </div>
            ))}
          </div>

          {/* 복사 안내 */}
          <div className="mt-3 bg-orange-50 rounded-xl px-3 py-2.5 flex items-start gap-2">
            <Info className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" strokeWidth={2} />
            <p className="text-[11px] text-orange-700 leading-relaxed">
              <strong>금액을 먼저 선택</strong>하고 복사 버튼을 누르면
              <strong> 계좌번호 + 예금주 + 후원금액</strong>이 한 번에 복사돼요.
              인터넷뱅킹 메모란에 그대로 붙여넣기 하시면 편리합니다.
            </p>
          </div>
          {/* 입금자명 안내 */}
          <div className="mt-2 bg-yellow-50 rounded-xl px-3 py-2.5 flex items-start gap-2">
            <PenLine className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" strokeWidth={2} />
            <p className="text-[11px] text-yellow-700 leading-relaxed">
              입금 시 <strong>입금자명에 닉네임 또는 연락처</strong>를 남겨주시면 후원자 혜택 적용이 빨라져요.
              혜택 문의: <strong>hubmission@gmail.com</strong>
            </p>
          </div>
        </div>

        {/* ── 후원 완료 버튼 ── */}
        <button
          onClick={() => setShowThanks(true)}
          className="w-full bg-gradient-to-r from-orange-400 to-orange-500 text-white py-4 rounded-2xl font-black text-base shadow-sm active:scale-95 transition-transform"
        >
          🧡 입금했어요! (후원 완료 알림)
        </button>

        {/* ── 감사 메시지 모달 ── */}
        {showThanks && (
          <div
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-6"
            onClick={() => setShowThanks(false)}
          >
            <div
              className="bg-white rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-5xl mb-3">🧡</p>
              <h2 className="text-lg font-black text-gray-800 mb-2">감사합니다!</h2>
              <p className="text-sm text-gray-500 leading-relaxed mb-4">
                후원해 주셔서 진심으로 감사드립니다.<br />
                입금 확인 후 1~3일 내에 혜택이 적용됩니다.<br />
                문의: <strong>hubmission@gmail.com</strong>
              </p>
              <p className="text-xs text-gray-400 mb-4">
                오백원의 행복은 여러분의 응원 덕분에 계속됩니다 🌿
              </p>
              <button
                onClick={() => setShowThanks(false)}
                className="w-full bg-orange-500 text-white py-3 rounded-2xl font-bold text-sm"
              >
                확인
              </button>
            </div>
          </div>
        )}

        {/* ── 푸터 ── */}
        <div className="text-center py-2 space-y-1">
          <p className="text-xs text-gray-400">사단법인 국제청년환경연합회 (GYEA)</p>
          <p className="text-xs text-gray-300">hubmission@gmail.com</p>
        </div>
      </div>
    </div>
  );
}
