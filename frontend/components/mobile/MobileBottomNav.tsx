"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type DefaultNavKey = "wiki" | "choose" | "compare";

const CATEGORY_TABS = [
  { prefix: "/m/shampoo", label: "个性测配", href: "/m/shampoo/start" },
  { prefix: "/m/bodywash", label: "个性测配", href: "/m/bodywash/start" },
  { prefix: "/m/conditioner", label: "个性测配", href: "/m/conditioner/start" },
  { prefix: "/m/lotion", label: "个性测配", href: "/m/lotion/start" },
  { prefix: "/m/cleanser", label: "个性测配", href: "/m/cleanser/start" },
] as const;

const NAV_HIDE_THRESHOLD = 26;
const NAV_SHOW_THRESHOLD = 10;
const NAV_TOP_REVEAL = 8;
const NAV_BOTTOM_REVEAL = 12;
const SCROLLABLE_EPSILON = 6;
const MIN_SCROLL_DELTA = 0.6;
const MAX_DIRECTION_STEP = 30;
const SCROLL_IDLE_RESET_MS = 220;

function getChooseItem(pathname: string) {
  const matched = CATEGORY_TABS.find((item) => pathname.startsWith(item.prefix));
  if (matched) {
    return { key: "choose" as const, label: matched.label, href: matched.href };
  }
  return { key: "choose" as const, label: "个性测配", href: "/m/choose" };
}

function isDefaultActive(pathname: string, key: DefaultNavKey): boolean {
  if (key === "wiki") return pathname.startsWith("/m/wiki");
  if (key === "choose") {
    return pathname === "/m" || pathname.startsWith("/m/choose") || CATEGORY_TABS.some((item) => pathname.startsWith(item.prefix));
  }
  return pathname.startsWith("/m/compare");
}

function NavIcon({ name }: { name: "choose" | "compare" | "wiki" | "features" | "history" | "bag" }) {
  if (name === "choose") return <span className="m-nav-choose-icon" aria-hidden="true" />;
  if (name === "compare") return <span className="m-nav-compare-icon" aria-hidden="true" />;
  if (name === "features") return <span className="m-nav-features-icon" aria-hidden="true" />;
  if (name === "history") return <span className="m-nav-history-icon" aria-hidden="true" />;
  if (name === "bag") return <span className="m-nav-bag-icon" aria-hidden="true" />;
  return <span className="m-nav-wiki-icon" aria-hidden="true" />;
}

