"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Coins, MapPin, Footprints, UserPlus, Pencil, BarChart3, Trophy, Map, Users, Gift,
  Shield, Settings, FileCheck, LogOut, UserX, Sprout, PersonStanding, Flame,
  Swords, Award, Leaf, ClipboardList, Check, AlertTriangle, Frown, Store,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, query, where, getDocs,
  serverTimestamp, increment,
} from "firebase/firestore";
import { signOut, deleteUser, reauthenticateWithCredential, EmailAuthProvider, GoogleAuthProvider, reauthenticateWithPopup } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getWeekLabel } from "@/lib/routeUtils";
import Link from "next/link";
import EcomileageConnect from "@/components/EcomileageConnect";
import { markAccountDeleted, getWelcomePoints } from "@/lib/accountUtils";

// ─── 관리자 이메일 목록 ────────────────────────────────────
const ADMIN_EMAILS = ["hubmission@gmail.com", "boonma@nate.com"];

// ─── 뱃지 기준 ────────────────────────────────────────────
const BADGES = [
  { id: "first",   Icon: Sprout,           iconColor: "text-green-500",  label: "첫 플로깅",  condition: (s) => s.ploggingCount >= 1 },
  { id: "walker",  Icon: PersonStanding,   iconColor: "text-blue-500",   label: "5km 달성",   condition: (s) => s.totalDistance >= 5 },
  { id: "runner",  Icon: Footprints,       iconColor: "text-indigo-500", label: "10km 달성",  condition: (s) => s.totalDistance >= 10 },
  { id: "hero",    Icon: Shield,           iconColor: "text-purple-500", label: "환경 영웅",  condition: (s) => s.totalDistance >= 50 },
  { id: "tenner",  Icon: Flame,            iconColor: "text-orange-500", label: "10회 달성",  condition: (s) => s.ploggingCount >= 10 },
  { id: "rich",    Icon: Coins,            iconColor: "text-yellow-500", label: "부자",        condition: (s) => s.totalPoints >= 1000 },
];

// ─── 레벨 계산 ────────────────────────────────────────────
function getLevel(points) {
  if (points < 100)  return { level: 1, name: "새싹",   Icon: Sprout,           iconColor: "text-green-400",  next: 100 };
  if (points < 300)  return { level: 2, name: "걸음마", Icon: PersonStanding,   iconColor: "text-blue-400",   next: 300 };
  if (points < 600)  return { level: 3, name: "러너",   Icon: Footprints,       iconColor: "text-indigo-400", next: 600 };
  if (points < 1000) return { level: 4, name: "용사",   Icon: Swords,           iconColor: "text-red-400",    next: 1000 };
  if (points < 2000) return { level: 5, name: "영웅",   Icon: Shield,           iconColor: "text-purple-400", next: 2000 };
  return               { level: 6, name: "전설",   Icon: Trophy,           iconColor: "text-yellow-400", next: null };
}

