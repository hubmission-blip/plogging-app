"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

export default function KakaoCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState("처리 중...");
  const [errorMsg, setErrorMsg] = useState(""); // ✅ 에러 표시용

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) {
      router.push("/login");
      return;
    }

    const handleKakaoLogin = async () => {
      try {
        setStatus("카카오 인증 중...");

        const redirectUri = `${window.location.origin}/auth/kakao`;
        console.log("📌 redirectUri:", redirectUri); // ← 콘솔 확인용
        console.log("📌 code:", code.substring(0, 10) + "..."); // ← 콘솔 확인용

        const res = await fetch("/api/kakao-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, redirectUri }),
        });

        // ✅ 응답 상태 확인
        const text = await res.text();
        console.log("📌 API 응답:", text); // ← 콘솔 확인용

        let kakaoUser;
        try {
          kakaoUser = JSON.parse(text);
        } catch {
          throw new Error("API 응답 파싱 실패: " + text);
        }

        if (!res.ok || kakaoUser.error) {
          throw new Error(kakaoUser.error || `HTTP ${res.status}`);
        }

        setStatus("사용자 정보 저장 중...");

        const uid = String(kakaoUser.uid);
        const userRef = doc(db, "kakaoUsers", uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid,
            email: kakaoUser.email || "",
            nickname: kakaoUser.nickname || "카카오유저",
            provider: "kakao",
            totalPoints: 0,
            totalDistance: 0,
            ploggingCount: 0,
            createdAt: serverTimestamp(),
          });
        }

        localStorage.setItem(
          "kakaoUser",
          JSON.stringify({
            uid,
            email: kakaoUser.email || "",
            nickname: kakaoUser.nickname || "카카오유저",
          })
        );

        setStatus("완료! 이동 중...");
        router.push("/");

      } catch (e) {
        console.error("❌ 카카오 로그인 실패:", e);
        // ✅ 에러를 화면에 표시 (조용히 redirect 안 함)
        setErrorMsg(e.message || "알 수 없는 오류");
        setStatus("오류 발생");
      }
    };

    handleKakaoLogin();
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center p-6 max-w-sm w-full">
        {!errorMsg ? (
          <>
            <div className="text-4xl mb-3 animate-bounce">🟡</div>
            <p className="text-gray-600 font-medium">{status}</p>
          </>
        ) : (
          <>
            <div className="text-4xl mb-3">❌</div>
            <p className="text-red-600 font-bold mb-2">로그인 실패</p>
            {/* ✅ 에러 메시지 화면에 표시 */}
            <p className="text-sm text-red-400 bg-red-50 p-3 rounded-xl mb-4 break-all">
              {errorMsg}
            </p>
            <button
              onClick={() => router.push("/login")}
              className="bg-green-500 text-white px-6 py-2 rounded-xl font-bold text-sm"
            >
              로그인으로 돌아가기
            </button>
          </>
        )}
      </div>
    </div>
  );
}