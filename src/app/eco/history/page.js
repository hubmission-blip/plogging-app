"use client";

import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Leaf, ChevronDown, ChevronUp, Award, Filter, Calendar, TrendingUp, Receipt, Coffee, CupSoda, Pipette, Package, Car, ShieldCheck, Recycle, Smartphone, Sprout, Bike, UtensilsCrossed, TreePine, Sun, RotateCcw, ShoppingBag, Container } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";

// ─── 항목 메타 정보 ──────────────────────────────────────
const ECO_META = {
  e_receipt:          { icon: Receipt,         title: "전자영수증 발급",      color: "text-blue-500",    bg: "bg-blue-50",    border: "border-blue-200" },
  tumbler:            { icon: Coffee,          title: "텀블러/다회용컵 이용", color: "text-amber-500",   bg: "bg-amber-50",   border: "border-amber-200" },
  cup_return:         { icon: CupSoda,         title: "일회용컵 반환",       color: "text-teal-500",    bg: "bg-teal-50",    border: "border-teal-200" },
  refill_station:     { icon: Pipette,         title: "리필스테이션 이용",    color: "text-indigo-500",  bg: "bg-indigo-50",  border: "border-indigo-200" },
  reusable_container: { icon: Package,         title: "다회용기 배달 이용",   color: "text-violet-500",  bg: "bg-violet-50",  border: "border-violet-200" },
  ev_rental:          { icon: Car,             title: "무공해차 대여",       color: "text-sky-500",     bg: "bg-sky-50",     border: "border-sky-200" },
  eco_product:        { icon: ShieldCheck,     title: "친환경제품 구매",      color: "text-emerald-500", bg: "bg-emerald-50", border: "border-emerald-200" },
  quality_recycle:    { icon: Recycle,          title: "고품질 재활용품 배출", color: "text-cyan-500",    bg: "bg-cyan-50",    border: "border-cyan-200" },
  phone_return:       { icon: Smartphone,      title: "폐휴대폰 반납",       color: "text-rose-500",    bg: "bg-rose-50",    border: "border-rose-200" },
  future_gen:         { icon: Sprout,          title: "미래세대 실천행동",    color: "text-green-500",   bg: "bg-green-50",   border: "border-green-200" },
  shared_bike:        { icon: Bike,            title: "공유자전거 이용",      color: "text-lime-500",    bg: "bg-lime-50",    border: "border-lime-200" },
  zero_waste:         { icon: UtensilsCrossed, title: "잔반제로 실천",       color: "text-orange-500",  bg: "bg-orange-50",  border: "border-orange-200" },
  tree_planting:      { icon: TreePine,        title: "나무심기 캠페인 참여", color: "text-green-600",   bg: "bg-green-50",   border: "border-green-200" },
  solar_panel:        { icon: Sun,             title: "베란다 태양광 설치",   color: "text-yellow-500",  bg: "bg-yellow-50",  border: "border-yellow-200" },
  recycled_product:   { icon: RotateCcw,       title: "재생원료 제품구매",    color: "text-teal-500",    bg: "bg-teal-50",    border: "border-teal-200" },
  eco_bag:            { icon: ShoppingBag,     title: "개인장바구니 이용",    color: "text-pink-500",    bg: "bg-pink-50",    border: "border-pink-200" },
  own_container:      { icon: Container,       title: "개인용기 식품포장",    color: "text-purple-500",  bg: "bg-purple-50",  border: "border-purple-200" },
};

