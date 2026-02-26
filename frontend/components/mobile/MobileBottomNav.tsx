"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { key: "home", label: "为你推荐", href: "/m", icon: "✦" },
  { key: "choose", label: "开始选择", href: "/m/choose", icon: "◉" },
  { key: "compare", label: "豆包比对", href: "/m/compare", icon: "◇" },
  { key: "bag", label: "购物袋", href: "/m/bag", icon: "◍" },
] as const;

function active(pathname: string, href: string): boolean {
  if (href === "/m") return pathname === "/m";
  return pathname.startsWith(href);
}

export default function MobileBottomNav() {
  const pathname = usePathname() || "/m";

  return (
    <nav className="fixed inset-x-0 bottom-2 z-[60] px-4 pb-[max(env(safe-area-inset-bottom),0px)]">
      <div className="mx-auto flex h-16 max-w-[680px] items-center rounded-[22px] border border-black/10 bg-white/82 px-2 shadow-[0_8px_24px_rgba(0,0,0,0.08)] backdrop-blur-xl">
        {ITEMS.map((item) => {
          const isActive = active(pathname, item.href);
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex h-full min-w-0 flex-1 flex-col items-center justify-center rounded-2xl transition-colors ${
                isActive
                  ? "bg-[#0071e3]/12 text-[#0071e3]"
                  : "text-black/62 active:bg-black/[0.04] active:text-black/78"
              }`}
            >
              <span className="text-[15px] leading-none">{item.icon}</span>
              <span className={`mt-1 text-[12px] leading-none ${isActive ? "font-semibold" : "font-medium"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
