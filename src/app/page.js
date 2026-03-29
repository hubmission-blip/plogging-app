"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import BannerSlider from "@/components/BannerSlider";
import CharacterGuide from "@/components/CharacterGuide";
import versionData from "@/lib/version.json";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, getDocs, getCountFromServer } from "firebase/firestore";

// ─── PWA 홈화면 추가 안내 모달 ───────────────────────────────
function InstallModal({ onClose }) {
  // iOS Safari 감지
  const isIOS = /iphone|ipad|ipod/i.test(
    typeof navigator !== "undefined" ? navigator.userAgent : ""
  );
  const isAndroid = /android/i.test(
    typeof navigator !== "undefined" ? navigator.userAgent : ""
  );

  return (
    <div className="fixed inset-0 bg-black/60 z-[300] flex items-end">
      <div className="w-full bg-white rounded-t-3xl p-6 shadow-2xl animate-slide-up">
        {/* 핸들 */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

        <div className="text-center mb-5">
          <div className="text-4xl mb-2">📲</div>
          <h2 className="text-lg font-black text-gray-800">홈 화면에 추가하기</h2>
          <p className="text-sm text-gray-500 mt-1">앱처럼 빠르게 접근할 수 있어요</p>
        </div>

        {/* iOS 안내 */}
        {isIOS && (
          <div className="space-y-3 mb-6">
            {[
              { step: "1", icon: "⬆️", text: "하단의 공유 버튼을 탭하세요" },
              { step: "2", icon: "➕", text: '"홈 화면에 추가"를 선택하세요' },
              { step: "3", icon: "✅", text: '"추가"를 탭하면 완료!' },
            ].map((s) => (
              <div key={s.step} className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3">
                <div className="w-7 h-7 rounded-full bg-green-500 text-white text-xs font-black flex items-center justify-center flex-shrink-0">
                  {s.step}
                </div>
                <span className="text-xl">{s.icon}</span>
                <p className="text-sm text-gray-700 font-medium">{s.text}</p>
              </div>
            ))}
            {/* iOS 공유 버튼 위치 안내 이미지 */}
            <div className="bg-blue-50 rounded-2xl px-4 py-3 flex items-center gap-2">
              <span className="text-xl">💡</span>
              <p className="text-xs text-blue-700">
                공유 버튼은 Safari 하단 가운데에 있는 <strong>□↑</strong> 모양 아이콘이에요
              </p>
            </div>
          </div>
        )}

        {/* Android 안내 */}
        {isAndroid && (
          <div className="space-y-3 mb-6">
            {[
              { step: "1", icon: "⋮",  text: "브라우저 우측 상단 메뉴(⋮)를 탭하세요" },
              { step: "2", icon: "➕", text: '"홈 화면에 추가"를 선택하세요' },
              { step: "3", icon: "✅", text: '"추가"를 탭하면 완료!' },
            ].map((s) => (
              <div key={s.step} className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3">
                <div className="w-7 h-7 rounded-full bg-green-500 text-white text-xs font-black flex items-center justify-center flex-shrink-0">
                  {s.step}
                </div>
                <span className="text-xl font-bold">{s.icon}</span>
                <p className="text-sm text-gray-700 font-medium">{s.text}</p>
              </div>
            ))}
          </div>
        )}

        {/* PC / 기타 */}
        {!isIOS && !isAndroid && (
          <div className="space-y-3 mb-6">
            {[
              { step: "1", icon: "🖥️", text: "브라우저 주소창 오른쪽 설치 아이콘(⊕)을 클릭하세요" },
              { step: "2", icon: "✅", text: '"설치"를 클릭하면 완료!' },
            ].map((s) => (
              <div key={s.step} className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3">
                <div className="w-7 h-7 rounded-full bg-green-500 text-white text-xs font-black flex items-center justify-center flex-shrink-0">
                  {s.step}
                </div>
                <span className="text-xl">{s.icon}</span>
                <p className="text-sm text-gray-700 font-medium">{s.text}</p>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full bg-green-500 text-white py-3.5 rounded-2xl font-bold text-base"
        >
          확인했어요 ✓
        </button>
      </div>
    </div>
  );
}

const HOW_TO = [
  { step: 1, icon: "📍", title: "위치 허용",   desc: "앱 첫 실행 시 위치 권한을 허용해주세요" },
  { step: 2, icon: "🚶", title: "플로깅 시작", desc: "지도 페이지에서 시작 버튼을 누르세요" },
  { step: 3, icon: "🏁", title: "플로깅 종료", desc: "종료 후 거리·포인트가 자동 계산돼요" },
  { step: 4, icon: "🎁", title: "리워드 교환", desc: "모은 포인트로 리워드를 받아보세요" },
];

// localStorage 키 (첫 방문 가이드)
const GUIDE_KEY = "plogging_guide_shown";

// 공지사항 유형별 스타일
const NOTICE_STYLE = {
  info:    { bg: "bg-blue-50",   border: "border-blue-300",   text: "text-blue-700",   icon: "📌" },
  warning: { bg: "bg-orange-50", border: "border-orange-300", text: "text-orange-700", icon: "⚠️" },
  event:   { bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-700", icon: "🎉" },
};

export default function HomePage() {
  const { user } = useAuth();
  const [showGuide,   setShowGuide]   = useState(false);
  const [showInstall, setShowInstall] = useState(false);  // 홈화면 추가 모달
  const [deferredPrompt, setDeferredPrompt] = useState(null); // Android 네이티브 프롬프트
  const [notices, setNotices] = useState([]); // 활성 공지사항
  const [expandedNotice, setExpandedNotice] = useState(null); // 펼친 공지 id
  const [communityStats, setCommunityStats] = useState({ users: null, distance: null }); // 커뮤니티 통계

  // 첫 방문 시에만 캐릭터 가이드 표시
  useEffect(() => {
    try {
      const shown = localStorage.getItem(GUIDE_KEY);
      if (!shown) setShowGuide(true);
    } catch {
      // localStorage 미지원 환경 무시
    }
  }, []);

  // 활성 공지사항 불러오기
  useEffect(() => {
    const fetchNotices = async () => {
      try {
        const q = query(
          collection(db, "notices"),
          where("active", "==", true),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
        setNotices(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        // 공지사항 로드 실패 무시 (인덱스 미생성 등)
        console.warn("공지사항 로드 실패:", e.message);
      }
    };
    fetchNotices();
  }, []);

  // 커뮤니티 통계 (총 가입자 수 + 총 이동 거리)
  useEffect(() => {
    const fetchCommunityStats = async () => {
      try {
        // 총 가입자 수
        const usersSnap = await getCountFromServer(collection(db, "users"));
        const totalUsers = usersSnap.data().count;

        // 총 이동 거리 (포인트 > 0인 유효 기록만)
        const routesSnap = await getDocs(
          query(collection(db, "routes"), where("points", ">", 0))
        );
        let totalDistance = 0;
        routesSnap.forEach((d) => {
          totalDistance += d.data().distance || 0;
        });

        setCommunityStats({
          users: totalUsers,
          distance: totalDistance,
        });
      } catch (e) {
        console.warn("커뮤니티 통계 로드 실패:", e.message);
      }
    };
    fetchCommunityStats();
  }, []);

  // Android/Desktop: beforeinstallprompt 이벤트 캐치
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault(); // 자동 배너 막기
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // 홈화면 추가 버튼 클릭 처리
  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Android/Desktop: 네이티브 설치 프롬프트 실행
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setDeferredPrompt(null);
    } else {
      // iOS or 이미 설치됨: 수동 안내 모달 표시
      setShowInstall(true);
    }
  };

  const handleGuideComplete = () => {
    try { localStorage.setItem(GUIDE_KEY, "1"); } catch {}
    setShowGuide(false);
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "오백원의 행복",
          text: "🌿 플로깅으로 지구를 지키고 포인트도 받아요!",
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert("링크가 복사됐어요! 📋");
      }
    } catch (e) {
      console.log("공유 취소");
    }
  };

  return (
    <>
      {/* ── 캐릭터 가이드 (첫 방문) ── */}
      {showGuide && <CharacterGuide onComplete={handleGuideComplete} />}

      {/* ── 홈화면 추가 안내 모달 ── */}
      {showInstall && <InstallModal onClose={() => setShowInstall(false)} />}

      <div
        className="min-h-screen bg-gray-50 overflow-y-auto"
        style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom, 20px))" }}
      >
        {/* ── 상단 헤더 ── */}
        <div className="bg-gradient-to-b from-green-600 to-green-500 text-white px-4 pt-8 pb-5">
          <div className="flex justify-between items-start mb-1.5">
            <div>
              <h1 className="text-xl font-black">🌿 오백원의 행복</h1>
              <p className="text-green-200 text-sm mt-0.5">즐거운 플로깅, 깨끗한 지구</p>
            </div>
            {user && (
              <Link href="/profile">
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg">
                  {user.photoURL
                    ? <img src={user.photoURL} alt="" className="w-full h-full rounded-full object-cover" />
                    : "👤"
                  }
                </div>
              </Link>
            )}
          </div>

          {/* 로그인 여부별 */}
          {user ? (
            <div className="mt-3 bg-white/15 rounded-2xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-green-200">반갑습니다!</p>
                <p className="font-bold text-sm">{user.displayName || user.email?.split("@")[0]}</p>
              </div>
              <Link
                href="/map"
                className="bg-white text-green-600 w-11 h-11 rounded-full flex items-center justify-center shadow text-2xl flex-shrink-0"
                title="플로깅 시작"
              >
                🚶
              </Link>
            </div>
          ) : (
            <div className="mt-3 flex gap-2">
              <Link
                href="/login"
                className="flex-1 bg-white text-green-600 py-3 rounded-2xl font-bold text-center text-sm shadow"
              >
                로그인
              </Link>
              <Link
                href="/register"
                className="flex-1 bg-green-400 text-white py-3 rounded-2xl font-bold text-center text-sm"
              >
                회원가입
              </Link>
            </div>
          )}
        </div>

        <div className="px-4 mt-4 space-y-4">
          {/* ── 광고 배너 슬라이더 ── */}
          <BannerSlider />

          {/* ── 공지사항 배너 ── */}
          {notices.length > 0 && (
            <div className="space-y-2">
              {notices.map((notice) => {
                const style = NOTICE_STYLE[notice.type] || NOTICE_STYLE.info;
                const isExpanded = expandedNotice === notice.id;
                return (
                  <div
                    key={notice.id}
                    className={`${style.bg} border ${style.border} rounded-2xl px-4 py-3`}
                  >
                    <button
                      className="w-full text-left"
                      onClick={() => setExpandedNotice(isExpanded ? null : notice.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{style.icon}</span>
                          <p className={`text-sm font-bold ${style.text}`}>{notice.title}</p>
                        </div>
                        <span className={`text-xs ${style.text} opacity-70`}>
                          {isExpanded ? "▲" : "▼"}
                        </span>
                      </div>
                    </button>
                    {isExpanded && (
                      <p className={`text-xs ${style.text} mt-2 leading-relaxed whitespace-pre-line`}>
                        {notice.content}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── 빠른 메뉴 ── */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { href: "/map",     icon: "🗺️",  label: "지도" },
              { href: "/ranking", icon: "🏆",  label: "랭킹" },
              { href: "/group",   icon: "👥",  label: "그룹" },
              { href: "/reward",  icon: "🎁",  label: "리워드" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="bg-white rounded-2xl py-3 flex flex-col items-center gap-1 shadow-sm active:scale-95 transition-transform"
              >
                <span className="text-2xl">{item.icon}</span>
                <span className="text-xs text-gray-600 font-medium">{item.label}</span>
              </Link>
            ))}
          </div>

          {/* ── 커뮤니티 현황 ── */}
          <div className="bg-gradient-to-r from-green-500 to-teal-500 rounded-2xl p-4 text-white shadow">
            <p className="text-xs text-green-100 mb-3 font-medium">🌍 오백원의 행복 커뮤니티 현황</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/20 rounded-xl px-4 py-3 text-center">
                <p className="text-2xl font-black">
                  {communityStats.users === null
                    ? "…"
                    : `${communityStats.users.toLocaleString()}명`}
                </p>
                <p className="text-xs text-green-100 mt-0.5">👥 총 가입자</p>
              </div>
              <div className="bg-white/20 rounded-xl px-4 py-3 text-center">
                <p className="text-2xl font-black">
                  {communityStats.distance === null
                    ? "…"
                    : `${communityStats.distance.toFixed(1)}km`}
                </p>
                <p className="text-xs text-green-100 mt-0.5">🚶 총 이동 거리</p>
              </div>
            </div>
          </div>

          {/* ── 홈화면 추가 + 친구 초대 ── */}
          <div className="grid grid-cols-2 gap-2">
            {/* 홈화면 추가 버튼 */}
            <button
              onClick={handleInstallClick}
              className="bg-green-500 text-white rounded-2xl p-4 flex flex-col items-start gap-1 shadow-sm active:scale-95 transition-transform"
            >
              <span className="text-2xl">📲</span>
              <p className="font-bold text-sm leading-tight">홈 화면에 추가</p>
              <p className="text-xs text-green-100">앱처럼 사용하기</p>
            </button>

            {/* 친구 초대 */}
            <button
              onClick={handleShare}
              className="bg-white rounded-2xl p-4 flex flex-col items-start gap-1 shadow-sm active:scale-95 transition-transform"
            >
              <span className="text-2xl">📤</span>
              <p className="font-bold text-sm text-gray-700 leading-tight">친구 초대</p>
              <p className="text-xs text-gray-400">그룹 보너스!</p>
            </button>
          </div>

          {/* ── 이용 방법 ── */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold text-gray-700">이용 방법</h2>
              <button
                onClick={() => setShowGuide(true)}
                className="text-xs text-green-500 font-medium border border-green-200 px-2 py-1 rounded-full"
              >
                가이드 다시 보기
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {HOW_TO.map((item) => (
                <div key={item.step} className="bg-white rounded-2xl p-4 shadow-sm">
                  <span className="text-xs font-bold text-green-500">STEP {item.step}</span>
                  <div className="text-2xl mt-1">{item.icon}</div>
                  <p className="font-bold text-sm mt-1">{item.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── 포인트 안내 ── */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h2 className="font-bold text-gray-700 mb-3">💰 포인트 적립 기준</h2>
            <div className="space-y-2">
              {[
                { label: "거리 1km 달성",      point: "+50P" },
                { label: "2km 이상 완주",       point: "+100P 보너스" },
                { label: "그룹 참여 (인원 × 5)", point: "+αP" },
                { label: "신규 가입 환영 포인트", point: "+100P" },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center py-1.5 border-b last:border-0">
                  <span className="text-sm text-gray-600">{item.label}</span>
                  <span className="text-sm font-bold text-green-600">{item.point}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── 최신 업데이트 ── */}
          {(() => {
            const latest = versionData.changelog[0];
            return (
              <div className="bg-white rounded-2xl p-4 shadow-sm border-l-4 border-green-400">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-bold text-gray-700 text-sm">🆕 최신 업데이트</h2>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">
                    {latest.version}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mb-1">{latest.date}</p>
                <p className="text-sm font-semibold text-gray-700">
                  {latest.emoji} {latest.title}
                </p>
                <ul className="mt-1.5 space-y-0.5">
                  {latest.items.map((item, i) => (
                    <li key={i} className="text-xs text-gray-500">· {item}</li>
                  ))}
                </ul>
              </div>
            );
          })()}

          {/* ── 푸터 ── */}
          <div className="text-center py-2">
            <p className="text-xs text-gray-400">사단법인 국제청년환경연합회 (GYEA)</p>
            <p className="text-xs text-gray-300 mt-0.5">hubmission@gmail.com</p>
            <p className="text-xs text-gray-300 mt-0.5">개발 : 이상민 &nbsp;·&nbsp; 자문 : 박정석</p>
            <p className="text-xs text-gray-300 mt-0.5">{versionData.version}</p>
          </div>
        </div>
      </div>
    </>
  );
}