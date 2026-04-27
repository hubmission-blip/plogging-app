// ─── 녹색생활 실천 AI 사진 검증 API ──────────────────────────────
// Anthropic Claude Vision API로 카테고리별 사진 진위를 확인합니다.
// 환경변수: ANTHROPIC_API_KEY (서버 측 비공개)

// 카테고리별 검증 프롬프트
const VERIFY_PROMPTS = {
  tumbler: {
    pass: [
      "스테인리스, 유리, 세라믹, 실리콘 등 재사용 가능한 소재의 텀블러/보온병/머그컵이 명확히 보이는 경우",
      "텀블러에 음료가 담겨 있거나 카페에서 텀블러를 사용하는 장면",
      "개인 텀블러/보온병을 들고 있는 사람",
    ],
    fail: [
      "종이컵(갈색, 흰색, 로고가 인쇄된 일회용 컵)이 보이는 경우 — 반드시 거부",
      "일회용 플라스틱 컵(투명 테이크아웃 컵, 아이스컵)이 보이는 경우 — 반드시 거부",
      "편의점/카페에서 제공하는 일회용 음료컵이 보이는 경우 — 반드시 거부",
      "음료 용기가 전혀 보이지 않는 경우",
      "텀블러와 무관한 사진 (음식, 풍경 등)",
      "컵의 소재가 종이인지 다회용인지 불분명한 경우 — 거부 (확실한 경우만 통과)",
    ],
  },
  cupreturn: {
    pass: [
      "일회용컵 반환기(자판기 모양 기계)가 보이는 경우",
      "일회용컵을 반환기에 넣는 장면",
      "반환 완료 화면이 표시된 기계 화면",
      "일회용 플라스틱컵을 모아서 들고 있는 경우",
    ],
    fail: [
      "반환기나 일회용컵이 전혀 보이지 않는 경우",
      "컵과 무관한 사진",
    ],
  },
  ereceipt: {
    pass: [
      "스마트폰 화면에 전자영수증이 표시된 경우",
      "카카오톡, 네이버, 앱 등의 전자영수증 알림 화면",
      "매장명, 금액, 날짜가 포함된 디지털 영수증 캡처",
      "종이 영수증 대신 전자영수증을 선택하는 화면",
    ],
    fail: [
      "종이 영수증만 보이는 경우",
      "영수증이나 결제 내역이 전혀 없는 경우",
    ],
  },
  refillstation: {
    pass: [
      "리필스테이션(세제/샴푸 등을 리필하는 기계/매장)이 보이는 경우",
      "개인 용기에 세제나 샴푸를 리필하는 장면",
      "리필스테이션 매장 내부나 리필 기계",
      "리필된 용기를 들고 있는 사진",
    ],
    fail: [
      "리필이나 세제/샴푸 관련 내용이 전혀 없는 경우",
    ],
  },
  container: {
    pass: [
      "다회용기에 배달 음식이 담겨 있는 경우",
      "배달 음식의 다회용(스테인리스, 유리 등) 용기",
      "다회용기 배달 서비스 로고나 안내문이 보이는 경우",
      "일회용이 아닌 견고한 배달 용기",
    ],
    fail: [
      "일회용 플라스틱 배달 용기만 보이는 경우",
      "배달 음식이나 용기가 전혀 없는 경우",
    ],
  },
  evrental: {
    pass: [
      "전기차(충전 포트, EV 로고 등)가 보이는 경우",
      "전기차 충전 중인 장면",
      "카셰어링 앱의 전기차 대여 화면",
      "수소차 또는 하이브리드 차량",
      "차량 번호판이나 차량 외관이 보이는 경우",
    ],
    fail: [
      "차량이 전혀 보이지 않는 경우",
      "차량과 무관한 사진",
    ],
  },
  ecoproduct: {
    pass: [
      "환경마크, 녹색인증 마크, GR마크가 제품에 부착된 경우",
      "친환경 인증 라벨이 보이는 제품",
      "에코 라벨, 탄소 라벨 등 환경 인증 마크가 있는 제품",
      "친환경 세제, 화장지, 문구류 등의 제품",
    ],
    fail: [
      "제품이나 인증 마크가 전혀 보이지 않는 경우",
      "일반 제품으로 환경 인증 표시가 없는 경우",
    ],
  },
  qualityrecycle: {
    pass: [
      "깨끗하게 세척된 재활용품(페트병, 캔, 유리병 등)이 정리된 경우",
      "라벨이 제거된 페트병이 보이는 경우",
      "분리수거함 앞에 정리된 재활용품",
      "재활용품을 종류별로 분류한 모습",
    ],
    fail: [
      "재활용품이 전혀 보이지 않는 경우",
      "분리배출과 무관한 사진",
    ],
  },
  phonereturn: {
    pass: [
      "폐휴대폰 수거함이 보이는 경우",
      "사용하지 않는 오래된 휴대폰을 들고 있는 경우",
      "우체국이나 대리점의 폐휴대폰 수거 장소",
      "여러 대의 오래된 휴대폰이 모여있는 경우",
    ],
    fail: [
      "휴대폰이나 수거함이 전혀 보이지 않는 경우",
    ],
  },
  futuregen: {
    pass: [
      "환경 교육, 캠페인, 봉사활동 현장 사진",
      "환경 관련 수료증이나 인증서",
      "환경 행사 참여 모습 (플래카드, 부스 등)",
      "생태체험, 환경 워크숍 등의 장면",
      "여러 사람이 모인 환경 활동 현장",
    ],
    fail: [
      "환경 활동과 전혀 관련 없는 일상 사진",
    ],
  },
  sharedbike: {
    pass: [
      "공유자전거(따릉이, 카카오바이크 등)가 보이는 경우",
      "자전거를 타고 있거나 자전거 옆에 서 있는 경우",
      "공유자전거 대여소/거치대가 보이는 경우",
      "전동킥보드(공유형)가 보이는 경우",
      "자전거 앱의 이용 화면",
    ],
    fail: [
      "자전거나 킥보드가 전혀 보이지 않는 경우",
    ],
  },
  zerowaste: {
    pass: [
      "깨끗이 비운 식판, 그릇, 접시가 보이는 경우",
      "음식을 남기지 않고 다 먹은 식판/그릇",
      "잔반 없이 깨끗한 빈 그릇",
      "구내식당이나 식당에서 빈 식판",
    ],
    fail: [
      "음식이 많이 남아있는 경우",
      "식판이나 그릇이 전혀 보이지 않는 경우",
    ],
  },
  treeplanting: {
    pass: [
      "나무를 심는 장면이나 심은 나무가 보이는 경우",
      "삽, 물뿌리개와 함께 묘목이 보이는 경우",
      "나무심기 행사 현장 (플래카드, 단체 사진 등)",
      "새로 심은 어린 나무(묘목)가 흙에 심겨진 모습",
      "식목일 행사나 나무심기 캠페인 현장",
    ],
    fail: [
      "나무나 식물이 전혀 보이지 않는 경우",
      "나무심기와 무관한 단순 풍경",
    ],
  },
  solarpanel: {
    pass: [
      "태양광 패널이 설치된 모습 (베란다, 옥상 등)",
      "미니 태양광 발전소 설치 장면",
      "태양광 패널 제품 박스나 설치 과정",
      "태양광 인버터나 관련 장비",
    ],
    fail: [
      "태양광 패널이나 관련 장비가 전혀 보이지 않는 경우",
    ],
  },
  recycledproduct: {
    pass: [
      "재생원료로 만든 제품 (재생지, 재생 플라스틱 등)",
      "GR마크, 환경마크 등 재생원료 인증이 있는 제품",
      "업사이클링 제품이 보이는 경우",
      "재생 소재 표시가 있는 제품 패키지",
    ],
    fail: [
      "제품이 전혀 보이지 않는 경우",
      "재생원료 관련 표시가 없는 일반 제품만 보이는 경우",
    ],
  },
  ecobag: {
    pass: [
      "천 장바구니, 에코백, 재사용 쇼핑백이 보이는 경우",
      "장바구니에 물건이 담긴 모습",
      "마트나 시장에서 개인 장바구니를 사용하는 장면",
      "접이식 장바구니나 대형 에코백",
    ],
    fail: [
      "비닐봉투만 보이는 경우",
      "장바구니나 에코백이 전혀 보이지 않는 경우",
    ],
  },
  owncontainer: {
    pass: [
      "개인 용기(밀폐용기, 도시락통 등)에 음식이 담긴 경우",
      "매장에서 개인 용기로 포장받는 장면",
      "반찬가게나 식당에서 개인 용기를 사용하는 모습",
      "개인 텀블러/용기를 들고 있는 사진",
    ],
    fail: [
      "개인 용기가 전혀 보이지 않는 경우",
      "일회용 포장만 보이는 경우",
    ],
  },
};

