/**
 * 순수 JS QR코드 생성기 — 외부 의존성 없음
 * 사용: generateQRDataURL(text, size) → "data:image/png;base64,..."
 */

// ─── GF(2^8) 연산 ─────────────────────────────────────────
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

function gfMul(a, b) {
  return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];
}

// ─── Reed-Solomon 생성다항식 ────────────────────────────────
function rsGenPoly(nsym) {
  let g = [1];
  for (let i = 0; i < nsym; i++) {
    const ng = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      ng[j] ^= g[j];
      ng[j + 1] ^= gfMul(g[j], EXP[i]);
    }
    g = ng;
  }
  return g;
}

function rsEncode(data, nsym) {
  const gen = rsGenPoly(nsym);
  const rem = new Uint8Array(data.length + nsym);
  rem.set(data);
  for (let i = 0; i < data.length; i++) {
    const coef = rem[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        rem[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return rem.slice(data.length);
}

// ─── QR 상수 (Version 1~6, Error Level M) ──────────────────
const QR_CONFIGS = [
  null, // index 0 unused
  { ver: 1, size: 21, dataCW: 16,  ecCW: 10, totalCW: 26,  ecBlocks: [[1, 16]] },
  { ver: 2, size: 25, dataCW: 28,  ecCW: 16, totalCW: 44,  ecBlocks: [[1, 28]] },
  { ver: 3, size: 29, dataCW: 44,  ecCW: 26, totalCW: 70,  ecBlocks: [[1, 44]] },
  { ver: 4, size: 33, dataCW: 64,  ecCW: 36, totalCW: 100, ecBlocks: [[2, 32]] },
  { ver: 5, size: 37, dataCW: 86,  ecCW: 48, totalCW: 134, ecBlocks: [[2, 43]] },
  { ver: 6, size: 41, dataCW: 108, ecCW: 64, totalCW: 172, ecBlocks: [[4, 27]] },
];

// 알파뉴머릭 인코딩 테이블
const ALPHANUM = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

function chooseVersion(text) {
  // 알파뉴머릭 모드 가능?
  const isAlphaNum = [...text].every((c) => ALPHANUM.includes(c));
  for (let v = 1; v <= 6; v++) {
    const cfg = QR_CONFIGS[v];
    const dataBits = cfg.dataCW * 8;
    if (isAlphaNum) {
      // 모드(4) + 길이(9~11) + 데이터(5.5bit/char) + 종료(4)
      const charBits = v <= 1 ? 9 : 11;
      const needed = 4 + charBits + Math.ceil(text.length / 2) * 11 - (text.length % 2 === 0 ? 0 : 5) + 4;
      if (needed <= dataBits) return { ver: v, mode: "alphanumeric" };
    }
    // 바이트 모드
    const byteLen = new TextEncoder().encode(text).length;
    const charBits = v <= 1 ? 8 : 16;
    const needed = 4 + charBits + byteLen * 8 + 4;
    if (needed <= dataBits) return { ver: v, mode: "byte" };
  }
  throw new Error("QR: 텍스트가 너무 깁니다 (Version 6 초과)");
}

// ─── 데이터 인코딩 ──────────────────────────────────────────
function encodeData(text, ver, mode) {
  const cfg = QR_CONFIGS[ver];
  const bits = [];
  const push = (val, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };

  if (mode === "alphanumeric") {
    push(0b0010, 4); // 모드 지시자
    const charCountBits = ver <= 1 ? 9 : 11;
    push(text.length, charCountBits);
    for (let i = 0; i < text.length; i += 2) {
      if (i + 1 < text.length) {
        const val = ALPHANUM.indexOf(text[i]) * 45 + ALPHANUM.indexOf(text[i + 1]);
        push(val, 11);
      } else {
        push(ALPHANUM.indexOf(text[i]), 6);
      }
    }
  } else {
    push(0b0100, 4); // 바이트 모드
    const bytes = new TextEncoder().encode(text);
    const charCountBits = ver <= 1 ? 8 : 16;
    push(bytes.length, charCountBits);
    for (const b of bytes) push(b, 8);
  }

  // 종료 패턴
  const totalBits = cfg.dataCW * 8;
  const termLen = Math.min(4, totalBits - bits.length);
  for (let i = 0; i < termLen; i++) bits.push(0);

  // 8비트 정렬
  while (bits.length % 8 !== 0) bits.push(0);

  // 패딩 바이트
  const pads = [0xec, 0x11];
  let pi = 0;
  while (bits.length < totalBits) {
    push(pads[pi % 2], 8);
    pi++;
  }

  // 바이트 배열로 변환
  const data = new Uint8Array(cfg.dataCW);
  for (let i = 0; i < cfg.dataCW; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | (bits[i * 8 + b] || 0);
    data[i] = byte;
  }

  return data;
}

// ─── EC 코드워드 생성 ───────────────────────────────────────
function generateCodewords(data, ver) {
  const cfg = QR_CONFIGS[ver];
  const ecPerBlock = cfg.ecCW / cfg.ecBlocks.reduce((s, b) => s + b[0], 0);
  const blocks = [];
  let offset = 0;

  for (const [count, size] of cfg.ecBlocks) {
    for (let i = 0; i < count; i++) {
      const block = data.slice(offset, offset + size);
      offset += size;
      const ec = rsEncode(block, ecPerBlock);
      blocks.push({ data: block, ec });
    }
  }

  // 인터리빙
  const result = [];
  const maxData = Math.max(...blocks.map((b) => b.data.length));
  for (let i = 0; i < maxData; i++) {
    for (const b of blocks) if (i < b.data.length) result.push(b.data[i]);
  }
  const maxEC = Math.max(...blocks.map((b) => b.ec.length));
  for (let i = 0; i < maxEC; i++) {
    for (const b of blocks) if (i < b.ec.length) result.push(b.ec[i]);
  }

  return result;
}

// ─── QR 매트릭스 생성 ───────────────────────────────────────
const ALIGNMENT_POS = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34]];

function createMatrix(ver) {
  const size = QR_CONFIGS[ver].size;
  // 0 = unused, 1 = function dark, 2 = function light, 3 = data area
  const matrix = Array.from({ length: size }, () => new Uint8Array(size));
  const reserved = Array.from({ length: size }, () => new Uint8Array(size));

  // 파인더 패턴
  function finderPattern(row, col) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = row + r, cc = col + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        const isDark =
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        matrix[rr][cc] = isDark ? 1 : 2;
        reserved[rr][cc] = 1;
      }
    }
  }
  finderPattern(0, 0);
  finderPattern(0, size - 7);
  finderPattern(size - 7, 0);

  // 정렬 패턴
  const alignPos = ALIGNMENT_POS[ver] || [];
  for (const r of alignPos) {
    for (const c of alignPos) {
      if (reserved[r][c]) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const isDark = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
          matrix[r + dr][c + dc] = isDark ? 1 : 2;
          reserved[r + dr][c + dc] = 1;
        }
      }
    }
  }

  // 타이밍 패턴
  for (let i = 8; i < size - 8; i++) {
    if (!reserved[6][i]) { matrix[6][i] = i % 2 === 0 ? 1 : 2; reserved[6][i] = 1; }
    if (!reserved[i][6]) { matrix[i][6] = i % 2 === 0 ? 1 : 2; reserved[i][6] = 1; }
  }

  // 다크 모듈
  matrix[size - 8][8] = 1;
  reserved[size - 8][8] = 1;

  // 포맷 정보 영역 예약
  for (let i = 0; i < 8; i++) {
    if (!reserved[8][i]) { reserved[8][i] = 1; matrix[8][i] = 2; }
    if (!reserved[8][size - 1 - i]) { reserved[8][size - 1 - i] = 1; matrix[8][size - 1 - i] = 2; }
    if (!reserved[i][8]) { reserved[i][8] = 1; matrix[i][8] = 2; }
    if (!reserved[size - 1 - i][8]) { reserved[size - 1 - i][8] = 1; matrix[size - 1 - i][8] = 2; }
  }
  if (!reserved[8][8]) { reserved[8][8] = 1; matrix[8][8] = 2; }

  return { matrix, reserved, size };
}

