"use client";

import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Leaf, Receipt, Coffee, CupSoda, Pipette, Package, Car, ShieldCheck, Recycle, Smartphone, Sprout, Bike, UtensilsCrossed, TreePine, Sun, RotateCcw, ShoppingBag, Container, ChevronDown, ChevronUp, Award } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, getDocs, limit, addDoc, doc, updateDoc, increment, serverTimestamp } from "firebase/firestore";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { TUMBLER_BONUS, CUP_RETURN_PER_CUP, REUSABLE_CONTAINER_BONUS, EV_RENTAL_BONUS, SHARED_BIKE_BONUS, E_RECEIPT_BONUS, FUTURE_GEN_BONUS, ZERO_WASTE_BONUS, ECO_BAG_BONUS, OWN_CONTAINER_BONUS, RECYCLED_PRODUCT_BONUS, ECO_PRODUCT_BONUS, QUALITY_RECYCLE_BONUS } from "@/lib/pointCalc";

// ─── 포인트 상수 (신규 4개) ────────────────────────────
const TREE_PLANTING_BONUS  = 50;
const SOLAR_PANEL_BONUS    = 50;
const PHONE_RETURN_BONUS   = 30;
const REFILL_STATION_BONUS = 30;

// ─── 녹색생활 실천 항목 목록 (탄소중립포인트 공식 순서) ──
const ECO_ACTIONS = [
  { id: "ereceipt",       Icon: Receipt,           title: "전자영수증 발급",        desc: "종이 영수증 대신 전자영수증을 받고 인증하세요",             points: "+20P" },
  { id: "tumbler",        Icon: Coffee,            title: "텀블러/다회용컵 이용",    desc: "카페에서 텀블러로 음료를 받고 인증하세요",                 points: "+30P" },
  { id: "cupreturn",      Icon: CupSoda,           title: "일회용컵 반환",           desc: "반환기에 일회용컵을 반환하고 인증하세요",                  points: "컵당 +10P" },
  { id: "refillstation",  Icon: Pipette,           title: "리필스테이션 이용",       desc: "세제·샴푸 등을 리필스테이션에서 리필하고 인증하세요",       points: "+30P" },
  { id: "container",      Icon: Package,           title: "다회용기 배달 이용",      desc: "배달 주문 시 다회용기를 선택하고 인증하세요",              points: "+30P" },
  { id: "evrental",       Icon: Car,               title: "무공해차 대여",           desc: "전기차·수소차를 대여하고 인증하세요",                     points: "+50P" },
  { id: "ecoproduct",     Icon: ShieldCheck,       title: "친환경제품 구매",         desc: "환경마크 인증 친환경제품을 구매하고 인증하세요",            points: "+30P" },
  { id: "qualityrecycle", Icon: Recycle,           title: "고품질 재활용품 배출",    desc: "깨끗하게 분리배출한 재활용품을 인증하세요",                points: "+20P" },
  { id: "phonereturn",    Icon: Smartphone,        title: "폐휴대폰 반납",           desc: "사용하지 않는 폐휴대폰을 반납하고 인증하세요",            points: "+30P" },
  { id: "futuregen",      Icon: Sprout,            title: "미래세대 실천행동",       desc: "환경 교육·캠페인 참여를 인증하세요",                      points: "+30P" },
  { id: "sharedbike",     Icon: Bike,              title: "공유자전거 이용",         desc: "공유자전거를 이용하고 인증하세요",                        points: "+30P" },
  { id: "zerowaste",      Icon: UtensilsCrossed,   title: "잔반제로 실천",           desc: "음식을 남기지 않고 깨끗이 비운 후 인증하세요",             points: "+20P" },
  { id: "treeplanting",   Icon: TreePine,          title: "나무심기 캠페인 참여",    desc: "나무심기 캠페인에 참여하고 인증하세요",                   points: "+50P" },
  { id: "solarpanel",     Icon: Sun,               title: "베란다 태양광 설치",      desc: "베란다 태양광 패널 설치를 인증하세요",                    points: "+50P" },
  { id: "recycledproduct",Icon: RotateCcw,         title: "재생원료 제품구매",       desc: "재생원료로 만든 제품을 구매하고 인증하세요",               points: "+30P" },
  { id: "ecobag",         Icon: ShoppingBag,       title: "개인장바구니 이용",       desc: "장보기 시 개인장바구니를 사용하고 인증하세요",             points: "+20P" },
  { id: "owncontainer",   Icon: Container,         title: "개인용기 식품포장",       desc: "개인용기로 식품을 포장받고 인증하세요",                   points: "+20P" },
];

