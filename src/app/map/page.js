"use client";

import { notifyPloggingComplete } from "@/lib/notify";
import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { useKakaoLoader } from "react-kakao-maps-sdk";
import MapView from "@/components/MapView";
import { useLocation } from "@/hooks/useLocation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  doc, collection, addDoc, updateDoc, setDoc, // ✅ setDoc 추가
  increment, serverTimestamp, query,
  where, getDocs, deleteDoc
} from "firebase/firestore";
import { calculatePoints } from "@/lib/pointCalc";
import { getWeekNumber, getExpiresAt, isExpired, getRouteColor } from "@/lib/routeUtils";
import { useSearchParams } from "next/navigation";

// ✅ useSearchParams는 별도 컴포넌트로 분리 (Suspense 필요)
function MapPageInner() {
  const [loading, error] = useKakaoLoader({
    appkey: process.env.NEXT_PUBLIC_KAKAO_MAP_KEY,
  });

  const searchParams = useSearchParams();
  const groupId = searchParams.get("groupId");
  const groupSize = parseInt(searchParams.get("groupSize") || "1");

  const { path, distance, isTracking, startTracking, stopTracking } = useLocation();
  const { user } = useAuth();
  const [result, setResult] = useState(null);
  const [pastRoutes, setPastRoutes] = useState([]);

  // ✅ 훅(useEffect)을 early return보다 먼저 선언
  useEffect(() => {
    if (!user || loading) return;

    const fetchPastRoutes = async () => {
      try {
        const q = query(
          collection(db, "routes"),
          where("userId", "==", user.uid)
        );
        const snap = await getDocs(q);
        const routes = [];
        const expiredIds = [];

        snap.forEach((docSnap) => {
          const data = { id: docSnap.id, ...docSnap.data() };
          if (isExpired(data.expiresAt)) {
            expiredIds.push(docSnap.id);
          } else {
            routes.push({
              id: data.id,
              coords: data.coords,
              color: getRouteColor(data.weekNumber),
              weekNumber: data.weekNumber,
              distance: data.distance,
            });
          }
        });

        for (const id of expiredIds) {
          await deleteDoc(doc(db, "routes", id));
        }

        setPastRoutes(routes);
      } catch (e) {
        console.error("동선 불러오기 실패:", e);
      }
    };

    fetchPastRoutes();
  }, [user, loading]); // ✅ eslint-disable 불필요

  // ✅ 모든 훅 선언 후 early return
  if (!user) return (
    <div className="flex flex-col items-center justify-center h-screen gap-4 p-6 text-center">
      <div className="text-6xl">🔑</div>
      <h2 className="text-xl font-bold text-gray-700">로그인이 필요해요</h2>
      <p className="text-gray-400 text-sm">플로깅 기록과 포인트 적립을 위해 로그인해주세요</p>
      <Link href="/login">
        <button className="bg-green-500 text-white px-8 py-3 rounded-full font-bold">
          로그인하기
        </button>
      </Link>
    </div>
  );

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-lg">🗺️ 지도 로딩 중...</p>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-red-500">❌ 지도 로드 실패: {String(error)}</p>
    </div>
  );

  const handleStop = async () => {
    stopTracking();
    if (path.length < 2) return;

    const { total, breakdown } = calculatePoints({
      distanceKm: distance,
      groupSize: groupSize,
    });
    const weekNumber = getWeekNumber();
    const expiresAt = getExpiresAt();

    try {
      await addDoc(collection(db, "routes"), {
        userId: user?.uid || "anonymous",
        coords: path,
        distance: distance,
        points: total,
        weekNumber: weekNumber,
        expiresAt: expiresAt,
        createdAt: serverTimestamp(),
      });

      if (user) {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
          totalPoints: increment(total),
          totalDistance: increment(distance),
          ploggingCount: increment(1),
        }).catch(async () => {
          // ✅ addDoc → setDoc으로 변경 (user.uid를 문서 ID로 사용)
          await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            email: user.email || "",
            totalPoints: total,
            totalDistance: distance,
            ploggingCount: 1,
            createdAt: serverTimestamp(),
          });
        });
      }

      notifyPloggingComplete(distance, total);
      setResult({ distance, total, breakdown });
    } catch (e) {
      console.error("저장 실패:", e);
      alert("저장 중 오류가 발생했습니다");
    }
  };

  return (
    <div className="relative w-full h-screen">
      <MapView currentPath={path} pastRoutes={pastRoutes} />

      {/* 상단: 거리 표시 */}
      <div className="absolute top-4 left-0 right-0 flex justify-center z-10">
        <div className="bg-white rounded-full px-6 py-2 shadow-lg flex items-center gap-2">
          <span className="text-lg font-bold text-green-700">
            📍 {distance.toFixed(2)} km
          </span>
          {isTracking && (
            <span className="text-xs text-red-500 animate-pulse">● 기록 중</span>
          )}
        </div>
      </div>

      {/* 그룹 플로깅 표시 */}
      {groupId && (
        <div className="absolute top-16 left-0 right-0 flex justify-center z-10">
          <div className="bg-purple-500 text-white rounded-full px-4 py-1 text-xs font-bold shadow">
            👥 그룹 플로깅 중 · {groupSize}명 · +{groupSize * 5}P 보너스
          </div>
        </div>
      )}

      {/* 주차별 색상 범례 */}
      {pastRoutes.length > 0 && !isTracking && (
        <div className="absolute top-16 right-3 bg-white rounded-xl p-2 shadow-lg z-10">
          <p className="text-xs font-bold text-gray-500 mb-1">내 동선</p>
          {[
            { color: "#4CAF50", label: "이번 주" },
            { color: "#2196F3", label: "2주 전" },
            { color: "#FF9800", label: "3주 전" },
            { color: "#9C27B0", label: "4주 전" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5 mb-0.5">
              <div className="w-4 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-gray-600">{item.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* 하단 버튼 */}
      <div className="absolute bottom-24 left-0 right-0 flex justify-center z-10">
        {!isTracking ? (
          <button
            onClick={startTracking}
            className="bg-green-500 text-white px-10 py-4 rounded-full text-lg font-bold shadow-xl active:scale-95 transition-transform"
          >
            🚶 플로깅 시작
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="bg-red-500 text-white px-10 py-4 rounded-full text-lg font-bold shadow-xl active:scale-95 transition-transform"
          >
            🏁 플로깅 종료
          </button>
        )}
      </div>

      {/* 결과 모달 */}
      {result && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">🎉</div>
              <h2 className="text-xl font-bold text-green-700">플로깅 완료!</h2>
            </div>
            <div className="bg-green-50 rounded-xl p-4 mb-4 text-center">
              <p className="text-3xl font-bold text-green-600">+{result.total} P</p>
              <p className="text-sm text-gray-500 mt-1">획득 포인트</p>
            </div>
            <div className="space-y-2 mb-4">
              {result.breakdown.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-600">{item.label}</span>
                  <span className="font-medium text-green-600">+{item.points}P</span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between font-bold">
                <span>총 거리</span>
                <span>{result.distance.toFixed(2)} km</span>
              </div>
            </div>
            <button
              onClick={() => setResult(null)}
              className="w-full bg-green-500 text-white py-3 rounded-xl font-bold"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ✅ Suspense로 감싸서 export (useSearchParams 필수 요건)
export default function MapPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg">🗺️ 지도 로딩 중...</p>
      </div>
    }>
      <MapPageInner />
    </Suspense>
  );
}