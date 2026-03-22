"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection, query, orderBy, getDocs,
  updateDoc, doc
} from "firebase/firestore";
import { useRouter } from "next/navigation";

// 관리자 이메일 (본인 이메일로 변경)
const ADMIN_EMAIL = "hubmission@gmail.com";

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [exchanges, setExchanges] = useState([]);
  const [users, setUsers] = useState([]);
  const [tab, setTab] = useState("exchanges");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    if (user.email !== ADMIN_EMAIL) {
      router.push("/");
      return;
    }
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchData = async () => {
    try {
      // 교환 신청 목록
      const exSnap = await getDocs(
        query(collection(db, "exchanges"), orderBy("createdAt", "desc"))
      );
      setExchanges(exSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      // 유저 목록
      const uSnap = await getDocs(
        query(collection(db, "users"), orderBy("totalPoints", "desc"))
      );
      setUsers(uSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleStatus = async (exchangeId, status) => {
    await updateDoc(doc(db, "exchanges", exchangeId), { status });
    setExchanges((prev) =>
      prev.map((e) => e.id === exchangeId ? { ...e, status } : e)
    );
  };

  const formatDate = (ts) => {
    if (!ts) return "-";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("ko-KR");
  };

  const statusBadge = (status) => {
    const map = {
      pending:   { label: "대기중",  color: "bg-yellow-100 text-yellow-700" },
      approved:  { label: "승인됨",  color: "bg-green-100 text-green-700" },
      completed: { label: "완료됨",  color: "bg-blue-100 text-blue-700" },
      rejected:  { label: "거절됨",  color: "bg-red-100 text-red-700" },
    };
    const s = map[status] || map.pending;
    return <span className={`text-xs px-2 py-0.5 rounded-full ${s.color}`}>{s.label}</span>;
  };

  if (!user || user.email !== ADMIN_EMAIL) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* 헤더 */}
      <div className="bg-gradient-to-b from-gray-800 to-gray-700 px-4 pt-12 pb-6 text-white">
        <h1 className="text-2xl font-bold">⚙️ 관리자 페이지</h1>
        <p className="text-gray-300 text-sm mt-1">오백원의 행복 운영 대시보드</p>
      </div>

      {/* 통계 카드 */}
      <div className="mx-4 -mt-4 grid grid-cols-3 gap-2 mb-4">
        {[
          { label: "총 회원",    value: users.length,    icon: "👤" },
          { label: "교환 신청",  value: exchanges.filter(e => e.status === "pending").length, icon: "🎁" },
          { label: "총 포인트",  value: users.reduce((a, u) => a + (u.totalPoints || 0), 0).toLocaleString(), icon: "💰" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl shadow-sm p-3 text-center">
            <p className="text-xl">{s.icon}</p>
            <p className="font-bold text-gray-800 text-lg">{s.value}</p>
            <p className="text-xs text-gray-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* 탭 */}
      <div className="flex bg-white border-b mx-0 sticky top-0 z-10">
        {[
          { id: "exchanges", label: "🎁 교환 신청" },
          { id: "users",     label: "👤 회원 목록" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id ? "border-gray-700 text-gray-800" : "border-transparent text-gray-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {loading ? (
          <div className="text-center py-12 text-gray-400">불러오는 중...</div>
        ) : (
          <>
            {/* 교환 신청 목록 */}
            {tab === "exchanges" && (
              <div className="space-y-3">
                {exchanges.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">교환 신청 없음</div>
                ) : (
                  exchanges.map((ex) => (
                    <div key={ex.id} className="bg-white rounded-2xl shadow-sm p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-bold text-sm">{ex.rewardName}</p>
                          <p className="text-xs text-gray-400">{ex.email}</p>
                          <p className="text-xs text-gray-400">{formatDate(ex.createdAt)}</p>
                        </div>
                        <div className="text-right">
                          {statusBadge(ex.status)}
                          <p className="text-sm font-bold text-red-500 mt-1">
                            -{ex.pointsUsed?.toLocaleString()}P
                          </p>
                        </div>
                      </div>
                      {ex.status === "pending" && (
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleStatus(ex.id, "approved")}
                            className="flex-1 bg-green-500 text-white py-1.5 rounded-lg text-sm font-bold"
                          >
                            ✅ 승인
                          </button>
                          <button
                            onClick={() => handleStatus(ex.id, "completed")}
                            className="flex-1 bg-blue-500 text-white py-1.5 rounded-lg text-sm font-bold"
                          >
                            📦 완료
                          </button>
                          <button
                            onClick={() => handleStatus(ex.id, "rejected")}
                            className="flex-1 bg-red-400 text-white py-1.5 rounded-lg text-sm font-bold"
                          >
                            ❌ 거절
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 회원 목록 */}
            {tab === "users" && (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {users.map((u, i) => (
                  <div key={u.id} className="flex items-center px-4 py-3 border-b last:border-0">
                    <span className="w-6 text-sm text-gray-400 font-bold">{i + 1}</span>
                    <div className="flex-1 ml-2">
                      <p className="text-sm font-medium">{u.nickname || u.email?.split("@")[0]}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-600">
                        {u.totalPoints?.toLocaleString() || 0}P
                      </p>
                      <p className="text-xs text-gray-400">
                        {u.ploggingCount || 0}회 · {(u.totalDistance || 0).toFixed(1)}km
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}