"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection, query, where, orderBy, getDocs,
} from "firebase/firestore";
import {
  Ticket, Coffee, Copy, Check, ChevronLeft,
  CheckCircle2, XCircle, Store,
} from "lucide-react";
import { generateQRDataURL } from "@/lib/qrcode";

// ─── 상태별 스타일 ─────────────────────────────────────────
const STATUS_MAP = {
  active:  { label: "사용가능", color: "bg-green-100 text-green-700", Icon: Ticket },
  used:    { label: "사용완료", color: "bg-gray-100 text-gray-500",   Icon: CheckCircle2 },
  expired: { label: "기간만료", color: "bg-red-100 text-red-500",     Icon: XCircle },
};

export default function CouponPage() {
  const { user } = useAuth();
  const router   = useRouter();

  const [coupons, setCoupons]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState("active"); // active | used
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [copied, setCopied]         = useState(false);
  const [qrDataURL, setQrDataURL]   = useState(null);

  // ── 쿠폰 목록 불러오기 ────────────────────────────────────
  const fetchCoupons = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "coupons"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc"),
      );
      const snap = await getDocs(q);
      setCoupons(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("쿠폰 로드 실패:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    fetchCoupons();
  }, [user, fetchCoupons, router]);

  const activeCoupons = coupons.filter((c) => c.status === "active");
  const usedCoupons   = coupons.filter((c) => c.status !== "active");
  const displayed     = tab === "active" ? activeCoupons : usedCoupons;

  const handleCopy = (code) => {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── 날짜 포맷 ─────────────────────────────────────────────
  const fmt = (ts) => {
    if (!ts) return "-";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <p className="animate-pulse text-lg flex items-center gap-2 text-gray-500">
        <Ticket className="w-5 h-5 text-orange-500" strokeWidth={2} /> 쿠폰 불러오는 중...
      </p>
    </div>
  );

  return (
    <div
      className="min-h-screen bg-gray-50"
      style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom, 20px))" }}
    >
      {/* ── 헤더 ── */}
      <div className="bg-white px-4 pt-4 pb-3 flex items-center gap-3 border-b">
        <button onClick={() => router.back()}>
          <ChevronLeft className="w-6 h-6 text-gray-600" strokeWidth={2} />
        </button>
        <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Ticket className="w-5 h-5 text-orange-500" strokeWidth={2} />
          내 쿠폰함
        </h1>
        <span className="ml-auto text-sm font-bold text-orange-500">
          {activeCoupons.length}장
        </span>
      </div>

      {/* ── 탭 ── */}
      <div className="flex bg-white border-b">
        {[
          { id: "active", label: `사용가능 (${activeCoupons.length})` },
          { id: "used",   label: `사용완료 (${usedCoupons.length})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors
              ${tab === t.id ? "border-orange-500 text-orange-600" : "border-transparent text-gray-400"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 쿠폰 목록 ── */}
      <div className="px-4 py-4 space-y-3">
        {displayed.length === 0 && (
          <div className="text-center py-16">
            <Ticket className="w-12 h-12 text-gray-200 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-gray-400 text-sm">
              {tab === "active" ? "사용 가능한 쿠폰이 없습니다" : "사용 완료된 쿠폰이 없습니다"}
            </p>
            {tab === "active" && (
              <Link href="/reward" className="text-sm text-purple-500 font-medium mt-2 inline-block">
                리워드에서 쿠폰 교환하기 →
              </Link>
            )}
          </div>
        )}

        {displayed.map((coupon) => {
          const st = STATUS_MAP[coupon.status] || STATUS_MAP.active;
          return (
            <button
              key={coupon.id}
              onClick={async () => {
                setSelectedCoupon(coupon);
                if (coupon.status === "active") {
                  try {
                    const url = await generateQRDataURL(coupon.code, 280);
                    setQrDataURL(url);
                  } catch (e) { console.error("QR 생성 실패:", e); }
                } else {
                  setQrDataURL(null);
                }
              }}
              className="w-full bg-white rounded-2xl shadow-sm overflow-hidden text-left active:scale-[0.98] transition-transform"
            >
              {/* 쿠폰 상단 */}
              <div className="p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <Coffee className="w-6 h-6 text-orange-600" strokeWidth={1.8} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 text-sm truncate">{coupon.rewardTitle}</p>
                  <p className="text-xs text-gray-400 mt-0.5">발급일: {fmt(coupon.createdAt)}</p>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${st.color}`}>
                  {st.label}
                </span>
              </div>

              {/* 쿠폰 코드 영역 (점선 구분) */}
              <div className="border-t-2 border-dashed border-gray-100 px-4 py-3 flex items-center justify-between bg-gray-50/50">
                <div>
                  <p className="text-[10px] text-gray-400">쿠폰 코드</p>
                  <p className="text-base font-black text-gray-700 tracking-wider">{coupon.code}</p>
                </div>
                {coupon.status === "active" && (
                  <div className="flex items-center gap-1 text-orange-500">
                    <Copy className="w-4 h-4" strokeWidth={2} />
                    <span className="text-xs font-medium">복사</span>
                  </div>
                )}
                {coupon.status === "used" && coupon.usedByStore && (
                  <div className="flex items-center gap-1 text-gray-400">
                    <Store className="w-4 h-4" strokeWidth={1.8} />
                    <span className="text-xs">{fmt(coupon.usedAt)}</span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── 쿠폰 상세 모달 ── */}
      {selectedCoupon && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] px-6"
          onClick={() => { setSelectedCoupon(null); setCopied(false); setQrDataURL(null); }}>
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center"
            onClick={(e) => e.stopPropagation()}>

            <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-3">
              <Coffee className="w-8 h-8 text-orange-600" strokeWidth={1.8} />
            </div>
            <h2 className="text-lg font-bold text-gray-800 mb-1">{selectedCoupon.rewardTitle}</h2>
            <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full mb-4 ${(STATUS_MAP[selectedCoupon.status] || STATUS_MAP.active).color}`}>
              {(STATUS_MAP[selectedCoupon.status] || STATUS_MAP.active).label}
            </span>

            {/* QR코드 + 교환코드 통합 영역 */}
            {selectedCoupon.status === "active" && qrDataURL ? (
              <div className="bg-white rounded-2xl p-5 mb-4 border-2 border-orange-200">
                <p className="text-[10px] text-orange-500 font-bold mb-3">매장 직원에게 이 화면을 보여주세요</p>
                <img src={qrDataURL} alt="QR코드" className="w-52 h-52 mx-auto mb-4" />
                <p className="text-2xl font-black text-gray-800 tracking-[0.15em]">{selectedCoupon.code}</p>
                <button
                  onClick={() => handleCopy(selectedCoupon.code)}
                  className="mt-2 text-xs text-gray-400 flex items-center justify-center gap-1"
                >
                  {copied
                    ? <><Check className="w-3 h-3" strokeWidth={2} /> 복사됨</>
                    : <><Copy className="w-3 h-3" strokeWidth={2} /> 코드 복사</>
                  }
                </button>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-2xl p-5 mb-4 border-2 border-dashed border-gray-300">
                <p className="text-[10px] text-gray-400 mb-2">쿠폰 코드</p>
                <p className="text-2xl font-black text-gray-800 tracking-[0.15em]">{selectedCoupon.code}</p>
              </div>
            )}

            {/* 상세 정보 */}
            <div className="text-left space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">포인트</span>
                <span className="font-bold text-gray-700">{selectedCoupon.points?.toLocaleString() || "0"} P</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">발급일</span>
                <span className="text-gray-700">{fmt(selectedCoupon.createdAt)}</span>
              </div>
              {selectedCoupon.usedAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">사용일</span>
                  <span className="text-gray-700">{fmt(selectedCoupon.usedAt)}</span>
                </div>
              )}
              {selectedCoupon.expiresAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">만료일</span>
                  <span className="text-gray-700">{fmt(selectedCoupon.expiresAt)}</span>
                </div>
              )}
            </div>
            <button
              onClick={() => { setSelectedCoupon(null); setCopied(false); setQrDataURL(null); }}
              className="w-full bg-gray-100 text-gray-600 py-3 rounded-2xl font-bold"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
