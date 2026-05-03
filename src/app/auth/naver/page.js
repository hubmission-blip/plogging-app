"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

export default function NaverCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState("처리 중...");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");

    if (!code) {
      router.push("/login");
      return;
    }

    const handleNaverLogin = async () => {
      try {
        setStatus("네이버 인증 중...");

        // ─── 1단계: 네이버 토큰 → 사용자 정보 받기 ───────────────
        const res = await fetch("/api/naver-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, state }),
        });

        const text = await res.text();
        // 네이버 API 응답 파싱

        let naverUser;
        try {
          naverUser = JSON.parse(text);
        } catch {
          throw new Error("API 응답 파싱 실패: " + text);
        }

        if (!res.ok || naverUser.error) {
          throw new Error(naverUser.error || `HTTP ${res.status}`);
        }

        const naverUid = String(naverUser.uid);
        // 네이버 인증 완료

        // ─── 2단계: Firebase Auth 로그인 (이메일/비번 브릿지) ──────
        setStatus("Firebase 인증 중...");

        const fakeEmail    = `naver_${naverUid}@naver-auth.plogging.app`;
        const fakePassword = `naver_${naverUid}_plogging2024!`;
        const displayName  = naverUser.nickname || "네이버유저";

        let firebaseUser;
        let isNewUser = false;
        try {
          const cred = await signInWithEmailAndPassword(auth, fakeEmail, fakePassword);
          firebaseUser = cred.user;
          // Firebase 기존 로그인 성공
        } catch (loginErr) {
          if (
            loginErr.code === "auth/user-not-found" ||
            loginErr.code === "auth/invalid-credential" ||
            loginErr.code === "auth/wrong-password"
          ) {
            const cred = await createUserWithEmailAndPassword(auth, fakeEmail, fakePassword);
            await updateProfile(cred.user, { displayName });
            await cred.user.getIdToken(true);
            firebaseUser = cred.user;
            isNewUser = true;
            // Firebase 신규 계정 생성
          } else {
            throw loginErr;
          }
        }

        // ─── 3단계: localStorage 저장 ────────────────────────────
        localStorage.setItem(
          "naverUser",
          JSON.stringify({
            uid:      firebaseUser.uid,
            naverUid,
            email:    naverUser.email || "",
            nickname: displayName,
          })
        );

        // ─── 4단계: Firestore에 사용자 정보 저장 ─────────────────
        setStatus("사용자 정보 저장 중...");
        try {
          const userRef  = doc(db, "users", firebaseUser.uid);
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              uid:           firebaseUser.uid,
              naverUid,
              email:         naverUser.email || "",
              nickname:      displayName,
              displayName,
              provider:      "naver",
              totalPoints:   100,
              totalDistance:  0,
              ploggingCount: 0,
              createdAt:     serverTimestamp(),
              refCode:       firebaseUser.uid.slice(0, 8).toUpperCase(),
            });
            // users 컬렉션 문서 생성 완료
          }
        } catch (fsErr) {
          console.warn("⚠️ Firestore 저장 실패 (로그인은 유지됨):", fsErr.code, fsErr.message);
        }

        setStatus("완료! 이동 중...");
        await new Promise((r) => setTimeout(r, 300));
        router.push("/");

      } catch (e) {
        console.error("❌ 네이버 로그인 실패:", e);
        setErrorMsg(e.message || "알 수 없는 오류");
        setStatus("오류 발생");
      }
    };

    handleNaverLogin();
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center p-6 max-w-sm w-full">
        {!errorMsg ? (
          <>
            <div className="text-4xl mb-3 animate-bounce">🟢</div>
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
