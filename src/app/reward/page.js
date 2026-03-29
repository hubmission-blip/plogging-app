"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  doc, getDoc, updateDoc, addDoc,
  collection, serverTimestamp, runTransaction
} from "firebase/firestore";

// ─── 리워드 아이템 목록 ────────────────────────────────────
const REWARDS = [
  {
    id: "bag_1000",
    category: "환경",
    icon: "🛍️",
    title: "종량제 봉투 500원권",
    desc: "20리터 종량제 쓰레기봉투 구매 지원",
    cost: 1000,
    stock: 99,
    badge: "대표 리워드",
    badgeColor: "bg-green-100 text-green-700",
  },
  {
    id: "coffee_2000",
    category: "음료",
    icon: "☕",
    title: "커피 쿠폰 2,000P",
    desc: "파트너 카페 아메리카노 1잔 교환권",
    cost: 2000,
    stock: 30,
    badge: "인기",
    badgeColor: "bg-orange-100 text-orange-700",
  },
  {
    id: "eco_bag",
    category: "환경",
    icon: "👜",
    title: "에코백 교환권",
    desc: "GYEA 공식 에코백 (로고 인쇄)",
    cost: 3000,
    stock: 20,
    badge: "한정",
    badgeColor: "bg-purple-100 text-purple-700",
  },
  {
    id: "donate_forest",
    category: "기부",
    icon: "🌲",
    title: "나무 한 그루 심기",
    desc: "파트너 기관에 나무 식수 기부",
    cost: 1000,
    stock: 999,
    badge: null,
    badgeColor: "",
  },
  {
    id: "donate_ocean",
    category: "기부",
    icon: "🌊",
    title: "해양 정화 기부",
    desc: "해양 쓰레기 수거 캠페인 후원",
    cost: 500,
    stock: 999,
    badge: null,
    badgeColor: "",
  },
  {
    id: "bonus_points",
    category: "포인트",
    icon: "⚡",
    title: "포인트 2배 부스터",
    desc: "다음 1회 플로깅 포인트 2배 적용",
    cost: 1000,
    stock: 50,
    badge: "NEW",
    badgeColor: "bg-blue-100 text-blue-700",
  },
    {
    id: "donate_product",
    category: "환경",
    icon: "📟️",
    title: "교정밴드 교환권",
    desc: "지능형, 교정밴드를 드립니다(소진시까지)",
    cost: 1000,
    stock: 999,
    badge: null,
    badgeColor: "",
  },
  {
    id: "donate_dokdo",
    category: "기부",
    icon: "🐟",
    title: "독도 프로젝트 기부",
    desc: "독도,수중정화 & 플로깅 프로젝트 후원",
    cost: 500,
    stock: 50,
    badge: "NEW",
    badgeColor: "bg-blue-100 text-blue-700",
  },
      {
    id: "donate_photo",
    category: "환경",
    icon: "📷",
    title: "가족사진 촬영권",
    desc: "GYEA 스튜디오에서 촬영가능",
    cost: 5000,
    stock: 999,
    badge: null,
    badgeColor: "",
  },
  {
    id: "bonus_painting",
    category: "기부",
    icon: "🪙",
    title: "오백원의 행복 기부",
    desc: "오백원의 행복 플로깅 프로젝트 후원",
    cost: 500,
    stock: 50,
    badge: "NEW",
    badgeColor: "bg-blue-100 text-blue-700",
  },
];

const CATEGORIES = ["전체", "환경", "음료", "기부", "포인트"];

