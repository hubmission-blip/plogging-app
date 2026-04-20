// ─── 탈퇴 계정 관리 유틸리티 ─────────────────────────────────
// 탈퇴 시 이메일 해시를 저장하고, 재가입 시 확인하여 환영 포인트 어뷰징 방지
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// SHA-256 해시 생성 (Web Crypto API)
async function hashEmail(email) {
  const normalized = email.trim().toLowerCase();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized + "_plogging_salt_v1");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// 탈퇴 시: 이메일 해시를 Firestore에 저장
export async function markAccountDeleted(email) {
  if (!email) return;
  try {
    const hash = await hashEmail(email);
    await setDoc(doc(db, "deletedAccounts", hash), {
      deletedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.warn("탈퇴 계정 기록 실패:", e);
  }
}

// 가입 시: 이전 탈퇴 이력 확인 → true면 재가입자
export async function isReturningUser(email) {
  if (!email) return false;
  try {
    const hash = await hashEmail(email);
    const snap = await getDoc(doc(db, "deletedAccounts", hash));
    return snap.exists();
  } catch (e) {
    console.warn("탈퇴 이력 확인 실패:", e);
    return false;
  }
}

// 환영 포인트 계산: 재가입자는 0P, 신규는 기본 100P
export async function getWelcomePoints(email, basePoints = 100) {
  const returning = await isReturningUser(email);
  return returning ? 0 : basePoints;
}
