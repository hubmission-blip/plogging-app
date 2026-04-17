"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc, increment, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Recycle } from "lucide-react";

// 추천인 코드(8자리)로 추천인 UID 조회
async function resolveReferrer(refCode) {
  if (!refCode || refCode.length < 6) return null;
  const code = refCode.toUpperCase().slice(0, 8);
  // 추천인 코드 = UID 앞 8자리 대문자 → 직접 prefix 검색
  try {
    const q = query(collection(db, "users"), where("refCode", "==", code));
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].data().uid;
    // refCode 필드 없는 구버전 유저: UID로 직접 조회
    const byUid = await getDoc(doc(db, "users", code));
    if (byUid.exists()) return code;
  } catch {}
  return null;
}

export default function RegisterPage() {
  const router = useRouter();

  const [step, setStep] = useState(1); // 1: 기본정보, 2: 완료
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    password: "",
    passwordConfirm: "",
    refInput: "",       // 수동 추천인 코드 입력
    agreeTerms: false,
    agreePrivacy: false,
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [referrerName, setReferrerName] = useState(""); // 추천인 닉네임 (확인용)
  const [bonusPoints, setBonusPoints] = useState(0);    // 추천 보너스 포인트

  // ── 유효성 검사 ──────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!form.displayName.trim() || form.displayName.length < 2)
      e.displayName = "닉네임은 2자 이상 입력해주세요";
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(form.email))
      e.email = "올바른 이메일 형식이 아니에요";
    if (form.password.length < 6)
      e.password = "비밀번호는 6자 이상이어야 해요";
    if (form.password !== form.passwordConfirm)
      e.passwordConfirm = "비밀번호가 일치하지 않아요";
    if (!form.agreeTerms)
      e.agreeTerms = "이용약관에 동의해주세요";
    if (!form.agreePrivacy)
      e.agreePrivacy = "개인정보 처리방침에 동의해주세요";
    return e;
  };

  // ── 회원가입 실행 ────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      // ── 추천인 코드 확인 (localStorage 캐시 or 수동 입력) ──
      let referrerUid = null;
      let refCode = form.refInput.trim().toUpperCase();
      if (!refCode) {
        try {
          const stored = localStorage.getItem("pending_referral");
          if (stored) {
            const { code, expires } = JSON.parse(stored);
            if (Date.now() < expires) refCode = code.toUpperCase().slice(0, 8);
          }
        } catch {}
      }
      if (refCode) referrerUid = await resolveReferrer(refCode);

      // Firebase Auth 계정 생성
      const cred = await createUserWithEmailAndPassword(
        auth,
        form.email,
        form.password
      );

      // 닉네임 설정
      await updateProfile(cred.user, { displayName: form.displayName.trim() });

      const myUid    = cred.user.uid;
      const myRef    = myUid.slice(0, 8).toUpperCase(); // 내 추천 코드
      const BONUS    = referrerUid ? 50 : 0;            // 추천 가입 보너스 +50P
      const welcomeP = 100 + BONUS;

      // Firestore 유저 문서 생성
      await setDoc(doc(db, "users", myUid), {
        uid:           myUid,
        email:         form.email,
        displayName:   form.displayName.trim(),
        photoURL:      "",
        totalPoints:   welcomeP,
        totalDistance: 0,
        ploggingCount: 0,
        createdAt:     serverTimestamp(),
        provider:      "email",
        refCode:       myRef,                          // 내 추천 코드 저장
        ...(referrerUid ? { referredBy: referrerUid } : {}),
      });

      // 추천인에게 보너스 포인트 지급
      if (referrerUid) {
        try {
          await updateDoc(doc(db, "users", referrerUid), {
            totalPoints: increment(100),               // 추천인 +100P
          });
          // 추천인 닉네임 가져와서 완료 화면에 표시
          const rSnap = await getDoc(doc(db, "users", referrerUid));
          if (rSnap.exists()) setReferrerName(rSnap.data().displayName || "");
        } catch {}
        // localStorage 추천 코드 소비
        try { localStorage.removeItem("pending_referral"); } catch {}
        setBonusPoints(BONUS);
      }

      setStep(2); // 완료 화면으로
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setErrors({ email: "이미 사용 중인 이메일이에요" });
      } else {
        setErrors({ general: "회원가입 실패: " + err.message });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  // ─────────────────────────────────────────────────────────
  // 완료 화면
  // ─────────────────────────────────────────────────────────
  if (step === 2) return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-2xl font-black text-green-700 mb-2">환영해요!</h1>
        <p className="text-gray-600 mb-1">
          <span className="font-bold text-green-600">{form.displayName}</span> 님,
        </p>
        <p className="text-gray-500 text-sm mb-2">
          가입 환영 포인트 <span className="font-bold text-orange-500">+100P</span>를 드렸어요! 🌿
        </p>
        {bonusPoints > 0 && (
          <div className="bg-green-50 rounded-2xl px-4 py-3 mb-4 text-sm text-green-700">
            🎁 추천인 보너스 <span className="font-bold">+{bonusPoints}P</span> 추가 지급!
            {referrerName && <span className="block text-xs text-green-500 mt-0.5">({referrerName}님의 추천)</span>}
          </div>
        )}
        <button
          onClick={() => router.push("/map")}
          className="w-full bg-green-500 text-white py-4 rounded-2xl font-bold text-lg mb-3"
        >
          🚶 첫 플로깅 시작하기
        </button>
        <button
          onClick={() => router.push("/")}
          className="w-full text-gray-400 text-sm py-2"
        >
          홈으로 이동
        </button>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────
  // 가입 폼
  // ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-6 w-full max-w-sm">
        {/* 로고 */}
        <div className="text-center mb-6">
          <Recycle className="w-10 h-10 mx-auto mb-1" strokeWidth={1.8} style={{ color: "#6B7F3B" }} />
          <h1 className="text-xl font-black text-green-700">오백원의 행복</h1>
          <p className="text-gray-400 text-sm mt-1">회원가입</p>
        </div>

        {errors.general && (
          <div className="bg-red-50 text-red-600 text-sm rounded-xl p-3 mb-4">
            {errors.general}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 닉네임 */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              닉네임 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => handleChange("displayName", e.target.value)}
              placeholder="2~12자 닉네임"
              maxLength={12}
              className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400
                ${errors.displayName ? "border-red-300" : "border-gray-200"}`}
            />
            {errors.displayName && (
              <p className="text-red-400 text-xs mt-1">{errors.displayName}</p>
            )}
          </div>

          {/* 이메일 */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              이메일 <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="example@email.com"
              className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400
                ${errors.email ? "border-red-300" : "border-gray-200"}`}
            />
            {errors.email && (
              <p className="text-red-400 text-xs mt-1">{errors.email}</p>
            )}
          </div>

          {/* 비밀번호 */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              비밀번호 <span className="text-red-400">*</span>
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => handleChange("password", e.target.value)}
              placeholder="6자 이상"
              className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400
                ${errors.password ? "border-red-300" : "border-gray-200"}`}
            />
            {errors.password && (
              <p className="text-red-400 text-xs mt-1">{errors.password}</p>
            )}
          </div>

          {/* 비밀번호 확인 */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              비밀번호 확인 <span className="text-red-400">*</span>
            </label>
            <input
              type="password"
              value={form.passwordConfirm}
              onChange={(e) => handleChange("passwordConfirm", e.target.value)}
              placeholder="비밀번호 재입력"
              className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400
                ${errors.passwordConfirm ? "border-red-300" : "border-gray-200"}`}
            />
            {errors.passwordConfirm && (
              <p className="text-red-400 text-xs mt-1">{errors.passwordConfirm}</p>
            )}
          </div>

          {/* 추천인 코드 (선택) */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              추천인 코드 <span className="text-gray-300">(선택)</span>
            </label>
            <input
              type="text"
              value={form.refInput}
              onChange={(e) => handleChange("refInput", e.target.value.toUpperCase())}
              placeholder="추천인에게 받은 8자리 코드"
              maxLength={8}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400 tracking-widest font-mono"
            />
            <p className="text-xs text-gray-400 mt-1">링크로 가입하면 자동 적용돼요 · 없으면 비워두세요</p>
          </div>

          {/* 약관 동의 */}
          <div className="space-y-2 pt-1">
            {[
              {
                field: "agreeTerms",
                label: "[필수] 이용약관 동의",
                link: "#",
              },
              {
                field: "agreePrivacy",
                label: "[필수] 개인정보 처리방침 동의",
                link: "#",
              },
            ].map((item) => (
              <label key={item.field} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form[item.field]}
                  onChange={(e) => handleChange(item.field, e.target.checked)}
                  className="w-4 h-4 rounded accent-green-500"
                />
                <span className="text-sm text-gray-600 flex-1">{item.label}</span>
                <a href={item.link} className="text-xs text-gray-400 underline">
                  보기
                </a>
              </label>
            ))}
            {(errors.agreeTerms || errors.agreePrivacy) && (
              <p className="text-red-400 text-xs">
                {errors.agreeTerms || errors.agreePrivacy}
              </p>
            )}
          </div>

          {/* 가입 버튼 */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-500 text-white py-4 rounded-2xl font-bold text-base mt-2 disabled:opacity-60"
          >
            {loading ? "가입 중..." : "회원가입 완료"}
          </button>
        </form>

        <div className="text-center mt-4">
          <span className="text-sm text-gray-400">이미 계정이 있으신가요? </span>
          <Link href="/login" className="text-sm text-green-600 font-medium">
            로그인
          </Link>
        </div>
      </div>
    </div>
  );
}