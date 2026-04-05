"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  doc, setDoc, getDoc, updateDoc,
  collection, serverTimestamp, arrayUnion, arrayRemove,
  onSnapshot, query, where, getDocs,
} from "firebase/firestore";

// ─── 랜덤 6자리 코드 ──────────────────────────────────────
function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const DAYS = ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"];
const EMOJI_LIST = ["🌿", "🌱", "♻️", "🌍", "🏃", "💪", "🌸", "⭐", "🔥", "🌊", "🦋", "🌻"];

export default function GroupPage() {
  const { user } = useAuth();
  const router = useRouter();

  // ── 탭 (1회성 | 동아리) ──────────────────────────────────
  const [tab, setTab] = useState("oneTime");

  // ── 화면 모드 ────────────────────────────────────────────
  // home | waiting | createClub | clubDetail
  const [mode, setMode] = useState("home");

  // ── 1회성 그룹 상태 ──────────────────────────────────────
  const [groupCode, setGroupCode]   = useState("");
  const [joinCode, setJoinCode]     = useState("");
  const [groupData, setGroupData]   = useState(null);

  // ── 동아리 상태 ──────────────────────────────────────────
  const [myClubs, setMyClubs]         = useState([]);
  const [clubsLoading, setClubsLoading] = useState(false);
  const [selectedClub, setSelectedClub] = useState(null);
  const [clubJoinCode, setClubJoinCode] = useState("");

  // ── 동아리 생성 폼 ───────────────────────────────────────
  const [clubForm, setClubForm] = useState({
    name: "",
    emoji: "🌿",
    description: "",
    scheduleDay: "토요일",
    scheduleTime: "09:00",
    hasSchedule: false,
    maxMembers: 20,
  });

  // ── 공통 ──────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [copied, setCopied]   = useState(false);

  // ── 1회성 그룹: 실시간 리슨 ──────────────────────────────
  useEffect(() => {
    if (!groupCode) return;
    const unsub = onSnapshot(doc(db, "groups", groupCode), (snap) => {
      if (snap.exists()) setGroupData({ id: snap.id, ...snap.data() });
    });
    return () => unsub();
  }, [groupCode]);

  // ── 1회성 그룹: 상태에 따라 지도로 이동 ──────────────────
  useEffect(() => {
    if (groupData?.status === "plogging" && mode === "waiting") {
      router.push(`/map?groupId=${groupCode}&groupSize=${groupData.members.length}`);
    }
  }, [groupData, mode, groupCode, router]);

  // ── 동아리: 실시간 리슨 (상세 화면) ──────────────────────
  useEffect(() => {
    if (!selectedClub?.code || mode !== "clubDetail") return;
    const unsub = onSnapshot(doc(db, "clubs", selectedClub.code), (snap) => {
      if (snap.exists()) setSelectedClub({ id: snap.id, ...snap.data() });
    });
    return () => unsub();
  }, [selectedClub?.code, mode]);

  // ── 동아리: 동아리장이 플로깅 시작하면 멤버도 이동 ────────
  useEffect(() => {
    if (selectedClub?.status === "plogging" && mode === "clubDetail") {
      router.push(`/map?groupId=${selectedClub.code}&groupSize=${selectedClub.members?.length || 1}`);
    }
  }, [selectedClub?.status, mode, selectedClub, router]);

  // ── 내 동아리 목록 불러오기 ──────────────────────────────
  const fetchMyClubs = useCallback(async () => {
    if (!user) return;
    setClubsLoading(true);
    try {
      const q = query(
        collection(db, "clubs"),
        where("memberUids", "array-contains", user.uid)
      );
      const snap = await getDocs(q);
      setMyClubs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("동아리 로드 실패:", e);
    } finally {
      setClubsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (tab === "club" && mode === "home") fetchMyClubs();
  }, [tab, mode, fetchMyClubs]);

  // ─────────────────────────────────────────────────────────
  //  1회성 그룹
  // ─────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!user) return;
    setLoading(true); setError("");
    try {
      const code = generateCode();
      const name = user.displayName || user.email?.split("@")[0] || "방장";
      await setDoc(doc(db, "groups", code), {
        code, hostUid: user.uid, hostName: name,
        members: [{ uid: user.uid, name, photoURL: user.photoURL || "" }],
        status: "waiting",
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      });
      setGroupCode(code);
      setMode("waiting");
    } catch (e) { setError("그룹 생성 실패: " + e.message); }
    finally { setLoading(false); }
  };

  const handleJoin = async () => {
    if (!user || !joinCode.trim()) return;
    setLoading(true); setError("");
    try {
      const code = joinCode.trim().toUpperCase();
      const snap = await getDoc(doc(db, "groups", code));
      if (!snap.exists()) { setError("존재하지 않는 그룹 코드예요."); return; }
      const data = snap.data();
      if (data.status !== "waiting") { setError("이미 플로깅이 시작된 그룹이에요."); return; }
      if (data.members.length >= 10) { setError("그룹 최대 인원(10명)을 초과했어요."); return; }
      const name = user.displayName || user.email?.split("@")[0] || "멤버";
      await updateDoc(doc(db, "groups", code), {
        members: arrayUnion({ uid: user.uid, name, photoURL: user.photoURL || "" }),
      });
      setGroupCode(code); setMode("waiting");
    } catch (e) { setError("참여 실패: " + e.message); }
    finally { setLoading(false); }
  };

  const handleStart = async () => {
    if (!groupData || groupData.hostUid !== user?.uid) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, "groups", groupCode), { status: "plogging" });
      router.push(`/map?groupId=${groupCode}&groupSize=${groupData.members.length}`);
    } catch (e) { setError("시작 실패: " + e.message); }
    finally { setLoading(false); }
  };

  const handleLeave = () => {
    setGroupCode(""); setGroupData(null);
    setMode("home"); setJoinCode(""); setError("");
  };

  // ─────────────────────────────────────────────────────────
  //  동아리
  // ─────────────────────────────────────────────────────────

  const handleCreateClub = async () => {
    if (!user || !clubForm.name.trim()) return;
    setLoading(true); setError("");
    try {
      const code = generateCode();
      const name = user.displayName || user.email?.split("@")[0] || "동아리장";
      const data = {
        code,
        name: clubForm.name.trim(),
        emoji: clubForm.emoji,
        description: clubForm.description.trim(),
        hostUid: user.uid,
        hostName: name,
        members: [{ uid: user.uid, name, photoURL: user.photoURL || "" }],
        memberUids: [user.uid],
        maxMembers: clubForm.maxMembers,
        schedule: clubForm.hasSchedule
          ? { day: clubForm.scheduleDay, time: clubForm.scheduleTime }
          : null,
        status: "active",
        totalPloggings: 0,
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, "clubs", code), data);
      const created = { id: code, ...data };
      setMyClubs((prev) => [...prev, created]);
      setSelectedClub(created);
      setClubForm({ name: "", emoji: "🌿", description: "", scheduleDay: "토요일", scheduleTime: "09:00", hasSchedule: false, maxMembers: 20 });
      setMode("clubDetail");
    } catch (e) { setError("동아리 생성 실패: " + e.message); }
    finally { setLoading(false); }
  };

  const handleJoinClub = async () => {
    if (!user || !clubJoinCode.trim()) return;
    setLoading(true); setError("");
    try {
      const code = clubJoinCode.trim().toUpperCase();
      const snap = await getDoc(doc(db, "clubs", code));
      if (!snap.exists()) { setError("존재하지 않는 동아리 코드예요."); return; }
      const data = snap.data();
      if (data.memberUids?.includes(user.uid)) { setError("이미 가입된 동아리예요."); return; }
      if ((data.members?.length || 0) >= data.maxMembers) {
        setError(`최대 인원(${data.maxMembers}명)을 초과했어요.`); return;
      }
      const name = user.displayName || user.email?.split("@")[0] || "멤버";
      await updateDoc(doc(db, "clubs", code), {
        members: arrayUnion({ uid: user.uid, name, photoURL: user.photoURL || "" }),
        memberUids: arrayUnion(user.uid),
      });
      setSelectedClub({ id: code, ...data });
      setClubJoinCode("");
      setMode("clubDetail");
    } catch (e) { setError("참여 실패: " + e.message); }
    finally { setLoading(false); }
  };

  const handleStartClubPlogging = async () => {
    if (!selectedClub || selectedClub.hostUid !== user?.uid) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, "clubs", selectedClub.code), { status: "plogging" });
      router.push(`/map?groupId=${selectedClub.code}&groupSize=${selectedClub.members?.length || 1}`);
    } catch (e) { setError("시작 실패: " + e.message); }
    finally { setLoading(false); }
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
        members: arrayRemove(me),
        memberUids: arrayRemove(user.uid),
      });
      setMyClubs((prev) => prev.filter((c) => c.code !== selectedClub.code));
      setSelectedClub(null);
      setMode("home");
      setTab("club");
    } catch (e) { alert("탈퇴 실패: " + e.message); }
  };

  const handleCopyCode = async (code, type = "group") => {
    const text = type === "club"
      ? `🏅 플로깅 동아리 초대!\n\n동아리 코드: ${code}\n앱에서 '플로깅 동아리 → 코드로 참여' 에 입력하세요.`
      : `🌿 오백원의 행복 그룹 플로깅 초대!\n\n그룹 코드: ${code}\n앱에서 '그룹 플로깅 → 코드로 참여' 에 입력하세요.\n\n${window.location.origin}/group`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { alert("코드: " + code); }
  };

  // ─────────────────────────────────────────────────────────
  if (!user) return (
    <div className="flex flex-col items-center justify-center h-screen gap-4 text-center px-6">
      <div className="text-5xl">🔑</div>
      <p className="font-bold text-gray-700">로그인이 필요해요</p>
    </div>
  );

  return (
    <div
      className="min-h-screen bg-gray-50"
      style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom, 20px))" }}
    >
      {/* ── 헤더 ── */}
      <div className="bg-gray-50 px-4 pt-4 pb-1 flex justify-between items-center">
        <img
          src="https://gyea.kr/wp/wp-content/uploads/2025/12/500_subtitle_c.png"
          alt="오백원의 행복" className="h-9 w-auto object-contain"
        />
        <p className="text-sm font-black text-gray-700">👥 그룹 플로깅</p>
      </div>

      {/* ── 탭 (홈 화면에서만 표시) ── */}
      {mode === "home" && (
        <div className="px-4 mt-4">
          <div className="flex bg-white rounded-2xl p-1 shadow-sm gap-1">
            <button
              onClick={() => { setTab("oneTime"); setError(""); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all
                ${tab === "oneTime" ? "bg-purple-500 text-white shadow" : "text-gray-400"}`}
            >
              ⚡ 1회성 그룹
            </button>
            <button
              onClick={() => { setTab("club"); setError(""); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all
                ${tab === "club" ? "bg-indigo-500 text-white shadow" : "text-gray-400"}`}
            >
              🏅 플로깅 동아리
            </button>
          </div>
        </div>
      )}

      <div className="px-4 mt-4 space-y-4">

        {/* ══════════════════════════════════════
            ⚡ 1회성 그룹 홈
        ══════════════════════════════════════ */}
        {mode === "home" && tab === "oneTime" && (
          <>
            <div className="bg-purple-50 rounded-2xl p-4 border border-purple-100">
              <h2 className="font-bold text-purple-700 mb-2">🎁 그룹 보너스 포인트</h2>
              {[
                { size: "2명", bonus: "+10P" }, { size: "3명", bonus: "+15P" },
                { size: "5명", bonus: "+25P" }, { size: "10명", bonus: "+50P" },
              ].map((item) => (
                <div key={item.size} className="flex justify-between text-sm py-1 border-b border-purple-100 last:border-0">
                  <span className="text-gray-600">그룹 {item.size}</span>
                  <span className="font-bold text-purple-600">{item.bonus} (인원 × 5P)</span>
                </div>
              ))}
            </div>

            <button
              onClick={handleCreate} disabled={loading}
              className="w-full bg-purple-500 text-white py-5 rounded-2xl shadow-md font-bold text-lg active:scale-95 transition-transform"
            >
              {loading ? "생성 중..." : "🚀 그룹 방 만들기"}
            </button>

            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h2 className="font-bold text-gray-700 mb-3">🔑 코드로 참여하기</h2>
              <div className="flex gap-2">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="6자리 코드 입력" maxLength={6}
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-center text-lg font-mono font-bold tracking-widest focus:outline-none focus:border-purple-400"
                />
                <button
                  onClick={handleJoin} disabled={loading || joinCode.length < 6}
                  className="bg-purple-500 text-white px-5 rounded-xl font-bold disabled:opacity-40"
                >참여</button>
              </div>
              {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            </div>
          </>
        )}

        {/* ══════════════════════════════════════
            🏅 동아리 홈
        ══════════════════════════════════════ */}
        {mode === "home" && tab === "club" && (
          <>
            {/* 내 동아리 목록 */}
            {clubsLoading ? (
              <div className="text-center py-8 text-gray-400 text-sm animate-pulse">동아리 불러오는 중...</div>
            ) : myClubs.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">내 동아리</p>
                {myClubs.map((club) => (
                  <button
                    key={club.id}
                    onClick={() => { setSelectedClub(club); setMode("clubDetail"); }}
                    className="w-full bg-white rounded-2xl p-4 shadow-sm text-left active:bg-indigo-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-3xl w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                        {club.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-gray-800 truncate">{club.name}</p>
                          {club.hostUid === user.uid && (
                            <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded flex-shrink-0">동아리장</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          👥 {club.members?.length || 0}명
                          {club.schedule ? ` · 📅 ${club.schedule.day} ${club.schedule.time}` : ""}
                        </p>
                        {club.description ? (
                          <p className="text-xs text-gray-400 truncate mt-0.5">{club.description}</p>
                        ) : null}
                      </div>
                      <span className="text-gray-300 text-xl flex-shrink-0">›</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="bg-indigo-50 rounded-2xl p-5 text-center border border-indigo-100">
                <div className="text-4xl mb-2">🏅</div>
                <p className="text-indigo-700 font-bold text-sm">아직 가입된 동아리가 없어요</p>
                <p className="text-indigo-400 text-xs mt-1">동아리를 만들거나 초대 코드로 참여해보세요</p>
              </div>
            )}

            <button
              onClick={() => { setMode("createClub"); setError(""); }}
              className="w-full bg-indigo-500 text-white py-4 rounded-2xl shadow-md font-bold text-base active:scale-95 transition-transform"
            >
              🏅 새 동아리 만들기
            </button>

            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h2 className="font-bold text-gray-700 mb-3">🔑 코드로 동아리 참여</h2>
              <div className="flex gap-2">
                <input
                  value={clubJoinCode}
                  onChange={(e) => setClubJoinCode(e.target.value.toUpperCase())}
                  placeholder="6자리 코드 입력" maxLength={6}
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-center text-lg font-mono font-bold tracking-widest focus:outline-none focus:border-indigo-400"
                />
                <button
                  onClick={handleJoinClub} disabled={loading || clubJoinCode.length < 6}
                  className="bg-indigo-500 text-white px-5 rounded-xl font-bold disabled:opacity-40"
                >참여</button>
              </div>
              {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            </div>
          </>
        )}

        {/* ══════════════════════════════════════
            🏅 동아리 생성 폼
        ══════════════════════════════════════ */}
        {mode === "createClub" && (
          <>
            <div className="flex items-center gap-3 mb-1">
              <button onClick={() => { setMode("home"); setError(""); }} className="text-gray-400 text-2xl leading-none">←</button>
              <h2 className="font-black text-gray-800 text-lg">새 동아리 만들기</h2>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-5">

              {/* 이모지 선택 */}
              <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block">동아리 아이콘 선택</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_LIST.map((e) => (
                    <button
                      key={e}
                      onClick={() => setClubForm((p) => ({ ...p, emoji: e }))}
                      className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all
                        ${clubForm.emoji === e
                          ? "bg-indigo-100 border-2 border-indigo-400 scale-110"
                          : "bg-gray-50 border border-gray-200"}`}
                    >{e}</button>
                  ))}
                </div>
              </div>

              {/* 동아리 이름 */}
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">
                  동아리 이름 <span className="text-red-400">*</span>
                </label>
                <input
                  value={clubForm.name}
                  onChange={(e) => setClubForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="예: 초록발자국 러닝 클럽" maxLength={20}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400"
                />
              </div>

              {/* 소개글 */}
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">동아리 소개</label>
                <textarea
                  value={clubForm.description}
                  onChange={(e) => setClubForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="동아리를 소개해주세요 (선택)" maxLength={100} rows={2}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400 resize-none"
                />
              </div>

              {/* 최대 인원 */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-700">최대 인원</p>
                  <p className="text-xs text-gray-400">동아리 최대 참여 인원</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setClubForm((p) => ({ ...p, maxMembers: Math.max(2, p.maxMembers - 5) }))}
                    className="w-9 h-9 rounded-full bg-gray-100 font-bold text-gray-600 text-lg flex items-center justify-center"
                  >−</button>
                  <span className="font-black text-gray-800 text-lg w-10 text-center">{clubForm.maxMembers}</span>
                  <button
                    onClick={() => setClubForm((p) => ({ ...p, maxMembers: Math.min(200, p.maxMembers + 5) }))}
                    className="w-9 h-9 rounded-full bg-gray-100 font-bold text-gray-600 text-lg flex items-center justify-center"
                  >+</button>
                </div>
              </div>

              {/* 정기 모임 설정 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-gray-700">📅 정기 모임 설정</p>
                    <p className="text-xs text-gray-400">동아리 정기 모임 일정을 등록해요</p>
                  </div>
                  <button
                    onClick={() => setClubForm((p) => ({ ...p, hasSchedule: !p.hasSchedule }))}
                    className={`relative w-13 h-7 rounded-full transition-colors duration-200 focus:outline-none flex-shrink-0 ml-4
                      ${clubForm.hasSchedule ? "bg-indigo-500" : "bg-gray-300"}`}
                    style={{ width: "3.25rem" }}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200
                      ${clubForm.hasSchedule ? "translate-x-6" : "translate-x-0"}`}
                    />
                  </button>
                </div>

                {clubForm.hasSchedule && (
                  <div className="bg-indigo-50 rounded-xl p-4 space-y-3">
                    <div>
                      <label className="text-xs text-indigo-600 font-bold mb-2 block">요일 선택</label>
                      <div className="flex flex-wrap gap-1.5">
                        {DAYS.map((day) => (
                          <button
                            key={day}
                            onClick={() => setClubForm((p) => ({ ...p, scheduleDay: day }))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                              ${clubForm.scheduleDay === day
                                ? "bg-indigo-500 text-white shadow-sm"
                                : "bg-white text-gray-500 border border-gray-200"}`}
                          >
                            {day.replace("요일", "")}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-indigo-600 font-bold mb-1 block">시간</label>
                      <input
                        type="time" value={clubForm.scheduleTime}
                        onChange={(e) => setClubForm((p) => ({ ...p, scheduleTime: e.target.value }))}
                        className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <button
              onClick={handleCreateClub} disabled={loading || !clubForm.name.trim()}
              className="w-full bg-indigo-500 text-white py-4 rounded-2xl font-bold text-base shadow-md disabled:opacity-40 active:scale-95 transition-transform"
            >
              {loading ? "생성 중..." : `${clubForm.emoji} 동아리 만들기`}
            </button>
          </>
        )}

        {/* ══════════════════════════════════════
            🏅 동아리 상세
        ══════════════════════════════════════ */}
        {mode === "clubDetail" && selectedClub && (
          <>
            <div className="flex items-center gap-3 mb-1">
              <button
                onClick={() => { setMode("home"); setTab("club"); setError(""); }}
                className="text-gray-400 text-2xl leading-none"
              >←</button>
              <h2 className="font-black text-gray-800 text-lg truncate flex-1">
                {selectedClub.emoji} {selectedClub.name}
              </h2>
            </div>

            {/* 동아리 코드 카드 */}
            <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
              <p className="text-xs text-gray-400 mb-1">동아리 초대 코드</p>
              <p className="text-3xl font-mono font-black text-indigo-600 tracking-widest mb-2">
                {selectedClub.code}
              </p>
              {selectedClub.description && (
                <p className="text-sm text-gray-500 mb-3 leading-relaxed">{selectedClub.description}</p>
              )}
              {selectedClub.schedule && (
                <div className="inline-flex items-center gap-1.5 bg-indigo-50 rounded-full px-3 py-1.5 mb-3">
                  <span className="text-xs text-indigo-600 font-bold">
                    📅 정기 모임: {selectedClub.schedule.day} {selectedClub.schedule.time}
                  </span>
                </div>
              )}
              <button
                onClick={() => handleCopyCode(selectedClub.code, "club")}
                className={`w-full py-3 rounded-xl font-medium text-sm transition-colors
                  ${copied
                    ? "bg-green-100 text-green-600"
                    : "bg-indigo-50 text-indigo-600 border border-indigo-200"}`}
              >
                {copied ? "✅ 복사됨!" : "📋 초대 코드 복사하기"}
              </button>
            </div>

            {/* 멤버 목록 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h2 className="font-bold text-gray-700">
                  멤버 ({selectedClub.members?.length || 0}/{selectedClub.maxMembers})
                </h2>
                <span className="text-xs text-gray-400 animate-pulse">● 실시간</span>
              </div>
              <div className="space-y-2">
                {(selectedClub.members || []).map((member) => (
                  <div key={member.uid} className="flex items-center gap-3 py-1">
                    <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {member.photoURL
                        ? <img src={member.photoURL} alt="" className="w-full h-full object-cover" />
                        : <span className="text-lg">😊</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 flex items-center gap-1 flex-wrap">
                        <span className="truncate">{member.name}</span>
                        {member.uid === selectedClub.hostUid && (
                          <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded flex-shrink-0">동아리장</span>
                        )}
                        {member.uid === user?.uid && (
                          <span className="text-xs text-gray-400 flex-shrink-0">(나)</span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 그룹 보너스 미리보기 */}
            <div className="bg-indigo-50 rounded-2xl p-3 text-center">
              <p className="text-sm text-indigo-700">
                오늘 플로깅 시 <span className="font-bold">{selectedClub.members?.length || 0}명</span> 참여 —
                그룹 보너스 <span className="font-bold text-indigo-600">+{(selectedClub.members?.length || 0) * 5}P</span> 예정
              </p>
            </div>

            {/* 플로깅 시작 버튼 */}
            {selectedClub.hostUid === user?.uid ? (
              <button
                onClick={handleStartClubPlogging}
                disabled={loading}
                className="w-full bg-green-500 text-white py-5 rounded-2xl font-bold text-lg shadow-md disabled:opacity-40 active:scale-95 transition-transform"
              >
                {loading ? "시작 중..." : `🚀 오늘의 플로깅 시작 (${selectedClub.members?.length || 0}명)`}
              </button>
            ) : (
              <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
                <div className="text-3xl mb-1 animate-bounce">⏳</div>
                <p className="text-gray-600 font-medium text-sm">동아리장이 플로깅을 시작하면 자동으로 이동해요</p>
              </div>
            )}

            {/* 탈퇴 (동아리장 제외) */}
            {selectedClub.hostUid !== user?.uid && (
              <button
                onClick={handleLeaveClub}
                className="w-full bg-white text-red-400 py-3 rounded-2xl text-sm font-medium shadow-sm border border-red-100 active:bg-red-50"
              >
                동아리 탈퇴하기
              </button>
            )}
          </>
        )}

        {/* ══════════════════════════════════════
            ⚡ 1회성 대기실
        ══════════════════════════════════════ */}
        {mode === "waiting" && groupData && (
          <>
            <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
              <p className="text-sm text-gray-400 mb-1">그룹 코드</p>
              <span className="text-4xl font-mono font-black text-purple-600 tracking-widest block mb-3">
                {groupCode}
              </span>
              <button
                onClick={() => handleCopyCode(groupCode)}
                className={`w-full py-3 rounded-xl font-medium text-sm transition-colors
                  ${copied
                    ? "bg-green-100 text-green-600"
                    : "bg-purple-50 text-purple-600 border border-purple-200"}`}
              >
                {copied ? "✅ 복사됨!" : "📋 코드 및 링크 복사하기"}
              </button>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h2 className="font-bold text-gray-700">
                  참여 멤버 ({groupData.members?.length || 0}/10)
                </h2>
                <span className="text-xs text-gray-400 animate-pulse">● 실시간</span>
              </div>
              <div className="space-y-2">
                {(groupData.members || []).map((member) => (
                  <div key={member.uid} className="flex items-center gap-3 py-1">
                    <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {member.photoURL
                        ? <img src={member.photoURL} alt="" className="w-full h-full object-cover" />
                        : <span className="text-lg">😊</span>}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-700 flex items-center gap-1 flex-wrap">
                        <span>{member.name}</span>
                        {member.uid === groupData.hostUid && (
                          <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">방장</span>
                        )}
                        {member.uid === user?.uid && (
                          <span className="text-xs text-gray-400">(나)</span>
                        )}
                      </p>
                    </div>
                    <span className="text-green-500 text-sm flex-shrink-0">준비 ✓</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-purple-50 rounded-2xl p-3 text-center">
              <p className="text-sm text-purple-700">
                현재 <span className="font-bold">{groupData.members?.length || 0}명</span> 참여 중 —
                그룹 보너스 <span className="font-bold text-purple-600">+{(groupData.members?.length || 0) * 5}P</span> 예정
              </p>
            </div>

            {groupData.hostUid === user?.uid ? (
              <button
                onClick={handleStart}
                disabled={loading || (groupData.members?.length || 0) < 2}
                className="w-full bg-green-500 text-white py-5 rounded-2xl font-bold text-lg shadow-md disabled:opacity-40 active:scale-95 transition-transform"
              >
                {loading ? "시작 중..." :
                  (groupData.members?.length || 0) < 2
                    ? "멤버를 기다리는 중... (최소 2명)"
                    : `🚀 플로깅 시작 (${groupData.members?.length}명)`}
              </button>
            ) : (
              <div className="bg-white rounded-2xl p-5 text-center shadow-sm">
                <div className="text-3xl mb-2 animate-bounce">⏳</div>
                <p className="text-gray-600 font-medium">방장이 시작하길 기다리는 중...</p>
                <p className="text-sm text-gray-400 mt-1">시작되면 자동으로 이동해요</p>
              </div>
            )}

            <button
              onClick={handleLeave}
              className="w-full bg-white text-gray-400 py-3 rounded-2xl text-sm font-medium shadow-sm"
            >
              그룹 나가기
            </button>
          </>
        )}

      </div>
    </div>
  );
}
