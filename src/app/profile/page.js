"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  doc, getDoc, setDoc, updateDoc,
  collection, query, where, getDocs,
  serverTimestamp,
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
  // 추천 관련 상태
  const [myRefCode, setMyRefCode]         = useState("");
  const [referredUsers, setReferredUsers] = useState([]);
  // UID 복사 상태
  const [uidCopied,       setUidCopied]       = useState(false);
  const [refCopied,       setRefCopied]       = useState(false);
  const [friendsExpanded, setFriendsExpanded] = useState(false); // 기본값: 접힘

  const handleCopyUid = async () => {
    if (!user?.uid) return;
    try {
      await navigator.clipboard.writeText(user.uid);
      setUidCopied(true);
      setTimeout(() => setUidCopied(false), 2000);
    } catch {
      // clipboard API 미지원 시 fallback
      const el = document.createElement("textarea");
      el.value = user.uid;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setUidCopied(true);
      setTimeout(() => setUidCopied(false), 2000);
    }
  };

  // ── 관리자 여부 ──────────────────────────────────────────
  const isAdmin = user && ADMIN_EMAILS.includes(user.email);

  // ── 데이터 로드 ──────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userRef  = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      // 카카오 로그인 후 Firestore 저장 실패했을 경우 여기서 자동 복구
      if (!userSnap.exists()) {
        const kakaoRaw = typeof window !== "undefined" ? localStorage.getItem("kakaoUser") : null;
        if (kakaoRaw) {
          try {
            const kd = JSON.parse(kakaoRaw);
            await setDoc(userRef, {
              uid:           user.uid,
              kakaoUid:      kd.kakaoUid || "",
              email:         kd.email    || "",
              displayName:   kd.nickname || user.displayName || "카카오유저",
              nickname:      kd.nickname || user.displayName || "카카오유저",
              provider:      "kakao",
              totalPoints:   100,
              totalDistance: 0,
              ploggingCount: 0,
              createdAt:     serverTimestamp(),
              refCode:       user.uid.slice(0, 8).toUpperCase(),
            });
          } catch (e) { console.warn("카카오 유저 문서 복구 실패:", e); }
        }
      }

      if (userSnap.exists()) {
        const d = userSnap.data();
        setStats({
          totalPoints:   d.totalPoints   || 0,
          totalDistance: d.totalDistance || 0,
          ploggingCount: d.ploggingCount || 0,
          displayName:   d.displayName   || user.displayName || user.email?.split("@")[0] || "익명",
          photoURL:      d.photoURL      || user.photoURL    || "",
        });
        // 내 추천 코드 (없으면 Firestore에 자동 저장)
        const rc = d.refCode || user.uid.slice(0, 8).toUpperCase();
        setMyRefCode(rc);
        if (!d.refCode) {
          try { await updateDoc(doc(db, "users", user.uid), { refCode: rc }); } catch {}
        }
        // 내 추천으로 가입한 사람들 조회
        try {
          const refQ = query(collection(db, "users"), where("referredBy", "==", user.uid));
          const refSnap = await getDocs(refQ);
          const referred = refSnap.docs.map((rd) => ({
            uid:         rd.id,
            displayName: rd.data().displayName || "익명",
            createdAt:   rd.data().createdAt,
          })).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
          setReferredUsers(referred);
        } catch {}
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
      {/* ── 헤더 ── */}
      <div className="bg-gray-50 px-4 pt-4 pb-1 flex justify-between items-center">
        <img
          src="https://gyea.kr/wp/wp-content/uploads/2025/12/500_subtitle_c.png"
          alt="오백원의 행복"
          className="h-9 w-auto object-contain"
        />
        <div className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-lg overflow-hidden shadow-sm">
          {stats.photoURL
            ? <img src={stats.photoURL} alt="프로필" className="w-full h-full object-cover" />
            : <span>{levelInfo.icon}</span>
          }
        </div>
      </div>

      {/* ── 프로필 & 레벨 카드 ── */}
      <div className="px-4 pt-3 pb-1">
        <div className="bg-gradient-to-r from-green-500 to-teal-500 rounded-2xl px-4 py-4 text-white shadow-sm">

          {/* 프로필 정보 행 */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <p className="font-black text-base text-white truncate">{stats.displayName}</p>
              <p className="text-green-100 text-xs mt-0.5">
                {levelInfo.icon} Lv.{levelInfo.level} {levelInfo.name}
              </p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-white/25 text-white flex-shrink-0">
              내 정보
            </span>
          </div>

          {/* 레벨 진행바 */}
          <div className="bg-white/20 rounded-full h-2 mb-1.5">
            <div className="bg-white rounded-full h-2 transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="flex justify-between items-center">
            <p className="text-xs text-green-100">
              {levelInfo.next
                ? `다음 레벨까지 ${levelInfo.next - stats.totalPoints}P 남았어요`
                : "최고 레벨 달성! 🎉"}
            </p>
            <p className="text-xs font-bold text-white">
              {stats.totalPoints.toLocaleString()}P
            </p>
          </div>

          {/* 내 추천 코드 */}
          {myRefCode && (
            <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-between gap-2">
              <p className="text-xs text-green-100 flex-shrink-0">내 추천 코드</p>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-base text-white tracking-widest">
                  {myRefCode}
                </span>
                <button
                  onClick={async () => {
                    try { await navigator.clipboard.writeText(myRefCode); } catch {}
                    setRefCopied(true);
                    setTimeout(() => setRefCopied(false), 2000);
                  }}
                  className={`text-[10px] px-2 py-0.5 rounded-lg font-bold flex-shrink-0 transition-all
                    ${refCopied ? "bg-white text-green-600" : "bg-white/20 text-white active:bg-white/40"}`}
                >
                  {refCopied ? "✅" : "복사"}
                </button>
              </div>
            </div>
          )}

          {/* 계정 정보 — 흰색 인터박스 */}
          <div className="mt-3 bg-white/15 rounded-xl px-3 py-3 space-y-2">
            {user?.email && !user.email.includes("kakao-auth") && (
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-green-100 flex-shrink-0">이메일</p>
                <p className="text-[11px] text-white truncate ml-2">{user.email}</p>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-green-100 flex-shrink-0">고유번호</p>
              <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
                <p className="text-[11px] font-mono text-white truncate">{user?.uid}</p>
                <button
                  onClick={handleCopyUid}
                  className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded-lg font-bold transition-all
                    ${uidCopied ? "bg-white text-green-600" : "bg-white/20 text-white"}`}
                >
                  {uidCopied ? "✅" : "복사"}
                </button>
              </div>
            </div>
            <p className="text-[10px] text-green-200/60">포인트·리워드 문의 시 고유번호를 알려주세요</p>
          </div>
        </div>
      </div>

      <div className="px-4 mt-3 space-y-4">

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

        {/* ── 내가 추천한 친구 목록 ── */}
        {referredUsers.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* 헤더 + 접기/펼치기 버튼 */}
            <button
              className="w-full flex items-center justify-between px-4 py-4"
              onClick={() => setFriendsExpanded((v) => !v)}
            >
              <h2 className="font-bold text-gray-700">🎁 내가 추천한 친구 ({referredUsers.length}명)</h2>
              <svg
                width="16" height="16" viewBox="0 0 14 14" fill="none"
                style={{ transform: friendsExpanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s" }}
              >
                <path d="M3 5l4 4 4-4" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* 리스트 (펼침 시만 표시) */}
            {friendsExpanded && (
              <div className="px-4 pb-4">
                <div className="space-y-2">
                  {referredUsers.map((u) => {
                    const date    = u.createdAt?.toDate?.();
                    const dateStr = date
                      ? `${date.getFullYear()}.${date.getMonth()+1}.${date.getDate()}`
                      : "";
                    return (
                      <div key={u.uid} className="flex justify-between items-center py-2 border-b last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🌿</span>
                          <div>
                            <p className="text-sm font-medium text-gray-700">{u.displayName}</p>
                            {dateStr && <p className="text-xs text-gray-400">{dateStr} 가입</p>}
                          </div>
                        </div>
                        <span className="text-xs font-bold text-green-600">+100P</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-400 mt-3 text-center">추천 성공 시 각 100P가 지급됩니다</p>
              </div>
            )}
          </div>
        )}

        {/* ── 메뉴 바로가기 ── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <p className="text-xs text-gray-400 font-medium px-4 pt-3 pb-1">바로가기</p>
          {[
            { href: "/profile/edit", icon: "✏️", label: "내정보 수정 (닉네임 · 1365 회원번호)" },
            { href: "/history",      icon: "📊", label: "전체 플로깅 기록" },
            { href: "/ranking",      icon: "🏆", label: "랭킹 보기" },
            { href: "/ranking?view=map", icon: "🗺️", label: "행정구역별 랭킹 지도" },
            { href: "/group",        icon: "👥", label: "그룹 플로깅" },
            { href: "/reward",       icon: "🎁", label: "포인트 리워드 교환" },
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