export default function MobileBottomNav() {
  const pathname = usePathname() || "/m/choose";
  const chooseItem = getChooseItem(pathname);
  const [chromeBottomInset, setChromeBottomInset] = useState(0);
  const [navVisible, setNavVisible] = useState(true);
  const [isScrollable, setIsScrollable] = useState(false);
  const navVisibleRef = useRef(true);
  const scrollableRef = useRef(false);
  const lastScrollYRef = useRef(0);
  const downDeltaRef = useRef(0);
  const upDeltaRef = useRef(0);
  const scrollIdleTimerRef = useRef<number | null>(null);

  const defaultItems = [
    chooseItem,
    { key: "compare" as const, label: "横向对比", href: "/m/compare" },
    { key: "wiki" as const, label: "百科", href: "/m/wiki" },
  ];
  const profileMode = pathname.startsWith("/m/me") || pathname.startsWith("/m/bag");
  const meActive = pathname.startsWith("/m/me");
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

  useEffect(() => {
    if (typeof window === "undefined") return;

    const setVisible = (next: boolean) => {
      if (navVisibleRef.current === next) return;
      navVisibleRef.current = next;
      setNavVisible(next);
    };

    const resetDirectionDeltas = () => {
      downDeltaRef.current = 0;
      upDeltaRef.current = 0;
    };

    const clearIdleTimer = () => {
      if (scrollIdleTimerRef.current !== null) {
        window.clearTimeout(scrollIdleTimerRef.current);
        scrollIdleTimerRef.current = null;
      }
    };

    const armIdleReset = () => {
      clearIdleTimer();
      scrollIdleTimerRef.current = window.setTimeout(() => {
        scrollIdleTimerRef.current = null;
        resetDirectionDeltas();
      }, SCROLL_IDLE_RESET_MS);
    };

    const setScrollableState = (next: boolean) => {
      if (scrollableRef.current !== next) {
        scrollableRef.current = next;
        setIsScrollable(next);
      }
      if (!next) {
        clearIdleTimer();
        resetDirectionDeltas();
        setVisible(true);
      }
    };

    const getScrollY = () => Math.max(0, window.scrollY || window.pageYOffset || 0);

    const evaluateScrollable = () => {
      const root = document.scrollingElement || document.documentElement;
      const nextScrollable = root.scrollHeight - root.clientHeight > SCROLLABLE_EPSILON;
      setScrollableState(nextScrollable);
    };

    const handleScroll = () => {
      const y = getScrollY();
      const delta = y - lastScrollYRef.current;
      lastScrollYRef.current = y;
      const root = document.scrollingElement || document.documentElement;
      const maxScrollY = Math.max(0, root.scrollHeight - root.clientHeight);

      if (y <= NAV_TOP_REVEAL || maxScrollY - y <= NAV_BOTTOM_REVEAL) {
        clearIdleTimer();
        resetDirectionDeltas();
        setVisible(true);
        return;
      }

      if (!scrollableRef.current) return;
      if (Math.abs(delta) < MIN_SCROLL_DELTA) return;
      armIdleReset();

      const step = Math.min(Math.abs(delta), MAX_DIRECTION_STEP);

      if (delta > 0) {
        downDeltaRef.current += step;
        upDeltaRef.current = 0;
        if (downDeltaRef.current >= NAV_HIDE_THRESHOLD) {
          downDeltaRef.current = 0;
          setVisible(false);
        }
        return;
      }

      upDeltaRef.current += step;
      downDeltaRef.current = 0;
      if (upDeltaRef.current >= NAV_SHOW_THRESHOLD) {
        upDeltaRef.current = 0;
        setVisible(true);
      }
    };

    let rafId = 0;
    const scheduleEvaluate = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        evaluateScrollable();
        handleScroll();
      });
    };

    lastScrollYRef.current = getScrollY();
    navVisibleRef.current = true;
    scheduleEvaluate();

    const scrollingRoot = document.scrollingElement || document.documentElement;
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(scheduleEvaluate);
      resizeObserver.observe(scrollingRoot);
      if (document.body && document.body !== scrollingRoot) {
        resizeObserver.observe(document.body);
      }
    }

    const viewport = window.visualViewport;
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", scheduleEvaluate);
    window.addEventListener("orientationchange", scheduleEvaluate);
    window.addEventListener("pageshow", scheduleEvaluate);
    window.addEventListener("load", scheduleEvaluate);
    viewport?.addEventListener("resize", scheduleEvaluate);
    viewport?.addEventListener("scroll", scheduleEvaluate);

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      clearIdleTimer();
      resizeObserver?.disconnect();
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", scheduleEvaluate);
      window.removeEventListener("orientationchange", scheduleEvaluate);
      window.removeEventListener("pageshow", scheduleEvaluate);
      window.removeEventListener("load", scheduleEvaluate);
      viewport?.removeEventListener("resize", scheduleEvaluate);
      viewport?.removeEventListener("scroll", scheduleEvaluate);
    };
  }, [pathname]);

  return (
    <nav
      className={`m-mobile-bottom-nav fixed inset-x-0 z-[60] px-4 ${
        !isScrollable || navVisible ? "m-mobile-bottom-nav-visible" : "m-mobile-bottom-nav-hidden"
      }`}
      style={{ bottom: `calc(12px + max(env(safe-area-inset-bottom), 0px) + ${chromeBottomInset}px)` }}
    >
      <div className="mx-auto max-w-[680px]">
        <div className="m-nav-stack relative h-[60px]" data-nav-mode={profileMode ? "profile" : "default"}>
          <div className="m-nav-mode-layer m-nav-mode-default">
            <div className="m-bottom-dock flex h-[60px] min-w-0 flex-1 items-center rounded-[30px] border border-[color:var(--m-nav-border)] bg-[color:var(--m-nav-bg)] px-1.5 shadow-[0_14px_34px_rgba(0,0,0,0.26)]">
              {defaultItems.map((item) => {
                const active = isDefaultActive(pathname, item.key);
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`m-pressable m-nav-item flex h-[52px] min-w-0 flex-1 flex-col items-center justify-center rounded-[24px] transition-colors ${
                      active
                        ? "m-nav-item-active bg-[color:var(--m-nav-active-bg)] text-[color:var(--m-nav-active-text)]"
                        : "text-[color:var(--m-nav-text)] active:bg-[color:var(--m-nav-item-active-bg)] active:text-[color:var(--m-nav-text-strong)]"
                    }`}
                  >
                    <span className="leading-none">
                      <NavIcon name={item.key} />
                    </span>
                    <span className={`m-nav-label mt-1 text-[12px] leading-none ${active ? "font-semibold" : "font-medium"}`}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>

            <Link
              href="/m/me/use"
              aria-label="我的"
              className={`m-pressable m-nav-item m-nav-me-trigger m-bottom-dock flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full border border-[color:var(--m-nav-border)] shadow-[0_14px_34px_rgba(0,0,0,0.26)] ${
                meActive
                  ? "m-nav-item-active bg-[color:var(--m-nav-active-bg)] text-[color:var(--m-nav-active-text)]"
                  : "bg-[color:var(--m-nav-bg)] text-[color:var(--m-nav-text-strong)] active:bg-[color:var(--m-nav-item-active-bg)]"
              }`}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.9" />
                <path d="M5.2 19.2a6.8 6.8 0 0 1 13.6 0" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
              </svg>
            </Link>
          </div>

          <div className="m-nav-mode-layer m-nav-mode-profile">
            <Link
              href="/m/choose"
              className="m-pressable m-nav-item m-nav-features-trigger m-bottom-dock flex h-[60px] w-[104px] shrink-0 items-center justify-center gap-1.5 rounded-[30px] border border-[color:var(--m-nav-border)] bg-[color:var(--m-nav-bg)] px-3 text-[color:var(--m-nav-text-strong)] shadow-[0_14px_34px_rgba(0,0,0,0.26)] active:bg-[color:var(--m-nav-item-active-bg)]"
            >
              <NavIcon name="features" />
              <span className="m-nav-label text-[14px] font-semibold leading-none">功能</span>
            </Link>

            <div className="m-bottom-dock flex h-[60px] min-w-0 flex-1 items-center rounded-[30px] border border-[color:var(--m-nav-border)] bg-[color:var(--m-nav-bg)] px-1.5 shadow-[0_14px_34px_rgba(0,0,0,0.26)]">
              <Link
                href="/m/me/use"
                className={`m-pressable m-nav-item flex h-[52px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[24px] transition-colors ${
                  useActive
                    ? "m-nav-item-active bg-[color:var(--m-nav-active-bg)] text-[color:var(--m-nav-active-text)]"
                    : "text-[color:var(--m-nav-text)] active:bg-[color:var(--m-nav-item-active-bg)] active:text-[color:var(--m-nav-text-strong)]"
                }`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.9" />
                  <path d="M5.2 19.2a6.8 6.8 0 0 1 13.6 0" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                </svg>
                <span className={`m-nav-label text-[13px] leading-none ${useActive ? "font-semibold" : "font-medium"}`}>在用</span>
              </Link>

              <Link
                href="/m/me/history"
                className={`m-pressable m-nav-item flex h-[52px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[24px] transition-colors ${
                  historyActive
                    ? "m-nav-item-active bg-[color:var(--m-nav-active-bg)] text-[color:var(--m-nav-active-text)]"
                    : "text-[color:var(--m-nav-text)] active:bg-[color:var(--m-nav-item-active-bg)] active:text-[color:var(--m-nav-text-strong)]"
                }`}
              >
                <NavIcon name="history" />
                <span className={`m-nav-label text-[13px] leading-none ${historyActive ? "font-semibold" : "font-medium"}`}>历史</span>
              </Link>

              <Link
                href="/m/me/bag"
                className={`m-pressable m-nav-item flex h-[52px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[24px] transition-colors ${
                  bagActive
                    ? "m-nav-item-active bg-[color:var(--m-nav-active-bg)] text-[color:var(--m-nav-active-text)]"
                    : "text-[color:var(--m-nav-text)] active:bg-[color:var(--m-nav-item-active-bg)] active:text-[color:var(--m-nav-text-strong)]"
                }`}
              >
                <NavIcon name="bag" />
                <span className={`m-nav-label text-[13px] leading-none ${bagActive ? "font-semibold" : "font-medium"}`}>购物袋</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
