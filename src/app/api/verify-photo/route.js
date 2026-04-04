// ─── AI 쓰레기봉투 사진 검증 API ─────────────────────────────────────────────
// Anthropic Claude Vision API를 사용하여 사진에 쓰레기봉투가 있는지 확인합니다.
// 환경변수: ANTHROPIC_API_KEY (서버 측 비공개)

export async function POST(request) {
  try {
    const { imageBase64, mimeType } = await request.json();

    if (!imageBase64 || !mimeType) {
      return Response.json(
        { valid: false, confidence: "low", reason: "이미지 데이터가 없습니다." },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // API 키 없으면 검증 건너뜀 (개발/테스트용 fallback)
      console.warn("[verify-photo] ANTHROPIC_API_KEY 미설정 → 검증 건너뜀");
      return Response.json({
        valid: true,
        confidence: "low",
        reason: "AI 검증 미설정 상태입니다. 사진을 직접 확인해주세요.",
        skipped: true,
      });
    }

    // ─── Anthropic Messages API 직접 호출 ────────────────────
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mimeType,
                  data: imageBase64,
                },
              },
              {
                type: "text",
                text: `이 사진을 분석해서 플로깅(plogging) 활동의 쓰레기 수거 인증 사진인지 판단해주세요.

판단 기준:
- valid=true: 쓰레기 봉투, 비닐봉투에 담긴 쓰레기, 집게/장갑과 함께 있는 쓰레기, 수거된 쓰레기 더미가 사진의 주요 피사체인 경우
- valid=false: 사람 셀카만 있는 경우, 빈 거리/공원 풍경만 있는 경우, 음식/음료 사진, 무관한 사진

반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{"valid": true 또는 false, "confidence": "high" 또는 "medium" 또는 "low", "reason": "판단 이유를 한국어 1~2문장으로"}`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[verify-photo] Anthropic API 오류:", response.status, errText);
      // API 오류 시 통과시킴 (서비스 중단 방지)
      return Response.json({
        valid: true,
        confidence: "low",
        reason: "AI 검증 일시 오류입니다. 사진을 수동 확인합니다.",
        skipped: true,
      });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "";

    // JSON 파싱 시도
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      return Response.json({
        valid: true,
        confidence: "low",
        reason: "AI 응답 형식 오류입니다.",
        skipped: true,
      });
    }

    const result = JSON.parse(jsonMatch[0]);
    return Response.json({
      valid: !!result.valid,
      confidence: result.confidence || "medium",
      reason: result.reason || "",
    });
  } catch (err) {
    console.error("[verify-photo] 서버 오류:", err);
    // 예외 발생 시 통과 (서비스 중단 방지)
    return Response.json({
      valid: true,
      confidence: "low",
      reason: "검증 서버 오류입니다. 사진을 직접 확인해주세요.",
      skipped: true,
    });
  }
}
