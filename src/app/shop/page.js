"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection, query, where, onSnapshot, orderBy,
  addDoc, serverTimestamp,
} from "firebase/firestore";

// ─── 기본 상품 (Firestore 미등록 시 표시) ───────────────────
const DEFAULT_PRODUCTS = [
  {
    id: "d1", category: "물·음료", active: true, order: 1,
    title: "무라벨 생수 2L × 20병",
    brand: "아이시스 ECO",
    desc: "플라스틱 라벨 없는 친환경 생수. 분리수거가 쉬워요.",
    price: 13900,
    originalPrice: 17900,
    image: "https://gyea.kr/wp/wp-content/uploads/2025/12/eco-water.png",
    link: "https://www.coupang.com/np/search?q=%EB%AC%B4%EB%9D%BC%EB%B2%A8+%EC%83%9D%EC%88%98",
    bonusPoints: 50,
    tag: "친환경",
    platform: "coupang",
  },
  {
    id: "d2", category: "텀블러·컵", active: true, order: 2,
    title: "스탠리 퀜처 텀블러 1.18L",
    brand: "STANLEY",
    desc: "일회용 컵을 줄이는 대용량 텀블러. 플로깅할 때 딱 좋아요.",
    price: 49000,
    originalPrice: 65000,
    image: "https://gyea.kr/wp/wp-content/uploads/2025/12/tumbler.png",
    link: "https://www.coupang.com/np/search?q=%EC%8A%A4%ED%83%A0%EB%A6%AC+%ED%80%B8%EC%B2%98+%ED%85%80%EB%B8%94%EB%9F%AC",
    bonusPoints: 100,
    tag: "베스트",
    platform: "coupang",
  },
  {
    id: "d3", category: "플로깅용품", active: true, order: 3,
    title: "집게형 쓰레기 집게 2개 세트",
    brand: "클린피커",
    desc: "플로깅 필수템! 허리 굽히지 않고 편하게 줍는 집게.",
    price: 8900,
    originalPrice: 12000,
    image: "https://gyea.kr/wp/wp-content/uploads/2025/12/picker.png",
    link: "https://www.coupang.com/np/search?q=%EC%93%B0%EB%A0%88%EA%B8%B0+%EC%A7%91%EA%B2%8C+%ED%94%8C%EB%A1%9C%EA%B9%85",
    bonusPoints: 30,
    tag: "필수템",
    platform: "coupang",
  },
  {
    id: "d4", category: "에코백·가방", active: true, order: 4,
    title: "RPET 재생 에코백",
    brand: "그린어스",
    desc: "페트병을 재활용해 만든 에코백. 가볍고 튼튼해요.",
    price: 7500,
    originalPrice: 10000,
    image: "https://gyea.kr/wp/wp-content/uploads/2025/12/ecobag.png",
    link: "https://www.coupang.com/np/search?q=RPET+%EC%97%90%EC%BD%94%EB%B0%B1",
    bonusPoints: 30,
    tag: "NEW",
    platform: "coupang",
  },
  {
    id: "d5", category: "플로깅용품", active: true, order: 5,
    title: "생분해 쓰레기봉투 50매",
    brand: "에코봉투",
    desc: "옥수수 전분으로 만든 자연 분해 봉투. 플로깅 시 꼭 필요해요.",
    price: 6900,
    originalPrice: 9900,
    image: "https://gyea.kr/wp/wp-content/uploads/2025/12/ecobag2.png",
    link: "https://www.coupang.com/np/search?q=%EC%83%9D%EB%B6%84%ED%95%B4+%EC%93%B0%EB%A0%88%EA%B8%B0%EB%B4%89%ED%88%AC",
    bonusPoints: 30,
    tag: "친환경",
    platform: "coupang",
  },
  {
    id: "d6", category: "텀블러·컵", active: true, order: 6,
    title: "대나무 칫솔 4개 세트",
    brand: "bamboo",
    desc: "플라스틱 없는 대나무 칫솔. 사용 후 퇴비로 가능해요.",
    price: 5900,
    originalPrice: 8500,
    image: "https://gyea.kr/wp/wp-content/uploads/2025/12/bamboo.png",
    link: "https://www.coupang.com/np/search?q=%EB%8C%80%EB%82%98%EB%AC%B4+%EC%B9%AB%EC%86%94",
    bonusPoints: 20,
    tag: "친환경",
    platform: "coupang",
  },
  {
    id: "d7", category: "물·음료", active: true, order: 7,
    title: "이온음료 포카리스웨트 340ml × 24캔",
    brand: "동아오츠카",
    desc: "플로깅 후 전해질 보충. 운동 후 빠른 수분 회복.",
    price: 19800,
    originalPrice: 24000,
    image: "https://gyea.kr/wp/wp-content/uploads/2025/12/pocari.png",
    link: "https://www.coupang.com/np/search?q=%ED%8F%AC%EC%B9%B4%EB%A6%AC%EC%8A%A4%EC%9B%A8%ED%8A%B8+%EC%BA%94",
    bonusPoints: 40,
    tag: "추천",
    platform: "coupang",
  },
  {
    id: "d8", category: "에코백·가방", active: true, order: 8,
    title: "경량 러닝 조끼형 배낭",
    brand: "네이처하이크",
    desc: "플로깅·러닝 전용 가벼운 배낭. 물통 포켓 내장.",
    price: 24900,
    originalPrice: 35000,
    image: "https://gyea.kr/wp/wp-content/uploads/2025/12/bag.png",
    link: "https://www.coupang.com/np/search?q=%EB%9F%AC%EB%8B%9D+%EC%A1%B0%EB%81%BC%ED%98%95+%EB%B0%B0%EB%82%AD",
    bonusPoints: 80,
    tag: "베스트",
    platform: "coupang",
  },
];

