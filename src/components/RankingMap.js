"use client";

import { useEffect, useState, useCallback } from "react";
import { Map, CustomOverlayMap } from "react-kakao-maps-sdk";
import { useKakaoLoader } from "react-kakao-maps-sdk";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

// ─── 주요 시/도 중심 좌표 & 이름 ────────────────────────────
const REGIONS = [
  { code: "11", name: "서울",   lat: 37.5665, lng: 126.9780 },
  { code: "26", name: "부산",   lat: 35.1796, lng: 129.0756 },
  { code: "27", name: "대구",   lat: 35.8714, lng: 128.6014 },
  { code: "28", name: "인천",   lat: 37.4563, lng: 126.7052 },
  { code: "29", name: "광주",   lat: 35.1595, lng: 126.8526 },
  { code: "30", name: "대전",   lat: 36.3504, lng: 127.3845 },
  { code: "31", name: "울산",   lat: 35.5384, lng: 129.3114 },
  { code: "36", name: "세종",   lat: 36.4801, lng: 127.2890 },
  { code: "41", name: "경기",   lat: 37.4138, lng: 127.5183 },
  { code: "42", name: "강원",   lat: 37.8228, lng: 128.1555 },
  { code: "43", name: "충북",   lat: 36.6357, lng: 127.4912 },
  { code: "44", name: "충남",   lat: 36.5184, lng: 126.8000 },
  { code: "45", name: "전북",   lat: 35.7175, lng: 127.1530 },
  { code: "46", name: "전남",   lat: 34.8679, lng: 126.9910 },
  { code: "47", name: "경북",   lat: 36.4919, lng: 128.8889 },
  { code: "48", name: "경남",   lat: 35.4606, lng: 128.2132 },
  { code: "50", name: "제주",   lat: 33.4996, lng: 126.5312 },
];

// ─── 등급에 따른 색상 ─────────────────────────────────────
function getGradeColor(distance) {
  if (distance >= 500)  return { bg: "#1B5E20", text: "#fff",     border: "#0D3B11", grade: "S", emoji: "🏆" };
  if (distance >= 200)  return { bg: "#2E7D32", text: "#fff",     border: "#1B5E20", grade: "A", emoji: "🥇" };
  if (distance >= 100)  return { bg: "#4CAF50", text: "#fff",     border: "#388E3C", grade: "B", emoji: "🥈" };
  if (distance >= 50)   return { bg: "#81C784", text: "#1B5E20", border: "#4CAF50", grade: "C", emoji: "🥉" };
  if (distance >= 10)   return { bg: "#C8E6C9", text: "#2E7D32", border: "#81C784", grade: "D", emoji: "🌱" };
  return                        { bg: "#F1F8E9", text: "#9E9E9E", border: "#DCEDC8", grade: "-", emoji: "·" };
}

