"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection, query, getDocs, orderBy, limit,
  doc, updateDoc, where, getCountFromServer,
  deleteDoc, addDoc, setDoc, getDoc,
  serverTimestamp, writeBatch, Timestamp,
} from "firebase/firestore";

// ─── 관리자 이메일 ────────────────────────────────────────
const ADMIN_EMAILS = ["hubmission@gmail.com"];

// ─── 공통 컴포넌트 ────────────────────────────────────────
function StatCard({ icon, label, value, sub, color = "green" }) {
  const colors = {
    green:  "bg-green-50  text-green-700",
    blue:   "bg-blue-50   text-blue-700",
    orange: "bg-orange-50 text-orange-700",
    purple: "bg-purple-50 text-purple-700",
    red:    "bg-red-50    text-red-700",
    gray:   "bg-gray-100  text-gray-700",
  };
  return (
    <div className={`rounded-2xl p-4 ${colors[color]}`}>
      <div className="text-2xl mb-1">{icon}</div>
      <p className="text-2xl font-black">{value}</p>
      <p className="text-xs font-medium opacity-70">{label}</p>
      {sub && <p className="text-xs opacity-50 mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }) {
  return <h2 className="font-bold text-gray-700 text-sm mb-2">{children}</h2>;
}

// ─── 메인 페이지 ──────────────────────────────────────────
export default function AdminPage() {
  const { user } = useAuth();
  const router   = useRouter();

  const isAdmin = user && ADMIN_EMAILS.includes(user.email);

  // ── 공통 상태 ──────────────────────────────────────────
  const [activeTab,  setActiveTab]  = useState("dashboard");
  const [loading,    setLoading]    = useState(true);
  const [actionMsg,  setActionMsg]  = useState("");

  // ── 대시보드 ───────────────────────────────────────────
  const [stats,    setStats]    = useState(null);
  const [today,    setToday]    = useState(null);
  const [topUsers, setTopUsers] = useState([]);

  // ── 유저 ──────────────────────────────────────────────
  const [users,        setUsers]        = useState([]);
  const [userSearch,   setUserSearch]   = useState("");
  const [expandedUid,  setExpandedUid]  = useState(null);
  const [pointInput,   setPointInput]   = useState("");
  const [pointReason,  setPointReason]  = useState("");

  // ── 리워드 ────────────────────────────────────────────
  const [rewards,      setRewards]      = useState([]);
  const [rewardFilter, setRewardFilter] = useState("pending");

  // ── 유지관리 ──────────────────────────────────────────
  const [appSettings,   setAppSettings]   = useState(null);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [confirmInput,  setConfirmInput]  = useState("");

  // ── 공지사항 ──────────────────────────────────────────
  const [notices,       setNotices]       = useState([]);
  const [newNotice,     setNewNotice]     = useState({ title: "", content: "", type: "info" });
  const [noticeMode,    setNoticeMode]    = useState(false); // 작성 모드
  const [editingNotice, setEditingNotice] = useState(null);  // 수정 중인 공지 (null = 새 작성)

  // ── 에코스팟 ──────────────────────────────────────────
  const ECO_CATEGORIES = [
    { id: "eco_store",   label: "🌿 친환경매장",   color: "bg-green-100 text-green-700",  border: "#16A34A" },
    { id: "recycle_bin", label: "♻️ 재활용수거기",  color: "bg-blue-100 text-blue-700",    border: "#2563EB" },
    { id: "smart_bin",   label: "🗑️ 스마트휴지통", color: "bg-purple-100 text-purple-700", border: "#7C3AED" },
  ];
  const EMPTY_ECO = { name: "", address: "", lat: "", lng: "", category: "eco_store", region: "전국", desc: "", benefit: "", contact: "", icon: "", active: true };
  const [ecoSpots,     setEcoSpots]     = useState([]);
  const [ecoMode,      setEcoMode]      = useState(false);
  const [editingEco,   setEditingEco]   = useState(null);
  const [newEco,       setNewEco]       = useState(EMPTY_ECO);
  const [ecoCatFilter, setEcoCatFilter] = useState("all");

  // ── 배너 ──────────────────────────────────────────────
  const [banners,      setBanners]      = useState([]);
  const [bannerMode,   setBannerMode]   = useState(false);   // 등록 폼 표시
  const [editingBanner, setEditingBanner] = useState(null);  // 수정 중인 배너
  const REGIONS = [
    "서울특별시", "부산광역시", "대구광역시", "인천광역시",
    "광주광역시", "대전광역시", "울산광역시", "세종특별자치시",
    "경기도", "강원도", "충청북도", "충청남도",
    "전북특별자치도", "전라남도", "경상북도", "경상남도", "제주특별자치도",
  ];
  const REGION_SHORT = {
    "서울특별시":"서울", "부산광역시":"부산", "대구광역시":"대구", "인천광역시":"인천",
    "광주광역시":"광주", "대전광역시":"대전", "울산광역시":"울산", "세종특별자치시":"세종",
    "경기도":"경기", "강원도":"강원", "충청북도":"충북", "충청남도":"충남",
    "전북특별자치도":"전북", "전라남도":"전남", "경상북도":"경북", "경상남도":"경남", "제주특별자치도":"제주",
  };

  const EMPTY_BANNER = {
    title: "", sub: "", image: "", link: "", tag: "",
    emoji: "🌿", bg: "from-green-400 to-green-600", active: true,
    region: "전국", priority: 12,
  };
  const [newBanner,          setNewBanner]          = useState(EMPTY_BANNER);
  const [bannerRegionFilter, setBannerRegionFilter] = useState("전체"); // 배너 지역 필터

  const BG_OPTIONS = [
    "from-green-400 to-green-600",  "from-blue-400 to-blue-600",
    "from-purple-400 to-purple-600","from-orange-400 to-orange-500",
    "from-teal-400 to-teal-600",    "from-pink-400 to-pink-600",
    "from-indigo-400 to-indigo-600","from-yellow-400 to-yellow-500",
    "from-red-400 to-red-500",      "from-cyan-400 to-cyan-600",
    "from-lime-400 to-lime-600",    "from-violet-400 to-violet-600",
  ];

  // ── 메시지 표시 ───────────────────────────────────────
  const showMsg = (msg) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(""), 3000);
  };

  // ──────────────────────────────────────────────────────
  //  Fetch: 대시보드
  // ──────────────────────────────────────────────────────
  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const weekStart  = new Date(); weekStart.setDate(weekStart.getDate() - 7);

      const [usersCount, routesCount, rewardsCount] = await Promise.all([
        getCountFromServer(collection(db, "users")),
        getCountFromServer(collection(db, "routes")),
        getCountFromServer(collection(db, "reward_history")),
      ]);

      // 전체 경로 집계
      const allRoutes = await getDocs(collection(db, "routes"));
      let totalDist = 0, totalPts = 0, todayDist = 0, todayCount = 0, weekCount = 0;
      allRoutes.forEach((d) => {
        const r = d.data();
        totalDist += r.distance || 0;
        totalPts  += r.points   || 0;
        const t = r.createdAt?.toDate?.();
        if (t && t >= todayStart) { todayDist  += r.distance || 0; todayCount++; }
        if (t && t >= weekStart)  { weekCount++; }
      });

      // 대기 중 리워드 수
      const pendingSnap = await getCountFromServer(
        query(collection(db, "reward_history"), where("status", "==", "pending"))
      );

      // 상위 5명 (totalDistance 기준)
      const usersSnap = await getDocs(collection(db, "users"));
      const topArr = usersSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.totalDistance || 0) - (a.totalDistance || 0))
        .slice(0, 5);

      setStats({
        userCount:    usersCount.data().count,
        routeCount:   routesCount.data().count,
        rewardCount:  rewardsCount.data().count,
        pendingCount: pendingSnap.data().count,
        totalDist, totalPts,
      });
      setToday({ todayCount, todayDist: todayDist.toFixed(2), weekCount });
      setTopUsers(topArr);
    } catch (e) {
      console.error("대시보드 로드 실패:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // ──────────────────────────────────────────────────────
  //  Fetch: 유저
  // ──────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      const arr  = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setUsers(arr);
    } catch (e) { console.error("유저 로드 실패:", e); }
    finally { setLoading(false); }
  }, []);

  // ──────────────────────────────────────────────────────
  //  Fetch: 리워드
  // ──────────────────────────────────────────────────────
  const fetchRewards = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "reward_history"));
      const arr  = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setRewards(arr);
    } catch (e) { console.error("리워드 로드 실패:", e); }
    finally { setLoading(false); }
  }, []);

  // ──────────────────────────────────────────────────────
  //  Fetch: 유지관리 (앱 설정)
  // ──────────────────────────────────────────────────────
  const fetchMaintenance = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, "settings", "app"));
      if (snap.exists()) {
        setAppSettings(snap.data());
      } else {
        // 기본값 초기화
        const defaults = { minDistanceKm: 0.5, minDurationSec: 600, minStops: 3, dailyMax: 3, speedLimitEnabled: true, aiVerificationEnabled: true };
        setAppSettings(defaults);
      }
    } catch (e) { console.error("설정 로드 실패:", e); }
    finally { setLoading(false); }
  }, []);

  // ──────────────────────────────────────────────────────
  //  Fetch: 배너
  // ──────────────────────────────────────────────────────
  const fetchBanners = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "banners"));
      const all  = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // priority 우선, 없으면 order, 그도 없으면 99
      all.sort((a, b) => (a.priority ?? a.order ?? 99) - (b.priority ?? b.order ?? 99));
      setBanners(all);
    } catch (e) { console.error("배너 로드 실패:", e); }
    finally { setLoading(false); }
  }, []);

  // ──────────────────────────────────────────────────────
  //  Fetch: 공지사항
  // ──────────────────────────────────────────────────────
  const fetchNotices = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "notices"));
      const arr  = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setNotices(arr);
    } catch (e) { console.error("공지사항 로드 실패:", e); }
    finally { setLoading(false); }
  }, []);

  // ── Fetch: 에코스팟 ───────────────────────────────────
  const fetchEcoSpots = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, "partners"));
      const arr  = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setEcoSpots(arr);
    } catch (e) { console.error("에코스팟 로드 실패:", e); }
  }, []);

  // ── 탭 전환 시 데이터 로드 ─────────────────────────────
  useEffect(() => {
    if (!user || !isAdmin) return;
    if (activeTab === "dashboard")   fetchDashboard();
    if (activeTab === "users")       fetchUsers();
    if (activeTab === "rewards")     fetchRewards();
    if (activeTab === "maintenance") fetchMaintenance();
    if (activeTab === "notices")     fetchNotices();
    if (activeTab === "banners")     fetchBanners();
    if (activeTab === "ecospots")    fetchEcoSpots();
  }, [activeTab, user, isAdmin]);

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    if (user && !isAdmin) { router.push("/"); return; }
  }, [user, isAdmin, router]);

  // ──────────────────────────────────────────────────────
  //  Action: 포인트 조정
  // ──────────────────────────────────────────────────────
  const handlePointAdjust = async (uid, displayName) => {
    const delta = parseInt(pointInput, 10);
    if (isNaN(delta) || delta === 0) { showMsg("❌ 올바른 포인트 값을 입력하세요"); return; }
    try {
      const userRef  = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);
      const current  = userSnap.data()?.totalPoints || 0;
      const newPts   = Math.max(0, current + delta);
      await updateDoc(userRef, { totalPoints: newPts });
      setUsers((prev) => prev.map((u) => u.id === uid ? { ...u, totalPoints: newPts } : u));
      setPointInput(""); setPointReason(""); setExpandedUid(null);
      showMsg(`✅ ${displayName} 포인트 ${delta > 0 ? "+" : ""}${delta}P → ${newPts}P`);
    } catch (e) { showMsg("❌ 포인트 조정 실패: " + e.message); }
  };

  // ──────────────────────────────────────────────────────
  //  Action: 리워드 상태 처리
  // ──────────────────────────────────────────────────────
  const handleRewardStatus = async (rewardId, status) => {
    try {
      await updateDoc(doc(db, "reward_history", rewardId), { status, processedAt: serverTimestamp() });
      setRewards((prev) => prev.map((r) => r.id === rewardId ? { ...r, status } : r));
      showMsg(`✅ ${status === "completed" ? "처리 완료" : "반려"} 처리되었습니다`);
    } catch (e) { showMsg("❌ 처리 실패: " + e.message); }
  };

  // ──────────────────────────────────────────────────────
  //  Action: 앱 설정 저장
  // ──────────────────────────────────────────────────────
  const handleSaveSettings = async () => {
    try {
      await setDoc(doc(db, "settings", "app"), { ...appSettings, updatedAt: serverTimestamp() });
      setSettingsDirty(false);
      showMsg("✅ 앱 설정이 저장되었습니다");
    } catch (e) { showMsg("❌ 설정 저장 실패: " + e.message); }
  };

  // ──────────────────────────────────────────────────────
  //  Action: 테스트 데이터 삭제
  // ──────────────────────────────────────────────────────
  const handleCleanTestData = async () => {
    if (confirmInput !== "삭제확인") { showMsg("❌ '삭제확인'을 정확히 입력하세요"); return; }
    try {
      const snap = await getDocs(
        query(collection(db, "routes"), where("isTestData", "==", true))
      );
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      setConfirmInput("");
      showMsg(`✅ 테스트 데이터 ${snap.size}개 삭제 완료`);
    } catch (e) { showMsg("❌ 삭제 실패: " + e.message); }
  };

  // ──────────────────────────────────────────────────────
  //  Action: 만료 경로 삭제
  // ──────────────────────────────────────────────────────
  const handleCleanExpired = async () => {
    try {
      const now  = Timestamp.now();
      const snap = await getDocs(
        query(collection(db, "routes"), where("expiresAt", "<", now))
      );
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      showMsg(`✅ 만료된 경로 ${snap.size}개 삭제 완료`);
    } catch (e) { showMsg("❌ 삭제 실패: " + e.message); }
  };

  // ──────────────────────────────────────────────────────
  //  Action: 공지사항 생성
  // ──────────────────────────────────────────────────────
  const handleCreateNotice = async () => {
    if (!newNotice.title.trim() || !newNotice.content.trim()) {
      showMsg("❌ 제목과 내용을 입력하세요"); return;
    }
    try {
      const docRef = await addDoc(collection(db, "notices"), {
        ...newNotice,
        active:    true,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      });
      setNotices((prev) => [{ id: docRef.id, ...newNotice, active: true }, ...prev]);
      setNewNotice({ title: "", content: "", type: "info" });
      setNoticeMode(false);
      showMsg("✅ 공지사항이 등록되었습니다");
    } catch (e) { showMsg("❌ 등록 실패: " + e.message); }
  };

  // ──────────────────────────────────────────────────────
  //  Action: 공지사항 수정
  // ──────────────────────────────────────────────────────
  const handleUpdateNotice = async () => {
    if (!newNotice.title.trim() || !newNotice.content.trim()) {
      showMsg("❌ 제목과 내용을 입력하세요"); return;
    }
    try {
      await updateDoc(doc(db, "notices", editingNotice.id), {
        title:     newNotice.title,
        content:   newNotice.content,
        type:      newNotice.type,
        updatedAt: serverTimestamp(),
      });
      setNotices((prev) => prev.map((n) =>
        n.id === editingNotice.id
          ? { ...n, title: newNotice.title, content: newNotice.content, type: newNotice.type }
          : n
      ));
      setNewNotice({ title: "", content: "", type: "info" });
      setEditingNotice(null);
      setNoticeMode(false);
      showMsg("✅ 공지사항이 수정되었습니다");
    } catch (e) { showMsg("❌ 수정 실패: " + e.message); }
  };

  // ──────────────────────────────────────────────────────
  //  Action: 공지사항 토글/삭제
  // ──────────────────────────────────────────────────────
  const handleToggleNotice = async (id, current) => {
    try {
      await updateDoc(doc(db, "notices", id), { active: !current });
      setNotices((prev) => prev.map((n) => n.id === id ? { ...n, active: !current } : n));
    } catch (e) { showMsg("❌ 수정 실패: " + e.message); }
  };

  const handleDeleteNotice = async (id) => {
    if (!confirm("공지사항을 삭제할까요?")) return;
    try {
      await deleteDoc(doc(db, "notices", id));
      setNotices((prev) => prev.filter((n) => n.id !== id));
      showMsg("✅ 공지사항이 삭제되었습니다");
    } catch (e) { showMsg("❌ 삭제 실패: " + e.message); }
  };

  // ──────────────────────────────────────────────────────
  //  Action: 에코스팟 CRUD
  // ──────────────────────────────────────────────────────
  const handleSaveEco = async () => {
    if (!newEco.name.trim()) { showMsg("❌ 장소명을 입력하세요"); return; }
    const lat = parseFloat(newEco.lat);
    const lng = parseFloat(newEco.lng);
    if (isNaN(lat) || isNaN(lng)) { showMsg("❌ 위도/경도를 올바르게 입력하세요"); return; }
    try {
      const data = { ...newEco, lat, lng, updatedAt: serverTimestamp() };
      if (editingEco) {
        await updateDoc(doc(db, "partners", editingEco.id), data);
        setEcoSpots((prev) => prev.map((e) => e.id === editingEco.id ? { ...e, ...data } : e));
        showMsg("✅ 에코스팟이 수정되었습니다");
      } else {
        const docRef = await addDoc(collection(db, "partners"), { ...data, createdAt: serverTimestamp() });
        setEcoSpots((prev) => [{ id: docRef.id, ...data }, ...prev]);
        showMsg("✅ 에코스팟이 등록되었습니다");
      }
      setNewEco(EMPTY_ECO); setEditingEco(null); setEcoMode(false);
    } catch (e) { showMsg("❌ 저장 실패: " + e.message); }
  };

  const handleToggleEco = async (id, current) => {
    try {
      await updateDoc(doc(db, "partners", id), { active: !current });
      setEcoSpots((prev) => prev.map((e) => e.id === id ? { ...e, active: !current } : e));
    } catch (e) { showMsg("❌ 상태 변경 실패: " + e.message); }
  };

  const handleDeleteEco = async (id) => {
    if (!confirm("이 에코스팟을 삭제할까요?")) return;
    try {
      await deleteDoc(doc(db, "partners", id));
      setEcoSpots((prev) => prev.filter((e) => e.id !== id));
      showMsg("✅ 삭제되었습니다");
    } catch (e) { showMsg("❌ 삭제 실패: " + e.message); }
  };

  // ──────────────────────────────────────────────────────
  //  Action: 배너 등록
  // ──────────────────────────────────────────────────────
  const handleCreateBanner = async () => {
    if (!newBanner.title.trim() && !newBanner.image.trim()) {
      showMsg("❌ 제목 또는 이미지 URL을 입력하세요"); return;
    }
    try {
      const priority = Number(newBanner.priority) || 12;
      const docRef = await addDoc(collection(db, "banners"), {
        ...newBanner, priority,
        order: priority, // 하위호환
        createdAt: serverTimestamp(),
      });
      const added = { id: docRef.id, ...newBanner, priority };
      setBanners((prev) => [...prev, added].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99)));
      setNewBanner(EMPTY_BANNER);
      setBannerMode(false);
      showMsg("✅ 배너가 등록되었습니다");
    } catch (e) { showMsg("❌ 등록 실패: " + e.message); }
  };

  // ──────────────────────────────────────────────────────
  //  Action: 배너 수정 저장
  // ──────────────────────────────────────────────────────
  const handleSaveBanner = async () => {
    if (!editingBanner) return;
    try {
      const { id, ...data } = editingBanner;
      await updateDoc(doc(db, "banners", id), { ...data, updatedAt: serverTimestamp() });
      setBanners((prev) => prev.map((b) => b.id === id ? editingBanner : b));
      setEditingBanner(null);
      showMsg("✅ 배너가 수정되었습니다");
    } catch (e) { showMsg("❌ 수정 실패: " + e.message); }
  };

  // ──────────────────────────────────────────────────────
  //  Action: 배너 활성/비활성 토글
  // ──────────────────────────────────────────────────────
  const handleToggleBanner = async (id, current) => {
    try {
      await updateDoc(doc(db, "banners", id), { active: !current });
      setBanners((prev) => prev.map((b) => b.id === id ? { ...b, active: !current } : b));
    } catch (e) { showMsg("❌ 수정 실패: " + e.message); }
  };

  // ──────────────────────────────────────────────────────
  //  Action: 배너 삭제
  // ──────────────────────────────────────────────────────
  const handleDeleteBanner = async (id) => {
    if (!confirm("이 배너를 삭제할까요?")) return;
    try {
      await deleteDoc(doc(db, "banners", id));
      setBanners((prev) => prev.filter((b) => b.id !== id));
      showMsg("🗑 배너가 삭제되었습니다");
    } catch (e) { showMsg("❌ 삭제 실패: " + e.message); }
  };

  // ──────────────────────────────────────────────────────
  //  Action: 배너 순서 이동
  // ──────────────────────────────────────────────────────
  const handleMoveBanner = async (id, dir) => {
    const idx = banners.findIndex((b) => b.id === id);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= banners.length) return;
    const newBanners = [...banners];
    [newBanners[idx], newBanners[swapIdx]] = [newBanners[swapIdx], newBanners[idx]];
    // priority 재부여 (1부터 순서대로)
    const updates = newBanners.map((b, i) => ({ ...b, priority: i + 1, order: i + 1 }));
    setBanners(updates);
    try {
      const batch = writeBatch(db);
      updates.forEach((b) => batch.update(doc(db, "banners", b.id), { priority: b.priority, order: b.order }));
      await batch.commit();
    } catch (e) { showMsg("❌ 순서 변경 실패: " + e.message); }
  };

  // ──────────────────────────────────────────────────────
  //  Guard
  // ──────────────────────────────────────────────────────
  if (!user || !isAdmin) return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-gray-400">접근 권한이 없습니다.</p>
    </div>
  );

  // ──────────────────────────────────────────────────────
  //  필터
  // ──────────────────────────────────────────────────────
  const filteredUsers   = users.filter((u) =>
    !userSearch || (u.displayName || u.email || "").toLowerCase().includes(userSearch.toLowerCase())
  );
  const filteredRewards = rewardFilter === "all"
    ? rewards
    : rewards.filter((r) => r.status === rewardFilter);

  const TAB_LIST = [
    { id: "dashboard",   label: "📊",  name: "통계" },
    { id: "users",       label: "👥",  name: "유저" },
    { id: "rewards",     label: "🎁",  name: `리워드${rewards.filter(r=>r.status==="pending").length > 0 ? ` (${rewards.filter(r=>r.status==="pending").length})` : ""}` },
    { id: "banners",     label: "🖼️",  name: "배너" },
    { id: "ecospots",    label: "♻️",  name: "에코스팟" },
    { id: "maintenance", label: "🔧",  name: "유지관리" },
    { id: "notices",     label: "📢",  name: "공지" },
  ];

  const noticeTypeStyle = {
    info:    { bg: "bg-blue-50",   text: "text-blue-700",   label: "📌 안내" },
    warning: { bg: "bg-orange-50", text: "text-orange-700", label: "⚠️ 주의" },
    event:   { bg: "bg-green-50",  text: "text-green-700",  label: "🎉 이벤트" },
  };

  return (
    <div className="min-h-screen bg-gray-50" style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom, 20px))" }}>

      {/* ── 헤더 ── */}
      <div className="bg-gray-900 text-white px-4 pt-12 pb-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold">🔧 관리자 대시보드</h1>
            <p className="text-gray-400 text-xs mt-0.5">{user.email}</p>
          </div>
          <button
            onClick={() => {
              if (activeTab === "dashboard")   fetchDashboard();
              if (activeTab === "users")       fetchUsers();
              if (activeTab === "rewards")     fetchRewards();
              if (activeTab === "maintenance") fetchMaintenance();
              if (activeTab === "notices")     fetchNotices();
            }}
            className="bg-gray-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
          >
            🔄 새로고침
          </button>
        </div>
      </div>

      {/* ── 액션 메시지 ── */}
      {actionMsg && (
        <div className="mx-4 mt-3 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
          <p className="text-sm text-green-700 font-medium">{actionMsg}</p>
        </div>
      )}

      {/* ── 탭 바 ── */}
      <div className="flex bg-white border-b overflow-x-auto no-scrollbar">
        {TAB_LIST.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-shrink-0 flex-1 py-3 text-xs font-medium border-b-2 transition-colors min-w-[56px]
              ${activeTab === tab.id ? "border-green-500 text-green-600" : "border-transparent text-gray-400"}`}
          >
            <span className="block text-base">{tab.label}</span>
            <span>{tab.name}</span>
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center py-8 text-gray-400 animate-pulse text-sm">로딩 중...</div>
      )}

      {!loading && (
        <div className="px-4 py-4 space-y-4">

          {/* ══════════════════════════════════════
              📊 대시보드 탭
          ══════════════════════════════════════ */}
          {activeTab === "dashboard" && stats && today && (
            <>
              {/* 오늘 현황 */}
              <div>
                <SectionTitle>📅 오늘 현황</SectionTitle>
                <div className="grid grid-cols-3 gap-2">
                  <StatCard icon="🏃" label="오늘 플로깅"  value={`${today.todayCount}회`}       color="green" />
                  <StatCard icon="📍" label="오늘 거리"    value={`${today.todayDist}km`}         color="blue"  />
                  <StatCard icon="📆" label="이번주 전체"  value={`${today.weekCount}회`}          color="orange" />
                </div>
              </div>

              {/* 전체 누적 */}
              <div>
                <SectionTitle>📈 전체 누적</SectionTitle>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard icon="👤" label="총 가입자"    value={`${stats.userCount}명`}          color="blue"   />
                  <StatCard icon="🏃" label="총 플로깅"    value={`${stats.routeCount}회`}          color="green"  />
                  <StatCard icon="📍" label="총 거리"      value={`${stats.totalDist.toFixed(0)}km`} color="orange" />
                  <StatCard icon="🎁" label="리워드 신청"  value={`${stats.rewardCount}건`}         color="purple" />
                </div>
              </div>

              {/* 운영 요약 */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <SectionTitle>💡 운영 지표</SectionTitle>
                {[
                  { label: "총 적립 포인트",       value: `${(stats.totalPts || 0).toLocaleString()}P` },
                  { label: "유저 1인당 평균 거리",  value: `${stats.userCount ? (stats.totalDist / stats.userCount).toFixed(1) : 0}km` },
                  { label: "유저 1인당 평균 횟수",  value: `${stats.userCount ? (stats.routeCount / stats.userCount).toFixed(1) : 0}회` },
                  { label: "처리 대기 리워드",      value: `${stats.pendingCount}건`, highlight: stats.pendingCount > 0 },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between py-2 border-b last:border-0 text-sm">
                    <span className="text-gray-500">{item.label}</span>
                    <span className={`font-bold ${item.highlight ? "text-red-500 animate-pulse" : "text-gray-700"}`}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* 누적 거리 TOP 5 */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b">
                  <SectionTitle>🏆 누적 거리 TOP 5</SectionTitle>
                </div>
                {topUsers.map((u, i) => (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-0">
                    <span className={`text-base font-black w-6 text-center
                      ${i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-400" : i === 2 ? "text-orange-400" : "text-gray-300"}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">
                        {u.displayName || u.email || "익명"}
                      </p>
                      <p className="text-xs text-gray-400">{u.ploggingCount || 0}회</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-600">{(u.totalDistance || 0).toFixed(1)}km</p>
                      <p className="text-xs text-gray-400">{(u.totalPoints || 0).toLocaleString()}P</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ══════════════════════════════════════
              👥 유저 탭
          ══════════════════════════════════════ */}
          {activeTab === "users" && (
            <>
              {/* 검색 */}
              <div className="relative">
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="이름 또는 이메일 검색..."
                  className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-green-400"
                />
                {userSearch && (
                  <button onClick={() => setUserSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
                    ✕
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400">총 {filteredUsers.length}명</p>

              {/* 유저 목록 */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {filteredUsers.map((u) => {
                  const isExpanded = expandedUid === u.id;
                  const date = u.createdAt?.toDate?.();
                  const dateStr = date ? `${date.getFullYear()}.${date.getMonth()+1}.${date.getDate()}` : "-";
                  return (
                    <div key={u.id} className="border-b last:border-0">
                      {/* 유저 행 */}
                      <button
                        className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-gray-50"
                        onClick={() => { setExpandedUid(isExpanded ? null : u.id); setPointInput(""); setPointReason(""); }}
                      >
                        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm flex-shrink-0 overflow-hidden">
                          {u.photoURL ? <img src={u.photoURL} alt="" className="w-full h-full object-cover" /> : "👤"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-700 truncate">
                            {u.displayName || u.email || "익명"}
                          </p>
                          <p className="text-xs text-gray-400">{dateStr} 가입 · {u.provider || "email"}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-bold text-green-600">{(u.totalPoints || 0).toLocaleString()}P</p>
                          <p className="text-xs text-gray-400">{u.ploggingCount || 0}회 · {(u.totalDistance || 0).toFixed(1)}km</p>
                        </div>
                        <span className={`text-gray-400 text-sm transition-transform ${isExpanded ? "rotate-180" : ""}`}>▾</span>
                      </button>

                      {/* 확장: 포인트 조정 패널 */}
                      {isExpanded && (
                        <div className="bg-gray-50 px-4 py-3 border-t space-y-2">
                          <p className="text-xs text-gray-500 font-medium">🔧 포인트 수동 조정</p>
                          <p className="text-xs text-gray-400">UID: {u.id}</p>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={pointInput}
                              onChange={(e) => setPointInput(e.target.value)}
                              placeholder="예: +500 또는 -200"
                              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:border-green-400"
                            />
                            <button
                              onClick={() => handlePointAdjust(u.id, u.displayName || u.email || "유저")}
                              className="bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-bold"
                            >
                              적용
                            </button>
                          </div>
                          <p className="text-xs text-gray-400">현재 {(u.totalPoints || 0).toLocaleString()}P · 조정 후: {((u.totalPoints || 0) + (parseInt(pointInput) || 0)).toLocaleString()}P</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ══════════════════════════════════════
              🎁 리워드 탭
          ══════════════════════════════════════ */}
          {activeTab === "rewards" && (
            <>
              {/* 상태 필터 */}
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {[
                  { id: "pending",   label: `대기 (${rewards.filter(r=>r.status==="pending").length})` },
                  { id: "completed", label: `완료 (${rewards.filter(r=>r.status==="completed").length})` },
                  { id: "rejected",  label: `반려 (${rewards.filter(r=>r.status==="rejected").length})` },
                  { id: "all",       label: `전체 (${rewards.length})` },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setRewardFilter(f.id)}
                    className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-medium border transition-colors
                      ${rewardFilter === f.id ? "bg-green-500 text-white border-green-500" : "bg-white text-gray-500 border-gray-200"}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* 리워드 목록 */}
              {filteredRewards.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                  <div className="text-4xl mb-2">✅</div>
                  <p className="text-gray-400 text-sm">해당하는 리워드 신청이 없어요</p>
                </div>
              ) : (
                filteredRewards.map((r) => {
                  const date    = r.createdAt?.toDate?.();
                  const dateStr = date ? `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2,"0")}` : "-";
                  const statusStyle = {
                    pending:   "bg-yellow-100 text-yellow-700",
                    completed: "bg-green-100 text-green-700",
                    rejected:  "bg-red-100 text-red-600",
                  };
                  return (
                    <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-800 text-sm">{r.rewardTitle}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{dateStr} · {(r.cost||0).toLocaleString()}P</p>
                          <p className="text-xs text-gray-300 mt-0.5 truncate">UID: {r.userId}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-2 ${statusStyle[r.status] || statusStyle.pending}`}>
                          {r.status === "pending" ? "대기" : r.status === "completed" ? "완료" : "반려"}
                        </span>
                      </div>
                      {r.status === "pending" && (
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => handleRewardStatus(r.id, "rejected")}
                            className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-xl text-xs font-medium"
                          >
                            반려
                          </button>
                          <button
                            onClick={() => handleRewardStatus(r.id, "completed")}
                            className="flex-1 bg-green-500 text-white py-2 rounded-xl text-xs font-bold"
                          >
                            ✅ 처리 완료
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* ══════════════════════════════════════
              🔧 유지관리 탭
          ══════════════════════════════════════ */}
          {activeTab === "maintenance" && appSettings && (
            <>
              {/* ── 속도 제한 토글 ── */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <SectionTitle>🚗 이동수단 속도제한</SectionTitle>
                <p className="text-xs text-gray-400 mb-4">
                  시속 30km/h 초과 5초 지속 시 플로깅 자동 종료 기능입니다.<br/>
                  OFF 시 속도 제한 없이 플로깅이 진행됩니다.
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-700">속도제한 기능</p>
                    <p className={`text-xs mt-0.5 font-medium ${appSettings.speedLimitEnabled ? "text-green-500" : "text-red-400"}`}>
                      {appSettings.speedLimitEnabled ? "✅ 현재 ON — 30km/h 초과 시 자동 종료" : "⛔ 현재 OFF — 속도 제한 없음"}
                    </p>
                  </div>
                  {/* 토글 스위치 */}
                  <button
                    onClick={() => {
                      setAppSettings((prev) => ({ ...prev, speedLimitEnabled: !prev.speedLimitEnabled }));
                      setSettingsDirty(true);
                    }}
                    className={`relative w-14 h-7 rounded-full transition-colors duration-200 focus:outline-none ${
                      appSettings.speedLimitEnabled ? "bg-green-500" : "bg-gray-300"
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${
                      appSettings.speedLimitEnabled ? "translate-x-7" : "translate-x-0"
                    }`} />
                  </button>
                </div>
              </div>

              {/* ── AI 사진 검증 토글 ── */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <SectionTitle>🤖 AI 사진 검증</SectionTitle>
                <p className="text-xs text-gray-400 mb-4">
                  플로깅 완료 시 쓰레기봉투 사진을 AI로 자동 인식하는 기능입니다.<br />
                  OFF 시 사진 촬영 후 AI 검증 없이 바로 업로드됩니다.<br />
                  <span className="text-orange-400 font-medium">※ Anthropic API 키가 설정된 경우에만 작동합니다</span>
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-700">AI 사진 인식 기능</p>
                    <p className={`text-xs mt-0.5 font-medium ${appSettings.aiVerificationEnabled ? "text-green-500" : "text-red-400"}`}>
                      {appSettings.aiVerificationEnabled
                        ? "✅ 현재 ON — 쓰레기봉투 AI 자동 판별"
                        : "⛔ 현재 OFF — AI 검증 없이 사진 업로드"}
                    </p>
                  </div>
                  {/* 토글 스위치 */}
                  <button
                    onClick={() => {
                      setAppSettings((prev) => ({ ...prev, aiVerificationEnabled: !prev.aiVerificationEnabled }));
                      setSettingsDirty(true);
                    }}
                    className={`relative w-14 h-7 rounded-full transition-colors duration-200 focus:outline-none ${
                      appSettings.aiVerificationEnabled ? "bg-green-500" : "bg-gray-300"
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${
                      appSettings.aiVerificationEnabled ? "translate-x-7" : "translate-x-0"
                    }`} />
                  </button>
                </div>
              </div>

              {/* 앱 인증 조건 설정 */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <SectionTitle>⚙️ 플로깅 인증 조건 설정</SectionTitle>
                <p className="text-xs text-gray-400 mb-3">변경 시 앱 재배포 없이 즉시 반영됩니다</p>
                {[
                  { key: "minDistanceKm", label: "최소 이동 거리 (km)", step: "0.1", min: 0.1 },
                  { key: "minDurationSec", label: "최소 진행 시간 (초)", step: "60", min: 60 },
                  { key: "minStops", label: "최소 줍기 횟수 (회)", step: "1", min: 1 },
                  { key: "dailyMax", label: "하루 최대 포인트 지급 횟수", step: "1", min: 1 },
                ].map(({ key, label, step, min }) => (
                  <div key={key} className="flex items-center justify-between py-2.5 border-b last:border-0">
                    <label className="text-sm text-gray-600 flex-1">{label}</label>
                    <input
                      type="number"
                      step={step}
                      min={min}
                      value={appSettings[key]}
                      onChange={(e) => {
                        setAppSettings((prev) => ({ ...prev, [key]: parseFloat(e.target.value) }));
                        setSettingsDirty(true);
                      }}
                      className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right outline-none focus:border-green-400"
                    />
                  </div>
                ))}
              </div>

              {/* ── 통합 저장 버튼 ── */}
              {settingsDirty && (
                <div className="bg-white rounded-2xl p-4 shadow-sm border-2 border-green-300">
                  <p className="text-xs text-green-600 font-medium mb-3 text-center">
                    ⚠️ 변경된 설정이 있습니다. 저장 후 적용됩니다.
                  </p>
                  <button
                    onClick={handleSaveSettings}
                    className="w-full bg-green-500 text-white py-3.5 rounded-xl font-black text-base shadow-md active:scale-95 transition-transform"
                  >
                    💾 설정 전체 저장
                  </button>
                </div>
              )}

              {/* 데이터 정리 */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <SectionTitle>🧹 데이터 정리</SectionTitle>

                {/* 만료 경로 삭제 */}
                <div className="bg-blue-50 rounded-xl p-3 mb-3">
                  <p className="text-sm font-medium text-blue-700 mb-1">📍 만료된 경로 삭제</p>
                  <p className="text-xs text-blue-500 mb-2">expiresAt이 지난 routes 문서를 일괄 삭제합니다</p>
                  <button
                    onClick={handleCleanExpired}
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold"
                  >
                    만료 경로 정리
                  </button>
                </div>

                {/* 테스트 데이터 삭제 */}
                <div className="bg-red-50 rounded-xl p-3">
                  <p className="text-sm font-medium text-red-600 mb-1">⚠️ 테스트 데이터 삭제</p>
                  <p className="text-xs text-red-400 mb-2">isTestData=true 인 routes를 모두 삭제합니다. 되돌릴 수 없어요!</p>
                  <input
                    type="text"
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    placeholder="'삭제확인' 입력 후 버튼 클릭"
                    className="w-full border border-red-200 rounded-lg px-3 py-2 text-xs bg-white mb-2 outline-none"
                  />
                  <button
                    onClick={handleCleanTestData}
                    className="bg-red-500 text-white px-4 py-2 rounded-lg text-xs font-bold"
                  >
                    테스트 데이터 삭제
                  </button>
                </div>
              </div>

              {/* 앱 정보 */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <SectionTitle>ℹ️ 앱 정보</SectionTitle>
                {[
                  { label: "Firebase 프로젝트", value: "plogging-app" },
                  { label: "배포 URL", value: "happy500.kr" },
                  { label: "관리자 이메일", value: ADMIN_EMAILS.join(", ") },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between py-2 border-b last:border-0 text-xs">
                    <span className="text-gray-400">{item.label}</span>
                    <span className="text-gray-600 font-medium truncate ml-2 max-w-[55%] text-right">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ══════════════════════════════════════
              📢 공지사항 탭
          ══════════════════════════════════════ */}
          {activeTab === "notices" && (
            <>
              {/* 작성 버튼 / 폼 */}
              {!noticeMode ? (
                <button
                  onClick={() => setNoticeMode(true)}
                  className="w-full bg-green-500 text-white py-3 rounded-2xl font-bold text-sm"
                >
                  ✏️ 새 공지사항 작성
                </button>
              ) : (
                <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
                  <SectionTitle>{editingNotice ? "✏️ 공지사항 수정" : "✏️ 공지사항 작성"}</SectionTitle>

                  {/* 유형 선택 */}
                  <div className="flex gap-2">
                    {["info","warning","event"].map((t) => (
                      <button
                        key={t}
                        onClick={() => setNewNotice((p) => ({ ...p, type: t }))}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors
                          ${newNotice.type === t ? "bg-green-500 text-white border-green-500" : "text-gray-400 border-gray-200"}`}
                      >
                        {noticeTypeStyle[t].label}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    value={newNotice.title}
                    onChange={(e) => setNewNotice((p) => ({ ...p, title: e.target.value }))}
                    placeholder="제목"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-400"
                  />
                  <textarea
                    value={newNotice.content}
                    onChange={(e) => setNewNotice((p) => ({ ...p, content: e.target.value }))}
                    placeholder="내용을 입력하세요"
                    rows={3}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-400 resize-none"
                  />

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setNoticeMode(false);
                        setEditingNotice(null);
                        setNewNotice({ title: "", content: "", type: "info" });
                      }}
                      className="flex-1 bg-gray-100 text-gray-500 py-3 rounded-xl text-sm font-medium"
                    >
                      취소
                    </button>
                    <button
                      onClick={editingNotice ? handleUpdateNotice : handleCreateNotice}
                      className="flex-1 bg-green-500 text-white py-3 rounded-xl text-sm font-bold"
                    >
                      {editingNotice ? "수정 완료" : "등록"}
                    </button>
                  </div>
                </div>
              )}

              {/* 공지사항 목록 */}
              {notices.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                  <div className="text-4xl mb-2">📢</div>
                  <p className="text-gray-400 text-sm">등록된 공지사항이 없어요</p>
                </div>
              ) : (
                notices.map((n) => {
                  const style = noticeTypeStyle[n.type] || noticeTypeStyle.info;
                  const date  = n.createdAt?.toDate?.();
                  const dateStr = date ? `${date.getFullYear()}.${date.getMonth()+1}.${date.getDate()}` : "-";
                  return (
                    <div key={n.id} className={`rounded-2xl p-4 shadow-sm ${style.bg} ${!n.active ? "opacity-50" : ""}`}>
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${style.text}`}>{style.label}</span>
                          {!n.active && <span className="text-xs text-gray-400">비활성</span>}
                        </div>
                        <p className="text-xs text-gray-400">{dateStr}</p>
                      </div>
                      <p className={`font-bold text-sm ${style.text} mb-1`}>{n.title}</p>
                      <p className="text-xs text-gray-600 mb-3 whitespace-pre-line">{n.content}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleToggleNotice(n.id, n.active)}
                          className="flex-1 bg-white/60 text-gray-600 py-1.5 rounded-lg text-xs font-medium"
                        >
                          {n.active ? "비활성화" : "활성화"}
                        </button>
                        <button
                          onClick={() => {
                            setEditingNotice(n);
                            setNewNotice({ title: n.title, content: n.content, type: n.type || "info" });
                            setNoticeMode(true);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="flex-1 bg-blue-100 text-blue-600 py-1.5 rounded-lg text-xs font-medium"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDeleteNotice(n.id)}
                          className="flex-1 bg-red-100 text-red-600 py-1.5 rounded-lg text-xs font-medium"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* ══════════════════════════════════════
              ♻️ 에코스팟 탭
          ══════════════════════════════════════ */}
          {activeTab === "ecospots" && (() => {
            const filteredEco = ecoCatFilter === "all"
              ? ecoSpots
              : ecoSpots.filter((e) => e.category === ecoCatFilter);
            return (
              <>
                {/* 헤더 */}
                <div className="flex justify-between items-center">
                  <SectionTitle>♻️ 에코스팟 관리 ({ecoSpots.length}개)</SectionTitle>
                  <button
                    onClick={() => { setEcoMode((v) => !v); setEditingEco(null); setNewEco(EMPTY_ECO); }}
                    className="text-xs bg-green-500 text-white px-3 py-1.5 rounded-full font-bold"
                  >
                    {ecoMode ? "✕ 닫기" : "+ 장소 등록"}
                  </button>
                </div>

                {/* 카테고리 필터 */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {[{ id: "all", label: `전체 (${ecoSpots.length})` }, ...ECO_CATEGORIES.map((c) => ({
                    id: c.id,
                    label: `${c.label} (${ecoSpots.filter((e) => e.category === c.id).length})`,
                  }))].map((t) => (
                    <button key={t.id} onClick={() => setEcoCatFilter(t.id)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all
                        ${ecoCatFilter === t.id ? "bg-green-500 text-white" : "bg-white text-gray-500 border border-gray-200"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* 등록/수정 폼 */}
                {ecoMode && (
                  <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
                    <SectionTitle>{editingEco ? "✏️ 에코스팟 수정" : "✏️ 에코스팟 등록"}</SectionTitle>

                    {/* 카테고리 선택 */}
                    <div className="flex gap-2">
                      {ECO_CATEGORIES.map((c) => (
                        <button key={c.id} onClick={() => setNewEco((p) => ({ ...p, category: c.id }))}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors
                            ${newEco.category === c.id ? "bg-green-500 text-white border-green-500" : "text-gray-400 border-gray-200"}`}>
                          {c.label}
                        </button>
                      ))}
                    </div>

                    <input type="text" placeholder="장소명 *"
                      value={newEco.name}
                      onChange={(e) => setNewEco((p) => ({ ...p, name: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-400" />

                    <input type="text" placeholder="주소 (예: 서울시 강남구 ...)"
                      value={newEco.address}
                      onChange={(e) => setNewEco((p) => ({ ...p, address: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-400" />

                    <div className="flex gap-2">
                      <input type="text" placeholder="위도 (예: 37.5665)"
                        value={newEco.lat}
                        onChange={(e) => setNewEco((p) => ({ ...p, lat: e.target.value }))}
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-400" />
                      <input type="text" placeholder="경도 (예: 126.9780)"
                        value={newEco.lng}
                        onChange={(e) => setNewEco((p) => ({ ...p, lng: e.target.value }))}
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-400" />
                    </div>

                    <div className="bg-blue-50 rounded-xl px-3 py-2 text-xs text-blue-700">
                      💡 위도/경도는 카카오맵 또는 구글맵에서 장소를 우클릭하면 확인할 수 있어요
                    </div>

                    {/* 노출 지역 */}
                    <div>
                      <p className="text-xs text-gray-500 font-medium mb-1">📍 노출 지역</p>
                      <select
                        value={newEco.region}
                        onChange={(e) => setNewEco((p) => ({ ...p, region: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-400 bg-white"
                      >
                        <option value="전국">🌐 전국 (모든 지역에 표시)</option>
                        {REGIONS.map((r) => (
                          <option key={r} value={r}>📍 {r}</option>
                        ))}
                      </select>
                    </div>

                    <textarea placeholder="소개 (광고 문구, 간단 설명)"
                      value={newEco.desc}
                      onChange={(e) => setNewEco((p) => ({ ...p, desc: e.target.value }))}
                      rows={2}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-400 resize-none" />

                    <input type="text" placeholder="혜택 (예: 포인트 2배 적립)"
                      value={newEco.benefit}
                      onChange={(e) => setNewEco((p) => ({ ...p, benefit: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-400" />

                    <input type="text" placeholder="연락처/링크 (선택)"
                      value={newEco.contact}
                      onChange={(e) => setNewEco((p) => ({ ...p, contact: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-400" />

                    <input type="text" placeholder="아이콘 이모지 (예: 🌿 ♻️ 🏪)"
                      value={newEco.icon}
                      onChange={(e) => setNewEco((p) => ({ ...p, icon: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-400" />

                    <div className="flex gap-2">
                      <button onClick={() => { setEcoMode(false); setEditingEco(null); setNewEco(EMPTY_ECO); }}
                        className="flex-1 bg-gray-100 text-gray-500 py-3 rounded-xl text-sm font-medium">취소</button>
                      <button onClick={handleSaveEco}
                        className="flex-1 bg-green-500 text-white py-3 rounded-xl text-sm font-bold">
                        {editingEco ? "수정 완료" : "등록"}
                      </button>
                    </div>
                  </div>
                )}

                {/* 목록 */}
                {filteredEco.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                    <div className="text-4xl mb-2">♻️</div>
                    <p className="text-gray-400 text-sm">등록된 에코스팟이 없어요</p>
                  </div>
                ) : (
                  filteredEco.map((e) => {
                    const cat = ECO_CATEGORIES.find((c) => c.id === e.category) || ECO_CATEGORIES[0];
                    return (
                      <div key={e.id} className={`bg-white rounded-2xl shadow-sm overflow-hidden border-l-4 ${!e.active ? "opacity-50" : ""}`}
                        style={{ borderLeftColor: cat.border }}>
                        <div className="p-3">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">{e.icon || cat.label.split(" ")[0]}</span>
                              <div>
                                <p className="font-bold text-sm text-gray-800">{e.name}</p>
                                {e.address && <p className="text-xs text-gray-400">📍 {e.address}</p>}
                              </div>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${cat.color}`}>
                              {cat.label}
                            </span>
                          </div>
                          {e.desc && <p className="text-xs text-gray-600 mb-1">{e.desc}</p>}
                          {e.benefit && <p className="text-xs text-green-700 font-medium">🎁 {e.benefit}</p>}
                          <p className="text-xs text-gray-400 mt-1">위도 {e.lat} / 경도 {e.lng}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${!e.region || e.region === "전국" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
                            {!e.region || e.region === "전국" ? "🌐 전국" : `📍 ${REGION_SHORT[e.region] || e.region}`}
                          </span>
                        </div>
                        <div className="flex border-t border-gray-100">
                          <button onClick={() => handleToggleEco(e.id, e.active)}
                            className="flex-1 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50">
                            {e.active ? "비활성화" : "활성화"}
                          </button>
                          <button onClick={() => {
                            setEditingEco(e);
                            setNewEco({ name: e.name, address: e.address || "", lat: String(e.lat), lng: String(e.lng),
                              category: e.category || "eco_store", region: e.region || "전국",
                              desc: e.desc || "", benefit: e.benefit || "",
                              contact: e.contact || "", icon: e.icon || "", active: e.active !== false });
                            setEcoMode(true);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                            className="flex-1 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 border-l border-gray-100">
                            수정
                          </button>
                          <button onClick={() => handleDeleteEco(e.id)}
                            className="flex-1 py-2 text-xs font-medium text-red-500 hover:bg-red-50 border-l border-gray-100">
                            삭제
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            );
          })()}

          {/* ══════════════════════════════════════
              🖼️ 배너 탭
          ══════════════════════════════════════ */}
          {activeTab === "banners" && (() => {
            // 지역 필터 탭 목록: 전체 | 전국 | 17개 시/도
            const REGION_TABS = [
              { key: "전체", label: "전체", short: "전체" },
              { key: "전국", label: "🌐 전국", short: "전국" },
              ...REGIONS.map((r) => ({ key: r, label: r, short: REGION_SHORT[r] || r.slice(0, 2) })),
            ];
            const filteredBanners = bannerRegionFilter === "전체"
              ? banners
              : banners.filter((b) => (b.region || "전국") === bannerRegionFilter);

            return (
              <>
                {/* 헤더 */}
                <div className="flex justify-between items-center">
                  <SectionTitle>🖼️ 배너 관리 ({banners.length}개)</SectionTitle>
                  <button
                    onClick={() => { setBannerMode((v) => !v); setEditingBanner(null); }}
                    className="text-xs bg-green-500 text-white px-3 py-1.5 rounded-full font-bold"
                  >
                    {bannerMode ? "✕ 닫기" : "+ 배너 등록"}
                  </button>
                </div>

                {/* ── 지역 카테고리 필터 탭 ── */}
                <div className="overflow-x-auto no-scrollbar -mx-4 px-4">
                  <div className="flex gap-1.5 pb-1" style={{ width: "max-content" }}>
                    {REGION_TABS.map((t) => {
                      const cnt = t.key === "전체"
                        ? banners.length
                        : banners.filter((b) => (b.region || "전국") === t.key).length;
                      return (
                        <button key={t.key}
                          onClick={() => setBannerRegionFilter(t.key)}
                          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all
                            ${bannerRegionFilter === t.key
                              ? t.key === "전국" ? "bg-blue-500 text-white" : t.key === "전체" ? "bg-gray-700 text-white" : "bg-orange-500 text-white"
                              : "bg-white text-gray-500 border border-gray-200"}`}>
                          {t.short}
                          {cnt > 0 && <span className="ml-1 opacity-70">({cnt})</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── 등록 폼 ── */}
                {bannerMode && (
                  <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2.5 border-l-4 border-green-400">
                    <p className="text-xs font-bold text-green-700 mb-1">새 배너 등록</p>

                    {/* 이미지 URL */}
                    <div>
                      <p className="text-xs text-gray-500 mb-1">🖼 이미지 URL <span className="text-gray-300">(없으면 그라디언트 배경 사용)</span></p>
                      <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                        placeholder="https://example.com/banner.jpg"
                        value={newBanner.image}
                        onChange={(e) => setNewBanner((f) => ({ ...f, image: e.target.value }))} />
                      {newBanner.image && (
                        <img src={newBanner.image} alt="미리보기" className="mt-2 w-full h-24 object-cover rounded-xl" onError={(e) => e.target.style.display="none"} />
                      )}
                    </div>

                    {/* 제목 / 부제목 */}
                    <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                      placeholder="배너 제목"
                      value={newBanner.title}
                      onChange={(e) => setNewBanner((f) => ({ ...f, title: e.target.value }))} />
                    <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                      placeholder="부제목 (선택)"
                      value={newBanner.sub}
                      onChange={(e) => setNewBanner((f) => ({ ...f, sub: e.target.value }))} />

                    {/* 링크 / 태그 */}
                    <div className="flex gap-2">
                      <input className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                        placeholder="링크 URL (/ranking 또는 https://...)"
                        value={newBanner.link}
                        onChange={(e) => setNewBanner((f) => ({ ...f, link: e.target.value }))} />
                      <input className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                        placeholder="태그"
                        value={newBanner.tag}
                        onChange={(e) => setNewBanner((f) => ({ ...f, tag: e.target.value }))} />
                    </div>

                    {/* ⭐ 노출 지역 + 중요도 */}
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 mb-1">📍 노출 지역</p>
                        <select value={newBanner.region}
                          onChange={(e) => setNewBanner((f) => ({ ...f, region: e.target.value }))}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400 bg-white">
                          <option value="전국">🌐 전국 (전체 노출)</option>
                          {REGIONS.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                      <div className="w-24">
                        <p className="text-xs text-gray-500 mb-1">⭐ 중요도</p>
                        <input type="number" min="1" max="99"
                          value={newBanner.priority}
                          onChange={(e) => setNewBanner((f) => ({ ...f, priority: parseInt(e.target.value) || 12 }))}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-center focus:outline-none focus:border-green-400" />
                        <p className="text-[10px] text-gray-300 text-center mt-0.5">1=최우선</p>
                      </div>
                    </div>

                    {/* 이미지 없을 때: 이모지 + 배경색 */}
                    {!newBanner.image && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input className="w-16 border border-gray-200 rounded-xl px-2 py-2 text-center text-lg focus:outline-none"
                            placeholder="이모지"
                            value={newBanner.emoji}
                            onChange={(e) => setNewBanner((f) => ({ ...f, emoji: e.target.value }))} />
                          <p className="text-xs text-gray-400">이미지 없을 때 표시할 이모지</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">배경 그라디언트</p>
                          <div className="grid grid-cols-6 gap-1.5">
                            {BG_OPTIONS.map((bg) => (
                              <button key={bg}
                                onClick={() => setNewBanner((f) => ({ ...f, bg }))}
                                className={`h-8 rounded-lg bg-gradient-to-r ${bg} ${newBanner.bg === bg ? "ring-2 ring-offset-1 ring-gray-600" : ""}`} />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    <button onClick={handleCreateBanner}
                      className="w-full bg-green-500 text-white py-2.5 rounded-xl text-sm font-bold">
                      ✅ 배너 등록하기
                    </button>
                  </div>
                )}

                {/* ── 배너 목록 ── */}
                {filteredBanners.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                    <div className="text-4xl mb-2">🖼️</div>
                    <p className="text-gray-400 text-sm">
                      {bannerRegionFilter === "전체" ? "등록된 배너가 없어요" : `${REGION_SHORT[bannerRegionFilter] || bannerRegionFilter} 지역 배너가 없어요`}
                    </p>
                    <p className="text-xs text-gray-300 mt-1">배너를 등록하면 홈 화면에 자동 표시됩니다</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredBanners.map((b, idx) => (
                      <div key={b.id} className={`bg-white rounded-2xl shadow-sm overflow-hidden ${!b.active ? "opacity-50" : ""}`}>
                        {/* 미리보기 */}
                        <div className={`w-full h-20 ${b.image ? "" : `bg-gradient-to-r ${b.bg}`} flex items-center px-4 relative`}>
                          {b.image
                            ? <img src={b.image} alt={b.title} className="w-full h-full object-cover absolute inset-0" />
                            : <>
                                <span className="text-3xl mr-3">{b.emoji}</span>
                                <div>
                                  <p className="text-white font-bold text-sm">{b.title}</p>
                                  <p className="text-white/70 text-xs">{b.sub}</p>
                                </div>
                              </>
                          }
                          {b.tag && <span className="absolute top-2 right-2 bg-white/30 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{b.tag}</span>}
                          {!b.active && <span className="absolute bottom-2 left-2 bg-black/40 text-white text-xs px-2 py-0.5 rounded-full">비활성</span>}
                          {/* 지역 + 중요도 배지 */}
                          <div className="absolute bottom-2 right-2 flex gap-1">
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full
                              ${!b.region || b.region === "전국" ? "bg-blue-500/80 text-white" : "bg-orange-500/80 text-white"}`}>
                              {!b.region || b.region === "전국" ? "🌐" : "📍"}{REGION_SHORT[b.region] || b.region || "전국"}
                            </span>
                            <span className="bg-black/40 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                              ⭐{b.priority ?? "—"}
                            </span>
                          </div>
                        </div>

                        {/* 수정 폼 (인라인) */}
                        {editingBanner?.id === b.id ? (
                          <div className="p-3 space-y-2 border-t">
                            <input className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-green-400"
                              placeholder="이미지 URL"
                              value={editingBanner.image}
                              onChange={(e) => setEditingBanner((f) => ({ ...f, image: e.target.value }))} />
                            {editingBanner.image && (
                              <img src={editingBanner.image} alt="" className="w-full h-20 object-cover rounded-lg" onError={(e) => e.target.style.display="none"} />
                            )}
                            <div className="flex gap-2">
                              <input className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-green-400"
                                placeholder="제목" value={editingBanner.title}
                                onChange={(e) => setEditingBanner((f) => ({ ...f, title: e.target.value }))} />
                              <input className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-green-400"
                                placeholder="태그" value={editingBanner.tag}
                                onChange={(e) => setEditingBanner((f) => ({ ...f, tag: e.target.value }))} />
                            </div>
                            <input className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-green-400"
                              placeholder="부제목" value={editingBanner.sub}
                              onChange={(e) => setEditingBanner((f) => ({ ...f, sub: e.target.value }))} />
                            <input className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-green-400"
                              placeholder="링크 URL" value={editingBanner.link}
                              onChange={(e) => setEditingBanner((f) => ({ ...f, link: e.target.value }))} />
                            {/* 지역 + 중요도 수정 */}
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <p className="text-[10px] text-gray-400 mb-1">📍 노출 지역</p>
                                <select value={editingBanner.region || "전국"}
                                  onChange={(e) => setEditingBanner((f) => ({ ...f, region: e.target.value }))}
                                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-green-400">
                                  <option value="전국">🌐 전국</option>
                                  {REGIONS.map((r) => (
                                    <option key={r} value={r}>{REGION_SHORT[r]}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="w-20">
                                <p className="text-[10px] text-gray-400 mb-1">⭐ 중요도(1~99)</p>
                                <input type="number" min="1" max="99"
                                  value={editingBanner.priority ?? 12}
                                  onChange={(e) => setEditingBanner((f) => ({ ...f, priority: parseInt(e.target.value) || 12 }))}
                                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:border-green-400" />
                              </div>
                            </div>
                            {!editingBanner.image && (
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <input className="w-12 border border-gray-200 rounded-lg px-1 py-1 text-center text-sm focus:outline-none"
                                    value={editingBanner.emoji}
                                    onChange={(e) => setEditingBanner((f) => ({ ...f, emoji: e.target.value }))} />
                                  <p className="text-xs text-gray-400">이모지</p>
                                </div>
                                <div className="grid grid-cols-6 gap-1">
                                  {BG_OPTIONS.map((bg) => (
                                    <button key={bg} onClick={() => setEditingBanner((f) => ({ ...f, bg }))}
                                      className={`h-7 rounded-md bg-gradient-to-r ${bg} ${editingBanner.bg === bg ? "ring-2 ring-offset-1 ring-gray-600" : ""}`} />
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="flex gap-2">
                              <button onClick={() => setEditingBanner(null)}
                                className="flex-1 border border-gray-200 text-gray-400 py-1.5 rounded-lg text-xs">취소</button>
                              <button onClick={handleSaveBanner}
                                className="flex-1 bg-green-500 text-white py-1.5 rounded-lg text-xs font-bold">💾 저장</button>
                            </div>
                          </div>
                        ) : (
                          /* 정보 + 액션 버튼 */
                          <div className="px-3 py-2.5 flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-gray-700 truncate">{b.title || "(제목 없음)"}</p>
                              {b.link && <p className="text-[10px] text-gray-400 truncate">{b.link}</p>}
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {/* 순서 이동 */}
                              <button onClick={() => handleMoveBanner(b.id, "up")} disabled={idx === 0}
                                className="w-6 h-6 rounded bg-gray-100 text-gray-400 text-xs disabled:opacity-30">↑</button>
                              <button onClick={() => handleMoveBanner(b.id, "down")} disabled={idx === filteredBanners.length - 1}
                                className="w-6 h-6 rounded bg-gray-100 text-gray-400 text-xs disabled:opacity-30">↓</button>
                              {/* 수정 */}
                              <button onClick={() => { setEditingBanner({ region: "전국", priority: 12, ...b }); setBannerMode(false); }}
                                className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold">수정</button>
                              {/* 활성/비활성 */}
                              <button onClick={() => handleToggleBanner(b.id, b.active)}
                                className={`px-2 py-1 rounded-lg text-xs font-bold ${b.active ? "bg-gray-100 text-gray-500" : "bg-green-50 text-green-600"}`}>
                                {b.active ? "숨김" : "표시"}
                              </button>
                              {/* 삭제 */}
                              <button onClick={() => handleDeleteBanner(b.id)}
                                className="px-2 py-1 bg-red-50 text-red-500 rounded-lg text-xs font-bold">삭제</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          })()}

        </div>
      )}
    </div>
  );
}
