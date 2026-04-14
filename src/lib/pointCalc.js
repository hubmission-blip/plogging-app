// 포인트 계산 기준
// 이동거리 1km = 50포인트
// 완주 보너스 = 100포인트 (2km 이상 완주 시)
// 연속 참여 보너스 = 30포인트 (전날도 플로깅 시)
// 에코마일리지 연동 보너스 = 기본 포인트의 20% 추가

// 에코마일리지 연동 프로그램 목록
export const ECOMILEAGE_PROGRAMS = [
  { id: "seoul",    label: "서울 에코마일리지",      icon: "🌿", desc: "서울시 독자 운영 프로그램" },
  { id: "carbon",   label: "탄소중립포인트",          icon: "🌍", desc: "환경부 전국 운영 프로그램" },
  { id: "greencard",label: "그린카드",                icon: "💳", desc: "NH농협·신한·KB 제휴 카드" },
  { id: "local",    label: "지자체 에코마일리지",     icon: "🏙️", desc: "지역 환경 포인트 프로그램" },
];

export const ECOMILEAGE_BONUS_RATE = 0.20; // 20% 추가

export function calculatePoints({ distanceKm, groupSize = 1, ecomileageLinked = false }) {
  let points = 0;
  let breakdown = [];

  // 거리 포인트: 1km = 50점
  const distancePoints = Math.floor(distanceKm * 50);
  points += distancePoints;
  breakdown.push({ label: `거리 (${distanceKm.toFixed(2)}km)`, points: distancePoints });

  // 완주 보너스: 2km 이상
  if (distanceKm >= 2) {
    points += 100;
    breakdown.push({ label: "완주 보너스 🎉", points: 100 });
  }

  // 그룹 참여 보너스: 그룹원 수 × 5
  if (groupSize > 1) {
    const groupBonus = groupSize * 5;
    points += groupBonus;
    breakdown.push({ label: `그룹 참여 보너스 (${groupSize}명)`, points: groupBonus });
  }

  // 에코마일리지 연동 보너스: 20% 추가
  if (ecomileageLinked && points > 0) {
    const ecoBonus = Math.floor(points * ECOMILEAGE_BONUS_RATE);
    if (ecoBonus > 0) {
      points += ecoBonus;
      breakdown.push({ label: "에코마일리지 연동 보너스 🌿", points: ecoBonus });
    }
  }

  return { total: points, breakdown };
}

// 포인트 등급 계산
export function getPointGrade(totalPoints) {
  if (totalPoints >= 5000) return { grade: "플래티넘 🏆", color: "#00BCD4" };
  if (totalPoints >= 2000) return { grade: "골드 🥇", color: "#FFC107" };
  if (totalPoints >= 500)  return { grade: "실버 🥈", color: "#9E9E9E" };
  return { grade: "브론즈 🥉", color: "#CD7F32" };
}