// ─── 데이터 비트 배치 ───────────────────────────────────────
function placeData(matrix, reserved, size, codewords) {
  const bits = [];
  for (const cw of codewords) {
    for (let i = 7; i >= 0; i--) bits.push((cw >> i) & 1);
  }

  let bitIdx = 0;
  let upward = true;
  for (let col = size - 1; col >= 0; col -= 2) {
    if (col === 6) col = 5; // 타이밍 패턴 건너뛰기
    const rows = upward ? Array.from({ length: size }, (_, i) => size - 1 - i) : Array.from({ length: size }, (_, i) => i);
    for (const row of rows) {
      for (const c of [col, col - 1]) {
        if (c < 0 || reserved[row][c]) continue;
        matrix[row][c] = bitIdx < bits.length && bits[bitIdx] ? 1 : 2;
        bitIdx++;
      }
    }
    upward = !upward;
  }
}

// ─── 마스크 패턴 ────────────────────────────────────────────
const MASK_FUNCS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function applyMask(matrix, reserved, size, maskIdx) {
  const m = matrix.map((row) => row.slice());
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (reserved[r][c]) continue;
      if (MASK_FUNCS[maskIdx](r, c)) {
        m[r][c] = m[r][c] === 1 ? 2 : 1;
      }
    }
  }
  return m;
}

