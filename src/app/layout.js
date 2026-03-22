import PushNotification from "@/components/PushNotification";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import BottomNav from "@/components/BottomNav";
import Script from "next/script";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata = {
  title: "오백원의 행복",
  description: "즐거운 플로깅, 깨끗한 지구 | 사단법인 국제청년환경연합회",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "오백원의 행복",
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

        {/* ✅ Script 태그: 순수 JS만 사용 (useEffect 금지) */}
        <Script
          id="sw-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ("serviceWorker" in navigator) {
                navigator.serviceWorker.register("/sw.js").then(function(registration) {
                  console.log("✅ SW 등록:", registration.scope);

                  registration.addEventListener("updatefound", function() {
                    var newWorker = registration.installing;
                    newWorker.addEventListener("statechange", function() {
                      if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                        console.log("🔄 새 버전 감지 - 자동 업데이트");
                        newWorker.postMessage({ type: "SKIP_WAITING" });
                        window.location.reload();
                      }
                    });
                  });
                }).catch(function(err) {
                  console.error("❌ SW 등록 실패:", err);
                });
              }
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