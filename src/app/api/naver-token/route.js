export async function POST(request) {
  try {
    const { code, state } = await request.json();

    if (!code || !state) {
      return Response.json({ error: "code 또는 state 누락" }, { status: 400 });
    }

    // 1단계: 인증코드 → 액세스토큰 교환
    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.NAVER_CLIENT_ID,
      client_secret: process.env.NAVER_CLIENT_SECRET,
      code,
      state,
    });

    const tokenRes = await fetch("https://nid.naver.com/oauth2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
      body: tokenParams,
    });

    const tokenData = await tokenRes.json();
    console.log("네이버 토큰 응답:", tokenData.error ? tokenData.error : "OK");

    if (tokenData.error) {
      return Response.json(
        { error: tokenData.error_description || tokenData.error },
        { status: 400 }
      );
    }

    // 2단계: 액세스토큰 → 사용자 프로필 조회
    const userRes = await fetch("https://openapi.naver.com/v1/nid/me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userRes.json();
    console.log("네이버 유저 응답:", userData);

    if (userData.resultcode !== "00" || !userData.response?.id) {
      return Response.json({ error: "유저 정보 조회 실패" }, { status: 400 });
    }

    const profile = userData.response;

    return Response.json({
      uid: String(profile.id),
      email: profile.email || `naver_${profile.id}@naver.com`,
      nickname: profile.nickname || "네이버유저",
    });

  } catch (e) {
    console.error("네이버 토큰 API 오류:", e);
    return Response.json({ error: "서버 오류: " + e.message }, { status: 500 });
  }
}
