"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  doc, setDoc, getDoc, updateDoc,
  collection, serverTimestamp, arrayUnion, onSnapshot
} from "firebase/firestore";

// ─── 랜덤 6자리 그룹 코드 ─────────────────────────────────
function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function GroupPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState("home"); // home | create | join | waiting | ready
  const [groupCode, setGroupCode] = useState("");
  const [joinCode, setJoinCode]   = useState("");
  const [groupData, setGroupData] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [copied, setCopied]       = useState(false);

  // ── 그룹 실시간 리슨 ────────────────────────────────────
  useEffect(() => {
    if (!groupCode) return;
    const unsub = onSnapshot(doc(db, "groups", groupCode), (snap) => {
      if (snap.exists()) {
        setGroupData({ id: snap.id, ...snap.data() });
      }
    });
    return () => unsub();
  }, [groupCode]);

  // ── 그룹 생성 ────────────────────────────────────────────
  const handleCreate = async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const code = generateCode();
      const displayName = user.displayName || user.email?.split("@")[0] || "방장";
      await setDoc(doc(db, "groups", code), {
        code,
        hostUid: user.uid,
        hostName: displayName,
        members: [{ uid: user.uid, name: displayName, photoURL: user.photoURL || "" }],
        status: "waiting",   // waiting | plogging | done
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2시간 후 만료
      });
      setGroupCode(code);
      setMode("waiting");
    } catch (e) {
      setError("그룹 생성 실패: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── 그룹 참여 ────────────────────────────────────────────
  const handleJoin = async () => {
    if (!user || !joinCode.trim()) return;
    setLoading(true);
    setError("");
    try {
      const code = joinCode.trim().toUpperCase();
      const snap = await getDoc(doc(db, "groups", code));
      if (!snap.exists()) {
        setError("존재하지 않는 그룹 코드예요.");
        return;
      }
      const data = snap.data();
      if (data.status !== "waiting") {
        setError("이미 플로깅이 시작된 그룹이에요.");
        return;
      }
      if (data.members.length >= 10) {
        setError("그룹 최대 인원(10명)을 초과했어요.");
        return;
      }

      const displayName = user.displayName || user.email?.split("@")[0] || "멤버";
      await updateDoc(doc(db, "groups", code), {
        members: arrayUnion({
          uid: user.uid,
          name: displayName,
          photoURL: user.photoURL || "",
        }),
      });
      setGroupCode(code);
      setMode("waiting");
    } catch (e) {
      setError("참여 실패: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── 플로깅 시작 (방장만) ─────────────────────────────────
  const handleStart = async () => {
    if (!groupData || groupData.hostUid !== user?.uid) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, "groups", groupCode), { status: "plogging" });
      // 지도 페이지로 이동 (그룹 정보 파라미터 전달)
      router.push(`/map?groupId=${groupCode}&groupSize=${groupData.members.length}`);
    } catch (e) {
      setError("시작 실패: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── 링크/코드 복사 ───────────────────────────────────────
  const handleCopy = async () => {
    const text = `🌿 오백원의 행복 그룹 플로깅 초대!\n\n그룹 코드: ${groupCode}\n앱에서 '그룹 플로깅 → 코드로 참여' 에 입력하세요.\n\nhttps://your-app.vercel.app/group`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("코드: " + groupCode);
    }
  };

  // ── 나가기 ───────────────────────────────────────────────
  const handleLeave = () => {
    setGroupCode("");
    setGroupData(null);
    setMode("home");
    setJoinCode("");
    setError("");
  };

  // ── 상태에 따라 플로깅 시작으로 리디렉트 ────────────────
  useEffect(() => {
    if (groupData?.status === "plogging" && mode === "waiting") {
      router.push(`/map?groupId=${groupCode}&groupSize=${groupData.members.length}`);
    }
  }, [groupData, mode, groupCode, router]);

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
          alt="오백원의 행복"
          className="h-9 w-auto object-contain"
        />
        <p className="text-sm font-black text-gray-700">👥 그룹 플로깅</p>
      </div>

      <div className="px-4 mt-6 space-y-4">

        {/* ─────── HOME: 방 만들기 / 참여하기 ─────── */}
        {mode === "home" && (
          <>
            {/* 그룹 포인트 안내 */}
            <div className="bg-purple-50 rounded-2xl p-4 border border-purple-100">
              <h2 className="font-bold text-purple-700 mb-2">🎁 그룹 보너스 포인트</h2>
              {[
                { size: "2명", bonus: "+10P" },
                { size: "3명", bonus: "+15P" },
                { size: "5명", bonus: "+25P" },
                { size: "10명", bonus: "+50P" },
              ].map((item) => (
                <div key={item.size} className="flex justify-between text-sm py-1 border-b border-purple-100 last:border-0">
                  <span className="text-gray-600">그룹 {item.size}</span>
                  <span className="font-bold text-purple-600">{item.bonus} (인원 × 5P)</span>
                </div>
              ))}
            </div>

            {/* 방 만들기 */}
            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full bg-purple-500 text-white py-5 rounded-2xl shadow-md font-bold text-lg active:scale-95 transition-transform"
            >
              {loading ? "생성 중..." : "🚀 그룹 방 만들기"}
            </button>

            {/* 코드로 참여 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h2 className="font-bold text-gray-700 mb-3">🔑 코드로 참여하기</h2>
              <div className="flex gap-2">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="6자리 코드 입력"
                  maxLength={6}
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-center text-lg font-mono font-bold tracking-widest focus:outline-none focus:border-purple-400"
                />
                <button
                  onClick={handleJoin}
                  disabled={loading || joinCode.length < 6}
                  className="bg-purple-500 text-white px-5 rounded-xl font-bold disabled:opacity-40"
                >
                  참여
                </button>
              </div>
              {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            </div>
          </>
        )}

        {/* ─────── WAITING: 대기실 ─────── */}
        {mode === "waiting" && groupData && (
          <>
            {/* 그룹 코드 카드 */}
            <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
              <p className="text-sm text-gray-400 mb-1">그룹 코드</p>
              <div className="flex items-center justify-center gap-3 mb-3">
                <span className="text-4xl font-mono font-black text-purple-600 tracking-widest">
                  {groupCode}
                </span>
              </div>
              <button
                onClick={handleCopy}
                className={`w-full py-3 rounded-xl font-medium text-sm transition-colors
                  ${copied
                    ? "bg-green-100 text-green-600"
                    : "bg-purple-50 text-purple-600 border border-purple-200"
                  }`}
              >
                {copied ? "✅ 복사됨!" : "📋 코드 및 링크 복사하기"}
              </button>
            </div>

            {/* 멤버 목록 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h2 className="font-bold text-gray-700">
                  참여 멤버 ({groupData.members?.length || 0}/10)
                </h2>
                <span className="text-xs text-gray-400 animate-pulse">● 실시간</span>
              </div>
              <div className="space-y-2">
                {(groupData.members || []).map((member, idx) => (
                  <div key={member.uid} className="flex items-center gap-3 py-1">
                    <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-lg overflow-hidden">
                      {member.photoURL
                        ? <img src={member.photoURL} alt="" className="w-full h-full object-cover" />
                        : "😊"
                      }
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-700">
                        {member.name}
                        {member.uid === groupData.hostUid && (
                          <span className="ml-1 text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">방장</span>
                        )}
                        {member.uid === user?.uid && (
                          <span className="ml-1 text-xs text-gray-400">(나)</span>
                        )}
                      </p>
                    </div>
                    <span className="text-green-500 text-sm">준비 ✓</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 그룹 보너스 미리보기 */}
            <div className="bg-purple-50 rounded-2xl p-3 text-center">
              <p className="text-sm text-purple-700">
                현재 <span className="font-bold">{groupData.members?.length || 0}명</span> 참여 중 —
                그룹 보너스 <span className="font-bold text-purple-600">+{(groupData.members?.length || 0) * 5}P</span> 예정
              </p>
            </div>

            {/* 시작 버튼 (방장만) / 대기 안내 (일반) */}
            {groupData.hostUid === user?.uid ? (
              <button
                onClick={handleStart}
                disabled={loading || (groupData.members?.length || 0) < 2}
                className="w-full bg-green-500 text-white py-5 rounded-2xl font-bold text-lg shadow-md disabled:opacity-40 active:scale-95 transition-transform"
              >
                {loading ? "시작 중..." :
                  (groupData.members?.length || 0) < 2
                    ? "멤버를 기다리는 중... (최소 2명)"
                    : `🚀 플로깅 시작 (${groupData.members?.length}명)`
                }
              </button>
            ) : (
              <div className="bg-white rounded-2xl p-5 text-center shadow-sm">
                <div className="text-3xl mb-2 animate-bounce">⏳</div>
                <p className="text-gray-600 font-medium">방장이 시작하길 기다리는 중...</p>
                <p className="text-sm text-gray-400 mt-1">시작되면 자동으로 이동해요</p>
              </div>
            )}

            {/* 나가기 */}
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