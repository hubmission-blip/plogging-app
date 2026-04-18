"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  doc, setDoc, getDoc, updateDoc,
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

  // ── 1회성: 실시간 리슨 ────────────────────────────────────
  useEffect(() => {
    if (!groupCode) return;
    const unsub = onSnapshot(doc(db, "groups", groupCode), (snap) => {
      if (snap.exists()) setGroupData({ id: snap.id, ...snap.data() });
    });
    return () => unsub();
  }, [groupCode]);

  useEffect(() => {
    if (groupData?.status === "plogging" && mode === "waiting") {
      router.push(`/map?groupId=${groupCode}&groupSize=${groupData.members.length}`);
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
      <div className="text-5xl">🔑</div>
      <p className="font-bold text-gray-700">로그인이 필요해요</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50"
      style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom, 20px))" }}>

      {/* ── 헤더 ── */}
      <div className="bg-gray-50 px-4 pt-4 pb-1 flex justify-between items-center">
        <Link href="/">
          <img src="https://gyea.kr/wp/wp-content/uploads/2025/12/500_subtitle_c.png"
            alt="오백원의 행복" className="h-9 w-auto object-contain" />
        </Link>
        <p className="text-sm font-black text-gray-700">👥 그룹 플로깅</p>
      </div>

      <div className="px-4 mt-4 space-y-4">

        {/* ═══════════ ⚡ 1회성 그룹 홈 ═══════════ */}
        {mode === "home" && (
          <>
            <div className="bg-sky-50 rounded-2xl p-4 border border-sky-100">
              <h2 className="font-bold text-sky-700 mb-2">🎁 그룹 보너스 포인트</h2>
              {[{ s:"2명", b:"+10P" },{ s:"3명", b:"+15P" },{ s:"5명", b:"+25P" },{ s:"10명", b:"+50P" }].map(({s,b}) => (
                <div key={s} className="flex justify-between text-sm py-1 border-b border-sky-100 last:border-0">
                  <span className="text-gray-600">그룹 {s}</span>
                  <span className="font-bold text-sky-600">{b} (인원 × 5P)</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={loading}
                className="flex-1 bg-sky-500 text-white py-3.5 rounded-2xl shadow-md font-bold text-sm active:scale-95 transition-transform">
                {loading ? "생성 중..." : "🚀 그룹 방 만들기"}
              </button>
              <button onClick={() => setShowCodeInput((p) => !p)}
                className="flex-shrink-0 bg-white border-2 border-sky-400 text-sky-600 px-4 py-3.5 rounded-2xl font-bold text-sm active:scale-95 transition-transform">
                🔑 코드 참여
              </button>
            </div>
            {showCodeInput && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex gap-2">
                  <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="6자리 초대 코드" maxLength={6}
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-center text-lg font-mono font-bold tracking-widest focus:outline-none focus:border-sky-400" />
                  <button onClick={handleJoin} disabled={loading || joinCode.length < 6}
                    className="bg-sky-500 text-white px-5 rounded-xl font-bold disabled:opacity-40 active:scale-95 transition-transform">참여</button>
                </div>
                {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
              </div>
            )}

            {/* 바로가기 링크 */}
            <div className="grid grid-cols-2 gap-2">
              <Link href="/club" className="block bg-cyan-50 rounded-2xl p-4 text-center border-2 border-cyan-400 active:bg-cyan-100 transition-colors">
                <p className="text-cyan-700 font-bold text-sm">🏅 플로깅 동아리</p>
                <p className="text-cyan-400 text-xs mt-0.5">함께 뛰어보세요 →</p>
              </Link>
              <Link href="/shop" className="block bg-orange-50 rounded-2xl p-4 text-center border-2 border-orange-400 active:bg-orange-100 transition-colors">
                <p className="text-orange-700 font-bold text-sm">🛒 친환경 쇼핑</p>
                <p className="text-orange-400 text-xs mt-0.5">친환경 제품 보기 →</p>
              </Link>
            </div>
          </>
        )}

        {/* ═══════════ ⚡ 1회성 대기실 ═══════════ */}
        {mode === "waiting" && groupData && (
          <>
            <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
              <p className="text-sm text-gray-400 mb-1">그룹 코드</p>
              <span className="text-4xl font-mono font-black text-sky-600 tracking-widest block mb-3">{groupCode}</span>
              <button onClick={() => handleCopyCode(groupCode)}
                className={`w-full py-3 rounded-xl font-medium text-sm transition-colors
                  ${copied ? "bg-green-100 text-green-600" : "bg-sky-50 text-sky-600 border border-sky-200"}`}>
                {copied ? "✅ 복사됨!" : "📋 코드 및 링크 복사하기"}
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
                        : <span className="text-lg">😊</span>}
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
                    : `🚀 플로깅 시작 (${groupData.members?.length}명)`}
              </button>
            ) : (
              <div className="bg-white rounded-2xl p-5 text-center shadow-sm">
                <div className="text-3xl mb-2 animate-bounce">⏳</div>
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
