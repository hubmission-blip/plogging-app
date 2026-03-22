"use client";

import { useState } from "react";

export default function LocationPermission({ onGrant, onDeny }) {
  const [requesting, setRequesting] = useState(false);

  const requestPermission = async () => {
    setRequesting(true);
    if (!navigator.geolocation) {
      alert("이 기기는 GPS를 지원하지 않습니다.");
      setRequesting(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => {
        setRequesting(false);
        onGrant?.();
      },
      () => {
        setRequesting(false);
        onDeny?.();
      }
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm mb-4 shadow-2xl">
        <div className="text-center mb-5">
          <div className="text-5xl mb-3">📍</div>
          <h2 className="text-xl font-bold text-gray-800">위치 권한 필요</h2>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            플로깅 동선을 기록하려면<br />
            위치 접근 권한이 필요합니다.
          </p>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 mb-5 space-y-2">
          {[
            { icon: "🗺️", text: "내 플로깅 경로 지도에 표시" },
            { icon: "📏", text: "이동 거리 자동 측정" },
            { icon: "🏆", text: "포인트 정확하게 적립" },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-2 text-sm text-gray-600">
              <span>{item.icon}</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>

        <button
          onClick={requestPermission}
          disabled={requesting}
          className="w-full bg-green-500 text-white py-3.5 rounded-xl font-bold text-base disabled:opacity-50 mb-2"
        >
          {requesting ? "권한 요청 중..." : "✅ 위치 권한 허용"}
        </button>
        <button
          onClick={onDeny}
          className="w-full text-gray-400 py-2 text-sm"
        >
          나중에 하기
        </button>
      </div>
    </div>
  );
}