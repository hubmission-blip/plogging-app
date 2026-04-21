// ─── 영수증 OCR 유틸리티 (Tesseract.js) ──────────────────
// 브라우저에서 실행, 한글+영어+숫자 인식
// 사용 전 npm install tesseract.js 필요

import { createWorker } from "tesseract.js";

let worker = null;

// 워커 초기화 (최초 1회, 이후 재사용)
async function getWorker() {
  if (worker) return worker;
  worker = await createWorker("kor+eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text") {
        // 진행률 로그 (디버깅용)
        // console.log(`[OCR] ${Math.round(m.progress * 100)}%`);
      }
    },
  });
  return worker;
}

/**
 * 이미지 파일에서 텍스트 추출
 * @param {File|Blob|string} image - File 객체, Blob, 또는 이미지 URL
 * @returns {Promise<{ text: string, confidence: number }>}
 */
export async function extractText(image) {
  try {
    const w = await getWorker();
    const { data } = await w.recognize(image);
    return {
      text: data.text.trim(),
      confidence: Math.round(data.confidence),
    };
  } catch (e) {
    console.warn("[OCR] 텍스트 추출 실패:", e);
    return { text: "", confidence: 0 };
  }
}

/**
 * 영수증 텍스트에서 핵심 정보 추출 (매장명, 금액, 날짜)
 * @param {string} rawText - OCR로 추출한 원본 텍스트
 * @returns {{ storeName: string|null, amount: number|null, date: string|null }}
 */
export function parseReceiptInfo(rawText) {
  if (!rawText) return { storeName: null, amount: null, date: null };

  const lines = rawText.split("\n").map(l => l.trim()).filter(Boolean);

  // 매장명: 보통 첫 몇 줄에 위치
  const storeName = lines[0] || null;

  // 금액: "합계", "총", "결제", "금액" 키워드 근처의 숫자
  let amount = null;
  for (const line of lines) {
    if (/합계|총액|결제|금액|Total/i.test(line)) {
      const nums = line.match(/[\d,]+/g);
      if (nums) {
        // 가장 큰 숫자를 금액으로 추정
        const parsed = nums.map(n => parseInt(n.replace(/,/g, ""), 10)).filter(n => n > 0);
        if (parsed.length > 0) amount = Math.max(...parsed);
      }
    }
  }

  // 날짜: YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD 패턴
  let date = null;
  for (const line of lines) {
    const dateMatch = line.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
    if (dateMatch) {
      date = `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`;
      break;
    }
  }

  return { storeName, amount, date };
}
