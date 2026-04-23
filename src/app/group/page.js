"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Rocket, KeyRound, Lock, Users, User, School, Clover, Gift, ClipboardCopy, Check, Hourglass, Loader } from "lucide-react";
import { db } from "@/lib/firebase";
import {
  doc, setDoc, getDoc, updateDoc, deleteDoc,
  serverTimestamp, arrayUnion,
  onSnapshot,
} from "firebase/firestore";

// ─── 상수 ──────────────────────────────────────────────────
function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ─── 메인 ──────────────────────────────────────────────────
export default function GroupPage() {
  const { user } = useAuth();
  const router   = useRouter();

  const [mode, setMode] = useState("home"); // home | waiting

  // 1회성
  const [groupCode, setGroupCode] = useState("");
  const [joinCode,  setJoinCode]  = useState("");
  const [groupData, setGroupData] = useState(null);

  // 공통
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [copied,  setCopied]  = useState(false);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [restoring, setRestoring] = useState(true); // 초기 복원 중 여부

  // ── 페이지 진입 시 활성 그룹 자동 복원 ─────────────────────
  useEffect(() => {
    if (!user) { setRestoring(false); return; }
    try {
      const saved = localStorage.getItem("activeGroupCode");
      if (!saved) { setRestoring(false); return; }
      // Firestore에서 그룹 유효성 확인
      getDoc(doc(db, "groups", saved)).then((snap) => {
        if (!snap.exists()) {
          localStorage.removeItem("activeGroupCode");
          setRestoring(false);
          return;
        }
        const data = snap.data();
        // 만료 또는 종료된 그룹 → 정리
        if (data.status === "finished") {
          localStorage.removeItem("activeGroupCode");
          setRestoring(false);
          return;
        }
        // 내가 멤버인지 확인
        const isMember = (data.members || []).some((m) => m.uid === user.uid);
        if (!isMember) {
          localStorage.removeItem("activeGroupCode");
          setRestoring(false);
          return;
        }
        // 30분 이상 plogging 상태 → 만료 처리
        if (data.status === "plogging") {
          const ts = data.updatedAt?.toDate?.() || data.createdAt?.toDate?.() || null;
          const stuckMin = ts ? (Date.now() - ts.getTime()) / 60000 : 999;
          if (stuckMin > 30) {
            updateDoc(doc(db, "groups", saved), { status: "finished" }).catch(() => {});
            localStorage.removeItem("activeGroupCode");
            setRestoring(false);
            return;
          }
        }
        // 유효한 그룹 → 복원
        setGroupCode(saved);
        setMode("waiting");
        setRestoring(false);
      }).catch(() => {
        localStorage.removeItem("activeGroupCode");
        setRestoring(false);
      });
    } catch {
      setRestoring(false);
    }
  }, [user]);

  // ── 1회성: 실시간 리슨 ────────────────────────────────────
  useEffect(() => {
    if (!groupCode) return;
    const unsub = onSnapshot(doc(db, "groups", groupCode), (snap) => {
      if (snap.exists()) {
        setGroupData({ id: snap.id, ...snap.data() });
      } else {
        // 그룹 문서가 삭제됨 → 홈으로 이동
        setError("그룹이 삭제되었어요.");
        setMode("home"); setGroupCode(""); setGroupData(null);
        try { localStorage.removeItem("activeGroupCode"); } catch {}
      }
    });
    return () => unsub();
  }, [groupCode]);

  useEffect(() => {
    if (groupData?.status === "plogging" && mode === "waiting") {
      // 30분 이상 plogging 상태면 방치된 것 → 만료 처리
      const ts = groupData.updatedAt?.toDate?.() || groupData.createdAt?.toDate?.() || null;
      const stuckMinutes = ts ? (Date.now() - ts.getTime()) / 60000 : 999;
      if (stuckMinutes > 30) {
        updateDoc(doc(db, "groups", groupCode), { status: "finished" }).catch(() => {});
        setError("이 그룹은 시간이 만료되었어요.");
        try { localStorage.removeItem("activeGroupCode"); } catch {}
        setMode("home"); setGroupCode(""); setGroupData(null);
        return;
      }
      router.push(`/map?groupId=${groupCode}&groupSize=${groupData.members.length}`);
    }
    if (groupData?.status === "finished" && mode === "waiting") {
      setError("이 그룹은 종료되었어요.");
      try { localStorage.removeItem("activeGroupCode"); } catch {}
      setMode("home"); setGroupCode(""); setGroupData(null);
    }
  }, [groupData, mode, groupCode, router]);

  // ─────────────────────────────────────────────────────────
  //  1회성 그룹 핸들러
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
      setGroupCode(code); setMode("waiting");
      try { localStorage.setItem("activeGroupCode", code); } catch {}
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

      // ── 방치된 그룹 처리 (30분 이상 plogging 상태) ──
      if (data.status === "plogging") {
        const created = data.createdAt?.toDate?.() || null;
        const stuckMinutes = created ? (Date.now() - created.getTime()) / 60000 : 999;
        if (stuckMinutes > 30) {
          // 오래된 그룹 → 만료 처리 후 안내
          try { await updateDoc(doc(db, "groups", code), { status: "finished" }); } catch {}
          setError("이 그룹은 시간이 만료되었어요. 새 그룹을 만들어주세요."); return;
        }
        setError("현재 플로깅이 진행 중인 그룹이에요."); return;
      }
      if (data.status === "finished") { setError("이미 종료된 그룹이에요. 새 그룹을 만들어주세요."); return; }
      if (data.status !== "waiting") { setError("이미 플로깅이 시작된 그룹이에요."); return; }

      if (data.members.length >= 10) { setError("그룹 최대 인원(10명)을 초과했어요."); return; }
      if (data.members.some((m) => m.uid === user.uid)) {
        setError("이미 참여 중인 그룹이에요."); setGroupCode(code); setMode("waiting");
        try { localStorage.setItem("activeGroupCode", code); } catch {}
        return;
      }
      const name = user.displayName || user.email?.split("@")[0] || "멤버";
      await updateDoc(doc(db, "groups", code), {
        members: arrayUnion({ uid: user.uid, name, photoURL: user.photoURL || "" }),
      });
      setGroupCode(code); setMode("waiting");
      try { localStorage.setItem("activeGroupCode", code); } catch {}
    } catch (e) { setError("참여 실패: " + e.message); }
    finally { setLoading(false); }
  };

  const handleStart = async () => {
    if (!groupData || groupData.hostUid !== user?.uid) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, "groups", groupCode), { status: "plogging", updatedAt: serverTimestamp() });
      router.push(`/map?groupId=${groupCode}&groupSize=${groupData.members.length}`);
    } catch (e) { setError("시작 실패: " + e.message); }
    finally { setLoading(false); }
  };

  const handleLeave = async () => {
    if (!groupCode || !user) {
      setGroupCode(""); setGroupData(null); setMode("home"); setJoinCode(""); setError("");
      return;
    }
    try {
      const isHost = groupData?.hostUid === user.uid;
      if (isHost) {
        // 방장이 나가면 그룹 전체 종료
        await updateDoc(doc(db, "groups", groupCode), { status: "finished" }).catch(() => {});
      } else {
        // 멤버가 나가면 members 배열에서 제거
        const snap = await getDoc(doc(db, "groups", groupCode));
        if (snap.exists()) {
          const data = snap.data();
          const newMembers = (data.members || []).filter((m) => m.uid !== user.uid);
          await updateDoc(doc(db, "groups", groupCode), { members: newMembers });
        }
      }
    } catch (e) { console.error("그룹 나가기 실패:", e); }
    try { localStorage.removeItem("activeGroupCode"); } catch {}
    setGroupCode(""); setGroupData(null); setMode("home"); setJoinCode(""); setError("");
  };

  const handleCopyCode = async (code) => {
    const text = `🌿 오백원의 행복 그룹 플로깅 초대!\n\n그룹 코드: ${code}\n${window.location.origin}/group`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch { alert("코드: " + code); }
  };

  // ─────────────────────────────────────────────────────────
  if (!user) return (
    <div className="flex flex-col items-center justify-center h-screen gap-4 text-center px-6">
      <div className="flex items-center justify-center"><Lock size={48} className="text-gray-300" strokeWidth={1.5} /></div>
      <p className="font-bold text-gray-700">로그인이 필요해요</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50"
      style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom, 20px))" }}>

      {/* ── 헤더 ── */}
      <div className="bg-gray-50 px-4 pt-4 pb-1 flex justify-between items-center">
        <Link href="/">
          <img src="https://res.cloudinary.com/dqlvm572h/image/upload/w_200,q_auto,f_auto/Intro_Logo_fuj1kt.png"
            alt="오백원의 행복" className="h-9 w-auto object-contain" />
        </Link>
        <p className="text-sm font-black text-gray-700 flex items-center gap-1"><Users size={15} className="text-sky-500" strokeWidth={2} /> 그룹 플로깅</p>
      </div>

      <div className="px-4 mt-4 space-y-4">

        {/* ═══════════ 복원 중 로딩 ═══════════ */}
        {restoring && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="animate-bounce"><Users size={40} className="text-sky-400" strokeWidth={1.5} /></div>
            <p className="text-sm text-gray-400">내 그룹 확인 중...</p>
          </div>
        )}

        {/* ═══════════ ⚡ 1회성 그룹 홈 ═══════════ */}
        {!restoring && mode === "home" && (
          <>
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={loading}
                className="flex-1 bg-sky-500 text-white py-3.5 rounded-2xl shadow-md font-bold text-sm active:scale-95 transition-transform flex items-center justify-center gap-1.5">
                {loading ? "생성 중..." : <><Rocket size={16} strokeWidth={2} /> 그룹 방 만들기</>}
              </button>
              <button onClick={() => setShowCodeInput((p) => !p)}
                className="flex-shrink-0 bg-white border-2 border-sky-400 text-sky-600 px-4 py-3.5 rounded-2xl font-bold text-sm active:scale-95 transition-transform flex items-center gap-1.5">
                <KeyRound size={15} strokeWidth={2} /> 코드 참여
              </button>
            </div>
            {showCodeInput && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex gap-2">
                  <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="6자리 초대 코드" maxLength={6}
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-center text-lg font-mono font-bold tracking-widest focus:outline-none focus:border-sky-400" />
                  <button onClick={handleJoin} disabled={loading || joinCode.length < 6}
                    className="bg-sky-500 text-white px-5 rounded-xl font-bold whitespace-nowrap disabled:opacity-40 active:scale-95 transition-transform">참여</button>
                </div>
                {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
              </div>
            )}

            <div className="bg-sky-50 rounded-2xl p-4 border border-sky-100">
              <h2 className="font-bold text-sky-700 mb-2 flex items-center gap-1"><Gift size={16} className="text-sky-500" strokeWidth={2} /> 그룹 보너스 포인트</h2>
              {[{ s:"2명", b:"+10P" },{ s:"3명", b:"+15P" },{ s:"5명", b:"+25P" },{ s:"10명", b:"+50P" }].map(({s,b}) => (
                <div key={s} className="flex justify-between text-sm py-1 border-b border-sky-100 last:border-0">
                  <span className="text-gray-600">그룹 {s}</span>
                  <span className="font-bold text-sky-600">{b} (인원 × 5P)</span>
                </div>
              ))}
            </div>

            {/* 바로가기 링크 */}
            <div className="grid grid-cols-2 gap-2">
              <Link href="/club" className="bg-cyan-50 rounded-2xl p-4 flex flex-col items-center gap-1.5 border-2 border-cyan-400 active:bg-cyan-100 transition-colors">
                <School size={22} className="text-cyan-500" strokeWidth={1.8} />
                <p className="text-cyan-700 font-bold text-sm">플로깅 동아리</p>
                <p className="text-cyan-400 text-xs">함께 뛰어보세요 →</p>
              </Link>
              <Link href="/shop" className="rounded-2xl p-4 flex flex-col items-center gap-1.5 border-2 active:opacity-80 transition-colors"
                style={{ backgroundColor: "#ef558b0c", borderColor: "#ef558b80" }}>
                <Clover size={22} className="text-pink-500" strokeWidth={1.8} />
                <p className="font-bold text-sm" style={{ color: "#ef3654" }}>친환경 쇼핑</p>
                <p className="text-xs" style={{ color: "#ef558b99" }}>친환경 제품 보기 →</p>
              </Link>
            </div>
          </>
        )}

        {/* ═══════════ ⚡ 1회성 대기실 ═══════════ */}
        {!restoring && mode === "waiting" && groupData && (
          <>
            <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
              <p className="text-sm text-gray-400 mb-1">그룹 코드</p>
              <span className="text-4xl font-mono font-black text-sky-600 tracking-widest block mb-3">{groupCode}</span>
              <button onClick={() => handleCopyCode(groupCode)}
                className={`w-full py-3 rounded-xl font-medium text-sm transition-colors
                  ${copied ? "bg-green-100 text-green-600" : "bg-sky-50 text-sky-600 border border-sky-200"}`}>
                <span className="flex items-center justify-center gap-1">
                  {copied ? <><Check size={14} strokeWidth={2} /> 복사됨!</> : <><ClipboardCopy size={14} strokeWidth={2} /> 코드 및 링크 복사하기</>}
                </span>
              </button>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h2 className="font-bold text-gray-700">참여 멤버 ({groupData.members?.length || 0}/10)</h2>
                <span className="text-xs text-gray-400 animate-pulse">● 실시간</span>
              </div>
              <div className="space-y-2">
                {(groupData.members || []).map((member) => (
                  <div key={member.uid} className="flex items-center gap-3 py-1">
                    <div className="w-9 h-9 rounded-full bg-sky-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {member.photoURL
                        ? <img src={member.photoURL} alt="" className="w-full h-full object-cover" />
                        : <User size={18} className="text-sky-300" strokeWidth={1.8} />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-700 flex items-center gap-1 flex-wrap">
                        <span>{member.name}</span>
                        {member.uid === groupData.hostUid && (
                          <span className="text-xs bg-sky-100 text-sky-600 px-1.5 py-0.5 rounded">방장</span>
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

            <div className="bg-sky-50 rounded-2xl p-3 text-center">
              <p className="text-sm text-sky-700">
                현재 <span className="font-bold">{groupData.members?.length || 0}명</span> 참여 중 —
                그룹 보너스 <span className="font-bold text-sky-600">+{(groupData.members?.length || 0) * 5}P</span> 예정
              </p>
            </div>

            {groupData.hostUid === user?.uid ? (
              <button onClick={handleStart} disabled={loading || (groupData.members?.length || 0) < 2}
                className="w-full bg-green-500 text-white py-5 rounded-2xl font-bold text-lg shadow-md disabled:opacity-40 active:scale-95 transition-transform">
                {loading ? "시작 중..." :
                  (groupData.members?.length || 0) < 2
                    ? "멤버를 기다리는 중... (최소 2명)"
                    : `플로깅 시작 (${groupData.members?.length}명)`}
              </button>
            ) : (
              <div className="bg-white rounded-2xl p-5 text-center shadow-sm">
                <div className="mb-2 animate-bounce"><Hourglass size={30} className="text-sky-400" strokeWidth={1.5} /></div>
                <p className="text-gray-600 font-medium">방장이 시작하길 기다리는 중...</p>
                <p className="text-sm text-gray-400 mt-1">시작되면 자동으로 이동해요</p>
              </div>
            )}

            <button onClick={handleLeave}
              className="w-full bg-white text-gray-400 py-3 rounded-2xl text-sm font-medium shadow-sm">
              그룹 나가기
            </button>
          </>
        )}

      </div>
    </div>
  );
}
