"use client";

import { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        // 회원가입
        const { user } = await createUserWithEmailAndPassword(auth, email, password);

        // 닉네임 Firebase Auth 프로필에 저장
        await updateProfile(user, { displayName: nickname });

        // Firestore users 컬렉션에도 저장
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          email: user.email,
          nickname: nickname,
          totalPoints: 0,
          totalDistance: 0,
          ploggingCount: 0,
          createdAt: serverTimestamp(),
        });
      }
      router.push("/");
    } catch (err) {
      const messages = {
        "auth/user-not-found": "등록되지 않은 이메일입니다",
        "auth/wrong-password": "비밀번호가 틀렸습니다",
        "auth/invalid-credential": "이메일 또는 비밀번호가 틀렸습니다",
        "auth/email-already-in-use": "이미 사용 중인 이메일입니다",
        "auth/weak-password": "비밀번호는 6자 이상이어야 합니다",
        "auth/invalid-email": "올바른 이메일 형식이 아닙니다",
      };
      setError(messages[err.code] || "오류가 발생했습니다: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🌿</div>
          <h1 className="text-2xl font-bold text-green-700">오백원의 행복</h1>
          <p className="text-gray-500 text-sm mt-1">즐거운 플로깅, 깨끗한 지구</p>
        </div>

        {/* 탭 */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
          <button
            onClick={() => setIsLogin(true)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              isLogin ? "bg-white text-green-700 shadow" : "text-gray-500"
            }`}
          >
            로그인
          </button>
          <button
            onClick={() => setIsLogin(false)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              !isLogin ? "bg-white text-green-700 shadow" : "text-gray-500"
            }`}
          >
            회원가입
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 닉네임 (회원가입만) */}
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                닉네임
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="사용할 닉네임 입력 (2~10자)"
                required={!isLogin}
                minLength={2}
                maxLength={10}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이메일
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              required
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6자 이상 입력"
              required
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl">
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-500 text-white py-3 rounded-xl font-bold text-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
          >
            {loading ? "처리 중..." : isLogin ? "로그인" : "회원가입"}
          </button>
        </form>

        {/* 구분선 */}
          <div className="flex items-center gap-3 my-2">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">또는</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* 카카오 로그인 버튼 */}
          <button
            type="button"
onClick={() => {
  const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY}&redirect_uri=${window.location.origin}/auth/kakao&response_type=code`;
  window.location.href = kakaoAuthUrl;
}}
            className="w-full bg-yellow-400 text-gray-900 py-3 rounded-xl font-bold text-base flex items-center justify-center gap-2 hover:bg-yellow-500 transition-colors"
          >
            <span className="text-xl">💬</span>
            카카오로 시작하기
          </button>

        <p className="text-center text-xs text-gray-400 mt-8">
          사단법인 국제청년환경연합회 (GYEA)
        </p>
      </div>
    </div>
  );
}