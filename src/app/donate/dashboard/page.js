"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  collection, getDocs, query, orderBy,
} from "firebase/firestore";
import {
  HeartHandshake, TreePine, Waves, Fish, CircleDollarSign,
  ChevronLeft, TrendingUp, MapPin, Calendar, Users, Award,
  ChevronDown,
} from "lucide-react";

// ─── 기부처 메타 ───────────────────────────────────────────
const DONATE_META = {
  donate_gia:      { name: "기아대책 후원",     Icon: HeartHandshake, color: "text-green-600",  bg: "bg-green-100",  accent: "#16a34a" },
  donate_forest:   { name: "나무 한 그루 심기", Icon: TreePine,       color: "text-green-700",  bg: "bg-green-100",  accent: "#15803d" },
  donate_ocean:    { name: "해양 정화 기부",    Icon: Waves,          color: "text-sky-600",    bg: "bg-sky-100",    accent: "#0284c7" },
  donate_dokdo:    { name: "독도 프로젝트 기부",Icon: Fish,           color: "text-cyan-600",   bg: "bg-cyan-100",   accent: "#0891b2" },
  bonus_painting:  { name: "오백원의 행복 기부",Icon: CircleDollarSign, color: "text-amber-600", bg: "bg-amber-100", accent: "#d97706" },
};
const DONATE_IDS = Object.keys(DONATE_META);

// ─── 지역 약칭 ─────────────────────────────────────────────
const REGION_SHORT = {
  "서울특별시":"서울", "부산광역시":"부산", "대구광역시":"대구", "인천광역시":"인천",
  "광주광역시":"광주", "대전광역시":"대전", "울산광역시":"울산", "세종특별자치시":"세종",
  "경기도":"경기", "강원도":"강원", "충청북도":"충북", "충청남도":"충남",
  "전북특별자치도":"전북", "전라남도":"전남", "경상북도":"경북", "경상남도":"경남", "제주특별자치도":"제주",
};

