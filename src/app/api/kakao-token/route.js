export async function POST(request) {
  try {
    const { code, redirectUri } = await request.json();

    if (!code || !redirectUri) {
      return Response.json({ error: "code 또는 redirectUri 누락" }, { status: 400 });
    }

    // ✅ 서버에서 카카오 토큰 교환 (CORS 없음)
    const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.KAKAO_REST_API_KEY, // 서버 환경변수 (NEXT_PUBLIC 아님)
        redirect_uri: redirectUri,
        code,
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error("카카오 토큰 오류:", tokenData);
      return Response.json(
        { error: tokenData.error_description || tokenData.error },
        { status: 400 }
      );
    }

    // ✅ 액세스 토큰으로 유저 정보 조회
    const userRes = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
      },
    });

    const userData = await userRes.json();

    if (!userData.id) {
      return Response.json({ error: "유저 정보 조회 실패" }, { status: 400 });
    }

    return Response.json({
      uid: String(userData.id),
      email: userData.kakao_account?.email || `kakao_${userData.id}@kakao.com`,
      nickname:
        userData.kakao_account?.profile?.nickname ||
        userData.properties?.nickname ||
        "카카오유저",
    });
  } catch (e) {
    console.error("카카오 토큰 API 오류:", e);
    return Response.json({ error: "서버 오류" }, { status: 500 });
  }
}