export default function EcoHistoryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [actions, setActions] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [filter, setFilter] = useState("all"); // "all" 또는 dbType

  // Firebase Auth 재인증
  const ensureAuth = async () => {
    if (auth.currentUser) {
      try { await auth.currentUser.getIdToken(true); return; } catch {}
    }
    try {
      const kakaoUser = localStorage.getItem("kakaoUser");
      const appleUser = localStorage.getItem("appleUser");
      if (kakaoUser) {
        const p = JSON.parse(kakaoUser);
        const uid = p.kakaoUid || p.uid;
        await signInWithEmailAndPassword(auth, `kakao_${uid}@kakao-auth.plogging.app`, `kakao_${uid}_plogging2024!`);
      } else if (appleUser) {
        const p = JSON.parse(appleUser);
        const uid = String(p.appleUid || p.uid).replace(/[^a-zA-Z0-9]/g, "").slice(0, 20);
        await signInWithEmailAndPassword(auth, `apple_${uid}@apple-auth.plogging.app`, `apple_${uid}_plogging2024!`);
      }
    } catch {}
  };

  useEffect(() => {
    if (!user) { setFetching(false); return; }
    const fetch = async () => {
      try {
        await ensureAuth();
        const q = query(collection(db, "ecoActions"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        setActions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.warn("[EcoHistory] 데이터 조회 실패:", e);
      } finally { setFetching(false); }
    };
    fetch();
  }, [user]);

  // ─── 통계 계산 ─────────────────────────────────────────
  const stats = useMemo(() => {
    const byType = {};
    let totalPoints = 0;
    let totalCount = 0;
    actions.forEach(a => {
      const t = a.type;
      if (!byType[t]) byType[t] = { count: 0, points: 0 };
      byType[t].count += 1;
      byType[t].points += (a.points || 0);
      totalPoints += (a.points || 0);
      totalCount += 1;
    });
    return { byType, totalPoints, totalCount };
  }, [actions]);

  // ─── 월별 통계 ─────────────────────────────────────────
  const monthlyStats = useMemo(() => {
    const months = {};
    actions.forEach(a => {
      const d = a.certifiedAt ? new Date(a.certifiedAt) : (a.createdAt?.toDate ? a.createdAt.toDate() : new Date());
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!months[key]) months[key] = { count: 0, points: 0 };
      months[key].count += 1;
      months[key].points += (a.points || 0);
    });
    return Object.entries(months)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 6)
      .reverse();
  }, [actions]);

  // ─── 필터 적용 ─────────────────────────────────────────
  const filteredActions = useMemo(() => {
    if (filter === "all") return actions;
    return actions.filter(a => a.type === filter);
  }, [actions, filter]);

  // 활동 있는 카테고리만 필터 탭에 표시
  const activeTypes = useMemo(() => {
    const types = new Set(actions.map(a => a.type));
    return Array.from(types);
  }, [actions]);

  if (loading || fetching) {
    return (<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" /></div>);
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 p-6 text-center">
        <div className="text-6xl">🔑</div>
        <h2 className="text-xl font-bold text-gray-800">로그인이 필요합니다</h2>
        <Link href="/" className="bg-green-500 text-white px-6 py-3 rounded-full font-bold">홈으로 돌아가기</Link>
      </div>
    );
  }

  const maxMonthlyPoints = Math.max(...monthlyStats.map(([, v]) => v.points), 1);

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
            <h1 className="text-lg font-black text-gray-800">내 녹색생활 실천내역</h1>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5">

        {/* ═══ 포인트 요약 아코디언 ═══ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-5 overflow-hidden">
          <button onClick={() => setShowStats(!showStats)} className="w-full px-4 py-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <Award size={22} className="text-green-600" strokeWidth={2} />
            </div>
            <div className="flex-1 text-left">
              <p className="text-[11px] text-gray-400 font-medium">내 녹색생활 포인트</p>
              <p className="text-xl font-black text-gray-800">{stats.totalPoints.toLocaleString()}<span className="text-sm font-bold text-gray-400 ml-0.5">P</span></p>
            </div>
            <div className="text-right mr-1">
              <p className="text-[11px] text-gray-400">총 인증</p>
              <p className="text-base font-black text-green-600">{stats.totalCount}회</p>
            </div>
            {showStats ? <ChevronUp size={18} className="text-gray-300" /> : <ChevronDown size={18} className="text-gray-300" />}
          </button>

          {showStats && (
            <div className="border-t border-gray-100 px-4 py-3">
              <div className="space-y-1.5">
                {Object.entries(ECO_META).map(([dbType, meta]) => {
                  const s = stats.byType[dbType];
                  const count = s?.count || 0;
                  const pts = s?.points || 0;
                  const IconComp = meta.icon;
                  return (
                    <div key={dbType} className="flex items-center gap-2.5 py-1.5">
                      <IconComp size={16} className={count > 0 ? meta.color : "text-gray-300"} strokeWidth={2} />
                      <span className={`text-xs flex-1 ${count > 0 ? "text-gray-700 font-medium" : "text-gray-300"}`}>{meta.title}</span>
                      <span className={`text-[11px] w-10 text-center ${count > 0 ? "text-gray-500 font-bold" : "text-gray-300"}`}>{count}회</span>
                      <span className={`text-[11px] w-14 text-right font-bold ${count > 0 ? "text-green-600" : "text-gray-300"}`}>{pts > 0 ? `+${pts}P` : "-"}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500">합계</span>
                <span className="text-sm font-black text-green-600">{stats.totalPoints.toLocaleString()}P</span>
              </div>
            </div>
          )}
        </div>

        {/* ═══ 월별 통계 차트 ═══ */}
        {monthlyStats.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={16} className="text-green-600" />
              <h3 className="text-sm font-black text-gray-700">월별 활동</h3>
            </div>
            <div className="flex items-end gap-2 h-28">
              {monthlyStats.map(([month, data]) => {
                const height = Math.max((data.points / maxMonthlyPoints) * 100, 8);
                const label = month.split("-")[1] + "월";
                return (
                  <div key={month} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] font-bold text-green-600">+{data.points}P</span>
                    <div className="w-full flex justify-center">
                      <div
                        className="w-8 bg-gradient-to-t from-green-500 to-emerald-400 rounded-t-lg transition-all"
                        style={{ height: `${height}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400 font-medium">{label}</span>
                    <span className="text-[9px] text-gray-300">{data.count}건</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ 카테고리 필터 ═══ */}
        {activeTypes.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Filter size={14} className="text-gray-400" />
              <span className="text-xs font-bold text-gray-500">카테고리 필터</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${
                  filter === "all" ? "bg-green-500 text-white border-green-500" : "bg-white text-gray-500 border-gray-200"
                }`}
              >전체 ({actions.length})</button>
              {activeTypes.map(t => {
                const meta = ECO_META[t];
                if (!meta) return null;
                const count = stats.byType[t]?.count || 0;
                return (
                  <button key={t} onClick={() => setFilter(t)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${
                      filter === t ? "bg-green-500 text-white border-green-500" : "bg-white text-gray-500 border-gray-200"
                    }`}
                  >{meta.title.length > 6 ? meta.title.slice(0, 6) + "…" : meta.title} ({count})</button>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ 인증 사진 타임라인 ═══ */}
        {filteredActions.length > 0 ? (
          <div className="space-y-3 mb-6">
            {filteredActions.map((action, i) => {
              const meta = ECO_META[action.type] || { icon: Leaf, title: "녹색생활", color: "text-green-500", bg: "bg-green-50", border: "border-green-200" };
              const IconComp = meta.icon;
              const dateStr = action.certifiedAt
                ? new Date(action.certifiedAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })
                : "";
              const timeStr = action.certifiedAt
                ? new Date(action.certifiedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
                : "";

              return (
                <div key={action.id} className={`bg-white rounded-2xl border ${meta.border} overflow-hidden shadow-sm`}>
                  {/* 헤더 */}
                  <div className="px-4 py-3 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg ${meta.bg} flex items-center justify-center`}>
                      <IconComp size={16} className={meta.color} strokeWidth={2} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-700">{meta.title}</p>
                      <p className="text-[10px] text-gray-400">{dateStr} {timeStr}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
                        +{action.points || 0}P
                      </span>
                    </div>
                  </div>
                  {/* 사진 */}
                  {action.photoUrl && (
                    <div className="px-4 pb-3">
                      <img
                        src={action.photoUrl}
                        alt="인증 사진"
                        className="w-full h-40 object-cover rounded-xl"
                        loading="lazy"
                      />
                    </div>
                  )}
                  {/* 추가 정보 */}
                  <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
                    {action.service && (
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">{action.service}</span>
                    )}
                    {action.cupCount > 0 && (
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">{action.cupCount}개 반환</span>
                    )}
                    {action.aiVerified != null && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${action.aiVerified ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"}`}>
                        AI {action.aiVerified ? "검증완료" : "미검증"}
                      </span>
                    )}
                    {action.receiptInfo?.storeName && (
                      <span className="text-[10px] bg-blue-50 text-blue-500 px-2 py-0.5 rounded-full font-medium">{action.receiptInfo.storeName}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <span className="text-5xl mb-4 block">🌱</span>
            <p className="text-gray-400 text-sm font-medium">
              {filter === "all" ? "아직 인증 내역이 없습니다" : "해당 카테고리의 인증 내역이 없습니다"}
            </p>
            <Link href="/eco" className="inline-block mt-4 bg-green-500 text-white px-5 py-2.5 rounded-full text-sm font-bold">
              녹색생활 인증하러 가기
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
