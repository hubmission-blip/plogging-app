"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection, query, where, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  doc, arrayUnion, arrayRemove, serverTimestamp, orderBy,
} from "firebase/firestore";

// ─── 관리자 이메일 ────────────────────────────────────────────
const ADMIN_EMAILS = ["hubmission@gmail.com", "boonma@nate.com"];

// ─── 17개 시도 (권역별 그룹) ──────────────────────────────────
const REGION_GROUPS = [
  { name: "수도권",  color: "bg-blue-500",   light: "bg-blue-50   border-blue-200   text-blue-700",   icon: "🏙️", regions: ["서울", "인천", "경기"] },
  { name: "충청권",  color: "bg-yellow-500", light: "bg-yellow-50 border-yellow-200 text-yellow-700", icon: "🌾", regions: ["대전", "세종", "충북", "충남"] },
  { name: "강원권",  color: "bg-cyan-500",   light: "bg-cyan-50   border-cyan-200   text-cyan-700",   icon: "⛰️", regions: ["강원"] },
  { name: "호남권",  color: "bg-green-500",  light: "bg-green-50  border-green-200  text-green-700",  icon: "🌊", regions: ["광주", "전북", "전남"] },
  { name: "영남권",  color: "bg-red-500",    light: "bg-red-50    border-red-200    text-red-700",    icon: "🏔️", regions: ["부산", "대구", "울산", "경북", "경남"] },
  { name: "제주권",  color: "bg-orange-500", light: "bg-orange-50 border-orange-200 text-orange-700", icon: "🍊", regions: ["제주"] },
];

// 평탄화된 전체 지역 목록 (기존 코드 호환용)
const REGIONS = REGION_GROUPS.flatMap((g) => g.regions);

// 지역 → 권역 색상 매핑
const REGION_COLOR_MAP = {};
REGION_GROUPS.forEach((g) => g.regions.forEach((r) => { REGION_COLOR_MAP[r] = g; }));

// ─── 이벤트 유형 ──────────────────────────────────────────────
const EVENT_TYPE = {
  group:      { label: "그룹 플로깅", color: "bg-blue-500",   dot: "bg-blue-500",   badge: "bg-blue-100 text-blue-700" },
  individual: { label: "개인 플로깅", color: "bg-green-500",  dot: "bg-green-500",  badge: "bg-green-100 text-green-700" },
};

// ─── 요일 헤더 ────────────────────────────────────────────────
const DOW = ["일", "월", "화", "수", "목", "금", "토"];

// ─── 날짜 유틸 ────────────────────────────────────────────────
// toISOString()은 UTC 기준이라 한국(UTC+9)에서 하루 밀림 → 로컬 날짜 사용
function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}