const CATEGORIES = ["전체", "물·음료", "텀블러·컵", "플로깅용품", "에코백·가방"];

const PLATFORM_LABEL = {
  coupang:  { label: "쿠팡",    color: "bg-red-500",    icon: "🛍️" },
  elevenst: { label: "11번가",  color: "bg-orange-500", icon: "1️⃣" },
  naver:    { label: "네이버",  color: "bg-green-500",  icon: "🛒" },
  direct:   { label: "직접구매", color: "bg-blue-500",  icon: "🌐" },
};

// ─── 할인율 계산 ─────────────────────────────────────────────
function discountPct(price, original) {
  if (!original || original <= price) return 0;
  return Math.round(((original - price) / original) * 100);
}

// ─── 구매 확인 바텀시트 ──────────────────────────────────────
function PurchaseSheet({ product, onConfirm, onClose }) {
  const [loading,   setLoading]   = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const plt = PLATFORM_LABEL[product.platform] || PLATFORM_LABEL.coupang;

  const handleConfirm = async () => {
    if (loading || confirmed) return;
    setLoading(true);
    try {
      const success = await onConfirm(product);
      if (success) {
        setConfirmed(true);
        setTimeout(onClose, 2500); // 2.5초 후 자동 닫힘
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      {/* 딤 배경 */}
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full bg-white rounded-t-3xl shadow-2xl p-5"
        style={{ paddingBottom: "calc(1.5rem + 4rem + env(safe-area-inset-bottom, 20px))" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 핸들 */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

        {!confirmed ? (
          <>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">🛒</span>
              <div>
                <p className="font-bold text-gray-800 text-sm leading-tight">{product.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{plt.icon} {plt.label} 링크가 열렸어요</p>
              </div>
            </div>

            <div className="bg-orange-50 rounded-2xl p-3 mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-700 font-bold">구매 완료 시 보너스 포인트</p>
                <p className="text-[11px] text-orange-500 mt-0.5">관리자 검토 후 1~3일 내 지급</p>
              </div>
              <p className="text-base font-black text-orange-600">+{product.bonusPoints}P</p>
            </div>

            {/* 안내 문구 */}
            <div className="bg-blue-50 rounded-xl px-3 py-2 mb-4 flex items-start gap-2">
              <span className="text-base mt-0.5">ℹ️</span>
              <p className="text-[11px] text-blue-600 leading-relaxed">
                쿠팡에서 구매를 완료하셨나요? 아래 버튼을 누르면 구매 내역이 관리자에게 전달돼요.
                쿠팡 파트너스 정산 확인 후 포인트가 지급됩니다.
              </p>
            </div>

            <button
              onClick={handleConfirm}
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-400 to-orange-500 text-white py-3.5 rounded-2xl text-sm font-bold mb-2 active:scale-95 transition-transform"
            >
              {loading ? "신청 중…" : `✅ 구매했어요! (포인트 신청)`}
            </button>
            <button
              onClick={onClose}
              className="w-full py-3 text-gray-400 text-sm font-medium"
            >
              아직 구매 안 했어요
            </button>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-4xl mb-2">📋</p>
            <p className="font-bold text-blue-600 text-base">포인트 지급 신청 완료!</p>
            <p className="text-xs text-gray-500 mt-1">관리자 검토 후 <span className="font-bold text-orange-500">+{product.bonusPoints}P</span> 지급 예정</p>
            <p className="text-xs text-gray-400 mt-0.5">통상 1~3일 소요됩니다</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 상품 상세 팝업 ─────────────────────────────────────────
function ProductDetailSheet({ product, onBuy, onClose }) {
  const pct = discountPct(product.price, product.originalPrice);
  const plt = PLATFORM_LABEL[product.platform] || PLATFORM_LABEL.coupang;

  return (
    <div className="fixed inset-0 z-[60] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full bg-white rounded-t-3xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: "80vh", paddingBottom: "4rem" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 핸들 */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-2 mb-1 flex-shrink-0" />

        <div className="overflow-y-auto flex-1 min-h-0">
          {/* 이미지 — 원본 비율 유지, 크게 */}
          <div className="relative bg-gray-50 w-full flex items-center justify-center overflow-hidden">
            <img
              src={product.image}
              alt={product.title}
              className="w-full object-contain"
              style={{ maxHeight: "320px" }}
              onError={(e) => {
                e.target.style.display = "none";
                e.target.nextSibling.style.display = "flex";
              }}
            />
            <div className="hidden absolute inset-0 items-center justify-center text-6xl bg-gray-100">
              🛒
            </div>
            {/* 플랫폼 뱃지 */}
            <span className={`absolute top-3 right-3 text-xs font-bold px-2.5 py-1 rounded-full text-white ${plt.color}`}>
              {plt.icon} {plt.label}
            </span>
            {/* 할인율 */}
            {pct > 0 && (
              <span className="absolute bottom-3 right-3 bg-red-500 text-white text-sm font-black px-2 py-1 rounded-xl">
                {pct}% OFF
              </span>
            )}
          </div>

          {/* 상품 정보 */}
          <div className="px-5 pt-4 pb-3">
            <p className="text-xs text-gray-400 font-medium">{product.brand}</p>
            <p className="text-lg font-bold text-gray-800 leading-snug mt-1">{product.title}</p>
            <p className="text-sm text-gray-500 leading-relaxed mt-2">{product.desc}</p>

            {/* 가격 + 보너스 포인트 (한 줄) */}
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-gray-900">{product.price.toLocaleString()}원</span>
                {product.originalPrice > product.price && (
                  <span className="text-sm text-gray-400 line-through">{product.originalPrice.toLocaleString()}원</span>
                )}
              </div>
              {/* 보너스 포인트 뱃지 */}
              <div className="rounded-xl px-3 py-1.5 flex flex-col items-center flex-shrink-0" style={{ backgroundColor: "#CD5C5C15" }}>
                <span className="text-[10px]" style={{ color: "#CD5C5C" }}>🎁 구매 시 보너스</span>
                <span className="text-sm font-black" style={{ color: "#CD5C5C" }}>+{product.bonusPoints}P</span>
              </div>
            </div>

            {/* 키워드 태그 */}
            {product.tag && (
              <div className="rounded-xl px-3 py-2 mt-3 text-center" style={{ backgroundColor: "#8dc63f18" }}>
                <span className="text-xs font-bold" style={{ color: "#8dc63f" }}>{product.tag}</span>
              </div>
            )}
          </div>
        </div>

        {/* 하단 고정 버튼 — 하단 네비 바로 위 */}
        <div className="absolute left-0 right-0 px-5 pt-2 pb-3 bg-white border-t border-gray-100"
          style={{ bottom: "0" }}>
          <button
            onClick={() => { onBuy(product); onClose(); }}
            className="w-full text-white py-3.5 rounded-2xl text-base font-bold active:scale-95 transition-transform"
            style={{ backgroundImage: "linear-gradient(to right, #ef558b, #ef3654)" }}
          >
            {plt.icon} {plt.label}에서 구매하기 →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 상품 카드 ───────────────────────────────────────────────
function ProductCard({ product, onBuy, onConfirm }) {
  const [showSheet, setShowSheet]   = useState(false); // 구매 확인 시트
  const [showDetail, setShowDetail] = useState(false); // 상세 팝업
  const [confirmed, setConfirmed]   = useState(false); // 포인트 이미 받음
  const pct = discountPct(product.price, product.originalPrice);
  const plt = PLATFORM_LABEL[product.platform] || PLATFORM_LABEL.coupang;

  // 구매 버튼 → 외부 이동 + 구매확인 시트
  const handleBuy = () => {
    onBuy(product);
    setShowSheet(true);
  };

  // 상세 팝업에서 구매 → 외부 이동 + 구매확인 시트
  const handleBuyFromDetail = (p) => {
    onBuy(p);
    setShowSheet(true);
  };

  const handleConfirm = async (p) => {
    const success = await onConfirm(p);
    if (success) setConfirmed(true);
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col">
        {/* 상품 이미지 — 클릭 시 상세 팝업 */}
        <div
          className="relative bg-gray-50 h-40 flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer active:opacity-80"
          onClick={() => setShowDetail(true)}
        >
          <img
            src={product.image}
            alt={product.title}
            className="h-full w-full object-cover"
            onError={(e) => {
              e.target.style.display = "none";
              e.target.nextSibling.style.display = "flex";
            }}
          />
          <div className="hidden absolute inset-0 items-center justify-center text-5xl bg-gray-100">
            🛒
          </div>
          {/* 플랫폼 뱃지 */}
          <span className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${plt.color}`}>
            {plt.icon} {plt.label}
          </span>
          {/* 할인율 */}
          {pct > 0 && (
            <span className="absolute bottom-2 right-2 bg-red-500 text-white text-xs font-black px-1.5 py-0.5 rounded-lg">
              {pct}% OFF
            </span>
          )}
        </div>

        {/* 상품 정보 */}
        <div className="p-3 flex flex-col flex-1">
          <p className="text-[10px] text-gray-400 font-medium mb-0.5">{product.brand}</p>
          <p className="text-sm font-bold text-gray-800 leading-tight mb-1 line-clamp-2">{product.title}</p>
          <p className="text-xs text-gray-500 leading-relaxed mb-2 line-clamp-2">{product.desc}</p>

          {/* 가격 */}
          <div className="flex items-baseline gap-1.5 mb-3">
            <span className="text-base font-black text-gray-900">{product.price.toLocaleString()}원</span>
            {product.originalPrice > product.price && (
              <span className="text-xs text-gray-400 line-through">{product.originalPrice.toLocaleString()}원</span>
            )}
          </div>

          {/* 키워드 태그 */}
          {product.tag && (
            <div className="rounded-xl px-3 py-1.5 mb-2 text-center" style={{ backgroundColor: "#8dc63f18" }}>
              <span className="text-[11px] font-bold" style={{ color: "#8dc63f" }}>{product.tag}</span>
            </div>
          )}

          {/* 보너스 포인트 안내 */}
          <div className="rounded-xl px-3 py-2 mb-3 flex items-center justify-between" style={{ backgroundColor: "#CD5C5C15" }}>
            <span className="text-xs" style={{ color: "#CD5C5C" }}>🎁 구매 시 보너스</span>
            <span className="text-xs font-black" style={{ color: "#CD5C5C" }}>+{product.bonusPoints}P</span>
          </div>

          {/* 구매 버튼 — 항상 카드 맨 하단 고정 */}
          <div className="mt-auto">
            {confirmed ? (
              <div className="rounded-xl py-2.5 text-center" style={{ backgroundColor: "#CD5C5C15" }}>
                <p className="text-sm font-bold" style={{ color: "#CD5C5C" }}>🎉 +{product.bonusPoints}P 받음!</p>
              </div>
            ) : (
              <button
                onClick={handleBuy}
                className="w-full text-white py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-transform"
                style={{ backgroundImage: "linear-gradient(to right, #ef558b, #ef3654)" }}
              >
                {plt.icon} {plt.label}에서 구매하기 →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 상품 상세 팝업 */}
      {showDetail && (
        <ProductDetailSheet
          product={product}
          onBuy={handleBuyFromDetail}
          onClose={() => setShowDetail(false)}
        />
      )}

      {/* 구매 확인 바텀시트 */}
      {showSheet && (
        <PurchaseSheet
          product={product}
          onConfirm={handleConfirm}
          onClose={() => setShowSheet(false)}
        />
      )}
    </>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────
export default function ShopPage() {
  const { user }  = useAuth();
  const router    = useRouter();
  const [category, setCategory] = useState("전체");
  const [products, setProducts] = useState(DEFAULT_PRODUCTS);
  const [loading,  setLoading]  = useState(true);
  const [toast,    setToast]    = useState(null); // { msg, type }

  // ── Firestore 실시간 상품 로드 ────────────────────────────
  // 복합 인덱스 필요 없이 전체 로드 후 클라이언트에서 필터/정렬
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "products"), (snap) => {
      if (!snap.empty) {
        const loaded = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((p) => p.active !== false)  // active가 false가 아닌 것만
          .sort((a, b) => (a.order || 99) - (b.order || 99));
        setProducts(loaded);
      }
      setLoading(false);
    }, (err) => {
      console.error("[Shop] 상품 로드 실패:", err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ── 카테고리 필터 ─────────────────────────────────────────
  const filtered = category === "전체"
    ? products
    : products.filter((p) => p.category === category);

  // ── 외부 링크 클릭 로그 ───────────────────────────────────
  const handleBuy = useCallback(async (product) => {
    // 외부 쇼핑몰로 이동
    window.open(product.link, "_blank");
    // Firebase에 클릭 로그
    try {
      await addDoc(collection(db, "shopClicks"), {
        productId:   product.id,
        productTitle: product.title,
        platform:    product.platform || "coupang",
        userId:      user?.uid || "anonymous",
        clickedAt:   serverTimestamp(),
      });
    } catch {}
  }, [user]);

  // ── 구매 확인 → 포인트 지급 신청 (관리자 검토 후 지급) ──
  const handleConfirm = useCallback(async (product) => {
    if (!user) { router.push("/login"); return false; }
    try {
      // 서버 API 경유 — 카카오/Firebase 로그인 모두 대응
      const res = await fetch("/api/shop/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId:    product.id,
          productTitle: product.title,
          productImage: product.image || "",
          platform:     product.platform || "coupang",
          bonusPoints:  product.bonusPoints,
          userId:       user.uid,
          userEmail:    user.email || "",
        }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || "server_error");
      }
      setToast({ msg: `📋 구매 신청 완료! 검토 후 +${product.bonusPoints}P 지급 예정`, type: "success" });
      setTimeout(() => setToast(null), 4000);
      return true;
    } catch (e) {
      console.error("[ShopPurchase] error:", e.message);
      const msg = e.message === "already_applied"
        ? "이미 신청한 상품이에요."
        : "오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
      setToast({ msg, type: "error" });
      setTimeout(() => setToast(null), 4000);
      return false;
    }
  }, [user, router]);

  return (
    <div
      className="min-h-screen bg-gray-50"
      style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom, 20px))" }}
    >
      {/* ── 헤더 ── */}
      <div className="bg-white px-4 pt-4 pb-3 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-lg font-black text-gray-800">🛒 친환경 쇼핑</h1>
            <p className="text-xs text-gray-400 mt-0.5">구매 시 포인트 보너스 · 외부 쇼핑몰 연동</p>
          </div>
          <div className="px-3 py-1.5 rounded-xl" style={{ backgroundColor: "#CD5C5C15" }}>
            <p className="text-[10px] font-bold" style={{ color: "#CD5C5C" }}>제휴 링크</p>
            <p className="text-[10px]" style={{ color: "#CD5C5Ccc" }}>수수료 수익 → 환경 기부</p>
          </div>
        </div>

        {/* 안내 배너 */}
        <div className="mt-2 rounded-xl px-3 py-2.5 flex items-center gap-2" style={{ backgroundImage: "linear-gradient(to right, #ef558b, #ef3654)" }}>
          <span className="text-xl">💗</span>
          <div>
            <p className="text-xs font-bold text-white">쇼핑하면 지구도 살려요</p>
            <p className="text-[10px] text-pink-100">제휴 수수료 일부 → 환경 단체 기부 · 구매 시 앱 포인트 지급</p>
          </div>
        </div>
      </div>

      {/* ── 카테고리 탭 ── */}
      <div className="px-4 mt-3 overflow-x-auto">
        <div className="flex gap-2 pb-1" style={{ minWidth: "max-content" }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all
                ${category === cat
                  ? "text-white shadow-sm"
                  : "bg-white text-gray-500 border border-gray-100"}`}
              style={category === cat ? { backgroundColor: "#CD5C5C" } : undefined}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── 상품 그리드 ── */}
      <div className="px-4 mt-3">
        {loading ? (
          <div className="text-center py-12 text-gray-400 animate-pulse">상품을 불러오는 중…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-2">🛍️</p>
            <p className="text-sm">이 카테고리 상품을 준비 중이에요</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onBuy={handleBuy}
                onConfirm={handleConfirm}
                userId={user?.uid}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── 쿠팡 파트너스 안내 ── */}
      <div className="mx-4 mt-4 bg-white rounded-2xl p-4 shadow-sm">
        <p className="text-xs font-bold text-gray-500 mb-2">💡 이용 안내</p>
        <div className="space-y-1.5">
          {[
            "상품 링크를 통해 구매 시 일부 수수료가 앱 운영에 사용됩니다",
            "구매 완료 후 '구매했어요' 버튼을 누르면 포인트가 지급돼요",
            "포인트는 관리자 검토 후 최종 확정될 수 있습니다",
            "이 포스팅은 쿠팡 파트너스 및 11번가 파트너스 활동의 일환으로 수수료를 제공받습니다",
          ].map((txt, i) => (
            <p key={i} className="text-[11px] text-gray-400 leading-relaxed">• {txt}</p>
          ))}
        </div>
      </div>

      {/* ── 토스트 알림 ── */}
      {toast && (
        <div className={`fixed bottom-24 left-4 right-4 z-50 rounded-2xl px-4 py-3 shadow-xl text-center font-bold text-sm transition-all
          ${toast.type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
