// ─── Apple In-App Purchase 유틸리티 ────────────────────────────
// cordova-plugin-purchase v13+ 기반 (Capacitor 호환)
// 소모성(Consumable) 상품 전용 — 후원/기부용

const IAP_PRODUCTS = [
  { id: "donate_500",   label: "₩500 후원",    price: 500   },
  { id: "donate_5000",  label: "₩5,000 후원",  price: 5000  },
  { id: "donate_10000", label: "₩10,000 후원", price: 10000 },
  { id: "donate_30000", label: "₩30,000 후원", price: 30000 },
  { id: "donate_50000", label: "₩50,000 후원", price: 50000 },
];

// Capacitor 네이티브 iOS 환경인지 확인
export function isNativeIOS() {
  try {
    return typeof window !== "undefined" &&
      !!(window?.Capacitor?.isNativePlatform?.()) &&
      window?.Capacitor?.getPlatform?.() === "ios";
  } catch {
    return false;
  }
}

// IAP 초기화 — CdvPurchase.store 사용
export async function initIAP() {
  if (!isNativeIOS()) return false;

  // cordova-plugin-purchase가 로드될 때까지 대기
  const store = window.CdvPurchase?.store;
  if (!store) {
    console.warn("[IAP] CdvPurchase.store 없음 — 플러그인 미설치");
    return false;
  }

  const { ProductType, Platform } = window.CdvPurchase;

  // 상품 등록
  store.register(
    IAP_PRODUCTS.map((p) => ({
      id: p.id,
      type: ProductType.CONSUMABLE,
      platform: Platform.APPLE_APPSTORE,
    }))
  );

  // 초기화
  await store.initialize([Platform.APPLE_APPSTORE]);

  console.log("[IAP] 초기화 완료, 상품:", store.products);
  return true;
}

// 상품 목록 조회 (Apple에서 반환한 실제 가격 포함)
export function getIAPProducts() {
  const store = window.CdvPurchase?.store;
  if (!store) return IAP_PRODUCTS;

  return IAP_PRODUCTS.map((p) => {
    const product = store.get(p.id);
    const offer   = product?.getOffer();
    return {
      ...p,
      applePrice: offer?.pricingPhases?.[0]?.price || p.label,
      canPurchase: !!offer,
      product,
      offer,
    };
  });
}

// 구매 실행
export async function purchaseIAP(productId) {
  const store = window.CdvPurchase?.store;
  if (!store) throw new Error("IAP 스토어 미초기화");

  const product = store.get(productId);
  if (!product) throw new Error("상품을 찾을 수 없습니다");

  const offer = product.getOffer();
  if (!offer) throw new Error("구매 가능한 오퍼가 없습니다");

  // 구매 시작
  const result = await store.order(offer);
  if (result?.isError) {
    throw new Error(result.message || "구매 실패");
  }
  return result;
}

// 구매 완료 처리 콜백 등록
export function onIAPApproved(callback) {
  const store = window.CdvPurchase?.store;
  if (!store) return;

  store.when().approved((transaction) => {
    console.log("[IAP] 구매 승인:", transaction);
    callback(transaction);
    // 소모성 상품이므로 finish 호출
    transaction.finish();
  });
}

// 구매 에러 콜백 등록
export function onIAPError(callback) {
  const store = window.CdvPurchase?.store;
  if (!store) return;

  store.when().error((error) => {
    console.error("[IAP] 에러:", error);
    callback(error);
  });
}

// 상품 ID → 금액 매핑
export function getProductPrice(productId) {
  const found = IAP_PRODUCTS.find((p) => p.id === productId);
  return found?.price || 0;
}

export { IAP_PRODUCTS };
