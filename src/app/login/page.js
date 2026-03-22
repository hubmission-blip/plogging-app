"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export default function LoginPage() {
  const router = useRouter();
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ✅ 카카오 로그인 - 올바른 REST API 키 + Redirect URI 사용
  const handleKakaoLogin = () => {
    const KAKAO_CLIENT_ID = process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY;
    const REDIRECT_URI = `${window.location.origin}/auth/kakao`;

    if (!KAKAO_CLIENT_ID) {
      alert("카카오 API 키가 설정되지 않았습니다.");
      return;
    }

    const kakaoAuthUrl =
      `https://kauth.kakao.com/oauth/authorize` +
      `?client_id=${KAKAO_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&response_type=code`;

    window.location.href = kakaoAuthUrl;
  };

  // 이메일 로그인/회원가입
  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isSignup) {
        if (!nickname.trim()) {
          setError("닉네임을 입력해주세요");
          setLoading(false);
          return;
        }
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: nickname });
        await setDoc(doc(db, "users", cred.user.uid), {
          uid: cred.user.uid,
          email: cred.user.email,
          displayName: nickname,
          totalPoints: 0,
          totalDistance: 0,
          ploggingCount: 0,
          createdAt: serverTimestamp(),
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      router.push("/");
    } catch (err) {
      const msg = {
        "auth/email-already-in-use": "이미 사용 중인 이메일입니다",
        "auth/weak-password": "비밀번호는 6자 이상이어야 합니다",
        "auth/user-not-found": "존재하지 않는 계정입니다",
        "auth/wrong-password": "비밀번호가 틀렸습니다",
        "auth/invalid-email": "올바른 이메일 형식이 아닙니다",
        "auth/invalid-credential": "이메일 또는 비밀번호를 확인하세요",
      };
      setError(msg[err.code] || "오류가 발생했습니다: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-500 to-green-400 flex flex-col items-center justify-center p-6">
      {/* 로고 */}
      <div className="text-center mb-8">
        <div className="text-5xl mb-2">🌿</div>
        <h1 className="text-2xl font-bold text-white">오백원의 행복</h1>
        <p className="text-green-100 text-sm mt-1">즐거운 플로깅, 깨끗한 지구</p>
      </div>

      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl">
        {/* 탭 */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
          <button
            onClick={() => { setIsSignup(false); setError(""); }}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
              !isSignup ? "bg-white shadow text-green-600" : "text-gray-400"
            }`}
          >
            로그인
          </button>
          <button
            onClick={() => { setIsSignup(true); setError(""); }}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
              isSignup ? "bg-white shadow text-green-600" : "text-gray-400"
            }`}
          >
            회원가입
          </button>
        </div>

        {/* 카카오 로그인 버튼 */}
        <button
          onClick={handleKakaoLogin}
          className="w-full bg-[#FEE500] text-[#3C1E1E] py-3 rounded-xl font-bold text-sm mb-4 flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <span className="text-lg">💬</span>
          카카오로 시작하기
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">또는</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* 이메일 폼 */}
        <form onSubmit={handleEmailAuth} className="space-y-3">
          {isSignup && (
            <input
              type="text"
              placeholder="닉네임"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400"
            />
          )}
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400"
            required
          />
          <input
            type="password"
            placeholder="비밀번호 (6자 이상)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400"
            required
          />

          {error && (
            <p className="text-red-500 text-xs text-center bg-red-50 py-2 rounded-lg">
              ⚠️ {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-500 text-white py-3 rounded-xl font-bold text-sm disabled:opacity-50 active:scale-95 transition-transform"
          >
            {loading ? "처리 중..." : isSignup ? "회원가입" : "로그인"}
          </button>
        </form>
      </div>

      <p className="text-green-100 text-xs mt-6 text-center">
        사단법인 국제청년환경연합회 (GYEA)
      </p>
    </div>
  );
}