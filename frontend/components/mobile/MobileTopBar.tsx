"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const MOBILE_TOPBAR_SLOGANS = [
  "予选 · 浴室里的最终答案",
  "省下挑花眼的时间，只留最合适的一件",
] as const;

function getSectionLabel(pathname: string | null): string {
  if (!pathname || pathname === "/m") return "个性测配";
  if (pathname.startsWith("/m/choose")) return "个性测配";
  if (pathname.startsWith("/m/wiki")) return "百科";
  if (pathname.startsWith("/m/shampoo")) return "洗发水";
  if (pathname.startsWith("/m/bodywash")) return "沐浴露";
  if (pathname.startsWith("/m/conditioner")) return "护发素";
  if (pathname.startsWith("/m/lotion")) return "润肤霜";
  if (pathname.startsWith("/m/cleanser")) return "洗面奶";
  if (pathname.startsWith("/m/compare")) return "横向对比";
  if (pathname.startsWith("/m/me/history")) return "历史";
  if (pathname.startsWith("/m/me/use")) return "在用";
  if (pathname.startsWith("/m/me/bag")) return "购物袋";
  if (pathname.startsWith("/m/bag")) return "购物袋";
  if (pathname.startsWith("/m/me")) return "在用";
  if (pathname.startsWith("/m/about")) return "关于";
  return "首页";
}

function getSloganLevel(pathname: string | null): number {
  if (!pathname || pathname === "/m" || pathname.startsWith("/m/choose")) return 0;

  if (
    pathname.startsWith("/m/shampoo/start") ||
    pathname.startsWith("/m/bodywash/start") ||
    pathname.startsWith("/m/conditioner/start") ||
    pathname.startsWith("/m/lotion/start") ||
    pathname.startsWith("/m/cleanser/start")
  ) {
    return 1;
  }

  if (
    pathname.startsWith("/m/shampoo/profile") ||
    pathname.startsWith("/m/bodywash/profile") ||
    pathname.startsWith("/m/conditioner/profile") ||
    pathname.startsWith("/m/lotion/profile") ||
    pathname.startsWith("/m/cleanser/profile")
  ) {
    return 2;
  }

  if (
    pathname.startsWith("/m/shampoo/result") ||
    pathname.startsWith("/m/shampoo/resolve") ||
    pathname.startsWith("/m/bodywash/result") ||
    pathname.startsWith("/m/bodywash/resolve") ||
    pathname.startsWith("/m/conditioner/result") ||
    pathname.startsWith("/m/conditioner/resolve") ||
    pathname.startsWith("/m/lotion/result") ||
    pathname.startsWith("/m/lotion/resolve") ||
    pathname.startsWith("/m/cleanser/result") ||
    pathname.startsWith("/m/cleanser/resolve")
  ) {
    return 3;
  }

  if (pathname === "/m/compare" || pathname.startsWith("/m/compare?")) return 0;
  if (pathname.startsWith("/m/compare/result/")) return 1;

  if (pathname === "/m/wiki" || pathname.startsWith("/m/wiki?")) return 0;
  if (pathname.startsWith("/m/wiki/product/")) return 2;
  if (/^\/m\/wiki\/[^/]+\/[^/]+/.test(pathname)) return 2;
  if (/^\/m\/wiki\/[^/]+/.test(pathname)) return 1;

  if (pathname === "/m/me" || pathname.startsWith("/m/me/use")) return 0;
  if (pathname.startsWith("/m/me/history") || pathname.startsWith("/m/me/bag") || pathname.startsWith("/m/bag")) return 1;

  if (pathname.startsWith("/m/about")) return 1;

  return 0;
}

