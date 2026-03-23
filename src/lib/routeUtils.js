// 주차별 색상 (1주=초록, 2주=파랑, 3주=주황, 4주=보라)
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

// ✅ 한국 시간(KST) 기준 + 고정 기준점으로 안정적인 주차 계산
export function getWeekNumber() {
  const now = new Date();

  // 한국 시간 보정 (UTC+9)
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + kstOffset);

  // 이번 주 월요일 구하기
  const day = kstNow.getUTCDay(); // 0=일, 1=월 ... 6=토
  const daysToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(kstNow);
  monday.setUTCDate(kstNow.getUTCDate() - daysToMonday);
  monday.setUTCHours(0, 0, 0, 0);

  // 고정 기준점: 2024년 1월 1일 (안정적인 주차 계산)
  const reference = new Date("2024-01-01T00:00:00Z");

  return Math.floor((monday - reference) / (7 * 24 * 60 * 60 * 1000));
}

// 만료일 계산 (저장일 기준 4주 후)
export function getExpiresAt() {
  const date = new Date();
  date.setDate(date.getDate() + 28);
  return date;
}

// 만료 여부 확인
export function isExpired(expiresAt) {
  if (!expiresAt) return false;
  const expDate = expiresAt.toDate ? expiresAt.toDate() : new Date(expiresAt);
  return new Date() > expDate;
}

// ✅ weekNumber → 상대 주차(1~4) 변환
export function getRelativeWeek(savedWeekNumber) {
  if (!savedWeekNumber && savedWeekNumber !== 0) return 1;
  const current = getWeekNumber();
  const diff = current - savedWeekNumber;
  if (diff <= 0) return 1; // 이번 주
  if (diff === 1) return 2; // 1주 전
  if (diff === 2) return 3; // 2주 전
  return 4;                 // 3주 전+
}

// 동선 색상 반환
export function getRouteColor(savedWeekNumber) {
  const relWeek = getRelativeWeek(savedWeekNumber);
  return WEEK_COLORS[relWeek] || WEEK_COLORS[4];
}
