"use client";

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
        <div className="flex items-center gap-2">
          <img src="/brand/logo.svg" alt="予选" width={16} height={16} />
          <span className="text-[13px] text-black/36">·</span>
          <span className="text-[14px] font-semibold tracking-[0.01em] text-black/88">{section}</span>
        </div>
        <div className="text-[12px] text-black/45">省下挑花眼的时间，只留最对位的一件。</div>
      </div>
    </div>
  );
}