// ─── 포맷 정보 ──────────────────────────────────────────────
// Error correction level M = 0, mask pattern = maskIdx
function getFormatBits(maskIdx) {
  // Level M = 00, mask 3 bits → 5비트 데이터
  const data = (0b00 << 3) | maskIdx;
  // BCH(15,5) 인코딩
  let rem = data << 10;
  const gen = 0b10100110111;
  for (let i = 14; i >= 10; i--) {
    if (rem & (1 << i)) rem ^= gen << (i - 10);
  }
  const format = ((data << 10) | rem) ^ 0b101010000010010;
  return format;
}

function placeFormatInfo(matrix, size, maskIdx) {
  const bits = getFormatBits(maskIdx);
  // 좌상단 주변
  const pos1 = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  // 우상단 + 좌하단
  const pos2 = [
    [8, size - 1], [8, size - 2], [8, size - 3], [8, size - 4],
    [8, size - 5], [8, size - 6], [8, size - 7], [8, size - 8],
    [size - 7, 8], [size - 6, 8], [size - 5, 8], [size - 4, 8],
    [size - 3, 8], [size - 2, 8], [size - 1, 8],
  ];

  for (let i = 0; i < 15; i++) {
    const val = (bits >> i) & 1 ? 1 : 2;
    const [r1, c1] = pos1[i];
    matrix[r1][c1] = val;
    const [r2, c2] = pos2[i];
    matrix[r2][c2] = val;
  }
}

// ─── 페널티 점수 계산 ───────────────────────────────────────
function penalty(matrix, size) {
  let score = 0;
  // Rule 1: 연속 5개 이상 같은 색
  for (let r = 0; r < size; r++) {
    let count = 1;
    for (let c = 1; c < size; c++) {
      if (matrix[r][c] === matrix[r][c - 1]) { count++; }
      else { if (count >= 5) score += count - 2; count = 1; }
    }
    if (count >= 5) score += count - 2;
  }
  for (let c = 0; c < size; c++) {
    let count = 1;
    for (let r = 1; r < size; r++) {
      if (matrix[r][c] === matrix[r - 1][c]) { count++; }
      else { if (count >= 5) score += count - 2; count = 1; }
    }
    if (count >= 5) score += count - 2;
  }
  return score;
}

// ─── 최종 QR 생성 ───────────────────────────────────────────
function generateQR(text) {
  const { ver, mode } = chooseVersion(text);
  const data = encodeData(text, ver, mode);
  const codewords = generateCodewords(data, ver);
  const { matrix, reserved, size } = createMatrix(ver);
  placeData(matrix, reserved, size, codewords);

  // 최적 마스크 선택
  let bestMask = 0, bestScore = Infinity;
  for (let m = 0; m < 8; m++) {
    const masked = applyMask(matrix, reserved, size, m);
    placeFormatInfo(masked, size, m);
    const s = penalty(masked, size);
    if (s < bestScore) { bestScore = s; bestMask = m; }
  }

  const final = applyMask(matrix, reserved, size, bestMask);
  placeFormatInfo(final, size, bestMask);

  return { modules: final, size };
}

// ─── Canvas → Data URL ──────────────────────────────────────
export function generateQRDataURL(text, pixelSize = 256) {
  const { modules, size } = generateQR(text);
  const scale = Math.floor(pixelSize / (size + 8)); // quiet zone 4 each side
  const imgSize = (size + 8) * scale;

  const canvas = document.createElement("canvas");
  canvas.width = imgSize;
  canvas.height = imgSize;
  const ctx = canvas.getContext("2d");

  // 흰 배경
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, imgSize, imgSize);

  // 모듈 그리기
  ctx.fillStyle = "#000000";
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (modules[r][c] === 1) {
        ctx.fillRect((c + 4) * scale, (r + 4) * scale, scale, scale);
      }
    }
  }

  return canvas.toDataURL("image/png");
}

// ─── SVG 문자열 생성 (SSR 호환) ─────────────────────────────
export function generateQRSVG(text, pixelSize = 256) {
  const { modules, size } = generateQR(text);
  const scale = pixelSize / (size + 8);
  const imgSize = pixelSize;

  let paths = "";
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (modules[r][c] === 1) {
        const x = ((c + 4) * scale).toFixed(2);
        const y = ((r + 4) * scale).toFixed(2);
        const s = scale.toFixed(2);
        paths += `<rect x="${x}" y="${y}" width="${s}" height="${s}"/>`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${imgSize} ${imgSize}" width="${imgSize}" height="${imgSize}">
    <rect width="100%" height="100%" fill="white"/>
    <g fill="black">${paths}</g>
  </svg>`;
}
