"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Lang } from "@/lib/i18n";
import { getInitialLang, setLang as setStoredLang, subscribeLang } from "@/lib/i18n";
import { brandByLang } from "@/lib/brand";
import { TOP_CATEGORIES, CATEGORY_CONFIG, type CategoryKey } from "@/lib/catalog";

type FlyoutItem = { label: string; href: string };
type FlyoutColumn = { title: string; items: FlyoutItem[] };
type NavFlyoutKey = CategoryKey;

function cx(...arr: Array<string | false | null | undefined>) {
  return arr.filter(Boolean).join(" ");
}

function flyoutTitles(lang: Lang) {
  if (lang === "zh") return { explore: "探索", forWho: "适合人群", more: "更多" };
  return { explore: "Explore", forWho: "For who", more: "More" };
}

function getFlyout(category: NavFlyoutKey, lang: Lang): FlyoutColumn[] {
  const t = flyoutTitles(lang);

  const routeDefs = CATEGORY_CONFIG[category].desktopRoutes;
  const splitIndex = Math.ceil(routeDefs.length / 2);
  const firstRoutes = routeDefs.slice(0, splitIndex);
  const secondRoutes = routeDefs.slice(splitIndex);

  return [
    {
      title: t.explore,
      items: firstRoutes.map((item) => ({
        label: item.title,
        href: `/c/${category}?focus=${encodeURIComponent(item.key)}`,
      })),
    },
    {
      title: lang === "zh" ? "矩阵分类" : "Matrix routes",
      items: secondRoutes.map((item) => ({
        label: item.title,
        href: `/c/${category}?focus=${encodeURIComponent(item.key)}`,
      })),
    },
    {
      title: t.more,
      items: [
        {
          label: lang === "zh" ? `查看全部${CATEGORY_CONFIG[category].zh}` : `View all ${CATEGORY_CONFIG[category].en}`,
          href: `/c/${category}`,
        },
        { label: lang === "zh" ? "管理控制台" : "Admin Console", href: "/auth" },
      ],
    },
  ];
}

export default function TopNav() {
  const [lang, setLangState] = useState<Lang>(() => getInitialLang());
  const brand = useMemo(() => brandByLang(lang), [lang]);

  useEffect(() => {
    return subscribeLang(() => setLangState(getInitialLang()));
  }, []);

  const [openKey, setOpenKey] = useState<NavFlyoutKey | null>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);

  const isOpen = openKey !== null;

  const [brokenLogoSrc, setBrokenLogoSrc] = useState<string | null>(null);
  const fallbackLogo =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" fill="rgba(0,0,0,.75)"/></svg>`
    );
  const logoSrc = brokenLogoSrc === brand.logoSrc ? fallbackLogo : brand.logoSrc;

  const flyout = useMemo(() => {
    if (!openKey) return null;
    return getFlyout(openKey, lang);
  }, [openKey, lang]);

  const clearTimers = useCallback(() => {
    if (openTimer.current) window.clearTimeout(openTimer.current);
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  }, []);

  function requestOpen(k: NavFlyoutKey) {
    clearTimers();
    openTimer.current = window.setTimeout(() => setOpenKey(k), 120);
  }

  function requestClose() {
    clearTimers();
    closeTimer.current = window.setTimeout(() => setOpenKey(null), 220);
  }

  const hardClose = useCallback(() => {
    clearTimers();
    setOpenKey(null);
  }, [clearTimers]);

  // ✅ 打开时只虚化 main
  useEffect(() => {
    const html = document.documentElement;
    if (isOpen) html.setAttribute("data-nav-open", "1");
    else html.removeAttribute("data-nav-open");
    return () => html.removeAttribute("data-nav-open");
  }, [isOpen]);

  // ESC 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hardClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hardClose]);

  const toggleLabel = lang === "zh" ? "EN" : "中文";
  const nextLang: Lang = lang === "zh" ? "en" : "zh";

  return (
    <>
      <div
        className={cx("nav-zone", isOpen && "nav-zone--open")}
        onPointerEnter={() => clearTimers()}
        onPointerLeave={() => requestClose()}
      >
        <header className="nav-bar" aria-label={lang === "zh" ? "主导航" : "Main navigation"}>
          <div className="nav-inner">
            <Link className="nav-logo" href="/" aria-label={brand.appName}>
              <Image
                src={logoSrc}
                alt={brand.logoAlt}
                width={18}
                height={18}
                priority
                draggable={false}
                onError={() => {
                  // 如果 logo 文件不存在，降级为内置圆点图标
                  setBrokenLogoSrc(brand.logoSrc);
                }}
              />
            </Link>

            <nav className="nav-links">
              {TOP_CATEGORIES.map((k) => (
                <Link
                  key={k}
                  href={`/c/${k}`}
                  className={cx("nav-item", openKey === k && "nav-item-active")}
                  onPointerEnter={() => requestOpen(k)}
                >
                  {lang === "zh" ? CATEGORY_CONFIG[k].zh : CATEGORY_CONFIG[k].en}
                </Link>
              ))}

              <Link href="/auth" className="nav-item" onPointerEnter={() => requestClose()}>
                {lang === "zh" ? "管理控制台" : "Admin"}
              </Link>
            </nav>

            {/* ✅ 右侧：必须与 nav-item 同一高度节奏（44px），垂直居中 */}
            <div className="nav-right">
              <button
                type="button"
                className="nav-lang"
                aria-label={lang === "zh" ? "切换为英文" : "Switch to Chinese"}
                onClick={() => {
                  setStoredLang(nextLang);
                  setLangState(nextLang);
                }}
              >
                {toggleLabel}
              </button>
            </div>
          </div>
        </header>

        <div className={cx("flyout", isOpen && "flyout--open")} aria-hidden={!isOpen}>
          <div className="flyout-bridge" aria-hidden="true" />
          <div className="flyout-inner">
            {flyout?.map((col) => (
              <div key={col.title} className="flyout-col">
                <div className="flyout-title">{col.title}</div>
                <ul className="flyout-list">
                  {col.items.map((it) => (
                    <li key={it.label} className="flyout-li">
                      <Link className="flyout-link" href={it.href}>
                        {it.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div className="flyout-foot">{brand.heroSubline}</div>
          </div>
        </div>
      </div>

      {isOpen && (
        <button
          className="nav-scrim"
          aria-label={lang === "zh" ? "关闭导航" : "Close navigation"}
          onClick={hardClose}
        />
      )}
    </>
  );
}
