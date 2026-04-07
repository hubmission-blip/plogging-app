// src/lib/routeUtils.js
// ─── 경로 관련 유틸리티 ─────────────────────────────────────
//
// ⚠️ 수정 이력:
//   - getWeekNumber(): ISO 연간 주차(1~52) → 절대 주차(epoch 기준)로 변경
//     기존 ISO 주차는 월요일 시작 + 연말/연초 경계에서 오류 발생
//     (예: 일요일 = 이전 주로 계산 → "어제가 2주전"으로 표시되는 버그)
//   - getWeekLabel() 신규 추가: createdAt Timestamp → "이번 주 / 1주 전 / ..." 텍스트

// ─── 주차별 색상 / 텍스트 ────────────────────────────────────
const WEEK_COLORS = ["#4CAF50", "#FF9800", "#FF5722", "#B71C1C"];
const WEEK_LABELS = ["이번 주", "1주 전", "2주 전", "3주 전"];

// ─── 절대 주차 Epoch ─────────────────────────────────────────
// 2020-01-06(월)을 기준으로 삼아 항상 7일 단위의 절대 주차 번호를 생성
const WEEK_EPOCH_MS = new Date("2020-01-06T00:00:00+09:00").getTime();

// ─── 현재 절대 주차 번호 반환 ─────────────────────────────────
// 경로 저장 시 사용 (Firestore weekNumber 필드에 저장)
export function getWeekNumber() {
  return Math.floor((Date.now() - WEEK_EPOCH_MS) / (7 * 24 * 60 * 60 * 1000));
}

// ─── 저장된 weekNumber → 경과 주차 인덱스 (0~3) ───────────────
function weekDiff(weekNumber) {
  const current = getWeekNumber();
  return Math.min(Math.max(current - (weekNumber || 0), 0), 3);
}

// ─── createdAt Timestamp → 경과 주차 인덱스 (0~3) ────────────
// Firestore Timestamp, JS Date, ms 숫자 모두 지원
function weeksAgoFromDate(createdAt) {
  let ms;
  if (!createdAt) return 0;
  if (typeof createdAt.toMillis === "function") {
    ms = createdAt.toMillis();
  } else if (createdAt instanceof Date) {
    ms = createdAt.getTime();
  } else if (typeof createdAt === "number") {
    ms = createdAt;
  } else {
    ms = Date.now();
  }
  const daysAgo = Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24));
  return Math.min(Math.floor(daysAgo / 7), 3); // 0, 1, 2, 3
}

// ─── 경로 색상 반환 ──────────────────────────────────────────
// weekNumber: 저장된 절대 주차 번호 (Firestore 필드)
export function getRouteColor(weekNumber) {
  return WEEK_COLORS[weekDiff(weekNumber)] ?? WEEK_COLORS[3];
}

// ─── 주차 텍스트 레이블 반환 (createdAt 기준) ─────────────────
// createdAt: Firestore Timestamp (toMillis 있음) 또는 Date
// 반환: "이번 주" | "1주 전" | "2주 전" | "3주 전"
// ✅ 이 함수를 사용해야 "어제 → 이번 주" 가 정확히 표시됨
export function getWeekLabel(createdAt) {
  const idx = weeksAgoFromDate(createdAt);
  return WEEK_LABELS[idx];
}

// ─── 색상도 createdAt 기준으로 반환 (지도 페이지 fetchPastRoutes용) ─
export function getRouteColorByDate(createdAt) {
  const idx = weeksAgoFromDate(createdAt);
  return WEEK_COLORS[idx] ?? WEEK_COLORS[3];
}

// ─── 만료일 계산 (28일 후) ────────────────────────────────────
export function getExpiresAt() {
  const d = new Date();
  d.setDate(d.getDate() + 28);
  return d;
}

// ─── 만료 여부 확인 ──────────────────────────────────────────
export function isExpired(expiresAt) {
  if (!expiresAt) return false;
  const expMs =
    typeof expiresAt.toMillis === "function"
      ? expiresAt.toMillis()
      : new Date(expiresAt).getTime();
  return Date.now() > expMs;
}