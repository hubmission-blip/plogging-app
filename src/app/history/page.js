"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { getRouteColor, getRelativeWeek } from "@/lib/routeUtils";
import { useRouter } from "next/navigation";
import Link from "next/link";

const WEEK_LABELS = ["이번 주", "2주 전", "3주 전", "4주 전"];

export default function HistoryPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(""); // ✅ 에러 표시용
  const [totalStats, setTotalStats] = useState({ count: 0, distance: 0, points: 0 });
  const router = useRouter();

  // ✅ fetchHistory를 useCallback으로 정의 + useEffect 안으로 이동
  const fetchHistory = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      // ✅ orderBy 제거 → 클라이언트에서 정렬 (인덱스 불필요)
      const q = query(
        collection(db, "routes"),
        where("userId", "==", user.uid)
      );
      const snap = await getDocs(q);

      // ✅ 클라이언트에서 날짜 내림차순 정렬
      const list = snap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
          const aTime = a.createdAt?.toDate?.() || new Date(0);
          const bTime = b.createdAt?.toDate?.() || new Date(0);
          return bTime - aTime;
        });

      setRecords(list);

      const stats = list.reduce(
        (acc, r) => ({
          count: acc.count + 1,
          distance: acc.distance + (r.distance || 0),
          points: acc.points + (r.points || 0),
        }),
        { count: 0, distance: 0, points: 0 }
      );
      setTotalStats(stats);
    } catch (e) {
      console.error("기록 불러오기 실패:", e);
      setError("기록을 불러오지 못했습니다: " + e.message); // ✅ 에러 표시
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    fetchHistory();
  }, [user, router, fetchHistory]);

  const formatDate = (timestamp) => {
    if (!timestamp) return "-";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric", month: "long", day: "numeric", weekday: "short",
    });
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* 헤더 */}
      <div className="bg-gradient-to-b from-green-600 to-green-500 px-4 pt-12 pb-6 text-white">
        <h1 className="text-2xl font-bold">📋 플로깅 기록</h1>
        <p className="text-green-100 text-sm mt-1">나의 모든 플로깅 히스토리</p>
      </div>

      {/* 총 통계 */}
      <div className="mx-4 -mt-4 bg-white rounded-2xl shadow-lg p-4 mb-4 grid grid-cols-3 gap-2">
        <div className="text-center">
          <p className="text-2xl font-bold text-green-600">{totalStats.count}</p>
          <p className="text-xs text-gray-400 mt-0.5">총 횟수</p>
        </div>
        <div className="text-center border-x">
          <p className="text-2xl font-bold text-blue-500">
            {totalStats.distance.toFixed(1)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">총 km</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-yellow-500">
            {totalStats.points.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">총 포인트</p>
        </div>
      </div>

      {/* 기록 목록 */}
      <div className="mx-4">
        {loading ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-3xl mb-2">⏳</p>
            <p>불러오는 중...</p>
          </div>
        ) : error ? (
          // ✅ 에러 메시지 표시
          <div className="text-center py-12">
            <p className="text-3xl mb-2">⚠️</p>
            <p className="text-red-500 text-sm">{error}</p>
            <button
              onClick={fetchHistory}
              className="mt-4 bg-green-500 text-white px-6 py-2 rounded-full font-bold text-sm"
            >
              다시 시도
            </button>
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-5xl mb-3">🌱</p>
            <p className="text-gray-500 font-medium">아직 플로깅 기록이 없어요</p>
            <p className="text-gray-400 text-sm mt-1">첫 플로깅을 시작해보세요!</p>
            {/* ✅ Link 안에 button 제거 */}
            <Link
              href="/map"
              className="mt-4 inline-block bg-green-500 text-white px-6 py-2.5 rounded-full font-bold"
            >
              🚶 플로깅 시작하기
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((record) => {
              const relWeek = getRelativeWeek(record.weekNumber);
              const color = getRouteColor(record.weekNumber);
              const weekLabel = WEEK_LABELS[relWeek] || "4주 전";
              return (
                <div key={record.id} className="bg-white rounded-2xl shadow-sm p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-12 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <div>
                        <p className="font-bold text-gray-800">
                          {formatDate(record.createdAt)}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatTime(record.createdAt)} · {weekLabel}
                        </p>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-green-600">
                      +{record.points || 0}P
                    </span>
                  </div>

                  <div className="flex gap-4 mt-3 pt-3 border-t">
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-400 text-sm">📏</span>
                      <span className="text-sm font-medium">
                        {(record.distance || 0).toFixed(2)} km
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-400 text-sm">📍</span>
                      <span className="text-sm font-medium">
                        {record.coords?.length || 0}개 좌표
                      </span>
                    </div>
                    {/* ✅ 사진 있으면 표시 */}
                    {record.photoURL && (
                      <img
                        src={record.photoURL}
                        alt="플로깅 사진"
                        className="ml-auto w-12 h-12 rounded-lg object-cover"
                      />
                    )}
                    {!record.photoURL && (
                      <div
                        className="ml-auto text-xs px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: color }}
                      >
                        {weekLabel}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}