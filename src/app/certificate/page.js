"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection, query, where, getDocs, addDoc, serverTimestamp,
  doc, getDoc,
} from "firebase/firestore";
import { FileCheck, Download, ChevronLeft, CalendarDays, Clock, MapPin, Award, AlertCircle, History, RotateCcw, Printer, Lock, ScrollText, ClipboardList, BarChart3, FileText, PenLine } from "lucide-react";

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

function formatHoursMinutes(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h > 0 && m > 0) return `${h}시간 ${m}분`;
  if (h > 0) return `${h}시간`;
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

async function generateCertNumber(db) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");

  // 해당 연도의 기존 발급 건수를 조회하여 순번 결정
  const { collection, query, where, getDocs } = await import("firebase/firestore");
  const prefix = `GYEA-${y}-`;
  const q = query(
    collection(db, "certificates"),
    where("certNumber", ">=", prefix),
    where("certNumber", "<=", prefix + "\uf8ff"),
  );
  const snap = await getDocs(q);
  const seq = String(snap.size + 1).padStart(4, "0");
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

  // 실명 입력
  const [realName, setRealName]             = useState("");
  const [showNameInput, setShowNameInput]   = useState(false);

  // 미리보기
  const [showPreview, setShowPreview] = useState(false);
  const [certNumber, setCertNumber]   = useState("");
  const certRef = useRef(null);

  // 재출력 미리보기
  const [reprintData, setReprintData] = useState(null);
  const reprintRef = useRef(null);

  // 발급 내역
  const [issuedCerts, setIssuedCerts] = useState([]);
  const [dupWarning, setDupWarning]   = useState("");
  const [saving, setSaving]           = useState(false);

  // 1365 회원번호
  const [volunteerNo, setVolunteerNo] = useState("");

  // 사용자 프로필에서 1365 회원번호 조회
  useEffect(() => {
    if (!user?.uid) return;
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (snap.exists()) {
        setVolunteerNo(snap.data().volunteerNo || "");
        // realName도 프로필에서 가져오기
        if (snap.data().realName) setRealName(snap.data().realName);
      }
    }).catch(() => {});
  }, [user?.uid]);

  // 기본 날짜 세팅 (최근 1개월)
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    setStartDate(toDateStr(start));
    setEndDate(toDateStr(end));
  }, []);

  // 발급 내역 로드
  useEffect(() => {
    if (!user?.uid) return;
    const fetchCerts = async () => {
      try {
        const q = query(
          collection(db, "certificates"),
          where("userId", "==", user.uid),
        );
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.issuedAt?.seconds || 0) - (a.issuedAt?.seconds || 0));
        setIssuedCerts(list);
      } catch (e) {
        console.warn("발급 내역 로드 실패:", e.message);
      }
    };
    fetchCerts();
  }, [user?.uid]);

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

  // ─── 중복 발급 체크 ──────────────────────────────────────
  const checkDuplicate = () => {
    if (!summary) return false;
    const newStart = summary.startDate.getTime();
    const newEnd   = summary.endDate.getTime();

    return issuedCerts.some((cert) => {
      const certStart = cert.periodStart?.toDate?.()?.getTime() || 0;
      const certEnd   = cert.periodEnd?.toDate?.()?.getTime() || 0;
      // 기간이 겹치는지 확인
      return newStart <= certEnd && newEnd >= certStart;
    });
  };

  // ─── 증명서 발급: 실명 입력 단계 ────────────────────────────
  const handleRequestIssue = () => {
    setDupWarning("");
    // 중복 체크
    if (checkDuplicate()) {
      setDupWarning("해당 기간과 겹치는 증명서가 이미 발급되었습니다. 동일 기간에 대해 중복 발급은 불가합니다.");
      return;
    }
    setRealName("");
    setShowNameInput(true);
  };

  const handleConfirmIssue = async () => {
    if (!realName.trim()) { alert("실명을 입력해주세요."); return; }
    if (realName.trim().length < 2) { alert("성명은 2자 이상 입력해주세요."); return; }

    setSaving(true);
    try {
      const num = await generateCertNumber(db);

      // Firestore에 발급 기록 저장
      await addDoc(collection(db, "certificates"), {
        certNumber: num,
        userId: user.uid,
        realName: realName.trim(),
        email: user.email || "",
        displayName: user.displayName || "",
        periodStart: summary.startDate,
        periodEnd: summary.endDate,
        totalSessions: summary.totalSessions,
        totalHours: Math.round(summary.totalHours * 10) / 10,
        totalDistance: Math.round(summary.totalDistance * 100) / 100,
        activityName: "환경정화 봉사활동 (플로깅)",
        organization: "사단법인 국제청년환경연합회",
        // 1365 자원봉사 연계 정보
        volunteerNo: volunteerNo || "",
        volunteerCategory: "환경보호",
        volunteerSubCategory: "환경정화활동",
        volunteerOrgName: "국제청년환경연합회",
        volunteerHours: Math.max(1, Math.round(summary.totalHours)),
        issuedAt: serverTimestamp(),
      });

      setCertNumber(num);
      setShowNameInput(false);
      setShowPreview(true);

      // 발급 내역 갱신
      const q = query(collection(db, "certificates"), where("userId", "==", user.uid));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.issuedAt?.seconds || 0) - (a.issuedAt?.seconds || 0));
      setIssuedCerts(list);
    } catch (e) {
      alert("증명서 발급 실패: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── 재출력 (발급 내역에서) ─────────────────────────────────
  const handleReprint = (cert) => {
    const pStart = cert.periodStart?.toDate?.();
    const pEnd   = cert.periodEnd?.toDate?.();
    const issuedDate = cert.issuedAt?.toDate?.();
    const periodStr = pStart && pEnd
      ? `${pStart.toLocaleDateString("ko-KR")} ~ ${pEnd.toLocaleDateString("ko-KR")}`
      : "";
    const dateStr = issuedDate
      ? `${issuedDate.getFullYear()}년 ${issuedDate.getMonth() + 1}월 ${issuedDate.getDate()}일`
      : todayStr;

    setReprintData({
      certNumber: cert.certNumber,
      realName: cert.realName,
      email: cert.email,
      nickname: cert.displayName || "",
      volunteerNo: cert.volunteerNo || volunteerNo || "",
      periodStr,
      totalSessions: cert.totalSessions,
      totalHours: cert.totalHours,
      totalDistance: cert.totalDistance,
      dateStr,
    });

    // 스크롤을 상단으로 이동
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 100);
  };

  // ─── 증명서 HTML 생성 ────────────────────────────────────
  const buildCertHTML = ({ certNumber: num, realName: name, email, nickname = "", periodStr, totalSessions, totalHours, totalDistance, dateStr, volunteerNo: vNo = "" }) => {
    return `
      <div style="max-width:700px;margin:0 auto;border:3px solid #2c5f2d;padding:30px">
        <div style="border:1px solid #2c5f2d;padding:25px;min-height:796px;display:flex;flex-direction:column">
          <div style="text-align:center;margin-bottom:25px">
            <p style="font-size:24px;font-weight:900;letter-spacing:6px;color:#2c5f2d;margin:0">봉 사 활 동 증 명 서</p>
            <p style="font-size:11px;color:#999;margin-top:4px">Certificate of Volunteer Service</p>
          </div>
          <p style="font-size:11px;color:#999;text-align:right;margin-bottom:12px">발급번호: ${num}</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <tr>
              <td style="border:1px solid #ccc;padding:8px 12px;background:#f0f7f0;font-weight:700;color:#2c5f2d;width:25%;text-align:center">성 명</td>
              <td style="border:1px solid #ccc;padding:8px 12px;font-size:15px;font-weight:700">${name}</td>
            </tr>
            ${vNo ? `<tr>
              <td style="border:1px solid #ccc;padding:8px 12px;background:#f0f7f0;font-weight:700;color:#2c5f2d;text-align:center">1365 회원번호</td>
              <td style="border:1px solid #ccc;padding:8px 12px;font-size:13px;font-weight:600;color:#1d4ed8">${vNo}</td>
            </tr>` : ""}
            <tr>
              <td style="border:1px solid #ccc;padding:8px 12px;background:#f0f7f0;font-weight:700;color:#2c5f2d;text-align:center">아이디</td>
              <td style="border:1px solid #ccc;padding:8px 12px;font-size:13px;color:#555">${nickname ? `${nickname} / ` : ""}${email}</td>
            </tr>
            <tr>
              <td style="border:1px solid #ccc;padding:8px 12px;background:#f0f7f0;font-weight:700;color:#2c5f2d;text-align:center">봉사 단체</td>
              <td style="border:1px solid #ccc;padding:8px 12px">사단법인 국제청년환경연합회</td>
            </tr>
            <tr>
              <td style="border:1px solid #ccc;padding:8px 12px;background:#f0f7f0;font-weight:700;color:#2c5f2d;text-align:center">봉사 분류</td>
              <td style="border:1px solid #ccc;padding:8px 12px">환경보호 &gt; 환경정화활동</td>
            </tr>
            <tr>
              <td style="border:1px solid #ccc;padding:8px 12px;background:#f0f7f0;font-weight:700;color:#2c5f2d;text-align:center">활동 기간</td>
              <td style="border:1px solid #ccc;padding:8px 12px">${periodStr}</td>
            </tr>
            <tr>
              <td style="border:1px solid #ccc;padding:8px 12px;background:#f0f7f0;font-weight:700;color:#2c5f2d;text-align:center">활동 내용</td>
              <td style="border:1px solid #ccc;padding:8px 12px">환경정화 봉사활동 (플로깅)</td>
            </tr>
            <tr>
              <td style="border:1px solid #ccc;padding:8px 12px;background:#f0f7f0;font-weight:700;color:#2c5f2d;text-align:center">활동 횟수</td>
              <td style="border:1px solid #ccc;padding:8px 12px">${totalSessions}회</td>
            </tr>
            <tr>
              <td style="border:1px solid #ccc;padding:8px 12px;background:#f0f7f0;font-weight:700;color:#2c5f2d;text-align:center">봉사 시간</td>
              <td style="border:1px solid #ccc;padding:8px 12px;font-weight:700;font-size:15px">${formatHoursMinutes(totalHours)} <span style="font-size:11px;color:#666;font-weight:400;margin-left:8px">(1365 인정: ${Math.max(1, Math.round(totalHours))}시간)</span></td>
            </tr>
            <tr>
              <td style="border:1px solid #ccc;padding:8px 12px;background:#f0f7f0;font-weight:700;color:#2c5f2d;text-align:center">이동 거리</td>
              <td style="border:1px solid #ccc;padding:8px 12px">${totalDistance} km</td>
            </tr>
          </table>
          <p style="text-align:center;font-size:14px;line-height:2;margin:25px 0 10px">
            위 사람은 상기 기간 동안 환경정화 봉사활동(플로깅)에<br/>성실히 참여하였음을 증명합니다.
          </p>
          <p style="font-size:11px;color:#888;line-height:1.6;margin:15px 0">
            ※ 본 증명서는 사단법인 국제청년환경연합회에서 운영중인 &lsquo;오백원의 행복&rsquo; 플로깅 앱을 통해 수집된 데이터를 근거로 작성되었습니다.<br/>
            ※ 활동 기록은 GPS 기반으로 실시간 수집되며, 발급 기준 충족 시 자동 발급됩니다.<br/>
            ※ 성명은 본인 신고에 의하며, 허위 기재 시 효력이 인정되지 않습니다.<br/>
            ※ 발급번호를 통해 진위 여부를 확인할 수 있습니다.
          </p>
          <div style="position:relative;margin-top:auto;padding-top:8px">
            <div style="text-align:center">
              <p style="font-size:14px;color:#333;margin-bottom:12px">${dateStr}</p>
              <p style="font-size:15px;font-weight:700;color:#2c5f2d;margin-bottom:2px">사단법인 국제청년환경연합회</p>
              <p style="font-size:13px;font-weight:700;color:#333;margin-bottom:2px">회장 장희재</p>
              <p style="font-size:12px;color:#666">Global Youth Environmental Association</p>
            </div>
            <img src="https://res.cloudinary.com/dqlvm572h/image/upload/w_200,q_auto,f_auto/sign_gyea_oydzt1.png" alt="직인" style="width:100px;height:auto;position:absolute;right:12%;bottom:0" />
          </div>
        </div>
      </div>`;
  };

  // ─── 인쇄 창 열기 ──────────────────────────────────────────
  const openPrintWindow = (bodyContent) => {
    const win = window.open("", "_blank", "width=800,height=1000");
    win.document.write(`
      <!DOCTYPE html>
      <html><head>
        <meta charset="utf-8" />
        <title>봉사활동 증명서</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; margin: 0; padding: 20px; color: #1a1a1a; }
          @media print { body { padding: 0; } }
        </style>
      </head><body>${bodyContent}
        <script>window.onload = function() { window.print(); }<\/script>
      </body></html>
    `);
    win.document.close();
  };

  // ─── PDF 다운로드 (브라우저 print) ────────────────────────
  const handleDownload = (targetRef) => {
    const ref = targetRef || certRef;
    if (!ref.current) return;
    const content = ref.current.innerHTML;
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
          .cert-stamp-img { width: 100px; height: auto; margin-top: 15px; }
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
      <div><Lock size={48} className="text-gray-300" strokeWidth={1.5} /></div>
      <p className="font-bold text-gray-700">로그인이 필요해요</p>
      <Link href="/login" className="text-sm text-green-600 font-bold underline">로그인하기</Link>
    </div>
  );

  const displayName = realName.trim() || user.displayName || user.email?.split("@")[0] || "사용자";
  const userEmail = user?.email || "";
  const today = new Date();
  const todayStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

  return (
    <div className="min-h-screen bg-gray-50"
      style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom, 20px))" }}>

      {/* ── 헤더 ── */}
      <div className="bg-gray-50 px-4 pt-4 pb-1 flex justify-between items-center">
        <Link href="/">
          <img src="https://res.cloudinary.com/dqlvm572h/image/upload/w_200,q_auto,f_auto/Intro_Logo_fuj1kt.png"
            alt="오백원의 행복" className="h-9 w-auto object-contain" />
        </Link>
        <p className="text-sm font-black text-gray-700 flex items-center gap-1"><ScrollText className="w-4 h-4" strokeWidth={1.8} /> 봉사활동 증명서</p>
      </div>

      <div className="px-4 mt-4 space-y-4">

        {/* ── 안내 카드 ── */}
        <div className="bg-green-50 rounded-2xl p-4 border border-green-200">
          <h2 className="font-bold text-green-800 text-sm mb-2 flex items-center gap-1"><ClipboardList className="w-4 h-4" strokeWidth={1.8} /> 발급 기준 안내</h2>
          <div className="space-y-1 text-xs text-green-700">
            <p>• 1회 플로깅: 최소 <b>500m</b> 이상 이동 + <b>10분</b> 이상 활동</p>
            <p>• 1회 최대 인정 시간: <b>4시간</b> / 하루 최대: <b>6시간</b></p>
            <p>• 발급 조건: 기간 내 <b>3회 이상</b> 참여, 합산 <b>2시간 이상</b></p>
            <p>• GPS 경로가 기록된 활동만 인정됩니다</p>
            <p>• <b>1365 자원봉사 포털</b> 연계 시 회원번호를 프로필에 등록하세요</p>
          </div>
        </div>

        {/* ── 1365 회원번호 안내 ── */}
        {!volunteerNo && (
          <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200">
            <h2 className="font-bold text-blue-700 text-sm mb-1 flex items-center gap-1"><Award className="w-4 h-4" strokeWidth={1.8} /> 1365 자원봉사 연계</h2>
            <p className="text-xs text-blue-600 leading-relaxed">
              프로필에서 1365 자원봉사 회원번호를 등록하면 증명서에 자동으로 표기됩니다.
              관리자가 CSV로 일괄 등록하여 1365 포털에 봉사시간을 반영할 수 있습니다.
            </p>
            <Link href="/profile/edit" className="inline-block mt-2 text-xs font-bold text-blue-700 underline underline-offset-2">
              프로필에서 등록하기 →
            </Link>
          </div>
        )}
        {volunteerNo && (
          <div className="bg-blue-50 rounded-2xl p-3 border border-blue-200 flex items-center gap-2">
            <Award className="w-5 h-5 text-blue-600 flex-shrink-0" strokeWidth={1.8} />
            <div>
              <p className="text-xs font-bold text-blue-700">1365 회원번호: {volunteerNo}</p>
              <p className="text-[10px] text-blue-500">증명서에 자동 포함됩니다</p>
            </div>
          </div>
        )}

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
              <h2 className="font-bold text-gray-700 text-sm mb-3 flex items-center gap-1"><BarChart3 className="w-4 h-4" strokeWidth={1.8} /> 조회 결과</h2>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-black text-green-700">{summary.totalSessions}</p>
                  <p className="text-[10px] text-green-600 font-medium mt-0.5">인정 횟수</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-black text-blue-700">{formatHoursMinutes(summary.totalHours)}</p>
                  <p className="text-[10px] text-blue-600 font-medium mt-0.5">봉사시간</p>
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
                      <p>• 활동 시간 부족: {formatHoursMinutes(summary.totalHours)} / 최소 {MIN_TOTAL_HOURS}시간</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── 상세 기록 리스트 ── */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h2 className="font-bold text-gray-700 text-sm mb-2 flex items-center gap-1"><FileText className="w-4 h-4" strokeWidth={1.8} /> 인정된 활동 목록</h2>
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

            {/* ── 중복 경고 ── */}
            {dupWarning && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700 font-medium">{dupWarning}</p>
              </div>
            )}

            {/* ── 발급 버튼 ── */}
            {summary.isEligible && !showPreview && !showNameInput && (
              <button onClick={handleRequestIssue}
                className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold text-base shadow-md active:scale-95 transition-transform flex items-center justify-center gap-2">
                <FileCheck className="w-5 h-5" /> 증명서 발급하기
              </button>
            )}

            {/* ── 실명 입력 단계 ── */}
            {showNameInput && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border-2 border-green-300">
                <h2 className="font-bold text-gray-800 text-sm mb-1 flex items-center gap-1"><PenLine className="w-4 h-4" strokeWidth={1.8} /> 실명 입력</h2>
                <p className="text-xs text-gray-400 mb-4">증명서에 표기될 본인 실명을 정확히 입력해주세요.</p>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">성명 (실명)</label>
                    <input value={realName} onChange={(e) => setRealName(e.target.value)}
                      placeholder="홍길동" maxLength={20}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base font-bold focus:outline-none focus:border-green-400" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">이메일 / 아이디</label>
                    <p className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-500">
                      {user?.email || "이메일 없음"}
                    </p>
                  </div>
                </div>

                <p className="text-[10px] text-gray-300 mt-3 leading-relaxed">
                  ※ 입력하신 성명은 증명서에만 사용되며, 본인 신고에 의합니다.<br />
                  ※ 허위 기재 시 증명서의 효력이 인정되지 않을 수 있습니다.
                </p>

                <div className="flex gap-2 mt-4">
                  <button onClick={() => setShowNameInput(false)} disabled={saving}
                    className="flex-1 bg-gray-100 text-gray-500 py-3 rounded-xl font-bold text-sm">취소</button>
                  <button onClick={handleConfirmIssue} disabled={saving}
                    className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold text-sm active:scale-95 transition-transform disabled:opacity-40">
                    {saving ? "발급 중..." : "증명서 생성"}
                  </button>
                </div>
              </div>
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
                    <div style={{ border: "1px solid #2c5f2d", padding: 25, minHeight: 796, display: "flex", flexDirection: "column" }}>

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
                            {volunteerNo && (
                              <tr>
                                <td style={{ border: "1px solid #ccc", padding: "8px 12px", background: "#f0f7f0", fontWeight: 700, color: "#2c5f2d", textAlign: "center" }}>1365 회원번호</td>
                                <td style={{ border: "1px solid #ccc", padding: "8px 12px", fontSize: 13, fontWeight: 600, color: "#1d4ed8" }}>{volunteerNo}</td>
                              </tr>
                            )}
                            <tr>
                              <td style={{ border: "1px solid #ccc", padding: "8px 12px", background: "#f0f7f0", fontWeight: 700, color: "#2c5f2d", textAlign: "center" }}>아이디</td>
                              <td style={{ border: "1px solid #ccc", padding: "8px 12px", fontSize: 13, color: "#555" }}>{user?.displayName ? `${user.displayName} / ` : ""}{userEmail}</td>
                            </tr>
                            <tr>
                              <td style={{ border: "1px solid #ccc", padding: "8px 12px", background: "#f0f7f0", fontWeight: 700, color: "#2c5f2d", textAlign: "center" }}>봉사 단체</td>
                              <td style={{ border: "1px solid #ccc", padding: "8px 12px" }}>사단법인 국제청년환경연합회</td>
                            </tr>
                            <tr>
                              <td style={{ border: "1px solid #ccc", padding: "8px 12px", background: "#f0f7f0", fontWeight: 700, color: "#2c5f2d", textAlign: "center" }}>봉사 분류</td>
                              <td style={{ border: "1px solid #ccc", padding: "8px 12px" }}>환경보호 &gt; 환경정화활동</td>
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
                              <td style={{ border: "1px solid #ccc", padding: "8px 12px", fontWeight: 700, fontSize: 15 }}>
                                {formatHoursMinutes(summary.totalHours)}
                                <span style={{ fontSize: 11, color: "#666", fontWeight: 400, marginLeft: 8 }}>
                                  (1365 인정: {Math.max(1, Math.round(summary.totalHours))}시간)
                                </span>
                              </td>
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
                        ※ 본 증명서는 사단법인 국제청년환경연합회에서 운영중인 '오백원의 행복' 플로깅 앱을 통해 수집된 데이터를 근거로 작성되었습니다.<br />
                        ※ 활동 기록은 GPS 기반으로 실시간 수집되며, 발급 기준 충족 시 자동 발급됩니다.<br />
                        ※ 성명은 본인 신고에 의하며, 허위 기재 시 효력이 인정되지 않습니다.<br />
                        ※ 발급번호를 통해 진위 여부를 확인할 수 있습니다.
                      </p>

                      {/* 하단: 날짜 + 기관 + 직인 */}
                      <div style={{ position: "relative", marginTop: "auto", paddingTop: 8 }}>
                        <div style={{ textAlign: "center" }}>
                          <p style={{ fontSize: 14, color: "#333", marginBottom: 12 }}>{todayStr}</p>
                          <p style={{ fontSize: 15, fontWeight: 700, color: "#2c5f2d", marginBottom: 2 }}>사단법인 국제청년환경연합회</p>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#333", marginBottom: 2 }}>회장 장희재</p>
                          <p style={{ fontSize: 12, color: "#666" }}>Global Youth Environmental Association</p>
                        </div>
                        <img
                          src="https://res.cloudinary.com/dqlvm572h/image/upload/w_200,q_auto,f_auto/sign_gyea_oydzt1.png"
                          alt="국제청년환경연합회 직인"
                          style={{ width: 100, height: "auto", position: "absolute", right: "12%", bottom: 0 }}
                        />
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

        {/* ═══════════ 재출력 미리보기 ═══════════ */}
        {reprintData && (
          <>
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden border-2 border-green-200">
              <div className="bg-green-700 text-white text-center py-2 text-xs font-bold">증명서 재출력</div>
              <div className="p-4 overflow-x-auto">
                <div ref={reprintRef}>
                  <div className="cert-container" style={{ maxWidth: 700, margin: "0 auto", border: "3px solid #2c5f2d", padding: 30 }}>
                    <div style={{ border: "1px solid #2c5f2d", padding: 25, minHeight: 796, display: "flex", flexDirection: "column" }}>
                      <div style={{ textAlign: "center", marginBottom: 25 }}>
                        <p style={{ fontSize: 24, fontWeight: 900, letterSpacing: 6, color: "#2c5f2d", margin: 0 }}>봉 사 활 동 증 명 서</p>
                        <p style={{ fontSize: 11, color: "#999", marginTop: 4 }}>Certificate of Volunteer Service</p>
                      </div>
                      <p style={{ fontSize: 11, color: "#999", textAlign: "right", marginBottom: 12 }}>발급번호: {reprintData.certNumber}</p>
                      <div style={{ lineHeight: 2.2, fontSize: 14 }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                          <tbody>
                            <tr>
                              <td style={{ border: "1px solid #ccc", padding: "8px 12px", background: "#f0f7f0", fontWeight: 700, color: "#2c5f2d", width: "25%", textAlign: "center" }}>성 명</td>
                              <td style={{ border: "1px solid #ccc", padding: "8px 12px", fontSize: 15, fontWeight: 700 }}>{reprintData.realName}</td>
                            </tr>
                            {reprintData.volunteerNo && (
                              <tr>
                                <td style={{ border: "1px solid #ccc", padding: "8px 12px", background: "#f0f7f0", fontWeight: 700, color: "#2c5f2d", textAlign: "center" }}>1365 회원번호</td>
                                <td style={{ border: "1px solid #ccc", padding: "8px 12px", fontSize: 13, fontWeight: 600, color: "#1d4ed8" }}>{reprintData.volunteerNo}</td>
                              </tr>
                            )}
                            <tr>
                              <td style={{ border: "1px solid #ccc", padding: "8px 12px", background: "#f0f7f0", fontWeight: 700, color: "#2c5f2d", textAlign: "center" }}>아이디</td>
                              <td style={{ border: "1px solid #ccc", padding: "8px 12px", fontSize: 13, color: "#555" }}>{reprintData.nickname ? `${reprintData.nickname} / ` : ""}{reprintData.email}</td>
                            </tr>
                            <tr>
                              <td style={{ border: "1px solid #ccc", padding: "8px 12px", background: "#f0f7f0", fontWeight: 700, color: "#2c5f2d", textAlign: "center" }}>봉사 단체</td>
                              <td style={{ border: "1px solid #ccc", padding: "8px 12px" }}>사단법인 국제청년환경연합회</td>
                            </tr>
                            <tr>
                              <td style={{ border: "1px solid #ccc", padding: "8px 12px", background: "#f0f7f0", fontWeight: 700, color: "#2c5f2d", textAlign: "center" }}>봉사 분류</td>
                              <td style={{ border: "1px solid #ccc", padding: "8px 12px" }}>환경보호 &gt; 환경정화활동</td>
                            </tr>
                            <tr>
                              <td style={{ border: "1px solid #ccc", padding: "8px 12px", background: "#f0f7f0", fontWeight: 700, color: "#2c5f2d", textAlign: "center" }}>활동 기간</td>
                              <td style={{ border: "1px solid #ccc", padding: "8px 12px" }}>{reprintData.periodStr}</td>
                            </tr>
                            <tr>
                              <td style={{ border: "1px solid #ccc", padding: "8px 12px", background: "#f0f7f0", fontWeight: 700, color: "#2c5f2d", textAlign: "center" }}>활동 내용</td>
                              <td style={{ border: "1px solid #ccc", padding: "8px 12px" }}>환경정화 봉사활동 (플로깅)</td>
                            </tr>
                            <tr>
                              <td style={{ border: "1px solid #ccc", padding: "8px 12px", background: "#f0f7f0", fontWeight: 700, color: "#2c5f2d", textAlign: "center" }}>활동 횟수</td>
                              <td style={{ border: "1px solid #ccc", padding: "8px 12px" }}>{reprintData.totalSessions}회</td>
                            </tr>
                            <tr>
                              <td style={{ border: "1px solid #ccc", padding: "8px 12px", background: "#f0f7f0", fontWeight: 700, color: "#2c5f2d", textAlign: "center" }}>봉사 시간</td>
                              <td style={{ border: "1px solid #ccc", padding: "8px 12px", fontWeight: 700, fontSize: 15 }}>
                                {formatHoursMinutes(reprintData.totalHours)}
                                <span style={{ fontSize: 11, color: "#666", fontWeight: 400, marginLeft: 8 }}>
                                  (1365 인정: {Math.max(1, Math.round(reprintData.totalHours))}시간)
                                </span>
                              </td>
                            </tr>
                            <tr>
                              <td style={{ border: "1px solid #ccc", padding: "8px 12px", background: "#f0f7f0", fontWeight: 700, color: "#2c5f2d", textAlign: "center" }}>이동 거리</td>
                              <td style={{ border: "1px solid #ccc", padding: "8px 12px" }}>{reprintData.totalDistance} km</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <p style={{ textAlign: "center", fontSize: 14, lineHeight: 2, margin: "25px 0 10px" }}>
                        위 사람은 상기 기간 동안 환경정화 봉사활동(플로깅)에<br />
                        성실히 참여하였음을 증명합니다.
                      </p>
                      <p style={{ fontSize: 11, color: "#888", lineHeight: 1.6, margin: "15px 0" }}>
                        ※ 본 증명서는 사단법인 국제청년환경연합회에서 운영중인 '오백원의 행복' 플로깅 앱을 통해 수집된 데이터를 근거로 작성되었습니다.<br />
                        ※ 활동 기록은 GPS 기반으로 실시간 수집되며, 발급 기준 충족 시 자동 발급됩니다.<br />
                        ※ 성명은 본인 신고에 의하며, 허위 기재 시 효력이 인정되지 않습니다.<br />
                        ※ 발급번호를 통해 진위 여부를 확인할 수 있습니다.
                      </p>
                      <div style={{ position: "relative", marginTop: "auto", paddingTop: 8 }}>
                        <div style={{ textAlign: "center" }}>
                          <p style={{ fontSize: 14, color: "#333", marginBottom: 12 }}>{reprintData.dateStr}</p>
                          <p style={{ fontSize: 15, fontWeight: 700, color: "#2c5f2d", marginBottom: 2 }}>사단법인 국제청년환경연합회</p>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#333", marginBottom: 2 }}>회장 장희재</p>
                          <p style={{ fontSize: 12, color: "#666" }}>Global Youth Environmental Association</p>
                        </div>
                        <img
                          src="https://res.cloudinary.com/dqlvm572h/image/upload/w_200,q_auto,f_auto/sign_gyea_oydzt1.png"
                          alt="국제청년환경연합회 직인"
                          style={{ width: 100, height: "auto", position: "absolute", right: "12%", bottom: 0 }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <button onClick={() => handleDownload(reprintRef)}
              className="w-full text-white py-3.5 rounded-2xl text-sm font-bold shadow-sm flex items-center justify-center gap-2"
              style={{ backgroundColor: "#2c5f2d" }}>
              <Download className="w-5 h-5" /> PDF 다운로드 / 인쇄
            </button>
            <button onClick={() => setReprintData(null)}
              className="w-full bg-white text-gray-400 py-3 rounded-2xl text-sm font-medium shadow-sm">
              닫기
            </button>
          </>
        )}

        {/* ═══════════ 발급 내역 ═══════════ */}
        {issuedCerts.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h2 className="font-bold text-gray-700 text-sm mb-3 flex items-center gap-1.5">
              <History className="w-4 h-4 text-gray-500" /> 발급 내역 ({issuedCerts.length}건)
            </h2>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {issuedCerts.map((cert) => {
                const pStart = cert.periodStart?.toDate?.();
                const pEnd   = cert.periodEnd?.toDate?.();
                const issued = cert.issuedAt?.toDate?.();
                const periodStr = pStart && pEnd
                  ? `${pStart.toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" })} ~ ${pEnd.toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}`
                  : "";
                const issuedStr = issued
                  ? issued.toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" })
                  : "";

                return (
                  <div key={cert.id} className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono font-bold text-green-700">{cert.certNumber}</span>
                      <span className="text-[10px] text-gray-400">발급일: {issuedStr}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span>{cert.realName}</span>
                      <span className="text-gray-300">|</span>
                      <span>{periodStr}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-3 text-[11px] text-gray-500">
                        <span>{cert.totalSessions}회</span>
                        <span>{formatHoursMinutes(cert.totalHours)}</span>
                        <span>{cert.totalDistance}km</span>
                      </div>
                      <button
                        onClick={() => handleReprint(cert)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white shadow-sm"
                        style={{ backgroundColor: "#2c5f2d" }}
                      >
                        <Printer className="w-3 h-3" /> 재출력
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
