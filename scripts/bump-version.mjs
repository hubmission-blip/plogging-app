/**
 * ┌────────────────────────────────────────────────────────────┐
 * │  🔖 오백원의 행복 — 버전 업 스크립트                        │
 * │                                                            │
 * │  사용법:                                                    │
 * │  node scripts/bump-version.mjs "업데이트 제목" "내용1" "내용2" │
 * │                                                            │
 * │  예시:                                                      │
 * │  node scripts/bump-version.mjs "버그 수정" "로그인 오류 해결" "속도 개선" │
 * └────────────────────────────────────────────────────────────┘
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const versionFilePath = resolve(__dirname, "../src/lib/version.json");

// ── 인수 파싱 ─────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("\n❌ 사용법: node scripts/bump-version.mjs \"제목\" \"내용1\" \"내용2\" ...\n");
  console.error('   예시: node scripts/bump-version.mjs "UI 개선" "버튼 크기 조정" "색상 수정"\n');
  process.exit(1);
}

const title = args[0];
const items = args.slice(1);

// ── 현재 버전 읽기 ────────────────────────────────────────────
const data = JSON.parse(readFileSync(versionFilePath, "utf-8"));
const newBuild = data.build + 1;

// 버전 형식: v1.XX (두 자리, 05 → v1.05)
const major = 1;
const minor = String(newBuild).padStart(2, "0");
const newVersion = `v${major}.${minor}`;

// 오늘 날짜 (KST)
const today = new Date();
const kst = new Date(today.getTime() + 9 * 60 * 60 * 1000);
const dateStr = kst.toISOString().split("T")[0];

// 이모지 자동 선택 (빌드 번호 기반 순환)
const EMOJIS = ["🛠️","🚀","✨","🎯","🔧","💡","🌿","🏆","📱","⚡"];
const emoji  = EMOJIS[newBuild % EMOJIS.length];

// ── 새 항목 삽입 ─────────────────────────────────────────────
const newEntry = {
  version: newVersion,
  build:   newBuild,
  date:    dateStr,
  emoji,
  title,
  items,
};

data.version   = newVersion;
data.build     = newBuild;
data.changelog = [newEntry, ...data.changelog];

// ── 파일 저장 ─────────────────────────────────────────────────
writeFileSync(versionFilePath, JSON.stringify(data, null, 2) + "\n");

// ── 결과 출력 ─────────────────────────────────────────────────
console.log(`\n✅ 버전 업 완료!`);
console.log(`   ${data.changelog[1]?.version ?? "-"} → ${newVersion}`);
console.log(`   📅 ${dateStr}`);
console.log(`   ${emoji} ${title}`);
items.forEach((item) => console.log(`   · ${item}`));
console.log(`\n📄 src/lib/version.json 업데이트 완료\n`);
