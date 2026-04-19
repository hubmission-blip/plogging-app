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

export default function AppleCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState("처리 중...");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const userParam = params.get("user");

    // Apple은 GET 파라미터 또는 hash fragment로 code를 전달
    // POST form redirect인 경우 서버 측 처리 필요 → 아래 별도 처리
    if (!code) {
      // POST로 온 경우 body에서 추출 불가 → 별도 route handler에서 redirect
      const hash = window.location.hash;
      if (!hash) {
        router.push("/login");
        return;
      }
    }

    if (!code) return;

    const handleAppleLogin = async () => {
      try {
        setStatus("Apple 인증 중...");

        // ─── 1단계: Apple 토큰 → 사용자 정보 받기 ───────────────
        const res = await fetch("/api/apple-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, user: userParam }),
        });

        const text = await res.text();
        console.log("📌 Apple API 응답:", text);

        let appleUser;
        try {
          appleUser = JSON.parse(text);
        } catch {
          throw new Error("API 응답 파싱 실패: " + text);
        }

        if (!res.ok || appleUser.error) {
          throw new Error(appleUser.error || `HTTP ${res.status}`);
        }

        const appleUid = String(appleUser.uid);
        console.log("📌 Apple UID:", appleUid.slice(0, 10) + "...");

        // ─── 2단계: Firebase Auth 로그인 (이메일/비번 브릿지) ──────
        setStatus("Firebase 인증 중...");

        // Apple UID는 길어서 해시 처리
        const uidShort = appleUid.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20);
        const fakeEmail    = `apple_${uidShort}@apple-auth.plogging.app`;
        const fakePassword = `apple_${uidShort}_plogging2024!`;
        const displayName  = appleUser.nickname || "Apple유저";

        let firebaseUser;
        try {
          const cred = await signInWithEmailAndPassword(auth, fakeEmail, fakePassword);
          firebaseUser = cred.user;
          console.log("📌 Firebase 기존 로그인 성공:", firebaseUser.uid);
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
            console.log("📌 Firebase 신규 계정 생성:", firebaseUser.uid);
          } else {
            throw loginErr;
          }
        }

        // ─── 3단계: localStorage 저장 ────────────────────────────
        localStorage.setItem(
          "appleUser",
          JSON.stringify({
            uid:      firebaseUser.uid,
            appleUid,
            email:    appleUser.email || "",
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
              appleUid,
              email:         appleUser.email || "",
              nickname:      displayName,
              displayName,
              provider:      "apple",
              totalPoints:   100,
              totalDistance:  0,
              ploggingCount: 0,
              createdAt:     serverTimestamp(),
              refCode:       firebaseUser.uid.slice(0, 8).toUpperCase(),
            });
            console.log("📌 users 컬렉션 문서 생성 완료");
          }
        } catch (fsErr) {
          console.warn("⚠️ Firestore 저장 실패 (로그인은 유지됨):", fsErr.code, fsErr.message);
        }

        setStatus("완료! 이동 중...");
        router.push("/");

      } catch (e) {
        console.error("❌ Apple 로그인 실패:", e);
        setErrorMsg(e.message || "알 수 없는 오류");
        setStatus("오류 발생");
      }
    };

    handleAppleLogin();
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center p-6 max-w-sm w-full">
        {!errorMsg ? (
          <>
            <div className="mb-3 animate-bounce flex justify-center">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="black">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
            </div>
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
