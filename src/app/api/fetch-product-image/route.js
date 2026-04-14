/**
 * 쿠팡 상품 이미지 자동 추출 API
 * GET /api/fetch-product-image?url=https://link.coupang.com/a/xxxxx
 *
 * 동작 방식:
 * 1. 파트너스 단축 URL → 쿠팡 상품 페이지로 리다이렉트 따라가기
 * 2. HTML에서 og:image 메타태그 추출
 * 3. 이미지 URL 반환
 */

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return Response.json({ error: "URL이 필요합니다" }, { status: 400 });
  }

  // 쿠팡/link.coupang 도메인 체크
  if (!url.includes("coupang.com") && !url.includes("link.coupang")) {
    return Response.json({ error: "쿠팡 URL만 지원합니다" }, { status: 400 });
  }

  try {
    // 리다이렉트를 따라가며 실제 상품 페이지 HTML 가져오기
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
          "AppleWebKit/537.36 (KHTML, like Gecko) " +
          "Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
        "Cache-Control": "no-cache",
      },
    });

    if (!res.ok) {
      return Response.json(
        { error: `페이지 로드 실패 (${res.status})` },
        { status: 502 }
      );
    }

    const html = await res.text();
    const finalUrl = res.url; // 리다이렉트 후 실제 URL

    // ── og:image 추출 (두 가지 속성 순서 패턴 대응) ────────────
    const ogPatterns = [
      /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i,
      /<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i,
      /<meta\s+name=["']og:image["']\s+content=["']([^"']+)["']/i,
    ];

    let imageUrl = null;
    for (const pattern of ogPatterns) {
      const m = html.match(pattern);
      if (m?.[1]) { imageUrl = m[1]; break; }
    }

    // ── og:image 없으면 쿠팡 썸네일 CDN URL 직접 추출 ──────────
    if (!imageUrl) {
      const thumbPatterns = [
        /https:\/\/thumbnail\d*\.coupangcdn\.com\/[^"'\s\)>]+\.(?:jpg|jpeg|png|webp)/i,
        /https:\/\/image\d*\.coupangcdn\.com\/[^"'\s\)>]+\.(?:jpg|jpeg|png|webp)/i,
      ];
      for (const p of thumbPatterns) {
        const m = html.match(p);
        if (m?.[0]) { imageUrl = m[0]; break; }
      }
    }

    // ── 상품명도 함께 추출 (og:title) ──────────────────────────
    let productTitle = null;
    const titlePatterns = [
      /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i,
      /<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i,
    ];
    for (const p of titlePatterns) {
      const m = html.match(p);
      if (m?.[1]) { productTitle = m[1].trim(); break; }
    }

    // ── 가격 추출 시도 (og:price:amount 또는 JSON-LD) ──────────
    let price = null;
    const pricePattern = /<meta\s+property=["']product:price:amount["']\s+content=["']([^"']+)["']/i;
    const pm = html.match(pricePattern);
    if (pm?.[1]) price = pm[1];

    if (!imageUrl) {
      return Response.json(
        { error: "이미지를 찾을 수 없어요. 링크를 확인해주세요.", finalUrl },
        { status: 404 }
      );
    }

    return Response.json({
      imageUrl,
      productTitle,
      price,
      finalUrl,
    });
  } catch (e) {
    return Response.json(
      { error: `요청 실패: ${e.message}` },
      { status: 500 }
    );
  }
}
