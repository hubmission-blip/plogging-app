"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection, query, where, getDocs, addDoc, serverTimestamp,
} from "firebase/firestore";
import { FileCheck, Download, ChevronLeft, CalendarDays, Clock, MapPin, Award, AlertCircle } from "lucide-react";

// ─── 상수: 인정 기준 ─────────────────────────────────────────
const MIN_DISTANCE_KM  = 0.5;    // 최소 500m
const MIN_DURATION_SEC = 600;    // 최소 10분
const MAX_DURATION_PER_SESSION = 4 * 3600; // 1회 최대 4시간
const MAX_DURATION_PER_DAY     = 6 * 3600; // 하루 최대 6시간
const MIN_SESSIONS     = 3;      // 최소 3회
const MIN_TOTAL_HOURS  = 2;      // 최소 2시간

// ─── 유틸 함수 ───────────────────────────────────────────────
function formatDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}

function formatDate(date) {
  return date.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\. /g, ".").replace(".", ".");
}

function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function generateCertNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `GYEA-${y}-${m}${d}-${seq}`;
}

// ─── 메인 컴포넌트 ──────────────────────────────────────────
export default function CertificatePage() {
  const { user } = useAuth();

  // 기간 선택
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate]     = useState("");

  // 조회 결과
  const [records, setRecords]       = useState([]);
  const [summary, setSummary]       = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");

  // 미리보기
  const [showPreview, setShowPreview] = useState(false);
  const [certNumber, setCertNumber]   = useState("");
  const certRef = useRef(null);

  // 기본 날짜 세팅 (최근 1개월)
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    setStartDate(toDateStr(start));
    setEndDate(toDateStr(end));
  }, []);

  // ─── 기록 조회 ────────────────────────────────────────────
  const handleSearch = async () => {
    if (!user?.uid) return;
    if (!startDate || !endDate) { setError("기간을 선택해주세요."); return; }
    setLoading(true); setError(""); setRecords([]); setSummary(null); setShowPreview(false);

    try {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const q = query(
        collection(db, "routes"),
        where("userId", "==", user.uid),
      );
      const snap = await getDocs(q);

      // 필터링: 기간 + 최소 거리 + 최소 시간
      const valid = [];
      snap.forEach((d) => {
        const data = d.data();
        const createdAt = data.createdAt?.toDate?.();
        if (!createdAt) return;
        if (createdAt < start || createdAt > end) return;

        const dist = data.distance || 0;
        const dur  = data.duration || 0;
        if (dist < MIN_DISTANCE_KM) return;
        if (dur < MIN_DURATION_SEC) return;

        valid.push({
          id: d.id,
          date: createdAt,
          dateStr: createdAt.toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" }),
          distance: dist,
          duration: Math.min(dur, MAX_DURATION_PER_SESSION), // 1회 최대 4시간 제한
          rawDuration: dur,
          points: data.points || 0,
          verified: data.verified || false,
        });
      });

      // 날짜순 정렬
      valid.sort((a, b) => a.date - b.date);

      // 하루 최대 6시간 제한 적용
      const dayMap = {};
      const adjusted = valid.map((r) => {
        const dayKey = r.date.toISOString().slice(0, 10);
        if (!dayMap[dayKey]) dayMap[dayKey] = 0;
        const remaining = MAX_DURATION_PER_DAY - dayMap[dayKey];
        const allowed = Math.min(r.duration, remaining);
        dayMap[dayKey] += allowed;
        return { ...r, adjustedDuration: allowed };
      }).filter((r) => r.adjustedDuration > 0);

      // 요약 계산
      const totalSessions = adjusted.length;
      const totalDuration = adjusted.reduce((s, r) => s + r.adjustedDuration, 0);
      const totalDistance  = adjusted.reduce((s, r) => s + r.distance, 0);
      const totalHours     = totalDuration / 3600;

      const isEligible = totalSessions >= MIN_SESSIONS && totalHours >= MIN_TOTAL_HOURS;

      setRecords(adjusted);
      setSummary({
        totalSessions,
        totalDuration,
        totalDistance,
        totalHours,
        isEligible,
        startDate: start,
        endDate: end,
      });
    } catch (e) {
      setError("기록 조회 실패: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── 증명서 발급 ──────────────────────────────────────────
  const handleIssue = () => {
    const num = generateCertNumber();
    setCertNumber(num);
    setShowPreview(true);
  };

  // ─── PDF 다운로드 (브라우저 print) ────────────────────────
  const handleDownload = () => {
    if (!certRef.current) return;
    const content = certRef.current.innerHTML;
    const win = window.open("", "_blank", "width=800,height=1000");
    win.document.write(`
      <!DOCTYPE html>
      <html><head>
        <meta charset="utf-8" />
        <title>봉사활동 증명서</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; margin: 0; padding: 20px; color: #1a1a1a; }
          .cert-container { max-width: 700px; margin: 0 auto; border: 3px solid #2c5f2d; padding: 40px; position: relative; }
          .cert-border-inner { border: 1px solid #2c5f2d; padding: 35px; }
          .cert-header { text-align: center; margin-bottom: 30px; }
          .cert-title { font-size: 28px; font-weight: 900; letter-spacing: 8px; color: #2c5f2d; margin: 0; }
          .cert-subtitle { font-size: 13px; color: #666; margin-top: 5px; }
          .cert-number { font-size: 11px; color: #999; text-align: right; margin-bottom: 15px; }
          .cert-body { line-height: 2; font-size: 15px; margin: 25px 0; }
          .cert-body .name { font-size: 20px; font-weight: 900; text-decoration: underline; text-underline-offset: 4px; }
          .cert-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
          .cert-table th { background: #f0f7f0; border: 1px solid #ccc; padding: 8px 12px; text-align: center; font-weight: 700; color: #2c5f2d; }
          .cert-table td { border: 1px solid #ccc; padding: 8px 12px; text-align: center; }
          .cert-note { font-size: 12px; color: #888; margin: 15px 0; line-height: 1.6; }
          .cert-footer { text-align: center; margin-top: 35px; }
          .cert-date { font-size: 15px; color: #333; margin-bottom: 25px; }
          .cert-org { font-size: 16px; font-weight: 700; color: #2c5f2d; }
          .cert-stamp { display: inline-block; border: 3px solid #c0392b; border-radius: 50%; width: 80px; height: 80px; line-height: 80px; text-align: center; font-size: 14px; font-weight: 900; color: #c0392b; margin-top: 15px; transform: rotate(-15deg); }
          @media print { body { padding: 0; } }
        </style>
      </head><body>${content}
        <script>window.onload = function() { window.print(); }</script>
      </body></html>
    `);
    win.document.close();
  };

  // ─── 로그인 필요 ──────────────────────────────────────────
  if (!user) return (
    <div className="flex flex-col items-center justify-center h-screen gap-4 text-center px-6">
      <div className="text-5xl">🔑</div>
      <p className="font-bold text-gray-700">로그인이 필요해요</p>
      <Link href="/login" className="text-sm text-green-600 font-bold underline">로그인하기</Link>
    </div>
  );

  const displayName = user.displayName || user.email?.split("@")[0] || "사용자";
  const today = new Date();
  const todayStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

  return (
    <div className="min-h-screen bg-gray-50"
      style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom, 20px))" }}>

      {/* ── 헤더 ── */}
      <div className="bg-gray-50 px-4 pt-4 pb-1 flex justify-between items-center">
        <Link href="/">
          <img src="https://gyea.kr/wp/wp-content/uploads/2025/12/500_subtitle_c.png"
            alt="오백원의 행복" className="h-9 w-auto object-contain" />
        </Link>
        <p className="text-sm font-black text-gray-700">📜 봉사활동 증명서</p>
      </div>

      <div className="px-4 mt-4 space-y-4">

        {/* ── 안내 카드 ── */}
        <div className="bg-green-50 rounded-2xl p-4 border border-green-200">
          <h2 className="font-bold text-green-800 text-sm mb-2">📋 발급 기준 안내</h2>
          <div className="space-y-1 text-xs text-green-700">
            <p>• 1회 플로깅: 최소 <b>500m</b> 이상 이동 + <b>10분</b> 이상 활동</p>
            <p>• 1회 최대 인정 시간: <b>4시간</b> / 하루 최대: <b>6시간</b></p>
            <p>• 발급 조건: 기간 내 <b>3회 이상</b> 참여, 합산 <b>2시간 이상</b></p>
            <p>• GPS 경로가 기록된 활동만 인정됩니다</p>
          </div>
        </div>

        {/* ── 기간 선택 ── */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-bold text-gray-700 text-sm mb-3 flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 text-gray-500" /> 활동 기간 선택
          </h2>
          <div className="flex gap-2 items-center">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400" />
            <span className="text-gray-400 text-sm font-bold">~</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400" />
          </div>
          <button onClick={handleSearch} disabled={loading}
            className="w-full mt-3 bg-green-500 text-white py-3 rounded-xl font-bold text-sm disabled:opacity-40 active:scale-95 transition-transform">
            {loading ? "조회 중..." : "기록 조회하기"}
          </button>
          {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
        </div>

        {/* ── 조회 결과 요약 ── */}
        {summary && (
          <>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h2 className="font-bold text-gray-700 text-sm mb-3">📊 조회 결과</h2>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-black text-green-700">{summary.totalSessions}</p>
                  <p className="text-[10px] text-green-600 font-medium mt-0.5">인정 횟수</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-black text-blue-700">{summary.totalHours.toFixed(1)}</p>
                  <p className="text-[10px] text-blue-600 font-medium mt-0.5">봉사시간(h)</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-black text-purple-700">{summary.totalDistance.toFixed(1)}</p>
                  <p className="text-[10px] text-purple-600 font-medium mt-0.5">이동거리(km)</p>
                </div>
              </div>

              {/* 발급 가능 여부 */}
              {summary.isEligible ? (
                <div className="bg-green-100 border border-green-300 rounded-xl p-3 flex items-center gap-2">
                  <Award className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <p className="text-sm font-bold text-green-700">발급 조건을 충족했습니다!</p>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                    <p className="text-sm font-bold text-red-600">발급 조건 미충족</p>
                  </div>
                  <div className="text-xs text-red-500 space-y-0.5">
                    {summary.totalSessions < MIN_SESSIONS && (
                      <p>• 참여 횟수 부족: {summary.totalSessions}회 / 최소 {MIN_SESSIONS}회</p>
                    )}
                    {summary.totalHours < MIN_TOTAL_HOURS && (
                      <p>• 활동 시간 부족: {summary.totalHours.toFixed(1)}시간 / 최소 {MIN_TOTAL_HOURS}시간</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── 상세 기록 리스트 ── */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h2 className="font-bold text-gray-700 text-sm mb-2">📝 인정된 활동 목록</h2>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {records.map((r, i) => (
                  <div key={r.id} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0 text-xs">
                    <span className="w-5 text-center text-gray-400 font-bold">{i + 1}</span>
                    <span className="flex-1 text-gray-700">{r.dateStr}</span>
                    <span className="text-blue-600 font-medium flex items-center gap-0.5">
                      <Clock className="w-3 h-3" /> {formatDuration(r.adjustedDuration)}
                    </span>
                    <span className="text-green-600 font-medium flex items-center gap-0.5">
                      <MapPin className="w-3 h-3" /> {r.distance.toFixed(2)}km
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── 발급 버튼 ── */}
            {summary.isEligible && !showPreview && (
              <button onClick={handleIssue}
                className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold text-base shadow-md active:scale-95 transition-transform flex items-center justify-center gap-2">
                <FileCheck className="w-5 h-5" /> 증명서 미리보기
              </button>
            )}
          </>
        )}

        {/* ═══════════ 증명서 미리보기 ═══════════ */}
        {showPreview && (
          <>
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden border-2 border-green-200">
              <div className="bg-green-700 text-white text-center py-2 text-xs font-bold">증명서 미리보기</div>
              <div className="p-4 overflow-x-auto">
                <div ref={certRef}>
                  <div className="cert-container" style={{ maxWidth: 700, margin: "0 auto", border: "3px solid #2c5f2d", padding: 30 }}>
                    <div style={{ border: "1px solid #2c5f2d", padding: 25 }}>

                      {/* 헤더 */}
                      <div style={{ textAlign: "center", marginBottom: 25 }}>
                        <p style={{ fontSize: 24, fontWeight: 900, letterSpacing: 6, color: "#2c5f2d", margin: 0 }}>봉 사 활 동 증 명 서</p>
                        <p style={{ fontSize: 11, color: "#999", marginTop: 4 }}>Certificate of Volunteer Service</p>
                      </div>

                      {/* 발급번호 */}
                      <p style={{ fontSize: 11, color: "#999", textAlign: "right", marginBottom: 12 }}>발급번호: {certNumber}</p>

                      {/* 본문 */}
                      <div style={{ lineHeight: 2.2, fontSize: 14 }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                          <tbody>
                            <tr>
                              <td style={{ border: "1px solid #ccc", padding: "8px 12px", background: "#f0f7f0", fontWeight: 700, color: "#2c5f2d", width: "25%", textAlign: "center" }}>성 명</td>
                              <td style={{ border: "1px solid #ccc", padding: "8px 12px", fontSize: 15, fontWeight: 700 }}>{displayName}</td>
                            </tr>
                            <tr>
                              <td style={{ border: "1px solid #ccc", padding: "8px 12px", background: "#f0f7f0", fontWeight: 700, color: "#2c5f2d", textAlign: "center" }}>활동 기간</td>
                              <td style={{ border: "1px solid #ccc", padding: "8px 12px" }}>
                                {summary.startDate.toLocaleDateString("ko-KR")} ~ {summary.endDate.toLocaleDateString("ko-KR")}
                              </td>
                            </tr>
                            <tr>
                              <td style={{ border: "1px solid #ccc", padding: "8px 12px", background: "#f0f7f0", fontWeight: 700, color: "#2c5f2d", textAlign: "center" }}>활동 내용</td>
                              <td style={{ border: "1px solid #ccc", padding: "8px 12px" }}>환경정화 봉사활동 (플로깅)</td>
                            </tr>
                            <tr>
                              <td style={{ border: "1px solid #ccc", padding: "8px 12px", background: "#f0f7f0", fontWeight: 700, color: "#2c5f2d", textAlign: "center" }}>활동 횟수</td>
                              <td style={{ border: "1px solid #ccc", padding: "8px 12px" }}>{summary.totalSessions}회</td>
                            </tr>
                            <tr>
                              <td style={{ border: "1px solid #ccc", padding: "8px 12px", background: "#f0f7f0", fontWeight: 700, color: "#2c5f2d", textAlign: "center" }}>봉사 시간</td>
                              <td style={{ border: "1px solid #ccc", padding: "8px 12px", fontWeight: 700, fontSize: 15 }}>{summary.totalHours.toFixed(1)} 시간</td>
                            </tr>
                            <tr>
                              <td style={{ border: "1px solid #ccc", padding: "8px 12px", background: "#f0f7f0", fontWeight: 700, color: "#2c5f2d", textAlign: "center" }}>이동 거리</td>
                              <td style={{ border: "1px solid #ccc", padding: "8px 12px" }}>{summary.totalDistance.toFixed(2)} km</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* 증명 문구 */}
                      <p style={{ textAlign: "center", fontSize: 14, lineHeight: 2, margin: "25px 0 10px" }}>
                        위 사람은 상기 기간 동안 환경정화 봉사활동(플로깅)에<br />
                        성실히 참여하였음을 증명합니다.
                      </p>

                      {/* 비고 */}
                      <p style={{ fontSize: 11, color: "#888", lineHeight: 1.6, margin: "15px 0" }}>
                        ※ 본 증명서는 GPS 기반 활동 기록을 근거로 자동 발급되었습니다.<br />
                        ※ 발급번호를 통해 진위 여부를 확인할 수 있습니다.
                      </p>

                      {/* 하단: 날짜 + 기관 + 직인 */}
                      <div style={{ textAlign: "center", marginTop: 30 }}>
                        <p style={{ fontSize: 14, color: "#333", marginBottom: 20 }}>{todayStr}</p>
                        <p style={{ fontSize: 15, fontWeight: 700, color: "#2c5f2d", marginBottom: 5 }}>사단법인 국제청년환경연합회</p>
                        <p style={{ fontSize: 12, color: "#666" }}>Global Youth Environmental Association</p>
                        {/* 임시 직인 (추후 이미지로 교체) */}
                        <div style={{
                          display: "inline-block",
                          border: "3px solid #c0392b",
                          borderRadius: "50%",
                          width: 80, height: 80,
                          lineHeight: "76px",
                          textAlign: "center",
                          fontSize: 12,
                          fontWeight: 900,
                          color: "#c0392b",
                          marginTop: 15,
                          transform: "rotate(-15deg)",
                        }}>
                          국제청년<br style={{ lineHeight: 0 }} />환경연합회
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* PDF 다운로드 */}
            <button onClick={handleDownload}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-base shadow-md active:scale-95 transition-transform flex items-center justify-center gap-2">
              <Download className="w-5 h-5" /> PDF 다운로드 / 인쇄
            </button>

            {/* 닫기 */}
            <button onClick={() => setShowPreview(false)}
              className="w-full bg-white text-gray-400 py-3 rounded-2xl text-sm font-medium shadow-sm">
              미리보기 닫기
            </button>
          </>
        )}
      </div>
    </div>
  );
}
