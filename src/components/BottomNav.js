"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/",        icon: "🏠", label: "홈" },
  { href: "/map",     icon: "🗺️", label: "지도" },
  { href: "/ranking", icon: "🏆", label: "랭킹" },
  { href: "/history", icon: "📋", label: "기록" },
  { href: "/profile", icon: "👤", label: "내정보" },
];

export default function BottomNav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="flex">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center py-2 text-xs transition-colors ${
                isActive ? "text-green-600" : "text-gray-400"
              }`}
            >
              <span className="text-xl mb-0.5">{item.icon}</span>
              <span className={isActive ? "font-bold" : ""}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}