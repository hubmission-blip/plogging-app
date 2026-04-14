"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ECOMILEAGE_PROGRAMS, ECOMILEAGE_BONUS_RATE } from "@/lib/pointCalc";
import Link from "next/link";

// ─── 에코마일리지 연동 컴포넌트 ──────────────────────────────
// 사용자가 에코마일리지/탄소중립포인트 회원임을 자기신고 방식으로 등록
// 연동 시 플로깅 포인트 20% 보너스 지급

export default function EcomileageConnect({ userId, linked, program, onUpdate }) {
  const [open,    setOpen]    = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [selected, setSelected] = useState(program || "");
  const [confirm, setConfirm] = useState(false); // 해제 확인 모달

  const bonusPct = Math.round(ECOMILEAGE_BONUS_RATE * 100);

  // ── 저장 ─────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", userId), {
        ecomileageLinked:    true,
        ecomileageProgram:   selected,
        ecomileageLinkedAt:  serverTimestamp(),
      });
      onUpdate?.({ ecomileageLinked: true, ecomileageProgram: selected });
      setOpen(false);
    } catch (e) {
      console.error("에코마일리지 연동 저장 실패:", e);
      alert("저장 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  // ── 연동 해제 ─────────────────────────────────────────────
  const handleDisconnect = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", userId), {
        ecomileageLinked:  false,
        ecomileageProgram: "",
      });
      onUpdate?.({ ecomileageLinked: false, ecomileageProgram: "" });
      setConfirm(false);
      setSelected("");
    } catch (e) {
      console.error("에코마일리지 연동 해제 실패:", e);
    } finally {
      setSaving(false);
    }
  };

  const currentProgram = ECOMILEAGE_PROGRAMS.find((p) => p.id === program);

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">

      {/* ── 헤더 버튼 ── */}
      <button
        className="w-full flex items-center justify-between px-4 py-4"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">🌿</span>
          <div className="text-left">
            <p className="text-sm font-bold text-gray-700">에코마일리지 연동</p>
            {linked && currentProgram ? (
              <p className="text-xs text-green-500 font-medium mt-0.5">
                ✅ {currentProgram.icon} {currentProgram.label} 연동됨 · +{bonusPct}% 보너스 적용 중
              </p>
            ) : (
              <p className="text-xs text-gray-400 mt-0.5">
                연동 시 플로깅 포인트 +{bonusPct}% 보너스
              </p>
            )}
          </div>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 14 14" fill="none"
          style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s" }}
        >
          <path d="M3 5l4 4 4-4" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* ── 펼침 내용 ── */}
      {open && (
        <div className="px-4 pb-4 border-t border-gray-50">

          {/* 안내 배너 */}
          <div className="bg-green-50 rounded-xl p-3 mt-3 mb-4">
            <p className="text-xs text-green-700 font-bold mb-1">
              🎁 에코마일리지 연동 혜택
            </p>
            <p className="text-xs text-green-600 leading-relaxed">
              에코마일리지·탄소중립포인트·그린카드 회원이시면 연동 등록 시
              플로깅 포인트가 <strong>+{bonusPct}%</strong> 추가 지급돼요.
            </p>
            <p className="text-[10px] text-green-500 mt-2">
              ※ 자기신고 방식 · 허위 등록 시 포인트가 회수될 수 있습니다
            </p>
          </div>

          {/* 프로그램 선택 */}
          <p className="text-xs font-bold text-gray-500 mb-2">참여 중인 프로그램 선택</p>
          <div className="space-y-2">
            {ECOMILEAGE_PROGRAMS.map((prog) => (
              <button
                key={prog.id}
                onClick={() => setSelected(prog.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border text-left transition-all
                  ${selected === prog.id
                    ? "border-green-400 bg-green-50"
                    : "border-gray-100 bg-gray-50 active:bg-gray-100"
                  }`}
              >
                <span className="text-xl">{prog.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold ${selected === prog.id ? "text-green-700" : "text-gray-700"}`}>
                    {prog.label}
                  </p>
                  <p className="text-xs text-gray-400">{prog.desc}</p>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0
                  ${selected === prog.id ? "border-green-500 bg-green-500" : "border-gray-300"}`}>
                  {selected === prog.id && (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-white rounded-full" />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* 더 알아보기 링크 */}
          <div className="flex gap-2 mt-3">
            <Link href="/carbon"
              className="flex-1 text-center text-xs text-green-600 bg-green-50 rounded-lg py-2 font-medium">
              탄소중립포인트 알아보기 →
            </Link>
            <Link href="/ecomileage"
              className="flex-1 text-center text-xs text-sky-600 bg-sky-50 rounded-lg py-2 font-medium">
              지자체 에코마일리지 →
            </Link>
          </div>

          {/* 버튼 영역 */}
          <div className="flex gap-2 mt-4">
            {linked && (
              <button
                onClick={() => setConfirm(true)}
                disabled={saving}
                className="flex-shrink-0 px-4 py-3 rounded-xl text-xs font-bold text-red-400 bg-red-50 active:bg-red-100"
              >
                연동 해제
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!selected || saving || (linked && selected === program)}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all
                ${selected && !(linked && selected === program)
                  ? "bg-green-500 text-white active:bg-green-600"
                  : "bg-gray-100 text-gray-400"
                }`}
            >
              {saving ? "저장 중…" : linked ? "변경 저장" : "연동 등록"}
            </button>
          </div>
        </div>
      )}

      {/* ── 해제 확인 모달 ── */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <p className="font-bold text-gray-800 text-center mb-2">에코마일리지 연동 해제</p>
            <p className="text-sm text-gray-500 text-center leading-relaxed mb-5">
              연동을 해제하면 다음 플로깅부터<br/>
              보너스 포인트 +{bonusPct}%가 적용되지 않아요.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-gray-100 text-sm font-bold text-gray-600"
              >
                취소
              </button>
              <button
                onClick={handleDisconnect}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-red-500 text-sm font-bold text-white"
              >
                {saving ? "처리 중…" : "해제하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
