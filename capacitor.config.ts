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
    // ✅ WKWebView UA에 Safari 포함 → Google OAuth가 임베디드 브라우저로 차단 안 함
    overrideUserAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
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
