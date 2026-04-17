# 🚀 오백원의 행복 — 배포 가이드

## 배포 구조

```
GitHub (main 브랜치) → GitHub Actions → Firebase Hosting → happy500.kr
```

---

## 최초 1회 세팅 (처음 배포 시)

### 1. Firebase CLI 설치 & 로그인
```bash
npm install -g firebase-tools
npm run firebase:login
```

### 2. GitHub Secrets 등록
GitHub 저장소 → Settings → Secrets and variables → Actions → New repository secret

등록할 항목:
| Secret 이름 | 값 |
|-------------|-----|
| `FIREBASE_SERVICE_ACCOUNT` | Firebase 서비스 계정 JSON (아래 설명 참고) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `.env.local` 값 복사 |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `.env.local` 값 복사 |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `.env.local` 값 복사 |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `.env.local` 값 복사 |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `.env.local` 값 복사 |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `.env.local` 값 복사 |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | `.env.local` 값 복사 |
| `NEXT_PUBLIC_KAKAO_MAP_KEY` | `.env.local` 값 복사 |
| `NEXT_PUBLIC_KAKAO_REST_API_KEY` | `.env.local` 값 복사 |
| `NEXT_PUBLIC_BASE_URL` | `https://happy500.kr` |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | `.env.local` 값 복사 |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | `.env.local` 값 복사 |

### 3. Firebase 서비스 계정 JSON 발급
1. [Firebase Console](https://console.firebase.google.com) → 프로젝트 설정
2. 서비스 계정 탭 → "새 비공개 키 생성"
3. 다운로드된 JSON 파일 전체 내용을 `FIREBASE_SERVICE_ACCOUNT` secret에 붙여넣기

---

## 배포 방법

### 방법 A — 자동 배포 (권장)
```bash
git add .
git commit -m "업데이트 내용"
git push origin main
```
→ GitHub Actions가 자동으로 빌드 & 배포 (약 2~3분 소요)

### 방법 B — 수동 배포 (터미널)
```bash
npm run deploy
```

### 방법 C — 미리보기 배포 (테스트용)
```bash
npm run deploy:preview
```
→ 7일간 유효한 미리보기 URL 생성 (실서버에 영향 없음)

---

## iOS 앱 배포 (App Store)

```bash
# 웹 빌드 후 iOS 동기화
npm run cap:sync

# Xcode 열기
npm run cap:open
```

Xcode에서 Archive → App Store Connect 업로드

---

## 도메인 연결 (happy500.kr)

Firebase Console → Hosting → 맞춤 도메인 추가 → `happy500.kr` 입력
DNS 설정에서 Firebase가 안내하는 A 레코드 추가

---

## 빌드 결과물

| 폴더 | 용도 |
|------|------|
| `out/` | Next.js 정적 빌드 결과 (Firebase Hosting에 올라가는 파일) |
| `ios/` | Capacitor iOS 앱 |
| `.github/workflows/deploy.yml` | 자동 배포 설정 |
