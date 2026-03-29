"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  doc, getDoc, updateDoc,
  collection, query, where, getDocs,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getWeekLabel } from "@/lib/routeUtils";
import Link from "next/link";

// ─── 관리자 이메일 목록 ────────────────────────────────────
const ADMIN_EMAILS = ["hubmission@gmail.com"];

// ─── 뱃지 기준 ────────────────────────────────────────────
const BADGES = [
  { id: "first",   icon: "🌱", label: "첫 플로깅",  condition: (s) => s.ploggingCount >= 1 },
  { id: "walker",  icon: "🚶", label: "5km 달성",   condition: (s) => s.totalDistance >= 5 },
  { id: "runner",  icon: "🏃", label: "10km 달성",  condition: (s) => s.totalDistance >= 10 },
  { id: "hero",    icon: "🦸", label: "환경 영웅",  condition: (s) => s.totalDistance >= 50 },
  { id: "tenner",  icon: "🔥", label: "10회 달성",  condition: (s) => s.ploggingCount >= 10 },
  { id: "rich",    icon: "💰", label: "부자",        condition: (s) => s.totalPoints >= 1000 },
];

// ─── 레벨 계산 ────────────────────────────────────────────
function getLevel(points) {
  if (points < 100)  return { level: 1, name: "새싹",   icon: "🌱", next: 100 };
  if (points < 300)  return { level: 2, name: "걸음마", icon: "🚶", next: 300 };
  if (points < 600)  return { level: 3, name: "러너",   icon: "🏃", next: 600 };
  if (points < 1000) return { level: 4, name: "용사",   icon: "⚔️",  next: 1000 };
  if (points < 2000) return { level: 5, name: "영웅",   icon: "🦸", next: 2000 };
  return               { level: 6, name: "전설",   icon: "🏆", next: null };
}

