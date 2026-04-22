"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { Trophy, Users, Map } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { useSearchParams } from "next/navigation";
import RankingMap from "@/components/RankingMap";

const TABS      = [
  { id: "points",   label: "포인트", icon: "💰" },
  { id: "distance", label: "거리",   icon: "📍" },
  { id: "count",    label: "횟수",   icon: "🏃" },
];
const PERIOD_TABS = [
  { id: "weekly",  label: "주간" },
  { id: "monthly", label: "월간" },
  { id: "all",     label: "전체" },
];
const VIEW_TABS = [
  { id: "list", label: "유저 랭킹",  iconId: "users" },
  { id: "map",  label: "지역 랭킹", iconId: "map" },
];

function getPeriodStart(period) {
  const now = new Date();
  if (period === "weekly") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    return start;
  }
  if (period === "monthly") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return null;
}

function RankingPageInner() {
  const { user }     = useAuth();
  const searchParams = useSearchParams();

  // ── 핵심 수정: useState 초기값 + useEffect 동기화 ──────────────
  // useState 단독으로는 URL 파라미터를 못 받는 경우가 있음 (SSR/Hydration 타이밍)
  const [view, setView]       = useState("list");
  const [tab, setTab]         = useState("points");
  const [period, setPeriod]   = useState("weekly");
  const [rankList, setRankList] = useState([]);
  const [myRank, setMyRank]   = useState(null);
  const [loading, setLoading] = useState(true);

  // searchParams 변화 감지 → view 강제 동기화
  useEffect(() => {
    const v = searchParams.get("view");
    if (v === "map") setView("map");
    else if (v === "list") setView("list");
    // 파라미터 없으면 현재 view 유지 (탭 클릭 시 보존)
  }, [searchParams]);

  const fetchRanking = useCallback(async () => {
    setLoading(true);
    try {
      const sinceDate = getPeriodStart(period);
      const routesQ   = sinceDate
        ? query(collection(db, "routes"), where("createdAt", ">=", sinceDate))
        : query(collection(db, "routes"));

      const snap = await getDocs(routesQ);
      const agg  = {};
      snap.forEach((d) => {
        const { userId, points = 0, distance = 0 } = d.data();
        if (!userId) return;
        if (!agg[userId]) agg[userId] = { points: 0, distance: 0, count: 0 };
        agg[userId].points   += points;
        agg[userId].distance += distance;
        agg[userId].count    += 1;
      });

      const uids = Object.keys(agg);
      const infoMap = {};
      await Promise.all(
        uids.map(async (uid) => {
          try {
            const s = await getDoc(doc(db, "users", uid));
            const d = s.exists() ? s.data() : {};
            infoMap[uid] = {
              displayName: d.displayName || d.email?.split("@")[0] || "익명",
              photoURL:    d.photoURL || "",
            };
          } catch {
            infoMap[uid] = { displayName: "익명", photoURL: "" };
          }
        })
      );

      const sorted = uids
        .map((uid) => ({ uid, ...agg[uid], ...infoMap[uid] }))
        .sort((a, b) => b[tab] - a[tab]);

      setRankList(sorted);
      if (user) {
        const idx = sorted.findIndex((r) => r.uid === user.uid);
        setMyRank(idx >= 0 ? { rank: idx + 1, ...sorted[idx] } : null);
      }
    } catch (e) {
      console.error("랭킹 로드 실패:", e);
    } finally {
      setLoading(false);
    }
  }, [tab, period, user]);

  useEffect(() => { fetchRanking(); }, [fetchRanking]);

  const fmt = (item) => {
    if (tab === "points")   return `${item.points.toLocaleString()}P`;
    if (tab === "distance") return `${item.distance.toFixed(1)}km`;
    return `${item.count}회`;
  };
  const medal = (r) => r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : null;

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
        <p className="text-sm font-black text-gray-700 flex items-center gap-1"><Trophy className="w-4 h-4" strokeWidth={1.8} /> 랭킹</p>
      </div>

      {/* ── 행정구역 랭킹지도 바로가기 카드 ── */}
      <div className="px-4 pt-3 pb-1">
        <button
          onClick={() => setView("map")}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl shadow-sm transition-all active:opacity-90
            `}
          style={{ backgroundImage: "linear-gradient(to right, #8dc63f, #4cb748)" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">🗺️</span>
            <div className="text-left">
              <p className="text-[10px] text-green-100 leading-none mb-0.5">지역별 현황</p>
              <p className="font-black text-sm text-white">행정구역별 랭킹지도</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-white/25 text-white ml-1">
              시·도별 확인
            </span>
          </div>
          <div className="flex items-center gap-1 text-white/80">
            <span className="text-xs">{view === "map" ? "보는 중" : "바로가기"}</span>
            <span className="text-base">{view === "map" ? "✅" : "›"}</span>
          </div>
        </button>
      </div>

      {/* ── 뷰 전환 탭 (유저 / 지역) ── */}
      <div className="flex bg-white border-b sticky top-0 z-10 shadow-sm">
        {VIEW_TABS.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-1
              ${view === v.id ? "border-green-500 text-green-600" : "border-transparent text-gray-400"}`}
          >
            {v.iconId === "users" ? <Users className="w-4 h-4" strokeWidth={1.8} /> : <Map className="w-4 h-4" strokeWidth={1.8} />}
            {v.label}
          </button>
        ))}
      </div>

      <div className="px-4 mt-4">

        {/* ─────── 유저 랭킹 뷰 ─────── */}
        {view === "list" && (
          <div className="space-y-3">
            {/* 내 순위 카드 */}
            {myRank && (
              <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-lg overflow-hidden">
                  {myRank.photoURL
                    ? <img src={myRank.photoURL} alt="" className="w-full h-full object-cover" />
                    : "😊"
                  }
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-400">내 순위</p>
                  <p className="font-bold text-gray-800">
                    {medal(myRank.rank) || `#${myRank.rank}`} {myRank.displayName}
                  </p>
                </div>
                <span className="font-bold text-green-600 text-sm">{fmt(myRank)}</span>
              </div>
            )}

            {/* 기간 탭 */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {PERIOD_TABS.map((p) => (
                <button key={p.id} onClick={() => setPeriod(p.id)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors
                    ${period === p.id ? "bg-white text-green-600 shadow-sm" : "text-gray-500"}`}>
                  {p.label}
                </button>
              ))}
            </div>

            {/* 항목 탭 */}
            <div className="flex gap-2">
              {TABS.map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-sm font-medium border
                    ${tab === t.id ? "bg-green-500 text-white border-green-500" : "bg-white text-gray-500 border-gray-200"}`}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {/* TOP 3 시상대 */}
            {!loading && rankList.length >= 3 && (
              <div className="flex items-end justify-center gap-3 mt-2 mb-1">
                {[rankList[1], rankList[0], rankList[2]].map((item, pos) => {
                  const heights = ["h-20", "h-28", "h-16"];
                  const medals  = ["🥈", "🥇", "🥉"];
                  const bgs     = ["bg-gray-200", "bg-yellow-100", "bg-orange-100"];
                  return (
                    <div key={item.uid} className="flex-1 min-w-0 text-center">
                      <div className="w-12 h-12 rounded-full bg-gray-100 mx-auto overflow-hidden mb-1">
                        {item.photoURL
                          ? <img src={item.photoURL} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-xl">😊</div>
                        }
                      </div>
                      <div className={`${bgs[pos]} ${heights[pos]} rounded-t-xl flex flex-col items-center justify-center px-1 w-full`}>
                        <span className="text-xl">{medals[pos]}</span>
                        <p className="text-xs font-bold text-gray-700 break-words w-full text-center px-1 leading-tight">{item.displayName}</p>
                        <p className="text-xs text-gray-500 w-full text-center">{fmt(item)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 전체 리스트 */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {loading ? (
                <p className="text-center py-10 text-gray-400 animate-pulse">🌿 집계 중...</p>
              ) : rankList.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-3xl mb-2">🌱</p>
                  <p className="text-gray-500 text-sm">아직 참여자가 없어요!</p>
                </div>
              ) : (
                rankList.slice(0, 20).map((item, idx) => {
                  const rank = idx + 1;
                  const isMe = user?.uid === item.uid;
                  return (
                    <div key={item.uid}
                      className={`flex items-center gap-3 px-4 py-3 border-b last:border-0 ${isMe ? "bg-green-50" : ""}`}>
                      <div className="w-7 text-center">
                        {medal(rank) ? <span className="text-lg">{medal(rank)}</span>
                          : <span className="text-sm font-bold text-gray-400">#{rank}</span>}
                      </div>
                      <div className="w-9 h-9 rounded-full bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center text-lg">
                        {item.photoURL
                          ? <img src={item.photoURL} alt="" className="w-full h-full object-cover" />
                          : "😊"
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isMe ? "text-green-700" : "text-gray-700"}`}>
                          {item.displayName} {isMe && <span className="text-xs text-green-400">(나)</span>}
                        </p>
                        <p className="text-xs text-gray-400">{item.count}회 · {item.distance.toFixed(1)}km</p>
                      </div>
                      <span className={`text-sm font-bold flex-shrink-0 ${isMe ? "text-green-600" : "text-gray-700"}`}>
                        {fmt(item)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ─────── 지역 랭킹 뷰 ─────── */}
        {view === "map" && <RankingMap />}
      </div>
    </div>
  );
}

// ── Suspense 래핑 (useSearchParams 필수) ─────────────────
export default function RankingPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <p className="animate-pulse text-lg">🏆 랭킹 로딩 중...</p>
      </div>
    }>
      <RankingPageInner />
    </Suspense>
  );
}