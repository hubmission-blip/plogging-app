"use client";

import { useEffect, useState, useCallback } from "react";
import { Map, CustomOverlayMap, Polygon } from "react-kakao-maps-sdk";
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

// ─── GeoJSON 이름 → 지역 코드 매핑 ──────────────────────────
// (southkorea-maps 저장소의 CTP_KOR_NM 기준 + 최근 행정구역명 변경 대응)
const NAME_TO_CODE = {
  "서울특별시":       "11",
  "부산광역시":       "26",
  "대구광역시":       "27",
  "인천광역시":       "28",
  "광주광역시":       "29",
  "대전광역시":       "30",
  "울산광역시":       "31",
  "세종특별자치시":   "36",
  "경기도":           "41",
  "강원도":           "42",
  "강원특별자치도":   "42",   // 2023년 명칭 변경
  "충청북도":         "43",
  "충청남도":         "44",
  "전라북도":         "45",
  "전북특별자치도":   "45",   // 2024년 명칭 변경
  "전라남도":         "46",
  "경상북도":         "47",
  "경상남도":         "48",
  "제주특별자치도":   "50",
};

// ─── 등급에 따른 색상 ─────────────────────────────────────
function getGradeColor(distance) {
  if (distance >= 500)  return { fill: "#1B5E20", stroke: "#145214", text: "#ffffff", grade: "S" };
  if (distance >= 200)  return { fill: "#388E3C", stroke: "#2E7D32", text: "#ffffff", grade: "A" };
  if (distance >= 100)  return { fill: "#66BB6A", stroke: "#43A047", text: "#ffffff", grade: "B" };
  if (distance >= 50)   return { fill: "#A5D6A7", stroke: "#66BB6A", text: "#1B5E20", grade: "C" };
  if (distance >= 10)   return { fill: "#C8E6C9", stroke: "#A5D6A7", text: "#388E3C", grade: "D" };
  return                        { fill: "#E8F5E9", stroke: "#C8E6C9", text: "#9E9E9E", grade: "-" };
}

// ─── GeoJSON 폴리곤 좌표 변환 유틸 ──────────────────────────
// GeoJSON: [lng, lat] → Kakao Maps: {lat, lng}
function coordsToLatLng(ring) {
  return ring.map(([lng, lat]) => ({ lat, lng }));
}

// GeoJSON Feature → Polygon 엔트리 배열 반환
// MultiPolygon(섬 포함 지역)은 각각 별도 엔트리로 분리
function featureToPolygonEntries(feature, code) {
  const geom = feature.geometry;
  const entries = [];

  if (geom.type === "Polygon") {
    // coordinates[0] = 외곽, [1]+ = 홀(구멍)
    const paths = geom.coordinates.map(coordsToLatLng);
    entries.push({ code, paths });

  } else if (geom.type === "MultiPolygon") {
    // 각 polygon을 독립 엔트리로 (섬, 고립 지역 등)
    geom.coordinates.forEach((poly) => {
      const paths = poly.map(coordsToLatLng);
      entries.push({ code, paths });
    });
  }

  return entries;
}