export default function ProfilePage() {
  const { user } = useAuth();
  const router   = useRouter();

  const [stats, setStats] = useState({
    totalPoints: 0, totalDistance: 0, ploggingCount: 0,
    displayName: "", photoURL: "",
  });
  const [recentRoutes, setRecentRoutes] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [editingName, setEditingName]   = useState(false);
  const [newName, setNewName]           = useState("");
  const [saving, setSaving]             = useState(false);

  // ── 관리자 여부 ──────────────────────────────────────────
  const isAdmin = user && ADMIN_EMAILS.includes(user.email);

  // ── 데이터 로드 ──────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (userSnap.exists()) {
        const d = userSnap.data();
        setStats({
          totalPoints:   d.totalPoints   || 0,
          totalDistance: d.totalDistance || 0,
          ploggingCount: d.ploggingCount || 0,
          displayName:   d.displayName   || user.displayName || user.email?.split("@")[0] || "익명",
          photoURL:      d.photoURL      || user.photoURL    || "",
        });
        setNewName(d.displayName || user.displayName || "");
      }

      const q = query(collection(db, "routes"), where("userId", "==", user.uid));
      const snap = await getDocs(q);
      const routes = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
        .slice(0, 5);
      setRecentRoutes(routes);
    } catch (e) {
      console.error("데이터 로드 실패:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    fetchData();
  }, [user, fetchData, router]);

  // ── 닉네임 저장 ──────────────────────────────────────────
  const handleSaveName = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", user.uid), { displayName: newName.trim() });
      setStats((p) => ({ ...p, displayName: newName.trim() }));
      setEditingName(false);
    } catch (e) { alert("저장 실패: " + e.message); }
    finally { setSaving(false); }
  };

  // ── 로그아웃 ─────────────────────────────────────────────
  const handleLogout = async () => {
    if (!confirm("로그아웃 하시겠어요?")) return;
    await signOut(auth);
    router.push("/login");
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-lg animate-pulse">🌿 프로필 불러오는 중...</p>
    </div>
  );

  const levelInfo   = getLevel(stats.totalPoints);
  const progressPct = levelInfo.next
    ? Math.min(100, (stats.totalPoints / levelInfo.next) * 100)
    : 100;
  const earnedBadges = BADGES.filter((b) => b.condition(stats));

  return (
    <div
      className="min-h-screen bg-gray-50"
      style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom, 20px))" }}
    >
      {/* ── 헤더 (그린 배경) ── */}
      <div className="bg-green-600 text-white px-4 pt-8 pb-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-3xl overflow-hidden shadow">
            {stats.photoURL
              ? <img src={stats.photoURL} alt="프로필" className="w-full h-full object-cover" />
              : <span>{levelInfo.icon}</span>
            }
          </div>
          <div className="flex-1">
            {editingName ? (
              <div className="flex gap-2 items-center">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="text-black rounded-lg px-3 py-1 text-sm flex-1 max-w-[160px]"
                  maxLength={12}
                  autoFocus
                />
                <button onClick={handleSaveName} disabled={saving}
                  className="bg-white text-green-600 px-3 py-1 rounded-lg text-sm font-bold">
                  {saving ? "..." : "저장"}
                </button>
                <button onClick={() => setEditingName(false)} className="text-white/70 text-sm">취소</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">{stats.displayName}</h1>
                <button onClick={() => setEditingName(true)}
                  className="text-white/70 text-xs border border-white/40 rounded px-1.5 py-0.5">
                  ✏️ 수정
                </button>
              </div>
            )}
            <p className="text-green-200 text-sm mt-0.5">
              {levelInfo.icon} Lv.{levelInfo.level} {levelInfo.name}
            </p>
          </div>
        </div>

        {/* 레벨 진행바 */}
        <div className="bg-white/20 rounded-full h-2 mb-1">
          <div className="bg-white rounded-full h-2 transition-all" style={{ width: `${progressPct}%` }} />
        </div>
        <p className="text-xs text-green-200">
          {levelInfo.next
            ? `다음 레벨까지 ${levelInfo.next - stats.totalPoints}P 남았어요`
            : "최고 레벨 달성! 🎉"}
        </p>
      </div>

      <div className="px-4 mt-4 space-y-4">

        {/* ── 핵심 통계 3가지 ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: "💰", label: "총 포인트",   value: `${stats.totalPoints.toLocaleString()}P` },
            { icon: "📍", label: "총 거리",     value: `${stats.totalDistance.toFixed(1)}km` },
            { icon: "🏃", label: "플로깅 횟수", value: `${stats.ploggingCount}회` },
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-2xl p-4 shadow-sm text-center">
              <div className="text-2xl mb-1">{item.icon}</div>
              <p className="text-lg font-bold text-gray-800">{item.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>

        {/* ── 획득 뱃지 ── */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-bold text-gray-700 mb-3">🏅 획득 뱃지</h2>
          {earnedBadges.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-2">첫 플로깅을 완료하면 뱃지를 받아요!</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {BADGES.map((badge) => {
                const earned = badge.condition(stats);
                return (
                  <div key={badge.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm
                      ${earned ? "bg-green-50 border border-green-200 text-green-700" : "bg-gray-100 text-gray-300"}`}>
                    <span>{badge.icon}</span>
                    <span className="font-medium">{badge.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 최근 플로깅 기록 ── */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold text-gray-700">📋 최근 플로깅</h2>
            <Link href="/history" className="text-xs text-green-500 font-medium">전체 보기 →</Link>
          </div>
          {recentRoutes.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-3">아직 플로깅 기록이 없어요. 지금 시작해볼까요? 🌿</p>
          ) : (
            <div className="space-y-2">
              {recentRoutes.map((route) => {
                const date      = route.createdAt?.toDate?.();
                const dateStr   = date
                  ? `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`
                  : "날짜 없음";
                // ✅ createdAt 기준 주차 텍스트 (정확한 7일 단위)
                const weekLabel = getWeekLabel(route.createdAt);
                return (
                  <div key={route.id} className="flex justify-between items-center py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-700">📍 {(route.distance || 0).toFixed(2)} km</p>
                      <p className="text-xs text-gray-400">
                        <span className="text-green-600 font-medium">{weekLabel}</span>
                        {" · "}{dateStr}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-green-600">+{route.points || 0}P</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 메뉴 바로가기 ── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <p className="text-xs text-gray-400 font-medium px-4 pt-3 pb-1">바로가기</p>
          {[
            { href: "/history", icon: "📊", label: "전체 플로깅 기록" },
            { href: "/ranking", icon: "🏆", label: "랭킹 보기" },
            { href: "/ranking?view=map", icon: "🗺️", label: "행정구역별 랭킹 지도" },  // ← 추가
            { href: "/group",   icon: "👥", label: "그룹 플로깅" },
            { href: "/reward",  icon: "🎁", label: "포인트 리워드 교환" },              // ← 추가
          ].map((item) => (
            <Link key={item.href} href={item.href}
              className="flex items-center gap-3 px-4 py-4 border-b last:border-0 active:bg-gray-50">
              <span className="text-xl">{item.icon}</span>
              <span className="flex-1 text-sm font-medium text-gray-700">{item.label}</span>
              <span className="text-gray-300">›</span>
            </Link>
          ))}
        </div>

        {/* ── 관리자 메뉴 (hubmission@gmail.com 전용) ── */}
        {isAdmin && (
          <div className="bg-gray-900 rounded-2xl shadow-sm overflow-hidden">
            <p className="text-xs text-gray-500 font-medium px-4 pt-3 pb-1">관리자 전용</p>
            {[
              { href: "/admin",          icon: "📊", label: "관리자 대시보드" },
              { href: "/admin?tab=users", icon: "👥", label: "유저 관리" },
              { href: "/admin?tab=rewards", icon: "🎁", label: "리워드 처리" },
            ].map((item) => (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-3 px-4 py-4 border-b border-gray-800 last:border-0 active:bg-gray-800">
                <span className="text-xl">{item.icon}</span>
                <span className="flex-1 text-sm font-medium text-gray-300">{item.label}</span>
                <span className="text-gray-600">›</span>
              </Link>
            ))}
          </div>
        )}

        {/* ── 로그아웃 ── */}
        <button onClick={handleLogout}
          className="w-full bg-white text-red-400 py-4 rounded-2xl shadow-sm font-medium text-sm">
          로그아웃
        </button>
      </div>
    </div>
  );
}