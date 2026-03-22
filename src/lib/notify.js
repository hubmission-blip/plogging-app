// 로컬 푸시 알림 전송
export function sendNotification(title, body, icon = "/icons/icon-192.png") {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  new Notification(title, { body, icon });
}

// 플로깅 완료 알림
export function notifyPloggingComplete(distance, points) {
  sendNotification(
    "🎉 플로깅 완료!",
    `${distance.toFixed(2)}km 완주! +${points}P 적립됐어요!`
  );
}

// 오늘의 미션 알림 (앱 시작 시 호출)
export function notifyDailyMission() {
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
}