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

  useEffect(() => {
    const isNative = isCapacitorNative();
    // 시뮬레이터/네이티브 환경에서는 타임아웃을 8초로 넉넉하게 설정
    const timeoutMs = isNative ? 8000 : 5000;

    if (isNative) {
      console.log("[AuthContext] 🍎 Capacitor 네이티브(iOS) 환경 감지");
    }

    const timeout = setTimeout(() => {
      console.warn(`[AuthContext] Firebase auth timeout (${timeoutMs}ms) — 앱 진입 허용`);
      setLoading(false);
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
            // 소셜 로그인 확인 (카카오/네이버/애플)
            try {
              const kakaoUser = localStorage.getItem("kakaoUser");
              const naverUser = localStorage.getItem("naverUser");
              const appleUser = localStorage.getItem("appleUser");
              if (kakaoUser) {
                const parsed = JSON.parse(kakaoUser);
                setUser({
                  uid: parsed.uid,
                  email: parsed.email,
                  displayName: parsed.nickname,
                  provider: "kakao",
                });
              } else if (naverUser) {
                const parsed = JSON.parse(naverUser);
                setUser({
                  uid: parsed.uid,
                  email: parsed.email,
                  displayName: parsed.nickname,
                  provider: "naver",
                });
              } else if (appleUser) {
                const parsed = JSON.parse(appleUser);
                setUser({
                  uid: parsed.uid,
                  email: parsed.email,
                  displayName: parsed.nickname,
                  provider: "apple",
                });
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
          // Firebase Auth 자체 오류 시에도 앱 진입 허용
          clearTimeout(timeout);
          console.error("[AuthContext] onAuthStateChanged error:", error.code, error.message);
          setLoading(false);
        }
      );
    } catch (initError) {
      // Firebase 자체가 초기화 안 된 경우 (WKWebView 극단적 오류)
      clearTimeout(timeout);
      console.error("[AuthContext] Firebase 초기화 실패:", initError);
      setLoading(false);
    }

    return () => {
      clearTimeout(timeout);
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
