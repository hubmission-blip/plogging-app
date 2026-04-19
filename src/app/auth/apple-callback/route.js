// Apple Sign In은 콜백을 POST form으로 보냄
// POST body에서 code를 추출하여 GET 파라미터로 변환 후 리다이렉트
export async function POST(request) {
  try {
    const formData = await request.formData();
    const code = formData.get("code") || "";
    const state = formData.get("state") || "";
    const userJson = formData.get("user") || "";

    const params = new URLSearchParams({ code });
    if (state) params.set("state", state);
    if (userJson) params.set("user", userJson);

    // /auth/apple/page.js(클라이언트)로 리다이렉트
    return Response.redirect(
      `https://happy500.kr/auth/apple?${params.toString()}`,
      303
    );
  } catch (e) {
    console.error("Apple POST callback 오류:", e);
    return Response.redirect("https://happy500.kr/login", 303);
  }
}
