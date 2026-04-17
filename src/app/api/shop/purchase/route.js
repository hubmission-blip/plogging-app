// src/app/api/shop/purchase/route.js
// 카카오/Firebase 로그인 모두 대응 — Firestore REST API 경유
import { NextResponse } from "next/server";

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const API_KEY    = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

// Firestore REST API: 값 → Firestore 타입 변환
function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "boolean")          return { booleanValue: val };
  if (typeof val === "number")           return Number.isInteger(val)
                                           ? { integerValue: String(val) }
                                           : { doubleValue: val };
  if (typeof val === "string")           return { stringValue: val };
  if (val instanceof Date)               return { timestampValue: val.toISOString() };
  return { stringValue: String(val) };
}

function toFirestoreDoc(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    fields[k] = toFirestoreValue(v);
  }
  return { fields };
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { productId, productTitle, productImage, platform,
            bonusPoints, userId, userEmail } = body;

    // 필수 필드 검증
    if (!productId || !userId) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    // Firestore에 쓸 데이터
    const data = {
      productId,
      productTitle:  productTitle  || "",
      productImage:  productImage  || "",
      platform:      platform      || "coupang",
      bonusPoints:   bonusPoints   || 0,
      userId,
      userEmail:     userEmail     || "",
      appliedAt:     new Date().toISOString(),
      status:        "pending",
      verified:      false,
    };

    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/shopPurchases?key=${API_KEY}`;

    const fsRes = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(toFirestoreDoc(data)),
    });

    if (!fsRes.ok) {
      const err = await fsRes.json();
      console.error("[purchase/route] Firestore error:", err);
      // 권한 거부 → Firestore 보안 규칙 안내
      if (fsRes.status === 403) {
        return NextResponse.json(
          { error: "permission_denied", hint: "Firebase Console → Firestore → 규칙 수정 필요" },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: "firestore_error" }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (e) {
    console.error("[purchase/route] unexpected error:", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
