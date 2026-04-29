/**
 * QR코드 생성 유틸리티
 * CDN에서 검증된 라이브러리(qrcode-generator)를 동적 로드하여 사용
 */

let qrLib = null;
let loadPromise = null;

// CDN에서 qrcode-generator 로드 (최초 1회)
function loadQRLib() {
  if (qrLib) return Promise.resolve(qrLib);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    // 이미 로드된 경우
    if (typeof window !== "undefined" && window.qrcode) {
      qrLib = window.qrcode;
      resolve(qrLib);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
    script.onload = () => {
      qrLib = window.qrcode;
      resolve(qrLib);
    };
    script.onerror = () => reject(new Error("QR 라이브러리 로드 실패"));
    document.head.appendChild(script);
  });

  return loadPromise;
}

/**
 * QR코드 → Canvas Data URL 생성
 * @param {string} text - 인코딩할 텍스트
 * @param {number} size - 이미지 크기(px), 기본 256
 * @returns {Promise<string>} data:image/png;base64,... 형태의 URL
 */
export async function generateQRDataURL(text, size = 256) {
  const qr = await loadQRLib();
  const typeNumber = 0; // 자동 감지
  const errorCorrectionLevel = "M";

  const qrCode = qr(typeNumber, errorCorrectionLevel);
  qrCode.addData(text);
  qrCode.make();

  const moduleCount = qrCode.getModuleCount();
  const cellSize = Math.floor(size / (moduleCount + 8)); // quiet zone 포함
  const margin = Math.floor((size - cellSize * moduleCount) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  // 흰 배경
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, size, size);

  // 모듈 그리기
  ctx.fillStyle = "#000000";
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (qrCode.isDark(row, col)) {
        ctx.fillRect(
          margin + col * cellSize,
          margin + row * cellSize,
          cellSize,
          cellSize
        );
      }
    }
  }

  return canvas.toDataURL("image/png");
}

/**
 * 동기 버전 — 라이브러리가 이미 로드된 경우에만 사용
 * (최초 호출은 반드시 async 버전 사용)
 */
export function generateQRDataURLSync(text, size = 256) {
  if (!qrLib) throw new Error("QR 라이브러리 미로드. generateQRDataURL(async)를 먼저 호출하세요.");

  const qrCode = qrLib(0, "M");
  qrCode.addData(text);
  qrCode.make();

  const moduleCount = qrCode.getModuleCount();
  const cellSize = Math.floor(size / (moduleCount + 8));
  const margin = Math.floor((size - cellSize * moduleCount) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = "#000000";
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (qrCode.isDark(row, col)) {
        ctx.fillRect(
          margin + col * cellSize,
          margin + row * cellSize,
          cellSize,
          cellSize
        );
      }
    }
  }

  return canvas.toDataURL("image/png");
}
