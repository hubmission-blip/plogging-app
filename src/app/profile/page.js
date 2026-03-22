"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { getPointGrade } from "@/lib/pointCalc";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const { user } = useAuth();
  const [userData, setUserData] = useState(null);
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    const fetchUser = async () => {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) setUserData(snap.data());
    };
    fetchUser();
  }, [user]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (!user) return null;

  const totalPoints = userData?.totalPoints || 0;
  const { grade, color } = getPointGrade(totalPoints);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* 헤더 */}
      <div className="bg-gradient-to-b from-green-500 to-green-400 p-6 pt-12 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/30 rounded-full flex items-center justify-center text-3xl">
            🌿
          </div>
          <div>
            <p className="font-bold text-lg">{user.email}</p>
            <p className="text-green-100 text-sm" style={{ color }}>
              {grade}
            </p>
          </div>
        </div>
      </div>

      {/* 포인트 카드 */}
      <div className="mx-4 -mt-4 bg-white rounded-2xl shadow-lg p-6 mb-4">
        <p className="text-sm text-gray-500 mb-1">총 보유 포인트</p>
        <p className="text-4xl font-bold text-green-600">{totalPoints.toLocaleString()} P</p>
        <p className="text-xs text-gray-400 mt-1">500P 도달 시 실버 등급 🥈</p>
      </div>

      {/* 통계 */}
      <div className="mx-4 grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-xl p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-green-600">
            {userData?.ploggingCount || 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">총 플로깅 횟수</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-blue-500">
            {(userData?.totalDistance || 0).toFixed(1)} km
          </p>
          <p className="text-xs text-gray-500 mt-1">총 이동 거리</p>
        </div>
      </div>

      {/* 등급 안내 */}
      <div className="mx-4 bg-white rounded-2xl shadow-sm p-4 mb-4">
        <p className="font-bold text-gray-700 mb-3">🏅 등급 안내</p>
        {[
          { grade: "브론즈 🥉", range: "0 ~ 499P", color: "#CD7F32" },
          { grade: "실버 🥈", range: "500 ~ 1,999P", color: "#9E9E9E" },
          { grade: "골드 🥇", range: "2,000 ~ 4,999P", color: "#FFC107" },
          { grade: "플래티넘 🏆", range: "5,000P~", color: "#00BCD4" },
        ].map((g) => (
          <div key={g.grade} className="flex justify-between items-center py-2 border-b last:border-0">
            <span className="font-medium" style={{ color: g.color }}>{g.grade}</span>
            <span className="text-sm text-gray-500">{g.range}</span>
          </div>
        ))}
      </div>

      {/* 로그아웃 */}
      <div className="mx-4">
        <button
          onClick={handleLogout}
          className="w-full border border-red-300 text-red-500 py-3 rounded-xl font-medium"
        >
          로그아웃
        </button>
      </div>
    </div>
  );
}