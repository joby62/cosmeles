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
 * 先挑几个“像 Apple 的分栏目录”放上去，后期你再慢慢补全。
 * href 先指向现有路由（/c/xxx 或 /compare）。
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
          { label: "How to pick the scent", href: "/c/bodywash" },
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
          { label: "How long to leave it", href: "/c/conditioner" },
        ],
      },
    ];
  }

  // 其他类先给最小可用占位
  return [
    {
      title: "Explore",
      items: [{ label: `Browse ${CATEGORY_CONFIG[category].zh}`, href: `/c/${category}` }],
    },
    { title: "For", items: [{ label: "Sensitive / Daily / Long-term", href: `/c/${category}` }] },
    { title: "More", items: [{ label: "Compare", href: "/compare" }] },
  ];
}

function NavItem({
  label,
  active,
  href,
  onEnter,
}: {
  label: string;
  active: boolean;
  href: string;
  onEnter: () => void;
}) {
  return (
    <Link
      href={href}
      onPointerEnter={onEnter}
      className={cx(
        // Apple-ish typography
        "text-[12px] font-medium tracking-[0.02em] leading-[44px]",
        "px-2 rounded-full",
        // Apple-ish breathing hover
        "transition-[opacity,background-color] duration-200 ease-out",
        "hover:bg-black/[0.04]",
        active ? "text-black/95" : "text-black/80 hover:text-black/95",
        "hover:opacity-95 active:opacity-85"
      )}
    >
      {label}
    </Link>
  );
}

export default function AppleNav() {
  const [openKey, setOpenKey] = useState<CategoryKey | null>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);

  // ✅ 关键：把“判定区域”做成 Nav + Flyout 联通区域
  // 鼠标从栏目到分栏，不会触发离开（只要还在这个 wrapper 内）
  const regionRef = useRef<HTMLElement | null>(null);

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
    openTimer.current = window.setTimeout(() => setOpenKey(k), 140);
  }

  function requestClose() {
    clearTimers();
    closeTimer.current = window.setTimeout(() => setOpenKey(null), 220);
  }

  function hardClose() {
    clearTimers();
    setOpenKey(null);
  }

  // ✅ 只把“虚化/锁交互”施加到 main 内容：不影响 top nav / flyout
  useEffect(() => {
    const root = document.documentElement;
    if (isOpen) root.dataset.navOpen = "1";
    else delete root.dataset.navOpen;
    return () => {
      delete root.dataset.navOpen;
    };
  }, [isOpen]);

  // ESC 关闭
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") hardClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-50">
      {/* ✅ 联通判定区域：Nav + Flyout 共享一个 hover 区域 */}
      <section
        ref={(el) => {
          regionRef.current = el;
        }}
        className="relative"
        onPointerLeave={() => {
          // 只有真正离开整个区域（Nav + Flyout）才开始关闭计时
          requestClose();
        }}
        onPointerEnter={() => {
          // 进入区域，取消关闭（让用户慢慢移动）
          clearTimers();
        }}
      >
        {/* Top Nav (44px breathing space) */}
        <div className="h-11 border-b border-[var(--border)] bg-[color:var(--bg)]/85 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--bg)]/75">
          <div className="mx-auto flex h-11 max-w-[1024px] items-center justify-between px-5">
            {/* Left: logo */}
            <Link
              href="/"
              className="flex items-center gap-2 opacity-90 hover:opacity-100 transition-opacity duration-200"
              aria-label={BRAND.appNameZh}
              onPointerEnter={() => {
                // logo hover 不打开菜单，但也不应立刻关
                clearTimers();
              }}
            >
              <Image src="/brand/logo.png" alt={BRAND.appNameZh} width={18} height={18} priority />
              <span className="text-[12px] font-semibold tracking-[0.02em] text-black/85">
                {BRAND.appNameZh}
              </span>
            </Link>

            {/* Center: nav */}
            <nav className="hidden md:flex items-center gap-1">
              {TOP_CATEGORIES.map((k) => (
                <NavItem
                  key={k}
                  label={CATEGORY_CONFIG[k].zh}
                  href={`/c/${k}`}
                  active={openKey === k}
                  onEnter={() => requestOpen(k)}
                />
              ))}
              <NavItem label="横向对比" href="/compare" active={false} onEnter={hardClose} />
            </nav>

            {/* Right: keep balance like Apple */}
            <div className="w-[84px] md:w-[120px]" />
          </div>
        </div>

        {/* Flyout (Apple-ish: 无边框一体层) */}
        <div
          className={cx(
            "absolute left-0 right-0 top-11",
            // ✅ Apple: 不是卡片弹窗，而是“一体层”从 nav 下展开
            "bg-[color:var(--bg)]/92 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--bg)]/86",
            // 仅用底部分割线 + 极轻阴影收口
            "shadow-[0_10px_30px_rgba(0,0,0,0.06)]",
            // 动效：非常轻的呼吸
            "transition-[opacity,transform] duration-200 ease-out",
            isOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-1 pointer-events-none"
          )}
        >
          {/* ✅ 内部内容（max-width 对齐 Apple） */}
          <div className="mx-auto max-w-[1024px] px-5">
            <div className="grid grid-cols-3 gap-10 pt-9 pb-8">
              {flyout?.map((col) => (
                <div key={col.title}>
                  <div className="text-[12px] tracking-[0.04em] text-black/45">
                    {col.title}
                  </div>
                  <div className="mt-4 flex flex-col gap-3">
                    {col.items.map((it) => (
                      <Link
                        key={it.label}
                        href={it.href}
                        onClick={hardClose}
                        className={cx(
                          // Apple-ish list typography
                          "text-[14px] md:text-[15px]",
                          "font-semibold tracking-[-0.01em]",
                          "text-black/88 hover:text-black",
                          "transition-[opacity] duration-150 ease-out",
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

            {/* ✅ Apple-like hairline divider 收口 */}
            <div className="h-px bg-black/[0.06]" />

            {/* ✅ 这个区域留空更 Apple：不要“提示语” */}
            <div className="h-3" />
          </div>
        </div>
      </section>
    </header>
  );
}