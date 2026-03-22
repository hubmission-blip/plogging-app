"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

export default function KakaoCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      handleKakaoLogin(code);
    } else {
      router.push("/login");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKakaoLogin = async (code) => {
    try {
      // 카카오 토큰 요청
      const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: process.env.NEXT_PUBLIC_KAKAO_MAP_KEY,
          redirect_uri: `${window.location.origin}/auth/kakao`,
          code,
        }),
      });
      const tokenData = await tokenRes.json();

      // 카카오 사용자 정보 요청
      const userRes = await fetch("https://kapi.kakao.com/v2/user/me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const kakaoUser = await userRes.json();

      const uid = `kakao_${kakaoUser.id}`;
      const nickname = kakaoUser.kakao_account?.profile?.nickname || "카카오유저";
      const email = kakaoUser.kakao_account?.email || `${kakaoUser.id}@kakao.com`;

      // Firestore에 유저 정보 저장 (없으면 신규 생성)
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid,
          email,
          nickname,
          provider: "kakao",
          totalPoints: 0,
          totalDistance: 0,
          ploggingCount: 0,
          createdAt: serverTimestamp(),
        });
      }

      // 로컬스토리지에 임시 세션 저장
      localStorage.setItem("kakaoUser", JSON.stringify({ uid, email, nickname }));
      router.push("/");
    } catch (e) {
      console.error("카카오 로그인 실패:", e);
      router.push("/login");
    }
  };

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="text-4xl mb-3 animate-bounce">🟡</div>
        <p className="text-gray-600">카카오 로그인 처리 중...</p>
      </div>
    </div>
  );
}