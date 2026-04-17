// src/lib/firebase.js
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  // ✅ authDomain을 커스텀 도메인으로 설정
  //    기본값(xxx.firebaseapp.com)을 사용하면 signInWithRedirect 시
  //    다른 도메인으로 이동 → iOS Safari ITP/WKWebView에서 sessionStorage 분리
  //    → "missing initial state" 오류 발생
  //    happy500.kr로 설정하면 같은 도메인 내에서 처리되어 정상 작동
  authDomain: 'happy500.kr',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// 필수 환경변수 누락 여부 확인 (시뮬레이터 디버깅용)
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error("[Firebase] ❌ 필수 환경변수 누락:", {
    apiKey: !!firebaseConfig.apiKey,
    projectId: !!firebaseConfig.projectId,
    authDomain: !!firebaseConfig.authDomain,
  });
}

// 중복 초기화 방지 (Capacitor WKWebView 환경에서 발생 가능)
const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
