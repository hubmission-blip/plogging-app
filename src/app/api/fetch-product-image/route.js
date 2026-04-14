/**
 * 쿠팡 상품 이미지 자동 추출 API
 * GET /api/fetch-product-image?url=https://link.coupang.com/a/xxxxx
 *
 * 전략:
 * 1. 모바일 User-Agent로 요청 (봇 감지 우회)
 * 2. 단계별 시도: link.coupang 단축URL → 실제 상품 페이지
 * 3. og:image → CDN 썸네일 패턴 → JSON-LD 순서로 이미지 추출
 * 4. m.coupang.com 모바일 페이지 재시도 (데스크탑 차단 시)
 */

// 모바일 iPhone User-Agent (봇 감지 우회에 효과적)
const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) " +
  "AppleWebKit/605.1.15 (KHTML, like Gecko) " +
  "Version/17.4 Mobile/15E148 Safari/604.1";

// 실제 브라우저와 최대한 유사한 헤더
const BROWSER_HEADERS = {
  "User-Agent":                MOBILE_UA,
  "Accept":                    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language":           "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding":           "gzip, deflate, br",
  "Cache-Control":             "no-cache",
  "Pragma":                    "no-cache",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest":            "document",
  "Sec-Fetch-Mode":            "navigate",
  "Sec-Fetch-Site":            "none",
  "Sec-Fetch-User":            "?1",
};

// ── HTML에서 이미지·상품명·가격 추출 ────────────────────────────
function extractFromHtml(html, finalUrl) {
  // og:image
  const ogPatterns = [
    /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i,
    /<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i,
    /<meta\s+name=["']og:image["']\s+content=["']([^"']+)["']/i,
  ];
  let imageUrl = null;
  for (const p of ogPatterns) {
    const m = html.match(p);
    if (m?.[1]) { imageUrl = m[1]; break; }
  }

  // og:image 없으면 쿠팡 CDN 썸네일 패턴 직접 탐색
  if (!imageUrl) {
    const cdnPatterns = [
      /https:\/\/thumbnail\d*\.coupangcdn\.com\/[^"'\s\)>]+\.(?:jpg|jpeg|png|webp)/i,
      /https:\/\/image\d*\.coupangcdn\.com\/[^"'\s\)>]+\.(?:jpg|jpeg|png|webp)/i,
      /https:\/\/static\.coupangcdn\.com\/[^"'\s\)>]+\.(?:jpg|jpeg|png|webp)/i,
    ];
    for (const p of cdnPatterns) {
      const m = html.match(p);
      if (m?.[0]) { imageUrl = m[0]; break; }
    }
  }

  // JSON-LD 에서 image 추출 (위 방법 모두 실패 시)
  if (!imageUrl) {
    const jsonLdMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
    if (jsonLdMatch?.[1]) {
      try {
        const ld = JSON.parse(jsonLdMatch[1]);
        const img = ld?.image?.[0] || ld?.image;
        if (typeof img === "string" && img.startsWith("http")) imageUrl = img;
      } catch {}
    }
  }

  // og:title
  let productTitle = null;
  const titlePatterns = [
    /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i,
    /<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i,
    /<title>([^<]+)<\/title>/i,
  ];
  for (const p of titlePatterns) {
    const m = html.match(p);
    if (m?.[1]) { productTitle = m[1].trim().replace(" : 쿠팡", "").replace(" | 쿠팡", "").trim(); break; }
  }

  // 가격
  let price = null;
  const pricePatterns = [
    /<meta\s+property=["']product:price:amount["']\s+content=["']([^"']+)["']/i,
    /"price"\s*:\s*"?(\d[\d,]+)"?/,
  ];
  for (const p of pricePatterns) {
    const m = html.match(p);
    if (m?.[1]) { price = m[1].replace(/,/g, ""); break; }
  }

  return { imageUrl, productTitle, price, finalUrl };
}

// ── 메인 핸들러 ──────────────────────────────────────────────────
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return Response.json({ error: "URL이 필요합니다" }, { status: 400 });
  }
  if (!url.includes("coupang.com") && !url.includes("link.coupang")) {
    return Response.json({ error: "쿠팡 URL만 지원합니다" }, { status: 400 });
  }

  try {
    // ── 1차 시도: 원본 URL (모바일 헤더) ─────────────────────────
    let res = await fetch(url, {
      method:   "GET",
      redirect: "follow",
      headers:  BROWSER_HEADERS,
    });

    // ── 봇 차단 감지 (403, 429, 503 등) ─────────────────────────
    // 차단되면 m.coupang.com 모바일 버전으로 재시도
    if (!res.ok || res.status === 403 || res.status === 429) {
      // 실제 상품 URL이 www.coupang.com 이면 m.coupang.com 으로 변환
      const mobileUrl = res.url
        ? res.url.replace("www.coupang.com", "m.coupang.com")
        : url.replace("www.coupang.com", "m.coupang.com");

      if (mobileUrl !== url) {
        res = await fetch(mobileUrl, {
          method:   "GET",
          redirect: "follow",
          headers:  {
            ...BROWSER_HEADERS,
            "Referer": "https://m.coupang.com/",
          },
        });
      }
    }

    if (!res.ok) {
      return Response.json(
        { error: `페이지 로드 실패 (${res.status}). 쿠팡 API 승인 후 개선 예정입니다.` },
        { status: 502 }
      );
    }

    const html     = await res.text();
    const finalUrl = res.url;

    // ── 봇 차단 페이지 감지 ───────────────────────────────────────
    if (
      html.includes("로봇이 아닙니다") ||
      html.includes("captcha") ||
      html.includes("bot-detection") ||
      html.length < 500
    ) {
      return Response.json(
        { error: "쿠팡에서 자동 접근을 차단했습니다. 이미지 URL을 직접 입력해주세요." },
        { status: 403 }
      );
    }

    const result = extractFromHtml(html, finalUrl);

    if (!result.imageUrl) {
      return Response.json(
        { error: "이미지를 찾을 수 없어요. URL을 직접 입력해주세요.", finalUrl },
        { status: 404 }
      );
    }

    return Response.json(result);

  } catch (e) {
    return Response.json(
      { error: `요청 실패: ${e.message}` },
      { status: 500 }
    );
  }
}
