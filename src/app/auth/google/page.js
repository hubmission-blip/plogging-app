"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithCredential, GoogleAuthProvider } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, getDoc, updateDoc, increment, collection, query, where, getDocs, serverTimestamp } from "firebase/firestore";

// 추천인 코드로 추천인 UID 조회
async function resolveReferrer(refCode) {
  if (!refCode || refCode.length < 6) return null;
  const code = refCode.toUpperCase().slice(0, 8);
  try {
    const q = query(collection(db, "users"), where("refCode", "==", code));
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].data().uid;
    const byUid = await getDoc(doc(db, "users", code));
    if (byUid.exists()) return code;
  } catch {}
  return null;
}

export default function GoogleCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState("처리 중...");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const handleGoogleCallback = async () => {
      try {
        // ─── 1단계: URL 해시에서 id_token + state 추출 ──────────
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const idToken = params.get("id_token");
        const state = params.get("state");

        if (!idToken) {
          const error = params.get("error");
          if (error) {
            throw new Error(`Google 인증 오류: ${error}`);
          }
          throw new Error("Google 인증 토큰을 받지 못했습니다.");
        }

        // ─── Capacitor 앱에서 온 경우: 딥링크로 앱에 토큰 전달 ───
        // 이 페이지는 시스템 Safari에서 로드됨 (Browser.open으로 열림)
        // 딥링크로 토큰을 보내면 앱이 받아서 Firebase 인증 처리
        if (state === "capacitor") {
          setStatus("앱으로 이동 중...");
          console.log("[GoogleCallback] Capacitor → 딥링크로 앱 복귀");
          window.location.href = `happy500app://google-auth?id_token=${encodeURIComponent(idToken)}`;
          return;
        }

        // ─── 웹 브라우저: 직접 Firebase 로그인 ──────────────────
        setStatus("Google 인증 중...");

        const credential = GoogleAuthProvider.credential(idToken);
        const result = await signInWithCredential(auth, credential);
        const user = result.user;

        console.log("[GoogleCallback] Firebase 로그인 성공:", user.uid);

        setStatus("사용자 정보 확인 중...");
        try {
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);

          if (!userSnap.exists()) {
            let referrerUid = null;
            let refCode = "";
            try {
              const stored = localStorage.getItem("pending_referral");
              if (stored) {
                const { code, expires } = JSON.parse(stored);
                if (Date.now() < expires) refCode = code.toUpperCase().slice(0, 8);
              }
            } catch {}
            if (refCode) referrerUid = await resolveReferrer(refCode);

            const myRef   = user.uid.slice(0, 8).toUpperCase();
            const welcome = referrerUid ? 150 : 100;

            await setDoc(userRef, {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName || "구글유저",
              provider: "google",
              totalPoints: welcome,
              totalDistance: 0,
              ploggingCount: 0,
              createdAt: serverTimestamp(),
              refCode: myRef,
              ...(referrerUid ? { referredBy: referrerUid } : {}),
            });

            if (referrerUid) {
              try {
                await updateDoc(doc(db, "users", referrerUid), { totalPoints: increment(100) });
                localStorage.removeItem("pending_referral");
              } catch {}
            }

            console.log("[GoogleCallback] 신규 사용자 문서 생성 완료");
          }
        } catch (fsErr) {
          console.warn("[GoogleCallback] Firestore 저장 실패:", fsErr.code, fsErr.message);
        }

        localStorage.removeItem("google_auth_nonce");

        setStatus("완료! 이동 중...");
        router.push("/");

      } catch (e) {
        console.error("[GoogleCallback] 로그인 실패:", e);
        setErrorMsg(e.message || "알 수 없는 오류");
        setStatus("오류 발생");
      }
    };

    handleGoogleCallback();
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="text-center p-6 max-w-sm w-full">
        {!errorMsg ? (
          <>
            <div className="text-4xl mb-3 animate-bounce">🔵</div>
            <p className="text-gray-600 font-medium">{status}</p>
          </>
        ) : (
          <>
            <div className="text-4xl mb-3">❌</div>
            <p className="text-red-600 font-bold mb-2">Google 로그인 실패</p>
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