export default function DonateDashboardPage() {
  const router = useRouter();

  const [loading, setLoading]       = useState(true);
  const [rewards, setRewards]       = useState([]);   // donations 컬렉션
  const [selectedOrg, setSelectedOrg] = useState("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // donations 컬렉션 조회 (전체 공개)
      const rSnap = await getDocs(query(
        collection(db, "donations"),
        orderBy("createdAt", "desc"),
      ));
      const allRewards = rSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((r) => DONATE_IDS.includes(r.rewardId));
      setRewards(allRewards);
    } catch (e) {
      console.error("후원 데이터 로드 실패:", e);
    } finally {
      setLoading(false);
    }
  };

  // ── 데이터 집계 ──────────────────────────────────────────
  const filtered = selectedOrg === "all"
    ? rewards
    : rewards.filter((r) => r.rewardId === selectedOrg);

  // 기부처별 합계
  const orgTotals = {};
  rewards.forEach((r) => {
    if (!orgTotals[r.rewardId]) orgTotals[r.rewardId] = { count: 0, points: 0 };
    orgTotals[r.rewardId].count++;
    orgTotals[r.rewardId].points += r.cost || 0;
  });

  // 월별 집계 (최근 6개월)
  const monthlyData = {};
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyData[key] = { count: 0, points: 0 };
  }
  filtered.forEach((r) => {
    if (!r.createdAt) return;
    const d = r.createdAt.toDate ? r.createdAt.toDate() : new Date(r.createdAt);
    const key = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (monthlyData[key]) {
      monthlyData[key].count++;
      monthlyData[key].points += r.cost || 0;
    }
  });
  const months = Object.keys(monthlyData);
  const maxMonthPoints = Math.max(...Object.values(monthlyData).map((v) => v.points), 1);

  // 지역별 집계
  const regionData = {};
  filtered.forEach((r) => {
    const region = r.userRegion || "미설정";
    const short = REGION_SHORT[region] || region;
    if (!regionData[short]) regionData[short] = { count: 0, points: 0 };
    regionData[short].count++;
    regionData[short].points += r.cost || 0;
  });
  const regionSorted = Object.entries(regionData)
    .sort((a, b) => b[1].points - a[1].points);
  const maxRegionPoints = regionSorted.length > 0 ? regionSorted[0][1].points : 1;

  // 전체 합산
  const totalPoints = filtered.reduce((s, r) => s + (r.cost || 0), 0);
  const totalCount  = filtered.length;
  const uniqueDonors = new Set(filtered.map((r) => r.userId)).size;

  // 최근 후원 목록 (상위 10건)
  const recentDonations = filtered.slice(0, 10);

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <p className="animate-pulse text-lg flex items-center gap-2 text-gray-500">
        <HeartHandshake className="w-5 h-5 text-green-500" strokeWidth={2} /> 후원 현황 불러오는 중...
      </p>
    </div>
  );

  return (
    <div
      className="min-h-screen bg-gray-50"
      style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom, 20px))" }}
    >
      {/* ── 헤더 ── */}
      <div className="bg-gradient-to-br from-green-600 to-emerald-700 text-white px-4 pt-4 pb-6">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.back()}>
            <ChevronLeft className="w-6 h-6 text-white/80" strokeWidth={2} />
          </button>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <HeartHandshake className="w-5 h-5" strokeWidth={2} />
            후원 현황 대시보드
          </h1>
        </div>

        {/* 핵심 지표 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/15 rounded-2xl px-3 py-3 text-center">
            <p className="text-2xl font-black">{totalPoints.toLocaleString()}</p>
            <p className="text-[10px] text-white/70">총 후원 포인트</p>
          </div>
          <div className="bg-white/15 rounded-2xl px-3 py-3 text-center">
            <p className="text-2xl font-black">{totalCount}</p>
            <p className="text-[10px] text-white/70">총 후원 건수</p>
          </div>
          <div className="bg-white/15 rounded-2xl px-3 py-3 text-center">
            <p className="text-2xl font-black">{uniqueDonors}</p>
            <p className="text-[10px] text-white/70">참여 후원자</p>
          </div>
        </div>
      </div>

      {/* ── 기부처 필터 ── */}
      <div className="flex gap-2 px-4 mt-4 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setSelectedOrg("all")}
          className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors
            ${selectedOrg === "all" ? "bg-green-500 text-white border-green-500" : "bg-white text-gray-500 border-gray-200"}`}
        >
          전체
        </button>
        {DONATE_IDS.map((id) => {
          const meta = DONATE_META[id];
          return (
            <button
              key={id}
              onClick={() => setSelectedOrg(id)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors flex items-center gap-1
                ${selectedOrg === id ? "bg-green-500 text-white border-green-500" : "bg-white text-gray-500 border-gray-200"}`}
            >
              <meta.Icon className="w-3.5 h-3.5" strokeWidth={2} />
              {meta.name.split(" ")[0]}
            </button>
          );
        })}
      </div>

      {/* ── 기부처별 현황 카드 ── */}
      {selectedOrg === "all" && (
        <div className="px-4 mt-4 space-y-2">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-green-600" strokeWidth={2} />
            기부처별 현황
          </h2>
          {DONATE_IDS.map((id) => {
            const meta = DONATE_META[id];
            const data = orgTotals[id] || { count: 0, points: 0 };
            return (
              <button
                key={id}
                onClick={() => setSelectedOrg(id)}
                className="w-full bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm active:scale-[0.98] transition-transform text-left"
              >
                <div className={`w-10 h-10 rounded-lg ${meta.bg} flex items-center justify-center flex-shrink-0`}>
                  <meta.Icon className={`w-5 h-5 ${meta.color}`} strokeWidth={1.8} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 text-sm">{meta.name}</p>
                  <p className="text-xs text-gray-400">{data.count}건 후원</p>
                </div>
                <p className="text-sm font-black" style={{ color: meta.accent }}>
                  {data.points.toLocaleString()}P
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* ── 월별 후원 추이 (바 차트) ── */}
      <div className="px-4 mt-6">
        <h2 className="text-sm font-bold text-gray-700 flex items-center gap-1.5 mb-3">
          <TrendingUp className="w-4 h-4 text-blue-500" strokeWidth={2} />
          월별 후원 추이
        </h2>
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-end gap-2 h-32">
            {months.map((m) => {
              const d = monthlyData[m];
              const h = Math.max((d.points / maxMonthPoints) * 100, 4);
              return (
                <div key={m} className="flex-1 flex flex-col items-center gap-1">
                  <p className="text-[10px] font-bold text-green-600">{d.points > 0 ? `${(d.points / 1000).toFixed(d.points >= 1000 ? 1 : 0)}k` : ""}</p>
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-green-500 to-emerald-400 transition-all duration-500"
                    style={{ height: `${h}%`, minHeight: d.points > 0 ? "8px" : "3px", opacity: d.points > 0 ? 1 : 0.2 }}
                  />
                  <p className="text-[10px] text-gray-400">{m.split(".")[1]}월</p>
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between">
            <span className="text-xs text-gray-400">최근 6개월</span>
            <span className="text-xs font-bold text-gray-600">
              총 {Object.values(monthlyData).reduce((s, v) => s + v.count, 0)}건
            </span>
          </div>
        </div>
      </div>

      {/* ── 지역별 후원 분포 ── */}
      <div className="px-4 mt-6">
        <h2 className="text-sm font-bold text-gray-700 flex items-center gap-1.5 mb-3">
          <MapPin className="w-4 h-4 text-purple-500" strokeWidth={2} />
          지역별 후원 분포
        </h2>
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          {regionSorted.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-4">지역 데이터가 없습니다</p>
          ) : (
            <div className="space-y-2.5">
              {regionSorted.slice(0, 8).map(([region, data], idx) => (
                <div key={region}>
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      {idx === 0 && <span className="text-xs">🥇</span>}
                      {idx === 1 && <span className="text-xs">🥈</span>}
                      {idx === 2 && <span className="text-xs">🥉</span>}
                      <span className="text-sm font-medium text-gray-700">{region}</span>
                    </div>
                    <span className="text-xs font-bold text-gray-600">{data.points.toLocaleString()}P ({data.count}건)</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-purple-400 to-purple-600 transition-all duration-500"
                      style={{ width: `${(data.points / maxRegionPoints) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 최근 후원 활동 ── */}
      <div className="px-4 mt-6">
        <h2 className="text-sm font-bold text-gray-700 flex items-center gap-1.5 mb-3">
          <Calendar className="w-4 h-4 text-orange-500" strokeWidth={2} />
          최근 후원 활동
        </h2>
        <div className="space-y-2">
          {recentDonations.map((r) => {
            const meta = DONATE_META[r.rewardId] || DONATE_META.donate_gia;
            const d = r.createdAt?.toDate ? r.createdAt.toDate() : new Date();
            const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
            // 닉네임 마스킹: 첫 글자 + **
            const masked = r.userName ? r.userName.charAt(0) + "**" : "익명";
            const region = REGION_SHORT[r.userRegion] || r.userRegion || "";
            return (
              <div key={r.id} className="bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm">
                <div className={`w-8 h-8 rounded-lg ${meta.bg} flex items-center justify-center flex-shrink-0`}>
                  <meta.Icon className={`w-4 h-4 ${meta.color}`} strokeWidth={1.8} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700">{masked}님이 후원</p>
                  <p className="text-xs text-gray-400">{meta.name}{region ? ` · ${region}` : ""}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-600">{(r.cost || 0).toLocaleString()}P</p>
                  <p className="text-xs text-gray-400">{dateStr}</p>
                </div>
              </div>
            );
          })}
          {recentDonations.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">아직 후원 기록이 없습니다</p>
          )}
        </div>
      </div>

      {/* ── 후원 참여 CTA ── */}
      <div className="px-4 mt-6">
        <Link
          href="/reward"
          className="block w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-2xl font-bold text-center shadow-lg active:scale-[0.98] transition-transform"
        >
          나도 후원에 참여하기 →
        </Link>
      </div>
    </div>
  );
}
