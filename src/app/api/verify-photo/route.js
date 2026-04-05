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
    if (!apiKey || apiKey === "your-anthropic-api-key-here") {
      // API 키 미설정 → 통과 불가 (어뷰징 방지)
      console.warn("[verify-photo] ANTHROPIC_API_KEY 미설정 → 검증 차단");
      return Response.json({
        valid: false,
        confidence: "low",
        reason: "AI 검증 서비스 키가 설정되지 않았습니다. 관리자 페이지에서 AI 검증을 OFF로 설정하거나 API 키를 추가해주세요.",
        configError: true,
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
        max_tokens: 400,
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
                text: `이 사진이 플로깅(plogging: 조깅하며 쓰레기 수거하는 환경 활동) 인증 사진인지 판단해주세요.

[통과 기준 - 아래 중 하나라도 해당되면 valid=true]
- 쓰레기 봉투(검정/흰색/투명 비닐봉투 등)가 사진에 보이는 경우
- 사람이 쓰레기 봉투를 들고 있는 경우 (셀카 포함)
- 집게, 장갑과 함께 수거된 쓰레기가 보이는 경우
- 길거리/공원/야외에서 수거된 쓰레기 더미가 보이는 경우
- 쓰레기통에 쓰레기를 버리는 장면

[거부 기준 - 아래에 해당하면 valid=false]
- 쓰레기나 수거 활동의 흔적이 전혀 없는 단순 풍경/셀카
- 음식, 음료, 실내 사진 등 플로깅과 무관한 사진
- 사진이 너무 어둡거나 식별 불가능한 경우

판단 시 주의사항: 쓰레기 봉투가 작게 보이거나 배경에 있어도 인정합니다. 애매한 경우엔 valid=true로 판단하세요.

반드시 아래 JSON 형식으로만 응답하세요 (마크다운 없이 순수 JSON):
{"valid": true, "confidence": "high", "reason": "판단 이유 한국어 1~2문장"}`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[verify-photo] Anthropic API 오류:", response.status, errText);
      return Response.json({
        valid: false,
        confidence: "low",
        reason: "AI 검증 서버에 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        serverError: true,
      });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "";

    // JSON 파싱 시도 (마크다운 코드블록, 중첩 등 다양한 형식 대응)
    let result = null;
    try {
      // 1차: 마크다운 코드블록 제거 후 직접 파싱
      const stripped = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      if (stripped.startsWith("{")) {
        result = JSON.parse(stripped);
      }
    } catch (_) { /* 다음 방법 시도 */ }

    if (!result) {
      try {
        // 2차: 가장 바깥쪽 { } 블록 추출 (중첩 JSON 대응)
        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");
        if (start !== -1 && end !== -1 && end > start) {
          result = JSON.parse(text.slice(start, end + 1));
        }
      } catch (_) { /* 다음 방법 시도 */ }
    }

    if (!result) {
      // 3차: valid 키워드 직접 추출 (최후 수단)
      const validMatch = text.match(/"valid"\s*:\s*(true|false)/i);
      const reasonMatch = text.match(/"reason"\s*:\s*"([^"]+)"/);
      if (validMatch) {
        result = {
          valid: validMatch[1].toLowerCase() === "true",
          confidence: "medium",
          reason: reasonMatch?.[1] || "AI 분석 완료",
        };
      }
    }

    if (!result) {
      console.warn("[verify-photo] JSON 파싱 실패, 원문:", text);
      return Response.json({
        valid: true,
        confidence: "low",
        reason: "AI 응답 파싱 오류 — 사진이 정상 등록됩니다.",
        skipped: true,
      });
    }

    return Response.json({
      valid: !!result.valid,
      confidence: result.confidence || "medium",
      reason: result.reason || "",
    });
  } catch (err) {
    console.error("[verify-photo] 서버 오류:", err);
    return Response.json({
      valid: false,
      confidence: "low",
      reason: "AI 검증 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      serverError: true,
    });
  }
}
