// 주차별 색상 (1주=초록, 2주=파랑, 3주=주황, 4주=보라)
export const WEEK_COLORS = {
  1: "#4CAF50",  // 초록
  2: "#2196F3",  // 파랑
  3: "#FF9800",  // 주황
  4: "#9C27B0",  // 보라
};

export const WEEK_LABELS = {
  1: "이번 주",
  2: "2주 전",
  3: "3주 전",
  4: "4주 전",
};

// 현재 주차 번호 계산 (앱 기준 상대 주차)
export function getWeekNumber() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
}

// 만료일 계산 (저장일 기준 4주 후)
export function getExpiresAt() {
  const date = new Date();
  date.setDate(date.getDate() + 28); // 28일 후
  return date;
}

// 만료 여부 확인
export function isExpired(expiresAt) {
  if (!expiresAt) return false;
  const expDate = expiresAt.toDate ? expiresAt.toDate() : new Date(expiresAt);
  return new Date() > expDate;
}

// weekNumber → 상대 주차(1~4) 변환
export function getRelativeWeek(savedWeekNumber) {
  const current = getWeekNumber();
  const diff = current - savedWeekNumber;
  if (diff <= 0) return 1;
  if (diff === 1) return 2;
  if (diff === 2) return 3;
  if (diff === 3) return 4;
  return 4;
}

// 동선 색상 반환
export function getRouteColor(savedWeekNumber) {
  const relWeek = getRelativeWeek(savedWeekNumber);
  return WEEK_COLORS[relWeek] || WEEK_COLORS[4];
}