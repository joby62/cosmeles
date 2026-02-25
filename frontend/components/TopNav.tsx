"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { BRAND } from "@/lib/brand";
import { TOP_CATEGORIES, CATEGORY_CONFIG, type CategoryKey } from "@/lib/catalog";

type FlyoutItem = { label: string; href: string };
type FlyoutColumn = { title: string; items: FlyoutItem[] };

function cx(...arr: Array<string | false | null | undefined>) {
  return arr.filter(Boolean).join(" ");
}

/**
 * ✅ 全中文：不允许中英夹杂
 * ✅ 结构：左大列 + 两列小项（Apple 的信息层级）
 */
function getFlyout(category: CategoryKey): FlyoutColumn[] {
  if (category === "shampoo") {
    return [
      {
        title: "功能",
        items: [
          { label: "控油清爽", href: "/c/shampoo" },
          { label: "去屑止痒", href: "/c/shampoo" },
          { label: "修护受损", href: "/c/shampoo" },
          { label: "蓬松丰盈", href: "/c/shampoo" },
        ],
      },
      {
        title: "适合人群",
        items: [
          { label: "油性头皮", href: "/c/shampoo" },
          { label: "敏感头皮", href: "/c/shampoo" },
          { label: "染烫受损", href: "/c/shampoo" },
        ],
      },
      {
        title: "更多",
        items: [
          { label: "成分与配方逻辑", href: "/compare" },
          { label: "如何选择洗发水", href: "/c/shampoo" },
        ],
      },
    ];
  }

  if (category === "bodywash") {
    return [
      {
        title: "功能",
        items: [
          { label: "清爽不假滑", href: "/c/bodywash" },
          { label: "温和无刺激", href: "/c/bodywash" },
          { label: "留香更克制", href: "/c/bodywash" },
          { label: "敏感肌可用", href: "/c/bodywash" },
        ],
      },
      {
        title: "适合人群",
        items: [
          { label: "干皮", href: "/c/bodywash" },
          { label: "油皮", href: "/c/bodywash" },
          { label: "敏感肌", href: "/c/bodywash" },
        ],
      },
      {
        title: "更多",
        items: [
          { label: "香型与肤感指南", href: "/c/bodywash" },
          { label: "常见使用误区", href: "/c/bodywash" },
        ],
      },
    ];
  }

  if (category === "conditioner") {
    return [
      {
        title: "功能",
        items: [
          { label: "柔顺抗毛躁", href: "/c/conditioner" },
          { label: "修护断裂", href: "/c/conditioner" },
          { label: "轻盈不塌", href: "/c/conditioner" },
        ],
      },
      {
        title: "适合人群",
        items: [
          { label: "细软发", href: "/c/conditioner" },
          { label: "漂染发", href: "/c/conditioner" },
          { label: "干枯分叉", href: "/c/conditioner" },
        ],
      },
      {
        title: "更多",
        items: [
          { label: "护发素与发膜区别", href: "/c/conditioner" },
          { label: "正确使用时机", href: "/c/conditioner" },
        ],
      },
    ];
  }

  // 其他品类：最小可用（保持中文）
  return [
    {
      title: "功能",
      items: [{ label: `查看${CATEGORY_CONFIG[category].zh}`, href: `/c/${category}` }],
    },
    {
      title: "适合人群",
      items: [{ label: "敏感 / 日常 / 长期", href: `/c/${category}` }],
    },
    {
      title: "更多",
      items: [{ label: "横向对比", href: "/compare" }],
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
    // Apple：轻微延迟，避免“一碰就炸开”
    openTimer.current = window.setTimeout(() => setOpenKey(k), 110);
  }

  function requestClose() {
    clearTimers();
    // Apple：离开整体导航域后，短暂容错再关闭
    closeTimer.current = window.setTimeout(() => setOpenKey(null), 170);
  }

  function hardClose() {
    clearTimers();
    setOpenKey(null);
  }

  // ✅ 用你现有机制：只虚化 main（不影响 top nav / flyout）
  useEffect(() => {
    const html = document.documentElement;
    if (isOpen) html.setAttribute("data-nav-open", "1");
    else html.removeAttribute("data-nav-open");
    return () => {
      html.removeAttribute("data-nav-open");
    };
  }, [isOpen]);

  // ESC 关闭（Apple）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hardClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {/* 这个 zone = Apple 的“分类+分栏一体导航域”
          离开整个 zone 才会关闭 -> 同时撤虚化 */}
      <div
        className={cx("nav-zone", isOpen && "nav-zone--open")}
        onPointerEnter={() => {
          clearTimers();
        }}
        onPointerLeave={() => {
          requestClose();
        }}
      >
        {/* Top bar */}
        <header className="nav-bar" aria-label="主导航">
          <div className="nav-inner">
            <Link className="nav-logo" href="/" aria-label={BRAND.appNameZh}>
              <Image
                src="/logo.svg"
                alt=""
                width={18}
                height={18}
                priority
                draggable={false}
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
                  {CATEGORY_CONFIG[k].zh}
                </Link>
              ))}
              <Link
                href="/compare"
                className="nav-item"
                onPointerEnter={() => requestClose()}
              >
                横向对比
              </Link>
            </nav>

            <div className="nav-right" />
          </div>
        </header>

        {/* Flyout：不下推页面；和 nav 同色同雾化；无边框 */}
        <div
          className={cx("flyout", isOpen && "flyout--open")}
          aria-hidden={!isOpen}
        >
          {/* 透明缓冲桥（Apple 的“容错缓冲区”） */}
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

            <div className="flyout-foot">{BRAND.heroSublineZh}</div>
          </div>
        </div>
      </div>

      {/* 点击空白关闭（Apple：点页面任何地方，导航退出，虚化撤掉） */}
      {isOpen && (
        <button
          className="nav-scrim"
          aria-label="关闭导航"
          onClick={hardClose}
        />
      )}
    </>
  );
}