// 포인트 계산 기준
// 이동거리 1km = 50포인트
// 완주 보너스 = 100포인트 (2km 이상 완주 시)
// 연속 참여 보너스 = 30포인트 (전날도 플로깅 시)

export function calculatePoints({ distanceKm, groupSize = 1 }) {
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

  return { total: points, breakdown };
}

// 포인트 등급 계산
export function getPointGrade(totalPoints) {
  if (totalPoints >= 5000) return { grade: "플래티넘 🏆", color: "#00BCD4" };
  if (totalPoints >= 2000) return { grade: "골드 🥇", color: "#FFC107" };
  if (totalPoints >= 500)  return { grade: "실버 🥈", color: "#9E9E9E" };
  return { grade: "브론즈 🥉", color: "#CD7F32" };
}