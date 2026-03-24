/**
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │   🌿 오백원의 행복 - 17개 시도 랭킹 테스트 데이터 생성기             │
 * │   실행: node scripts/seed_ranking_test.mjs                          │
 * │   삭제: node scripts/seed_ranking_test.mjs --delete                 │
 * └─────────────────────────────────────────────────────────────────────┘
 */

import { initializeApp }                        from "firebase/app";
import { getAuth, signInWithEmailAndPassword,
         createUserWithEmailAndPassword }        from "firebase/auth";
import { getFirestore, collection, addDoc,
         getDocs, query, where, deleteDoc,
         doc, Timestamp }                        from "firebase/firestore";

// ─── Firebase 설정 (.env.local 기준) ─────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyAiMzLBPRanYMvcv0BFevRIAhTZmkwNcqs",
  authDomain:        "plogging-app.firebaseapp.com",
  projectId:         "plogging-app",
  storageBucket:     "plogging-app.firebasestorage.app",
  messagingSenderId: "348226144186",
  appId:             "1:348226144186:web:309eaaa640cbf8c5f43f83",
};

// ─── 테스트 계정 (자동 생성됨) ───────────────────────────────────────────
const TEST_EMAIL    = "seed_test@plogging-test.com";
const TEST_PASSWORD = "SeedTest2024!@#";

// ─── 17개 시도 중심 좌표 + 테스트 거리 설계 ───────────────────────────────
// totalKm = 이번 달 누적 시뮬레이션 (등급: S≥500 / A≥200 / B≥100 / C≥50 / D≥10 / -<10)
const REGIONS_TEST = [
  { code:"11", name:"서울",  lat:37.5665, lng:126.9780, totalKm: 520, routes: 12 }, // S🏆
  { code:"41", name:"경기",  lat:37.4138, lng:127.5183, totalKm: 310, routes:  9 }, // A🥇
  { code:"26", name:"부산",  lat:35.1796, lng:129.0756, totalKm: 220, routes:  7 }, // A🥇
  { code:"28", name:"인천",  lat:37.4563, lng:126.7052, totalKm: 145, routes:  6 }, // B🥈
  { code:"27", name:"대구",  lat:35.8714, lng:128.6014, totalKm: 115, routes:  5 }, // B🥈
  { code:"30", name:"대전",  lat:36.3504, lng:127.3845, totalKm:  78, routes:  4 }, // C🥉
  { code:"29", name:"광주",  lat:35.1595, lng:126.8526, totalKm:  62, routes:  3 }, // C🥉
  { code:"48", name:"경남",  lat:35.4606, lng:128.2132, totalKm:  54, routes:  3 }, // C🥉
  { code:"31", name:"울산",  lat:35.5384, lng:129.3114, totalKm:  35, routes:  2 }, // D🌱
  { code:"44", name:"충남",  lat:36.5184, lng:126.8000, totalKm:  28, routes:  2 }, // D🌱
  { code:"43", name:"충북",  lat:36.6357, lng:127.4912, totalKm:  22, routes:  2 }, // D🌱
  { code:"45", name:"전북",  lat:35.7175, lng:127.1530, totalKm:  18, routes:  2 }, // D🌱
  { code:"46", name:"전남",  lat:34.8679, lng:126.9910, totalKm:  13, routes:  1 }, // D🌱
  { code:"47", name:"경북",  lat:36.4919, lng:128.8889, totalKm:  11, routes:  1 }, // D🌱
  { code:"42", name:"강원",  lat:37.8228, lng:128.1555, totalKm:   7, routes:  1 }, // - 미활동
  { code:"36", name:"세종",  lat:36.4801, lng:127.2890, totalKm:   5, routes:  1 }, // - 미활동
  { code:"50", name:"제주",  lat:33.4996, lng:126.5312, totalKm:   3, routes:  1 }, // - 미활동
];

// 이번 달 내 랜덤 날짜 생성
function randomDateThisMonth() {
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return new Date(start.getTime() + Math.random() * (now.getTime() - start.getTime()));
}

// 중심 좌표 근처 ±0.008도 내 랜덤 경로 5포인트 생성
function makeCoords(lat, lng) {
  const spread = 0.008;
  return Array.from({ length: 5 }, () => ({
    lat: lat + (Math.random() - 0.5) * spread,
    lng: lng + (Math.random() - 0.5) * spread,
  }));
}

