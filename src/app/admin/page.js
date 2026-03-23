"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection, query, getDocs, orderBy, limit,
  doc, updateDoc, where, getCountFromServer
} from "firebase/firestore";

// ─── 관리자 UID 목록 (Firebase UID로 교체) ──────────────────
// .env.local에 NEXT_PUBLIC_ADMIN_UIDS=uid1,uid2 형태로 설정 가능
const ADMIN_UIDS = (process.env.NEXT_PUBLIC_ADMIN_UIDS || "").split(",").filter(Boolean);

// ─── 통계 카드 ────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color = "green" }) {
  const colors = {
    green:  "bg-green-50 text-green-700",
    blue:   "bg-blue-50 text-blue-700",
    orange: "bg-orange-50 text-orange-700",
    purple: "bg-purple-50 text-purple-700",
  };
  return (
    <div className={`rounded-2xl p-4 ${colors[color]}`}>
      <div className="text-2xl mb-1">{icon}</div>
      <p className="text-2xl font-black">{value}</p>
      <p className="text-xs font-medium opacity-70">{label}</p>
      {sub && <p className="text-xs opacity-50 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AdminPage() {
  const { user } = useAuth();
  const router   = useRouter();

  const [stats, setStats]           = useState(null);
  const [recentUsers, setRecentUsers] = useState([]);
  const [rewards, setRewards]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState("dashboard"); // dashboard | users | rewards

  // ── 권한 체크 ────────────────────────────────────────────
  const isAdmin = user && (
    ADMIN_UIDS.includes(user.uid) ||
    user.email === "hubmission@gmail.com" // 감독님 이메일
  );

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // ── 통계 집계 ──
      const [usersSnap, routesSnap, rewardsSnap] = await Promise.all([
        getCountFromServer(collection(db, "users")),
        getCountFromServer(collection(db, "routes")),
        getCountFromServer(collection(db, "reward_history")),
      ]);

      // 총 거리·포인트 합계
      const routesDocs = await getDocs(collection(db, "routes"));
      let totalDist = 0, totalPts = 0;
      routesDocs.forEach((d) => {
        totalDist += d.data().distance || 0;
        totalPts  += d.data().points   || 0;
      });

      setStats({
        userCount:    usersSnap.data().count,
        routeCount:   routesSnap.data().count,
        rewardCount:  rewardsSnap.data().count,
        totalDist:    totalDist,
        totalPoints:  totalPts,
      });

      // ── 최근 가입 유저 10명 ──
      const usersQ = query(collection(db, "users"), limit(10));
      const usersDocSnap = await getDocs(usersQ);
      const usersArr = usersDocSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const at = a.createdAt?.toMillis?.() || 0;
          const bt = b.createdAt?.toMillis?.() || 0;
          return bt - at;
        });
      setRecentUsers(usersArr);

      // ── 처리 대기 리워드 신청 ──
      const rewardsQ = query(
        collection(db, "reward_history"),
        where("status", "==", "pending"),
        limit(20)
      );
      const rewardsDocSnap = await getDocs(rewardsQ);
      setRewards(rewardsDocSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("관리자 데이터 로드 실패:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    if (!isAdmin) { router.push("/"); return; }
    fetchAll();
  }, [user, isAdmin, fetchAll, router]);

  // ── 리워드 처리 ─────────────────────────────────────────
  const handleRewardStatus = async (rewardId, status) => {
    try {
      await updateDoc(doc(db, "reward_history", rewardId), { status });
      setRewards((prev) => prev.filter((r) => r.id !== rewardId));
    } catch (e) {
      alert("처리 실패: " + e.message);
    }
  };

  if (!user || !isAdmin) return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-gray-400">접근 권한이 없습니다.</p>
    </div>
  );

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <p className="animate-pulse text-lg">🔧 관리자 데이터 로딩 중...</p>
    </div>
  );

  return (
    <div
      className="min-h-screen bg-gray-50"
      style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom, 20px))" }}
    >
      {/* ── 헤더 ── */}
      <div className="bg-gray-900 text-white px-4 pt-12 pb-5">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">🔧 관리자 대시보드</h1>
            <p className="text-gray-400 text-xs mt-0.5">{user.email}</p>
          </div>
          <button
            onClick={fetchAll}
            className="bg-gray-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
          >
            새로고침
          </button>
        </div>
      </div>

      {/* ── 탭 ── */}
      <div className="flex bg-white border-b">
        {[
          { id: "dashboard", label: "📊 통계" },
          { id: "users",     label: "👥 유저" },
          { id: "rewards",   label: `🎁 리워드 ${rewards.length > 0 ? `(${rewards.length})` : ""}` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors
              ${activeTab === tab.id
                ? "border-green-500 text-green-600"
                : "border-transparent text-gray-400"
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* ─────── 대시보드 탭 ─────── */}
        {activeTab === "dashboard" && stats && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon="👤" label="총 가입자" value={`${stats.userCount}명`}  color="blue"   />
              <StatCard icon="🏃" label="총 플로깅" value={`${stats.routeCount}회`} color="green"  />
              <StatCard icon="📍" label="총 거리"   value={`${stats.totalDist.toFixed(0)}km`} color="orange" />
              <StatCard icon="🎁" label="리워드 신청" value={`${stats.rewardCount}건`} color="purple" />
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h2 className="font-bold text-gray-700 mb-2">📈 운영 현황 요약</h2>
              {[
                { label: "총 적립 포인트", value: `${stats.totalPoints.toLocaleString()}P` },
                { label: "유저당 평균 거리", value: `${stats.userCount ? (stats.totalDist / stats.userCount).toFixed(1) : 0}km` },
                { label: "유저당 평균 플로깅", value: `${stats.userCount ? (stats.routeCount / stats.userCount).toFixed(1) : 0}회` },
                { label: "대기 중 리워드", value: `${rewards.length}건`, highlight: rewards.length > 0 },
              ].map((item) => (
                <div key={item.label} className="flex justify-between py-2 border-b last:border-0 text-sm">
                  <span className="text-gray-500">{item.label}</span>
                  <span className={`font-bold ${item.highlight ? "text-red-500" : "text-gray-700"}`}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ─────── 유저 탭 ─────── */}
        {activeTab === "users" && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b">
              <h2 className="font-bold text-gray-700">최근 가입 유저 (최대 10명)</h2>
            </div>
            {recentUsers.map((u) => {
              const date = u.createdAt?.toDate?.();
              const dateStr = date
                ? `${date.getMonth() + 1}/${date.getDate()}`
                : "-";
              return (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-0">
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm flex-shrink-0">
                    {u.photoURL
                      ? <img src={u.photoURL} alt="" className="w-full h-full rounded-full object-cover" />
                      : "👤"
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">
                      {u.displayName || u.email || "익명"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {u.provider || "email"} · {dateStr} 가입
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-bold text-green-600">{u.totalPoints || 0}P</p>
                    <p className="text-xs text-gray-400">{u.ploggingCount || 0}회</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─────── 리워드 탭 ─────── */}
        {activeTab === "rewards" && (
          <>
            {rewards.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                <div className="text-4xl mb-2">✅</div>
                <p className="text-gray-500">처리 대기 중인 리워드 신청이 없어요</p>
              </div>
            ) : (
              rewards.map((r) => {
                const date = r.createdAt?.toDate?.();
                const dateStr = date
                  ? `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`
                  : "-";
                return (
                  <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-bold text-gray-800 text-sm">{r.rewardTitle}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {dateStr} · {r.cost}P 차감
                        </p>
                        <p className="text-xs text-gray-400">UID: {r.userId?.slice(0, 8)}...</p>
                      </div>
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                        처리 대기
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRewardStatus(r.id, "rejected")}
                        className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-xl text-sm font-medium"
                      >
                        반려
                      </button>
                      <button
                        onClick={() => handleRewardStatus(r.id, "completed")}
                        className="flex-1 bg-green-500 text-white py-2 rounded-xl text-sm font-bold"
                      >
                        ✅ 처리 완료
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );
}