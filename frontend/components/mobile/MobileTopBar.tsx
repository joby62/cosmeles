"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function getSectionLabel(pathname: string | null): string {
  if (!pathname || pathname === "/m") return "予选";
  if (pathname.startsWith("/m/choose")) return "选品类";
  if (pathname.startsWith("/m/shampoo")) return "洗发水";
  return "予选";
}

export default function MobileTopBar() {
  const pathname = usePathname();
  const section = getSectionLabel(pathname);

  return (
    <div className="h-12 bg-[color:var(--bg)]/88 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--bg)]/75">
      <div className="mx-auto flex h-12 max-w-[680px] items-center justify-between px-4">
        <Link href="/m" className="inline-flex items-center gap-0.5 rounded-full px-1 py-0.5 active:bg-black/[0.03]">
          <img
            src="/brand/logo.png"
            alt="予选"
            width={16}
            height={16}
            onError={(e) => {
              // 兜底到 svg，便于排查静态资源缓存问题。
              const img = e.currentTarget;
              img.src = "/brand/logo.svg";
            }}
          />
          <span className="text-[11px] leading-none text-black/36">·</span>
          <span className="text-[14px] font-semibold tracking-[0.005em] text-black/88">{section}</span>
        </Link>
        <div className="text-[12px] text-black/45">省下挑花眼的时间，只留最对位的一件。</div>
      </div>
    </div>
  );
}
