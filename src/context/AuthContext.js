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

// ── 즉시 복구: 이전 로그인 상태가 있으면 초기값으로 사용 ──
// Firebase onAuthStateChanged 응답 전에도 앱을 렌더링할 수 있게 함
const getInitialUser = () => {
  try {
    // Firebase가 로컬 persistence에 저장한 키 확인
    const fbKey = Object.keys(localStorage).find(
      (k) => k.startsWith("firebase:authUser:")
    );
    if (fbKey) {
      const cached = JSON.parse(localStorage.getItem(fbKey));
      if (cached?.uid) return { uid: cached.uid, email: cached.email, displayName: cached.displayName, _cached: true };
    }
  } catch { /* 무시 */ }
  return restoreSocialUser();
};

export function AuthProvider({ children }) {
  // 즉시 캐시된 사용자로 초기화 → loading=false로 시작 가능
  const cachedUser = typeof window !== "undefined" ? getInitialUser() : null;
  const [user, setUser] = useState(cachedUser);
  const [loading, setLoading] = useState(!cachedUser); // 캐시 있으면 즉시 렌더링
  const [authReady, setAuthReady] = useState(false); // Firebase 확인 완료 여부

  useEffect(() => {
    let initialResolved = false; // 최초 로딩 완료 여부 (타임아웃 전용)
    const isNative = isCapacitorNative();
    const timeoutMs = isNative ? 5000 : 1500;

    if (isNative) {
      console.log("[AuthContext] Capacitor 네이티브(iOS) 환경 감지");
    }

    // 안전장치: 타임아웃 시 강제 진입 (최초 1회만)
    const timeout = setTimeout(() => {
      if (initialResolved) return;
      initialResolved = true;
      console.warn(`[AuthContext] Firebase auth timeout (${timeoutMs}ms) — 앱 진입 허용`);
      setUser((prev) => prev || restoreSocialUser());
      setLoading(false);
      setAuthReady(true);
    }, timeoutMs);

    let unsubscribe = () => {};

    try {
      unsubscribe = onAuthStateChanged(
        auth,
        (firebaseUser) => {
          // 최초 호출: 타임아웃 해제 + 로딩 완료
          if (!initialResolved) {
            initialResolved = true;
            clearTimeout(timeout);
            setLoading(false);
            setAuthReady(true);
          }

          // ★ 핵심 수정: 이후 호출(로그인/로그아웃)에도 항상 user 상태 갱신
          if (firebaseUser) {
            console.log("[AuthContext] 인증 상태 변경: 로그인", firebaseUser.uid);
            setUser(firebaseUser);
          } else {
            // Firebase 인증 없음 → localStorage 소셜 유저 확인
            const socialUser = restoreSocialUser();
            console.log("[AuthContext] 인증 상태 변경: 로그아웃", socialUser ? "(소셜 복구)" : "(완전 로그아웃)");
            setUser(socialUser);
          }
        },
        (error) => {
          console.error("[AuthContext] onAuthStateChanged error:", error.code, error.message);
          if (!initialResolved) {
            initialResolved = true;
            clearTimeout(timeout);
            setUser((prev) => prev || restoreSocialUser());
            setLoading(false);
            setAuthReady(true);
          }
        }
      );
    } catch (initError) {
      if (!initialResolved) {
        initialResolved = true;
        clearTimeout(timeout);
        console.error("[AuthContext] Firebase 초기화 실패:", initError);
        setLoading(false);
        setAuthReady(true);
      }
    }

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 캐시 유저가 있으면 스플래시 없이 바로 렌더링
  // 캐시 없을 때만 최소한의 로딩 표시 (최대 1.5초)
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
        <p className="text-[10px] text-gray-300 mt-4">잠시만 기다려주세요...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, authReady }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
