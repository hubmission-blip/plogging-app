/**
 * 빌드 후 out/sw.js 의 CACHE_VERSION 을 현재 타임스탬프로 치환
 * deploy 스크립트에서 next build 직후, firebase deploy 직전에 실행
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const paths = [
  resolve(__dirname, "../out/sw.js"),
  resolve(__dirname, "../public/sw.js"),
];

const ts = Date.now().toString();

paths.forEach((p) => {
  if (!existsSync(p)) {
    console.log(`⚠️ ${p} 파일 없음 — 건너뜀`);
    return;
  }
  let code = readFileSync(p, "utf-8");
  // "__BUILD_TS__" 또는 기존 타임스탬프(숫자 10~13자리) 모두 교체
  code = code.replace(
    /const CACHE_VERSION = "[^"]*"/,
    `const CACHE_VERSION = "${ts}"`
  );
  writeFileSync(p, code);
  console.log(`✅ ${p} → CACHE_VERSION = "${ts}"`);
});

console.log(`\n📦 SW 타임스탬프 갱신 완료: ${ts}\n`);
