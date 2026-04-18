"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  doc, setDoc, getDoc, updateDoc, addDoc,
  collection, serverTimestamp, arrayUnion, arrayRemove,
  onSnapshot, query, where, getDocs, orderBy, limit,
} from "firebase/firestore";

// ─── 상수 ──────────────────────────────────────────────────
function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const DAYS       = ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"];
const EMOJI_LIST = ["🌿", "🌱", "♻️", "🌍", "🏃", "💪", "🌸", "⭐", "🔥", "🌊", "🦋", "🌻"];
const REGIONS    = [
  "서울특별시", "부산광역시", "대구광역시", "인천광역시",
  "광주광역시", "대전광역시", "울산광역시", "세종특별자치시",
  "경기도", "강원도", "충청북도", "충청남도",
  "전북특별자치도", "전라남도", "경상북도", "경상남도", "제주특별자치도",
];
const SHORT_REGIONS = [
  "전체", "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];

const EMPTY_FORM = {
  name: "", emoji: "🌿", description: "",
  region: "", district: "",
  scheduleDay: "토요일", scheduleTime: "09:00",
  hasSchedule: false, maxMembers: 20,
};

// ─── 동아리 생성·수정 공통 폼 ──────────────────────────────
function ClubForm({ form, onChange, loading, onSubmit, submitLabel, onCancel }) {
  return (
    <>
      <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
        {/* 이모지 */}
        <div>
          <label className="text-xs font-bold text-gray-500 mb-2 block">동아리 아이콘</label>
          <div className="flex flex-wrap gap-2">
            {EMOJI_LIST.map((e) => (
              <button key={e} type="button" onClick={() => onChange("emoji", e)}
                className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all
                  ${form.emoji === e ? "bg-sky-100 ring-2 ring-sky-400 scale-110" : "bg-gray-50"}`}>
                {e}
              </button>
            ))}
          </div>
        </div>
        {/* 이름 */}
        <div>
          <label className="text-xs font-bold text-gray-500 mb-1 block">
            동아리 이름 <span className="text-red-400">*</span>
          </label>
          <input value={form.name} onChange={(e) => onChange("name", e.target.value)}
            placeholder="예: 초록발자국 러닝 클럽" maxLength={20}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400" />
        </div>
        {/* 소개 */}
        <div>
          <label className="text-xs font-bold text-gray-500 mb-1 block">동아리 소개</label>
          <textarea value={form.description} onChange={(e) => onChange("description", e.target.value)}
            placeholder="동아리를 소개해주세요 (선택)" maxLength={100} rows={2}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-sky-400" />
        </div>
        {/* 지역 */}
        <div>
          <label className="text-xs font-bold text-gray-500 mb-1 block">활동 지역 (선택)</label>
          <select value={form.region} onChange={(e) => onChange("region", e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-sky-400">
            <option value="">전국 (미지정)</option>
            {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          {form.region && (
            <input value={form.district} onChange={(e) => onChange("district", e.target.value)}
              placeholder="시·군·구 (선택)" maxLength={20}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mt-2 focus:outline-none focus:border-sky-400" />
          )}
        </div>
        {/* 인원 */}
        <div>
          <label className="text-xs font-bold text-gray-500 mb-1 block">최대 인원</label>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => onChange("maxMembers", Math.max(2, form.maxMembers - 5))}
              className="w-10 h-10 bg-gray-100 rounded-xl text-lg font-bold text-gray-500 active:bg-gray-200">−</button>
            <p className="text-lg font-black text-gray-700 w-12 text-center">{form.maxMembers}</p>
            <button type="button" onClick={() => onChange("maxMembers", Math.min(200, form.maxMembers + 5))}
              className="w-10 h-10 bg-gray-100 rounded-xl text-lg font-bold text-gray-500 active:bg-gray-200">+</button>
            <p className="text-xs text-gray-400">동아리 최대 참여 인원</p>
          </div>
        </div>
        {/* 정기 모임 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-gray-500">정기 모임 일정</label>
            <button type="button" onClick={() => onChange("hasSchedule", !form.hasSchedule)}
              className={`w-11 h-6 rounded-full transition-colors flex items-center ${form.hasSchedule ? "bg-sky-500 justify-end" : "bg-gray-200 justify-start"}`}>
              <span className="w-5 h-5 bg-white rounded-full shadow mx-0.5" />
            </button>
          </div>
          {form.hasSchedule && (
            <div className="flex gap-2">
              <select value={form.scheduleDay} onChange={(e) => onChange("scheduleDay", e.target.value)}
                className="flex-1 border border-gray-200 rounded-xl px-2 py-2 text-sm bg-white focus:outline-none focus:border-sky-400">
                {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <input type="time" value={form.scheduleTime} onChange={(e) => onChange("scheduleTime", e.target.value)}
                className="flex-1 border border-gray-200 rounded-xl px-2 py-2 text-sm bg-white focus:outline-none focus:border-sky-400" />
            </div>
          )}
        </div>
      </div>
      {/* 버튼 */}
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 bg-gray-100 py-4 rounded-2xl font-bold text-sm text-gray-500">취소</button>
        <button onClick={onSubmit} disabled={loading || !form.name.trim()}
          className="flex-[2] bg-cyan-500 text-white py-4 rounded-2xl font-bold text-sm disabled:opacity-40 active:scale-95 transition-transform">
          {loading ? "처리 중…" : submitLabel}
        </button>
      </div>
    </>
  );
}

// ─── 동아리 카드 컴포넌트 ──────────────────────────────────
function ClubCard({ club, isMember, isLeader, onClickDetail, onJoin, loading }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="text-3xl w-12 h-12 bg-sky-50 rounded-xl flex items-center justify-center flex-shrink-0">
          {club.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-gray-800 truncate">{club.name}</p>
            {isLeader && (
              <span className="text-xs bg-sky-100 text-sky-600 px-1.5 py-0.5 rounded flex-shrink-0">동아리장</span>
            )}
            {isMember && !isLeader && (
              <span className="text-xs bg-green-100 text-green-600 px-1.5 py-0.5 rounded flex-shrink-0">가입됨</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            👥 {club.members?.length || 0}/{club.maxMembers || 20}명
            {club.location?.region ? ` · 📍 ${club.location.region}${club.location.district ? " " + club.location.district : ""}` : ""}
            {club.schedule ? ` · 📅 ${club.schedule.day} ${club.schedule.time}` : ""}
          </p>
          {club.description && (
            <p className="text-xs text-gray-400 truncate mt-0.5">{club.description}</p>
          )}
        </div>
        {isMember ? (
          <button onClick={() => onClickDetail(club)}
            className="flex-shrink-0 text-gray-300 text-xl">›</button>
        ) : (
          <button onClick={() => onJoin(club)} disabled={loading}
            className="flex-shrink-0 bg-cyan-500 text-white text-xs font-bold px-3 py-2 rounded-xl active:scale-95 transition-transform disabled:opacity-40">
            참여
          </button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  메인 페이지
// ═══════════════════════════════════════════════════════════
export default function ClubPage() {
  const { user } = useAuth();
  const router   = useRouter();

  // ── 모드: home | createClub | clubDetail ──
  const [mode, setMode] = useState("home");

  // ── 내 동아리 ──
  const [myClubs,      setMyClubs]      = useState([]);
  const [clubsLoading, setClubsLoading] = useState(false);

  // ── 지역별 탐색 ──
  const [allClubs,      setAllClubs]      = useState([]);
  const [regionFilter,  setRegionFilter]  = useState("전체");
  const [browseLoading, setBrowseLoading] = useState(false);

  // ── 상세 & 공통 ──
  const [selectedClub,  setSelectedClub]  = useState(null);
  const [clubJoinCode,  setClubJoinCode]  = useState("");
  const [clubEditMode,  setClubEditMode]  = useState(false);
  const [clubForm,      setClubForm]      = useState(EMPTY_FORM);
  const [clubDetailTab, setClubDetailTab] = useState("home");
  const [clubHistory,   setClubHistory]   = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editForm,      setEditForm]      = useState(EMPTY_FORM);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState("");
  const [copied,        setCopied]        = useState(false);

  const prevClubStatusRef = useRef(null);

  // ─── 내 동아리 로드 ──────────────────────────────────────
  const fetchMyClubs = useCallback(async () => {
    if (!user) return;
    setClubsLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, "clubs"), where("memberUids", "array-contains", user.uid))
      );
      setMyClubs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error("내 동아리 로드 실패:", e); }
    finally { setClubsLoading(false); }
  }, [user]);

  // ─── 전체 동아리 로드 (탐색용) ───────────────────────────
  const fetchAllClubs = useCallback(async () => {
    setBrowseLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, "clubs"), where("status", "==", "active"))
      );
      setAllClubs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error("동아리 탐색 로드 실패:", e); }
    finally { setBrowseLoading(false); }
  }, []);

  // ─── 기록 로드 ───────────────────────────────────────────
  const fetchClubHistory = useCallback(async (code) => {
    setHistoryLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, "clubs", code, "history"), orderBy("createdAt", "desc"))
      );
      setClubHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error("기록 로드 실패:", e); }
    finally { setHistoryLoading(false); }
  }, []);

  useEffect(() => {
    if (user) { fetchMyClubs(); fetchAllClubs(); }
  }, [user, fetchMyClubs, fetchAllClubs]);

  // ─── 실시간 리스너 (상세 모드) ───────────────────────────
  useEffect(() => {
    if (!selectedClub?.code) return;
    const unsub = onSnapshot(doc(db, "clubs", selectedClub.code), (snap) => {
      if (!snap.exists()) return;
      const data = { id: snap.id, ...snap.data() };
      setSelectedClub(data);
      setMyClubs((prev) => prev.map((c) => c.code === data.code ? data : c));
      // 플로깅 시작 감지 → 자동 이동
      if (data.status === "plogging" && prevClubStatusRef.current !== "plogging") {
        prevClubStatusRef.current = "plogging";
        router.push(`/map?groupId=${data.code}&groupSize=${data.members?.length || 1}&groupType=club`);
      }
      prevClubStatusRef.current = data.status;
    });
    return () => unsub();
  }, [selectedClub?.code, router]);

  // ─── 핸들러 ──────────────────────────────────────────────
  const formToLocation = (f) =>
    f.region ? { region: f.region, district: f.district.trim() } : null;
  const formToSchedule = (f) =>
    f.hasSchedule ? { day: f.scheduleDay, time: f.scheduleTime } : null;
  const clubToForm = (club) => ({
    name: club.name || "", emoji: club.emoji || "🌿",
    description: club.description || "",
    region: club.location?.region || "", district: club.location?.district || "",
    scheduleDay: club.schedule?.day || "토요일", scheduleTime: club.schedule?.time || "09:00",
    hasSchedule: !!club.schedule, maxMembers: club.maxMembers || 20,
  });

  const handleCreateClub = async () => {
    if (!user || !clubForm.name.trim()) return;
    setLoading(true); setError("");
    try {
      const code = generateCode();
      const name = user.displayName || user.email?.split("@")[0] || "동아리장";
      const data = {
        code, name: clubForm.name.trim(), emoji: clubForm.emoji,
        description: clubForm.description.trim(),
        location: formToLocation(clubForm), schedule: formToSchedule(clubForm),
        hostUid: user.uid, hostName: name,
        members: [{ uid: user.uid, name, photoURL: user.photoURL || "" }],
        memberUids: [user.uid], maxMembers: clubForm.maxMembers,
        status: "active", totalPloggings: 0, totalDistance: 0, totalDuration: 0,
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, "clubs", code), data);
      const created = { id: code, ...data };
      setMyClubs((prev) => [...prev, created]);
      setAllClubs((prev) => [...prev, created]);
      setSelectedClub(created);
      setClubForm(EMPTY_FORM);
      prevClubStatusRef.current = "active";
      setClubDetailTab("home"); setClubHistory([]);
      setMode("clubDetail");
    } catch (e) { setError("동아리 생성 실패: " + e.message); }
    finally { setLoading(false); }
  };

  const handleEditClub = async () => {
    if (!selectedClub || !editForm.name.trim()) return;
    setLoading(true); setError("");
    try {
      const updates = {
        name: editForm.name.trim(), emoji: editForm.emoji,
        description: editForm.description.trim(),
        location: formToLocation(editForm), schedule: formToSchedule(editForm),
        maxMembers: editForm.maxMembers, updatedAt: serverTimestamp(),
      };
      await updateDoc(doc(db, "clubs", selectedClub.code), updates);
      setSelectedClub((prev) => ({ ...prev, ...updates }));
      setMyClubs((prev) => prev.map((c) => c.code === selectedClub.code ? { ...c, ...updates } : c));
      setClubEditMode(false);
    } catch (e) { setError("수정 실패: " + e.message); }
    finally { setLoading(false); }
  };

  // 코드로 참여
  const handleJoinByCode = async () => {
    if (!user || !clubJoinCode.trim()) return;
    setLoading(true); setError("");
    try {
      const code = clubJoinCode.trim().toUpperCase();
      const snap = await getDoc(doc(db, "clubs", code));
      if (!snap.exists()) { setError("존재하지 않는 동아리 코드예요."); return; }
      await joinClub(code, snap.data());
      setClubJoinCode("");
    } catch (e) { setError("참여 실패: " + e.message); }
    finally { setLoading(false); }
  };

  // 바로 참여
  const handleDirectJoin = async (club) => {
    if (!user) { router.push("/login"); return; }
    setLoading(true); setError("");
    try {
      await joinClub(club.code || club.id, club);
    } catch (e) { setError("참여 실패: " + e.message); }
    finally { setLoading(false); }
  };

  // 공용 참여 로직
  const joinClub = async (code, data) => {
    if (data.memberUids?.includes(user.uid)) { setError("이미 가입된 동아리예요."); return; }
    if ((data.members?.length || 0) >= data.maxMembers) {
      setError(`최대 인원(${data.maxMembers}명)을 초과했어요.`); return;
    }
    const name = user.displayName || user.email?.split("@")[0] || "멤버";
    await updateDoc(doc(db, "clubs", code), {
      members: arrayUnion({ uid: user.uid, name, photoURL: user.photoURL || "" }),
      memberUids: arrayUnion(user.uid),
    });
    const joined = { id: code, ...data };
    setSelectedClub(joined);
    setMyClubs((prev) => [...prev, joined]);
    prevClubStatusRef.current = data.status ?? "active";
    setClubDetailTab("home"); setClubHistory([]); fetchClubHistory(code);
    setMode("clubDetail");
  };

  const handleStartClubPlogging = async () => {
    if (!selectedClub || selectedClub.hostUid !== user?.uid) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, "clubs", selectedClub.code), { status: "plogging" });
      router.push(`/map?groupId=${selectedClub.code}&groupSize=${selectedClub.members?.length || 1}&groupType=club`);
    } catch (e) { setError("시작 실패: " + e.message); }
    finally { setLoading(false); }
  };

  const handleTransferLeader = async (memberUid, memberName) => {
    if (!selectedClub || selectedClub.hostUid !== user?.uid) return;
    if (!confirm(`'${memberName}'님에게 동아리장을 위임하시겠어요?`)) return;
    try {
      await updateDoc(doc(db, "clubs", selectedClub.code), { hostUid: memberUid, hostName: memberName });
      setSelectedClub((prev) => ({ ...prev, hostUid: memberUid, hostName: memberName }));
      setMyClubs((prev) => prev.map((c) =>
        c.code === selectedClub.code ? { ...c, hostUid: memberUid, hostName: memberName } : c
      ));
      alert(`✅ ${memberName}님에게 동아리장을 위임했습니다.`);
    } catch (e) { alert("위임 실패: " + e.message); }
  };

  const handleLeaveClub = async () => {
    if (!selectedClub || !user) return;
    if (selectedClub.hostUid === user.uid) {
      alert("동아리장은 직접 탈퇴할 수 없어요.\n다른 멤버에게 동아리장을 위임한 후 탈퇴해주세요.");
      return;
    }
    if (!confirm(`'${selectedClub.name}' 동아리에서 탈퇴하시겠어요?`)) return;
    try {
      const me = selectedClub.members?.find((m) => m.uid === user.uid);
      await updateDoc(doc(db, "clubs", selectedClub.code), {
        members: arrayRemove(me), memberUids: arrayRemove(user.uid),
      });
      setMyClubs((prev) => prev.filter((c) => c.code !== selectedClub.code));
      setSelectedClub(null); setMode("home");
    } catch (e) { alert("탈퇴 실패: " + e.message); }
  };

  const handleCopyCode = async (code) => {
    const text = `🏅 플로깅 동아리 초대!\n\n동아리 코드: ${code}\n앱에서 '플로깅 동아리 → 코드로 참여' 에 입력하세요.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch { alert("코드: " + code); }
  };

  const openEdit = () => {
    setEditForm(clubToForm(selectedClub));
    setClubEditMode(true); setError("");
  };

  const goDetail = (club) => {
    prevClubStatusRef.current = club.status ?? "active";
    setSelectedClub(club); setMode("clubDetail");
    setClubEditMode(false); setClubDetailTab("home");
    setClubHistory([]); fetchClubHistory(club.code);
  };

  // ─── 지역 필터링 ────────────────────────────────────────
  const myClubIds = new Set(myClubs.map((c) => c.code || c.id));
  const filteredClubs = allClubs.filter((c) => {
    if (regionFilter === "전체") return true;
    const region = c.location?.region || "";
    return region.startsWith(regionFilter);
  });

  // ─── 로그인 필요 ────────────────────────────────────────
  if (!user) return (
    <div className="flex flex-col items-center justify-center h-screen gap-4 text-center px-6">
      <div className="text-5xl">🔑</div>
      <p className="font-bold text-gray-700">로그인이 필요해요</p>
      <p className="text-sm text-gray-400">동아리에 참여하려면 먼저 로그인해주세요</p>
      <Link href="/login" className="bg-green-500 text-white px-8 py-3 rounded-2xl font-bold">로그인</Link>
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-50"
      style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom, 20px))" }}>

      {/* ── 헤더 ── */}
      <div className="bg-white px-4 pt-4 pb-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black text-gray-800">🏅 플로깅 동아리</h1>
            <p className="text-xs text-gray-400 mt-0.5">함께 뛰면 더 즐거워요</p>
          </div>
          <button onClick={() => { setMode("createClub"); setError(""); setClubForm(EMPTY_FORM); }}
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-white active:scale-95 transition-transform"
            style={{ backgroundColor: "#8dc63f" }}>
            + 새 동아리
          </button>
        </div>
      </div>

      <div className="px-4 mt-3 space-y-4">

        {/* ═══════════ 홈 모드 ═══════════ */}
        {mode === "home" && (
          <>
            {/* ── 내 동아리 ── */}
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1 mb-2">내 동아리</p>
              {clubsLoading ? (
                <div className="text-center py-6 text-gray-400 text-sm animate-pulse">불러오는 중...</div>
              ) : myClubs.length > 0 ? (
                <div className="space-y-2">
                  {myClubs.map((club) => (
                    <ClubCard key={club.id} club={club} isMember={true}
                      isLeader={club.hostUid === user.uid}
                      onClickDetail={goDetail} onJoin={() => {}} loading={false} />
                  ))}
                </div>
              ) : (
                <div className="bg-sky-50 rounded-2xl p-4 text-center border border-sky-100">
                  <div className="text-3xl mb-1">🏅</div>
                  <p className="text-sky-700 font-bold text-sm">아직 가입된 동아리가 없어요</p>
                  <p className="text-sky-400 text-xs mt-1">아래에서 동아리를 찾아 참여하거나 새로 만들어보세요</p>
                </div>
              )}
            </div>

            {/* ── 새 동아리 만들기 버튼 ── */}
            <button onClick={() => { setMode("createClub"); setError(""); setClubForm(EMPTY_FORM); }}
              className="w-full bg-cyan-500 text-white py-4 rounded-2xl shadow-md font-bold text-base active:scale-95 transition-transform">
              🏅 새 동아리 만들기
            </button>

            {/* ── 코드로 참여 ── */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h2 className="font-bold text-gray-700 mb-2 text-sm">🔑 초대 코드로 참여</h2>
              <div className="flex gap-2">
                <input value={clubJoinCode} onChange={(e) => setClubJoinCode(e.target.value.toUpperCase())}
                  placeholder="6자리 코드" maxLength={6}
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-center text-lg font-mono font-bold tracking-widest focus:outline-none focus:border-sky-400" />
                <button onClick={handleJoinByCode} disabled={loading || clubJoinCode.length < 6}
                  className="bg-cyan-500 text-white px-5 rounded-xl font-bold disabled:opacity-40 active:scale-95 transition-transform">
                  참여
                </button>
              </div>
              {error && mode === "home" && <p className="text-red-500 text-xs mt-2">{error}</p>}
            </div>

            {/* ── 지역별 동아리 탐색 ── */}
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1 mb-2">지역별 동아리 탐색</p>

              {/* 지역 필터 탭 */}
              <div className="overflow-x-auto -mx-4 px-4 mb-3">
                <div className="flex gap-1.5 pb-1" style={{ minWidth: "max-content" }}>
                  {SHORT_REGIONS.map((r) => (
                    <button key={r} onClick={() => setRegionFilter(r)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all
                        ${regionFilter === r
                          ? "text-white shadow-sm"
                          : "bg-white text-gray-500 border border-gray-100"}`}
                      style={regionFilter === r ? { backgroundColor: "#8dc63f" } : undefined}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* 동아리 목록 */}
              {browseLoading ? (
                <div className="text-center py-6 text-gray-400 text-sm animate-pulse">동아리 찾는 중...</div>
              ) : filteredClubs.length > 0 ? (
                <div className="space-y-2">
                  {filteredClubs.map((club) => {
                    const isMine = myClubIds.has(club.code || club.id);
                    return (
                      <ClubCard key={club.id} club={club}
                        isMember={isMine}
                        isLeader={club.hostUid === user?.uid}
                        onClickDetail={isMine ? goDetail : () => {}}
                        onJoin={handleDirectJoin} loading={loading} />
                    );
                  })}
                </div>
              ) : (
                <div className="bg-gray-100 rounded-2xl p-5 text-center">
                  <div className="text-3xl mb-1">🔍</div>
                  <p className="text-gray-500 font-bold text-sm">
                    {regionFilter === "전체" ? "아직 공개된 동아리가 없어요" : `${regionFilter} 지역 동아리가 없어요`}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">첫 번째 동아리를 만들어보세요!</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ═══════════ 동아리 생성 ═══════════ */}
        {mode === "createClub" && (
          <>
            <div className="flex items-center gap-3 mb-1">
              <button onClick={() => { setMode("home"); setError(""); }} className="text-gray-400 text-2xl leading-none">←</button>
              <h2 className="font-black text-gray-800 text-lg">새 동아리 만들기</h2>
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <ClubForm form={clubForm}
              onChange={(k, v) => setClubForm((p) => ({ ...p, [k]: v }))}
              loading={loading} onSubmit={handleCreateClub}
              submitLabel={`${clubForm.emoji} 동아리 만들기`}
              onCancel={() => { setMode("home"); setError(""); }} />
          </>
        )}

        {/* ═══════════ 동아리 상세 ═══════════ */}
        {mode === "clubDetail" && selectedClub && !clubEditMode && (
          <>
            {/* 헤더 */}
            <div className="flex items-center gap-3 mb-1">
              <button onClick={() => { setMode("home"); setError(""); }}
                className="text-gray-400 text-2xl leading-none">←</button>
              <h2 className="font-black text-gray-800 text-lg truncate flex-1">
                {selectedClub.emoji} {selectedClub.name}
              </h2>
              {selectedClub.hostUid === user?.uid && (
                <button onClick={openEdit}
                  className="flex-shrink-0 text-xs bg-sky-50 text-sky-600 border border-sky-200 px-3 py-1.5 rounded-full font-bold active:bg-sky-100">
                  ✏️ 수정
                </button>
              )}
            </div>

            {/* 내부 탭 */}
            <div className="flex bg-white rounded-2xl p-1 shadow-sm gap-1">
              {[["home","🏠 홈"],["history","📋 기록"],["stats","📊 통계"]].map(([t, label]) => (
                <button key={t}
                  onClick={() => {
                    setClubDetailTab(t);
                    if ((t === "history" || t === "stats") && clubHistory.length === 0) fetchClubHistory(selectedClub.code);
                  }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all
                    ${clubDetailTab === t ? "bg-cyan-500 text-white shadow" : "text-gray-400"}`}>
                  {label}
                </button>
              ))}
            </div>

            {/* ════ 홈 탭 ════ */}
            {clubDetailTab === "home" && (
              <>
                {/* 동아리 코드 */}
                <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
                  <p className="text-xs text-gray-400 mb-1">동아리 초대 코드</p>
                  <p className="text-3xl font-mono font-black text-sky-600 tracking-widest mb-2">{selectedClub.code}</p>
                  {selectedClub.description && (
                    <p className="text-sm text-gray-500 mb-3 leading-relaxed">{selectedClub.description}</p>
                  )}
                  <div className="flex flex-wrap justify-center gap-2 mb-3">
                    {selectedClub.location?.region && (
                      <span className="inline-flex items-center gap-1 bg-green-50 rounded-full px-3 py-1">
                        <span className="text-xs text-green-600 font-bold">
                          📍 {selectedClub.location.region}{selectedClub.location.district ? " " + selectedClub.location.district : ""}
                        </span>
                      </span>
                    )}
                    {selectedClub.schedule && (
                      <span className="inline-flex items-center gap-1 bg-sky-50 rounded-full px-3 py-1">
                        <span className="text-xs text-sky-600 font-bold">📅 {selectedClub.schedule.day} {selectedClub.schedule.time}</span>
                      </span>
                    )}
                  </div>
                  <button onClick={() => handleCopyCode(selectedClub.code)}
                    className={`w-full py-3 rounded-xl font-medium text-sm transition-colors
                      ${copied ? "bg-green-100 text-green-600" : "bg-sky-50 text-sky-600 border border-sky-200"}`}>
                    {copied ? "✅ 복사됨!" : "📋 초대 코드 복사하기"}
                  </button>
                </div>

                {/* 멤버 목록 */}
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex justify-between items-center mb-3">
                    <h2 className="font-bold text-gray-700">멤버 ({selectedClub.members?.length || 0}/{selectedClub.maxMembers})</h2>
                    <span className="text-xs text-gray-400 animate-pulse">● 실시간</span>
                  </div>
                  <div className="space-y-2">
                    {(selectedClub.members || []).map((member) => (
                      <div key={member.uid} className="flex items-center gap-3 py-1">
                        <div className="w-9 h-9 rounded-full bg-sky-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {member.photoURL
                            ? <img src={member.photoURL} alt="" className="w-full h-full object-cover" />
                            : <span className="text-lg">😊</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-700 flex items-center gap-1 flex-wrap">
                            <span className="truncate">{member.name}</span>
                            {member.uid === selectedClub.hostUid && (
                              <span className="text-xs bg-sky-100 text-sky-600 px-1.5 py-0.5 rounded flex-shrink-0">동아리장</span>
                            )}
                            {member.uid === user?.uid && (
                              <span className="text-xs text-gray-400 flex-shrink-0">(나)</span>
                            )}
                          </p>
                        </div>
                        {selectedClub.hostUid === user?.uid && member.uid !== user?.uid && (
                          <button onClick={() => handleTransferLeader(member.uid, member.name)}
                            className="flex-shrink-0 text-xs bg-amber-50 text-amber-600 border border-amber-200 px-2 py-1 rounded-lg font-bold active:bg-amber-100">
                            위임
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {selectedClub.hostUid === user?.uid && (selectedClub.members?.length || 0) > 1 && (
                    <p className="text-xs text-gray-400 mt-3 text-center">
                      💡 멤버 옆 <span className="font-bold text-amber-500">위임</span> 버튼으로 동아리장을 이전할 수 있어요
                    </p>
                  )}
                </div>

                {/* 그룹 보너스 */}
                <div className="bg-sky-50 rounded-2xl p-3 text-center">
                  <p className="text-sm text-sky-700">
                    오늘 플로깅 시 <span className="font-bold">{selectedClub.members?.length || 0}명</span> 참여 —
                    그룹 보너스 <span className="font-bold text-sky-600">+{(selectedClub.members?.length || 0) * 5}P</span> 예정
                  </p>
                </div>

                {/* 플로깅 시작 */}
                {selectedClub.hostUid === user?.uid ? (
                  <button onClick={handleStartClubPlogging} disabled={loading}
                    className="w-full bg-green-500 text-white py-5 rounded-2xl font-bold text-lg shadow-md disabled:opacity-40 active:scale-95 transition-transform">
                    {loading ? "시작 중..." : `🚀 오늘의 플로깅 시작 (${selectedClub.members?.length || 0}명)`}
                  </button>
                ) : (
                  <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
                    <div className="text-3xl mb-1 animate-bounce">⏳</div>
                    <p className="text-gray-600 font-medium text-sm">동아리장이 플로깅을 시작하면 자동으로 이동해요</p>
                  </div>
                )}

                {/* 탈퇴 */}
                {selectedClub.hostUid !== user?.uid && (
                  <button onClick={handleLeaveClub}
                    className="w-full bg-white text-red-400 py-3 rounded-2xl text-sm font-medium shadow-sm border border-red-100 active:bg-red-50">
                    동아리 탈퇴하기
                  </button>
                )}
              </>
            )}

            {/* ════ 기록 탭 ════ */}
            {clubDetailTab === "history" && (
              <>
                {historyLoading ? (
                  <div className="text-center py-10 text-gray-400 text-sm animate-pulse">기록 불러오는 중...</div>
                ) : clubHistory.length === 0 ? (
                  <div className="text-center py-14">
                    <div className="text-5xl mb-3">📋</div>
                    <p className="font-bold text-gray-500">아직 플로깅 기록이 없어요</p>
                    <p className="text-xs text-gray-400 mt-1">동아리 플로깅을 완료하면 여기에 기록돼요</p>
                  </div>
                ) : (() => {
                  const grouped = {};
                  clubHistory.forEach((h) => {
                    const key = h.sessionDate || h.createdAt?.toDate?.()?.toLocaleDateString("ko-KR") || "날짜 없음";
                    if (!grouped[key]) grouped[key] = [];
                    grouped[key].push(h);
                  });
                  return (
                    <div className="space-y-4">
                      {Object.entries(grouped).map(([date, entries]) => (
                        <div key={date} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                          <div className="bg-sky-50 px-4 py-2 border-b border-sky-100">
                            <p className="text-xs font-bold text-sky-600">📅 {date}</p>
                            <p className="text-xs text-sky-400">{entries.length}명 참여</p>
                          </div>
                          <div className="divide-y divide-gray-50">
                            {entries.map((h) => (
                              <div key={h.id} className="flex items-center gap-3 px-4 py-3">
                                <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                                  {h.photoURL ? <img src={h.photoURL} alt="" className="w-full h-full object-cover" /> : <span className="text-sm">😊</span>}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-gray-700 truncate">
                                    {h.name}{h.uid === user?.uid && <span className="text-xs text-gray-400 font-normal ml-1">(나)</span>}
                                  </p>
                                  <p className="text-xs text-gray-400">{h.distance?.toFixed(2)}km · {Math.floor((h.duration || 0) / 60)}분{h.verified && " · ✅ 인증"}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="text-sm font-black text-sky-600">+{h.points}P</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </>
            )}

            {/* ════ 통계 탭 ════ */}
            {clubDetailTab === "stats" && (() => {
              const myHistory = clubHistory.filter((h) => h.uid === user?.uid);
              const totalDist = clubHistory.reduce((s, h) => s + (h.distance || 0), 0);
              const totalMin  = Math.round(clubHistory.reduce((s, h) => s + (h.duration || 0), 0) / 60);
              const myDist    = myHistory.reduce((s, h) => s + (h.distance || 0), 0);
              const memberCounts = {};
              clubHistory.forEach((h) => {
                if (!memberCounts[h.uid]) memberCounts[h.uid] = { name: h.name, photoURL: h.photoURL, count: 0, dist: 0 };
                memberCounts[h.uid].count++;
                memberCounts[h.uid].dist += (h.distance || 0);
              });
              const memberRank = Object.values(memberCounts).sort((a, b) => b.count - a.count);

              return (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl p-4 shadow-sm">
                    <h3 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wide">동아리 전체</h3>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { icon:"🏃", val: clubHistory.length, unit:"회", label:"총 기록" },
                        { icon:"📍", val: totalDist.toFixed(1), unit:"km", label:"총 거리" },
                        { icon:"⏱", val: totalMin, unit:"분", label:"총 시간" },
                      ].map(({ icon, val, unit, label }) => (
                        <div key={label} className="bg-sky-50 rounded-xl p-3 text-center">
                          <div className="text-xl mb-1">{icon}</div>
                          <p className="text-lg font-black text-sky-700">{val}<span className="text-xs font-normal text-sky-400 ml-0.5">{unit}</span></p>
                          <p className="text-xs text-gray-400">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm">
                    <h3 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wide">나의 기록</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { icon:"🏅", val: myHistory.length, unit:"회", label:"참여 횟수" },
                        { icon:"🌿", val: myDist.toFixed(1), unit:"km", label:"총 거리" },
                      ].map(({ icon, val, unit, label }) => (
                        <div key={label} className="bg-green-50 rounded-xl p-3 text-center">
                          <div className="text-xl mb-1">{icon}</div>
                          <p className="text-lg font-black text-green-700">{val}<span className="text-xs font-normal text-green-400 ml-0.5">{unit}</span></p>
                          <p className="text-xs text-gray-400">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {memberRank.length > 0 && (
                    <div className="bg-white rounded-2xl p-4 shadow-sm">
                      <h3 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wide">멤버 참여 순위</h3>
                      <div className="space-y-2">
                        {memberRank.map((m, i) => (
                          <div key={m.name + i} className="flex items-center gap-3">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0
                              ${i === 0 ? "bg-yellow-400 text-white" : i === 1 ? "bg-gray-300 text-white" : i === 2 ? "bg-amber-600 text-white" : "bg-gray-100 text-gray-400"}`}>
                              {i + 1}
                            </span>
                            <div className="w-7 h-7 rounded-full bg-sky-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {m.photoURL ? <img src={m.photoURL} alt="" className="w-full h-full object-cover" /> : <span className="text-xs">😊</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-gray-700 truncate">{m.name}</p>
                              <p className="text-xs text-gray-400">{m.dist.toFixed(1)}km</p>
                            </div>
                            <span className="text-sm font-black text-sky-600 flex-shrink-0">{m.count}회</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {!historyLoading && clubHistory.length === 0 && (
                    <div className="text-center py-10">
                      <div className="text-4xl mb-2">📊</div>
                      <p className="text-gray-400 text-sm">플로깅을 완료하면 통계가 쌓여요</p>
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        )}

        {/* ═══════════ 동아리 수정 ═══════════ */}
        {mode === "clubDetail" && selectedClub && clubEditMode && (
          <>
            <div className="flex items-center gap-3 mb-1">
              <button onClick={() => { setClubEditMode(false); setError(""); }}
                className="text-gray-400 text-2xl leading-none">←</button>
              <h2 className="font-black text-gray-800 text-lg">동아리 수정</h2>
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <ClubForm form={editForm}
              onChange={(k, v) => setEditForm((p) => ({ ...p, [k]: v }))}
              loading={loading} onSubmit={handleEditClub}
              submitLabel="✅ 수정 완료"
              onCancel={() => { setClubEditMode(false); setError(""); }} />
          </>
        )}
      </div>
    </div>
  );
}