// ─── 항목별 색상 (아이콘 색상 + 배경) ───────────────────
const COLORS = {
  ereceipt:       { icon: "text-blue-500",    bg: "bg-blue-50",    border: "border-blue-300",    text: "text-blue-600",    badge: "bg-blue-500" },
  tumbler:        { icon: "text-amber-500",   bg: "bg-amber-50",   border: "border-amber-300",   text: "text-amber-600",   badge: "bg-amber-500" },
  cupreturn:      { icon: "text-teal-500",    bg: "bg-teal-50",    border: "border-teal-300",    text: "text-teal-600",    badge: "bg-teal-500" },
  refillstation:  { icon: "text-indigo-500",  bg: "bg-indigo-50",  border: "border-indigo-300",  text: "text-indigo-600",  badge: "bg-indigo-500" },
  container:      { icon: "text-violet-500",  bg: "bg-violet-50",  border: "border-violet-300",  text: "text-violet-600",  badge: "bg-violet-500" },
  evrental:       { icon: "text-sky-500",     bg: "bg-sky-50",     border: "border-sky-300",     text: "text-sky-600",     badge: "bg-sky-500" },
  ecoproduct:     { icon: "text-emerald-500", bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-600", badge: "bg-emerald-500" },
  qualityrecycle: { icon: "text-cyan-500",    bg: "bg-cyan-50",    border: "border-cyan-300",    text: "text-cyan-600",    badge: "bg-cyan-500" },
  phonereturn:    { icon: "text-rose-500",    bg: "bg-rose-50",    border: "border-rose-300",    text: "text-rose-600",    badge: "bg-rose-500" },
  futuregen:      { icon: "text-green-500",   bg: "bg-green-50",   border: "border-green-300",   text: "text-green-600",   badge: "bg-green-500" },
  sharedbike:     { icon: "text-lime-500",    bg: "bg-lime-50",    border: "border-lime-300",    text: "text-lime-600",    badge: "bg-lime-500" },
  zerowaste:      { icon: "text-orange-500",  bg: "bg-orange-50",  border: "border-orange-300",  text: "text-orange-600",  badge: "bg-orange-500" },
  treeplanting:   { icon: "text-green-600",   bg: "bg-green-50",   border: "border-green-300",   text: "text-green-700",   badge: "bg-green-600" },
  solarpanel:     { icon: "text-yellow-500",  bg: "bg-yellow-50",  border: "border-yellow-300",  text: "text-yellow-600",  badge: "bg-yellow-500" },
  recycledproduct:{ icon: "text-teal-500",    bg: "bg-teal-50",    border: "border-teal-300",    text: "text-teal-600",    badge: "bg-teal-500" },
  ecobag:         { icon: "text-pink-500",    bg: "bg-pink-50",    border: "border-pink-300",    text: "text-pink-600",    badge: "bg-pink-500" },
  owncontainer:   { icon: "text-purple-500",  bg: "bg-purple-50",  border: "border-purple-300",  text: "text-purple-600",  badge: "bg-purple-500" },
};

// ─── 인증 모달 설정 ─────────────────────────────────────
const CERT_CONFIG = {
  tumbler: {
    title: "텀블러/다회용컵 이용 인증", dbType: "tumbler", bonus: TUMBLER_BONUS,
    steps: ["카페 방문 시 텀블러/다회용컵을 가져가세요", "텀블러에 음료를 받은 후 텀블러를 촬영", "주문내역 캡처를 함께 올리면 인증 완료!"],
    tip: "스타벅스 등 제휴 매장에서는 텀블러 사용 시 300원 할인도 별도로 받을 수 있어요. 우리 앱의 포인트는 추가 적립입니다!",
    photoLabel: "텀블러 사진", receiptLabel: "주문내역",
  },
  cupreturn: {
    title: "일회용컵 반환 인증", dbType: "cup_return", hasCupCount: true,
    steps: ["편의점, 카페 등에 설치된 컵 반환기를 찾아주세요", "일회용컵을 반환기에 넣어주세요", "반환 완료 화면 또는 반환기를 사진으로 촬영해주세요"],
    tip: "일회용컵 반환 시 자원순환보증금 300원도 돌려받을 수 있어요. 오백원의 행복 포인트는 별도로 추가 적립됩니다!",
    photoLabel: "반환기 사진", bonusPerCup: CUP_RETURN_PER_CUP,
  },
  container: {
    title: "다회용기 배달 이용 인증", dbType: "reusable_container", bonus: REUSABLE_CONTAINER_BONUS,
    steps: ["배달앱에서 주문 시 다회용기 선택", "배달 도착 후 다회용기에 담긴 음식을 촬영", "배달앱 주문내역 캡처를 함께 올리면 인증 완료!"],
    tip: "다회용기 사진은 음식이 담긴 상태로 촬영해주세요. 주문내역 캡처에 \"다회용기\" 선택 표시가 보이면 더 좋아요!",
    photoLabel: "다회용기 사진", receiptLabel: "주문내역",
    services: ["배달의민족", "쿠팡이츠", "요기요", "기타"],
  },
  evrental: {
    title: "무공해차 대여 인증", dbType: "ev_rental", bonus: EV_RENTAL_BONUS,
    steps: ["카셰어링 앱에서 전기차·수소차를 대여", "대여한 차량을 촬영해주세요", "대여앱 이용내역 캡처를 함께 올리면 인증 완료!"],
    tip: "전기차, 수소차 등 무공해 차량이 대상입니다. 쏘카, 그린카, 피플카 등 카셰어링 서비스의 전기차 대여가 해당돼요.",
    photoLabel: "차량 사진", receiptLabel: "이용내역",
    services: ["쏘카", "그린카", "피플카", "카카오T", "기타"],
  },
  sharedbike: {
    title: "공유자전거 이용 인증", dbType: "shared_bike", bonus: SHARED_BIKE_BONUS,
    steps: ["공유자전거 앱에서 자전거를 대여해주세요", "이용 중인 자전거를 촬영해주세요", "앱의 이용내역 캡처를 함께 올리면 인증 완료!"],
    tip: "따릉이, 카카오T바이크, 일레클, 지쿠 등 공유자전거·전동킥보드 서비스가 모두 해당됩니다.",
    photoLabel: "자전거 사진", receiptLabel: "이용내역",
    services: ["따릉이", "카카오T바이크", "일레클", "지쿠", "기타"],
  },
  ereceipt: {
    title: "전자영수증 발급 인증", dbType: "e_receipt", bonus: E_RECEIPT_BONUS, allowGallery: true,
    steps: ["매장에서 결제 시 전자영수증 발급을 요청", "스마트폰에 수신된 전자영수증 화면을 캡처", "캡처한 화면을 업로드하면 인증 완료!"],
    tip: "편의점, 마트, 카페 등 전자영수증 발급이 가능한 매장에서 이용하세요. 카카오톡, 네이버 전자영수증 모두 인정됩니다.",
    photoLabel: "전자영수증 캡처",
  },
  futuregen: {
    title: "미래세대 실천행동 인증", dbType: "future_gen", bonus: FUTURE_GEN_BONUS,
    steps: ["환경 관련 교육, 캠페인, 봉사활동에 참여", "참여 현장 또는 수료증·인증서를 촬영", "사진을 업로드하면 인증 완료!"],
    tip: "환경 교육, 기후행동 캠페인, 생태체험, 환경 봉사활동 등이 해당됩니다. 참여 증빙 사진을 찍어주세요.",
    photoLabel: "참여 인증사진", receiptLabel: "수료증/인증서",
  },
  zerowaste: {
    title: "잔반제로 실천 인증", dbType: "zero_waste", bonus: ZERO_WASTE_BONUS,
    steps: ["식사 후 음식을 남기지 않고 깨끗이 비우기", "깨끗이 비운 식판·그릇을 촬영", "사진을 업로드하면 인증 완료!"],
    tip: "구내식당, 식당, 가정식 등 어디서든 실천 가능합니다. 깨끗이 비운 접시·식판을 찍어주세요.",
    photoLabel: "빈 식판/그릇",
  },
  ecobag: {
    title: "개인장바구니 이용 인증", dbType: "eco_bag", bonus: ECO_BAG_BONUS,
    steps: ["마트·시장에서 개인장바구니에 물건 담기", "장바구니에 물건이 담긴 모습을 촬영", "사진을 업로드하면 인증 완료!"],
    tip: "마트, 전통시장, 편의점 등에서 비닐봉투 대신 장바구니를 사용해주세요.",
    photoLabel: "장바구니 사진",
  },
  owncontainer: {
    title: "개인용기 식품포장 인증", dbType: "own_container", bonus: OWN_CONTAINER_BONUS,
    steps: ["매장 방문 시 개인용기를 가져가세요", "개인용기에 식품을 담아 포장받기", "포장된 개인용기를 촬영하면 인증 완료!"],
    tip: "반찬가게, 식당 포장, 베이커리 등에서 일회용 용기 대신 개인용기를 사용해주세요.",
    photoLabel: "개인용기 사진",
  },
  recycledproduct: {
    title: "재생원료 제품구매 인증", dbType: "recycled_product", bonus: RECYCLED_PRODUCT_BONUS,
    steps: ["재생원료 인증마크가 있는 제품을 구매", "제품 또는 인증마크를 촬영", "구매내역 캡처와 함께 올리면 인증 완료!"],
    tip: "재생지, 재생플라스틱, 업사이클링 제품 등 GR마크·환경마크가 있는 제품이 해당됩니다.",
    photoLabel: "제품/인증마크", receiptLabel: "구매내역",
  },
  treeplanting: {
    title: "나무심기 캠페인 참여 인증", dbType: "tree_planting", bonus: TREE_PLANTING_BONUS,
    steps: ["나무심기 캠페인이나 봉사활동에 참여", "나무를 심는 모습 또는 심은 나무를 촬영", "참여 인증서가 있으면 함께 올려주세요!"],
    tip: "지자체, 기업, 시민단체 등이 주최하는 나무심기 행사가 모두 해당됩니다. 식목일 참여도 인정돼요!",
    photoLabel: "활동 사진", receiptLabel: "참여 인증서",
  },
  solarpanel: {
    title: "베란다 태양광 설치 인증", dbType: "solar_panel", bonus: SOLAR_PANEL_BONUS, allowGallery: true,
    steps: ["베란다에 태양광 미니발전소를 설치", "설치된 태양광 패널을 촬영", "설치 확인서나 신청서 캡처를 함께 올려주세요!"],
    tip: "지자체 보조금 신청 후 설치한 베란다 태양광이 대상입니다. 설치 후 1회 인증 가능합니다.",
    photoLabel: "태양광 패널 사진", receiptLabel: "설치확인서",
  },
  phonereturn: {
    title: "폐휴대폰 반납 인증", dbType: "phone_return", bonus: PHONE_RETURN_BONUS,
    steps: ["사용하지 않는 폐휴대폰을 준비", "우체국, 대리점 등 수거함에 반납", "반납 모습 또는 수거함을 촬영해주세요!"],
    tip: "우체국, 이동통신 대리점, 주민센터 등에 설치된 폐휴대폰 수거함에 반납하세요.",
    photoLabel: "반납 사진",
  },
  refillstation: {
    title: "리필스테이션 이용 인증", dbType: "refill_station", bonus: REFILL_STATION_BONUS,
    steps: ["리필스테이션이 있는 매장을 방문", "세제, 샴푸 등을 개인용기에 리필", "리필 모습 또는 리필된 용기를 촬영해주세요!"],
    tip: "아모레퍼시픽, 이니스프리, 아로마티카 등 리필스테이션 운영 매장에서 이용하세요.",
    photoLabel: "리필 사진",
  },
  ecoproduct: {
    title: "친환경제품 구매 인증", dbType: "eco_product", bonus: ECO_PRODUCT_BONUS,
    steps: ["환경마크·녹색인증 제품을 구매", "제품의 환경마크 또는 녹색인증 마크를 촬영", "구매내역 캡처와 함께 올리면 인증 완료!"],
    tip: "환경마크, 저탄소제품 인증, GR마크 등이 부착된 제품이 해당됩니다. 세제, 화장지, 문구류 등 다양한 제품이 있어요.",
    photoLabel: "제품/인증마크", receiptLabel: "구매내역",
  },
  qualityrecycle: {
    title: "고품질 재활용품 배출 인증", dbType: "quality_recycle", bonus: QUALITY_RECYCLE_BONUS,
    steps: ["재활용품을 깨끗이 세척하고 라벨을 제거", "분리배출 기준에 맞게 정리", "깨끗하게 정리된 재활용품을 촬영해주세요!"],
    tip: "페트병 라벨 제거, 캔·유리병 세척, 종이류 이물질 제거 등 고품질 분리배출이 대상입니다. 투명 페트병은 별도 배출해주세요.",
    photoLabel: "분리배출 사진",
  },
};

// ─── 최근 내역용 아이콘/이름 매핑 ──────────────────────
const TYPE_META = {
  tumbler:"☕", cup_return:"♻️", reusable_container:"🍱", ev_rental:"🚗", shared_bike:"🚲",
  e_receipt:"🧾", future_gen:"🌱", zero_waste:"🍽️", eco_bag:"🛍️", own_container:"🥡",
  recycled_product:"♻️", tree_planting:"🌳", solar_panel:"☀️", phone_return:"📱", refill_station:"🫧",
  eco_product:"🌿", quality_recycle:"🔄",
};
const TYPE_NAME = {
  tumbler:"텀블러 사용", cup_return:"일회용컵 반환", reusable_container:"다회용기 배달",
  ev_rental:"무공해차 대여", shared_bike:"공유자전거 이용", e_receipt:"전자영수증 발급",
  future_gen:"미래세대 실천행동", zero_waste:"잔반제로 실천", eco_bag:"개인장바구니 이용",
  own_container:"개인용기 식품포장", recycled_product:"재생원료 제품구매",
  tree_planting:"나무심기 캠페인", solar_panel:"베란다 태양광", phone_return:"폐휴대폰 반납", refill_station:"리필스테이션",
  eco_product:"친환경제품 구매", quality_recycle:"고품질 재활용품 배출",
};

// ═══════════════════════════════════════════════════════
//  범용 인증 모달
// ═══════════════════════════════════════════════════════
function EcoCertModal({ ecoId, onConfirm, onClose }) {
  const cfg = CERT_CONFIG[ecoId];
  const clr = COLORS[ecoId];
  const action = ECO_ACTIONS.find(a => a.id === ecoId);
  const [step, setStep]       = useState("guide");
  const [photo, setPhoto]     = useState(null);
  const [preview, setPreview] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [receiptPrev, setReceiptPrev] = useState(null);
  const [cupCount, setCupCount] = useState(1);
  const [service, setService]   = useState("");
  const [uploading, setUploading] = useState(false);
  const photoRef   = useRef(null);
  const receiptRef = useRef(null);

  const handlePhoto = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const maxMin = cfg.allowGallery ? 120 : 10;
    const msg = cfg.allowGallery ? "2시간 이내의 캡처만 인증이 가능합니다." : "방금 찍은 사진만 인증이 가능합니다.\n갤러리 사진은 사용할 수 없어요.";
    if ((Date.now() - f.lastModified) / 60000 > maxMin) { e.target.value = ""; alert(msg); return; }
    setPhoto(f); setPreview(URL.createObjectURL(f));
  };
  const handleReceipt = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    if ((Date.now() - f.lastModified) / 60000 > 120) { e.target.value = ""; alert("2시간 이내의 이미지만 인증이 가능합니다."); return; }
    setReceipt(f); setReceiptPrev(URL.createObjectURL(f));
  };

  const totalPoints = cfg.hasCupCount ? cupCount * cfg.bonusPerCup : (cfg.bonus || 0);

  const handleSubmit = async () => {
    if (!photo) { alert(`${cfg.photoLabel}을 올려주세요`); return; }
    setUploading(true);
    try {
      const photoUrl = await uploadToCloudinary(photo);
      let receiptUrl = null;
      if (receipt) receiptUrl = await uploadToCloudinary(receipt);
      onConfirm({ ecoId, photoUrl, receiptUrl, service, cupCount: cfg.hasCupCount ? cupCount : undefined, points: totalPoints, certifiedAt: new Date().toISOString() });
    } catch (e) { alert("사진 업로드 실패: " + e.message); }
    finally { setUploading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-[210]">
      <div className="bg-white rounded-t-3xl w-full shadow-2xl overflow-hidden" style={{ maxHeight: "85vh" }}>
        <div className="pt-3 pb-1 flex justify-center"><div className="w-10 h-1 bg-gray-200 rounded-full" /></div>
        <div className="px-5 pt-2 pb-6 overflow-y-auto" style={{ maxHeight: "calc(85vh - 2rem)", paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 16px))" }}>

          {step === "guide" && (
            <>
              <div className="text-center mb-4">
                <div className={`w-14 h-14 rounded-2xl ${clr.bg} border ${clr.border} flex items-center justify-center mx-auto mb-2`}>
                  {action?.Icon && <action.Icon size={28} className={clr.icon} strokeWidth={2} />}
                </div>
                <h2 className="text-lg font-black text-gray-800">{cfg.title}</h2>
              </div>
              <div className="space-y-2.5 mb-4">
                <div className={`${clr.bg} border ${clr.border} rounded-2xl p-3.5`}>
                  <h3 className={`text-sm font-black ${clr.text} mb-2`}>인증 방법</h3>
                  <div className="space-y-1.5">
                    {cfg.steps.map((s, i) => (
                      <div key={i} className={`flex items-start gap-1.5 text-xs ${clr.text} leading-relaxed`}>
                        <span className="font-black opacity-50 mt-px">{i + 1}</span>
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3.5">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl mt-0.5">💡</span>
                    <div className="flex-1">
                      <h3 className="text-sm font-black text-gray-700 mb-1">알아두세요</h3>
                      <p className="text-xs text-gray-500 leading-relaxed">{cfg.tip}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className={`${clr.bg} border ${clr.border} rounded-2xl p-3 mb-4 text-center`}>
                <span className={`text-xs font-bold ${clr.text}`}>
                  인증 시 <span className="opacity-80">{action?.points}</span> 적립!
                </span>
                <p className="text-[10px] text-gray-400 mt-1">탄소중립포인트 녹색생활 실천 연계 항목</p>
              </div>
              <div className="space-y-2">
                <button onClick={() => setStep("cert")}
                  className={`w-full py-4 rounded-2xl font-black text-base ${clr.badge} text-white shadow-md active:scale-95 transition-all`}>
                  인증 시작하기
                </button>
                <button onClick={onClose} className="w-full py-3 rounded-2xl text-gray-400 text-sm font-medium bg-gray-50 active:bg-gray-100">취소</button>
              </div>
            </>
          )}

          {step === "cert" && (
            <>
              <div className="text-center mb-4">
                <h2 className="text-lg font-black text-gray-800">{cfg.title.replace(" 인증", "")} 인증하기</h2>
                <p className="text-gray-400 text-xs mt-1">{cfg.photoLabel}을 올려주세요</p>
              </div>

              <div className={`${cfg.receiptLabel ? "grid grid-cols-2 gap-2" : ""} mb-3`}>
                <div>
                  <label className={`text-xs font-bold ${clr.text} mb-1 block`}>{cfg.photoLabel} <span className="text-red-400">*</span></label>
                  {preview ? (
                    <div className="relative">
                      <img src={preview} alt="인증" className="w-full h-32 object-cover rounded-xl" />
                      <button onClick={() => { setPhoto(null); setPreview(null); }} className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">✕</button>
                    </div>
                  ) : (
                    <button onClick={() => photoRef.current?.click()} className={`w-full h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-1 ${clr.border} ${clr.bg}`}>
                      <span className="text-2xl">📸</span>
                      <span className={`text-[10px] font-bold ${clr.text}`}>{cfg.photoLabel}</span>
                    </button>
                  )}
                  <input ref={photoRef} type="file" accept="image/*" {...(cfg.allowGallery ? {} : { capture: "environment" })} onChange={handlePhoto} className="hidden" />
                </div>
                {cfg.receiptLabel && (
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">{cfg.receiptLabel} <span className="text-gray-300">(선택)</span></label>
                    {receiptPrev ? (
                      <div className="relative">
                        <img src={receiptPrev} alt="증빙" className="w-full h-32 object-cover rounded-xl" />
                        <button onClick={() => { setReceipt(null); setReceiptPrev(null); }} className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">✕</button>
                      </div>
                    ) : (
                      <button onClick={() => receiptRef.current?.click()} className="w-full h-32 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1 bg-gray-50/30">
                        <span className="text-2xl">🧾</span>
                        <span className="text-[10px] text-gray-500 font-bold">{cfg.receiptLabel}</span>
                      </button>
                    )}
                    <input ref={receiptRef} type="file" accept="image/*" onChange={handleReceipt} className="hidden" />
                  </div>
                )}
              </div>

              {/* 컵 수량 (일회용컵 반환 전용) */}
              {cfg.hasCupCount && (
                <div className="mb-4">
                  <label className="text-sm font-bold text-gray-700 mb-2 block">반환 수량</label>
                  <div className="flex items-center justify-center gap-4 bg-gray-50 rounded-2xl p-3">
                    <button onClick={() => setCupCount(Math.max(1, cupCount - 1))} className="w-10 h-10 rounded-full bg-white border-2 border-gray-300 text-gray-500 text-lg font-bold flex items-center justify-center">−</button>
                    <div className="text-center">
                      <span className="text-3xl font-black text-gray-800">{cupCount}</span>
                      <span className="text-sm text-gray-400 ml-1">개</span>
                    </div>
                    <button onClick={() => setCupCount(Math.min(20, cupCount + 1))} className="w-10 h-10 rounded-full bg-white border-2 border-gray-300 text-gray-500 text-lg font-bold flex items-center justify-center">+</button>
                  </div>
                  <div className="text-center mt-2">
                    <span className={`inline-flex items-center gap-1 ${clr.bg} border ${clr.border} rounded-full px-3 py-1 text-xs font-bold ${clr.text}`}>
                      ♻️ 적립 예정: +{totalPoints}P
                    </span>
                  </div>
                </div>
              )}

              {/* 서비스 선택 */}
              {cfg.services && (
                <div className="mb-4">
                  <label className="text-xs font-bold text-gray-600 mb-1.5 block">이용 서비스</label>
                  <div className="flex flex-wrap gap-1.5">
                    {cfg.services.map(s => (
                      <button key={s} onClick={() => setService(s)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${service === s ? `${clr.badge} text-white border-transparent` : "bg-white text-gray-500 border-gray-200"}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <button onClick={handleSubmit} disabled={uploading || !photo}
                  className={`w-full py-4 rounded-2xl font-black text-base transition-all ${uploading ? "bg-gray-100 text-gray-400" : photo ? `${clr.badge} text-white shadow-md active:scale-95` : "bg-gray-100 text-gray-300 cursor-not-allowed"}`}>
                  {uploading ? "인증 중..." : "인증 완료"}
                </button>
                <button onClick={() => setStep("guide")} className="w-full py-3 rounded-2xl text-gray-400 text-sm font-medium bg-gray-50 active:bg-gray-100">이전으로</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  메인 페이지
// ═══════════════════════════════════════════════════════
export default function EcoLifePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [recentActions, setRecentActions] = useState([]);
  const [activeModal, setActiveModal] = useState(null);
  const [stats, setStats] = useState(null); // { byType: { tumbler: {count, points}, ... }, totalPoints, totalCount }
  const [showStats, setShowStats] = useState(false);

  // dbType → eco action id 매핑 (역방향)
  const DB_TO_ID = Object.fromEntries(Object.entries(CERT_CONFIG).map(([id, c]) => [c.dbType, id]));

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        // 전체 내역 조회 (집계용)
        const allQ = query(collection(db, "ecoActions"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
        const allSnap = await getDocs(allQ);
        const docs = allSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // 최근 5건
        setRecentActions(docs.slice(0, 5));

        // 항목별 집계
        const byType = {};
        let totalPoints = 0;
        let totalCount = 0;
        docs.forEach(d => {
          const t = d.type;
          if (!byType[t]) byType[t] = { count: 0, points: 0 };
          byType[t].count += 1;
          byType[t].points += (d.points || 0);
          totalPoints += (d.points || 0);
          totalCount += 1;
        });
        setStats({ byType, totalPoints, totalCount });
      } catch (e) { /* ignore */ }
    };
    fetchData();
  }, [user]);

  // 인증 완료 핸들러
  const handleConfirm = async (certData) => {
    const cfg = CERT_CONFIG[certData.ecoId];
    if (!cfg) return;
    try {
      const docData = {
        userId: user?.uid || "anonymous",
        type: cfg.dbType,
        photoUrl: certData.photoUrl,
        receiptUrl: certData.receiptUrl || null,
        points: certData.points,
        certifiedAt: certData.certifiedAt,
        createdAt: serverTimestamp(),
      };
      if (certData.cupCount) docData.cupCount = certData.cupCount;
      if (certData.service) docData.service = certData.service;

      await addDoc(collection(db, "ecoActions"), docData);
      if (user) {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, { totalPoints: increment(certData.points) }).catch(() => {});
      }
      setActiveModal(null);
      // 최근 내역 + 통계 갱신
      const newEntry = { id: Date.now().toString(), type: cfg.dbType, points: certData.points, certifiedAt: certData.certifiedAt, cupCount: certData.cupCount };
      setRecentActions(prev => [newEntry, ...prev].slice(0, 5));
      setStats(prev => {
        if (!prev) return { byType: { [cfg.dbType]: { count: 1, points: certData.points } }, totalPoints: certData.points, totalCount: 1 };
        const bt = { ...prev.byType };
        if (!bt[cfg.dbType]) bt[cfg.dbType] = { count: 0, points: 0 };
        bt[cfg.dbType] = { count: bt[cfg.dbType].count + 1, points: bt[cfg.dbType].points + certData.points };
        return { byType: bt, totalPoints: prev.totalPoints + certData.points, totalCount: prev.totalCount + 1 };
      });
      const action = ECO_ACTIONS.find(a => a.id === certData.ecoId);
      alert(`${action?.title} 인증 완료!\n+${certData.points} 포인트가 적립되었습니다.`);
    } catch (e) { alert("저장 실패: " + e.message); }
  };

  const handleCardClick = (action) => {
    setActiveModal(action.id);
  };

  if (loading) {
    return (<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" /></div>);
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 p-6 text-center">
        <div className="text-6xl">🔑</div>
        <h2 className="text-xl font-bold text-gray-800">로그인이 필요합니다</h2>
        <p className="text-gray-500 text-sm">녹색생활 실천 인증을 위해 로그인해주세요</p>
        <Link href="/" className="bg-green-500 text-white px-6 py-3 rounded-full font-bold">홈으로 돌아가기</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white pb-24">
      {/* 헤더 */}
      <div className="bg-white/80 backdrop-blur-sm sticky top-0 z-10 border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2">
            <Leaf className="w-5 h-5 text-green-600" />
            <h1 className="text-lg font-black text-gray-800">녹색생활 실천</h1>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5">
        {/* 안내 배너 */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-4 mb-5 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🌿</span>
            <div>
              <h2 className="font-black text-base">탄소중립포인트 녹색생활 실천</h2>
              <p className="text-green-100 text-xs mt-0.5 leading-relaxed">
                일상 속 친환경 활동을 인증하고 포인트를 적립하세요!
              </p>
            </div>
          </div>
        </div>

        {/* ── 내 실천 현황 대시보드 ── */}
        {stats && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-5 overflow-hidden">
            {/* 요약 헤더 (항상 보임) */}
            <button onClick={() => setShowStats(!showStats)} className="w-full px-4 py-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <Award size={22} className="text-green-600" strokeWidth={2} />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[11px] text-gray-400 font-medium">내 녹색생활 포인트</p>
                <p className="text-xl font-black text-gray-800">{stats.totalPoints.toLocaleString()}<span className="text-sm font-bold text-gray-400 ml-0.5">P</span></p>
              </div>
              <div className="text-right mr-1">
                <p className="text-[11px] text-gray-400">총 인증</p>
                <p className="text-base font-black text-green-600">{stats.totalCount}회</p>
              </div>
              {showStats ? <ChevronUp size={18} className="text-gray-300" /> : <ChevronDown size={18} className="text-gray-300" />}
            </button>

            {/* 항목별 상세 (토글) */}
            {showStats && (
              <div className="border-t border-gray-100 px-4 py-3">
                <div className="space-y-1.5">
                  {ECO_ACTIONS.map(action => {
                    const cfg = CERT_CONFIG[action.id];
                    if (!cfg) return null;
                    const s = stats.byType[cfg.dbType];
                    const count = s?.count || 0;
                    const pts = s?.points || 0;
                    const clr = COLORS[action.id];
                    const IconComp = action.Icon;
                    return (
                      <div key={action.id} className="flex items-center gap-2.5 py-1.5">
                        <IconComp size={16} className={count > 0 ? clr.icon : "text-gray-300"} strokeWidth={2} />
                        <span className={`text-xs flex-1 ${count > 0 ? "text-gray-700 font-medium" : "text-gray-300"}`}>{action.title}</span>
                        <span className={`text-[11px] w-10 text-center ${count > 0 ? "text-gray-500 font-bold" : "text-gray-300"}`}>{count}회</span>
                        <span className={`text-[11px] w-14 text-right font-bold ${count > 0 ? "text-green-600" : "text-gray-300"}`}>{pts > 0 ? `+${pts}P` : "-"}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500">합계</span>
                  <span className="text-sm font-black text-green-600">{stats.totalPoints.toLocaleString()}P</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 실천 항목 카드 */}
        <h3 className="text-sm font-black text-gray-700 mb-3 flex items-center gap-1.5">
          <span className="text-base">✅</span> 인증 가능한 활동 ({ECO_ACTIONS.length}개)
        </h3>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {ECO_ACTIONS.map(action => {
            const clr = COLORS[action.id];
            const IconComp = action.Icon;
            return (
              <button key={action.id} onClick={() => handleCardClick(action)}
                className={`${clr.bg} border-2 ${clr.border} rounded-2xl px-3 pt-4 pb-3 flex flex-col items-center text-center active:scale-[0.96] transition-all`}>
                <IconComp size={32} className={clr.icon} strokeWidth={1.8} />
                <h4 className="font-black text-[13px] text-gray-800 mt-2 leading-tight">{action.title}</h4>
                <p className="text-[10px] text-gray-400 mt-1 leading-snug line-clamp-2">{action.desc}</p>
                <span className={`text-[11px] font-bold ${clr.text} mt-1.5`}>{action.points}</span>
              </button>
            );
          })}
        </div>

        {/* 최근 인증 내역 */}
        {recentActions.length > 0 && (
          <>
            <h3 className="text-sm font-black text-gray-700 mb-3 flex items-center gap-1.5">
              <span className="text-base">📋</span> 최근 인증 내역
            </h3>
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm mb-6">
              {recentActions.map((action, i) => (
                <div key={action.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-gray-50" : ""}`}>
                  <span className="text-xl">{TYPE_META[action.type] || "🌿"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-700">
                      {TYPE_NAME[action.type] || "녹색생활 실천"}
                      {action.type === "cup_return" && action.cupCount ? ` (${action.cupCount}개)` : ""}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {action.certifiedAt ? new Date(action.certifiedAt).toLocaleDateString("ko-KR") : ""}
                    </p>
                  </div>
                  <span className="text-xs font-black text-green-600 bg-green-50 px-2 py-1 rounded-full">+{action.points || 0}P</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 하단 안내 */}
        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 mb-6 text-center">
          <p className="text-xs text-gray-500 leading-relaxed">
            녹색생활 실천 인증은 <span className="font-bold">탄소중립포인트 녹색생활 실천</span> 프로그램과<br/>
            연계하여 운영됩니다. 적립된 포인트는 리워드 교환에 사용할 수 있습니다.
          </p>
        </div>
      </div>

      {/* ── 인증 모달 ───────────────────────────────────── */}
      {activeModal && CERT_CONFIG[activeModal] && (
        <EcoCertModal
          ecoId={activeModal}
          onConfirm={handleConfirm}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  );
}
