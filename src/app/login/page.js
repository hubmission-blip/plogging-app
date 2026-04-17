"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  signInWithCredential,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, getDoc, updateDoc, increment, collection, query, where, getDocs, serverTimestamp } from "firebase/firestore";

// Capacitor 네이티브 환경 감지
const isCapacitorNative = () => {
  try {
    return typeof window !== "undefined" &&
      !!(window?.Capacitor?.isNativePlatform?.());
  } catch { return false; }
};

// 추천인 코드 → UID 조회
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

// 구글 로그인 후 Firestore 유저 문서 생성
async function ensureGoogleUserDoc(user) {
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) return;

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

  const myRef = user.uid.slice(0, 8).toUpperCase();
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
}

export default function LoginPage() {
  const router = useRouter();
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ✅ iOS 딥링크 수신: Safari에서 Google 인증 완료 후 앱으로 복귀
  const handleDeepLinkToken = useCallback(async (idToken) => {
    setLoading(true);
    setError("");
    try {
      const credential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(auth, credential);
      await ensureGoogleUserDoc(result.user);
      router.push("/");
    } catch (err) {
      setError("구글 로그인 실패: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!isCapacitorNative()) return;
    let cleanup = () => {};
    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const listener = await App.addListener("appUrlOpen", async (event) => {
          console.log("[AppUrlOpen]", event.url);
          if (event.url?.includes("google-auth")) {
            try {
              const { Browser } = await import("@capacitor/browser");
              await Browser.close();
            } catch {}
            const url = new URL(event.url);
            const idToken = url.searchParams.get("id_token");
            if (idToken) handleDeepLinkToken(idToken);
          }
        });
        cleanup = () => listener.remove();
      } catch {}
    })();
    return () => cleanup();
  }, [handleDeepLinkToken]);

  // ✅ 구글 로그인
  // iOS앱: Browser.open → 시스템 Safari → 콜백에서 딥링크로 복귀
  // 웹: 같은 페이지 내 redirect
  const handleGoogleLogin = async () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setError("Google Client ID가 설정되지 않았습니다.");
      return;
    }

    const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("google_auth_nonce", nonce);

    const isNative = isCapacitorNative();
    const redirectUri = isNative
      ? "https://happy500.kr/auth/google/"
      : `${window.location.origin}/auth/google/`;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "id_token",
      scope: "openid email profile",
      nonce: nonce,
      prompt: "select_account",
      state: isNative ? "capacitor" : "web",
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    if (isNative) {
      try {
        const { Browser } = await import("@capacitor/browser");
        await Browser.open({ url });
      } catch {
        window.location.href = url;
      }
    } else {
      window.location.href = url;
    }
  };

  // 카카오 로그인
  const handleKakaoLogin = () => {
    const KAKAO_CLIENT_ID = process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY;
    const REDIRECT_URI = `${window.location.origin}/auth/kakao`;
    if (!KAKAO_CLIENT_ID) {
      alert("카카오 API 키가 설정되지 않았습니다.");
      return;
    }
    window.location.href =
      `https://kauth.kakao.com/oauth/authorize` +
      `?client_id=${KAKAO_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&response_type=code`;
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
          totalPoints: 100,
          totalDistance: 0,
          ploggingCount: 0,
          provider: "email",
          createdAt: serverTimestamp(),
          refCode: cred.user.uid.slice(0, 8).toUpperCase(),
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
        "auth/invalid-credential": "이메일 또는 비밀번호를 확인하세요",
      };
      setError(msg[err.code] || "오류: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-500 to-green-400 flex flex-col items-center justify-center p-6">
      <div className="text-center mb-8">
        <div className="text-5xl mb-2">🌿</div>
        <h1 className="text-2xl font-bold text-white">오백원의 행복</h1>
        <p className="text-green-100 text-sm mt-1">즐거운 플로깅, 깨끗한 지구</p>
      </div>

      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl">
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

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-white border border-gray-200 py-3 rounded-xl font-bold text-sm mb-3 flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-sm disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-8 20-20 0-1.3-.1-2.7-.4-4z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.5 26.8 36 24 36c-5.2 0-9.6-3-11.3-7.2l-6.5 5C9.5 40 16.3 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.4-2.5 4.4-4.6 5.8l6.2 5.2C40.8 35.5 44 30.2 44 24c0-1.3-.1-2.7-.4-4z"/>
          </svg>
          Google로 시작하기
        </button>

        <button
          onClick={handleKakaoLogin}
          disabled={loading}
          className="w-full bg-[#FEE500] text-[#3C1E1E] py-3 rounded-xl font-bold text-sm mb-4 flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
        >
          <span className="text-lg">💬</span>
          카카오로 시작하기
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">또는 이메일</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

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
