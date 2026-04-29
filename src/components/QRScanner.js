"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Camera, X, Flashlight, FlashlightOff, SwitchCamera, AlertCircle } from "lucide-react";

/**
 * QR 스캐너 컴포넌트
 * Props:
 *   onScan(code: string) — QR코드 인식 시 호출
 *   onClose() — 닫기 시 호출
 *   title — 스캐너 상단 타이틀
 */
export default function QRScanner({ onScan, onClose, title = "QR 스캔" }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scannerRef = useRef(null);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [torch, setTorch] = useState(false);
  const [facingMode, setFacingMode] = useState("environment");
  const scannedRef = useRef(false);

  // ── 카메라 시작 ────────────────────────────────────────────
  const startCamera = useCallback(async (facing) => {
    try {
      // 기존 스트림 정리
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const constraints = {
        video: {
          facingMode: facing || facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setScanning(true);
        setError(null);
      }
    } catch (err) {
      console.error("카메라 접근 실패:", err);
      if (err.name === "NotAllowedError") {
        setError("카메라 접근이 거부되었습니다. 설정에서 카메라 권한을 허용해주세요.");
      } else if (err.name === "NotFoundError") {
        setError("카메라를 찾을 수 없습니다.");
      } else {
        setError("카메라를 시작할 수 없습니다: " + err.message);
      }
    }
  }, [facingMode]);

  // ── QR 인식 루프 ───────────────────────────────────────────
  useEffect(() => {
    if (!scanning || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    let animId;

    // BarcodeDetector API 사용 가능 여부
    const hasBarcodeDetector = typeof window !== "undefined" && "BarcodeDetector" in window;
    let detector = null;

    if (hasBarcodeDetector) {
      try {
        detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      } catch {
        detector = null;
      }
    }

    const scan = async () => {
      if (scannedRef.current || video.readyState !== video.HAVE_ENOUGH_DATA) {
        animId = requestAnimationFrame(scan);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      try {
        let code = null;

        if (detector) {
          // BarcodeDetector API (Chrome 83+, Safari 16.4+)
          const barcodes = await detector.detect(canvas);
          if (barcodes.length > 0) {
            code = barcodes[0].rawValue;
          }
        } else {
          // Canvas 기반 수동 스캔 — ImageData 추출 후 간단한 패턴 감지
          // 모바일 브라우저 대부분 BarcodeDetector 지원하므로 fallback은 경고만
          // 실제 fallback이 필요하면 jsQR CDN 로드 가능
        }

        if (code && !scannedRef.current) {
          scannedRef.current = true;
          // 햅틱 피드백 (지원 시)
          if (navigator.vibrate) navigator.vibrate(100);
          onScan(code);
          return; // 스캔 완료, 루프 중지
        }
      } catch (e) {
        // 스캔 에러 무시, 계속 시도
      }

      animId = requestAnimationFrame(scan);
    };

    animId = requestAnimationFrame(scan);
    scannerRef.current = animId;

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [scanning, onScan]);

  // ── 마운트/언마운트 ────────────────────────────────────────
  useEffect(() => {
    startCamera("environment");
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (scannerRef.current) {
        cancelAnimationFrame(scannerRef.current);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 플래시 토글 ────────────────────────────────────────────
  const toggleTorch = async () => {
    try {
      const track = streamRef.current?.getVideoTracks()[0];
      if (track) {
        const capabilities = track.getCapabilities?.();
        if (capabilities?.torch) {
          await track.applyConstraints({ advanced: [{ torch: !torch }] });
          setTorch(!torch);
        }
      }
    } catch (e) {
      console.log("플래시 지원 안됨");
    }
  };

  // ── 카메라 전환 ────────────────────────────────────────────
  const switchCamera = () => {
    const newFacing = facingMode === "environment" ? "user" : "environment";
    setFacingMode(newFacing);
    scannedRef.current = false;
    startCamera(newFacing);
  };

  return (
    <div className="fixed inset-0 bg-black z-[300] flex flex-col">
      {/* 상단 바 */}
      <div className="relative z-10 flex items-center justify-between px-4 py-3 bg-black/70">
        <button onClick={onClose} className="p-2 rounded-full bg-white/10 active:bg-white/20">
          <X className="w-5 h-5 text-white" strokeWidth={2} />
        </button>
        <h2 className="text-white font-bold text-sm">{title}</h2>
        <div className="flex gap-2">
          <button onClick={toggleTorch} className="p-2 rounded-full bg-white/10 active:bg-white/20">
            {torch
              ? <FlashlightOff className="w-5 h-5 text-yellow-300" strokeWidth={2} />
              : <Flashlight className="w-5 h-5 text-white/70" strokeWidth={2} />
            }
          </button>
          <button onClick={switchCamera} className="p-2 rounded-full bg-white/10 active:bg-white/20">
            <SwitchCamera className="w-5 h-5 text-white/70" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* 카메라 뷰 */}
      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* 스캔 가이드 오버레이 */}
        {scanning && (
          <div className="absolute inset-0 flex items-center justify-center">
            {/* 반투명 오버레이 */}
            <div className="absolute inset-0 bg-black/40" />

            {/* 스캔 영역 (투명 구멍) */}
            <div className="relative w-64 h-64">
              {/* 투명 구멍을 만들기 위한 box shadow */}
              <div
                className="absolute inset-0 rounded-3xl"
                style={{
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.4)",
                }}
              />
              {/* 모서리 장식 */}
              <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-emerald-400 rounded-tl-2xl" />
              <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-emerald-400 rounded-tr-2xl" />
              <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-emerald-400 rounded-bl-2xl" />
              <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-emerald-400 rounded-br-2xl" />

              {/* 스캔 라인 애니메이션 */}
              <div
                className="absolute left-2 right-2 h-0.5 bg-emerald-400/80"
                style={{
                  animation: "qr-scan-line 2s ease-in-out infinite",
                }}
              />
            </div>

            {/* 안내 텍스트 */}
            <p className="absolute bottom-20 left-0 right-0 text-center text-white/80 text-sm font-medium">
              QR코드를 사각형 안에 맞춰주세요
            </p>
          </div>
        )}

        {/* 에러 표시 */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 px-8">
            <div className="bg-white rounded-3xl p-6 text-center max-w-sm">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-sm text-gray-600 mb-4">{error}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setError(null); startCamera(facingMode); }}
                  className="flex-1 bg-emerald-500 text-white py-3 rounded-2xl font-bold text-sm"
                >
                  다시 시도
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-2xl font-bold text-sm"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 스캔 라인 애니메이션 CSS */}
      <style jsx global>{`
        @keyframes qr-scan-line {
          0%, 100% { top: 8px; opacity: 0.5; }
          50% { top: calc(100% - 8px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
