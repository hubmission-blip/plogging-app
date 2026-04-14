"use client";

import { useState } from "react";
import Link from "next/link";

// ── 후원 계좌 정보 ─────────────────────────────────────────────
const ACCOUNTS = [
  { bank: "우리은행", number: "1005-504-709367", holder: "(사)국제청년환경연합회", color: "bg-blue-600", icon: "🔵" },
];

// ── 후원 금액 프리셋 ──────────────────────────────────────────
const AMOUNTS = [
  { label: "1,000원",  value: 1000,  desc: "커피 한 잔 대신" },
  { label: "5,000원",  value: 5000,  desc: "앱 서버 비용 일부" },
  { label: "10,000원", value: 10000, desc: "한 달 운영 응원" },
  { label: "30,000원", value: 30000, desc: "특별 후원자 배지" },
  { label: "50,000원", value: 50000, desc: "앱 개발비 지원" },
  { label: "직접입력", value: 0,     desc: "원하는 금액으로" },
];

// ── 후원자 혜택 ────────────────────────────────────────────────
const BENEFITS = [
  { icon: "🏅", title: "후원자 배지",     desc: "프로필에 특별 배지가 표시돼요" },
  { icon: "⭐", title: "포인트 보너스",   desc: "월 300P 추가 적립 (정기 후원자)" },
  { icon: "📢", title: "개발 참여",       desc: "신기능 우선 체험 및 의견 반영" },
  { icon: "💌", title: "감사 메시지",     desc: "후원자 명단에 이름을 올려드려요" },
];

