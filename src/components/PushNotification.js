"use client";

import { useState, useEffect } from "react";

export default function PushNotification() {
  const [permission, setPermission] = useState("default");
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!("Notification" in window)) return;
    setPermission(Notification.permission);

    const onboarded = localStorage.getItem("onboarded");
    const dismissed = localStorage.getItem("pushDismissed");
    if (onboarded && !dismissed && Notification.permission === "default") {
      setTimeout(() => setShowBanner(true), 3000);
    }
  }, []);

  const requestPermission = async () => {
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      setShowBanner(false);

      if (result === "granted") {
        // ✅ 모바일/데스크탑 모두 지원하는 알림 방식
        if ("serviceWorker" in navigator) {
          const registration = await navigator.serviceWorker.ready;
          await registration.showNotification("오백원의 행복 🌿", {
            body: "알림이 설정됐어요! 플로깅 독려 알림을 받을 수 있어요 😊",
            icon: "/icons/icon-192.png",
            badge: "/icons/icon-192.png",
          });
        } else {
          // 서비스워커 없는 환경(데스크탑 fallback)
          new Notification("오백원의 행복 🌿", {
            body: "알림이 설정됐어요! 플로깅 독려 알림을 받을 수 있어요 😊",
            icon: "/icons/icon-192.png",
          });
        }
      }
    } catch (err) {
      console.error("알림 권한 요청 오류:", err);
    }
  };

  const dismiss = () => {
    localStorage.setItem("pushDismissed", "true");
    setShowBanner(false);
  };

  if (!showBanner || permission !== "default") return null;

  return (
    // ✅ animate-bounce-once → animate-bounce (Tailwind 기본 클래스)
    <div className="fixed top-4 left-4 right-4 z-50 animate-bounce">
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