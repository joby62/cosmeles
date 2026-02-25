"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useRef, useState } from "react";

import { BRAND } from "@/lib/brand";
import { TOP_CATEGORIES, CATEGORY_CONFIG } from "@/lib/catalog";

/* ---------------- Nav Link ---------------- */

function NavLink({
  href,
  children,
  onMouseEnter,
}: {
  href: string;
  children: React.ReactNode;
  onMouseEnter?: () => void;
}) {
  return (
    <Link
      href={href}
      onMouseEnter={onMouseEnter}
      className={[
        "text-[12px] font-medium tracking-[0.02em] leading-[44px]",
        "text-black/80 hover:text-black/95",
        "transition-opacity duration-200 ease-out",
        "hover:opacity-90 active:opacity-80",
        "px-2 rounded-full hover:bg-black/[0.04]",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

/* ---------------- Drawer Data (Demo) ---------------- */

const DRAWER = {
  shampoo: {
    leftTitle: "探索",
    left: ["控油清爽", "去屑止痒", "修护受损", "蓬松丰盈"],
    midTitle: "适合谁",
    mid: ["油性头皮", "敏感头皮", "染烫受损"],
    rightTitle: "更多",
    right: ["成分与配方逻辑", "如何选择洗发水"],
  },
};

/* ---------------- Drawer UI ---------------- */

function Column({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div>
      <h4 className="mb-5 text-[12px] font-medium tracking-[0.04em] text-black/45">
        {title}
      </h4>
      <ul className="space-y-3">
        {items.map((t) => (
          <li key={t}>
            <span className="text-[14px] font-medium text-black hover:opacity-60 transition">
              {t}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Drawer({
  active,
  open,
}: {
  active: string | null;
  open: boolean;
}) {
  if (!open || !active || !(active in DRAWER)) return null;

  const d = DRAWER[active as keyof typeof DRAWER];

  return (
    <div
      className={[
        // 🔑 Apple 关键：不是紧贴 header，而是“接在导航下方”
        "absolute left-0 right-0 top-[44px]",
        "z-40",
        "border-t border-black/[0.06]",
        "bg-[#f5f5f7]/95 backdrop-blur",
      ].join(" ")}
    >
      <div className="mx-auto grid max-w-[1024px] grid-cols-3 gap-16 px-5 py-16">
        <Column title={d.leftTitle} items={d.left} />
        <Column title={d.midTitle} items={d.mid} />
        <Column title={d.rightTitle} items={d.right} />
      </div>
    </div>
  );
}

/* ---------------- Top Nav ---------------- */

export default function TopNav() {
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<NodeJS.Timeout | null>(null);

  const supportsDrawer = useMemo(() => new Set(["shampoo"]), []);

  function enter(key: string) {
    if (!supportsDrawer.has(key)) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setActive(key);
    setOpen(true);
  }

  function leave() {
    // 🧠 Apple 感的核心：延迟关闭
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      setActive(null);
    }, 120);
  }

  return (
    <header className="sticky top-0 z-50 h-11">
      <div className="relative h-11 border-b border-black/[0.06] bg-[#f5f5f7]/85 backdrop-blur">
        <div
          className="mx-auto flex h-11 max-w-[1024px] items-center justify-between px-5"
          onMouseLeave={leave}
        >
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Image src="/brand/logo.png" alt="" width={18} height={18} />
            <span className="text-[12px] font-semibold tracking-[0.02em] text-black/85">
              {BRAND.appNameZh}
            </span>
          </Link>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {TOP_CATEGORIES.map((k) => (
              <NavLink
                key={k}
                href={`/c/${k}`}
                onMouseEnter={() => enter(String(k))}
              >
                {CATEGORY_CONFIG[k].zh}
              </NavLink>
            ))}
            <NavLink href="/compare">横向对比</NavLink>
          </nav>

          <div className="w-[96px]" />
        </div>

        <Drawer active={active} open={open} />
      </div>
    </header>
  );
}