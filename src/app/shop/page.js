"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection, query, where, onSnapshot, orderBy,
  doc, addDoc, updateDoc, getDoc, increment, serverTimestamp,
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
  coupang: { label: "쿠팡", color: "bg-red-500", icon: "🛍️" },
  naver:   { label: "네이버", color: "bg-green-500", icon: "🛒" },
  direct:  { label: "직접구매", color: "bg-blue-500", icon: "🌐" },
};

// ─── 할인율 계산 ─────────────────────────────────────────────
function discountPct(price, original) {
  if (!original || original <= price) return 0;
  return Math.round(((original - price) / original) * 100);
}

// ─── 상품 카드 ───────────────────────────────────────────────
function ProductCard({ product, onBuy, onConfirm, userId }) {
  const [bought,    setBought]   = useState(false); // 구매했어요 상태
  const [confirmed, setConfirmed] = useState(false); // 포인트 받음 상태
  const [loading,   setLoading]  = useState(false);
  const pct = discountPct(product.price, product.originalPrice);
  const plt = PLATFORM_LABEL[product.platform] || PLATFORM_LABEL.coupang;

  const handleBuy = () => {
    onBuy(product);
    setBought(true);
  };

  const handleConfirm = async () => {
    if (loading || confirmed) return;
    setLoading(true);
    await onConfirm(product);
    setConfirmed(true);
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* 상품 이미지 */}
      <div className="relative bg-gray-50 h-40 flex items-center justify-center overflow-hidden">
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
        {/* 태그 */}
        {product.tag && (
          <span className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full text-white
            ${product.tag === "베스트" ? "bg-orange-500"
            : product.tag === "NEW"    ? "bg-blue-500"
            : product.tag === "필수템" ? "bg-purple-500"
            : "bg-green-500"}`}>
            {product.tag}
          </span>
        )}
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
      <div className="p-3">
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

        {/* 보너스 포인트 안내 */}
        <div className="bg-green-50 rounded-xl px-3 py-2 mb-3 flex items-center justify-between">
          <span className="text-xs text-green-700">🎁 구매 시 보너스</span>
          <span className="text-xs font-black text-green-600">+{product.bonusPoints}P</span>
        </div>

        {/* 구매 버튼 */}
        {!bought ? (
          <button
            onClick={handleBuy}
            className="w-full bg-gradient-to-r from-green-500 to-teal-500 text-white py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-transform"
          >
            {plt.icon} {plt.label}에서 구매하기 →
          </button>
        ) : !confirmed ? (
          <div className="space-y-2">
            <p className="text-[10px] text-gray-400 text-center">구매를 완료하셨나요?</p>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-400 to-orange-500 text-white py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-transform"
            >
              {loading ? "처리 중…" : `✅ 구매했어요! (+${product.bonusPoints}P)`}
            </button>
            <button
              onClick={() => setBought(false)}
              className="w-full text-gray-400 text-xs py-1"
            >
              취소
            </button>
          </div>
        ) : (
          <div className="bg-green-50 rounded-xl py-2.5 text-center">
            <p className="text-sm font-bold text-green-600">🎉 +{product.bonusPoints}P 지급 완료!</p>
          </div>
        )}
      </div>
    </div>
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
  useEffect(() => {
    const q = query(
      collection(db, "products"),
      where("active", "==", true),
      orderBy("order", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const loaded = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setProducts(loaded);
      }
      setLoading(false);
    }, () => {
      setLoading(false); // 오류 시 기본 상품 유지
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

  // ── 구매 확인 → 포인트 지급 ──────────────────────────────
  const handleConfirm = useCallback(async (product) => {
    if (!user) { router.push("/login"); return; }
    try {
      // 포인트 지급 기록
      await addDoc(collection(db, "shopPurchases"), {
        productId:    product.id,
        productTitle: product.title,
        platform:     product.platform || "coupang",
        bonusPoints:  product.bonusPoints,
        userId:       user.uid,
        confirmedAt:  serverTimestamp(),
        verified:     false, // 관리자가 나중에 검증
      });
      // 포인트 적립
      await updateDoc(doc(db, "users", user.uid), {
        totalPoints: increment(product.bonusPoints),
      }).catch(() => {});
      setToast({ msg: `🎉 +${product.bonusPoints}P 적립 완료!`, type: "success" });
      setTimeout(() => setToast(null), 3000);
    } catch (e) {
      setToast({ msg: "오류가 발생했습니다. 다시 시도해주세요.", type: "error" });
      setTimeout(() => setToast(null), 3000);
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
          <div className="bg-green-50 px-3 py-1.5 rounded-xl">
            <p className="text-[10px] text-green-600 font-bold">제휴 링크</p>
            <p className="text-[10px] text-green-500">수수료 수익 → 환경 기부</p>
          </div>
        </div>

        {/* 안내 배너 */}
        <div className="mt-2 bg-gradient-to-r from-green-500 to-teal-500 rounded-xl px-3 py-2.5 flex items-center gap-2">
          <span className="text-xl">💚</span>
          <div>
            <p className="text-xs font-bold text-white">쇼핑하면 지구도 살려요</p>
            <p className="text-[10px] text-green-100">제휴 수수료 일부 → 환경 단체 기부 · 구매 시 앱 포인트 지급</p>
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
                  ? "bg-green-500 text-white shadow-sm"
                  : "bg-white text-gray-500 border border-gray-100"}`}
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
            "이 포스팅은 쿠팡 파트너스 활동의 일환으로 수수료를 제공받습니다",
          ].map((txt, i) => (
            <p key={i} className="text-[11px] text-gray-400 leading-relaxed">• {txt}</p>
          ))}
        </div>
      </div>

      {/* ── 관리자 상품 추가 안내 ── */}
      <div className="mx-4 mt-3 mb-2 bg-gray-100 rounded-2xl p-4">
        <p className="text-xs font-bold text-gray-500 mb-1">🛠️ 상품 추가 방법</p>
        <p className="text-[11px] text-gray-400 leading-relaxed">
          Firebase Firestore → <code className="bg-white px-1 rounded">products</code> 컬렉션에 상품을 추가하면 즉시 반영됩니다.
          쿠팡 파트너스 링크를 <code className="bg-white px-1 rounded">link</code> 필드에 입력하세요.
        </p>
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
