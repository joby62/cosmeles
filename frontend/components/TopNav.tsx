"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Lang } from "@/lib/i18n";
import { useLang } from "@/lib/i18n";
import { brandByLang } from "@/lib/brand";
import { TOP_CATEGORIES, CATEGORY_CONFIG, type CategoryKey } from "@/lib/catalog";

type FlyoutItem = { label: string; href: string };
type FlyoutColumn = { title: string; items: FlyoutItem[] };

function cx(...arr: Array<string | false | null | undefined>) {
  return arr.filter(Boolean).join(" ");
}

function flyoutTitles(lang: Lang) {
  if (lang === "zh") return { explore: "探索", forWho: "适合人群", more: "更多" };
  return { explore: "Explore", forWho: "For who", more: "More" };
}

function getFlyout(category: CategoryKey, lang: Lang): FlyoutColumn[] {
  const t = flyoutTitles(lang);

  if (category === "shampoo") {
    return [
      {
        title: t.explore,
        items:
          lang === "zh"
            ? [
                { label: "控油清爽", href: "/c/shampoo" },
                { label: "去屑止痒", href: "/c/shampoo" },
                { label: "修护受损", href: "/c/shampoo" },
                { label: "蓬松丰盈", href: "/c/shampoo" },
              ]
            : [
                { label: "Oil control & fresh", href: "/c/shampoo" },
                { label: "Anti-dandruff & itch", href: "/c/shampoo" },
                { label: "Repair damaged hair", href: "/c/shampoo" },
                { label: "Volume & lift", href: "/c/shampoo" },
              ],
      },
      {
        title: t.forWho,
        items:
          lang === "zh"
            ? [
                { label: "油性头皮", href: "/c/shampoo" },
                { label: "敏感头皮", href: "/c/shampoo" },
                { label: "染烫受损", href: "/c/shampoo" },
              ]
            : [
                { label: "Oily scalp", href: "/c/shampoo" },
                { label: "Sensitive scalp", href: "/c/shampoo" },
                { label: "Colored & permed hair", href: "/c/shampoo" },
              ],
      },
      {
        title: t.more,
        items:
          lang === "zh"
            ? [
                { label: "成分与配方逻辑", href: "/compare" },
                { label: "如何选择洗发水", href: "/c/shampoo" },
              ]
            : [
                { label: "Ingredients & formulas", href: "/compare" },
                { label: "How to choose shampoo", href: "/c/shampoo" },
              ],
      },
    ];
  }

  // 其他品类：最小可用，保证 zh/en 都完整
  return [
    {
      title: t.explore,
      items: [
        {
          label:
            lang === "zh"
              ? `查看${CATEGORY_CONFIG[category].zh}`
              : `View ${CATEGORY_CONFIG[category].en}`,
          href: `/c/${category}`,
        },
      ],
    },
    {
      title: t.forWho,
      items: [
        {
          label: lang === "zh" ? "敏感 / 日常 / 长期" : "Sensitive / Daily / Long-term",
          href: `/c/${category}`,
        },
      ],
    },
    {
      title: t.more,
      items: [{ label: lang === "zh" ? "横向对比" : "Compare", href: "/compare" }],
    },
  ];
}

export default function TopNav() {
  const [lang, setLang] = useLang();
  const brand = useMemo(() => brandByLang(lang), [lang]);

  const [openKey, setOpenKey] = useState<CategoryKey | null>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);

  const isOpen = openKey !== null;

  // ✅ logo：先解决“挂掉”
  const [logoSrc, setLogoSrc] = useState<string>(brand.logoSrc);
  useEffect(() => setLogoSrc(brand.logoSrc), [brand.logoSrc]);

  const flyout = useMemo(() => {
    if (!openKey) return null;
    return getFlyout(openKey, lang);
  }, [openKey, lang]);

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

  function hardClose() {
    clearTimers();
    setOpenKey(null);
  }

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
  }, []);

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
                  // 最后兜底：如果 /logo.png 也不存在，避免显示坏图标
                  setLogoSrc(
                    "data:image/svg+xml;utf8," +
                      encodeURIComponent(
                        `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" fill="rgba(0,0,0,.75)"/></svg>`
                      )
                  );
                }}
              />
            </Link>

            <nav className="nav-links">
              {TOP_CATEGORIES.map((k) => (
                <Link
                  key={k}
                  href={`/${k}`}
                  className={cx("nav-item", openKey === k && "nav-item-active")}
                  onPointerEnter={() => requestOpen(k)}
                >
                  {lang === "zh" ? CATEGORY_CONFIG[k].zh : CATEGORY_CONFIG[k].en}
                </Link>
              ))}

              <Link href="/compare" className="nav-item" onPointerEnter={() => requestClose()}>
                {lang === "zh" ? "横向对比" : "Compare"}
              </Link>
            </nav>

            {/* ✅ 右侧：必须与 nav-item 同一高度节奏（44px），垂直居中 */}
            <div className="nav-right">
              <button
                type="button"
                className="nav-lang"
                aria-label={lang === "zh" ? "切换为英文" : "Switch to Chinese"}
                onClick={() => setLang(nextLang)}
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