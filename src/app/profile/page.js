"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { signOut } from "firebase/auth";
import { getPointGrade } from "@/lib/pointCalc";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ProfilePage() {
  const { user } = useAuth();
  const [userData, setUserData] = useState(null);
  const [editingNick, setEditingNick] = useState(false);
  const [newNick, setNewNick] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    const fetchUser = async () => {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setUserData(snap.data());
        setNewNick(snap.data().nickname || user.displayName || "");
      }
    };
    fetchUser();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleSaveNick = async () => {
    if (!newNick.trim() || newNick.length < 2) return;
    setSaving(true);
    try {
      await updateProfile(user, { displayName: newNick });
      await updateDoc(doc(db, "users", user.uid), { nickname: newNick });
      setUserData((prev) => ({ ...prev, nickname: newNick }));
      setEditingNick(false);
    } catch (e) {
      alert("저장 실패: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (!user) return null;

  const totalPoints = userData?.totalPoints || 0;
  const { grade, color } = getPointGrade(totalPoints);
  const displayName = userData?.nickname || user.displayName || user.email?.split("@")[0];

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* 헤더 */}
      <div className="bg-gradient-to-b from-green-500 to-green-400 p-6 pt-12 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/30 rounded-full flex items-center justify-center text-3xl">
            🌿
          </div>
          <div className="flex-1">
            {editingNick ? (
              <div className="flex items-center gap-2">
                <input
                  value={newNick}
                  onChange={(e) => setNewNick(e.target.value)}
                  maxLength={10}
                  className="bg-white/20 text-white placeholder-white/60 rounded-lg px-3 py-1 text-sm w-32 focus:outline-none"
                  placeholder="닉네임 입력"
                  autoFocus
                />
                <button
                  onClick={handleSaveNick}
                  disabled={saving}
                  className="bg-white text-green-600 text-xs px-3 py-1.5 rounded-lg font-bold"
                >
                  {saving ? "..." : "저장"}
                </button>
                <button
                  onClick={() => setEditingNick(false)}
                  className="text-white/70 text-xs"
                >
                  취소
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="font-bold text-lg">{displayName}</p>
                <button
                  onClick={() => setEditingNick(true)}
                  className="text-white/70 text-xs bg-white/20 px-2 py-0.5 rounded-full"
                >
                  ✏️ 수정
                </button>
              </div>
            )}
            <p className="text-green-100 text-sm mt-0.5">{user.email}</p>
            <p className="text-sm font-medium mt-0.5" style={{ color }}>
              {grade}
            </p>
          </div>
        </div>
      </div>

      {/* 포인트 카드 */}
      <div className="mx-4 -mt-4 bg-white rounded-2xl shadow-lg p-6 mb-4">
        <p className="text-sm text-gray-500 mb-1">총 보유 포인트</p>
        <p className="text-4xl font-bold text-green-600">{totalPoints.toLocaleString()} P</p>
        <div className="mt-3 bg-gray-100 rounded-full h-2">
          <div
            className="bg-green-400 h-2 rounded-full transition-all"
            style={{ width: `${Math.min(100, (totalPoints / 500) * 100)}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">
          실버까지 {Math.max(0, 500 - totalPoints)}P 남음
        </p>
      </div>

      {/* 통계 */}
      <div className="mx-4 grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-xl p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-green-600">{userData?.ploggingCount || 0}</p>
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
          { grade: "브론즈 🥉", range: "0 ~ 499P",      color: "#CD7F32" },
          { grade: "실버 🥈",  range: "500 ~ 1,999P",  color: "#9E9E9E" },
          { grade: "골드 🥇",  range: "2,000 ~ 4,999P",color: "#FFC107" },
          { grade: "플래티넘 🏆", range: "5,000P~",    color: "#00BCD4" },
        ].map((g) => (
          <div key={g.grade} className="flex justify-between items-center py-2 border-b last:border-0">
            <span className="font-medium" style={{ color: g.color }}>{g.grade}</span>
            <span className="text-sm text-gray-500">{g.range}</span>
          </div>
        ))}
      </div>

{/* 바로가기 메뉴 */}
<div className="mx-4 bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
  <p className="font-bold text-gray-700 px-4 pt-4 pb-2">📌 바로가기</p>
  {[
    { href: "/history", icon: "📋", label: "플로깅 기록", desc: `총 ${userData?.ploggingCount || 0}회` },
    { href: "/rewards", icon: "🎁", label: "포인트 교환", desc: `${totalPoints.toLocaleString()}P 보유` },
    { href: "/group",   icon: "👥", label: "그룹 플로깅", desc: "그룹 관리" },
  ].map((item) => (
    <Link key={item.href} href={item.href}>
      <div className="flex items-center px-4 py-3 border-t hover:bg-gray-50 transition-colors">
        <span className="text-xl mr-3">{item.icon}</span>
        <div className="flex-1">
          <p className="font-medium text-sm text-gray-800">{item.label}</p>
          <p className="text-xs text-gray-400">{item.desc}</p>
        </div>
        <span className="text-gray-300">›</span>
      </div>
    </Link>
  ))}
</div>

{/* 관리자 메뉴 (관리자만 표시) */}
{user?.email === "hubmission@gmail.com" && (
  <div className="mx-4 mb-4">
    <Link href="/admin">
      <button className="w-full bg-gray-800 text-white py-3 rounded-xl font-medium text-sm">
        ⚙️ 관리자 페이지
      </button>
    </Link>
  </div>
)}

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