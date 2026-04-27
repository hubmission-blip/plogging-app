"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  doc, getDoc, collection, query, where, getDocs,
  runTransaction, addDoc, serverTimestamp, orderBy, limit,
} from "firebase/firestore";
import {
  Gift, Search, ArrowLeft, Coins, Send, CheckCircle,
  User, Clock, ArrowRightLeft,
} from "lucide-react";

// ─── 상수 ───────────────────────────────────────────────────
const MIN_GIFT = 10;
const MAX_GIFT = 1000;

export default function GiftPage() {
  const { user } = useAuth();
  const router   = useRouter();

  // 내 정보
  const [myPoints, setMyPoints]   = useState(0);
  const [myName, setMyName]       = useState("");
  const [loading, setLoading]     = useState(true);

  // 검색
  const [searchText, setSearchText]     = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]       = useState(false);

  // 선물 대상
  const [recipient, setRecipient] = useState(null); // { uid, displayName, photoURL }

  // 금액 입력
  const [amount, setAmount]     = useState("");
  const [message, setMessage]   = useState("");

  // 전송 상태
  const [sending, setSending]     = useState(false);
  const [success, setSuccess]     = useState(false);
  const [error, setError]         = useState("");

  // 선물 이력
  const [history, setHistory]     = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // ── 내 포인트 로드 ──────────────────────────────────────────
  const fetchMyData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const d = snap.data();
        setMyPoints(d.totalPoints || 0);
        setMyName(d.displayName || d.name || user.displayName || "");
      }
    } catch (e) {
      console.error("데이터 로드 실패:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    fetchMyData();
  }, [user, fetchMyData, router]);

  // ── 선물 이력 로드 ──────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    if (!user) return;
    try {
      // 보낸 내역
      const sentQ = query(
        collection(db, "giftHistory"),
        where("fromUid", "==", user.uid),
        orderBy("createdAt", "desc"),
        limit(20)
      );
      const sentSnap = await getDocs(sentQ);
      const sent = sentSnap.docs.map((d) => ({ id: d.id, ...d.data(), direction: "sent" }));

      // 받은 내역
      const recvQ = query(
        collection(db, "giftHistory"),
        where("toUid", "==", user.uid),
        orderBy("createdAt", "desc"),
        limit(20)
      );
      const recvSnap = await getDocs(recvQ);
      const recv = recvSnap.docs.map((d) => ({ id: d.id, ...d.data(), direction: "received" }));

      // 합치고 시간순 정렬
      const all = [...sent, ...recv].sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() || 0;
        const tb = b.createdAt?.toMillis?.() || 0;
        return tb - ta;
      });
      setHistory(all);
    } catch (e) {
      console.error("이력 로드 실패:", e);
    }
  }, [user]);

  // ── 사용자 검색 ─────────────────────────────────────────────
  const handleSearch = async () => {
    const keyword = searchText.trim();
    if (!keyword || keyword.length < 1) return;
    setSearching(true);
    setSearchResults([]);
    try {
      // displayName으로 검색 (prefix 매칭)
      const q1 = query(
        collection(db, "users"),
        where("displayName", ">=", keyword),
        where("displayName", "<=", keyword + ""),
        limit(10)
      );
      const snap1 = await getDocs(q1);

      // realName으로도 검색
      const q2 = query(
        collection(db, "users"),
        where("realName", ">=", keyword),
        where("realName", "<=", keyword + ""),
        limit(10)
      );
      const snap2 = await getDocs(q2);

      const map = new Map();
      [...snap1.docs, ...snap2.docs].forEach((d) => {
        if (d.id !== user.uid) { // 자기 자신 제외
          map.set(d.id, { uid: d.id, ...d.data() });
        }
      });
      setSearchResults(Array.from(map.values()));
    } catch (e) {
      console.error("검색 실패:", e);
    } finally {
      setSearching(false);
    }
  };

  // ── 포인트 선물 실행 ────────────────────────────────────────
  const handleGift = async () => {
    setError("");
    const pts = parseInt(amount, 10);

    // 유효성 검사
    if (!recipient) { setError("선물 받을 사람을 선택해주세요."); return; }
    if (recipient.uid === user.uid) { setError("자기 자신에게는 선물할 수 없어요."); return; }
    if (!pts || isNaN(pts)) { setError("포인트를 입력해주세요."); return; }
    if (pts < MIN_GIFT) { setError(`최소 ${MIN_GIFT}P부터 선물할 수 있어요.`); return; }
    if (pts > MAX_GIFT) { setError(`1회 최대 ${MAX_GIFT}P까지 선물할 수 있어요.`); return; }
    if (pts > myPoints) { setError("보유 포인트가 부족합니다."); return; }

    setSending(true);
    try {
      await runTransaction(db, async (tx) => {
        const fromRef = doc(db, "users", user.uid);
        const toRef   = doc(db, "users", recipient.uid);

        const fromSnap = await tx.get(fromRef);
        const toSnap   = await tx.get(toRef);

        if (!toSnap.exists()) throw new Error("받는 사람을 찾을 수 없습니다");

        const fromPts = fromSnap.data()?.totalPoints || 0;
        if (fromPts < pts) throw new Error("포인트 부족");

        const toPts = toSnap.data()?.totalPoints || 0;

        tx.update(fromRef, { totalPoints: fromPts - pts });
        tx.update(toRef,   { totalPoints: toPts + pts });

        // 선물 이력도 트랜잭션 내에서 저장 (원자성 보장)
        const histRef = doc(collection(db, "giftHistory"));
        tx.set(histRef, {
          fromUid:  user.uid,
          fromName: myName,
          toUid:    recipient.uid,
          toName:   recipient.displayName || recipient.realName || "",
          points:   pts,
          message:  message.trim() || "",
          createdAt: serverTimestamp(),
        });
      });

      setMyPoints((prev) => prev - pts);
      setSuccess(true);
    } catch (e) {
      setError("선물 실패: " + e.message);
    } finally {
      setSending(false);
    }
  };

  // ── 초기화 ──────────────────────────────────────────────────
  const resetForm = () => {
    setRecipient(null);
    setAmount("");
    setMessage("");
    setSuccess(false);
    setError("");
    setSearchText("");
    setSearchResults([]);
    fetchMyData();
  };

  // ── 로딩 ────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <p className="animate-pulse text-lg flex items-center gap-2 text-gray-500">
        <Gift className="w-5 h-5 text-pink-500" strokeWidth={2} /> 로딩 중...
      </p>
    </div>
  );

  // ── 성공 화면 ───────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl p-8 shadow-lg text-center max-w-sm w-full">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-500" strokeWidth={2} />
          </div>
          <h2 className="text-xl font-black text-gray-800 mb-2">선물 완료!</h2>
          <p className="text-sm text-gray-500 mb-1">
            <span className="font-bold text-gray-700">{recipient?.displayName || recipient?.realName}</span>님에게
          </p>
          <p className="text-3xl font-black text-pink-500 mb-1">{parseInt(amount).toLocaleString()} P</p>
          {message && (
            <p className="text-sm text-gray-400 mt-2 italic">"{message}"</p>
          )}
          <div className="mt-6 space-y-2">
            <button
              onClick={resetForm}
              className="w-full bg-pink-500 text-white py-3 rounded-2xl font-bold"
            >
              한 번 더 선물하기
            </button>
            <button
              onClick={() => router.push("/reward")}
              className="w-full bg-gray-100 text-gray-600 py-3 rounded-2xl font-bold"
            >
              리워드 페이지로
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 메인 UI ─────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen bg-gray-50"
      style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom, 20px))" }}
    >
      {/* 헤더 */}
      <div className="bg-white px-4 pt-4 pb-3 flex items-center gap-3 border-b border-gray-100">
        <button onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5 text-gray-600" strokeWidth={2} />
        </button>
        <h1 className="font-black text-base text-gray-800 flex items-center gap-1.5">
          <Gift className="w-5 h-5 text-pink-500" strokeWidth={2} />
          포인트 선물하기
        </h1>
      </div>

      {/* 내 보유 포인트 */}
      <div className="px-4 pt-4">
        <div className="bg-gradient-to-r from-pink-500 to-rose-400 rounded-2xl px-4 py-3 text-white shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-pink-200" strokeWidth={2} />
              <div>
                <p className="text-[10px] text-pink-200 leading-none mb-0.5">내 보유 포인트</p>
                <p className="text-lg font-black">{myPoints.toLocaleString()} P</p>
              </div>
            </div>
            <div className="text-right text-[10px] text-pink-200">
              <p>1회 선물: {MIN_GIFT}~{MAX_GIFT}P</p>
            </div>
          </div>
        </div>
      </div>

      {/* STEP 1: 받는 사람 검색 */}
      <div className="px-4 mt-5">
        <p className="text-xs font-bold text-gray-500 mb-2">1. 받는 사람 검색</p>

        {recipient ? (
          <div className="bg-pink-50 border border-pink-200 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {recipient.photoURL ? (
                <img src={recipient.photoURL} className="w-10 h-10 rounded-full object-cover" alt="" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-pink-200 flex items-center justify-center">
                  <User className="w-5 h-5 text-pink-500" strokeWidth={2} />
                </div>
              )}
              <div>
                <p className="font-bold text-gray-800 text-sm">{recipient.displayName || recipient.realName || "사용자"}</p>
                {recipient.realName && recipient.displayName && (
                  <p className="text-[10px] text-gray-400">{recipient.realName}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => { setRecipient(null); setSearchText(""); setSearchResults([]); }}
              className="text-xs text-pink-500 font-bold px-3 py-1 rounded-full bg-white border border-pink-200"
            >
              변경
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={2} />
                <input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="닉네임 또는 이름으로 검색"
                  className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-pink-400"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={searching}
                className="bg-pink-500 text-white px-4 rounded-xl font-bold text-sm flex-shrink-0"
              >
                {searching ? "..." : "검색"}
              </button>
            </div>

            {/* 검색 결과 */}
            {searchResults.length > 0 && (
              <div className="mt-2 bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 max-h-48 overflow-y-auto">
                {searchResults.map((u) => (
                  <button
                    key={u.uid}
                    onClick={() => { setRecipient(u); setSearchResults([]); }}
                    className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                  >
                    {u.photoURL ? (
                      <img src={u.photoURL} className="w-8 h-8 rounded-full object-cover" alt="" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                        <User className="w-4 h-4 text-gray-400" strokeWidth={2} />
                      </div>
                    )}
                    <div className="text-left">
                      <p className="text-sm font-bold text-gray-700">{u.displayName || "사용자"}</p>
                      {u.realName && <p className="text-[10px] text-gray-400">{u.realName}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {searchResults.length === 0 && searchText && !searching && (
              <p className="text-xs text-gray-400 mt-2 text-center">검색 결과가 없습니다</p>
            )}
          </>
        )}
      </div>

      {/* STEP 2: 포인트 입력 */}
      <div className="px-4 mt-5">
        <p className="text-xs font-bold text-gray-500 mb-2">2. 선물할 포인트</p>
        <div className="relative">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
            placeholder={`${MIN_GIFT} ~ ${MAX_GIFT}`}
            maxLength={4}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-pink-400 text-right pr-10"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">P</span>
        </div>
        {/* 빠른 선택 버튼 */}
        <div className="flex gap-2 mt-2">
          {[50, 100, 300, 500, 1000].map((v) => (
            <button
              key={v}
              onClick={() => setAmount(String(v))}
              disabled={myPoints < v}
              className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors
                ${amount === String(v)
                  ? "bg-pink-500 text-white border-pink-500"
                  : myPoints < v
                    ? "bg-gray-50 text-gray-300 border-gray-100"
                    : "bg-white text-gray-600 border-gray-200 active:bg-pink-50"
                }`}
            >
              {v}P
            </button>
          ))}
        </div>
      </div>

      {/* STEP 3: 메시지 (선택) */}
      <div className="px-4 mt-5">
        <p className="text-xs font-bold text-gray-500 mb-2">3. 메시지 <span className="text-gray-300 font-normal">선택</span></p>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="응원의 한마디 (선택사항)"
          maxLength={50}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-pink-400"
        />
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mx-4 mt-3 bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-red-600 text-xs font-medium">{error}</p>
        </div>
      )}

      {/* 선물하기 버튼 */}
      <div className="px-4 mt-6">
        <button
          onClick={handleGift}
          disabled={sending || !recipient || !amount}
          className={`w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 transition-colors
            ${recipient && amount
              ? "bg-pink-500 text-white active:bg-pink-600"
              : "bg-gray-200 text-gray-400"
            }`}
        >
          {sending ? (
            <span className="animate-pulse">선물 보내는 중...</span>
          ) : (
            <>
              <Send className="w-5 h-5" strokeWidth={2} />
              포인트 선물하기
            </>
          )}
        </button>
      </div>

      {/* 선물 이력 보기 */}
      <div className="px-4 mt-6">
        <button
          onClick={() => {
            if (!showHistory) fetchHistory();
            setShowHistory(!showHistory);
          }}
          className="w-full flex items-center justify-between py-3 px-4 bg-white rounded-2xl border border-gray-200"
        >
          <span className="text-sm font-bold text-gray-600 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-gray-400" strokeWidth={2} />
            선물 이력
          </span>
          <ArrowRightLeft className="w-4 h-4 text-gray-400" strokeWidth={2} />
        </button>

        {showHistory && (
          <div className="mt-2 bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 max-h-64 overflow-y-auto">
            {history.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">선물 이력이 없습니다</p>
            ) : (
              history.map((h) => (
                <div key={h.id} className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center
                      ${h.direction === "sent" ? "bg-rose-100" : "bg-blue-100"}`}>
                      {h.direction === "sent" ? (
                        <Send className="w-3.5 h-3.5 text-rose-500" strokeWidth={2} />
                      ) : (
                        <Gift className="w-3.5 h-3.5 text-blue-500" strokeWidth={2} />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-700">
                        {h.direction === "sent"
                          ? `→ ${h.toName || "사용자"}`
                          : `← ${h.fromName || "사용자"}`}
                      </p>
                      {h.message && <p className="text-[10px] text-gray-400 truncate max-w-[160px]">{h.message}</p>}
                      <p className="text-[10px] text-gray-300">
                        {h.createdAt?.toDate?.()?.toLocaleDateString("ko-KR") || ""}
                      </p>
                    </div>
                  </div>
                  <span className={`text-sm font-black ${h.direction === "sent" ? "text-rose-500" : "text-blue-500"}`}>
                    {h.direction === "sent" ? "-" : "+"}{h.points?.toLocaleString()}P
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
