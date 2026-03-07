"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type NavKey = "wiki" | "choose" | "compare";

const CATEGORY_TABS = [
  { prefix: "/m/shampoo", label: "个性测配", href: "/m/shampoo/start" },
  { prefix: "/m/bodywash", label: "个性测配", href: "/m/bodywash/start" },
  { prefix: "/m/conditioner", label: "个性测配", href: "/m/conditioner/start" },
  { prefix: "/m/lotion", label: "个性测配", href: "/m/lotion/start" },
  { prefix: "/m/cleanser", label: "个性测配", href: "/m/cleanser/start" },
] as const;

function getChooseItem(pathname: string) {
  const matched = CATEGORY_TABS.find((item) => pathname.startsWith(item.prefix));
  if (matched) {
    return { key: "choose" as const, label: matched.label, href: matched.href };
  }
  return { key: "choose" as const, label: "个性测配", href: "/m/choose" };
}

function isActive(pathname: string, key: NavKey): boolean {
  if (key === "wiki") return pathname.startsWith("/m/wiki");
  if (key === "choose") {
    return pathname.startsWith("/m/choose") || CATEGORY_TABS.some((item) => pathname.startsWith(item.prefix));
  }
  return pathname.startsWith("/m/compare");
}

function NavIcon({ name }: { name: NavKey }) {
  if (name === "choose") {
    return <span className="m-nav-choose-icon" aria-hidden="true" />;
  }

  if (name === "compare") {
    return <span className="m-nav-compare-icon" aria-hidden="true" />;
  }

  return <span className="m-nav-wiki-icon" aria-hidden="true" />;
}

export default function MobileBottomNav() {
  const pathname = usePathname() || "/m/choose";
  const chooseItem = getChooseItem(pathname);
  const [chromeBottomInset, setChromeBottomInset] = useState(0);
  const items = [
    chooseItem,
    { key: "compare" as const, label: "横向对比", href: "/m/compare" },
    { key: "wiki" as const, label: "百科", href: "/m/wiki" },
  ];

  const meActive = pathname.startsWith("/m/me") || pathname.startsWith("/m/bag");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const applyContentInset = (inset: number) => {
      document.documentElement.style.setProperty("--m-chrome-bottom-inset", `${Math.max(0, inset)}px`);
    };

    if (!window.visualViewport) {
      applyContentInset(0);
      return;
    }

    const viewport = window.visualViewport;

    const updateInset = () => {
      const layoutHeight = window.innerHeight;
      const visibleBottom = viewport.height + viewport.offsetTop;
      const rawInset = Math.max(0, Math.round(layoutHeight - visibleBottom));
      // Limit browser chrome offset to avoid accidental jumps to mid-screen.
      const nextInset = Math.min(96, rawInset);
      setChromeBottomInset((prev) => (Math.abs(prev - nextInset) < 1 ? prev : nextInset));
      applyContentInset(nextInset);
    };

    updateInset();
    viewport.addEventListener("resize", updateInset);
    viewport.addEventListener("scroll", updateInset);
    window.addEventListener("resize", updateInset);
    window.addEventListener("orientationchange", updateInset);
    window.addEventListener("pageshow", updateInset);

    return () => {
      viewport.removeEventListener("resize", updateInset);
      viewport.removeEventListener("scroll", updateInset);
      window.removeEventListener("resize", updateInset);
      window.removeEventListener("orientationchange", updateInset);
      window.removeEventListener("pageshow", updateInset);
      applyContentInset(0);
    };
  }, []);

  return (
    <nav
      className="fixed inset-x-0 z-[60] px-4"
      style={{ bottom: `calc(12px + max(env(safe-area-inset-bottom), 0px) + ${chromeBottomInset}px)` }}
    >
      <div className="mx-auto flex max-w-[680px] items-center gap-2.5">
        <div
          className="m-bottom-dock flex h-[60px] min-w-0 flex-1 items-center rounded-[30px] border border-[color:var(--m-nav-border)] bg-[color:var(--m-nav-bg)] px-1.5 shadow-[0_14px_34px_rgba(0,0,0,0.26)]"
        >
          {items.map((item) => {
            const active = isActive(pathname, item.key);
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`m-pressable flex h-[52px] min-w-0 flex-1 flex-col items-center justify-center rounded-[24px] transition-colors ${
                  active
                    ? "bg-[color:var(--m-nav-active-bg)] text-[color:var(--m-nav-active-text)]"
                    : "text-[color:var(--m-nav-text)] active:bg-[color:var(--m-nav-item-active-bg)] active:text-[color:var(--m-nav-text-strong)]"
                }`}
              >
                <span className="leading-none">
                  <NavIcon name={item.key} />
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
          className={`m-pressable m-bottom-dock flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full shadow-[0_14px_34px_rgba(0,0,0,0.26)] ${
            meActive
              ? "border border-[color:var(--m-nav-border)] bg-[color:var(--m-nav-active-bg)] text-[color:var(--m-nav-active-text)]"
              : "border border-[color:var(--m-nav-border)] bg-[color:var(--m-nav-bg)] text-[color:var(--m-nav-text-strong)] active:bg-[color:var(--m-nav-item-active-bg)]"
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
