"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection, query, where, getDocs, doc, getDoc, Timestamp,
} from "firebase/firestore";
import {
  Award, ChevronLeft, ChevronRight, ScrollText, Lock,
  Footprints, Clock, MapPin, FileCheck, ExternalLink, UserRound,
} from "lucide-react";

function formatHoursMinutes(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h > 0 && m > 0) return `${h}시간 ${m}분`;
  if (h > 0) return `${h}시간`;
  return `${m}분`;
}

export default function VolunteerPage() {
  const { user } = useAuth();

  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [volunteerNo, setVolunteerNo] = useState("");
  const [totalStats, setTotalStats] = useState(null); // 전체 누적
  const [certCount, setCertCount] = useState(0);

  // 사용자 프로필 조회
  useEffect(() => {
    if (!user?.uid) return;
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (snap.exists()) {
        setVolunteerNo(snap.data().volunteerNo || "");
      }
    }).catch(() => {});
  }, [user?.uid]);

  // 전체 누적 통계 + 증명서 발급 수
  useEffect(() => {
    if (!user?.uid) return;
    const fetchTotal = async () => {
      try {
        const [routesSnap, certsSnap] = await Promise.all([
          getDocs(query(collection(db, "routes"), where("userId", "==", user.uid))),
          getDocs(query(collection(db, "certificates"), where("userId", "==", user.uid))),
        ]);

        let totalCount = 0, totalDist = 0, totalDur = 0, totalPts = 0;
        routesSnap.forEach((d) => {
          const r = d.data();
          totalCount++;
          totalDist += r.distance || 0;
          totalDur += r.duration || 0;
          totalPts += r.points || 0;
        });

        setTotalStats({
          count: totalCount,
          distance: Math.round(totalDist * 100) / 100,
          duration: totalDur,
          points: totalPts,
          volunteerHours: Math.max(0, Math.round(totalDur / 3600)),
        });
        setCertCount(certsSnap.size);
      } catch (e) {
        console.warn("전체 통계 로드 실패:", e.message);
      }
    };
    fetchTotal();
  }, [user?.uid]);

  // 월별 통계 조회
  useEffect(() => {
    if (!user?.uid) return;
    fetchMonthStats(month);
  }, [user?.uid, month]);

  const fetchMonthStats = async (targetMonth) => {
    setLoading(true);
    try {
      const [year, mon] = targetMonth.split("-").map(Number);
      const startDate = new Date(year, mon - 1, 1);
      const endDate = new Date(year, mon, 1);

      const routesSnap = await getDocs(
        query(
          collection(db, "routes"),
          where("userId", "==", user.uid),
          where("createdAt", ">=", Timestamp.fromDate(startDate)),
          where("createdAt", "<", Timestamp.fromDate(endDate)),
        )
      );

      let count = 0, dist = 0, dur = 0, pts = 0;
      const days = new Set();
      routesSnap.forEach((d) => {
        const r = d.data();
        count++;
        dist += r.distance || 0;
        dur += r.duration || 0;
        pts += r.points || 0;
        const date = r.createdAt?.toDate?.();
        if (date) days.add(date.toISOString().slice(0, 10));
      });

      setStats({
        count,
        distance: Math.round(dist * 100) / 100,
        duration: dur,
        points: pts,
        activeDays: days.size,
        volunteerHours: Math.max(0, Math.round(dur / 3600)),
      });
    } catch (e) {
      console.warn("월별 통계 로드 실패:", e.message);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const changeMonth = (delta) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  if (!user) return (
    <div className="flex flex-col items-center justify-center h-screen gap-4 text-center px-6">
      <Lock size={48} className="text-gray-300" strokeWidth={1.5} />
      <p className="font-bold text-gray-700">로그인이 필요해요</p>
      <Link href="/login" className="text-sm text-green-600 font-bold underline">로그인하기</Link>
    </div>
  );

  const [year, mon] = month.split("-").map(Number);

  return (
    <div className="min-h-screen bg-gray-50" style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom, 20px))" }}>

      {/* 헤더 */}
      <div className="bg-gray-50 px-4 pt-4 pb-1 flex justify-between items-center">
        <Link href="/">
          <img src="https://res.cloudinary.com/dqlvm572h/image/upload/w_200,q_auto,f_auto/Intro_Logo_fuj1kt.png"
            alt="오백원의 행복" className="h-9 w-auto object-contain" />
        </Link>
        <p className="text-sm font-black text-gray-700 flex items-center gap-1">
          <Award className="w-4 h-4" strokeWidth={1.8} /> 봉사활동 현황
        </p>
      </div>

      <div className="px-4 mt-4 space-y-4">

        {/* 1365 회원번호 카드 */}
        <div className={`rounded-2xl p-4 border ${volunteerNo ? "bg-blue-50 border-blue-200" : "bg-orange-50 border-orange-200"}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserRound className={`w-5 h-5 ${volunteerNo ? "text-blue-600" : "text-orange-500"}`} strokeWidth={1.8} />
              <div>
                {volunteerNo ? (
                  <>
                    <p className="text-xs font-bold text-blue-700">1365 회원번호</p>
                    <p className="text-base font-black text-blue-800">{volunteerNo}</p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-bold text-orange-700">1365 회원번호 미등록</p>
                    <p className="text-xs text-orange-500">프로필에서 등록하면 봉사시간을 인정받을 수 있어요</p>
                  </>
                )}
              </div>
            </div>
            {!volunteerNo && (
              <Link href="/profile/edit" className="text-xs font-bold text-orange-700 bg-white px-3 py-1.5 rounded-lg border border-orange-200">
                등록하기
              </Link>
            )}
          </div>
        </div>

        {/* 전체 누적 통계 */}
        {totalStats && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h2 className="font-bold text-gray-700 text-sm mb-3 flex items-center gap-1.5">
              <Footprints className="w-4 h-4 text-green-600" strokeWidth={1.8} /> 전체 봉사활동 누적
            </h2>
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-xl font-black text-green-700">{totalStats.count}</p>
                <p className="text-[9px] text-green-600 font-medium mt-0.5">플로깅</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-xl font-black text-blue-700">{totalStats.volunteerHours}h</p>
                <p className="text-[9px] text-blue-600 font-medium mt-0.5">봉사시간</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-3 text-center">
                <p className="text-xl font-black text-purple-700">{totalStats.distance}</p>
                <p className="text-[9px] text-purple-600 font-medium mt-0.5">km</p>
              </div>
              <div className="bg-orange-50 rounded-xl p-3 text-center">
                <p className="text-xl font-black text-orange-700">{certCount}</p>
                <p className="text-[9px] text-orange-600 font-medium mt-0.5">증명서</p>
              </div>
            </div>
          </div>
        )}

        {/* 월별 통계 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => changeMonth(-1)} className="p-1.5 rounded-full bg-gray-100 active:bg-gray-200">
              <ChevronLeft className="w-5 h-5 text-gray-600" strokeWidth={2} />
            </button>
            <div className="text-center">
              <p className="text-lg font-bold text-gray-800">{year}년 {mon}월</p>
              <p className="text-xs text-gray-400">월별 봉사활동 현황</p>
            </div>
            <button onClick={() => changeMonth(1)} className="p-1.5 rounded-full bg-gray-100 active:bg-gray-200">
              <ChevronRight className="w-5 h-5 text-gray-600" strokeWidth={2} />
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-400 text-sm">로딩 중...</div>
          ) : stats && stats.count > 0 ? (
            <>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-black text-green-700">{stats.count}회</p>
                  <p className="text-[9px] text-green-600 font-medium">플로깅</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-black text-blue-700">{stats.volunteerHours}h</p>
                  <p className="text-[9px] text-blue-600 font-medium">봉사시간</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-black text-purple-700">{stats.distance}km</p>
                  <p className="text-[9px] text-purple-600 font-medium">이동거리</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500 bg-gray-50 rounded-xl p-3">
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {formatHoursMinutes(stats.duration / 3600)}</span>
                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {stats.activeDays}일 활동</span>
                <span className="flex items-center gap-1"><Award className="w-3.5 h-3.5" /> {stats.points}P</span>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-gray-400 text-sm">
              이 달에는 아직 활동 기록이 없습니다.
            </div>
          )}
        </div>

        {/* 바로가기 버튼들 */}
        <div className="space-y-2">
          <Link href="/certificate"
            className="w-full bg-green-500 text-white py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-sm">
            <FileCheck className="w-5 h-5" /> 봉사활동 증명서 발급
          </Link>

          <a href="https://www.1365.go.kr" target="_blank" rel="noopener noreferrer"
            className="w-full bg-orange-400 text-white py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-sm">
            <ExternalLink className="w-5 h-5" /> 1365 자원봉사 포털 바로가기
          </a>
        </div>

        {/* 안내 */}
        <div className="bg-gray-100 rounded-2xl p-4">
          <h3 className="font-bold text-gray-600 text-xs mb-2">1365 자원봉사 연계 안내</h3>
          <div className="space-y-1.5 text-xs text-gray-500 leading-relaxed">
            <p>• 플로깅 활동은 "환경보호 &gt; 환경정화활동"으로 분류됩니다.</p>
            <p>• 봉사시간은 실제 플로깅 시간을 기준으로 산정됩니다.</p>
            <p>• 관리자가 월별 봉사실적을 CSV로 취합하여 1365 포털에 등록합니다.</p>
            <p>• 1365 회원번호를 프로필에 등록해야 봉사시간 인정이 가능합니다.</p>
            <p>• 봉사활동 증명서는 앱 내에서 직접 발급받을 수 있습니다.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
