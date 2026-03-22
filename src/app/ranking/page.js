"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

const TABS = [
  { id: "personal", label: "👤 개인", icon: "👤" },
  { id: "monthly",  label: "📅 이달",  icon: "📅" },
  { id: "region",   label: "🗺️ 지역",  icon: "🗺️" },
];

const REGION_LIST = [
  { code: "11", name: "서울특별시",  emoji: "🏙️" },
  { code: "26", name: "부산광역시",  emoji: "🌊" },
  { code: "27", name: "대구광역시",  emoji: "🌆" },
  { code: "28", name: "인천광역시",  emoji: "✈️" },
  { code: "29", name: "광주광역시",  emoji: "🎨" },
  { code: "30", name: "대전광역시",  emoji: "🔬" },
  { code: "31", name: "울산광역시",  emoji: "🏭" },
  { code: "36", name: "세종특별자치시", emoji: "🏛️" },
  { code: "41", name: "경기도",      emoji: "🌳" },
  { code: "43", name: "충청북도",    emoji: "🌾" },
];

// 등수 아이콘
function RankBadge({ rank }) {
  if (rank === 1) return <span className="text-2xl">🥇</span>;
  if (rank === 2) return <span className="text-2xl">🥈</span>;
  if (rank === 3) return <span className="text-2xl">🥉</span>;
  return (
    <span className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-sm font-bold text-gray-600">
      {rank}
    </span>
  );
}

