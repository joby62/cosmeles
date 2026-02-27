"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavKey = "wiki" | "choose" | "compare" | "bag";

const CATEGORY_TABS = [
  { prefix: "/m/shampoo", label: "洗发挑选", href: "/m/shampoo/start" },
  { prefix: "/m/bodywash", label: "沐浴挑选", href: "/m/bodywash/start" },
  { prefix: "/m/conditioner", label: "护发挑选", href: "/m/conditioner/start" },
  { prefix: "/m/lotion", label: "润肤挑选", href: "/m/lotion/start" },
  { prefix: "/m/cleanser", label: "洁面挑选", href: "/m/cleanser/start" },
] as const;

function getChooseItem(pathname: string) {
  const matched = CATEGORY_TABS.find((item) => pathname.startsWith(item.prefix));
  if (matched) {
    return { key: "choose" as const, label: matched.label, href: matched.href };
  }
  return { key: "choose" as const, label: "开始选择", href: "/m/choose" };
}

function isActive(pathname: string, key: NavKey): boolean {
  if (key === "wiki") return pathname.startsWith("/m/wiki");
  if (key === "choose") {
    return pathname.startsWith("/m/choose") || CATEGORY_TABS.some((item) => pathname.startsWith(item.prefix));
  }
  if (key === "compare") return pathname.startsWith("/m/compare");
  return pathname.startsWith("/m/bag");
}

function NavIcon({ name, active }: { name: NavKey; active: boolean }) {
  const cls = active ? "#0071e3" : "currentColor";

  if (name === "wiki") {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path d="M3.5 4.1A1.6 1.6 0 0 1 5.1 2.5h7.8v11.4H5.1a1.6 1.6 0 0 0-1.6 1.6V4.1Z" fill="none" stroke={cls} strokeWidth="1.4" />
        <path d="M5.9 5.6h4.9M5.9 8h4.9" fill="none" stroke={cls} strokeWidth="1.4" strokeLinecap="round" />
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
        <path d="M3.8 13.8h3.6V7.2H3.8v6.6Zm6.4 0h3.6V4.2h-3.6v9.6Z" fill="none" stroke={cls} strokeWidth="1.4" />
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
  const pathname = usePathname() || "/m/choose";
  const chooseItem = getChooseItem(pathname);
  const items = [
    { key: "wiki" as const, label: "成份百科", href: "/m/wiki" },
    chooseItem,
    { key: "compare" as const, label: "横向对比", href: "/m/compare" },
    { key: "bag" as const, label: "购物袋", href: "/m/bag" },
  ];

  const meActive = pathname.startsWith("/m/me");

  return (
    <nav className="fixed inset-x-0 bottom-2 z-[60] px-4 pb-[max(env(safe-area-inset-bottom),0px)]">
      <div className="mx-auto flex max-w-[680px] items-center gap-2.5">
        <div className="flex h-[64px] min-w-0 flex-1 items-center rounded-[32px] border border-black/[0.09] bg-white/84 px-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.11)] backdrop-blur-[20px]">
          {items.map((item) => {
            const active = isActive(pathname, item.key);
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex h-[56px] min-w-0 flex-1 flex-col items-center justify-center rounded-[24px] transition-colors ${
                  active ? "bg-[#0071e3]/14 text-[#0071e3]" : "text-black/64 active:bg-black/[0.045] active:text-black/80"
                }`}
              >
                <span className="leading-none">
                  <NavIcon name={item.key} active={active} />
                </span>
                <span className={`mt-1 text-[12px] leading-none ${active ? "font-semibold" : "font-medium"}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>

        <Link
          href="/m/me"
          aria-label="我的"
          className={`flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-full border border-black/[0.09] shadow-[0_10px_30px_rgba(0,0,0,0.11)] backdrop-blur-[20px] ${
            meActive ? "bg-[#0071e3]/14 text-[#0071e3]" : "bg-white/84 text-black/78 active:bg-white"
          }`}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.9" />
            <path d="M5.2 19.2a6.8 6.8 0 0 1 13.6 0" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
        </Link>
      </div>
    </nav>
  );
}
