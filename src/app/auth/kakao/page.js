"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

export default function KakaoCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");

    if (!code) {
      router.push("/login");
      return;
    }

    // ✅ 함수를 useEffect 안으로 이동 → eslint-disable 불필요
    const handleKakaoLogin = async () => {
      try {
        const res = await fetch("/api/kakao-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            redirectUri: `${window.location.origin}/auth/kakao`,
          }),
        });

        // ✅ HTTP 오류 체크 추가
        if (!res.ok) {
          throw new Error(`서버 오류: ${res.status}`);
        }

        const kakaoUser = await res.json();

        if (kakaoUser.error) {
          console.error("카카오 오류:", kakaoUser.error);
          router.push("/login");
          return;
        }

        // ✅ uid를 String()으로 변환 (카카오 uid는 숫자형)
        const uid = String(kakaoUser.uid);

        // Firestore에 유저 정보 저장
        const userRef = doc(db, "kakaoUsers", uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid,
            email: kakaoUser.email || "",           // ✅ null 방어
            nickname: kakaoUser.nickname || "카카오유저", // ✅ null 방어
            provider: "kakao",
            totalPoints: 0,
            totalDistance: 0,
            ploggingCount: 0,
            createdAt: serverTimestamp(),
          });
        }

        // 세션 저장
        localStorage.setItem(
          "kakaoUser",
          JSON.stringify({
            uid,
            email: kakaoUser.email || "",
            nickname: kakaoUser.nickname || "카카오유저",
          })
        );

        router.push("/");
      } catch (e) {
        console.error("카카오 로그인 실패:", e);
        router.push("/login");
      }
    };

    handleKakaoLogin();
  }, [router]); // ✅ router를 deps에 정상 추가

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="text-4xl mb-3 animate-bounce">🟡</div>
        <p className="text-gray-600">카카오 로그인 처리 중...</p>
      </div>
    </div>
  );
}