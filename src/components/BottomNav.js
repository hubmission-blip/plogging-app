"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/",        icon: "🏠", label: "홈" },
  { href: "/map",     icon: "🗺️", label: "지도" },
  { href: "/ranking", icon: "🏆", label: "랭킹" },
  { href: "/history", icon: "📋", label: "기록" },
  { href: "/profile", icon: "👤", label: "내정보" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50 shadow-lg"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-stretch h-16">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors
                ${isActive ? "text-green-600" : "text-gray-400"}`}
            >
              <span className="text-xl leading-none">{item.icon}</span>
              <span
                className={`text-xs font-medium ${
                  isActive ? "text-green-600" : "text-gray-400"
                }`}
              >
                {item.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 w-1 h-1 rounded-full bg-green-500" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}