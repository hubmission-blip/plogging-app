// 주차별 색상
export const WEEK_COLORS = {
  1: "#4CAF50",
  2: "#2196F3",
  3: "#FF9800",
  4: "#9C27B0",
};

export const WEEK_LABELS = {
  1: "이번 주",
  2: "1주 전",
  3: "2주 전",
  4: "3주 전+",
};

// ✅ 완전히 새로운 방식 - 절대 시간 기반 (오차 없음)
export function getWeekNumber() {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  // 2024-01-01 기준으로 몇 번째 주인지 계산
  const reference = new Date("2024-01-01T00:00:00+09:00").getTime();
  return Math.floor((Date.now() - reference) / msPerWeek);
}

// 만료일 (28일 후)
export function getExpiresAt() {
  const date = new Date();
  date.setDate(date.getDate() + 28);
  return date;
}

// 만료 여부
export function isExpired(expiresAt) {
  if (!expiresAt) return false;
  const expDate = expiresAt.toDate ? expiresAt.toDate() : new Date(expiresAt);
  return new Date() > expDate;
}

// ✅ 상대 주차 계산
export function getRelativeWeek(savedWeekNumber) {
  if (savedWeekNumber === null || savedWeekNumber === undefined) return 1;
  const current = getWeekNumber();
  const diff = current - savedWeekNumber;
  if (diff <= 0) return 1;
  if (diff === 1) return 2;
  if (diff === 2) return 3;
  return 4;
}

// 동선 색상
export function getRouteColor(savedWeekNumber) {
  const relWeek = getRelativeWeek(savedWeekNumber);
  return WEEK_COLORS[relWeek] || WEEK_COLORS[4];
}