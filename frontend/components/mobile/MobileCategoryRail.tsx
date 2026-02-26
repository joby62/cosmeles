"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = {
  key: string;
  label: string;
  short: string;
  href?: string;
};

const ITEMS: Item[] = [
  { key: "shampoo", label: "洗发水", short: "洗", href: "/m/shampoo/start" },
  { key: "bodywash", label: "沐浴露", short: "沐" },
  { key: "conditioner", label: "护发素", short: "护" },
  { key: "lotion", label: "润肤露", short: "润" },
  { key: "cleanser", label: "洗面奶", short: "洁" },
];

function itemActive(pathname: string | null, key: string) {
  if (!pathname) return false;
  if (key === "shampoo") return pathname.startsWith("/m/shampoo");
  return false;
}

export default function MobileCategoryRail() {
  const pathname = usePathname();

  return (
    <div className="border-b border-black/[0.06] bg-[color:var(--bg)]">
      <div className="mx-auto max-w-[680px] px-4 py-2">
        <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-2.5">
            {ITEMS.map((item) => {
              const active = itemActive(pathname, item.key);

              if (!item.href) {
                return (
                  <span
                    key={item.key}
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-black/8 bg-white/70 px-3 text-[13px] text-black/40"
                  >
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/[0.06] text-[11px] text-black/40">
                      {item.short}
                    </span>
                    {item.label}
                  </span>
                );
              }

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[13px] transition-colors ${
                    active
                      ? "border-black/80 bg-black text-white"
                      : "border-black/10 bg-white text-black/72 active:bg-black/[0.03]"
                  }`}
                >
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                      active ? "bg-white/20 text-white" : "bg-black/[0.05] text-black/55"
                    }`}
                  >
                    {item.short}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
