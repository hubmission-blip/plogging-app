"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

const AuthContext = createContext(null);

// Capacitor(iOS 네이티브) 환경 여부 감지
const isCapacitorNative = () => {
  try {
    return typeof window !== "undefined" &&
      !!(window?.Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
};

// localStorage에서 소셜 로그인 사용자 복구
const restoreSocialUser = () => {
  try {
    const kakaoUser = localStorage.getItem("kakaoUser");
    const appleUser = localStorage.getItem("appleUser");
    if (kakaoUser) {
      const parsed = JSON.parse(kakaoUser);
      return { uid: parsed.uid, email: parsed.email, displayName: parsed.nickname, provider: "kakao" };
    }
    if (appleUser) {
      const parsed = JSON.parse(appleUser);
      return { uid: parsed.uid, email: parsed.email, displayName: parsed.nickname, provider: "apple" };
    }
  } catch { /* 파싱 실패 무시 */ }
  return null;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSkip, setShowSkip] = useState(false);

  // 강제 건너뛰기
  const forceSkip = useCallback(() => {
    console.warn("[AuthContext] 사용자가 인증 건너뛰기 선택");
    const socialUser = restoreSocialUser();
    setUser(socialUser);
    setLoading(false);
  }, []);

  useEffect(() => {
    let resolved = false;
    const isNative = isCapacitorNative();
    // 타임아웃: 웹 3초, 네이티브 8초
    const timeoutMs = isNative ? 8000 : 3000;
    // 건너뛰기 버튼: 2초 후 표시
    const skipTimer = setTimeout(() => setShowSkip(true), 2000);

    if (isNative) {
      console.log("[AuthContext] Capacitor 네이티브(iOS) 환경 감지");
    }

    // 안전장치: 타임아웃 시 강제 진입
    const timeout = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      console.warn(`[AuthContext] Firebase auth timeout (${timeoutMs}ms) — 앱 진입 허용`);
      const socialUser = restoreSocialUser();
      setUser(socialUser);
      setLoading(false);
    }, timeoutMs);

    let unsubscribe = () => {};

    try {
      unsubscribe = onAuthStateChanged(
        auth,
        (firebaseUser) => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeout);
          clearTimeout(skipTimer);
          if (firebaseUser) {
            setUser(firebaseUser);
          } else {
            const socialUser = restoreSocialUser();
            setUser(socialUser);
          }
          setLoading(false);
        },
        (error) => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeout);
          clearTimeout(skipTimer);
          console.error("[AuthContext] onAuthStateChanged error:", error.code, error.message);
          const socialUser = restoreSocialUser();
          setUser(socialUser);
          setLoading(false);
        }
      );
    } catch (initError) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        clearTimeout(skipTimer);
        console.error("[AuthContext] Firebase 초기화 실패:", initError);
        setLoading(false);
      }
    }

    return () => {
      clearTimeout(timeout);
      clearTimeout(skipTimer);
      unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-50 flex flex-col items-center justify-center z-[999]">
        <div className="mb-6 text-center">
          <p className="text-2xl font-black text-green-600">🌿 오백원의 행복</p>
          <p className="text-xs text-gray-400 mt-1">즐거운 플로깅, 깨끗한 지구</p>
        </div>
        <div className="flex gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
        <p className="text-[10px] text-gray-300 mt-4">인증 확인 중...</p>
        {/* 2초 후 건너뛰기 버튼 표시 */}
        {showSkip && (
          <button
            onClick={forceSkip}
            className="mt-6 text-xs text-gray-400 underline underline-offset-2 active:text-gray-600 transition-colors"
          >
            건너뛰기
          </button>
        )}
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
