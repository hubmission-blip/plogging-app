/** @type {import('next').NextConfig} */

// Capacitor iOS 빌드용 정적 export 여부
// 일반 배포(Vercel): BUILD_TARGET 없음 → API routes 포함 풀 빌드
// iOS 앱 빌드:        BUILD_TARGET=capacitor → 정적 export (out/ 폴더)
const isCapacitorBuild = process.env.BUILD_TARGET === 'capacitor';

const nextConfig = {
  // Capacitor 빌드일 때만 정적 export
  ...(isCapacitorBuild && {
    output: 'export',
    trailingSlash: true,
  }),

  images: {
    unoptimized: true,
  },
};

export default nextConfig;
