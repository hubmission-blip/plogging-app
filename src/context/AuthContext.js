"use client";

import { createContext, useContext, useEffect, useState } from "react";
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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timedOut, setTimedOut] = useState(false);

  const initAuth = () => {
    setLoading(true);
    setTimedOut(false);

    const isNative = isCapacitorNative();
    // iPad/시뮬레이터 환경에서 Firebase 초기화가 느릴 수 있으므로 넉넉하게
    const timeoutMs = isNative ? 12000 : 5000;

    if (isNative) {
      console.log("[AuthContext] Capacitor 네이티브(iOS) 환경 감지");
    }

    const timeout = setTimeout(() => {
      console.warn(`[AuthContext] Firebase auth timeout (${timeoutMs}ms) — 앱 진입 허용`);
      // 타임아웃 시 localStorage 소셜 로그인 체크 후 진입
      try {
        const kakaoUser = localStorage.getItem("kakaoUser");
        const appleUser = localStorage.getItem("appleUser");
        if (kakaoUser) {
          const parsed = JSON.parse(kakaoUser);
          setUser({ uid: parsed.uid, email: parsed.email, displayName: parsed.nickname, provider: "kakao" });
        } else if (appleUser) {
          const parsed = JSON.parse(appleUser);
          setUser({ uid: parsed.uid, email: parsed.email, displayName: parsed.nickname, provider: "apple" });
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      }
      setLoading(false);
      setTimedOut(true);
    }, timeoutMs);

    let unsubscribe = () => {};

    try {
      unsubscribe = onAuthStateChanged(
        auth,
        (firebaseUser) => {
          clearTimeout(timeout);
          if (firebaseUser) {
            setUser(firebaseUser);
          } else {
            // 소셜 로그인 확인 (카카오/애플)
            try {
              const kakaoUser = localStorage.getItem("kakaoUser");
              const appleUser = localStorage.getItem("appleUser");
              if (kakaoUser) {
                const parsed = JSON.parse(kakaoUser);
                setUser({ uid: parsed.uid, email: parsed.email, displayName: parsed.nickname, provider: "kakao" });
              } else if (appleUser) {
                const parsed = JSON.parse(appleUser);
                setUser({ uid: parsed.uid, email: parsed.email, displayName: parsed.nickname, provider: "apple" });
              } else {
                setUser(null);
              }
            } catch {
              setUser(null);
            }
          }
          setLoading(false);
        },
        (error) => {
          clearTimeout(timeout);
          console.error("[AuthContext] onAuthStateChanged error:", error.code, error.message);
          setLoading(false);
        }
      );
    } catch (initError) {
      clearTimeout(timeout);
      console.error("[AuthContext] Firebase 초기화 실패:", initError);
      setLoading(false);
    }

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  };

  useEffect(() => {
    const cleanup = initAuth();
    return cleanup;
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