// ─── 지역 선택 바텀시트 ───────────────────────────────────────
function RegionSheet({ current, onSelect, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-[200] flex items-end" onClick={onClose}>
      <div
        className="w-full bg-white rounded-t-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 핸들 */}
        <div className="pt-3 pb-2 flex justify-center">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pb-3 border-b border-gray-100">
          <p className="font-black text-gray-800 text-base flex items-center gap-1"><MapPin className="w-4 h-4" strokeWidth={1.8} /> 지역 선택</p>
          <button onClick={onClose} className="text-gray-400 text-sm px-2 py-1">닫기</button>
        </div>

        {/* 권역별 그룹 */}
        <div className="px-4 py-4 space-y-4 max-h-[70vh] overflow-y-auto pb-8">
          {REGION_GROUPS.map((group) => (
            <div key={group.name}>
              {/* 권역 헤더 */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">{group.icon}</span>
                <span className={`text-xs font-black px-2 py-0.5 rounded-full text-white ${group.color}`}>
                  {group.name}
                </span>
              </div>
              {/* 지역 버튼 그리드 */}
              <div className="grid grid-cols-4 gap-2">
                {group.regions.map((region) => {
                  const isSelected = current === region;
                  return (
                    <button
                      key={region}
                      onClick={() => { onSelect(region); onClose(); }}
                      className={`py-3 rounded-2xl text-sm font-bold border transition-all active:scale-95
                        ${isSelected
                          ? `${group.color} text-white border-transparent shadow-md`
                          : `${group.light} border`}`}
                    >
                      {region}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── 이벤트 상세 모달 ─────────────────────────────────────────
function EventModal({ event, user, onClose, onJoin, onLeave, onEdit, onDelete, firestoreEmail }) {
  const isJoined    = event.participants?.includes(user?.uid);
  const isFull      = event.maxParticipants > 0 &&
                      (event.participants?.length || 0) >= event.maxParticipants;
  const isPast      = new Date(event.date) < new Date(new Date().toDateString());
  const isHost      = event.hostUid === user?.uid;
  const isAdmin     = user && (ADMIN_EMAILS.includes(user.email) || ADMIN_EMAILS.includes(firestoreEmail));
  const canManage   = isHost || isAdmin;
  const typeStyle   = EVENT_TYPE[event.type] || EVENT_TYPE.group;

  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-end" onClick={onClose}>
      <div
        className="w-full bg-white rounded-t-3xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 핸들 */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

        {/* 유형 뱃지 */}
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${typeStyle.badge}`}>
            {typeStyle.label}
          </span>
          {isPast ? (
            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-gray-100 text-gray-500">완료</span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-orange-100 text-orange-600">예정</span>
          )}
          {isHost && (
            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-purple-100 text-purple-600">내가 주최</span>
          )}
        </div>

        {/* 제목 */}
        <h2 className="text-lg font-black text-gray-800 mb-1">{event.title}</h2>

        {/* 날짜·지역·장소 */}
        <div className="space-y-1.5 mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>📅</span>
            <span>{event.date}</span>
            {event.time && <span className="text-gray-400">· {event.time}</span>}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>📍</span>
            <span>{event.region}</span>
            {event.location && <span className="text-gray-400">· {event.location}</span>}
          </div>
          {event.type === "group" && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>👥</span>
              <span>
                {event.participants?.length || 0}명 참여 중
                {event.maxParticipants > 0 && ` / 최대 ${event.maxParticipants}명`}
              </span>
            </div>
          )}
          {event.hostName && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>🙋</span>
              <span>주최자 : {event.hostName}</span>
            </div>
          )}
        </div>

        {/* 설명 */}
        {event.description && (
          <div className="bg-gray-50 rounded-2xl p-3 mb-4">
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
              {event.description}
            </p>
          </div>
        )}

        {/* 참가자 목록 */}
        {event.type === "group" && event.participantNames?.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-bold text-gray-500 mb-2">참가자</p>
            <div className="flex flex-wrap gap-1.5">
              {event.participantNames.map((name, i) => (
                <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 액션 버튼 (미래 이벤트만) */}
        {!isPast && !isHost && user && (
          <div className="mt-2">
            {isJoined ? (
              <button
                onClick={() => onLeave(event)}
                className="w-full py-3.5 rounded-2xl font-bold text-sm bg-gray-100 text-gray-600"
              >
                참여 취소
              </button>
            ) : isFull ? (
              <button disabled className="w-full py-3.5 rounded-2xl font-bold text-sm bg-gray-100 text-gray-400">
                정원 마감
              </button>
            ) : (
              <button
                onClick={() => onJoin(event)}
                className="w-full py-3.5 rounded-2xl font-bold text-sm bg-green-500 text-white shadow active:scale-95 transition-transform"
              >
                🌿 참여하기
              </button>
            )}
          </div>
        )}

        {!user && !isPast && (
          <p className="text-center text-sm text-gray-400 mt-2">로그인 후 참여할 수 있습니다</p>
        )}

        {/* 수정/삭제 버튼 (관리자 또는 주최자만) */}
        {canManage && (
          <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
            <button
              onClick={() => onEdit(event)}
              className="flex-1 py-2.5 rounded-2xl text-sm font-bold bg-blue-50 text-blue-600 active:scale-95 transition-transform"
            >
              ✏️ 수정
            </button>
            <button
              onClick={() => onDelete(event)}
              className="flex-1 py-2.5 rounded-2xl text-sm font-bold bg-red-50 text-red-500 active:scale-95 transition-transform"
            >
              🗑 삭제
            </button>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full mt-3 py-2.5 rounded-2xl text-sm text-gray-400 border border-gray-100"
        >
          닫기
        </button>
      </div>
    </div>
  );
}

// ─── 이벤트 등록 / 수정 모달 ────────────────────────────────────
// editEvent가 있으면 수정 모드, 없으면 등록 모드
function CreateEventModal({ user, selectedDate, defaultRegion, onClose, onCreate, editEvent, onSave }) {
  const isEditMode = !!editEvent;
  const [form, setForm] = useState(
    isEditMode
      ? {
          title:           editEvent.title           || "",
          description:     editEvent.description     || "",
          type:            editEvent.type            || "group",
          region:          editEvent.region          || defaultRegion || "서울",
          date:            editEvent.date            || toDateStr(new Date()),
          time:            editEvent.time            || "",
          location:        editEvent.location        || "",
          maxParticipants: editEvent.maxParticipants || 10,
        }
      : {
          title: "",
          description: "",
          type: "group",
          region: defaultRegion || "서울",
          date: selectedDate || toDateStr(new Date()),
          time: "",
          location: "",
          maxParticipants: 10,
        }
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.title.trim()) { alert("제목을 입력하세요"); return; }
    setSubmitting(true);
    try {
      if (isEditMode) {
        await onSave(editEvent.id, form);
      } else {
        await onCreate(form);
      }
      onClose();
    } catch (e) {
      alert((isEditMode ? "수정" : "등록") + " 실패: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[300] flex items-end" onClick={onClose}>
      <div
        className="w-full bg-white rounded-t-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
        <h2 className="text-base font-black text-gray-800 mb-4">
          {isEditMode ? "✏️ 플로깅 일정 수정" : "📅 플로깅 일정 등록"}
        </h2>

        <div className="space-y-3">
          {/* 유형 */}
          <div className="flex gap-2">
            {Object.entries(EVENT_TYPE).map(([key, val]) => (
              <button
                key={key}
                onClick={() => setForm((f) => ({ ...f, type: key }))}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors
                  ${form.type === key ? val.color + " text-white" : "bg-gray-100 text-gray-500"}`}
              >
                {val.label}
              </button>
            ))}
          </div>

          {/* 제목 */}
          <input
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400"
            placeholder="일정 제목 *"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />

          {/* 날짜 + 시간 */}
          <div className="flex gap-2">
            <input
              type="date"
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
            <input
              type="time"
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400"
              value={form.time}
              onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
            />
          </div>

          {/* 지역 */}
          <select
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400"
            value={form.region}
            onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
          >
            {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>

          {/* 장소 */}
          <input
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400"
            placeholder="집결 장소 (예: 한강공원 반포 지구)"
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
          />

          {/* 최대 인원 (그룹만) */}
          {form.type === "group" && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500 flex-shrink-0">최대 인원</span>
              <input
                type="number"
                min={2}
                max={200}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400"
                value={form.maxParticipants}
                onChange={(e) => setForm((f) => ({ ...f, maxParticipants: Number(e.target.value) }))}
              />
              <span className="text-sm text-gray-400">명</span>
            </div>
          )}

          {/* 설명 */}
          <textarea
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400 resize-none"
            rows={3}
            placeholder="일정 설명 (선택 사항)"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl text-sm text-gray-400 border border-gray-100"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-2 flex-grow-[2] py-3 rounded-2xl text-sm font-bold bg-green-500 text-white disabled:opacity-50"
          >
            {submitting
              ? (isEditMode ? "저장 중..." : "등록 중...")
              : (isEditMode ? "💾 저장하기" : "✅ 등록하기")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 캘린더 페이지 ───────────────────────────────────────
export default function CalendarPage() {
  const { user } = useAuth();

  const today        = new Date();
  const [viewYear,   setViewYear]   = useState(today.getFullYear());
  const [viewMonth,  setViewMonth]  = useState(today.getMonth()); // 0-based
  const [selectedRegion, setSelectedRegion] = useState("서울");
  const [events,     setEvents]     = useState([]); // 해당 월 이벤트
  const [selectedDate, setSelectedDate] = useState(null); // "YYYY-MM-DD"
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showCreate,  setShowCreate]  = useState(false);
  const [editingEvent, setEditingEvent]   = useState(null); // 수정 중인 이벤트
  const [showRegionSheet, setShowRegionSheet] = useState(false); // 지역 선택 시트
  const [loading,    setLoading]    = useState(false);
  const [msg,        setMsg]        = useState("");

  const [firestoreEmail, setFirestoreEmail] = useState("");
  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.uid)).then(snap => {
      if (snap.exists()) setFirestoreEmail(snap.data().email || "");
    }).catch(() => {});
  }, [user]);
  const isAdmin = user && (ADMIN_EMAILS.includes(user.email) || ADMIN_EMAILS.includes(firestoreEmail));

  // 메시지 표시
  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(""), 2500); };

  // ── 해당 월 이벤트 로드 ────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const monthStart = new Date(viewYear, viewMonth, 1);
      const monthEnd   = new Date(viewYear, viewMonth + 1, 0, 23, 59, 59);
      const startStr   = toDateStr(monthStart);
      const endStr     = toDateStr(monthEnd);

      const q = query(
        collection(db, "events"),
        where("region", "==", selectedRegion),
        where("date", ">=", startStr),
        where("date", "<=", endStr),
        orderBy("date", "asc")
      );
      const snap = await getDocs(q);
      setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.warn("이벤트 로드 실패:", e.message);
    } finally {
      setLoading(false);
    }
  }, [viewYear, viewMonth, selectedRegion]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // ── 캘린더 날짜 계산 ───────────────────────────────────────
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay(); // 0=일
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const totalCells  = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  // 날짜별 이벤트 맵
  const eventsByDate = {};
  events.forEach((ev) => {
    if (!eventsByDate[ev.date]) eventsByDate[ev.date] = [];
    eventsByDate[ev.date].push(ev);
  });

  // 선택된 날짜의 이벤트
  const dayEvents = selectedDate ? (eventsByDate[selectedDate] || []) : [];

  // ── 이벤트 참여 ────────────────────────────────────────────
  const handleJoin = async (event) => {
    if (!user) { showMsg("로그인이 필요합니다"); return; }
    try {
      const ref = doc(db, "events", event.id);
      const displayName = user.displayName || user.email?.split("@")[0] || "익명";
      await updateDoc(ref, {
        participants:     arrayUnion(user.uid),
        participantNames: arrayUnion(displayName),
      });
      // 로컬 상태 갱신
      setEvents((prev) => prev.map((ev) => ev.id === event.id ? {
        ...ev,
        participants:     [...(ev.participants || []), user.uid],
        participantNames: [...(ev.participantNames || []), displayName],
      } : ev));
      setSelectedEvent((prev) => prev && prev.id === event.id ? {
        ...prev,
        participants:     [...(prev.participants || []), user.uid],
        participantNames: [...(prev.participantNames || []), displayName],
      } : prev);
      showMsg("✅ 참여 신청 완료!");
    } catch (e) { showMsg("❌ 참여 실패: " + e.message); }
  };

  // ── 이벤트 취소 ────────────────────────────────────────────
  const handleLeave = async (event) => {
    if (!user) return;
    if (!confirm("참여를 취소할까요?")) return;
    try {
      const ref = doc(db, "events", event.id);
      const displayName = user.displayName || user.email?.split("@")[0] || "익명";
      await updateDoc(ref, {
        participants:     arrayRemove(user.uid),
        participantNames: arrayRemove(displayName),
      });
      setEvents((prev) => prev.map((ev) => ev.id === event.id ? {
        ...ev,
        participants:     (ev.participants || []).filter((id) => id !== user.uid),
        participantNames: (ev.participantNames || []).filter((n) => n !== displayName),
      } : ev));
      setSelectedEvent((prev) => prev && prev.id === event.id ? {
        ...prev,
        participants:     (prev.participants || []).filter((id) => id !== user.uid),
        participantNames: (prev.participantNames || []).filter((n) => n !== displayName),
      } : prev);
      showMsg("참여가 취소되었습니다");
    } catch (e) { showMsg("❌ 취소 실패: " + e.message); }
  };

  // ── 이벤트 생성 ────────────────────────────────────────────
  const handleCreate = async (form) => {
    const displayName = user.displayName || user.email?.split("@")[0] || "익명";
    await addDoc(collection(db, "events"), {
      ...form,
      hostUid:          user.uid,
      hostName:         displayName,
      participants:     [user.uid],
      participantNames: [displayName],
      createdAt:        serverTimestamp(),
    });
    showMsg("✅ 일정이 등록되었습니다!");
    fetchEvents();
  };

  // ── 이벤트 수정 ────────────────────────────────────────────
  const handleSaveEdit = async (eventId, form) => {
    await updateDoc(doc(db, "events", eventId), {
      ...form,
      updatedAt: serverTimestamp(),
    });
    // 로컬 상태 갱신
    setEvents((prev) => prev.map((ev) => ev.id === eventId ? { ...ev, ...form } : ev));
    setSelectedEvent(null);
    setEditingEvent(null);
    showMsg("✅ 일정이 수정되었습니다!");
  };

  // ── 이벤트 삭제 ────────────────────────────────────────────
  const handleDelete = async (event) => {
    const confirmMsg = event.participants?.length > 1
      ? `참여자 ${event.participants.length}명이 있는 일정입니다.\n정말 삭제할까요?`
      : "이 일정을 삭제할까요?";
    if (!confirm(confirmMsg)) return;
    try {
      await deleteDoc(doc(db, "events", event.id));
      setEvents((prev) => prev.filter((ev) => ev.id !== event.id));
      setSelectedEvent(null);
      showMsg("🗑 일정이 삭제되었습니다");
    } catch (e) { showMsg("❌ 삭제 실패: " + e.message); }
  };

  // ── 수정 모달 열기 ─────────────────────────────────────────
  const handleOpenEdit = (event) => {
    setSelectedEvent(null);      // 상세 모달 닫기
    setEditingEvent(event);      // 수정 모달 열기
  };

  // ── 월 이동 ────────────────────────────────────────────────
  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
    setSelectedDate(null);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
    setSelectedDate(null);
  };

  return (
    <div
      className="min-h-screen bg-gray-50"
      style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom, 20px))" }}
    >
      {/* ── 헤더 ── */}
      <div className="bg-gray-50 px-4 pt-4 pb-1 flex justify-between items-center">
        {/* 로고 — 클릭 시 홈 */}
        <Link href="/">
          <img
            src="https://res.cloudinary.com/dqlvm572h/image/upload/w_200,q_auto,f_auto/Intro_Logo_fuj1kt.png"
            alt="오백원의 행복"
            className="h-9 w-auto object-contain"
          />
        </Link>
        {/* 페이지 타이틀 */}
        <p className="text-sm font-black text-gray-700 flex items-center gap-1"><CalendarDays className="w-4 h-4" strokeWidth={1.8} /> 플로깅 캘린더</p>
      </div>

      {/* ── 지역 선택 바 ── */}
      <div className="px-4 pt-3 pb-1">
        <button
          onClick={() => setShowRegionSheet(true)}
          className="w-full rounded-2xl px-4 py-3 flex items-center justify-between text-white shadow-sm active:opacity-90 transition-opacity"
          style={{ backgroundImage: "linear-gradient(to right, #8dc63f, #4cb748)" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">{REGION_COLOR_MAP[selectedRegion]?.icon || "📍"}</span>
            <div className="text-left">
              <p className="text-[10px] text-green-100 leading-none mb-0.5">선택된 지역</p>
              <p className="text-sm font-black text-white">{selectedRegion}</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-white/25 text-white ml-1">
              {REGION_COLOR_MAP[selectedRegion]?.name}
            </span>
          </div>
          <div className="flex items-center gap-1 text-white/80">
            <span className="text-xs">지역 변경</span>
            <span className="text-base">›</span>
          </div>
        </button>
      </div>

      {/* ── 메시지 ── */}
      {msg && (
        <div className="mx-4 mt-3 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
          <p className="text-sm text-green-700 font-medium">{msg}</p>
        </div>
      )}

      <div className="px-4 pt-4 space-y-4">

        {/* ── 캘린더 헤더 ── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {/* 월 네비 */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center text-gray-500 text-lg">
              ‹
            </button>
            <p className="font-black text-gray-800">
              {viewYear}년 {viewMonth + 1}월
              <span className="ml-2 text-xs font-medium text-green-600">
                {selectedRegion}
              </span>
            </p>
            <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center text-gray-500 text-lg">
              ›
            </button>
          </div>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 bg-gray-50">
            {DOW.map((d, i) => (
              <div
                key={d}
                className={`text-center py-2 text-xs font-bold
                  ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-400"}`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* 날짜 셀 */}
          <div className="grid grid-cols-7">
            {Array.from({ length: totalCells }).map((_, idx) => {
              const dayNum = idx - firstDay + 1;
              const isValid   = dayNum >= 1 && dayNum <= daysInMonth;
              const dateObj   = isValid ? new Date(viewYear, viewMonth, dayNum) : null;
              const dateStr   = dateObj ? toDateStr(dateObj) : null;
              const isToday   = dateObj ? isSameDay(dateObj, today) : false;
              const isSelected = dateStr && dateStr === selectedDate;
              const dayEvs    = dateStr ? (eventsByDate[dateStr] || []) : [];
              const dow       = idx % 7;

              return (
                <button
                  key={idx}
                  disabled={!isValid}
                  onClick={() => isValid && setSelectedDate(isSelected ? null : dateStr)}
                  className={`min-h-[52px] p-1 flex flex-col items-center border-b border-r border-gray-50
                    transition-colors last:border-r-0
                    ${!isValid ? "bg-gray-50" : ""}
                    ${isSelected ? "bg-green-50" : ""}
                    ${isValid && !isSelected ? "active:bg-gray-50" : ""}`}
                >
                  {isValid && (
                    <>
                      <span
                        className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full
                          ${isToday ? "bg-green-500 text-white" : ""}
                          ${isSelected && !isToday ? "text-green-600" : ""}
                          ${!isToday && !isSelected && dow === 0 ? "text-red-400" : ""}
                          ${!isToday && !isSelected && dow === 6 ? "text-blue-400" : ""}
                          ${!isToday && !isSelected && dow > 0 && dow < 6 ? "text-gray-700" : ""}`}
                      >
                        {dayNum}
                      </span>
                      {/* 이벤트 도트 */}
                      {dayEvs.length > 0 && (
                        <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                          {dayEvs.slice(0, 3).map((ev, i) => (
                            <span
                              key={i}
                              className={`w-1.5 h-1.5 rounded-full ${(EVENT_TYPE[ev.type] || EVENT_TYPE.group).dot}`}
                            />
                          ))}
                          {dayEvs.length > 3 && (
                            <span className="text-[9px] text-gray-400">+{dayEvs.length - 3}</span>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 범례 ── */}
        <div className="flex gap-4 px-1">
          {Object.entries(EVENT_TYPE).map(([key, val]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${val.dot}`} />
              <span className="text-xs text-gray-500">{val.label}</span>
            </div>
          ))}
        </div>

        {/* ── 선택된 날짜의 일정 ── */}
        {selectedDate && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-gray-700 text-sm">
                📋 {selectedDate.replace(/-/g, ".")} 일정
              </h2>
              {user && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="text-xs bg-green-500 text-white px-3 py-1.5 rounded-full font-bold"
                >
                  + 일정 등록
                </button>
              )}
            </div>

            {loading ? (
              <div className="text-center py-6 text-gray-400 text-sm animate-pulse">로딩 중...</div>
            ) : dayEvents.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
                <p className="text-3xl mb-2">🌿</p>
                <p className="text-sm text-gray-400">이 날엔 등록된 일정이 없어요</p>
                {user && (
                  <button
                    onClick={() => setShowCreate(true)}
                    className="mt-3 text-xs text-green-500 font-bold border border-green-200 px-4 py-1.5 rounded-full"
                  >
                    첫 번째 일정 만들기
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {dayEvents.map((ev) => {
                  const typeStyle = EVENT_TYPE[ev.type] || EVENT_TYPE.group;
                  const isPast    = ev.date < toDateStr(today);
                  const isJoined  = ev.participants?.includes(user?.uid);
                  return (
                    <button
                      key={ev.id}
                      onClick={() => setSelectedEvent(ev)}
                      className="w-full bg-white rounded-2xl p-4 shadow-sm text-left flex items-center gap-3 active:scale-[0.98] transition-transform"
                    >
                      <div className={`w-1 self-stretch rounded-full ${typeStyle.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${typeStyle.badge}`}>
                            {typeStyle.label}
                          </span>
                          {isPast && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-gray-100 text-gray-400">완료</span>
                          )}
                          {isJoined && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-orange-100 text-orange-600">참여 중</span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-gray-800 truncate">{ev.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {ev.time && `${ev.time} · `}{ev.location || ev.region}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {ev.type === "group" && (
                          <p className="text-xs text-gray-400">
                            👥 {ev.participants?.length || 0}
                            {ev.maxParticipants > 0 ? `/${ev.maxParticipants}` : ""}명
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── 이번 달 전체 일정 (날짜 미선택 시) ── */}
        {!selectedDate && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-gray-700 text-sm">
                🗓 {viewMonth + 1}월 {selectedRegion} 전체 일정
              </h2>
              {user && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="text-xs bg-green-500 text-white px-3 py-1.5 rounded-full font-bold"
                >
                  + 일정 등록
                </button>
              )}
            </div>

            {loading ? (
              <div className="text-center py-6 text-gray-400 text-sm animate-pulse">로딩 중...</div>
            ) : events.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
                <p className="text-3xl mb-2">🌿</p>
                <p className="text-sm text-gray-400">{viewMonth + 1}월 {selectedRegion} 일정이 없어요</p>
                <p className="text-xs text-gray-300 mt-1">날짜를 클릭해서 일정을 등록해보세요!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {events.map((ev) => {
                  const typeStyle = EVENT_TYPE[ev.type] || EVENT_TYPE.group;
                  const isPast    = ev.date < toDateStr(today);
                  const isJoined  = ev.participants?.includes(user?.uid);
                  return (
                    <button
                      key={ev.id}
                      onClick={() => setSelectedEvent(ev)}
                      className="w-full bg-white rounded-2xl p-4 shadow-sm text-left flex items-center gap-3 active:scale-[0.98] transition-transform"
                    >
                      <div className={`w-1 self-stretch rounded-full ${typeStyle.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] text-gray-400 font-bold">{ev.date.slice(5).replace("-", ".")}</span>
                          {ev.time && <span className="text-[10px] text-gray-400">{ev.time}</span>}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${typeStyle.badge}`}>
                            {typeStyle.label}
                          </span>
                          {isJoined && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-orange-100 text-orange-600">참여 중</span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-gray-800 truncate">{ev.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{ev.location || ev.region}</p>
                      </div>
                      {ev.type === "group" && (
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-gray-400">
                            👥 {ev.participants?.length || 0}
                            {ev.maxParticipants > 0 ? `/${ev.maxParticipants}` : ""}명
                          </p>
                          {!isPast && !isJoined && (
                            <p className="text-[10px] text-green-500 font-bold mt-0.5">참여 가능</p>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 이벤트 상세 모달 ── */}
      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          user={user}
          firestoreEmail={firestoreEmail}
          onClose={() => setSelectedEvent(null)}
          onJoin={handleJoin}
          onLeave={handleLeave}
          onEdit={handleOpenEdit}
          onDelete={handleDelete}
        />
      )}

      {/* ── 일정 등록 모달 ── */}
      {showCreate && (
        <CreateEventModal
          user={user}
          selectedDate={selectedDate}
          defaultRegion={selectedRegion}
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}

      {/* ── 일정 수정 모달 ── */}
      {editingEvent && (
        <CreateEventModal
          user={user}
          defaultRegion={selectedRegion}
          editEvent={editingEvent}
          onClose={() => setEditingEvent(null)}
          onCreate={handleCreate}
          onSave={handleSaveEdit}
        />
      )}

      {/* ── 지역 선택 바텀시트 ── */}
      {showRegionSheet && (
        <RegionSheet
          current={selectedRegion}
          onSelect={(region) => { setSelectedRegion(region); setSelectedDate(null); }}
          onClose={() => setShowRegionSheet(false)}
        />
      )}
    </div>
  );
}