export default function RankingPage() {
  const [tab, setTab] = useState("personal");
  const [personalRank, setPersonalRank] = useState([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (tab === "personal") fetchPersonalRank();
  }, [tab]);

  const fetchPersonalRank = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "users"),
        orderBy("totalPoints", "desc"),
        limit(50)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((doc, i) => ({
        rank: i + 1,
        ...doc.data(),
      }));
      setPersonalRank(list);
    } catch (e) {
      console.error("랭킹 불러오기 실패:", e);
    } finally {
      setLoading(false);
    }
  };

  // 현재 사용자 순위 찾기
  const myRank = personalRank.findIndex((u) => u.uid === user?.uid) + 1;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* 헤더 */}
      <div className="bg-gradient-to-b from-blue-600 to-blue-500 px-4 pt-12 pb-6 text-white">
        <h1 className="text-2xl font-bold">🏆 랭킹</h1>
        <p className="text-blue-100 text-sm mt-1">플로깅 챔피언에 도전하세요!</p>

        {/* 내 순위 */}
        {user && myRank > 0 && (
          <div className="mt-3 bg-white/20 rounded-xl px-4 py-2 inline-flex items-center gap-2">
            <span className="text-sm">내 순위</span>
            <span className="font-bold text-lg">{myRank}위</span>
          </div>
        )}
      </div>

      {/* 탭 */}
      <div className="flex bg-white border-b sticky top-0 z-10">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
              tab === t.id
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 개인 랭킹 */}
      {tab === "personal" && (
        <div className="p-4">
          {/* TOP 3 */}
          {personalRank.length >= 3 && (
            <div className="flex items-end justify-center gap-3 mb-6 mt-2">
              {/* 2위 */}
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center text-2xl mb-1">
                  🥈
                </div>
                <p className="text-xs font-medium text-center truncate w-16">
                  {personalRank[1]?.email?.split("@")[0] || "-"}
                </p>
                <p className="text-sm font-bold text-gray-500">
                  {personalRank[1]?.totalPoints?.toLocaleString() || 0}P
                </p>
                <div className="w-16 h-16 bg-gray-200 rounded-t-lg mt-1 flex items-end justify-center pb-1">
                  <span className="text-xs font-bold text-gray-600">2위</span>
                </div>
              </div>
              {/* 1위 */}
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center text-3xl mb-1">
                  🥇
                </div>
                <p className="text-xs font-medium text-center truncate w-16">
                  {personalRank[0]?.email?.split("@")[0] || "-"}
                </p>
                <p className="text-sm font-bold text-yellow-600">
                  {personalRank[0]?.totalPoints?.toLocaleString() || 0}P
                </p>
                <div className="w-16 h-24 bg-yellow-200 rounded-t-lg mt-1 flex items-end justify-center pb-1">
                  <span className="text-xs font-bold text-yellow-700">1위</span>
                </div>
              </div>
              {/* 3위 */}
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center text-2xl mb-1">
                  🥉
                </div>
                <p className="text-xs font-medium text-center truncate w-16">
                  {personalRank[2]?.email?.split("@")[0] || "-"}
                </p>
                <p className="text-sm font-bold text-orange-500">
                  {personalRank[2]?.totalPoints?.toLocaleString() || 0}P
                </p>
                <div className="w-16 h-10 bg-orange-200 rounded-t-lg mt-1 flex items-end justify-center pb-1">
                  <span className="text-xs font-bold text-orange-600">3위</span>
                </div>
              </div>
            </div>
          )}

          {/* 4위 이하 목록 */}
          {loading ? (
            <div className="text-center py-8 text-gray-400">불러오는 중...</div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {personalRank.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <p className="text-3xl mb-2">🌱</p>
                  <p>아직 참여자가 없어요</p>
                  <p className="text-sm mt-1">첫 번째 플로거가 되어보세요!</p>
                </div>
              ) : (
                personalRank.slice(3).map((u) => (
                  <div
                    key={u.uid}
                    className={`flex items-center px-4 py-3 border-b last:border-0 ${
                      u.uid === user?.uid ? "bg-blue-50" : ""
                    }`}
                  >
                    <RankBadge rank={u.rank} />
                    <div className="ml-3 flex-1">
                      <p className="font-medium text-sm">
                        {u.email?.split("@")[0] || "익명"}
                        {u.uid === user?.uid && (
                          <span className="ml-1 text-xs text-blue-500">(나)</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">
                        {u.ploggingCount || 0}회 · {(u.totalDistance || 0).toFixed(1)}km
                      </p>
                    </div>
                    <span className="font-bold text-blue-600">
                      {u.totalPoints?.toLocaleString() || 0}P
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* 이달의 랭킹 */}
      {tab === "monthly" && (
        <div className="p-4">
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
            <p className="text-4xl mb-3">📅</p>
            <p className="font-bold text-gray-700">이달의 랭킹</p>
            <p className="text-sm text-gray-400 mt-2">
              {new Date().getMonth() + 1}월 랭킹 집계 중...
            </p>
            <p className="text-xs text-gray-300 mt-4">
              월별 랭킹은 매월 1일 초기화됩니다
            </p>
          </div>

          {/* 이달 개인 랭킹 (간략) */}
          <div className="mt-4 bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <p className="font-bold text-gray-700 text-sm">
                {new Date().getMonth() + 1}월 누적 포인트 TOP 10
              </p>
            </div>
            {personalRank.slice(0, 10).map((u) => (
              <div
                key={u.uid}
                className={`flex items-center px-4 py-3 border-b last:border-0 ${
                  u.uid === user?.uid ? "bg-blue-50" : ""
                }`}
              >
                <RankBadge rank={u.rank} />
                <div className="ml-3 flex-1">
                  <p className="font-medium text-sm">
                    {u.email?.split("@")[0] || "익명"}
                    {u.uid === user?.uid && (
                      <span className="ml-1 text-xs text-blue-500">(나)</span>
                    )}
                  </p>
                </div>
                <span className="font-bold text-blue-600">
                  {u.totalPoints?.toLocaleString() || 0}P
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 지역 랭킹 */}
      {tab === "region" && (
        <div className="p-4">
          <p className="text-sm text-gray-500 mb-3">
            지역별 총 플로깅 거리 랭킹입니다
          </p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {REGION_LIST.map((region, i) => (
              <div
                key={region.code}
                className="flex items-center px-4 py-3 border-b last:border-0"
              >
                <RankBadge rank={i + 1} />
                <span className="text-2xl ml-3">{region.emoji}</span>
                <div className="ml-3 flex-1">
                  <p className="font-medium text-sm">{region.name}</p>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                    <div
                      className="bg-blue-400 h-1.5 rounded-full"
                      style={{ width: `${Math.max(5, 100 - i * 9)}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs text-gray-400 ml-2">
                  {(100 - i * 9).toFixed(0)}km
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 text-center mt-3">
            * 지역 데이터는 실 사용자 증가 후 업데이트 예정
          </p>
        </div>
      )}
    </div>
  );
}