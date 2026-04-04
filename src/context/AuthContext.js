"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Firebase 로그인 상태 감지
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setLoading(false);
      } else {
        // 카카오 로그인 확인
        const kakaoUser = localStorage.getItem("kakaoUser");
        if (kakaoUser) {
          const parsed = JSON.parse(kakaoUser);
          // Firebase user 형태로 맞춰서 제공
          setUser({
            uid: parsed.uid,
            email: parsed.email,
            displayName: parsed.nickname,
            provider: "kakao",
          });
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-50 flex flex-col items-center justify-center z-[999]">
        <img
          src="https://gyea.kr/wp/wp-content/uploads/2025/12/500_subtitle_c.png"
          alt="오백원의 행복"
          className="h-12 w-auto object-contain mb-6"
        />
        <div className="flex gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
        <p className="text-xs text-gray-400 mt-4">즐거운 플로깅, 깨끗한 지구 🌿</p>
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