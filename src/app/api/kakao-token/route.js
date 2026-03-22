import { NextResponse } from "next/server";

export async function POST(request) {
  const { code, redirectUri } = await request.json();

  try {
    // 서버에서 카카오 토큰 요청 (CORS 없음)
    const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY,
        redirect_uri: redirectUri,
        code,
      }),
    });
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return NextResponse.json({ error: tokenData.error_description }, { status: 400 });
    }

    // 카카오 사용자 정보 요청
    const userRes = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const kakaoUser = await userRes.json();

    return NextResponse.json({
      uid: `kakao_${kakaoUser.id}`,
      nickname: kakaoUser.kakao_account?.profile?.nickname || "카카오유저",
      email: kakaoUser.kakao_account?.email || `${kakaoUser.id}@kakao.com`,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}