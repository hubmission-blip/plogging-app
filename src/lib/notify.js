// 로컬 푸시 알림 전송
export function sendNotification(title, body, icon = "/icons/icon-192.png") {
  if (typeof window === "undefined") return; // SSR 방어
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    new Notification(title, { body, icon });
  } catch (e) { console.warn("알림 생성 실패:", e); }
}

// 플로깅 완료 알림
export function notifyPloggingComplete(distance, points) {
  sendNotification(
    "🎉 플로깅 완료!",
    `${(distance || 0).toFixed(2)}km 완주! +${points || 0}P 적립됐어요!`
  );
}

// 오늘의 미션 알림 (앱 시작 시 호출)
export function notifyDailyMission() {
  if (typeof window === "undefined") return;
  try {
    const lastNotified = localStorage.getItem("lastMissionNotify");
    const today = new Date().toDateString();
    if (lastNotified === today) return;

    localStorage.setItem("lastMissionNotify", today);
    setTimeout(() => {
      sendNotification(
        "🌿 오늘의 미션",
        "2km 플로깅 완주하고 +200P 보너스 받아요!"
      );
    }, 5000);
  } catch (e) { console.warn("미션 알림 실패:", e); }
}
