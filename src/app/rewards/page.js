"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  doc, getDoc, updateDoc, addDoc,
  collection, serverTimestamp, increment
} from "firebase/firestore";
import { useRouter } from "next/navigation";

const REWARDS = [
  {
    id: "coffee",
    name: "아메리카노 쿠폰",
    brand: "감탄소 카페",
    emoji: "☕",
    points: 500,
    description: "감탄소 카페 아메리카노 1잔",
    color: "from-amber-400 to-orange-400",
  },
  {
    id: "bag",
    name: "에코백",
    brand: "GYEA 굿즈",
    emoji: "👜",
    points: 1000,
    description: "GYEA 로고 친환경 에코백",
    color: "from-green-400 to-emerald-500",
  },
  {
    id: "voucher",
    name: "5,000원 상품권",
    brand: "큐엠씨코리아",
    emoji: "🎫",
    points: 2000,
    description: "큐엠씨코리아 온라인몰 사용 가능",
    color: "from-blue-400 to-cyan-500",
  },
  {
    id: "tree",
    name: "나무 심기 1그루",
    brand: "국제청년환경연합회",
    emoji: "🌳",
    points: 300,
    description: "GYEA 환경 캠페인 나무 심기 후원",
    color: "from-teal-400 to-green-500",
  },
  {
    id: "plogging-kit",
    name: "플로깅 키트",
    brand: "GYEA 굿즈",
    emoji: "🗑️",
    points: 1500,
    description: "집게 + 쓰레기봉투 10매 세트",
    color: "from-purple-400 to-violet-500",
  },
  {
    id: "donation",
    name: "환경 단체 기부",
    brand: "사단법인 GYEA",
    emoji: "💚",
    points: 100,
    description: "100P = 100원 환경단체 기부",
    color: "from-lime-400 to-green-400",
  },
];

export default function RewardsPage() {
  const { user } = useAuth();
  const [userData, setUserData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const router = useRouter();

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    fetchUserData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchUserData = async () => {
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) setUserData(snap.data());
  };

  const totalPoints = userData?.totalPoints || 0;

  const handleExchange = async () => {
    if (!selected) return;
    if (totalPoints < selected.points) {
      alert("포인트가 부족합니다!");
      return;
    }

    setLoading(true);
    try {
      // 포인트 차감
      await updateDoc(doc(db, "users", user.uid), {
        totalPoints: increment(-selected.points),
      });

      // 교환 기록 저장
      await addDoc(collection(db, "exchanges"), {
        userId: user.uid,
        email: user.email,
        rewardId: selected.id,
        rewardName: selected.name,
        pointsUsed: selected.points,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      setUserData((prev) => ({
        ...prev,
        totalPoints: prev.totalPoints - selected.points,
      }));

      setSuccess(selected);
      setSelected(null);
    } catch (e) {
      alert("교환 실패: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* 헤더 */}
      <div className="bg-gradient-to-b from-yellow-500 to-amber-400 px-4 pt-12 pb-6 text-white">
        <h1 className="text-2xl font-bold">🎁 포인트 교환</h1>
        <p className="text-yellow-100 text-sm mt-1">모은 포인트로 리워드를 받아보세요</p>

        {/* 보유 포인트 */}
        <div className="mt-4 bg-white/20 rounded-2xl p-4">
          <p className="text-yellow-100 text-sm">보유 포인트</p>
          <p className="text-4xl font-bold mt-1">{totalPoints.toLocaleString()} P</p>
          <p className="text-yellow-100 text-xs mt-1">
            플로깅할수록 포인트가 쌓여요! 🚶
          </p>
        </div>
      </div>

      {/* 리워드 목록 */}
      <div className="p-4">
        <h2 className="font-bold text-gray-700 mb-3">교환 가능한 리워드</h2>
        <div className="grid grid-cols-2 gap-3">
          {REWARDS.map((reward) => {
            const canExchange = totalPoints >= reward.points;
            return (
              <button
                key={reward.id}
                onClick={() => canExchange && setSelected(reward)}
                className={`bg-white rounded-2xl shadow-sm overflow-hidden text-left transition-transform ${
                  canExchange ? "active:scale-95" : "opacity-50"
                }`}
              >
                {/* 색상 배너 */}
                <div className={`bg-gradient-to-r ${reward.color} p-4 flex items-center justify-between`}>
                  <span className="text-4xl">{reward.emoji}</span>
                  <span className="text-white font-bold text-sm bg-white/20 px-2 py-1 rounded-full">
                    {reward.points.toLocaleString()}P
                  </span>
                </div>
                <div className="p-3">
                  <p className="font-bold text-sm text-gray-800">{reward.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{reward.brand}</p>
                  <p className="text-xs text-gray-500 mt-1">{reward.description}</p>
                  <div className={`mt-2 text-xs font-medium ${canExchange ? "text-green-600" : "text-red-400"}`}>
                    {canExchange ? "✅ 교환 가능" : `${(reward.points - totalPoints).toLocaleString()}P 부족`}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 교환 확인 모달 */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="text-center mb-4">
              <span className="text-5xl">{selected.emoji}</span>
              <h3 className="text-lg font-bold mt-2">{selected.name}</h3>
              <p className="text-gray-500 text-sm mt-1">{selected.description}</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">교환 포인트</span>
                <span className="font-bold text-red-500">-{selected.points.toLocaleString()}P</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-gray-500">잔여 포인트</span>
                <span className="font-bold text-green-600">
                  {(totalPoints - selected.points).toLocaleString()}P
                </span>
              </div>
            </div>

            <p className="text-xs text-gray-400 text-center mb-4">
              교환 후 hubmission@gmail.com으로<br />수령 방법을 안내해 드립니다
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setSelected(null)}
                className="flex-1 border border-gray-200 py-3 rounded-xl text-gray-500 font-medium"
              >
                취소
              </button>
              <button
                onClick={handleExchange}
                disabled={loading}
                className="flex-1 bg-yellow-400 py-3 rounded-xl font-bold disabled:opacity-50"
              >
                {loading ? "처리 중..." : "교환하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 교환 완료 모달 */}
      {success && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
            <div className="text-5xl mb-3">🎉</div>
            <h3 className="text-xl font-bold text-green-700">교환 완료!</h3>
            <p className="text-gray-500 text-sm mt-2">
              <span className="font-bold">{success.name}</span> 교환이 완료됐습니다!
            </p>
            <p className="text-xs text-gray-400 mt-3 bg-gray-50 rounded-xl p-3">
              📧 hubmission@gmail.com으로<br />3~5일 내 수령 방법을 안내해 드립니다
            </p>
            <button
              onClick={() => setSuccess(null)}
              className="mt-4 w-full bg-green-500 text-white py-3 rounded-xl font-bold"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}