"use client";

import { useState, useEffect } from "react";

export default function PushNotification() {
  const [permission, setPermission] = useState("default");
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!("Notification" in window)) return;
    setPermission(Notification.permission);
    // 알림 미설정 + 온보딩 완료된 사용자에게만 표시
    const onboarded = localStorage.getItem("onboarded");
    const dismissed = localStorage.getItem("pushDismissed");
    if (onboarded && !dismissed && Notification.permission === "default") {
      setTimeout(() => setShowBanner(true), 3000);
    }
  }, []);

  const requestPermission = async () => {
    const result = await Notification.requestPermission();
    setPermission(result);
    setShowBanner(false);
    if (result === "granted") {
      new Notification("오백원의 행복 🌿", {
        body: "알림이 설정됐어요! 플로깅 독려 알림을 받을 수 있어요 😊",
        icon: "/icons/icon-192.png",
      });
    }
  };

  const dismiss = () => {
    localStorage.setItem("pushDismissed", "true");
    setShowBanner(false);
  };

  if (!showBanner || permission !== "default") return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-50 animate-bounce-once">
      <div className="bg-white rounded-2xl shadow-xl border border-green-100 p-4">
        <div className="flex items-start gap-3">
          <div className="text-2xl">🔔</div>
          <div className="flex-1">
            <p className="font-bold text-sm text-gray-800">플로깅 알림 받기</p>
            <p className="text-xs text-gray-500 mt-0.5">
              오늘의 미션, 포인트 적립 알림을 받아보세요!
            </p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={requestPermission}
                className="bg-green-500 text-white text-xs px-3 py-1.5 rounded-lg font-bold"
              >
                ✅ 허용
              </button>
              <button
                onClick={dismiss}
                className="text-gray-400 text-xs px-3 py-1.5 rounded-lg border"
              >
                나중에
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}