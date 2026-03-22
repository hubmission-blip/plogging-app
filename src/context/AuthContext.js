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

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}