export default function MobileTopBar() {
  const pathname = usePathname();
  const section = getSectionLabel(pathname);
  const wikiPath = Boolean(pathname?.startsWith("/m/wiki"));
  const topbarSlogan = MOBILE_TOPBAR_SLOGANS[getSloganLevel(pathname) % 2];
  const logoCandidates = [
    "/brand/logo.svg?v=20260226",
    "/brand/logo.png?v=20260226",
    "/m/brand/logo.svg?v=20260226",
    "/m/brand/logo.png?v=20260226",
  ];
  const [logoIndex, setLogoIndex] = useState(0);
  const [logoHidden, setLogoHidden] = useState(false);
  const [inlineTitle, setInlineTitle] = useState("");
  const [collapseProgress, setCollapseProgress] = useState(0);
  const inlineTitleRef = useRef("");

  useEffect(() => {
    if (!wikiPath) {
      inlineTitleRef.current = "";
      return;
    }

    let rafId = 0;

    const measure = () => {
      rafId = 0;
      const titleEl = document.querySelector<HTMLElement>("[data-m-large-title]");
      if (!titleEl) {
        inlineTitleRef.current = "";
        setInlineTitle("");
        setCollapseProgress(0);
        return;
      }

      const nextTitle = (titleEl.getAttribute("data-m-large-title") || titleEl.textContent || "")
        .replace(/\s+/g, " ")
        .trim();
      if (nextTitle && nextTitle !== inlineTitleRef.current) {
        inlineTitleRef.current = nextTitle;
        setInlineTitle(nextTitle);
      }

      const rect = titleEl.getBoundingClientRect();
      const startY = 126;
      const endY = 70;
      const nextProgress = Math.max(0, Math.min(1, (startY - rect.top) / (startY - endY)));
      setCollapseProgress((prev) => (Math.abs(prev - nextProgress) < 0.02 ? prev : nextProgress));
    };

    const requestMeasure = () => {
      if (!rafId) {
        rafId = window.requestAnimationFrame(measure);
      }
    };

    requestMeasure();
    window.addEventListener("scroll", requestMeasure, { passive: true });
    window.addEventListener("resize", requestMeasure);
    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("scroll", requestMeasure);
      window.removeEventListener("resize", requestMeasure);
    };
  }, [wikiPath, pathname]);

  const centerTitleOpacity = wikiPath ? collapseProgress : 0;
  const sectionOpacity = wikiPath ? 1 - collapseProgress * 0.34 : 1;
  const sloganOpacity = wikiPath ? Math.max(0.26, 1 - collapseProgress * 1.18) : 1;
  const sloganOffset = wikiPath ? collapseProgress * 4 : 0;

  return (
    <div className="m-topbar-shell relative h-12 border-b border-[color:var(--m-topbar-border)] bg-[color:var(--m-topbar-bg)] supports-[backdrop-filter]:bg-[color:var(--m-topbar-bg-strong)]">
      {wikiPath ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-[92px]">
          <span
            className="line-clamp-1 w-full text-center text-[15px] font-semibold tracking-[0.004em] text-[color:var(--m-topbar-text)] transition-[opacity,transform] duration-200"
            style={{
              opacity: centerTitleOpacity,
              transform: `translateY(${(1 - centerTitleOpacity) * 6}px)`,
            }}
          >
            {inlineTitle || section}
          </span>
        </div>
      ) : null}

      <div className="mx-auto flex h-12 max-w-[680px] items-center justify-between px-4">
        <Link
          href="/m"
          className="m-pressable relative z-[1] inline-flex min-w-0 max-w-[52vw] items-center gap-0.5 rounded-full px-1 py-0.5 active:bg-[color:var(--m-press)]"
          style={{ opacity: sectionOpacity }}
        >
          {!logoHidden ? (
            <Image
              key={logoCandidates[Math.min(logoIndex, logoCandidates.length - 1)]}
              src={logoCandidates[Math.min(logoIndex, logoCandidates.length - 1)]}
              alt="予选"
              width={16}
              height={16}
              unoptimized
              onError={() => {
                if (logoIndex < logoCandidates.length - 1) {
                  setLogoIndex((n) => n + 1);
                  return;
                }
                setLogoHidden(true);
              }}
            />
          ) : null}
          <span className="text-[11px] leading-none text-[color:var(--m-topbar-dot)]">·</span>
          <span className="truncate text-[14px] font-semibold tracking-[0.005em] text-[color:var(--m-topbar-text)]">{section}</span>
        </Link>

        <p
          className="relative z-[1] max-w-[44vw] truncate text-right text-[11px] leading-none tracking-[0.01em] text-[color:var(--m-topbar-sub)] transition-[opacity,transform] duration-200 min-[430px]:max-w-[48vw] min-[430px]:text-[12px]"
          style={{
            opacity: sloganOpacity,
            transform: `translateY(${-sloganOffset}px)`,
          }}
        >
          {topbarSlogan}
        </p>
      </div>
    </div>
  );
}
