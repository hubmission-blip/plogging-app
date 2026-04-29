"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

/**
 * 🔔 알림 벨 컴포넌트 (팝업 방식)
 * - 벨 클릭 → 알림 목록 팝업 표시
 * - 개별 알림 클릭 → 해당 페이지로 이동
 * - 에러 격리: 이 컴포넌트에서 에러가 나도 부모 페이지에 영향 없음
 * - 확장성: fetchSources에 새 알림 소스 추가 가능
 */
export default function NotificationBell({ user }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [ready, setReady] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const popupRef = useRef(null);

  // 팝업 바깥 클릭 시 닫기
  useEffect(() => {
    if (!showPopup) return;
    const handleClickOutside = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setShowPopup(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPopup]);

  // 알림 데이터 로드
  useEffect(() => {
    if (!user?.uid) { setNotifications([]); setUnreadCount(0); setReady(true); return; }

    let cancelled = false;

    const fetchAllNotifications = async () => {
      try {
        const allNotices = [];

        // ─── 알림 소스 1: 동아리(clubs) 알림 ───────────────
        try {
          const clubQ = query(
            collection(db, "clubs"),
            where("memberUids", "array-contains", user.uid)
          );
          const clubSnap = await getDocs(clubQ);
          for (const clubDoc of clubSnap.docs) {
            const clubData = clubDoc.data();
            const clubName = clubData.name || "동아리";
            const clubEmoji = clubData.emoji || "🏅";
            const nSnap = await getDocs(
              collection(db, "clubs", clubDoc.id, "notices")
            );
            nSnap.forEach((n) => {
              const data = n.data();
              allNotices.push({
                id: n.id,
                type: "club",
                source: `${clubEmoji} ${clubName}`,
                message: data.message || "",
                senderName: data.senderName || "알 수 없음",
                isRead: data.readBy?.includes(user.uid) || false,
                createdAt: data.createdAt?.seconds || 0,
                link: `/club`,
                clubCode: clubDoc.id,
              });
            });
          }
        } catch (e) {
          console.warn("[NotificationBell] 동아리 알림 조회 실패:", e.message);
        }

        // ─── 알림 소스 2: (차후 확장) 앱 공지 등 ─────────
        // allNotices.push({ type: "app", source: "📢 앱 공지", ... })

        // ─── 알림 소스 3: (차후 확장) 그룹 알림 등 ────────
        // allNotices.push({ type: "group", source: "👥 그룹", ... })

        // 최신순 정렬
        allNotices.sort((a, b) => b.createdAt - a.createdAt);

        if (!cancelled) {
          setNotifications(allNotices.slice(0, 30));
          setUnreadCount(allNotices.filter((n) => !n.isRead).length);
          setReady(true);
        }
      } catch (e) {
        console.warn("[NotificationBell] 전체 알림 조회 실패:", e.message);
        if (!cancelled) { setNotifications([]); setUnreadCount(0); setReady(true); }
      }
    };

    fetchAllNotifications();
    return () => { cancelled = true; };
  }, [user?.uid]);

  if (!user) return null;

  const formatTime = (seconds) => {
    if (!seconds) return "";
    const date = new Date(seconds * 1000);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return "방금";
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
    return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
  };

  const handleNoticeClick = (notice) => {
    setShowPopup(false);
    router.push(notice.link);
  };

  return (
    <div className="relative" ref={popupRef}>
      {/* 벨 아이콘 */}
      <button
        onClick={() => setShowPopup((p) => !p)}
        className="relative flex items-center active:scale-90 transition-transform"
      >
        <Bell className="w-[22px] h-[22px] text-gray-500" strokeWidth={2} />
        {ready && unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* 팝업 */}
      {showPopup && (
        <>
          {/* 배경 오버레이 */}
          <div className="fixed inset-0 bg-black/20 z-[199]" />

          {/* 알림 패널 */}
          <div className="fixed top-0 right-0 w-full max-w-sm h-[70vh] bg-white rounded-b-2xl shadow-2xl z-[200] flex flex-col animate-slide-down"
            style={{ animation: "slideDown 0.25s ease-out" }}>

            {/* 헤더 */}
            <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
              <h3 className="font-black text-gray-800 text-base">
                알림 {unreadCount > 0 && <span className="text-red-500 text-sm font-bold ml-1">{unreadCount}개 새 알림</span>}
              </h3>
              <button onClick={() => setShowPopup(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* 알림 목록 */}
            <div className="flex-1 overflow-y-auto">
              {notifications.length > 0 ? (
                <div className="divide-y divide-gray-50">
                  {notifications.map((n) => (
                    <button key={`${n.type}-${n.id}`}
                      onClick={() => handleNoticeClick(n)}
                      className={`w-full text-left px-4 py-3 flex gap-3 items-start active:bg-gray-50 transition-colors
                        ${!n.isRead ? "bg-cyan-50/50" : ""}`}>
                      {/* 읽지 않음 표시 */}
                      <div className="flex-shrink-0 pt-1">
                        {!n.isRead
                          ? <span className="block w-2 h-2 rounded-full bg-red-500" />
                          : <span className="block w-2 h-2 rounded-full bg-transparent" />
                        }
                      </div>
                      {/* 내용 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-xs font-bold text-gray-500">{n.source}</span>
                          <span className="text-[10px] text-gray-300 ml-auto flex-shrink-0">{formatTime(n.createdAt)}</span>
                        </div>
                        <p className="text-sm text-gray-700 leading-snug line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{n.senderName}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                  <Bell className="w-10 h-10 text-gray-200 mb-3" />
                  <p className="text-sm text-gray-400 font-medium">알림이 없어요</p>
                  <p className="text-xs text-gray-300 mt-1">동아리에서 새 소식이 오면 여기에 표시됩니다</p>
                </div>
              )}
            </div>

            {/* 하단 바 */}
            {notifications.length > 0 && (
              <div className="border-t border-gray-100 px-4 py-2.5">
                <button onClick={() => { setShowPopup(false); router.push("/club"); }}
                  className="w-full text-center text-xs font-bold text-cyan-600 py-1 active:text-cyan-800">
                  동아리에서 전체 확인하기 →
                </button>
              </div>
            )}
          </div>

          {/* 슬라이드 애니메이션 */}
          <style jsx>{`
            @keyframes slideDown {
              from { transform: translateY(-20px); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
          `}</style>
        </>
      )}
    </div>
  );
}
