"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

/**
 * 🔔 알림 벨 컴포넌트
 * - 에러 격리: 이 컴포넌트에서 에러가 나도 부모 페이지에 영향 없음
 * - 확장성: fetchSources 배열에 새 알림 소스를 추가하면 자동 집계
 * - 안전성: user가 완전히 준비된 후에만 쿼리 실행
 */
export default function NotificationBell({ user }) {
  const [count, setCount] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // user가 없거나 uid가 없으면 실행하지 않음
    if (!user?.uid) { setCount(0); setReady(true); return; }

    let cancelled = false;

    const fetchAllUnread = async () => {
      try {
        let total = 0;

        // ─── 알림 소스 1: 동아리(clubs) 알림 ───────────────
        try {
          const clubQ = query(
            collection(db, "clubs"),
            where("memberUids", "array-contains", user.uid)
          );
          const clubSnap = await getDocs(clubQ);
          for (const clubDoc of clubSnap.docs) {
            const nSnap = await getDocs(
              collection(db, "clubs", clubDoc.id, "notices")
            );
            nSnap.forEach((n) => {
              if (!n.data().readBy?.includes(user.uid)) total++;
            });
          }
        } catch (e) {
          console.warn("[NotificationBell] 동아리 알림 조회 실패:", e.message);
        }

        // ─── 알림 소스 2: (차후 확장) 앱 공지 등 ─────────
        // try {
        //   const appQ = query(
        //     collection(db, "app_notifications"),
        //     where("targetUids", "array-contains", user.uid),
        //     where("readBy", "not-in", [user.uid])  // 또는 클라이언트 필터
        //   );
        //   ...
        // } catch (e) { ... }

        // ─── 알림 소스 3: (차후 확장) 그룹 알림 등 ────────
        // 필요 시 여기에 추가

        if (!cancelled) { setCount(total); setReady(true); }
      } catch (e) {
        console.warn("[NotificationBell] 전체 알림 조회 실패:", e.message);
        if (!cancelled) { setCount(0); setReady(true); }
      }
    };

    // 약간의 지연을 줘서 Auth 상태가 Firestore에 완전히 반영된 후 실행
    const timer = setTimeout(fetchAllUnread, 1500);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [user?.uid]);

  // 로그인 전이거나 준비 안 됐으면 아무것도 안 보임
  if (!user) return null;

  return (
    <Link href="/club" className="relative flex items-center">
      <span className="text-xl">🔔</span>
      {ready && count > 0 && (
        <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