export default function RankingMap() {
  const [mapLoading] = useKakaoLoader({
    appkey: process.env.NEXT_PUBLIC_KAKAO_MAP_KEY,
  });

  const [regionStats, setRegionStats]       = useState({});
  const [loading, setLoading]               = useState(true);
  const [selectedRegion, setSelectedRegion] = useState(null);

  // ── 지역별 플로깅 집계 ───────────────────────────────────
  const fetchRegionStats = useCallback(async () => {
    setLoading(true);
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const snap = await getDocs(
        query(collection(db, "routes"), where("createdAt", ">=", startOfMonth))
      );

      const stats = {};
      REGIONS.forEach((r) => { stats[r.code] = { distance: 0, count: 0 }; });

      snap.forEach((docSnap) => {
        const data   = docSnap.data();
        const coords = data.coords;
        if (!coords || coords.length === 0) return;
        const firstCoord = coords[0];
        let minDist = Infinity, closestCode = "11";
        REGIONS.forEach((r) => {
          const d = Math.sqrt((r.lat - firstCoord.lat) ** 2 + (r.lng - firstCoord.lng) ** 2);
          if (d < minDist) { minDist = d; closestCode = r.code; }
        });
        stats[closestCode].distance += data.distance || 0;
        stats[closestCode].count    += 1;
      });
      setRegionStats(stats);
    } catch (e) {
      console.error("지역 통계 로드 실패:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRegionStats(); }, [fetchRegionStats]);

  const ranked = REGIONS
    .map((r) => ({ ...r, distance: regionStats[r.code]?.distance || 0, count: regionStats[r.code]?.count || 0 }))
    .sort((a, b) => b.distance - a.distance);

  // 순위 빠른 조회용 맵
  const rankMap = {};
  ranked.forEach((r, i) => { rankMap[r.code] = i + 1; });

  return (
    <div className="space-y-4">

      {/* ── 지도 ─────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden shadow-sm" style={{ height: "380px" }}>
        {mapLoading ? (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <p className="text-gray-400 animate-pulse text-sm">🗺️ 지도 로딩 중...</p>
          </div>
        ) : (
          <Map
            center={{ lat: 36.5, lng: 127.8 }}
            style={{ width: "100%", height: "100%" }}
            level={13}
          >
            {REGIONS.map((region) => {
              const stat     = regionStats[region.code] || { distance: 0, count: 0 };
              const color    = getGradeColor(stat.distance);
              const selected = selectedRegion?.code === region.code;
              const rank     = rankMap[region.code];
              const hasData  = stat.distance > 0;

              return (
                <CustomOverlayMap
                  key={region.code}
                  position={{ lat: region.lat, lng: region.lng }}
                  zIndex={selected ? 100 : (REGIONS.length + 2 - rankMap[region.code])}
                >
                  <button
                    onClick={() =>
                      setSelectedRegion(selected ? null : { ...region, ...stat, color })
                    }
                    style={{
                      background: color.bg,
                      color: color.text,
                      border: `2px solid ${selected ? "#fff" : color.border}`,
                      boxShadow: selected
                        ? `0 0 0 3px ${color.bg}, 0 4px 16px rgba(0,0,0,0.35)`
                        : "0 2px 8px rgba(0,0,0,0.25)",
                      transform: selected ? "scale(1.15)" : "scale(1)",
                      transition: "all 0.15s ease",
                      borderRadius: "10px",
                      padding: "5px 8px",
                      minWidth: "52px",
                      textAlign: "center",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "1px",
                    }}
                  >
                    {/* 등급 + 이모지 */}
                    <div style={{ fontSize: "12px", fontWeight: 900, lineHeight: 1 }}>
                      {hasData ? color.emoji : "·"} {color.grade}
                    </div>
                    {/* 지역명 */}
                    <div style={{ fontSize: "11px", fontWeight: 700, lineHeight: 1.2 }}>
                      {region.name}
                    </div>
                    {/* 거리 (데이터 있을 때만) */}
                    {hasData && (
                      <div style={{ fontSize: "9px", opacity: 0.85, fontWeight: 600, lineHeight: 1 }}>
                        {stat.distance >= 1
                          ? `${stat.distance.toFixed(1)}km`
                          : `${(stat.distance * 1000).toFixed(0)}m`}
                      </div>
                    )}
                    {/* 순위 뱃지 (데이터 있고 상위 3위) */}
                    {hasData && rank <= 3 && (
                      <div style={{
                        fontSize: "8px",
                        background: "rgba(255,255,255,0.3)",
                        borderRadius: "4px",
                        padding: "1px 4px",
                        fontWeight: 800,
                        lineHeight: 1.3,
                      }}>
                        {rank}위
                      </div>
                    )}
                  </button>
                </CustomOverlayMap>
              );
            })}
          </Map>
        )}
      </div>

      {/* ── 선택된 지역 상세 팝업 ────────────────────────── */}
      {selectedRegion && (
        <div
          className="rounded-2xl p-4 shadow-sm"
          style={{ background: selectedRegion.color.bg, color: selectedRegion.color.text }}
        >
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-black text-lg flex items-center gap-2">
                {selectedRegion.color.emoji} {selectedRegion.name}
                <span className="text-sm font-bold opacity-80">
                  {rankMap[selectedRegion.code]}위 · {selectedRegion.color.grade}등급
                </span>
              </h3>
              <p className="text-sm opacity-75 mt-0.5">이번 달 플로깅 현황</p>
            </div>
            <button
              onClick={() => setSelectedRegion(null)}
              style={{ color: selectedRegion.color.text, opacity: 0.6 }}
              className="text-2xl leading-none font-light"
            >
              ×
            </button>
          </div>
          <div className="flex gap-3 mt-3">
            <div className="flex-1 rounded-xl py-2.5 text-center"
              style={{ background: "rgba(255,255,255,0.2)" }}>
              <p className="text-xl font-black">{selectedRegion.distance.toFixed(1)}km</p>
              <p className="text-xs opacity-75">총 거리</p>
            </div>
            <div className="flex-1 rounded-xl py-2.5 text-center"
              style={{ background: "rgba(255,255,255,0.2)" }}>
              <p className="text-xl font-black">{selectedRegion.count}회</p>
              <p className="text-xs opacity-75">플로깅 횟수</p>
            </div>
            <div className="flex-1 rounded-xl py-2.5 text-center"
              style={{ background: "rgba(255,255,255,0.2)" }}>
              <p className="text-xl font-black">
                {selectedRegion.count > 0
                  ? (selectedRegion.distance / selectedRegion.count).toFixed(1)
                  : "0"}km
              </p>
              <p className="text-xs opacity-75">회당 평균</p>
            </div>
          </div>
        </div>
      )}

      {/* ── 등급 범례 ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h3 className="font-bold text-gray-600 mb-2 text-xs uppercase tracking-wide">
          등급 기준 · 이번 달 누적 거리
        </h3>
        <div className="flex gap-1.5 flex-wrap">
          {[
            { grade: "S", label: "500km+", bg: "#1B5E20", text: "#fff", emoji: "🏆" },
            { grade: "A", label: "200km+", bg: "#2E7D32", text: "#fff", emoji: "🥇" },
            { grade: "B", label: "100km+", bg: "#4CAF50", text: "#fff", emoji: "🥈" },
            { grade: "C", label: "50km+",  bg: "#81C784", text: "#1B5E20", emoji: "🥉" },
            { grade: "D", label: "10km+",  bg: "#C8E6C9", text: "#2E7D32", emoji: "🌱" },
            { grade: "-", label: "미활동", bg: "#F1F8E9", text: "#9E9E9E", emoji: "·" },
          ].map((g) => (
            <div
              key={g.grade}
              style={{ background: g.bg, color: g.text, border: "1px solid rgba(0,0,0,0.08)" }}
              className="px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1"
            >
              <span>{g.emoji}</span>
              <span>{g.grade} {g.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 지역 순위 리스트 ──────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="font-bold text-gray-700">지역별 순위 (이번 달)</h3>
          {loading && <span className="text-xs text-gray-400 animate-pulse">집계 중...</span>}
        </div>
        {loading ? (
          <p className="text-center py-8 text-gray-400 animate-pulse text-sm">🌿 집계 중...</p>
        ) : (
          ranked.map((r, idx) => {
            const color = getGradeColor(r.distance);
            return (
              <div
                key={r.code}
                className={`flex items-center gap-3 px-4 py-3 border-b last:border-0 cursor-pointer transition-colors ${
                  selectedRegion?.code === r.code ? "bg-green-50" : "hover:bg-gray-50"
                }`}
                onClick={() =>
                  setSelectedRegion(selectedRegion?.code === r.code ? null : { ...r, color })
                }
              >
                {/* 순위 */}
                <span className={`text-sm font-black w-6 text-center ${
                  idx === 0 ? "text-yellow-500" :
                  idx === 1 ? "text-gray-400" :
                  idx === 2 ? "text-orange-400" : "text-gray-300"
                }`}>
                  {idx + 1}
                </span>
                {/* 등급 원 */}
                <div
                  style={{ background: color.bg, color: color.text }}
                  className="w-9 h-9 rounded-full flex flex-col items-center justify-center flex-shrink-0"
                >
                  <span className="text-[10px] leading-none">{color.emoji}</span>
                  <span className="text-[10px] font-black leading-none">{color.grade}</span>
                </div>
                {/* 지역명 + 횟수 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-700">{r.name}</p>
                  <p className="text-xs text-gray-400">{r.count}회 플로깅</p>
                </div>
                {/* 거리 */}
                <span className="text-sm font-bold text-green-600 flex-shrink-0">
                  {r.distance.toFixed(1)}km
                </span>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}