"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

function NavIcon({ name }: { name: "features" | "history" | "bag" }) {
  if (name === "features") return <span className="m-nav-features-icon" aria-hidden="true" />;
  if (name === "history") return <span className="m-nav-history-icon" aria-hidden="true" />;
  return <span className="m-nav-bag-icon" aria-hidden="true" />;
}

export default function MobileBottomNav() {
  const pathname = usePathname() || "/m/choose";
  const [chromeBottomInset, setChromeBottomInset] = useState(0);

  const featuresActive = !pathname.startsWith("/m/me") && !pathname.startsWith("/m/bag");
  const useActive = pathname === "/m/me" || pathname.startsWith("/m/me/use");
  const historyActive = pathname.startsWith("/m/me/history");
  const bagActive = pathname.startsWith("/m/me/bag") || pathname.startsWith("/m/bag");

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
        <Link
          href="/m/choose"
          className={`m-pressable m-bottom-dock flex h-[60px] w-[104px] shrink-0 items-center justify-center gap-1.5 rounded-[30px] border border-[color:var(--m-nav-border)] px-3 shadow-[0_14px_34px_rgba(0,0,0,0.26)] ${
            featuresActive
              ? "bg-[color:var(--m-nav-active-bg)] text-[color:var(--m-nav-active-text)]"
              : "bg-[color:var(--m-nav-bg)] text-[color:var(--m-nav-text-strong)] active:bg-[color:var(--m-nav-item-active-bg)]"
          }`}
        >
          <NavIcon name="features" />
          <span className={`text-[14px] leading-none ${featuresActive ? "font-semibold" : "font-medium"}`}>功能</span>
        </Link>

        <div className="m-bottom-dock flex h-[60px] min-w-0 flex-1 items-center rounded-[30px] border border-[color:var(--m-nav-border)] bg-[color:var(--m-nav-bg)] px-1.5 shadow-[0_14px_34px_rgba(0,0,0,0.26)]">
          <Link
            href="/m/me/use"
            className={`m-pressable flex h-[52px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[24px] transition-colors ${
              useActive
                ? "bg-[color:var(--m-nav-active-bg)] text-[color:var(--m-nav-active-text)]"
                : "text-[color:var(--m-nav-text)] active:bg-[color:var(--m-nav-item-active-bg)] active:text-[color:var(--m-nav-text-strong)]"
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.9" />
              <path d="M5.2 19.2a6.8 6.8 0 0 1 13.6 0" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
            </svg>
            <span className={`text-[13px] leading-none ${useActive ? "font-semibold" : "font-medium"}`}>在用</span>
          </Link>

          <Link
            href="/m/me/history"
            className={`m-pressable flex h-[52px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[24px] transition-colors ${
              historyActive
                ? "bg-[color:var(--m-nav-active-bg)] text-[color:var(--m-nav-active-text)]"
                : "text-[color:var(--m-nav-text)] active:bg-[color:var(--m-nav-item-active-bg)] active:text-[color:var(--m-nav-text-strong)]"
            }`}
          >
            <NavIcon name="history" />
            <span className={`text-[13px] leading-none ${historyActive ? "font-semibold" : "font-medium"}`}>历史</span>
          </Link>

          <Link
            href="/m/me/bag"
            className={`m-pressable flex h-[52px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[24px] transition-colors ${
              bagActive
                ? "bg-[color:var(--m-nav-active-bg)] text-[color:var(--m-nav-active-text)]"
                : "text-[color:var(--m-nav-text)] active:bg-[color:var(--m-nav-item-active-bg)] active:text-[color:var(--m-nav-text-strong)]"
            }`}
          >
            <NavIcon name="bag" />
            <span className={`text-[13px] leading-none ${bagActive ? "font-semibold" : "font-medium"}`}>购物袋</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
