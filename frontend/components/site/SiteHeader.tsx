"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandLockup from "@/components/site/BrandLockup";
import { PRIMARY_NAV } from "@/lib/site";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SiteHeader() {
  const pathname = usePathname() || "/";

  return (
    <header className="sticky top-0 z-50 border-b border-black/8 bg-[rgba(248,250,252,0.88)] backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="min-w-0">
            <BrandLockup tone="header" />
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {PRIMARY_NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex rounded-full px-4 py-2 text-[14px] font-medium transition ${
                    active ? "bg-slate-950 text-white" : "text-slate-700 hover:bg-white hover:text-slate-950"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/search"
              className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white/90 px-4 text-[13px] font-medium text-slate-700 transition hover:bg-white hover:text-slate-950"
            >
              搜索
            </Link>
            <Link
              href="/saved"
              className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white/90 px-4 text-[13px] font-medium text-slate-700 transition hover:bg-white hover:text-slate-950"
            >
              已存
            </Link>
            <Link
              href="/bag"
              className="inline-flex h-10 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-4 text-[13px] font-semibold text-white shadow-[0_12px_30px_rgba(0,113,227,0.28)] transition hover:brightness-[1.03]"
            >
              袋中
            </Link>
          </div>
        </div>

        <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 md:hidden">
          {PRIMARY_NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition ${
                  active ? "bg-slate-950 text-white" : "border border-black/8 bg-white/90 text-slate-700"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