// epoch 기준 주차 번호 (routeUtils.js 와 동일 방식)
const WEEK_EPOCH_MS = new Date("2020-01-06T00:00:00+09:00").getTime();
function getWeekNumber(date) {
  return Math.floor((date.getTime() - WEEK_EPOCH_MS) / (7 * 24 * 60 * 60 * 1000));
}

// ─── 메인 실행 ────────────────────────────────────────────────────────────
async function main() {
  const isDelete = process.argv.includes("--delete");

  console.log("\n🌿 오백원의 행복 - 랭킹 테스트 데이터 생성기");
  console.log("────────────────────────────────────────────");

  const app  = initializeApp(FIREBASE_CONFIG);
  const auth = getAuth(app);
  const db   = getFirestore(app);

  // 로그인 (없으면 자동 생성)
  let user;
  try {
    const cred = await signInWithEmailAndPassword(auth, TEST_EMAIL, TEST_PASSWORD);
    user = cred.user;
    console.log(`✅ 로그인: ${TEST_EMAIL}`);
  } catch (e) {
    if (["auth/user-not-found","auth/invalid-credential","auth/invalid-login-credentials"].includes(e.code)) {
      console.log("⚙️  테스트 계정 생성 중...");
      const cred = await createUserWithEmailAndPassword(auth, TEST_EMAIL, TEST_PASSWORD);
      user = cred.user;
      console.log(`✅ 계정 생성 완료 (uid: ${user.uid})`);
    } else {
      throw e;
    }
  }

  // ── 삭제 모드 ─────────────────────────────────────────────────────────
  if (isDelete) {
    console.log("\n🗑️  테스트 데이터 삭제 중...");
    const snap = await getDocs(
      query(
        collection(db, "routes"),
        where("userId", "==", user.uid),
        where("isTestData", "==", true)
      )
    );
    for (const d of snap.docs) await deleteDoc(doc(db, "routes", d.id));
    console.log(`✅ ${snap.size}개 삭제 완료!\n`);
    process.exit(0);
  }

  // ── 생성 모드 ─────────────────────────────────────────────────────────
  // 기존 테스트 데이터 먼저 정리
  const existing = await getDocs(
    query(
      collection(db, "routes"),
      where("userId", "==", user.uid),
      where("isTestData", "==", true)
    )
  );
  if (existing.size > 0) {
    console.log(`\n🔄 기존 테스트 데이터 ${existing.size}개 삭제 후 재생성...`);
    for (const d of existing.docs) await deleteDoc(doc(db, "routes", d.id));
  }

  console.log("\n📝 17개 시도 테스트 데이터 생성 중...\n");
  let totalDocs = 0;

  for (const region of REGIONS_TEST) {
    const kmPerRoute = region.totalKm / region.routes;

    for (let i = 0; i < region.routes; i++) {
      const createdAt = randomDateThisMonth();
      const distance  = parseFloat(
        (kmPerRoute * (0.9 + Math.random() * 0.2)).toFixed(2)
      );
      const points    = Math.round(distance * 100);
      const expiresAt = new Date(createdAt.getTime() + 28 * 24 * 60 * 60 * 1000);

      await addDoc(collection(db, "routes"), {
        userId:     user.uid,
        regionCode: region.code,
        regionName: region.name,
        coords:     makeCoords(region.lat, region.lng),
        distance,
        points,
        weekNumber: getWeekNumber(createdAt),
        createdAt:  Timestamp.fromDate(createdAt),
        expiresAt:  Timestamp.fromDate(expiresAt),
        isTestData: true,          // ← 삭제 시 식별용
      });
      totalDocs++;
    }

    // 등급 표시
    const km = region.totalKm;
    const grade =
      km >= 500 ? "S 🏆" :
      km >= 200 ? "A 🥇" :
      km >= 100 ? "B 🥈" :
      km >=  50 ? "C 🥉" :
      km >=  10 ? "D 🌱" : "- (미활동)";

    console.log(
      `  [${region.code}] ${region.name.padEnd(3)}  ${grade.padEnd(8)}  ~${String(region.totalKm).padStart(3)}km  →  ${region.routes}개 문서`
    );
  }

  console.log(`\n✅ 완료! 총 ${totalDocs}개 routes 문서 생성됨`);
  console.log("🗑️  나중에 삭제: node scripts/seed_ranking_test.mjs --delete\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ 오류:", err.message || err);
  process.exit(1);
});
