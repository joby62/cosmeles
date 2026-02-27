"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

function getSectionLabel(pathname: string | null): string {
  if (!pathname || pathname === "/m") return "开始选择";
  if (pathname.startsWith("/m/choose")) return "选品类";
  if (pathname.startsWith("/m/wiki")) return "成份百科";
  if (pathname.startsWith("/m/shampoo")) return "洗发水";
  if (pathname.startsWith("/m/bodywash")) return "沐浴露";
  if (pathname.startsWith("/m/conditioner")) return "护发素";
  if (pathname.startsWith("/m/lotion")) return "润肤霜";
  if (pathname.startsWith("/m/cleanser")) return "洗面奶";
  if (pathname.startsWith("/m/compare")) return "横向对比";
  if (pathname.startsWith("/m/bag")) return "购物袋";
  if (pathname.startsWith("/m/me")) return "我的";
  return "予选";
}

export default function MobileTopBar() {
  const pathname = usePathname();
  const section = getSectionLabel(pathname);
  const logoCandidates = [
    "/brand/logo.svg?v=20260226",
    "/brand/logo.png?v=20260226",
    "/m/brand/logo.svg?v=20260226",
    "/m/brand/logo.png?v=20260226",
  ];
  const [logoIndex, setLogoIndex] = useState(0);

  return (
    <div className="h-12 bg-[color:var(--bg)]/88 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--bg)]/75">
      <div className="mx-auto flex h-12 max-w-[680px] items-center justify-between px-4">
        <Link href="/m" className="inline-flex items-center gap-0.5 rounded-full px-1 py-0.5 active:bg-black/[0.03]">
          <img
            src={logoCandidates[Math.min(logoIndex, logoCandidates.length - 1)]}
            alt="予选"
            width={16}
            height={16}
            onError={(e) => {
              if (logoIndex < logoCandidates.length - 1) {
                setLogoIndex((n) => n + 1);
                return;
              }
              e.currentTarget.style.display = "none";
            }}
          />
          <span className="text-[11px] leading-none text-black/36">·</span>
          <span className="text-[14px] font-semibold tracking-[0.005em] text-black/88">{section}</span>
        </Link>
        <div className="text-[12px] text-black/45">省下挑花眼的时间，只留最合适的一件。</div>
      </div>
    </div>
  );
}
