"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import { BRAND } from "@/lib/brand";
import { TOP_CATEGORIES, CATEGORY_CONFIG, type CategoryKey } from "@/lib/catalog";
import { getInitialLang, setLang, type Lang, subscribeLang } from "@/lib/i18n";

type FlyoutColumn = {
  title: "Explore" | "For" | "More";
  items: { label: string; href: string }[];
};

function cx(...arr: Array<string | false | undefined | null>) {
  return arr.filter(Boolean).join(" ");
}

function getFlyout(category: CategoryKey): FlyoutColumn[] {
  if (category === "shampoo") {
    return [
      {
        title: "Explore",
        items: [
          { label: "控油清爽", href: "/c/shampoo" },
          { label: "去屑止痒", href: "/c/shampoo" },
          { label: "修护受损", href: "/c/shampoo" },
          { label: "蓬松丰盈", href: "/c/shampoo" },
        ],
      },
      {
        title: "For",
        items: [
          { label: "油性头皮", href: "/c/shampoo" },
          { label: "敏感头皮", href: "/c/shampoo" },
          { label: "染烫受损", href: "/c/shampoo" },
        ],
      },
      {
        title: "More",
        items: [
          { label: "Ingredients & Formulas", href: "/compare" },
          { label: "How to choose shampoo", href: "/c/shampoo" },
        ],
      },
    ];
  }

  if (category === "bodywash") {
    return [
      {
        title: "Explore",
        items: [
          { label: "清爽不假滑", href: "/c/bodywash" },
          { label: "温和无刺激", href: "/c/bodywash" },
          { label: "留香高级", href: "/c/bodywash" },
          { label: "敏感肌可用", href: "/c/bodywash" },
        ],
      },
      {
        title: "For",
        items: [
          { label: "干皮", href: "/c/bodywash" },
          { label: "油皮", href: "/c/bodywash" },
          { label: "敏感肌", href: "/c/bodywash" },
        ],
      },
      {
        title: "More",
        items: [
          { label: "How to pick a scent", href: "/c/bodywash" },
          { label: "Common mistakes", href: "/c/bodywash" },
        ],
      },
    ];
  }

  if (category === "conditioner") {
    return [
      {
        title: "Explore",
        items: [
          { label: "柔顺抗毛躁", href: "/c/conditioner" },
          { label: "修护断裂", href: "/c/conditioner" },
          { label: "轻盈不塌", href: "/c/conditioner" },
        ],
      },
      {
        title: "For",
        items: [
          { label: "细软发", href: "/c/conditioner" },
          { label: "漂染发", href: "/c/conditioner" },
          { label: "干枯分叉", href: "/c/conditioner" },
        ],
      },
      {
        title: "More",
        items: [
          { label: "Conditioner vs hair mask", href: "/c/conditioner" },
          { label: "How long to leave it", href: "/c/conditioner" },
        ],
      },
    ];
  }

  return [
    { title: "Explore", items: [{ label: `查看${CATEGORY_CONFIG[category].zh}`, href: `/c/${category}` }] },
    { title: "For", items: [{ label: "适合人群 / 肤质 / 发质", href: `/c/${category}` }] },
    { title: "More", items: [{ label: "横向对比", href: "/compare" }] },
  ];
}

function NavLink({
  href,
  children,
  onEnter,
}: {
  href: string;
  children: React.ReactNode;
  onEnter?: () => void;
}) {
  return (
    <Link
      href={href}
      onPointerEnter={onEnter}
      className={cx(
        "text-[12px] font-medium tracking-[0.02em] leading-[44px]",
        "text-black/80 hover:text-black/95",
        "transition-opacity duration-200 ease-out hover:opacity-90 active:opacity-80",
        "px-2 rounded-full hover:bg-black/[0.04]"
      )}
    >
      {children}
    </Link>
  );
}

function LangToggle({ lang }: { lang: Lang }) {
  return (
    <button
      type="button"
      onClick={() => setLang(lang === "zh" ? "en" : "zh")}
      className={cx(
        "text-[12px] font-medium tracking-[0.02em]",
        "px-2 h-7 rounded-full",
        "text-black/75 hover:text-black/90",
        "hover:bg-black/[0.04] transition-colors"
      )}
      aria-label="Toggle language"
      title="Toggle language"
    >
      {lang === "zh" ? "CN" : "EN"}
    </button>
  );
}

