"use client";

import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Leaf } from "lucide-react";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, getDocs, limit } from "firebase/firestore";

const ECO_ACTIONS = [
  {
    id: "tumbler",
    icon: "☕",
    title: "텀블러/다회용컵 이용",
    desc: "카페에서 텀블러로 음료를 받고 인증하세요",
    points: "+30P",
    color: "from-amber-400 to-orange-400",
    bg: "bg-amber-50",
    border: "border-amber-200",
    textColor: "text-amber-700",
    href: "/map?eco=tumbler",
  },
  {
    id: "cupreturn",
    icon: "♻️",
    title: "일회용컵 반환",
    desc: "반환기에 일회용컵을 반환하고 인증하세요",
    points: "컵당 +10P",
    color: "from-teal-400 to-cyan-400",
    bg: "bg-teal-50",
    border: "border-teal-200",
    textColor: "text-teal-700",
    href: "/map?eco=cupreturn",
  },
];

// 앞으로 추가될 녹색생활 실천 항목 (비활성)
const COMING_SOON = [
  { icon: "🚿", title: "샤워 절약", desc: "5분 이내 샤워 실천" },
  { icon: "🌡️", title: "적정 냉난방", desc: "실내 적정온도 유지" },
  { icon: "🛍️", title: "장바구니 사용", desc: "일회용 비닐 대신 장바구니" },
  { icon: "🚶", title: "대중교통 이용", desc: "자가용 대신 대중교통·도보" },
];

export default function EcoLifePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [recentActions, setRecentActions] = useState([]);

  useEffect(() => {
    if (!user) return;
    const fetchRecent = async () => {
      try {
        const q = query(
          collection(db, "ecoActions"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc"),
          limit(5)
        );
        const snap = await getDocs(q);
        setRecentActions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { /* ignore */ }
    };
    fetchRecent();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 p-6 text-center">
        <div className="text-6xl">🔑</div>
        <h2 className="text-xl font-bold text-gray-800">로그인이 필요합니다</h2>
        <p className="text-gray-500 text-sm">녹색생활 실천 인증을 위해 로그인해주세요</p>
        <Link href="/" className="bg-green-500 text-white px-6 py-3 rounded-full font-bold">
          홈으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white pb-24">
      {/* 헤더 */}
      <div className="bg-white/80 backdrop-blur-sm sticky top-0 z-10 border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2">
            <Leaf className="w-5 h-5 text-green-600" />
            <h1 className="text-lg font-black text-gray-800">녹색생활 실천</h1>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5">
        {/* 안내 배너 */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-4 mb-5 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🌿</span>
            <div>
              <h2 className="font-black text-base">탄소중립포인트 녹색생활 실천</h2>
              <p className="text-green-100 text-xs mt-0.5 leading-relaxed">
                일상 속 친환경 활동을 인증하고 포인트를 적립하세요!
              </p>
            </div>
          </div>
        </div>

        {/* 실천 항목 카드 */}
        <h3 className="text-sm font-black text-gray-700 mb-3 flex items-center gap-1.5">
          <span className="text-base">✅</span> 인증 가능한 활동
        </h3>
        <div className="space-y-3 mb-6">
          {ECO_ACTIONS.map(action => (
            <Link key={action.id} href={action.href}
              className={`block ${action.bg} border ${action.border} rounded-2xl p-4 active:scale-[0.98] transition-transform`}>
              <div className="flex items-center gap-3">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${action.color} flex items-center justify-center text-2xl shadow-sm`}>
                  {action.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className={`font-black text-sm ${action.textColor}`}>{action.title}</h4>
                    <span className={`text-xs font-black ${action.textColor} bg-white/70 px-2 py-0.5 rounded-full`}>
                      {action.points}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{action.desc}</p>
                </div>
                <span className="text-gray-300 text-lg">›</span>
              </div>
            </Link>
          ))}
        </div>

        {/* 최근 인증 내역 */}
        {recentActions.length > 0 && (
          <>
            <h3 className="text-sm font-black text-gray-700 mb-3 flex items-center gap-1.5">
              <span className="text-base">📋</span> 최근 인증 내역
            </h3>
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm mb-6">
              {recentActions.map((action, i) => (
                <div key={action.id}
                  className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-gray-50" : ""}`}>
                  <span className="text-xl">
                    {action.type === "tumbler" ? "☕" : action.type === "cup_return" ? "♻️" : "🌿"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-700">
                      {action.type === "tumbler" ? "텀블러 사용" :
                       action.type === "cup_return" ? `일회용컵 반환 (${action.cupCount || 1}개)` :
                       "녹색생활 실천"}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {action.certifiedAt ? new Date(action.certifiedAt).toLocaleDateString("ko-KR") : ""}
                    </p>
                  </div>
                  <span className="text-xs font-black text-green-600 bg-green-50 px-2 py-1 rounded-full">
                    +{action.points || 0}P
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 준비 중인 항목 */}
        <h3 className="text-sm font-black text-gray-400 mb-3 flex items-center gap-1.5">
          <span className="text-base">🔜</span> 준비 중인 활동
        </h3>
        <div className="grid grid-cols-2 gap-2 mb-6">
          {COMING_SOON.map((item, i) => (
            <div key={i}
              className="bg-gray-50 border border-gray-100 rounded-2xl p-3 opacity-50">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{item.icon}</span>
                <span className="text-xs font-bold text-gray-500">{item.title}</span>
              </div>
              <p className="text-[10px] text-gray-400">{item.desc}</p>
              <span className="inline-block mt-1.5 text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                준비 중
              </span>
            </div>
          ))}
        </div>

        {/* 하단 안내 */}
        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 mb-6 text-center">
          <p className="text-xs text-gray-500 leading-relaxed">
            녹색생활 실천 인증은 <span className="font-bold">탄소중립포인트 녹색생활 실천</span> 프로그램과<br/>
            연계하여 운영됩니다. 적립된 포인트는 리워드 교환에 사용할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
