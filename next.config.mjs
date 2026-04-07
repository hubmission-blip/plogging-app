/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // Firebase Auth 핸들러 경로를 happy500.kr에서 서빙
      // → 구글 로그인 팝업 주소창에 happy500.kr 표시
      {
        source: "/__/auth/:path*",
        destination: "https://plogging-app.firebaseapp.com/__/auth/:path*",
      },
      {
        source: "/__/firebase/:path*",
        destination: "https://plogging-app.firebaseapp.com/__/firebase/:path*",
      },
    ];
  },
};

export default nextConfig;
