"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { key: "home", label: "为你推荐", href: "/m" },
  { key: "choose", label: "开始选择", href: "/m/choose" },
  { key: "compare", label: "豆包比对", href: "/m/compare" },
  { key: "bag", label: "购物袋", href: "/m/bag" },
] as const;

function active(pathname: string, href: string): boolean {
  if (href === "/m") return pathname === "/m";
  return pathname.startsWith(href);
}

function NavIcon({ name, active }: { name: (typeof ITEMS)[number]["key"]; active: boolean }) {
  const cls = active ? "#0071e3" : "currentColor";

  if (name === "home") {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path d="M4.2 9.5h9.6v5.1a1 1 0 0 1-1 1H5.2a1 1 0 0 1-1-1V9.5Z" fill="none" stroke={cls} strokeWidth="1.4" />
        <path d="m3.4 9.5 5.6-4.7 5.6 4.7" fill="none" stroke={cls} strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "choose") {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <rect x="2.5" y="3" width="13" height="12" rx="2.2" fill="none" stroke={cls} strokeWidth="1.4" />
        <path d="M5.5 6.2h7M5.5 9h7M5.5 11.8h4.3" fill="none" stroke={cls} strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "compare") {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path d="M4 14 9 4l5 10" fill="none" stroke={cls} strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M6.2 10h5.6" fill="none" stroke={cls} strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M4 6.8h10l-1.1 7.2H5.1L4 6.8Z" fill="none" stroke={cls} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M6.1 6.8V6a2.9 2.9 0 0 1 5.8 0v.8" fill="none" stroke={cls} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export default function MobileBottomNav() {
  const pathname = usePathname() || "/m";
  const aboutActive = pathname.startsWith("/m/about");

  return (
    <nav className="fixed inset-x-0 bottom-2 z-[60] px-4 pb-[max(env(safe-area-inset-bottom),0px)]">
      <div className="mx-auto flex max-w-[680px] items-center gap-2">
        <div className="flex h-16 min-w-0 flex-1 items-center rounded-[22px] border border-black/10 bg-white/82 px-2 shadow-[0_8px_24px_rgba(0,0,0,0.08)] backdrop-blur-xl">
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
                <span className="leading-none">
                  <NavIcon name={item.key} active={isActive} />
                </span>
                <span className={`mt-1 text-[12px] leading-none ${isActive ? "font-semibold" : "font-medium"}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>

        <Link
          href="/m/about"
          aria-label="关于我们"
          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-black/10 shadow-[0_8px_24px_rgba(0,0,0,0.08)] backdrop-blur-xl ${
            aboutActive ? "bg-[#0071e3]/12 text-[#0071e3]" : "bg-white/86 text-black/78 active:bg-white"
          }`}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="m15 15 4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </Link>
      </div>
    </nav>
  );
}
