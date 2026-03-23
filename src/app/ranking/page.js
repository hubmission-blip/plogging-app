"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection, query, where, getDocs, doc, getDoc
} from "firebase/firestore";

// ─── 탭 타입 ─────────────────────────────────────────────
const TABS = [
  { id: "points",   label: "포인트",  icon: "💰" },
  { id: "distance", label: "거리",    icon: "📍" },
  { id: "count",    label: "횟수",    icon: "🏃" },
];

const PERIOD_TABS = [
  { id: "weekly",  label: "주간" },
  { id: "monthly", label: "월간" },
  { id: "all",     label: "전체" },
];

// ─── 현재 주/월 범위 계산 ─────────────────────────────────
function getPeriodRange(period) {
  const now = new Date();
  if (period === "weekly") {
    const day = now.getDay(); // 0=일
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - day);
    startOfWeek.setHours(0, 0, 0, 0);
    return startOfWeek;
  }
  if (period === "monthly") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return null; // 전체
}

export default function RankingPage() {
  const { user } = useAuth();

  const [tab, setTab] = useState("points");
  const [period, setPeriod] = useState("weekly");
  const [rankList, setRankList] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── 랭킹 데이터 조회 ────────────────────────────────────
  const fetchRanking = useCallback(async () => {
    setLoading(true);
    try {
      const sinceDate = getPeriodRange(period);

      // 1. routes 컬렉션에서 기간 내 플로깅 데이터 집계
      let routesQuery;
      if (sinceDate) {
        routesQuery = query(
          collection(db, "routes"),
          where("createdAt", ">=", sinceDate)
        );
      } else {
        routesQuery = query(collection(db, "routes"));
      }

      const routesSnap = await getDocs(routesQuery);

      // userId 별로 집계
      const aggregated = {};
      routesSnap.forEach((docSnap) => {
        const d = docSnap.data();
        const uid = d.userId;
        if (!uid) return;
        if (!aggregated[uid]) {
          aggregated[uid] = { points: 0, distance: 0, count: 0 };
        }
        aggregated[uid].points   += d.points   || 0;
        aggregated[uid].distance += d.distance || 0;
        aggregated[uid].count    += 1;
      });

      // 2. 유저 정보 병합 (displayName, photoURL)
      const uids = Object.keys(aggregated);
      const userInfoMap = {};
      await Promise.all(
        uids.map(async (uid) => {
          try {
            const userSnap = await getDoc(doc(db, "users", uid));
            if (userSnap.exists()) {
              const uData = userSnap.data();
              userInfoMap[uid] = {
                displayName: uData.displayName || uData.email?.split("@")[0] || "익명",
                photoURL:    uData.photoURL || "",
              };
            } else {
              userInfoMap[uid] = { displayName: "익명", photoURL: "" };
            }
          } catch {
            userInfoMap[uid] = { displayName: "익명", photoURL: "" };
          }
        })
      );

      // 3. 정렬
      const sorted = uids
        .map((uid) => ({
          uid,
          ...aggregated[uid],
          ...userInfoMap[uid],
        }))
        .sort((a, b) => b[tab] - a[tab]);

      setRankList(sorted);

      // 내 순위 찾기
      if (user) {
        const myIdx = sorted.findIndex((r) => r.uid === user.uid);
        setMyRank(myIdx >= 0 ? { rank: myIdx + 1, ...sorted[myIdx] } : null);
      }
    } catch (e) {
      console.error("랭킹 로드 실패:", e);
    } finally {
      setLoading(false);
    }
  }, [tab, period, user]);

  useEffect(() => {
    fetchRanking();
  }, [fetchRanking]);

  // ── 값 포맷 ─────────────────────────────────────────────
  const formatValue = (item) => {
    if (tab === "points")   return `${item.points.toLocaleString()}P`;
    if (tab === "distance") return `${item.distance.toFixed(1)}km`;
    return `${item.count}회`;
  };

  // ── 메달 아이콘 ─────────────────────────────────────────
  const getMedal = (rank) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return null;
  };

  return (
    <div
      className="min-h-screen bg-gray-50"
      style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom, 20px))" }}
    >
      {/* ── 헤더 ── */}
      <div className="bg-green-600 text-white px-4 pt-12 pb-6">
        <h1 className="text-2xl font-bold mb-1">🏆 랭킹</h1>
        <p className="text-green-200 text-sm">함께하는 플로깅, 더 깨끗한 지구</p>
      </div>

      {/* ── 내 순위 카드 ── */}
      {myRank && (
        <div className="mx-4 -mt-3 bg-white rounded-2xl shadow-lg p-4 flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-lg overflow-hidden">
            {myRank.photoURL
              ? <img src={myRank.photoURL} alt="" className="w-full h-full object-cover" />
              : "😊"
            }
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-400">내 현재 순위</p>
            <p className="font-bold text-gray-800">
              {getMedal(myRank.rank) || `#${myRank.rank}`} {myRank.displayName}
            </p>
          </div>
          <span className="text-green-600 font-bold text-sm">{formatValue(myRank)}</span>
        </div>
      )}

      {/* ── 기간 탭 ── */}
      <div className="flex gap-1 mx-4 mt-4 bg-gray-100 rounded-xl p-1">
        {PERIOD_TABS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors
              ${period === p.id ? "bg-white text-green-600 shadow-sm" : "text-gray-500"}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── 항목 탭 ── */}
      <div className="flex gap-2 mx-4 mt-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-sm font-medium border transition-colors
              ${tab === t.id
                ? "bg-green-500 text-white border-green-500"
                : "bg-white text-gray-500 border-gray-200"
              }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── TOP 3 시상대 ── */}
      {!loading && rankList.length >= 3 && (
        <div className="flex items-end justify-center gap-3 mx-4 mt-6 mb-2">
          {/* 2위 */}
          <div className="flex-1 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 mx-auto flex items-center justify-center text-xl overflow-hidden mb-2">
              {rankList[1].photoURL
                ? <img src={rankList[1].photoURL} alt="" className="w-full h-full object-cover" />
                : "😊"
              }
            </div>
            <div className="bg-gray-200 rounded-t-xl pt-3 pb-2 px-2">
              <p className="text-lg">🥈</p>
              <p className="text-xs font-bold text-gray-700 truncate">{rankList[1].displayName}</p>
              <p className="text-xs text-gray-500">{formatValue(rankList[1])}</p>
            </div>
          </div>
          {/* 1위 */}
          <div className="flex-1 text-center">
            <div className="w-14 h-14 rounded-full bg-yellow-100 mx-auto flex items-center justify-center text-2xl overflow-hidden mb-2 border-2 border-yellow-400">
              {rankList[0].photoURL
                ? <img src={rankList[0].photoURL} alt="" className="w-full h-full object-cover" />
                : "😎"
              }
            </div>
            <div className="bg-yellow-100 rounded-t-xl pt-4 pb-2 px-2">
              <p className="text-xl">🥇</p>
              <p className="text-xs font-bold text-gray-800 truncate">{rankList[0].displayName}</p>
              <p className="text-xs text-yellow-600 font-medium">{formatValue(rankList[0])}</p>
            </div>
          </div>
          {/* 3위 */}
          <div className="flex-1 text-center">
            <div className="w-12 h-12 rounded-full bg-orange-100 mx-auto flex items-center justify-center text-xl overflow-hidden mb-2">
              {rankList[2]?.photoURL
                ? <img src={rankList[2].photoURL} alt="" className="w-full h-full object-cover" />
                : "😊"
              }
            </div>
            <div className="bg-orange-100 rounded-t-xl pt-2 pb-2 px-2">
              <p className="text-lg">🥉</p>
              <p className="text-xs font-bold text-gray-700 truncate">{rankList[2]?.displayName}</p>
              <p className="text-xs text-gray-500">{rankList[2] ? formatValue(rankList[2]) : "-"}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── 전체 리스트 ── */}
      <div className="mx-4 mt-3 bg-white rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 text-center">
            <p className="text-gray-400 animate-pulse">랭킹 불러오는 중... 🌿</p>
          </div>
        ) : rankList.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-4xl mb-2">🌱</p>
            <p className="text-gray-500">아직 참여자가 없어요!</p>
            <p className="text-sm text-gray-400 mt-1">첫 번째 플로깅으로 1위를 차지해보세요</p>
          </div>
        ) : (
          rankList.slice(0, 20).map((item, idx) => {
            const rank = idx + 1;
            const isMe = user && item.uid === user.uid;
            return (
              <div
                key={item.uid}
                className={`flex items-center gap-3 px-4 py-3 border-b last:border-0
                  ${isMe ? "bg-green-50" : ""}`}
              >
                {/* 순위 */}
                <div className="w-8 text-center">
                  {getMedal(rank)
                    ? <span className="text-xl">{getMedal(rank)}</span>
                    : <span className="text-sm font-bold text-gray-400">#{rank}</span>
                  }
                </div>
                {/* 아바타 */}
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden text-lg flex-shrink-0">
                  {item.photoURL
                    ? <img src={item.photoURL} alt="" className="w-full h-full object-cover" />
                    : "😊"
                  }
                </div>
                {/* 이름 */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isMe ? "text-green-700" : "text-gray-700"}`}>
                    {item.displayName} {isMe && <span className="text-xs text-green-500">(나)</span>}
                  </p>
                  <p className="text-xs text-gray-400">
                    {item.count}회 · {item.distance.toFixed(1)}km
                  </p>
                </div>
                {/* 값 */}
                <span className={`text-sm font-bold flex-shrink-0 ${isMe ? "text-green-600" : "text-gray-700"}`}>
                  {formatValue(item)}
                </span>
              </div>
            );
          })
        )}
      </div>

      <p className="text-center text-xs text-gray-300 mt-4 mb-2">
        상위 20명 표시 · 매일 자정 기준 갱신
      </p>
    </div>
  );
}