export default function AppleNav() {
  const [openKey, setOpenKey] = useState<CategoryKey | null>(null);
  const [lang, setLangState] = useState<Lang>(() => getInitialLang());

  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);

  const isOpen = openKey !== null;

  const flyout = useMemo(() => {
    if (!openKey) return null;
    return getFlyout(openKey);
  }, [openKey]);

  function clearTimers() {
    if (openTimer.current) window.clearTimeout(openTimer.current);
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  }

  function requestOpen(k: CategoryKey) {
    clearTimers();
    openTimer.current = window.setTimeout(() => setOpenKey(k), 120);
  }

  function requestClose() {
    clearTimers();
    closeTimer.current = window.setTimeout(() => setOpenKey(null), 220);
  }

  function onHeaderEnter() {
    clearTimers();
  }
  function onHeaderLeave() {
    requestClose();
  }

  // broadcast for Hero (fade/shift)
  useEffect(() => {
    const root = document.documentElement;
    if (isOpen) root.dataset.navOpen = "1";
    else delete root.dataset.navOpen;

    if (openKey) root.dataset.navKey = openKey;
    else delete root.dataset.navKey;

    window.dispatchEvent(new CustomEvent("matchup:nav", { detail: { open: isOpen, key: openKey } }));
  }, [isOpen, openKey]);

  useEffect(() => {
    return subscribeLang(() => setLangState(getInitialLang()));
  }, []);

  const appName = lang === "zh" ? BRAND.appNameZh : BRAND.appNameEn;

  return (
    <header className="sticky top-0 z-50" onPointerEnter={onHeaderEnter} onPointerLeave={onHeaderLeave}>
      <div className="h-11 border-b border-black/[0.06] bg-[#f5f5f7]/85 backdrop-blur supports-[backdrop-filter]:bg-[#f5f5f7]/75">
        <div className="mx-auto flex h-11 max-w-[1024px] items-center justify-between px-5">
          <Link
            href="/"
            className="flex items-center gap-2 opacity-90 hover:opacity-100 transition-opacity duration-200"
            aria-label={appName}
            onPointerEnter={requestClose}
          >
            <Image src="/brand/logo.png" alt={appName} width={18} height={18} priority />
            <span className="text-[12px] font-semibold tracking-[0.02em] text-black/85">{appName}</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {TOP_CATEGORIES.map((k) => (
              <NavLink key={k} href={`/c/${k}`} onEnter={() => requestOpen(k)}>
                {CATEGORY_CONFIG[k].zh}
              </NavLink>
            ))}
            <NavLink href="/compare" onEnter={requestClose}>
              横向对比
            </NavLink>
          </nav>

          <div className="flex items-center gap-2 w-[84px] md:w-[120px] justify-end">
            <LangToggle lang={lang} />
          </div>
        </div>
      </div>

      <div
        className={cx(
          "overflow-hidden",
          "bg-[#f5f5f7]/95 backdrop-blur",
          "transition-[max-height,opacity,transform] duration-200 ease-out",
          isOpen ? "max-h-[320px] opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-1"
        )}
        aria-hidden={!isOpen}
      >
        <div className="mx-auto max-w-[1024px] px-5">
          <div className="pt-6 pb-7">
            <div className="grid grid-cols-3 gap-10">
              {flyout?.map((col) => (
                <div key={col.title}>
                  <div className="text-[12px] tracking-[0.04em] text-black/45">{col.title}</div>
                  <div className="mt-4 flex flex-col gap-3">
                    {col.items.map((it) => (
                      <Link
                        key={it.label}
                        href={it.href}
                        onClick={() => setOpenKey(null)}
                        className={cx(
                          "text-[14px] md:text-[15px]",
                          "font-semibold tracking-[-0.01em]",
                          "text-black/88 hover:text-black",
                          "transition-opacity duration-150",
                          "hover:opacity-95 active:opacity-85"
                        )}
                      >
                        {it.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="h-px bg-black/[0.06]" />
        </div>
      </div>
    </header>
  );
}
