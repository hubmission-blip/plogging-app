"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { getRouteColorByDate, getWeekLabel } from "@/lib/routeUtils";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function HistoryPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(""); // ✅ 에러 표시용
  const [totalStats, setTotalStats] = useState({ count: 0, distance: 0, points: 0 });
  const [lightboxImg, setLightboxImg] = useState(null); // 사진 크게 보기
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

      {/* ── 사진 라이트박스 모달 ── */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
          onClick={() => setLightboxImg(null)}
        >
          <button
            className="absolute top-5 right-5 text-white text-3xl font-bold leading-none"
            onClick={() => setLightboxImg(null)}
          >
            ✕
          </button>
          <img
            src={lightboxImg}
            alt="플로깅 인증 사진"
            className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="text-white/50 text-xs mt-3">화면을 탭하면 닫힙니다</p>
        </div>
      )}
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
              // ✅ createdAt 기준으로 정확한 색상·텍스트 계산 (7일 단위)
              const color     = getRouteColorByDate(record.createdAt);
              const weekLabel = getWeekLabel(record.createdAt);
              return (
                <div key={record.id} className="bg-white rounded-2xl shadow-sm p-4">
                  {/* 상단: 날짜/시간 (좌) + 포인트/주차 (우) */}
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
                          {formatTime(record.createdAt)}
                        </p>
                      </div>
                    </div>
                    {/* 포인트 + 주차 레이블 (항상 표시) */}
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-lg font-bold text-green-600">
                        +{record.points || 0}P
                      </span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                        style={{ backgroundColor: color }}
                      >
                        {weekLabel}
                      </span>
                    </div>
                  </div>

                  {/* 하단: 거리 / 좌표 / 사진 */}
                  <div className="flex gap-4 mt-3 pt-3 border-t items-center">
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
                    {/* 사진 (photoUrl 또는 photoURL 모두 처리) */}
                    {(record.photoUrl || record.photoURL) && (
                      <button
                        className="ml-auto flex-shrink-0 relative group"
                        onClick={() => setLightboxImg(record.photoUrl || record.photoURL)}
                      >
                        <img
                          src={record.photoUrl || record.photoURL}
                          alt="플로깅 인증 사진"
                          className="w-16 h-16 rounded-xl object-cover shadow-sm ring-2 ring-green-200"
                        />
                        <div className="absolute inset-0 bg-black/30 rounded-xl flex items-center justify-center opacity-0 group-active:opacity-100 transition-opacity">
                          <span className="text-white text-xs font-bold">🔍</span>
                        </div>
                      </button>
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