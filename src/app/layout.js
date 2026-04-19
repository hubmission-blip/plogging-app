import PushNotification from "@/components/PushNotification";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import BottomNav from "@/components/BottomNav";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",    // 폰트 로딩 전 시스템 폰트로 즉시 표시 (블로킹 방지)
  preload: false,     // Capacitor 환경에서 네트워크 preload 블로킹 방지
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

export const metadata = {
  title: "오백원의행복",
  description: "즐거운 플로깅, 깨끗한 지구 | 사단법인 국제청년환경연합회",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "오백원의행복", // ✅ 여기도 동일하게
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#22c55e",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="오백원의 행복" />
      </head>
      <body className="min-h-screen bg-gray-50">

        {/* ✅ 추천인 코드 캡처: URL ?ref= 파라미터 → localStorage (30일 보관) */}
        <Script
          id="referral-capture"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var params = new URLSearchParams(window.location.search);
                var ref = params.get('ref');
                if (ref && ref.length >= 6) {
                  var expires = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30일
                  localStorage.setItem('pending_referral', JSON.stringify({ code: ref, expires: expires }));
                  // URL에서 ref 파라미터 제거 (깔끔하게)
                  params.delete('ref');
                  var newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
                  window.history.replaceState({}, '', newUrl);
                }
              } catch(e) {}
            `,
          }}
        />

        {/* Service Worker: Capacitor(iOS 네이티브) 환경에서는 등록하지 않음
            WKWebView에서 SW가 모든 GET 요청을 가로채면 화이트 스크린 유발
            웹 브라우저(PWA)에서만 SW 활성화 */}
        <Script
          id="sw-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var isCapacitor = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
                if (isCapacitor && "serviceWorker" in navigator) {
                  navigator.serviceWorker.getRegistrations().then(function(regs) {
                    regs.forEach(function(r) { r.unregister(); });
                  });
                }
                if (!isCapacitor && "serviceWorker" in navigator) {
                  navigator.serviceWorker.register("/sw.js").then(function(registration) {
                    console.log("SW 등록:", registration.scope);
                    registration.addEventListener("updatefound", function() {
                      var newWorker = registration.installing;
                      newWorker.addEventListener("statechange", function() {
                        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                          newWorker.postMessage({ type: "SKIP_WAITING" });
                          window.location.reload();
                        }
                      });
                    });
                  }).catch(function(err) {
                    console.warn("SW 등록 실패:", err);
                  });
                }
              } catch(e) {}
            `,
          }}
        />

        <AuthProvider>
          <PushNotification />
          {children}
          <BottomNav />
        </AuthProvider>

      </body>
    </html>
  );
}