export default function RewardPage() {
  const { user } = useAuth();
  const router   = useRouter();

  const [myPoints, setMyPoints]       = useState(0);
  const [category, setCategory]       = useState("전체");
  const [selectedItem, setSelectedItem] = useState(null);
  const [confirming, setConfirming]   = useState(false);
  const [loading, setLoading]         = useState(true);
  const [exchanging, setExchanging]   = useState(false);
  const [successMsg, setSuccessMsg]   = useState("");

  // ── 내 포인트 조회 ────────────────────────────────────────
  const fetchPoints = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        setMyPoints(snap.data().totalPoints || 0);
      }
    } catch (e) {
      console.error("포인트 로드 실패:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    fetchPoints();
  }, [user, fetchPoints, router]);

  // ── 교환 실행 ─────────────────────────────────────────────
  const handleExchange = async () => {
    if (!user || !selectedItem) return;
    if (myPoints < selectedItem.cost) return;
    setExchanging(true);
    try {
      await runTransaction(db, async (tx) => {
        const userRef  = doc(db, "users", user.uid);
        const userSnap = await tx.get(userRef);
        const current  = userSnap.data()?.totalPoints || 0;
        if (current < selectedItem.cost) throw new Error("포인트 부족");
        tx.update(userRef, { totalPoints: current - selectedItem.cost });
      });

      // 교환 내역 기록
      await addDoc(collection(db, "reward_history"), {
        userId:    user.uid,
        rewardId:  selectedItem.id,
        rewardTitle: selectedItem.title,
        cost:      selectedItem.cost,
        createdAt: serverTimestamp(),
        status:    "pending", // 관리자 처리 대기
      });

      setMyPoints((prev) => prev - selectedItem.cost);
      setConfirming(false);
      setSelectedItem(null);
      setSuccessMsg(`🎉 "${selectedItem.title}" 교환 신청 완료! 3~5 영업일 내 처리됩니다.`);
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (e) {
      alert("교환 실패: " + e.message);
    } finally {
      setExchanging(false);
    }
  };

  const filtered = category === "전체"
    ? REWARDS
    : REWARDS.filter((r) => r.category === category);

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <p className="animate-pulse text-lg">🎁 리워드 불러오는 중...</p>
    </div>
  );

  return (
    <div
      className="min-h-screen bg-gray-50"
      style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom, 20px))" }}
    >
      {/* ── 헤더 ── */}
      <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 pt-8 pb-5">
        <h1 className="text-xl font-bold mb-0.5">🎁 포인트 교환</h1>
        <p className="text-yellow-100 text-sm mb-3">모은 포인트로 리워드를 받아보세요</p>
        <div className="bg-white/20 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-yellow-100 text-xs">내 보유 포인트</p>
            <p className="text-3xl font-black">{myPoints.toLocaleString()} P</p>
          </div>
          <div className="text-4xl">💰</div>
        </div>
      </div>

      {/* ── 성공 메시지 ── */}
      {successMsg && (
        <div className="mx-4 mt-4 bg-green-50 border border-green-200 rounded-xl p-3">
          <p className="text-green-700 text-sm font-medium">{successMsg}</p>
        </div>
      )}

      {/* ── 카테고리 탭 ── */}
      <div className="flex gap-2 px-4 mt-4 overflow-x-auto pb-1 no-scrollbar">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors
              ${category === cat
                ? "bg-orange-500 text-white border-orange-500"
                : "bg-white text-gray-500 border-gray-200"
              }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── 리워드 목록 ── */}
      <div className="grid grid-cols-2 gap-3 px-4 mt-4">
        {filtered.map((item) => {
          const canAfford = myPoints >= item.cost;
          return (
            <button
              key={item.id}
              onClick={() => { setSelectedItem(item); setConfirming(true); }}
              disabled={!canAfford}
              className={`bg-white rounded-2xl p-4 shadow-sm text-left relative overflow-hidden
                active:scale-95 transition-transform
                ${!canAfford ? "opacity-50" : ""}`}
            >
              {/* 뱃지 */}
              {item.badge && (
                <span className={`absolute top-2 right-2 text-xs font-bold px-2 py-0.5 rounded-full ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}

              <div className="text-3xl mb-2">{item.icon}</div>
              <p className="font-bold text-gray-800 text-sm leading-tight">{item.title}</p>
              <p className="text-xs text-gray-400 mt-1 leading-snug">{item.desc}</p>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-orange-500 font-black text-base">
                  {item.cost.toLocaleString()}P
                </span>
                {!canAfford && (
                  <span className="text-xs text-gray-300">포인트 부족</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── 포인트 적립 안내 ── */}
      <div className="mx-4 mt-4 bg-white rounded-2xl p-4 shadow-sm">
        <h2 className="font-bold text-gray-700 mb-2">💡 포인트 적립 방법</h2>
        {[
          { label: "1km 플로깅 완료", point: "+50P" },
          { label: "2km 이상 완주",   point: "+100P 보너스" },
          { label: "그룹 플로깅 참여", point: "+인원 × 5P" },
        ].map((item) => (
          <div key={item.label} className="flex justify-between text-sm py-1.5 border-b last:border-0">
            <span className="text-gray-600">{item.label}</span>
            <span className="font-bold text-green-600">{item.point}</span>
          </div>
        ))}
      </div>

      {/* ── 교환 확인 모달 ── */}
      {confirming && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50 p-4">
          <div className="bg-white w-full rounded-3xl p-6 shadow-2xl">
            <div className="text-center mb-4">
              <div className="text-5xl mb-2">{selectedItem.icon}</div>
              <h2 className="text-lg font-bold text-gray-800">{selectedItem.title}</h2>
              <p className="text-sm text-gray-500 mt-1">{selectedItem.desc}</p>
            </div>

            <div className="bg-orange-50 rounded-xl p-4 mb-4 text-center">
              <p className="text-sm text-gray-500">교환 비용</p>
              <p className="text-3xl font-black text-orange-500">{selectedItem.cost.toLocaleString()} P</p>
              <p className="text-xs text-gray-400 mt-1">
                교환 후 잔여: {(myPoints - selectedItem.cost).toLocaleString()} P
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setConfirming(false); setSelectedItem(null); }}
                className="flex-1 bg-gray-100 text-gray-600 py-4 rounded-2xl font-bold"
              >
                취소
              </button>
              <button
                onClick={handleExchange}
                disabled={exchanging}
                className="flex-1 bg-orange-500 text-white py-4 rounded-2xl font-bold"
              >
                {exchanging ? "처리 중..." : "교환 신청"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}