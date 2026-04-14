#!/usr/bin/env node
/**
 * 버전 업그레이드 스크립트
 * 사용법: node scripts/version.js "수정내용1" "수정내용2" ...
 * 예시:  node scripts/version.js "쇼츠 비율 영상 적용" "앱 새로고침 버튼 추가"
 */

const fs   = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const EMOJIS = ["🚀", "✨", "🛠️", "⚡", "📱", "🌿", "💡", "🔧", "🎯", "🏆"];

// ── 인자 확인 ──────────────────────────────────────────────
const items = process.argv.slice(2);
if (items.length === 0) {
  console.error("❌ 수정 내용을 입력해주세요.");
  console.error('   예시: node scripts/version.js "기능 추가" "버그 수정"');
  process.exit(1);
}

// ── version.json 읽기 ──────────────────────────────────────
const versionPath = path.join(__dirname, "../src/lib/version.json");
const data = JSON.parse(fs.readFileSync(versionPath, "utf8"));

// ── 버전 번호 올리기 (v1.21 → v1.22) ──────────────────────
const currentBuild = data.build;
const newBuild     = currentBuild + 1;
const newVersion   = `v1.${String(newBuild).padStart(2, "0")}`;

// ── 오늘 날짜 ──────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10);

// ── 랜덤 이모지 선택 ───────────────────────────────────────
const emoji = EMOJIS[newBuild % EMOJIS.length];

// ── 제목: 첫 번째 항목을 제목으로 사용 ────────────────────
const title = items[0];

// ── 새 changelog 항목 구성 ─────────────────────────────────
const newEntry = {
  version: newVersion,
  build:   newBuild,
  date:    today,
  emoji,
  title,
  items,
};

// ── version.json 업데이트 ──────────────────────────────────
data.version = newVersion;
data.build   = newBuild;
data.changelog.unshift(newEntry); // 맨 앞에 추가

fs.writeFileSync(versionPath, JSON.stringify(data, null, 2) + "\n", "utf8");
console.log(`✅ version.json 업데이트 완료: ${newVersion}`);

// ── git 락 파일 자동 정리 ──────────────────────────────────
["HEAD.lock", "index.lock"].forEach((f) => {
  const lockPath = path.join(__dirname, `../.git/${f}`);
  try { fs.unlinkSync(lockPath); } catch {}
});

// ── git add / commit (push는 감독님 터미널에서 git push) ───
try {
  execSync("git add .", { stdio: "inherit" });
  execSync(`git commit -m "${newVersion} - ${title}"`, { stdio: "inherit" });
  console.log(`✅ 커밋 완료! 이제 터미널에서 git push 를 실행해 배포하세요.`);
} catch (e) {
  console.error("❌ git 오류:", e.message);
  process.exit(1);
}
