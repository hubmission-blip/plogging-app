import { SignJWT, importPKCS8 } from "jose";

// Apple client_secret JWT 생성
async function generateClientSecret() {
  const teamId    = process.env.APPLE_TEAM_ID;
  const keyId     = process.env.APPLE_KEY_ID;
  const serviceId = process.env.APPLE_SERVICE_ID;
  const privateKey = process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, "\n");

  const key = await importPKCS8(privateKey, "ES256");

  const now = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt(now)
    .setExpirationTime(now + 86400 * 180) // 6개월
    .setAudience("https://appleid.apple.com")
    .setSubject(serviceId)
    .sign(key);

  return jwt;
}

// id_token 디코딩 (페이로드만 추출)
function decodeIdToken(idToken) {
  try {
    const parts = idToken.split(".");
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    return payload;
  } catch {
    return null;
  }
}

export async function POST(request) {
  try {
    const { code, user: userJson } = await request.json();

    if (!code) {
      return Response.json({ error: "code 누락" }, { status: 400 });
    }

    // client_secret JWT 생성
    const clientSecret = await generateClientSecret();

    // 인증코드 → 토큰 교환
    const tokenRes = await fetch("https://appleid.apple.com/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: process.env.APPLE_SERVICE_ID,
        client_secret: clientSecret,
        redirect_uri: "https://www.happy500.kr/auth/apple-callback",
      }),
    });

    const tokenData = await tokenRes.json();
    console.log("Apple 토큰 응답:", JSON.stringify(tokenData).slice(0, 200));

    if (tokenData.error) {
      return Response.json(
        { error: tokenData.error_description || tokenData.error },
        { status: 400 }
      );
    }

    // id_token에서 사용자 정보 추출
    const payload = decodeIdToken(tokenData.id_token);
    if (!payload || !payload.sub) {
      return Response.json({ error: "id_token 파싱 실패" }, { status: 400 });
    }

    // Apple은 첫 로그인 시에만 user 정보(이름, 이메일)를 제공
    // 이후에는 id_token의 sub(고유ID)와 email만 사용 가능
    let name = "Apple유저";
    let email = payload.email || "";

    // 첫 로그인 시 전달된 user 정보 활용
    if (userJson) {
      try {
        const userData = typeof userJson === "string" ? JSON.parse(userJson) : userJson;
        if (userData.name) {
          const firstName = userData.name.firstName || "";
          const lastName = userData.name.lastName || "";
          name = `${lastName}${firstName}`.trim() || name;
        }
        if (userData.email) email = userData.email;
      } catch {}
    }

    return Response.json({
      uid: payload.sub,
      email,
      nickname: name,
    });

  } catch (e) {
    console.error("Apple 토큰 API 오류:", e);
    return Response.json({ error: "서버 오류: " + e.message }, { status: 500 });
  }
}
