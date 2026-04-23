"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  doc, getDoc, updateDoc, addDoc,
  collection, serverTimestamp, runTransaction
} from "firebase/firestore";
import {
  Coins, Target, Zap, ChevronDown, Gift,
  HeartHandshake, Trash2, Coffee, ShoppingBag, TreePine,
  Waves, Bolt, Watch, Fish, Camera, CircleDollarSign,
} from "lucide-react";

// ─── 리워드 아이템 목록 ────────────────────────────────────
const REWARDS = [
  {
    id: "donate_gia",
    category: "기부",
    Icon: HeartHandshake, iconColor: "text-green-600", iconBg: "bg-green-100",
    title: "기아대책 후원",
    desc: "온마을 프로젝트 — 소외된 이웃을 위한 기부",
    cost: 1000,
    stock: 999,
    badge: "추천",
    badgeColor: "bg-red-100 text-red-600",
  },
  {
    id: "bag_1000",
    category: "환경",
    Icon: Trash2, iconColor: "text-emerald-600", iconBg: "bg-emerald-100",
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
    Icon: Coffee, iconColor: "text-orange-600", iconBg: "bg-orange-100",
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
    Icon: ShoppingBag, iconColor: "text-purple-600", iconBg: "bg-purple-100",
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
    Icon: TreePine, iconColor: "text-green-700", iconBg: "bg-green-100",
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
    Icon: Waves, iconColor: "text-sky-600", iconBg: "bg-sky-100",
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
    Icon: Bolt, iconColor: "text-blue-600", iconBg: "bg-blue-100",
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
    Icon: Watch, iconColor: "text-indigo-600", iconBg: "bg-indigo-100",
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
    Icon: Fish, iconColor: "text-cyan-600", iconBg: "bg-cyan-100",
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
    Icon: Camera, iconColor: "text-rose-600", iconBg: "bg-rose-100",
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
    Icon: CircleDollarSign, iconColor: "text-amber-600", iconBg: "bg-amber-100",
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
  const [myName,   setMyName]         = useState("");
  const [category, setCategory]       = useState("전체");
  const [selectedItem, setSelectedItem] = useState(null);
  const [confirming, setConfirming]   = useState(false);
  const [loading, setLoading]         = useState(true);
  const [exchanging, setExchanging]   = useState(false);
  const [successMsg, setSuccessMsg]   = useState("");
  const [pointAccordion, setPointAccordion] = useState(false);

  // ── 내 포인트 조회 ────────────────────────────────────────
  const fetchPoints = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        setMyPoints(snap.data().totalPoints || 0);
        setMyName(snap.data().displayName || snap.data().name || user.displayName || "");
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
        userId:      user.uid,
        userName:    myName || user.displayName || "",
        rewardId:    selectedItem.id,
        rewardTitle: selectedItem.title,
        cost:        selectedItem.cost,
        createdAt:   serverTimestamp(),
        status:      "pending", // 관리자 처리 대기
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
      <p className="animate-pulse text-lg flex items-center gap-2 text-gray-500"><Gift className="w-5 h-5 text-purple-500" strokeWidth={2} /> 리워드 불러오는 중...</p>
    </div>
  );

  return (
    <div
      className="min-h-screen bg-gray-50"
      style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom, 20px))" }}
    >
      {/* ── 헤더 ── */}
      <div className="bg-gray-50 px-4 pt-4 pb-1 flex justify-between items-center">
        <Link href="/">
          <img
            src="https://res.cloudinary.com/dqlvm572h/image/upload/w_200,q_auto,f_auto/Intro_Logo_fuj1kt.png"
            alt="오백원의 행복"
            className="h-9 w-auto object-contain"
          />
        </Link>
        <p className="text-sm font-black text-gray-700 flex items-center gap-1"><Gift className="w-4 h-4" strokeWidth={1.8} /> 포인트 교환</p>
      </div>

      {/* ── 내 보유 포인트 카드 ── */}
      <div className="px-4 pt-3 pb-1">
        <div className="bg-gradient-to-r from-purple-500 to-indigo-500 rounded-2xl px-4 py-3 flex items-center justify-between text-white shadow-sm">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-purple-200" strokeWidth={2} />
            <div className="text-left">
              <p className="text-[10px] text-purple-200 leading-none mb-0.5">내 보유 포인트</p>
              <p className="text-sm font-black text-white">
                {loading ? "···" : `${myPoints.toLocaleString()} P`}
              </p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-white/25 text-white ml-1">
              리워드 교환 가능
            </span>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-purple-200 leading-none mb-0.5">교환 기준</p>
            <p className="text-xs font-bold text-white">1,000P ~</p>
          </div>
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
                ? "bg-purple-500 text-white border-purple-500"
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

              <div className={`w-12 h-12 rounded-xl ${item.iconBg} flex items-center justify-center mb-2`}>
                <item.Icon size={24} className={item.iconColor} strokeWidth={1.8} />
              </div>
              <p className="font-bold text-gray-800 text-sm leading-tight">{item.title}</p>
              <p className="text-xs text-gray-400 mt-1 leading-snug">{item.desc}</p>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-purple-500 font-black text-base">
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

      {/* ── 포인트 적립 기준 (아코디언) ── */}
      <div className="mx-4 mt-4 rounded-2xl shadow-sm overflow-hidden" style={{ backgroundColor: "#8dc63f1a", border: "1px solid #8dc63f40" }}>
        <button
          onClick={() => setPointAccordion(!pointAccordion)}
          className="w-full flex justify-between items-center p-4"
        >
          <div className="flex items-center gap-1.5">
            <Coins className="w-4 h-4" strokeWidth={1.8} style={{ color: "#8dc63f" }} />
            <Target className="w-4 h-4" strokeWidth={1.8} style={{ color: "#8dc63f" }} />
            <Zap className="w-4 h-4" strokeWidth={1.8} style={{ color: "#8dc63f" }} />
          </div>
          <div className="flex items-center gap-2">
            <h2 className="font-black text-sm text-gray-700">포인트 적립 기준</h2>
            <ChevronDown
              className="w-4 h-4 text-gray-500 transition-transform duration-300"
              style={{ transform: pointAccordion ? "rotate(180deg)" : "rotate(0deg)" }}
              strokeWidth={2}
            />
          </div>
        </button>
        {pointAccordion && (
          <div className="px-4 pb-4 space-y-2">
            <p className="text-[10px] font-bold text-gray-400 mt-1">🏃 플로깅</p>
            {[
              { label: "거리 1km 달성",       point: "+50P" },
              { label: "2km 이상 완주 보너스",  point: "+100P" },
              { label: "그룹 참여 (인원 × 5)",  point: "+αP" },
            ].map((item) => (
              <div key={item.label} className="flex justify-between items-center py-1.5 border-b border-gray-400/40 last:border-0">
                <span className="text-xs text-gray-500">{item.label}</span>
                <span className="text-xs font-bold" style={{ color: "#8dc63f" }}>{item.point}</span>
              </div>
            ))}

            <p className="text-[10px] font-bold text-gray-400 mt-2">👋 가입 & 추천</p>
            {[
              { label: "신규 가입 환영 포인트",         point: "+100P" },
              { label: "추천인 코드 입력 (신규 회원)",    point: "+50P" },
              { label: "내 추천 코드로 가입 시 (추천인)", point: "+100P" },
            ].map((item) => (
              <div key={item.label} className="flex justify-between items-center py-1.5 border-b border-gray-400/40 last:border-0">
                <span className="text-xs text-gray-500">{item.label}</span>
                <span className="text-xs font-bold" style={{ color: "#8dc63f" }}>{item.point}</span>
              </div>
            ))}

            <p className="text-[10px] font-bold text-gray-400 mt-2">🛒 친환경 쇼핑</p>
            {[
              { label: "제휴 상품 구매 시 보너스",  point: "+20~100P" },
            ].map((item) => (
              <div key={item.label} className="flex justify-between items-center py-1.5 border-b border-gray-400/40 last:border-0">
                <span className="text-xs text-gray-500">{item.label}</span>
                <span className="text-xs font-bold" style={{ color: "#8dc63f" }}>{item.point}</span>
              </div>
            ))}

            <p className="text-[10px] font-bold text-gray-400 mt-2">🔗 연동 보너스</p>
            {[
              { label: "에코마일리지 / 탄소중립포인트 연동", point: "+20% 추가" },
            ].map((item) => (
              <div key={item.label} className="flex justify-between items-center py-1.5 border-b border-gray-400/40 last:border-0">
                <span className="text-xs text-gray-500">{item.label}</span>
                <span className="text-xs font-bold" style={{ color: "#8dc63f" }}>{item.point}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 교환 확인 모달 ── */}
      {confirming && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-[200]" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          <div className="bg-white w-full rounded-3xl p-6 shadow-2xl mb-0">
            <div className="text-center mb-4">
              <div className={`w-16 h-16 rounded-2xl ${selectedItem.iconBg} flex items-center justify-center mb-2 mx-auto`}>
                <selectedItem.Icon size={32} className={selectedItem.iconColor} strokeWidth={1.8} />
              </div>
              <h2 className="text-lg font-bold text-gray-800">{selectedItem.title}</h2>
              <p className="text-sm text-gray-500 mt-1">{selectedItem.desc}</p>
            </div>

            <div className="bg-purple-50 rounded-xl p-4 mb-4 text-center">
              <p className="text-sm text-gray-500">교환 비용</p>
              <p className="text-3xl font-black text-purple-500">{selectedItem.cost.toLocaleString()} P</p>
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
                className="flex-1 bg-purple-500 text-white py-4 rounded-2xl font-bold"
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