// ── 프로젝트 현황 ──────────────────────────────────────────────
const PROJECT_STATS = [
  { icon: "🗓️", label: "서비스 시작",  value: "2025년" },
  { icon: "🌿", label: "환경 미션",    value: "쓰레기 줍기" },
  { icon: "💻", label: "운영 주체",    value: "GYEA·HubM" },
  { icon: "☁️", label: "서버 비용",    value: "월 약 5만원" },
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
      <div className="bg-gradient-to-b from-purple-600 to-indigo-600 px-4 pt-12 pb-8 text-white relative overflow-hidden">
        {/* 배경 장식 */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-10 translate-x-10" />
        <div className="absolute bottom-0 left-0 w-28 h-28 bg-white/5 rounded-full translate-y-8 -translate-x-8" />

        <Link href="/" className="flex items-center gap-1.5 text-purple-200 text-sm mb-6 relative">
          ← 홈으로
        </Link>

        <div className="relative">
          <p className="text-4xl mb-3">💜</p>
          <h1 className="text-2xl font-black leading-tight mb-2">
            오백원의 행복을<br />응원해주세요
          </h1>
          <p className="text-sm text-purple-200 leading-relaxed">
            플로깅으로 지구를 지키는 이 프로젝트는<br />
            여러분의 후원으로 계속될 수 있습니다
          </p>
        </div>
      </div>

      <div className="px-4 -mt-4 space-y-4">

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
              <div key={s.label} className="bg-purple-50 rounded-xl px-3 py-2.5">
                <p className="text-base">{s.icon}</p>
                <p className="text-xs text-purple-400 mt-0.5">{s.label}</p>
                <p className="text-sm font-bold text-purple-700">{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── 후원이 필요한 이유 ── */}
        <div className="bg-purple-50 rounded-2xl p-4">
          <p className="text-sm font-bold text-purple-700 mb-2">💡 후원금은 이렇게 쓰여요</p>
          <div className="space-y-2">
            {[
              { pct: 50, label: "서버·인프라 비용",  color: "bg-purple-500" },
              { pct: 25, label: "앱 기능 개발",      color: "bg-indigo-400" },
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
          <p className="text-sm font-bold text-gray-700 mb-3">🎁 후원자 혜택</p>
          <div className="grid grid-cols-2 gap-2">
            {BENEFITS.map((b) => (
              <div key={b.title} className="bg-gray-50 rounded-xl p-3">
                <p className="text-xl mb-1">{b.icon}</p>
                <p className="text-xs font-bold text-gray-700">{b.title}</p>
                <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 mt-3 text-center">
            ※ 혜택 적용은 입금 확인 후 1~3일 내 처리됩니다
          </p>
        </div>

        {/* ── 후원 금액 선택 ── */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-sm font-bold text-gray-700 mb-3">💰 후원 금액 선택</p>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {AMOUNTS.map((a) => (
              <button
                key={a.label}
                onClick={() => { setSelectedAmount(a); if (a.value !== 0) setCustomAmount(""); }}
                className={`rounded-xl py-2.5 px-1 text-center transition-all border
                  ${selectedAmount?.value === a.value && selectedAmount?.label === a.label
                    ? "bg-purple-500 text-white border-purple-500 shadow-sm"
                    : "bg-gray-50 text-gray-700 border-gray-100"}`}
              >
                <p className="text-xs font-bold">{a.label}</p>
                <p className="text-[10px] opacity-70 mt-0.5 leading-tight">{a.desc}</p>
              </button>
            ))}
          </div>

          {/* 직접 입력 */}
          {selectedAmount?.value === 0 && (
            <div className="flex items-center gap-2 bg-purple-50 rounded-xl px-3 py-2.5 mb-3">
              <input
                type="number"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="금액을 입력해주세요"
                className="flex-1 bg-transparent text-sm font-bold text-purple-700 outline-none placeholder:text-purple-300"
              />
              <span className="text-sm text-purple-500 font-bold">원</span>
            </div>
          )}

          {/* 선택된 금액 표시 */}
          {finalAmount > 0 && (
            <div className="bg-purple-50 rounded-xl px-4 py-3 text-center mb-1">
              <p className="text-xl font-black text-purple-600">
                {finalAmount.toLocaleString()}원
              </p>
              <p className="text-xs text-purple-400 mt-0.5">아래 계좌로 입금해주세요</p>
            </div>
          )}
        </div>

        {/* ── 계좌 정보 ── */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-sm font-bold text-gray-700 mb-3">🏦 후원 계좌</p>
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
                        ? "bg-purple-500 text-white"
                        : "bg-purple-100 text-purple-600"}`}
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
          <div className="mt-3 bg-purple-50 rounded-xl px-3 py-2.5 flex items-start gap-2">
            <span className="text-base mt-0.5">💡</span>
            <p className="text-[11px] text-purple-700 leading-relaxed">
              <strong>금액을 먼저 선택</strong>하고 복사 버튼을 누르면
              <strong> 계좌번호 + 예금주 + 후원금액</strong>이 한 번에 복사돼요.
              인터넷뱅킹 메모란에 그대로 붙여넣기 하시면 편리합니다.
            </p>
          </div>
          {/* 입금자명 안내 */}
          <div className="mt-2 bg-yellow-50 rounded-xl px-3 py-2.5 flex items-start gap-2">
            <span className="text-base mt-0.5">📝</span>
            <p className="text-[11px] text-yellow-700 leading-relaxed">
              입금 시 <strong>입금자명에 닉네임 또는 연락처</strong>를 남겨주시면 후원자 혜택 적용이 빨라져요.
              혜택 문의: <strong>hubmission@gmail.com</strong>
            </p>
          </div>
        </div>

        {/* ── 간편 후원 (토스·카카오페이) ── */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-sm font-bold text-gray-700 mb-1">📱 간편 후원</p>
          <p className="text-xs text-gray-400 mb-3">준비 중 · 곧 오픈 예정이에요</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 rounded-xl py-3 flex flex-col items-center gap-1.5 opacity-50">
              <span className="text-2xl">💙</span>
              <p className="text-xs font-bold text-gray-500">토스 (준비중)</p>
            </div>
            <div className="bg-gray-50 rounded-xl py-3 flex flex-col items-center gap-1.5 opacity-50">
              <span className="text-2xl">🟡</span>
              <p className="text-xs font-bold text-gray-500">카카오페이 (준비중)</p>
            </div>
          </div>
        </div>

        {/* ── 후원 완료 버튼 ── */}
        <button
          onClick={() => setShowThanks(true)}
          className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white py-4 rounded-2xl font-black text-base shadow-sm active:scale-95 transition-transform"
        >
          💜 입금했어요! (후원 완료 알림)
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
              <p className="text-5xl mb-3">💜</p>
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
                className="w-full bg-purple-500 text-white py-3 rounded-2xl font-bold text-sm"
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
