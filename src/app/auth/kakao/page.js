"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";

export default function KakaoCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState("처리 중...");
  const [errorMsg, setErrorMsg] = useState("");

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
        console.log("📌 redirectUri:", redirectUri);
        console.log("📌 code:", code.substring(0, 10) + "...");

        // ─── 1단계: 카카오 토큰 → 사용자 정보 받기 ───────────────
        const res = await fetch("/api/kakao-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, redirectUri }),
        });

        const text = await res.text();
        console.log("📌 API 응답:", text);

        let kakaoUser;
        try {
          kakaoUser = JSON.parse(text);
        } catch {
          throw new Error("API 응답 파싱 실패: " + text);
        }

        if (!res.ok || kakaoUser.error) {
          throw new Error(kakaoUser.error || `HTTP ${res.status}`);
        }

        const kakaoUid = String(kakaoUser.uid);
        console.log("📌 카카오 UID:", kakaoUid);

        // ─── 2단계: Firebase Auth 로그인 (이메일/비번 브릿지) ──────
        // 카카오 UID로 Firebase Auth 전용 계정 생성/로그인
        // (Firebase Custom Token 없이도 작동하는 방식)
        setStatus("Firebase 인증 중...");

        const fakeEmail    = `kakao_${kakaoUid}@kakao-auth.plogging.app`;
        const fakePassword = `kakao_${kakaoUid}_plogging2024!`;
        const displayName  = kakaoUser.nickname || "카카오유저";

        let firebaseUser;
        let isNewUser = false;
        try {
          // 기존 계정이면 로그인
          const cred = await signInWithEmailAndPassword(auth, fakeEmail, fakePassword);
          firebaseUser = cred.user;
          console.log("📌 Firebase 기존 로그인 성공:", firebaseUser.uid);
        } catch (loginErr) {
          if (
            loginErr.code === "auth/user-not-found" ||
            loginErr.code === "auth/invalid-credential" ||
            loginErr.code === "auth/wrong-password"
          ) {
            // 신규 계정 생성
            const cred = await createUserWithEmailAndPassword(auth, fakeEmail, fakePassword);
            await updateProfile(cred.user, { displayName });
            // 신규 생성 직후 토큰 강제 갱신 → Firestore 인증 전파 대기
            await cred.user.getIdToken(true);
            firebaseUser = cred.user;
            isNewUser = true;
            console.log("📌 Firebase 신규 계정 생성:", firebaseUser.uid);
          } else {
            throw loginErr;
          }
        }

        // ─── 3단계: localStorage 먼저 저장 (인증 확보) ────────────
        localStorage.setItem(
          "kakaoUser",
          JSON.stringify({
            uid:      firebaseUser.uid,
            kakaoUid,
            email:    kakaoUser.email || "",
            nickname: displayName,
          })
        );

        // ─── 4단계: Firestore에 사용자 정보 저장 (실패해도 계속) ──
        setStatus("사용자 정보 저장 중...");
        try {
          const userRef  = doc(db, "users", firebaseUser.uid);
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              uid:           firebaseUser.uid,
              kakaoUid,
              email:         kakaoUser.email || "",
              nickname:      displayName,
              displayName,
              provider:      "kakao",
              totalPoints:   100,
              totalDistance: 0,
              ploggingCount: 0,
              createdAt:     serverTimestamp(),
              refCode:       firebaseUser.uid.slice(0, 8).toUpperCase(),
            });
            console.log("📌 users 컬렉션 문서 생성 완료");
          } else {
            // 기존 사용자: 이메일이 갱신되었으면 업데이트
            const realEmail = kakaoUser.email || "";
            if (realEmail && !realEmail.match(/^kakao_\d+@kakao\.com$/)) {
              await updateDoc(userRef, { email: realEmail });
              console.log("📌 이메일 갱신:", realEmail);
            }
          }
        } catch (fsErr) {
          // Firestore 저장 실패해도 인증은 됐으므로 홈으로 이동
          // (다음 로그인 시 또는 프로필 방문 시 문서 자동 생성됨)
          console.warn("⚠️ Firestore 저장 실패 (로그인은 유지됨):", fsErr.code, fsErr.message);
        }

        setStatus("완료! 이동 중...");
        router.push("/");

      } catch (e) {
        console.error("❌ 카카오 로그인 실패:", e);
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