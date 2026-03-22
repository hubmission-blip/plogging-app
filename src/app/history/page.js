"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection, query, where, orderBy, getDocs
} from "firebase/firestore";
import { getRouteColor, WEEK_LABELS, getRelativeWeek } from "@/lib/routeUtils";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function HistoryPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalStats, setTotalStats] = useState({ count: 0, distance: 0, points: 0 });
  const router = useRouter();

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    fetchHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchHistory = async () => {
    try {
      const q = query(
        collection(db, "routes"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setRecords(list);

      // 통계 계산
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
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "-";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric", month: "long", day: "numeric",
      weekday: "short",
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
        ) : records.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-5xl mb-3">🌱</p>
            <p className="text-gray-500 font-medium">아직 플로깅 기록이 없어요</p>
            <p className="text-gray-400 text-sm mt-1">첫 플로깅을 시작해보세요!</p>
            <Link href="/map">
              <button className="mt-4 bg-green-500 text-white px-6 py-2.5 rounded-full font-bold">
                🚶 플로깅 시작하기
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((record, idx) => {
              const relWeek = getRelativeWeek(record.weekNumber);
              const color = getRouteColor(record.weekNumber);
              const weekLabel = WEEK_LABELS[relWeek] || "4주 전";
              return (
                <div key={record.id} className="bg-white rounded-2xl shadow-sm p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {/* 주차 색상 인디케이터 */}
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
                    <div
                      className="ml-auto text-xs px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: color }}
                    >
                      {weekLabel}
                    </div>
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