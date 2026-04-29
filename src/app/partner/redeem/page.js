"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection, query, where, getDocs, doc, getDoc,
  updateDoc, runTransaction, serverTimestamp, orderBy, limit,
} from "firebase/firestore";
import {
  Store, Search, Ticket, CheckCircle2, XCircle,
  ChevronLeft, Coffee, ArrowRight, AlertTriangle,
  Coins, History, QrCode, Camera,
} from "lucide-react";
import QRScanner from "@/components/QRScanner";

export default function PartnerRedeemPage() {
  const { user } = useAuth();
  const router   = useRouter();

  const [storeInfo, setStoreInfo]     = useState(null); // 매장 정보
  const [storeLoading, setStoreLoading] = useState(true);
  const [codeInput, setCodeInput]     = useState("");
  const [searching, setSearching]     = useState(false);
  const [couponInfo, setCouponInfo]   = useState(null); // 조회된 쿠폰
  const [couponError, setCouponError] = useState("");
  const [redeeming, setRedeeming]     = useState(false);
  const [successInfo, setSuccessInfo] = useState(null);
  const [redeemHistory, setRedeemHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  // ── 매장 정보 조회 (로그인된 유저가 파트너 매장인지 확인) ────
  const fetchStoreInfo = useCallback(async () => {
    if (!user) return;
    setStoreLoading(true);
    try {
      const q = query(
        collection(db, "partnerStores"),
        where("ownerUid", "==", user.uid),
        limit(1),
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        setStoreInfo({ id: snap.docs[0].id, ...snap.docs[0].data() });
      }
    } catch (e) {
      console.error("매장 정보 로드 실패:", e);
    } finally {
      setStoreLoading(false);
    }
  }, [user]);

  // ── 사용 이력 조회 ─────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    if (!storeInfo) return;
    try {
      const q = query(
        collection(db, "coupons"),
        where("usedByStore", "==", storeInfo.id),
        orderBy("usedAt", "desc"),
        limit(20),
      );
      const snap = await getDocs(q);
      setRedeemHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("이력 로드 실패:", e);
    }
  }, [storeInfo]);

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    fetchStoreInfo();
  }, [user, fetchStoreInfo, router]);

  useEffect(() => {
    if (storeInfo) fetchHistory();
  }, [storeInfo, fetchHistory]);

  // ── QR 스캔 결과 처리 ──────────────────────────────────────
  const handleQRScan = useCallback((scannedCode) => {
    setShowScanner(false);
    // QR에서 읽은 코드를 입력란에 넣고 자동 조회
    const code = scannedCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
    if (code) {
      setCodeInput(code);
      // 자동 조회 실행
      setTimeout(() => {
        handleSearchWithCode(code);
      }, 300);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 쿠폰 코드 조회 (코드 직접 전달 가능) ──────────────────
  const handleSearchWithCode = async (directCode) => {
    const code = (directCode || codeInput.trim()).toUpperCase();
    if (!code) return;
    setSearching(true);
    setCouponInfo(null);
    setCouponError("");
    try {
      const q = query(
        collection(db, "coupons"),
        where("code", "==", code),
        limit(1),
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        setCouponError("유효하지 않은 쿠폰 코드입니다.");
        return;
      }
      const data = { id: snap.docs[0].id, ...snap.docs[0].data() };
      if (data.status === "used") {
        setCouponError("이미 사용된 쿠폰입니다.");
        return;
      }
      if (data.status === "expired") {
        setCouponError("만료된 쿠폰입니다.");
        return;
      }
      setCouponInfo(data);
    } catch (e) {
      setCouponError("쿠폰 조회 중 오류가 발생했습니다.");
      console.error(e);
    } finally {
      setSearching(false);
    }
  };

  // ── 쿠폰 코드 조회 (기존 버튼용) ─────────────────────────
  const handleSearch = async () => {
    const code = codeInput.trim().toUpperCase();
    if (!code) return;
    setSearching(true);
    setCouponInfo(null);
    setCouponError("");
    try {
      const q = query(
        collection(db, "coupons"),
        where("code", "==", code),
        limit(1),
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        setCouponError("유효하지 않은 쿠폰 코드입니다.");
        return;
      }
      const data = { id: snap.docs[0].id, ...snap.docs[0].data() };
      if (data.status === "used") {
        setCouponError("이미 사용된 쿠폰입니다.");
        return;
      }
      if (data.status === "expired") {
        setCouponError("만료된 쿠폰입니다.");
        return;
      }
      setCouponInfo(data);
    } catch (e) {
      setCouponError("쿠폰 조회 중 오류가 발생했습니다.");
      console.error(e);
    } finally {
      setSearching(false);
    }
  };

  // ── 쿠폰 사용 처리 ────────────────────────────────────────
  const handleRedeem = async () => {
    if (!couponInfo || !storeInfo) return;
    setRedeeming(true);
    try {
      await runTransaction(db, async (tx) => {
        const couponRef = doc(db, "coupons", couponInfo.id);
        const couponSnap = await tx.get(couponRef);
        if (!couponSnap.exists()) throw new Error("쿠폰을 찾을 수 없습니다.");
        if (couponSnap.data().status !== "active") throw new Error("이미 사용된 쿠폰입니다.");

        // 쿠폰 상태 → used
        tx.update(couponRef, {
          status:       "used",
          usedAt:       serverTimestamp(),
          usedByStore:  storeInfo.id,
          usedByStoreName: storeInfo.name,
        });

        // 매장 적립 포인트 증가
        const storeRef = doc(db, "partnerStores", storeInfo.id);
        const storeSnap = await tx.get(storeRef);
        const currentPoints = storeSnap.data()?.accumulatedPoints || 0;
        tx.update(storeRef, {
          accumulatedPoints: currentPoints + (couponInfo.points || 0),
          lastRedeemAt: serverTimestamp(),
        });
      });

      setSuccessInfo({
        code: couponInfo.code,
        title: couponInfo.rewardTitle,
        points: couponInfo.points,
        userName: couponInfo.userName,
      });
      setCouponInfo(null);
      setCodeInput("");
      fetchHistory();
    } catch (e) {
      alert("사용 처리 실패: " + e.message);
    } finally {
      setRedeeming(false);
    }
  };

  const fmt = (ts) => {
    if (!ts) return "-";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  // ── 로딩 ──────────────────────────────────────────────────
  if (storeLoading) return (
    <div className="flex items-center justify-center h-screen">
      <p className="animate-pulse text-lg flex items-center gap-2 text-gray-500">
        <Store className="w-5 h-5 text-emerald-500" strokeWidth={2} /> 매장 정보 확인 중...
      </p>
    </div>
  );

  // ── 파트너 매장이 아닌 경우 ───────────────────────────────
  if (!storeInfo) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
      <div className="bg-white rounded-3xl p-8 shadow-sm text-center max-w-sm w-full">
        <AlertTriangle className="w-16 h-16 text-orange-400 mx-auto mb-4" strokeWidth={1.5} />
        <h2 className="text-lg font-bold text-gray-800 mb-2">파트너 매장 전용 페이지</h2>
        <p className="text-sm text-gray-500 mb-6">
          이 페이지는 등록된 파트너 매장만 이용할 수 있습니다.
          매장 등록은 관리자에게 문의해 주세요.
        </p>
        <button
          onClick={() => router.push("/")}
          className="w-full bg-gray-100 text-gray-600 py-3 rounded-2xl font-bold"
        >
          홈으로 돌아가기
        </button>
      </div>
    </div>
  );

  return (
    <div
      className="min-h-screen bg-gray-50"
      style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom, 20px))" }}
    >
      {/* ── 헤더 ── */}
      <div className="bg-emerald-600 text-white px-4 pt-4 pb-5">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => router.back()}>
            <ChevronLeft className="w-6 h-6 text-white/80" strokeWidth={2} />
          </button>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Store className="w-5 h-5" strokeWidth={2} />
            쿠폰 사용처리
          </h1>
        </div>
        <div className="bg-white/15 rounded-2xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-white/60">파트너 매장</p>
            <p className="text-sm font-bold">{storeInfo.name}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-white/60">누적 적립</p>
            <p className="text-sm font-bold flex items-center gap-1">
              <Coins className="w-4 h-4" strokeWidth={2} />
              {(storeInfo.accumulatedPoints || 0).toLocaleString()} P
            </p>
          </div>
        </div>
      </div>

      {/* ── QR 스캔 버튼 (메인) ── */}
      <div className="px-4 -mt-3">
        <button
          onClick={() => { setShowScanner(true); setCouponError(""); setCouponInfo(null); }}
          className="w-full bg-white rounded-2xl shadow-sm p-5 flex items-center gap-4 active:scale-[0.98] transition-transform mb-3"
        >
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <QrCode className="w-7 h-7 text-emerald-600" strokeWidth={1.8} />
          </div>
          <div className="text-left flex-1">
            <p className="font-bold text-gray-800">QR코드 스캔</p>
            <p className="text-xs text-gray-400 mt-0.5">고객의 쿠폰 QR을 카메라로 스캔합니다</p>
          </div>
          <Camera className="w-5 h-5 text-emerald-500" strokeWidth={2} />
        </button>

        {/* ── 쿠폰 코드 수동 입력 ── */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-sm font-bold text-gray-700 mb-3">또는 쿠폰 코드 직접 입력</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={codeInput}
              onChange={(e) => {
                const v = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
                setCodeInput(v);
              }}
              placeholder="예: A3K7-B9H2-X5M4"
              maxLength={14}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-center text-lg font-bold tracking-widest placeholder:text-sm placeholder:tracking-normal placeholder:font-normal focus:outline-none focus:border-emerald-400"
            />
            <button
              onClick={handleSearch}
              disabled={searching || codeInput.length < 5}
              className="bg-emerald-500 text-white px-5 rounded-xl font-bold disabled:opacity-50 flex items-center gap-1"
            >
              {searching ? "..." : <><Search className="w-4 h-4" strokeWidth={2} /> 조회</>}
            </button>
          </div>
          {couponError && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" strokeWidth={2} />
              <p className="text-sm text-red-600">{couponError}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── QR 스캐너 모달 ── */}
      {showScanner && (
        <QRScanner
          title="고객 쿠폰 QR 스캔"
          onScan={handleQRScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* ── 조회된 쿠폰 정보 ── */}
      {couponInfo && (
        <div className="px-4 mt-4">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-orange-50 p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                <Coffee className="w-6 h-6 text-orange-600" strokeWidth={1.8} />
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-800">{couponInfo.rewardTitle}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  사용자: {couponInfo.userName || "익명"} · {couponInfo.points?.toLocaleString() || 0}P
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
                사용가능
              </span>
            </div>

            <div className="p-4 border-t border-dashed border-gray-200 text-center">
              <p className="text-lg font-black text-gray-800 tracking-widest mb-1">{couponInfo.code}</p>
              <p className="text-xs text-gray-400">위 쿠폰을 사용 처리합니다</p>
            </div>

            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={handleRedeem}
                disabled={redeeming}
                className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {redeeming ? "처리 중..." : (
                  <>
                    <CheckCircle2 className="w-5 h-5" strokeWidth={2} />
                    쿠폰 사용 확인 (+{couponInfo.points?.toLocaleString() || 0}P 적립)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 사용 완료 모달 ── */}
      {successInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] px-6">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-8 h-8 text-green-600" strokeWidth={1.8} />
            </div>
            <h2 className="text-lg font-bold text-gray-800 mb-1">사용 처리 완료!</h2>
            <p className="text-sm text-gray-500 mb-4">{successInfo.title}</p>

            <div className="bg-green-50 rounded-2xl p-4 mb-4">
              <p className="text-sm text-gray-500">매장 적립</p>
              <p className="text-3xl font-black text-green-600">+{successInfo.points?.toLocaleString() || 0} P</p>
              <p className="text-xs text-gray-400 mt-1">고객: {successInfo.userName}</p>
            </div>

            <button
              onClick={() => setSuccessInfo(null)}
              className="w-full bg-emerald-500 text-white py-3.5 rounded-2xl font-bold"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* ── 최근 사용 이력 ── */}
      <div className="px-4 mt-6">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-2 mb-3"
        >
          <History className="w-4 h-4 text-gray-500" strokeWidth={2} />
          <span className="text-sm font-bold text-gray-700">최근 사용처리 이력</span>
          <span className="text-xs text-gray-400">({redeemHistory.length}건)</span>
        </button>

        {showHistory && (
          <div className="space-y-2">
            {redeemHistory.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-6">사용처리 이력이 없습니다</p>
            )}
            {redeemHistory.map((item) => (
              <div key={item.id} className="bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm">
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Ticket className="w-4 h-4 text-gray-400" strokeWidth={1.8} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{item.rewardTitle}</p>
                  <p className="text-xs text-gray-400">{item.userName} · {item.code}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-600">+{item.points?.toLocaleString() || 0}P</p>
                  <p className="text-xs text-gray-400">{fmt(item.usedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
