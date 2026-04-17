import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'kr.happy500.app',
  appName: '오백원의 행복',
  webDir: 'out',

  server: {
    // ✅ 라이브 웹사이트를 WKWebView에서 직접 로드
    //    웹앱과 iOS앱이 항상 동일한 최신 콘텐츠
    url: 'https://happy500.kr',
    // ✅ 모든 외부 URL을 WebView 안에서 처리 (Safari로 안 빠짐)
    allowNavigation: ['*'],
  },

  ios: {
    contentInset: 'automatic',
    webContentsDebuggingEnabled: true,
    // ✅ 기본 WKWebView UA 유지 + Safari 키워드 추가
    //    Google OAuth 임베디드 브라우저 차단 우회 & 카카오맵 타일 정상 로드
    appendUserAgent: 'Safari/604.1',
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      launchAutoHide: true,
      backgroundColor: '#f9fafb',
      showSpinner: false,
    },
  },
};

export default config;
