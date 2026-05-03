"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import Link from "next/link";
import { Trophy, Users, Map, Coins, MapPin, Footprints, Medal, User, ChevronLeft, ChevronRight, BarChart3, TrendingUp, Activity, Calendar } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { useSearchParams } from "next/navigation";
import RankingMap from "@/components/RankingMap";

// ─── 상수 ───────────────────────────────────────────────────
const TABS = [
  { id: "points",   label: "포인트", Icon: Coins },
  { id: "distance", label: "거리",   Icon: MapPin },
  { id: "count",    label: "횟수",   Icon: Footprints },
];
const PERIOD_TABS = [
  { id: "weekly",  label: "주간" },
  { id: "monthly", label: "월간" },
  { id: "all",     label: "전체" },
];
const VIEW_TABS = [
  { id: "list",     label: "유저 랭킹",  Icon: Users },
  { id: "map",      label: "지역 랭킹",  Icon: Map },
  { id: "analysis", label: "분석",        Icon: BarChart3 },
];

// ─── 기간 계산 유틸 ──────────────────────────────────────────
function getWeekRange(offset = 0) {
  const now = new Date();
  const day = now.getDay(); // 0=일요일
  const start = new Date(now);
  start.setDate(now.getDate() - day + offset * 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
}

function getMonthRange(offset = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
  return { start, end };
}

function getPeriodRange(period, offset = 0) {
  if (period === "weekly") return getWeekRange(offset);
  if (period === "monthly") return getMonthRange(offset);
  return { start: null, end: null }; // 전체
}

function formatPeriodLabel(period, offset) {
  if (period === "all") return "전체 기간";
  const { start, end } = getPeriodRange(period, offset);
  if (period === "weekly") {
    const endDay = new Date(end); endDay.setDate(endDay.getDate() - 1);
    const s = `${start.getMonth() + 1}/${start.getDate()}`;
    const e = `${endDay.getMonth() + 1}/${endDay.getDate()}`;
    if (offset === 0) return `이번 주 (${s}~${e})`;
    if (offset === -1) return `지난 주 (${s}~${e})`;
    return `${s} ~ ${e}`;
  }
  if (period === "monthly") {
    const y = start.getFullYear();
    const m = start.getMonth() + 1;
    if (offset === 0) return `이번 달 (${y}.${m})`;
    if (offset === -1) return `지난 달 (${y}.${m})`;
    return `${y}년 ${m}월`;
  }
  return "";
}

function isFutureOffset(period, offset) {
  if (period === "all") return true;
  const { start } = getPeriodRange(period, offset + 1);
  return start > new Date();
}

// ─── 간단 바 차트 컴포넌트 ──────────────────────────────────
function BarChart({ data, color = "#8dc63f", unit = "", height = 160 }) {
  if (!data || data.length === 0) return <p className="text-center py-6 text-gray-400 text-sm">데이터가 없습니다</p>;
  const max = Math.max(...data.map(d => d.value), 1);
  const barW = Math.max(16, Math.min(40, Math.floor((300 - data.length * 4) / data.length)));

  return (
    <div className="flex items-end justify-center gap-1 overflow-x-auto" style={{ height, paddingTop: 24 }}>
      {data.map((d, i) => {
        const h = Math.max(4, (d.value / max) * (height - 40));
        return (
          <div key={i} className="flex flex-col items-center" style={{ minWidth: barW }}>
            <span className="text-xs font-bold text-gray-600 mb-1" style={{ fontSize: 10 }}>
              {d.value > 0 ? (Number.isInteger(d.value) ? d.value : d.value.toFixed(1)) : ""}
            </span>
            <div
              className="rounded-t-lg transition-all duration-500"
              style={{ width: barW - 4, height: h, backgroundColor: color, opacity: 0.85 }}
            />
            <span className="text-xs text-gray-400 mt-1 whitespace-nowrap" style={{ fontSize: 10 }}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── 분석 뷰 컴포넌트 ───────────────────────────────────────
function AnalysisView({ user }) {
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);
  const [myMonthly, setMyMonthly] = useState([]);
  const [summary, setSummary] = useState({ totalUsers: 0, totalRoutes: 0, totalDistance: 0, totalPoints: 0, avgPerUser: 0 });

  useEffect(() => {
    (async () => {
      setAnalysisLoading(true);
      try {
        // 최근 6개월 데이터 로드
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1);
        sixMonthsAgo.setHours(0, 0, 0, 0);

        const snap = await getDocs(
          query(collection(db, "routes"), where("createdAt", ">=", sixMonthsAgo))
        );

        const byMonth = {};
        const byWeek = {};
        const myByMonth = {};
        const userSet = new Set();
        let totalDist = 0, totalPts = 0, totalRoutes = 0;

        snap.forEach((d) => {
          const data = d.data();
          const { userId, points = 0, distance = 0, createdAt } = data;
          if (!userId || !createdAt) return;

          const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
          const mKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          const wKey = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;

          if (!byMonth[mKey]) byMonth[mKey] = { count: 0, distance: 0, points: 0, users: new Set() };
          byMonth[mKey].count++;
          byMonth[mKey].distance += distance;
          byMonth[mKey].points += points;
          byMonth[mKey].users.add(userId);

          if (!byWeek[wKey]) byWeek[wKey] = { count: 0, distance: 0, date: weekStart };
          byWeek[wKey].count++;
          byWeek[wKey].distance += distance;

          if (user && userId === user.uid) {
            if (!myByMonth[mKey]) myByMonth[mKey] = { count: 0, distance: 0, points: 0 };
            myByMonth[mKey].count++;
            myByMonth[mKey].distance += distance;
            myByMonth[mKey].points += points;
          }

          userSet.add(userId);
          totalDist += distance;
          totalPts += points;
          totalRoutes++;
        });

        // 월별 데이터 정렬
        const months = Object.keys(byMonth).sort();
        setMonthlyData(months.map(m => ({
          label: m.split("-")[1] + "월",
          month: m,
          count: byMonth[m].count,
          distance: Math.round(byMonth[m].distance * 10) / 10,
          points: byMonth[m].points,
          users: byMonth[m].users.size,
        })));

        // 주간 데이터 (최근 8주)
        const weeksSorted = Object.entries(byWeek)
          .sort((a, b) => a[1].date - b[1].date)
          .slice(-8);
        setWeeklyData(weeksSorted.map(([k, v]) => ({
          label: k,
          value: v.count,
        })));

        // 내 월별 데이터
        if (user) {
          setMyMonthly(months.map(m => ({
            label: m.split("-")[1] + "월",
            count: myByMonth[m]?.count || 0,
            distance: Math.round((myByMonth[m]?.distance || 0) * 10) / 10,
            points: myByMonth[m]?.points || 0,
          })));
        }

        setSummary({
          totalUsers: userSet.size,
          totalRoutes,
          totalDistance: Math.round(totalDist * 10) / 10,
          totalPoints: totalPts,
          avgPerUser: userSet.size > 0 ? Math.round(totalRoutes / userSet.size * 10) / 10 : 0,
        });
      } catch (e) {
        console.error("분석 데이터 로드 실패:", e);
      } finally {
        setAnalysisLoading(false);
      }
    })();
  }, [user]);

  if (analysisLoading) {
    return <p className="text-center py-16 text-gray-400 animate-pulse">📊 데이터 분석 중...</p>;
  }

  return (
    <div className="space-y-4">
      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "총 참여자", value: `${summary.totalUsers}명`, icon: "👥", color: "#8dc63f" },
          { label: "총 플로깅", value: `${summary.totalRoutes}회`, icon: "🏃", color: "#3b82f6" },
          { label: "총 거리", value: `${summary.totalDistance.toLocaleString()}km`, icon: "📍", color: "#f59e0b" },
          { label: "총 포인트", value: `${summary.totalPoints.toLocaleString()}P`, icon: "🪙", color: "#8b5cf6" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-3.5 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{s.icon}</span>
              <span className="text-xs text-gray-400 font-medium">{s.label}</span>
            </div>
            <p className="text-lg font-black" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* 월간 참여 횟수 추이 */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-green-500" strokeWidth={2} />
          <h3 className="font-bold text-sm text-gray-700">월간 플로깅 횟수 추이</h3>
        </div>
        <BarChart
          data={monthlyData.map(d => ({ label: d.label, value: d.count }))}
          color="#8dc63f"
        />
      </div>

      {/* 월간 거리 추이 */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-blue-500" strokeWidth={2} />
          <h3 className="font-bold text-sm text-gray-700">월간 총 거리 추이 (km)</h3>
        </div>
        <BarChart
          data={monthlyData.map(d => ({ label: d.label, value: d.distance }))}
          color="#3b82f6"
        />
      </div>

      {/* 주간 참여 추이 (최근 8주) */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-amber-500" strokeWidth={2} />
          <h3 className="font-bold text-sm text-gray-700">주간 플로깅 횟수 (최근 8주)</h3>
        </div>
        <BarChart data={weeklyData} color="#f59e0b" />
      </div>

      {/* 월간 참여자 수 추이 */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-purple-500" strokeWidth={2} />
          <h3 className="font-bold text-sm text-gray-700">월간 참여자 수</h3>
        </div>
        <BarChart
          data={monthlyData.map(d => ({ label: d.label, value: d.users }))}
          color="#8b5cf6"
        />
      </div>

      {/* 내 월간 플로깅 (로그인 시) */}
      {user && myMonthly.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-yellow-500" strokeWidth={2} />
            <h3 className="font-bold text-sm text-gray-700">내 월간 플로깅 횟수</h3>
          </div>
          <BarChart
            data={myMonthly.map(d => ({ label: d.label, value: d.count }))}
            color="#10b981"
          />
        </div>
      )}

      {user && myMonthly.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Coins className="w-4 h-4 text-yellow-500" strokeWidth={2} />
            <h3 className="font-bold text-sm text-gray-700">내 월간 포인트 적립</h3>
          </div>
          <BarChart
            data={myMonthly.map(d => ({ label: d.label, value: d.points }))}
            color="#f59e0b"
          />
        </div>
      )}

      {/* 월별 상세 테이블 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="font-bold text-sm text-gray-700">월별 상세</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                <th className="px-3 py-2 text-left font-medium">월</th>
                <th className="px-3 py-2 text-right font-medium">횟수</th>
                <th className="px-3 py-2 text-right font-medium">거리</th>
                <th className="px-3 py-2 text-right font-medium">포인트</th>
                <th className="px-3 py-2 text-right font-medium">참여자</th>
              </tr>
            </thead>
            <tbody>
              {[...monthlyData].reverse().map((d) => (
                <tr key={d.month} className="border-b border-gray-50">
                  <td className="px-3 py-2.5 font-bold text-gray-700">{d.label}</td>
                  <td className="px-3 py-2.5 text-right text-gray-600">{d.count}회</td>
                  <td className="px-3 py-2.5 text-right text-gray-600">{d.distance}km</td>
                  <td className="px-3 py-2.5 text-right text-green-600 font-bold">{d.points.toLocaleString()}P</td>
                  <td className="px-3 py-2.5 text-right text-gray-600">{d.users}명</td>
                </tr>
              ))}
              {monthlyData.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">데이터가 없습니다</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 랭킹 페이지 ───────────────────────────────────────
function RankingPageInner() {
  const { user }     = useAuth();
  const searchParams = useSearchParams();

  const [view, setView]       = useState("list");
  const [tab, setTab]         = useState("points");
  const [period, setPeriod]   = useState("weekly");
  const [offset, setOffset]   = useState(0); // 0=이번주/달, -1=지난주/달, ...
  const [rankList, setRankList] = useState([]);
  const [myRank, setMyRank]   = useState(null);
  const [loading, setLoading] = useState(true);

  // searchParams → view 동기화
  useEffect(() => {
    const v = searchParams.get("view");
    if (v === "map") setView("map");
    else if (v === "list") setView("list");
    else if (v === "analysis") setView("analysis");
  }, [searchParams]);

  // 기간 변경 시 offset 초기화
  useEffect(() => { setOffset(0); }, [period]);

  const fetchRanking = useCallback(async () => {
    setLoading(true);
    try {
      const { start: sinceDate, end: untilDate } = getPeriodRange(period, offset);
      let routesQ;
      if (sinceDate && untilDate) {
        routesQ = query(
          collection(db, "routes"),
          where("createdAt", ">=", sinceDate),
          where("createdAt", "<", untilDate)
        );
      } else if (sinceDate) {
        routesQ = query(collection(db, "routes"), where("createdAt", ">=", sinceDate));
      } else {
        routesQ = query(collection(db, "routes"));
      }

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
  }, [tab, period, offset, user]);

  useEffect(() => { fetchRanking(); }, [fetchRanking]);

  const fmt = (item) => {
    if (tab === "points")   return `${item.points.toLocaleString()}P`;
    if (tab === "distance") return `${item.distance.toFixed(1)}km`;
    return `${item.count}회`;
  };
  const medalColor = (r) => r === 1 ? "text-yellow-500" : r === 2 ? "text-gray-400" : r === 3 ? "text-amber-600" : null;
  const medalLabel = (r) => r === 1 ? "1st" : r === 2 ? "2nd" : r === 3 ? "3rd" : null;

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
      {view !== "map" && (
        <div className="px-4 pt-3 pb-1">
          <button
            onClick={() => setView("map")}
            className="w-full flex items-center justify-between px-4 py-3 rounded-2xl shadow-sm transition-all active:opacity-90"
            style={{ backgroundImage: "linear-gradient(to right, #8dc63f, #4cb748)" }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">🗺️</span>
              <div className="text-left">
                <p className="text-xs text-green-100 leading-none mb-0.5">지역별 현황</p>
                <p className="font-black text-sm text-white">행정구역별 랭킹지도</p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-white/80">
              <span className="text-xs">바로가기</span>
              <span className="text-base">›</span>
            </div>
          </button>
        </div>
      )}

      {/* ── 뷰 전환 탭 (유저 / 지역 / 분석) ── */}
      <div className="flex bg-white border-b sticky top-0 z-10 shadow-sm">
        {VIEW_TABS.map((v) => {
          const TabIcon = v.Icon;
          return (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-1
                ${view === v.id ? "border-green-500 text-green-600" : "border-transparent text-gray-400"}`}
            >
              <TabIcon className="w-4 h-4" strokeWidth={1.8} />
              {v.label}
            </button>
          );
        })}
      </div>

      <div className="px-4 mt-4">

        {/* ─────── 유저 랭킹 뷰 ─────── */}
        {view === "list" && (
          <div className="space-y-3">
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

            {/* 기간 네비게이션 (주간/월간) */}
            {period !== "all" && (
              <div className="flex items-center justify-between bg-white rounded-xl px-3 py-2 shadow-sm">
                <button
                  onClick={() => setOffset(offset - 1)}
                  className="p-1.5 rounded-lg bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-500" strokeWidth={2} />
                </button>
                <span className="text-sm font-bold text-gray-700">
                  {formatPeriodLabel(period, offset)}
                </span>
                <button
                  onClick={() => setOffset(offset + 1)}
                  disabled={isFutureOffset(period, offset)}
                  className="p-1.5 rounded-lg bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4 text-gray-500" strokeWidth={2} />
                </button>
              </div>
            )}

            {/* 항목 탭 */}
            <div className="flex gap-2">
              {TABS.map((t) => {
                const TabIcon = t.Icon;
                return (
                  <button key={t.id} onClick={() => setTab(t.id)}
                    className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-sm font-medium border
                      ${tab === t.id ? "bg-green-500 text-white border-green-500" : "bg-white text-gray-500 border-gray-200"}`}>
                    <TabIcon size={14} strokeWidth={2} /> {t.label}
                  </button>
                );
              })}
            </div>

            {/* 내 순위 카드 */}
            {myRank && (
              <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center overflow-hidden">
                  {myRank.photoURL
                    ? <img src={myRank.photoURL} alt="" className="w-full h-full object-cover" />
                    : <User size={20} className="text-green-400" strokeWidth={1.8} />
                  }
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-400">내 순위</p>
                  <p className="font-bold text-gray-800 flex items-center gap-1">
                    {medalColor(myRank.rank)
                      ? <><Medal size={16} className={medalColor(myRank.rank)} strokeWidth={2} /><span>{medalLabel(myRank.rank)}</span></>
                      : `#${myRank.rank}`} {myRank.displayName}
                  </p>
                </div>
                <span className="font-bold text-green-600 text-sm">{fmt(myRank)}</span>
              </div>
            )}

            {/* TOP 3 시상대 */}
            {!loading && rankList.length >= 3 && (
              <div className="flex items-end justify-center gap-3 mt-2 mb-1">
                {[rankList[1], rankList[0], rankList[2]].map((item, pos) => {
                  const heights = ["h-20", "h-28", "h-16"];
                  const mColors = ["text-gray-400", "text-yellow-500", "text-amber-600"];
                  const bgs     = ["bg-gray-200", "bg-yellow-100", "bg-orange-100"];
                  return (
                    <div key={item.uid} className="flex-1 min-w-0 text-center">
                      <div className="w-12 h-12 rounded-full bg-gray-100 mx-auto overflow-hidden mb-1 flex items-center justify-center">
                        {item.photoURL
                          ? <img src={item.photoURL} alt="" className="w-full h-full object-cover" />
                          : <User size={22} className="text-gray-300" strokeWidth={1.8} />
                        }
                      </div>
                      <div className={`${bgs[pos]} ${heights[pos]} rounded-t-xl flex flex-col items-center justify-center px-1 w-full`}>
                        <Medal size={22} className={mColors[pos]} strokeWidth={2} />
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
                  <p className="text-gray-500 text-sm">이 기간에는 참여자가 없어요!</p>
                  {offset !== 0 && (
                    <button onClick={() => setOffset(0)} className="mt-2 text-green-500 text-sm font-bold">
                      이번 {period === "weekly" ? "주" : "달"}로 돌아가기
                    </button>
                  )}
                </div>
              ) : (
                rankList.slice(0, 20).map((item, idx) => {
                  const rank = idx + 1;
                  const isMe = user?.uid === item.uid;
                  return (
                    <div key={item.uid}
                      className={`flex items-center gap-3 px-4 py-3 border-b last:border-0 ${isMe ? "bg-green-50" : ""}`}>
                      <div className="w-7 text-center">
                        {medalColor(rank)
                          ? <Medal size={18} className={medalColor(rank)} strokeWidth={2} />
                          : <span className="text-sm font-bold text-gray-400">#{rank}</span>}
                      </div>
                      <div className="w-9 h-9 rounded-full bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {item.photoURL
                          ? <img src={item.photoURL} alt="" className="w-full h-full object-cover" />
                          : <User size={18} className="text-gray-300" strokeWidth={1.8} />
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

        {/* ─────── 분석 뷰 ─────── */}
        {view === "analysis" && <AnalysisView user={user} />}
      </div>
    </div>
  );
}

// ── Suspense 래핑 (useSearchParams 필수) ─────────────────
export default function RankingPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <p className="animate-pulse text-lg flex items-center gap-2 text-gray-500"><Trophy className="w-5 h-5 text-yellow-500" strokeWidth={2} /> 랭킹 로딩 중...</p>
      </div>
    }>
      <RankingPageInner />
    </Suspense>
  );
}