export async function POST(request) {
  try {
    const { imageBase64, mimeType, category } = await request.json();

    if (!imageBase64 || !mimeType || !category) {
      return Response.json(
        { valid: false, confidence: "low", reason: "필수 데이터가 누락되었습니다." },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === "your-anthropic-api-key-here") {
      console.warn("[verify-eco] ANTHROPIC_API_KEY 미설정 → 검증 생략");
      return Response.json({
        valid: true,
        confidence: "low",
        reason: "AI 검증 서비스가 설정되지 않아 자동 승인됩니다.",
        skipped: true,
      });
    }

    // 카테고리별 프롬프트 조합
    const prompt = VERIFY_PROMPTS[category];
    if (!prompt) {
      return Response.json({
        valid: true,
        confidence: "low",
        reason: "해당 카테고리의 검증 기준이 없어 자동 승인됩니다.",
        skipped: true,
      });
    }

    const passRules = prompt.pass.map((r, i) => `${i + 1}. ${r}`).join("\n");
    const failRules = prompt.fail.map((r, i) => `${i + 1}. ${r}`).join("\n");

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
                text: `이 사진이 녹색생활 실천 인증 사진으로 적합한지 판단해주세요.
카테고리: ${category}

[통과 기준 - 아래 중 하나라도 해당되면 valid=true]
${passRules}

[거부 기준 - 아래에 해당하면 valid=false]
${failRules}

판단 시 주의사항:
- 해당 물체가 작게 보이거나 배경에 있어도, 확실히 식별 가능하면 인정합니다.
- 사진 품질이 다소 낮아도 대상이 명확히 식별 가능하면 인정합니다.
- 일회용품과 다회용품을 정확히 구분하세요. 종이컵, 일회용 플라스틱컵은 텀블러가 아닙니다.
- 애매하거나 불분명한 경우에는 valid=false로 판단하세요. 확실한 경우만 통과시킵니다.
- 거부 기준에 하나라도 해당되면 반드시 valid=false로 판단하세요.

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
      console.error("[verify-eco] Anthropic API 오류:", response.status, errText);
      return Response.json({
        valid: true, confidence: "low",
        reason: "AI 검증 서버 오류로 자동 승인됩니다.",
        skipped: true,
      });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "";

    // JSON 파싱 (기존 verify-photo와 동일한 3단계 파싱)
    let result = null;
    try {
      const stripped = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      if (stripped.startsWith("{")) result = JSON.parse(stripped);
    } catch (_) {}

    if (!result) {
      try {
        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");
        if (start !== -1 && end !== -1 && end > start) {
          result = JSON.parse(text.slice(start, end + 1));
        }
      } catch (_) {}
    }

    if (!result) {
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
      return Response.json({
        valid: true, confidence: "low",
        reason: "AI 응답 파싱 오류 — 자동 승인됩니다.",
        skipped: true,
      });
    }

    return Response.json({
      valid: !!result.valid,
      confidence: result.confidence || "medium",
      reason: result.reason || "",
    });
  } catch (err) {
    console.error("[verify-eco] 서버 오류:", err);
    return Response.json({
      valid: true, confidence: "low",
      reason: "AI 검증 중 오류 — 자동 승인됩니다.",
      skipped: true,
    });
  }
}