export default function ProfilePage() {
  const { user } = useAuth();
  const router   = useRouter();

  const [stats, setStats] = useState({
    totalPoints: 0, totalDistance: 0, ploggingCount: 0,
    displayName: "", photoURL: "",
    ecomileageLinked: false, ecomileageProgram: "",
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
  const isAdmin = user && (ADMIN_EMAILS.includes(user.email) || ADMIN_EMAILS.includes(stats?.realEmail));

  // ── 파트너 매장 담당자 여부 ─────────────────────────────
  const [isPartnerStore, setIsPartnerStore] = useState(false);

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
            const wP = await getWelcomePoints(kd.email || "", 100);
            await setDoc(userRef, {
              uid:           user.uid,
              kakaoUid:      kd.kakaoUid || "",
              email:         kd.email    || "",
              displayName:   kd.nickname || user.displayName || "카카오유저",
              nickname:      kd.nickname || user.displayName || "카카오유저",
              provider:      "kakao",
              totalPoints:   wP,
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
          totalPoints:      d.totalPoints      || 0,
          totalDistance:    d.totalDistance    || 0,
          ploggingCount:    d.ploggingCount    || 0,
          displayName:      d.displayName      || user.displayName || user.email?.split("@")[0] || "익명",
          photoURL:         d.photoURL         || user.photoURL    || "",
          ecomileageLinked: d.ecomileageLinked || false,
          ecomileageProgram: d.ecomileageProgram || "",
          realEmail:         d.email            || "",
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

      // 파트너 매장 담당자 여부 확인
      try {
        const psQ = query(collection(db, "partnerStores"), where("ownerUid", "==", user.uid));
        const psSnap = await getDocs(psQ);
        setIsPartnerStore(!psSnap.empty);
      } catch { setIsPartnerStore(false); }
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
    try {
      localStorage.removeItem("kakaoUser");
      localStorage.removeItem("appleUser");
    } catch {}
    try { await signOut(auth); } catch (e) { console.warn("로그아웃 처리:", e); }
    router.push("/login");
  };

  // ── 회원탈퇴 ─────────────────────────────────────────────
  // ※ 정책: 누적 사용자 수·누적 이동거리는 유지
  //   - routes 데이터는 보존하되 인증 사진(photoUrl)만 삭제 + 개인정보 익명화
  //   - stats/community 문서에 deletedUsersCount를 +1 → 메인에서 합산 표시
  //   - 개인정보(users 문서, 이메일, 닉네임 등)는 완전 삭제
  const [deleteStep, setDeleteStep] = useState(0); // 0: 안보임, 1: 1차확인, 2: 최종확인, 3: 처리중
  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleteStep(3); // 처리 중
    try {
      // 1) 플로깅 경로 데이터: 보존하되 개인정보·사진만 제거
      try {
        const routesQ = query(collection(db, "routes"), where("userId", "==", user.uid));
        const routesSnap = await getDocs(routesQ);
        for (const d of routesSnap.docs) {
          await updateDoc(d.ref, {
            userId: "deleted",
            photoUrl: null,
            verified: false,
          });
        }
      } catch (e) { console.warn("routes 익명화 실패 (무시):", e.message); }

      // 2) 누적 사용자 카운트 + 이동거리 보존: stats/community에 반영
      try {
        const userDist = stats?.totalDistance || 0;
        const statsRef = doc(db, "stats", "community");
        const statsSnap = await getDoc(statsRef);
        if (statsSnap.exists()) {
          await updateDoc(statsRef, {
            deletedUsersCount: increment(1),
            deletedUsersDistance: increment(userDist),
          });
        } else {
          await setDoc(statsRef, {
            deletedUsersCount: 1,
            deletedUsersDistance: userDist,
          });
        }
      } catch (e) { console.warn("stats 업데이트 실패 (무시):", e.message); }

      // 3) 리워드 교환 내역 — 익명화
      try {
        const rewardQ = query(collection(db, "reward_history"), where("userId", "==", user.uid));
        const rewardSnap = await getDocs(rewardQ);
        for (const d of rewardSnap.docs) {
          await updateDoc(d.ref, { userId: "deleted", userName: "탈퇴회원" });
        }
      } catch (e) { console.warn("reward_history 익명화 실패 (무시):", e.message); }

      // 4) 쇼핑 클릭/구매 로그 — 익명화
      try {
        const clickQ = query(collection(db, "shopClicks"), where("userId", "==", user.uid));
        const clickSnap = await getDocs(clickQ);
        for (const d of clickSnap.docs) {
          await updateDoc(d.ref, { userId: "deleted" });
        }
      } catch (e) { console.warn("shopClicks 익명화 실패 (무시):", e.message); }

      // 5) 탈퇴 이메일 해시 저장 (재가입 시 환영포인트 어뷰징 방지)
      try {
        const emailForHash = stats?.realEmail || user?.email || "";
        if (emailForHash) await markAccountDeleted(emailForHash);
      } catch (e) { console.warn("이메일 해시 저장 실패 (무시):", e.message); }

      // 6) 사용자 문서 삭제 (개인정보 완전 삭제)
      await deleteDoc(doc(db, "users", user.uid));

      // 7) localStorage 정리
      try {
        localStorage.removeItem("kakaoUser");
        localStorage.removeItem("appleUser");
        localStorage.removeItem("pending_referral");
        localStorage.removeItem("google_auth_nonce");
        localStorage.removeItem("apple_auth_state");
      } catch {}

      // 8) Firebase Auth 계정 삭제
      try {
        if (auth.currentUser) {
          await deleteUser(auth.currentUser);
        }
      } catch (authErr) {
        // requires-recent-login: 재인증 없이는 삭제 불가 → signOut으로 대체
        console.warn("Firebase Auth 삭제 실패:", authErr.code, authErr.message);
        try { await signOut(auth); } catch {}
      }

      alert("회원 탈퇴가 완료되었습니다. 그동안 이용해 주셔서 감사합니다.");
      router.push("/login");
    } catch (e) {
      console.error("회원 탈퇴 실패:", e);
      alert("탈퇴 처리 중 오류가 발생했습니다:\n" + (e.code || "") + " " + e.message);
      setDeleteStep(0);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-lg animate-pulse flex items-center gap-2 text-gray-500"><Leaf className="w-5 h-5 text-green-400" strokeWidth={2} /> 프로필 불러오는 중...</p>
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
        <Link href="/">
          <img
            src="https://res.cloudinary.com/dqlvm572h/image/upload/w_200,q_auto,f_auto/Intro_Logo_fuj1kt.png"
            alt="오백원의 행복"
            className="h-9 w-auto object-contain"
          />
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/profile/edit"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-gray-100 border border-gray-200 active:bg-gray-200 transition-colors">
            <Pencil className="w-3.5 h-3.5 text-gray-500" strokeWidth={2} />
            <span className="text-xs font-bold text-gray-600">내정보 수정</span>
          </Link>
          <div className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-lg overflow-hidden shadow-sm">
            {stats.photoURL
              ? <img src={stats.photoURL} alt="프로필" className="w-full h-full object-cover" />
              : <levelInfo.Icon size={20} className={levelInfo.iconColor} strokeWidth={1.8} />
            }
          </div>
        </div>
      </div>

      {/* ── 프로필 & 레벨 카드 ── */}
      <div className="px-4 pt-3 pb-1">
        <div className="rounded-2xl px-4 py-4 text-white shadow-sm" style={{ backgroundImage: "linear-gradient(to right, #8dc63f, #4cb748)" }}>

          {/* 프로필 정보 행 */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <p className="font-black text-base text-white truncate">{stats.displayName}</p>
              <p className="text-green-100 text-xs mt-0.5">
                <span className="inline-flex items-center gap-1"><levelInfo.Icon size={14} className="text-green-100" strokeWidth={2} /> Lv.{levelInfo.level} {levelInfo.name}</span>
              </p>
            </div>
          </div>

          {/* 레벨 진행바 */}
          <div className="bg-white/20 rounded-full h-2 mb-1.5">
            <div className="bg-white rounded-full h-2 transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="flex justify-between items-center">
            <p className="text-xs text-green-100">
              {levelInfo.next
                ? `다음 레벨까지 ${levelInfo.next - stats.totalPoints}P 남았어요`
                : "최고 레벨 달성!"}
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
                <span className="font-mono font-normal text-2xl text-white tracking-widest">
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
                  {refCopied ? <Check size={12} strokeWidth={2} /> : "복사"}
                </button>
              </div>
            </div>
          )}

          {/* 계정 정보 — 완전 흰색 인터박스 */}
          <div className="mt-3 bg-white/80 rounded-xl px-3 py-3 space-y-2">
            {(() => {
              // Firestore에 저장된 실제 이메일 우선, 없으면 Firebase Auth 이메일 (브릿지 이메일 제외)
              const realEmail = stats?.realEmail;
              const authEmail = user?.email;
              const isFake = (e) => e && (e.includes("kakao-auth") || e.includes("apple-auth") || e.includes("naver-auth") || e.match(/^kakao_\d+@kakao\.com$/));
              const displayEmail = (realEmail && !isFake(realEmail)) ? realEmail : (!isFake(authEmail) ? authEmail : null);
              return displayEmail ? (
                <div className="flex items-center gap-2">
                  <p className="text-[11px] text-green-600 font-medium w-14 flex-shrink-0">이메일</p>
                  <p className="text-[11px] text-gray-700 truncate flex-1">{displayEmail}</p>
                </div>
              ) : null;
            })()}
            <div className="flex items-center gap-2">
              <p className="text-[11px] text-green-600 font-medium w-14 flex-shrink-0">고유번호</p>
              <p className="text-[11px] font-mono text-gray-700 truncate flex-1">{user?.uid}</p>
              <button
                onClick={handleCopyUid}
                className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded-lg font-bold transition-all
                  ${uidCopied ? "bg-green-500 text-white" : "bg-green-100 text-green-600"}`}
              >
                {uidCopied ? <Check size={12} strokeWidth={2} /> : "복사"}
              </button>
            </div>
            <p className="text-[10px] text-gray-400">포인트·리워드 문의 시 고유번호를 알려주세요</p>
          </div>
        </div>
      </div>

      <div className="px-4 mt-3 space-y-4">

        {/* ── 핵심 통계 3가지 ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: <Coins className="w-5 h-5 text-yellow-500" strokeWidth={1.8} />, label: "총 포인트",   value: `${stats.totalPoints.toLocaleString()}P` },
            { icon: <MapPin className="w-5 h-5 text-green-500" strokeWidth={1.8} />, label: "총 거리",     value: `${stats.totalDistance.toFixed(1)}km` },
            { icon: <Footprints className="w-5 h-5 text-blue-500" strokeWidth={1.8} />, label: "플로깅 횟수", value: `${stats.ploggingCount}회` },
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-2xl p-4 shadow-sm text-center">
              <div className="flex justify-center mb-1">{item.icon}</div>
              <p className="text-lg font-bold text-gray-800">{item.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>

        {/* ── 획득 뱃지 ── */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-bold text-gray-700 mb-3 flex items-center gap-1"><Award className="w-4 h-4 text-yellow-500" strokeWidth={1.8} /> 획득 뱃지</h2>
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
                    <badge.Icon size={16} className={earned ? badge.iconColor : "text-gray-300"} strokeWidth={1.8} />
                    <span className="font-medium">{badge.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 파트너 매장 메뉴 (매장 담당자 전용) ── */}
        {isPartnerStore && (
          <div className="bg-emerald-600 rounded-2xl shadow-sm overflow-hidden">
            <Link href="/partner/redeem"
              className="flex items-center gap-3 px-4 py-4 active:bg-emerald-700">
              <Store className="w-5 h-5 text-white/80" strokeWidth={1.8} />
              <span className="flex-1 text-sm font-bold text-white">매장 쿠폰 사용처리</span>
              <span className="text-white/50">›</span>
            </Link>
          </div>
        )}

        {/* ── 에코마일리지 연동 ── */}
        <EcomileageConnect
          userId={user?.uid}
          linked={stats.ecomileageLinked}
          program={stats.ecomileageProgram}
          onUpdate={(updated) => setStats((prev) => ({ ...prev, ...updated }))}
        />

        {/* ── 최근 플로깅 기록 ── */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold text-gray-700 flex items-center gap-1"><ClipboardList className="w-4 h-4" strokeWidth={1.8} /> 최근 플로깅</h2>
            <Link href="/history" className="text-xs text-green-500 font-medium">전체 보기 →</Link>
          </div>
          {recentRoutes.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-3">아직 플로깅 기록이 없어요. 지금 시작해볼까요?</p>
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
                      <p className="text-sm font-medium text-gray-700 flex items-center gap-0.5"><MapPin size={13} className="text-green-500" strokeWidth={1.8} /> {(route.distance || 0).toFixed(2)} km</p>
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
              <h2 className="font-bold text-gray-700 flex items-center gap-1"><UserPlus className="w-4 h-4" strokeWidth={1.8} /> 내가 추천한 친구 ({referredUsers.length}명)</h2>
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
                          <Leaf size={18} className="text-green-500" strokeWidth={1.8} />
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
            { href: "/history",      icon: <BarChart3 className="w-5 h-5 text-gray-500" strokeWidth={1.8} />, label: "전체 플로깅 기록" },
            { href: "/ranking",      icon: <Trophy className="w-5 h-5 text-gray-500" strokeWidth={1.8} />, label: "랭킹 보기" },
            { href: "/ranking?view=map", icon: <Map className="w-5 h-5 text-gray-500" strokeWidth={1.8} />, label: "행정구역별 랭킹 지도" },
            { href: "/group",        icon: <Users className="w-5 h-5 text-gray-500" strokeWidth={1.8} />, label: "그룹 플로깅" },
            { href: "/reward",       icon: <Gift className="w-5 h-5 text-gray-500" strokeWidth={1.8} />, label: "포인트 리워드 교환" },
            { href: "/gift",         icon: <Gift className="w-5 h-5 text-pink-400" strokeWidth={1.8} />, label: "포인트 선물하기" },
            { href: "/certificate",  icon: <FileCheck className="w-5 h-5 text-gray-500" strokeWidth={1.8} />, label: "봉사활동 증명서 발급" },
          ].map((item) => (
            <Link key={item.href} href={item.href}
              className="flex items-center gap-3 px-4 py-4 border-b last:border-0 active:bg-gray-50">
              <span className="flex-shrink-0">{item.icon}</span>
              <span className="flex-1 text-sm font-medium text-gray-700">{item.label}</span>
              <span className="text-gray-300">›</span>
            </Link>
          ))}
        </div>

        {/* ── 관리자 메뉴 (hubmission@gmail.com 전용) ── */}
        {isAdmin && (
          <div className="bg-gray-900 rounded-2xl shadow-sm overflow-hidden">
            <p className="text-xs text-gray-500 font-medium px-4 pt-3 pb-1">관리자 전용</p>
            <Link href="/admin"
              className="flex items-center gap-3 px-4 py-4 active:bg-gray-800">
              <div className="flex items-center gap-1.5">
                <Shield className="w-5 h-5 text-gray-400" strokeWidth={1.8} />
                <Settings className="w-5 h-5 text-gray-400" strokeWidth={1.8} />
                <Users className="w-5 h-5 text-gray-400" strokeWidth={1.8} />
              </div>
              <span className="flex-1 text-sm font-medium text-gray-300 text-center">관리자 페이지 바로가기</span>
              <span className="text-gray-600">›</span>
            </Link>
          </div>
        )}

        {/* ── 로그아웃 ── */}
        <button onClick={handleLogout}
          className="w-full bg-white text-gray-500 py-4 rounded-2xl shadow-sm font-medium text-sm flex items-center justify-center gap-1.5">
          <LogOut className="w-4 h-4" strokeWidth={1.8} />
          로그아웃
        </button>

        {/* ── 회원탈퇴 ── */}
        <button onClick={() => setDeleteStep(1)}
          className="w-full bg-white text-gray-400 py-3 rounded-2xl shadow-sm font-medium text-xs flex items-center justify-center gap-1.5">
          <UserX className="w-3.5 h-3.5" strokeWidth={1.8} />
          회원탈퇴
        </button>
      </div>

      {/* ── 회원탈퇴 확인 모달 ── */}
      {deleteStep > 0 && (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center px-6"
          onClick={() => deleteStep < 3 && setDeleteStep(0)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}>

            {deleteStep === 1 && (
              <>
                <div className="text-center mb-4">
                  <div className="mb-2"><Frown size={40} className="text-gray-400 mx-auto" strokeWidth={1.5} /></div>
                  <h2 className="text-lg font-black text-gray-800">정말 탈퇴하시겠어요?</h2>
                  <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                    탈퇴하면 아래 데이터가 모두 삭제되며<br />
                    <strong className="text-red-500">복구할 수 없습니다.</strong>
                  </p>
                </div>
                <div className="bg-red-50 rounded-xl p-3 mb-4 space-y-1.5">
                  <p className="text-xs text-red-600">• 이메일, 닉네임 등 개인정보 삭제</p>
                  <p className="text-xs text-red-600">• 포인트 {stats.totalPoints.toLocaleString()}P 소멸</p>
                  <p className="text-xs text-red-600">• 획득 뱃지 및 레벨 초기화</p>
                  <p className="text-xs text-red-600">• 인증 사진 삭제</p>
                  <p className="text-xs text-red-600">• 추천인 코드 및 추천 기록 삭제</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-1">
                  <p className="text-xs text-gray-500">• 이동 경로 데이터는 익명화되어 커뮤니티 통계에 활용됩니다</p>
                  <p className="text-xs text-gray-500">• 누적 사용자 수 및 누적 이동거리는 유지됩니다</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setDeleteStep(0)}
                    className="flex-1 bg-gray-100 text-gray-600 py-3.5 rounded-2xl font-bold text-sm">
                    취소
                  </button>
                  <button onClick={() => setDeleteStep(2)}
                    className="flex-1 bg-red-500 text-white py-3.5 rounded-2xl font-bold text-sm">
                    탈퇴 진행
                  </button>
                </div>
              </>
            )}

            {deleteStep === 2 && (
              <>
                <div className="text-center mb-4">
                  <div className="mb-2"><AlertTriangle size={40} className="text-red-400 mx-auto" strokeWidth={1.5} /></div>
                  <h2 className="text-lg font-black text-red-600">최종 확인</h2>
                  <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                    이 작업은 되돌릴 수 없습니다.<br />
                    정말로 탈퇴하시겠습니까?
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setDeleteStep(0)}
                    className="flex-1 bg-green-500 text-white py-3.5 rounded-2xl font-bold text-sm">
                    계속 이용하기
                  </button>
                  <button onClick={handleDeleteAccount}
                    className="flex-1 bg-red-600 text-white py-3.5 rounded-2xl font-bold text-sm">
                    탈퇴하기
                  </button>
                </div>
              </>
            )}

            {deleteStep === 3 && (
              <div className="text-center py-6">
                <div className="flex gap-1.5 justify-center mb-4">
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 rounded-full bg-red-600 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <p className="text-sm font-bold text-gray-700">탈퇴 처리 중...</p>
                <p className="text-xs text-gray-400 mt-1">잠시만 기다려주세요</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}