"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

export default function KakaoCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      handleKakaoLogin(code);
    } else {
      router.push("/login");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKakaoLogin = async (code) => {
    try {
      // 서버 API 라우트를 통해 토큰 교환
      const res = await fetch("/api/kakao-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          redirectUri: `${window.location.origin}/auth/kakao`,
        }),
      });
      const kakaoUser = await res.json();

      if (kakaoUser.error) {
        console.error("카카오 오류:", kakaoUser.error);
        router.push("/login");
        return;
      }

      // Firestore에 유저 정보 저장
      const userRef = doc(db, "kakaoUsers", kakaoUser.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: kakaoUser.uid,
          email: kakaoUser.email,
          nickname: kakaoUser.nickname,
          provider: "kakao",
          totalPoints: 0,
          totalDistance: 0,
          ploggingCount: 0,
          createdAt: serverTimestamp(),
        });
      }

      // 세션 저장
      localStorage.setItem(
        "kakaoUser",
        JSON.stringify({
          uid: kakaoUser.uid,
          email: kakaoUser.email,
          nickname: kakaoUser.nickname,
        })
      );
      router.push("/");
    } catch (e) {
      console.error("카카오 로그인 실패:", e);
      router.push("/login");
    }
  };

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="text-4xl mb-3 animate-bounce">🟡</div>
        <p className="text-gray-600">카카오 로그인 처리 중...</p>
      </div>
    </div>
  );
}
```

---

## 🔧 수정 3: Firestore 보안규칙 업데이트

**[console.firebase.google.com](https://console.firebase.google.com)** →
```
Firestore → 규칙
```

아래로 교체 후 **게시**:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 일반 유저 (Firebase Auth)
    match /users/{userId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    // 카카오 유저 (별도 컬렉션)
    match /kakaoUsers/{userId} {
      allow read: if true;
      allow write: if true;
    }
    // 플로깅 동선
    match /routes/{routeId} {
      allow read: if true;
      allow write: if true;
    }
  }
}