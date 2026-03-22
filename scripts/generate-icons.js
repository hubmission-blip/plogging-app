const { createCanvas } = require("canvas");
const fs = require("fs");
const path = require("path");

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const r = size / 2;

  // 배경 그라디언트 (초록)
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, "#22c55e");
  grad.addColorStop(1, "#15803d");
  ctx.fillStyle = grad;

  // 둥근 사각형
  const radius = size * 0.22;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fill();

  // 흰색 원 (배경)
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.beginPath();
  ctx.arc(r, r * 0.9, r * 0.55, 0, Math.PI * 2);
  ctx.fill();

  // 이모지 대신 텍스트 (🌿)
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${size * 0.38}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🌿", r, r * 0.88);

  // 하단 텍스트
  ctx.font = `bold ${size * 0.12}px Arial`;
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText("오백원", r, size * 0.82);

  return canvas.toBuffer("image/png");
}

// icons 폴더 생성
const iconsDir = path.join(__dirname, "../public/icons");
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

// 192x192 생성
fs.writeFileSync(path.join(iconsDir, "icon-192.png"), generateIcon(192));
console.log("✅ icon-192.png 생성 완료");

// 512x512 생성
fs.writeFileSync(path.join(iconsDir, "icon-512.png"), generateIcon(512));
console.log("✅ icon-512.png 생성 완료");