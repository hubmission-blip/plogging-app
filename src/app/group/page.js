"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection, addDoc, doc, getDoc, updateDoc,
  arrayUnion, query, where, getDocs, serverTimestamp
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";

// 6자리 랜덤 코드 생성
function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function GroupPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState("my"); // my | create | join
  const [myGroups, setMyGroups] = useState([]);
  const [loading, setLoading] = useState(false);

  // 그룹 생성 폼
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");

  // 그룹 참여 폼
  const [joinCode, setJoinCode] = useState("");

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    fetchMyGroups();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchMyGroups = async () => {
    try {
      const q = query(
        collection(db, "groups"),
        where("members", "array-contains", user.uid)
      );
      const snap = await getDocs(q);
      setMyGroups(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("그룹 불러오기 실패:", e);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    setLoading(true);
    try {
      const code = generateCode();
      const docRef = await addDoc(collection(db, "groups"), {
        name: groupName,
        description: groupDesc,
        code,
        leaderId: user.uid,
        leaderEmail: user.email,
        leaderNickname: user.displayName || user.email?.split("@")[0],
        members: [user.uid],
        memberCount: 1,
        totalDistance: 0,
        createdAt: serverTimestamp(),
        isActive: true,
      });
      setGroupName("");
      setGroupDesc("");
      setTab("my");
      fetchMyGroups();
      alert(`그룹 생성 완료!\n초대 코드: ${code}\n\n친구에게 코드를 공유하세요!`);
    } catch (e) {
      alert("그룹 생성 실패: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGroup = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "groups"),
        where("code", "==", joinCode.toUpperCase())
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        alert("존재하지 않는 코드입니다!");
        return;
      }

      const groupDoc = snap.docs[0];
      const groupData = groupDoc.data();

      if (groupData.members.includes(user.uid)) {
        alert("이미 가입된 그룹입니다!");
        return;
      }

      await updateDoc(doc(db, "groups", groupDoc.id), {
        members: arrayUnion(user.uid),
        memberCount: (groupData.memberCount || 1) + 1,
      });

      setJoinCode("");
      setTab("my");
      fetchMyGroups();
      alert(`"${groupData.name}" 그룹에 참여했습니다! 🎉`);
    } catch (e) {
      alert("참여 실패: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* 헤더 */}
      <div className="bg-gradient-to-b from-purple-600 to-purple-500 px-4 pt-12 pb-6 text-white">
        <h1 className="text-2xl font-bold">👥 그룹 플로깅</h1>
        <p className="text-purple-100 text-sm mt-1">함께하면 보너스 포인트!</p>
        <div className="mt-3 bg-white/20 rounded-xl px-4 py-2 inline-block">
          <p className="text-sm">그룹원 수 × 5P 추가 보너스 🎁</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex bg-white border-b sticky top-0 z-10">
        {[
          { id: "my",     label: "내 그룹" },
          { id: "create", label: "그룹 만들기" },
          { id: "join",   label: "그룹 참여" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? "border-purple-500 text-purple-600"
                : "border-transparent text-gray-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {/* 내 그룹 목록 */}
        {tab === "my" && (
          <div>
            {myGroups.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-4xl mb-3">👥</p>
                <p className="text-gray-500 font-medium">아직 그룹이 없어요</p>
                <p className="text-gray-400 text-sm mt-1">그룹을 만들거나 코드로 참여해보세요!</p>
                <div className="flex gap-2 mt-4 justify-center">
                  <button
                    onClick={() => setTab("create")}
                    className="bg-purple-500 text-white px-4 py-2 rounded-full text-sm font-bold"
                  >
                    그룹 만들기
                  </button>
                  <button
                    onClick={() => setTab("join")}
                    className="border border-purple-500 text-purple-500 px-4 py-2 rounded-full text-sm font-bold"
                  >
                    코드로 참여
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {myGroups.map((group) => (
                  <div key={group.id} className="bg-white rounded-2xl shadow-sm p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-gray-800">{group.name}</h3>
                          {group.leaderId === user.uid && (
                            <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">
                              리더
                            </span>
                          )}
                        </div>
                        {group.description && (
                          <p className="text-sm text-gray-500 mt-0.5">{group.description}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          👥 {group.memberCount}명 참여 중
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">초대 코드</p>
                        <p className="font-bold text-purple-600 text-lg tracking-widest">
                          {group.code}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-3">
                      {/* 그룹과 함께 플로깅 시작 */}
                      <Link
                        href={`/map?groupId=${group.id}&groupSize=${group.memberCount}`}
                        className="flex-1"
                      >
                        <button className="w-full bg-purple-500 text-white py-2 rounded-xl text-sm font-bold">
                          🚶 함께 플로깅 시작
                        </button>
                      </Link>
                      {/* 코드 복사 */}
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(group.code);
                          alert(`코드 ${group.code} 복사됨!`);
                        }}
                        className="border border-gray-200 px-3 py-2 rounded-xl text-sm text-gray-500"
                      >
                        📋
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 그룹 만들기 */}
        {tab === "create" && (
          <form onSubmit={handleCreateGroup} className="space-y-4">
            <div className="bg-purple-50 rounded-2xl p-4 text-sm text-purple-700">
              <p className="font-bold mb-1">💡 그룹 플로깅 보너스</p>
              <p>그룹원이 많을수록 포인트 UP!</p>
              <p>2명: +10P / 5명: +25P / 10명: +50P</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                그룹 이름 *
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="예: 한강 플로깅 팀"
                required
                maxLength={20}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                그룹 소개 (선택)
              </label>
              <textarea
                value={groupDesc}
                onChange={(e) => setGroupDesc(e.target.value)}
                placeholder="그룹 소개를 입력해주세요"
                rows={3}
                maxLength={100}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !groupName.trim()}
              className="w-full bg-purple-500 text-white py-3 rounded-xl font-bold disabled:opacity-50"
            >
              {loading ? "생성 중..." : "✅ 그룹 만들기"}
            </button>
          </form>
        )}

        {/* 그룹 참여 */}
        {tab === "join" && (
          <form onSubmit={handleJoinGroup} className="space-y-4">
            <div className="bg-blue-50 rounded-2xl p-4 text-sm text-blue-700">
              <p className="font-bold mb-1">📋 참여 방법</p>
              <p>그룹 리더에게 6자리 초대 코드를 받아 입력하세요!</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                초대 코드 (6자리)
              </label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="예: ABC123"
                required
                maxLength={6}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-center text-2xl font-bold tracking-widest uppercase"
              />
            </div>

            <button
              type="submit"
              disabled={loading || joinCode.length < 6}
              className="w-full bg-blue-500 text-white py-3 rounded-xl font-bold disabled:opacity-50"
            >
              {loading ? "참여 중..." : "🚀 그룹 참여하기"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}