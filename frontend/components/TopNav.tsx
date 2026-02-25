"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import { BRAND } from "@/lib/brand";
import { TOP_CATEGORIES, CATEGORY_CONFIG, type CategoryKey } from "@/lib/catalog";

type FlyoutColumn = {
  title: string; // Explore / For / More
  items: { label: string; href: string }[];
};

function cx(...arr: Array<string | false | undefined | null>) {
  return arr.filter(Boolean).join(" ");
}

/**
 * 先挑一些放上去（后面你再慢慢补全）
 * 结构和 Apple 一样：左大列（Explore）+ 两列小项（For/More）
 */
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
          { label: "Fragrance guide", href: "/c/bodywash" },
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
          { label: "Conditioner vs Mask", href: "/c/conditioner" },
          { label: "Timing & technique", href: "/c/conditioner" },
        ],
      },
    ];
  }

  // 其他品类：先给最小可用（你后面再补）
  return [
    {
      title: "Explore",
      items: [{ label: `查看${CATEGORY_CONFIG[category].zh}`, href: `/c/${category}` }],
    },
    {
      title: "For",
      items: [{ label: "Sensitive / Daily / Long-term", href: `/c/${category}` }],
    },
    {
      title: "More",
      items: [{ label: "Compare", href: "/compare" }],
    },
  ];
}

export default function TopNav() {
  const [openKey, setOpenKey] = useState<CategoryKey | null>(null);

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
    // Apple：轻微延迟再展开（避免“一碰就炸开”）
    openTimer.current = window.setTimeout(() => setOpenKey(k), 120);
  }

  function requestClose() {
    clearTimers();
    // Apple：离开后稍等再收（让用户能自然移到下拉面板）
    closeTimer.current = window.setTimeout(() => setOpenKey(null), 260);
  }

  function hardClose() {
    clearTimers();
    setOpenKey(null);
  }

  // 仅锁住“页面滚动”（Nav/Flyout 仍可 hover）
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // ESC 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hardClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      className="site-nav-wrap"
      // ✅ 关键：把“离开判定”变成 Nav + Flyout 一体区域
      onPointerEnter={() => clearTimers()}
      onPointerLeave={() => requestClose()}
    >
      {/* Top bar */}
      <header className="site-nav">
        <div className="site-nav__inner">
          <Link href="/" className="site-nav__logo" aria-label={BRAND.appNameZh} onPointerEnter={() => requestClose()}>
            <Image src="/brand/logo.png" alt={BRAND.appNameZh} width={18} height={18} priority />
          </Link>

          <nav className="site-nav__links" aria-label="Primary">
            {TOP_CATEGORIES.map((k) => (
              <Link
                key={k}
                href={`/c/${k}`}
                className={cx("site-nav__link", openKey === k && "site-nav__link--active")}
                onPointerEnter={() => requestOpen(k)}
              >
                {CATEGORY_CONFIG[k].zh}
              </Link>
            ))}
            <Link href="/compare" className="site-nav__link" onPointerEnter={() => requestClose()}>
              横向对比
            </Link>
          </nav>

          <div className="site-nav__right" />
        </div>
      </header>

      {/* Blur overlay: 只虚化 nav 下面的页面内容，不盖住 nav */}
      <div className={cx("nav-flyout__overlay", isOpen && "nav-flyout__overlay--on")} />

      {/* Flyout */}
      <div className={cx("nav-flyout", isOpen && "nav-flyout--open")}>
        <div className="nav-flyout__inner">
          <div className="nav-flyout__grid">
            {flyout?.map((col, idx) => (
              <div key={col.title} className={cx("nav-flyout__col", idx === 0 && "nav-flyout__col--big")}>
                <div className="nav-flyout__title">{col.title}</div>
                <div className="nav-flyout__items">
                  {col.items.map((it) => (
                    <Link
                      key={it.label}
                      href={it.href}
                      onClick={hardClose}
                      className={cx("nav-flyout__item", idx === 0 && "nav-flyout__item--big")}
                    >
                      {it.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="nav-flyout__bottom">
            {BRAND.heroSubline /* Apple 风格：底部一句轻提示/宣言 */}
          </div>
        </div>
      </div>
    </div>
  );
}