export default function RankingMap() {
  const [mapLoading] = useKakaoLoader({
    appkey: process.env.NEXT_PUBLIC_KAKAO_MAP_KEY,
  });

  const [regionStats, setRegionStats]   = useState({});
  const [loading, setLoading]           = useState(true);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [polygonEntries, setPolygonEntries] = useState([]); // [{code, paths}]
  const [geoLoading, setGeoLoading]     = useState(true);

  // ── 행정구역 경계 GeoJSON 로드 ────────────────────────────
  useEffect(() => {
    setGeoLoading(true);
    fetch(
      "https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-provinces-2018-geo.json"
    )
      .then((r) => {
        if (!r.ok) throw new Error("GeoJSON 로드 실패");
        return r.json();
      })
      .then((geoJson) => {
        const entries = [];
        geoJson.features.forEach((feature) => {
          // CTPRVN_CD 속성 (코드) 또는 CTP_KOR_NM 속성 (이름) 중 존재하는 것 사용
          const props = feature.properties;
          const code =
            props.CTPRVN_CD ||
            NAME_TO_CODE[props.CTP_KOR_NM] ||
            NAME_TO_CODE[props.name];

          if (!code || !REGIONS.find((r) => r.code === code)) return;

          const newEntries = featureToPolygonEntries(feature, code);
          entries.push(...newEntries);
        });
        setPolygonEntries(entries);
      })
      .catch((e) => {
        console.error("GeoJSON 로드 실패:", e);
        // GeoJSON 실패 시 기존 마커 방식으로 fallback
        setPolygonEntries([]);
      })
      .finally(() => setGeoLoading(false));
  }, []);

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
        const data = docSnap.data();
        const coords = data.coords;
        if (!coords || coords.length === 0) return;
        const firstCoord = coords[0];

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

  // GeoJSON 폴리곤이 없는 경우 → 기존 마커 방식으로 fallback
  const useFallbackMarkers = !geoLoading && polygonEntries.length === 0;

  return (
    <div className="space-y-4">

      {/* ── 지도 ─────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden shadow-sm" style={{ height: "360px" }}>
        {(mapLoading || geoLoading) ? (
          <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center gap-2">
            <p className="text-gray-400 animate-pulse text-2xl">🗺️</p>
            <p className="text-gray-400 text-sm animate-pulse">
              {mapLoading ? "지도 로딩 중..." : "행정구역 경계 로딩 중..."}
            </p>
          </div>
        ) : (
          <Map
            center={{ lat: 36.5, lng: 127.8 }}
            style={{ width: "100%", height: "100%" }}
            level={13}
          >
            {/* ── A. 행정구역 경계 폴리곤 (코로플레스) ── */}
            {polygonEntries.map((entry, idx) => {
              const stat  = regionStats[entry.code] || { distance: 0 };
              const color = getGradeColor(stat.distance);
              const isSelected = selectedRegion?.code === entry.code;
              const region = REGIONS.find((r) => r.code === entry.code);

              return (
                <Polygon
                  key={`${entry.code}-${idx}`}
                  path={entry.paths}
                  strokeWeight={isSelected ? 2.5 : 1.5}
                  strokeColor={isSelected ? "#1B5E20" : color.stroke}
                  strokeOpacity={isSelected ? 1 : 0.7}
                  fillColor={color.fill}
                  fillOpacity={isSelected ? 0.75 : 0.45}
                  onClick={() =>
                    setSelectedRegion({
                      ...region,
                      distance: stat.distance,
                      count:    stat.count,
                      color,
                    })
                  }
                />
              );
            })}

            {/* ── B. 지역명 레이블 (폴리곤 위에 텍스트) ── */}
            {!useFallbackMarkers && REGIONS.map((region) => {
              const stat  = regionStats[region.code] || { distance: 0 };
              const color = getGradeColor(stat.distance);
              const isSelected = selectedRegion?.code === region.code;

              return (
                <CustomOverlayMap
                  key={region.code}
                  position={{ lat: region.lat, lng: region.lng }}
                  zIndex={2}
                >
                  <div
                    onClick={() =>
                      setSelectedRegion({
                        ...region,
                        distance: stat.distance,
                        count:    stat.count,
                        color,
                      })
                    }
                    style={{
                      textShadow: "0 0 4px #fff, 0 0 4px #fff, 0 0 4px #fff",
                      color: isSelected ? "#1B5E20" : "#333",
                      cursor: "pointer",
                    }}
                    className={`text-center select-none leading-tight ${
                      isSelected ? "font-black" : "font-bold"
                    }`}
                  >
                    <div className="text-xs">{region.name}</div>
                    <div
                      className="text-[10px] font-bold"
                      style={{ color: color.fill }}
                    >
                      {color.grade}
                    </div>
                  </div>
                </CustomOverlayMap>
              );
            })}

            {/* ── Fallback: GeoJSON 실패 시 기존 마커 방식 ── */}
            {useFallbackMarkers && REGIONS.map((region) => {
              const stat  = regionStats[region.code] || { distance: 0 };
              const color = getGradeColor(stat.distance);
              return (
                <CustomOverlayMap
                  key={region.code}
                  position={{ lat: region.lat, lng: region.lng }}
                  zIndex={1}
                >
                  <button
                    onClick={() =>
                      setSelectedRegion({
                        ...region,
                        distance: stat.distance,
                        count:    stat.count,
                        color,
                      })
                    }
                    style={{
                      background: color.fill,
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

      {/* ── 선택된 지역 팝업 ─────────────────────────────── */}
      {selectedRegion && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-gray-800 text-base">
                {selectedRegion.name}
                <span
                  className="ml-2 px-2 py-0.5 rounded-lg text-xs font-black"
                  style={{
                    background: selectedRegion.color.fill,
                    color: selectedRegion.color.text,
                  }}
                >
                  {selectedRegion.color.grade}등급
                </span>
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">이번 달 플로깅 현황</p>
            </div>
            <button
              onClick={() => setSelectedRegion(null)}
              className="text-gray-300 text-xl leading-none"
            >
              ×
            </button>
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

      {/* ── 등급 범례 ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h3 className="font-bold text-gray-700 mb-2 text-sm">등급 기준 (이번 달 누적 거리)</h3>
        <div className="flex gap-1.5 flex-wrap">
          {[
            { grade: "S", label: "500km+",   fill: "#1B5E20", text: "#fff" },
            { grade: "A", label: "200km+",   fill: "#388E3C", text: "#fff" },
            { grade: "B", label: "100km+",   fill: "#66BB6A", text: "#fff" },
            { grade: "C", label: "50km+",    fill: "#A5D6A7", text: "#1B5E20" },
            { grade: "D", label: "10km+",    fill: "#C8E6C9", text: "#388E3C" },
            { grade: "-", label: "10km 미만", fill: "#E8F5E9", text: "#9E9E9E" },
          ].map((g) => (
            <div
              key={g.grade}
              style={{ background: g.fill, color: g.text }}
              className="px-2 py-1 rounded-lg text-xs font-bold"
            >
              {g.grade} {g.label}
            </div>
          ))}
        </div>
      </div>

      {/* ── 지역 순위 리스트 ──────────────────────────────── */}
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
              <div
                key={r.code}
                className={`flex items-center gap-3 px-4 py-2.5 border-b last:border-0 cursor-pointer transition-colors ${
                  selectedRegion?.code === r.code ? "bg-green-50" : "hover:bg-gray-50"
                }`}
                onClick={() =>
                  setSelectedRegion(
                    selectedRegion?.code === r.code ? null : { ...r, color }
                  )
                }
              >
                <span className="text-sm font-bold text-gray-400 w-5 text-center">
                  {idx + 1}
                </span>
                <div
                  style={{ background: color.fill, color: color.text }}
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