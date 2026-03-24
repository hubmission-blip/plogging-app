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
  if (distance >= 500)  return { bg: "#1B5E20", text: "#ffffff", grade: "S" }; // 진초록
  if (distance >= 200)  return { bg: "#388E3C", text: "#ffffff", grade: "A" };
  if (distance >= 100)  return { bg: "#66BB6A", text: "#ffffff", grade: "B" };
  if (distance >= 50)   return { bg: "#A5D6A7", text: "#1B5E20", grade: "C" };
  if (distance >= 10)   return { bg: "#C8E6C9", text: "#388E3C", grade: "D" };
  return                        { bg: "#F1F8E9", text: "#aaa",    grade: "-" };
}

export default function RankingMap() {
  const [mapLoading] = useKakaoLoader({
    appkey: process.env.NEXT_PUBLIC_KAKAO_MAP_KEY,
  });

  const [regionStats, setRegionStats] = useState({});
  const [loading, setLoading]         = useState(true);
  const [selectedRegion, setSelectedRegion] = useState(null);

  // ── 지역별 플로깅 집계 ───────────────────────────────────
  const fetchRegionStats = useCallback(async () => {
    setLoading(true);
    try {
      // 이번 달 데이터만 집계
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const snap = await getDocs(
        query(collection(db, "routes"), where("createdAt", ">=", startOfMonth))
      );

      // 유저별 지역 정보가 없으므로: GPS 첫 좌표로 지역 추정
      // (실제 서비스에서는 유저 프로필에 지역 저장 권장)
      const stats = {};
      REGIONS.forEach((r) => { stats[r.code] = { distance: 0, count: 0 }; });

      snap.forEach((docSnap) => {
        const data = docSnap.data();
        const coords = data.coords;
        if (!coords || coords.length === 0) return;
        const firstCoord = coords[0];

        // 첫 좌표와 가장 가까운 지역 찾기
        let minDist = Infinity;
        let closestCode = "11";
        REGIONS.forEach((r) => {
          const d = Math.sqrt(
            Math.pow(r.lat - firstCoord.lat, 2) +
            Math.pow(r.lng - firstCoord.lng, 2)
          );
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

  // ── 순위 정렬 ────────────────────────────────────────────
  const ranked = REGIONS
    .map((r) => ({
      ...r,
      distance: regionStats[r.code]?.distance || 0,
      count:    regionStats[r.code]?.count    || 0,
    }))
    .sort((a, b) => b.distance - a.distance);

  return (
    <div className="space-y-4">
      {/* ── 지도 ── */}
      <div className="rounded-2xl overflow-hidden shadow-sm" style={{ height: "320px" }}>
        {mapLoading ? (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <p className="text-gray-400 animate-pulse">🗺️ 지도 로딩 중...</p>
          </div>
        ) : (
          <Map
            center={{ lat: 36.5, lng: 127.5 }}
            style={{ width: "100%", height: "100%" }}
            level={12}
          >
            {REGIONS.map((region) => {
              const stat  = regionStats[region.code] || { distance: 0 };
              const color = getGradeColor(stat.distance);
              return (
                <CustomOverlayMap
                  key={region.code}
                  position={{ lat: region.lat, lng: region.lng }}
                  zIndex={1}
                >
                  <button
                    onClick={() => setSelectedRegion({ ...region, ...stat, color })}
                    style={{
                      background: color.bg,
                      color: color.text,
                      border: selectedRegion?.code === region.code ? "2px solid #1B5E20" : "none",
                    }}
                    className="px-2 py-1 rounded-lg text-xs font-bold shadow-md min-w-[44px] text-center"
                  >
                    <div>{region.name}</div>
                    <div className="text-xs opacity-80">{color.grade}</div>
                  </button>
                </CustomOverlayMap>
              );
            })}
          </Map>
        )}
      </div>

      {/* ── 선택된 지역 팝업 ── */}
      {selectedRegion && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-gray-800 text-base">
                {selectedRegion.name} — 등급 {selectedRegion.color.grade}
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">이번 달 플로깅 현황</p>
            </div>
            <button onClick={() => setSelectedRegion(null)} className="text-gray-300 text-xl">×</button>
          </div>
          <div className="flex gap-4 mt-3">
            <div className="text-center flex-1 bg-green-50 rounded-xl py-2">
              <p className="text-lg font-black text-green-700">
                {selectedRegion.distance.toFixed(1)}km
              </p>
              <p className="text-xs text-gray-400">총 거리</p>
            </div>
            <div className="text-center flex-1 bg-blue-50 rounded-xl py-2">
              <p className="text-lg font-black text-blue-700">{selectedRegion.count}회</p>
              <p className="text-xs text-gray-400">플로깅 횟수</p>
            </div>
          </div>
        </div>
      )}

      {/* ── 등급 범례 ── */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h3 className="font-bold text-gray-700 mb-2 text-sm">등급 기준 (이번 달 누적 거리)</h3>
        <div className="flex gap-1.5 flex-wrap">
          {[
            { grade: "S", label: "500km+", bg: "#1B5E20", text: "#fff" },
            { grade: "A", label: "200km+", bg: "#388E3C", text: "#fff" },
            { grade: "B", label: "100km+", bg: "#66BB6A", text: "#fff" },
            { grade: "C", label: "50km+",  bg: "#A5D6A7", text: "#1B5E20" },
            { grade: "D", label: "10km+",  bg: "#C8E6C9", text: "#388E3C" },
            { grade: "-", label: "10km 미만", bg: "#F1F8E9", text: "#aaa" },
          ].map((g) => (
            <div
              key={g.grade}
              style={{ background: g.bg, color: g.text }}
              className="px-2 py-1 rounded-lg text-xs font-bold"
            >
              {g.grade} {g.label}
            </div>
          ))}
        </div>
      </div>

      {/* ── 지역 순위 리스트 ── */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h3 className="font-bold text-gray-700">지역별 순위 (이번 달)</h3>
        </div>
        {loading ? (
          <p className="text-center py-6 text-gray-400 animate-pulse">집계 중...</p>
        ) : (
          ranked.map((r, idx) => {
            const color = getGradeColor(r.distance);
            return (
              <div key={r.code} className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0">
                <span className="text-sm font-bold text-gray-400 w-5 text-center">
                  {idx + 1}
                </span>
                <div
                  style={{ background: color.bg, color: color.text }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                >
                  {color.grade}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">{r.name}</p>
                  <p className="text-xs text-gray-400">{r.count}회 플로깅</p>
                </div>
                <span className="text-sm font-bold text-green-600">
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