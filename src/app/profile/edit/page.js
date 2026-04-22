"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc, updateDoc, collection, query, where, getDocs, increment } from "firebase/firestore";
import { updateProfile } from "firebase/auth";

// ─── 추천인 코드로 추천인 UID 조회 ───────────────────────────
async function resolveReferrer(refCode) {
  if (!refCode || refCode.length < 6) return null;
  const code = refCode.toUpperCase().slice(0, 8);
  try {
    const q = query(collection(db, "users"), where("refCode", "==", code));
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].data().uid;
    const byUid = await getDoc(doc(db, "users", code));
    if (byUid.exists()) return code;
  } catch {}
  return null;
}
import Link from "next/link";

const REGIONS = [
  "서울", "인천", "경기", "강원",
  "대전", "세종", "충북", "충남",
  "광주", "전북", "전남",
  "부산", "대구", "울산", "경북", "경남", "제주",
];

export default function ProfileEditPage() {
  const { user } = useAuth();
  const router   = useRouter();

  const [form, setForm] = useState({
    displayName:  "",
    phone:        "",
    region:       "",
    volunteerNo:  "", // 1365 회원번호
    bio:          "",
    refInput:     "", // 추천인 코드 (1회 입력용)
  });
  const [loading, setSaving] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [errors, setErrors]   = useState({});
  const [successMsg, setSuccessMsg] = useState("");
  // 추천인 관련 상태
  const [alreadyReferred, setAlreadyReferred] = useState(false); // 이미 추천인 등록됨
  const [myRefCode, setMyRefCode] = useState(""); // 내 추천 코드

  // ── 기존 데이터 불러오기 ─────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!user) return;
    setFetching(true);
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const d = snap.data();
        setForm({
          displayName: d.displayName || user.displayName || "",
          phone:       d.phone       || "",
          region:      d.region      || "",
          volunteerNo: d.volunteerNo || "",
          bio:         d.bio         || "",
          refInput:    "",
        });
        // 추천인 이미 등록됐으면 입력 불가
        setAlreadyReferred(!!d.referredBy);
        const computedRefCode = user.uid.slice(0, 8).toUpperCase();
        setMyRefCode(computedRefCode);
        // refCode 필드 없는 구버전 유저면 Firestore에 저장 (추천 검색 가능하도록)
        if (!d.refCode) {
          try {
            await updateDoc(doc(db, "users", user.uid), { refCode: computedRefCode });
          } catch {}
        }
      }
    } catch (e) {
      console.error("프로필 로드 실패:", e);
    } finally {
      setFetching(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    fetchData();
  }, [user, fetchData, router]);

  // ── 유효성 검사 ─────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!form.displayName.trim() || form.displayName.trim().length < 2)
      e.displayName = "닉네임은 2자 이상 입력해주세요";
    if (form.volunteerNo && !/^\d{6,12}$/.test(form.volunteerNo.trim()))
      e.volunteerNo = "1365 회원번호는 6~12자리 숫자입니다";
    if (form.phone && !/^010-?\d{4}-?\d{4}$/.test(form.phone.replace(/-/g, "").replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3")))
      e.phone = "올바른 휴대폰 번호를 입력해주세요 (예: 010-1234-5678)";
    return e;
  };

  // ── 저장 ─────────────────────────────────────────────────
  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setErrors({});
    setSaving(true);
    try {
      const updates = {
        displayName: form.displayName.trim(),
        phone:       form.phone.trim(),
        region:      form.region,
        volunteerNo: form.volunteerNo.trim(),
        bio:         form.bio.trim(),
      };

      // ── 추천인 코드 처리 (미등록 상태에서 1회만) ───────────
      if (!alreadyReferred && form.refInput.trim()) {
        const refCode = form.refInput.trim().toUpperCase();
        // 자기 자신 코드 방지
        if (refCode === myRefCode) {
          setErrors({ refInput: "내 추천 코드는 사용할 수 없어요" });
          setSaving(false);
          return;
        }
        const referrerUid = await resolveReferrer(refCode);
        if (referrerUid) {
          updates.referredBy = referrerUid;
          updates.totalPoints = (updates.totalPoints || 0); // increment separately
          // 내 포인트 +50P 추가
          await updateDoc(doc(db, "users", user.uid), {
            ...updates,
            totalPoints: increment(50),
          });
          // 추천인 +100P
          try {
            await updateDoc(doc(db, "users", referrerUid), { totalPoints: increment(100) });
          } catch {}
          setAlreadyReferred(true);
          setSuccessMsg("✅ 추천인 등록 완료! +50P가 지급됐어요!");
          setTimeout(() => { setSuccessMsg(""); router.push("/profile"); }, 2000);
          return; // 이미 저장 완료
        } else {
          setErrors({ refInput: "유효하지 않은 추천 코드예요" });
          setSaving(false);
          return;
        }
      }

      // Firestore 업데이트
      await updateDoc(doc(db, "users", user.uid), updates);
      // Firebase Auth displayName 동기화
      if (auth.currentUser && form.displayName.trim()) {
        await updateProfile(auth.currentUser, { displayName: form.displayName.trim() });
      }
      setSuccessMsg("✅ 내 정보가 저장됐어요!");
      setTimeout(() => { setSuccessMsg(""); router.push("/profile"); }, 1500);
    } catch (err) {
      alert("저장 실패: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const set = (key, val) => {
    setForm((p) => ({ ...p, [key]: val }));
    setErrors((p) => ({ ...p, [key]: undefined }));
  };

  if (fetching) return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <p className="text-lg animate-pulse">🌿 불러오는 중...</p>
    </div>
  );

  return (
    <div
      className="min-h-screen bg-gray-50"
      style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom, 20px))" }}
    >
      {/* ── 헤더 ── */}
      <div className="bg-gray-50 px-4 pt-4 pb-1 flex justify-between items-center">
        <Link href="/">
          <img
            src="https://res.cloudinary.com/dqlvm572h/image/upload/w_200,q_auto,f_auto/Intro_Logo_fuj1kt.png"
            alt="오백원의 행복"
            className="h-9 w-auto object-contain"
          />
        </Link>
        <p className="text-sm font-black text-gray-700">✏️ 내정보 수정</p>
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* 성공 메시지 */}
        {successMsg && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 text-center">
            <p className="text-green-700 font-bold text-sm">{successMsg}</p>
          </div>
        )}

        {/* ── 기본 정보 카드 ── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <span className="text-base">👤</span>
            <p className="font-black text-gray-700 text-sm">기본 정보</p>
          </div>
          <div className="px-4 py-4 space-y-4">

            {/* 닉네임 */}
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1.5 block">
                닉네임 <span className="text-red-400">*</span>
              </label>
              <input
                value={form.displayName}
                onChange={(e) => set("displayName", e.target.value)}
                maxLength={12}
                placeholder="2~12자 닉네임"
                className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400
                  ${errors.displayName ? "border-red-300 bg-red-50" : "border-gray-200"}`}
              />
              {errors.displayName && (
                <p className="text-red-400 text-xs mt-1">{errors.displayName}</p>
              )}
              <p className="text-gray-400 text-xs mt-1">모든 페이지에 표시되는 이름이에요</p>
            </div>

            {/* 휴대폰 번호 */}
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1.5 block">
                휴대폰 번호
              </label>
              <input
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="010-1234-5678"
                maxLength={13}
                className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400
                  ${errors.phone ? "border-red-300 bg-red-50" : "border-gray-200"}`}
              />
              {errors.phone && (
                <p className="text-red-400 text-xs mt-1">{errors.phone}</p>
              )}
            </div>

            {/* 활동 지역 */}
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1.5 block">
                주요 활동 지역
              </label>
              <select
                value={form.region}
                onChange={(e) => set("region", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400 bg-white"
              >
                <option value="">지역 선택</option>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* 한 줄 소개 */}
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1.5 block">
                한 줄 소개
              </label>
              <input
                value={form.bio}
                onChange={(e) => set("bio", e.target.value)}
                maxLength={30}
                placeholder="나를 한 줄로 소개해보세요 (선택)"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400"
              />
              <p className="text-gray-400 text-xs mt-1 text-right">{form.bio.length}/30</p>
            </div>

          </div>
        </div>

        {/* ── 1365 봉사활동 정보 카드 ── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <span className="text-base">🤝</span>
            <p className="font-black text-gray-700 text-sm">1365 자원봉사 연동</p>
          </div>
          <div className="px-4 py-4 space-y-4">

            {/* 안내 배너 */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
              <p className="text-blue-700 text-xs font-bold mb-1">📋 1365 자원봉사포털이란?</p>
              <p className="text-blue-600 text-xs leading-relaxed">
                행정안전부 운영 봉사활동 관리 시스템입니다.
                플로깅 활동을 봉사시간으로 인정받으려면
                1365 회원번호를 등록해주세요.
              </p>
            </div>

            {/* 1365 회원번호 */}
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1.5 block">
                1365 회원번호
              </label>
              <input
                value={form.volunteerNo}
                onChange={(e) => set("volunteerNo", e.target.value.replace(/\D/g, ""))}
                placeholder="숫자만 입력 (예: 12345678)"
                maxLength={12}
                className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400
                  ${errors.volunteerNo ? "border-red-300 bg-red-50" : "border-gray-200"}`}
              />
              {errors.volunteerNo && (
                <p className="text-red-400 text-xs mt-1">{errors.volunteerNo}</p>
              )}
              <p className="text-gray-400 text-xs mt-1">
                1365 포털(
                <a
                  href="https://www.1365.go.kr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 underline"
                >
                  www.1365.go.kr
                </a>
                )에서 확인할 수 있어요
              </p>
            </div>

            {form.volunteerNo ? (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="text-green-700 text-xs font-bold">1365 회원번호 등록됨</p>
                  <p className="text-green-600 text-xs">번호: {form.volunteerNo}</p>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="text-2xl">⬜</span>
                <div>
                  <p className="text-gray-500 text-xs font-bold">1365 미연동</p>
                  <p className="text-gray-400 text-xs">회원번호를 등록하면 봉사시간 신청이 가능해요</p>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ── 추천인 코드 카드 ── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <span className="text-base">🎁</span>
            <p className="font-black text-gray-700 text-sm">추천인 코드</p>
          </div>
          <div className="px-4 py-4 space-y-3">

            {/* 내 추천 코드 표시 */}
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-green-700 text-xs font-bold mb-0.5">내 추천 코드</p>
                <p className="text-green-800 font-mono font-black text-base tracking-widest">{myRefCode}</p>
              </div>
              <span className="text-green-400 text-xs">친구에게 공유하세요</span>
            </div>

            {/* 추천인 코드 입력 (미등록 시 1회만) */}
            {alreadyReferred ? (
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="text-xl">✅</span>
                <div>
                  <p className="text-gray-600 text-xs font-bold">추천인이 이미 등록되어 있어요</p>
                  <p className="text-gray-400 text-xs">추천인 코드는 1회만 등록할 수 있어요</p>
                </div>
              </div>
            ) : (
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">
                  추천인 코드 입력 <span className="text-gray-400 font-normal">(1회만 가능)</span>
                </label>
                <input
                  value={form.refInput}
                  onChange={(e) => set("refInput", e.target.value.toUpperCase())}
                  placeholder="8자리 추천 코드"
                  maxLength={8}
                  className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400 tracking-widest font-mono
                    ${errors.refInput ? "border-red-300 bg-red-50" : "border-gray-200"}`}
                />
                {errors.refInput && (
                  <p className="text-red-400 text-xs mt-1">{errors.refInput}</p>
                )}
                <p className="text-gray-400 text-xs mt-1">등록 시 나에게 +50P, 추천인에게 +100P가 지급돼요</p>
              </div>
            )}
          </div>
        </div>

        {/* ── 저장 버튼 ── */}
        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full bg-gradient-to-r from-green-500 to-teal-500 text-white py-4 rounded-2xl font-black text-base shadow-md active:scale-95 transition-transform disabled:opacity-60"
        >
          {loading ? "저장 중..." : "💾 저장하기"}
        </button>

        {/* ── 취소 버튼 ── */}
        <Link href="/profile">
          <button className="w-full bg-gray-100 text-gray-500 py-3 rounded-2xl font-medium text-sm active:bg-gray-200">
            취소
          </button>
        </Link>

      </div>
    </div>
  );
}
