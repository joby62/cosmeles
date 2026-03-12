"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandLockup from "@/components/site/BrandLockup";
import { useDemoLocale } from "@/components/site/DemoLocaleProvider";
import { PRIMARY_NAV } from "@/lib/site";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SiteHeader() {
  const pathname = usePathname() || "/";
  const { locale, setLocale } = useDemoLocale();

  const primaryLabels =
    locale === "zh"
      ? {
          "/shop": "选购",
          "/match": "测配",
          "/compare": "对比",
          "/learn": "探索",
          "/about": "关于",
        }
      : {
          "/shop": "Shop",
          "/match": "Match",
          "/compare": "Compare",
          "/learn": "Learn",
          "/about": "About",
        };

  const quickActions =
    locale === "zh"
      ? [
          { href: "/search", label: "搜索", tone: "secondary" as const },
          { href: "/saved", label: "已存", tone: "secondary" as const },
          { href: "/bag", label: "袋中", tone: "primary" as const },
        ]
      : [
          { href: "/search", label: "Search", tone: "secondary" as const },
          { href: "/saved", label: "Saved", tone: "secondary" as const },
          { href: "/bag", label: "Bag", tone: "primary" as const },
        ];

  return (
    <header className="sticky top-0 z-50 border-b border-black/8 bg-[rgba(248,250,252,0.88)] backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="min-w-0">
            <BrandLockup locale={locale} tone="header" />
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
                  {primaryLabels[item.href as keyof typeof primaryLabels] || item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <div
              className="hidden items-center rounded-full border border-black/8 bg-white/88 p-1 shadow-[0_10px_24px_rgba(15,23,42,0.05)] sm:inline-flex"
            >
              <button
                type="button"
                onClick={() => setLocale("en")}
                className={`inline-flex h-8 items-center justify-center rounded-full px-3 text-[12px] font-semibold transition ${
                  locale === "en" ? "bg-slate-950 text-white" : "text-slate-600"
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLocale("zh")}
                className={`inline-flex h-8 items-center justify-center rounded-full px-3 text-[12px] font-semibold transition ${
                  locale === "zh" ? "bg-slate-950 text-white" : "text-slate-600"
                }`}
              >
                中
              </button>
            </div>

            {quickActions.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={
                  item.tone === "primary"
                    ? "inline-flex h-10 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-4 text-[13px] font-semibold text-white shadow-[0_12px_30px_rgba(0,113,227,0.28)] transition hover:brightness-[1.03]"
                    : "inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white/90 px-4 text-[13px] font-medium text-slate-700 transition hover:bg-white hover:text-slate-950"
                }
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        {locale === "zh" ? (
          <div className="mt-3 hidden items-center justify-between gap-3 rounded-[22px] border border-sky-200 bg-sky-50/80 px-4 py-3 text-[12px] leading-5 text-slate-600 md:flex">
            <span className="font-medium text-sky-700">中文壳层 Demo</span>
            <span>当前先演示语言切换、导航语气和“婕选”品牌字标，页面正文仍以英文为主。</span>
          </div>
        ) : null}

        <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 md:hidden">
          <button
            type="button"
            onClick={() => setLocale(locale === "en" ? "zh" : "en")}
            className="shrink-0 rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-[13px] font-semibold text-sky-700"
          >
            {locale === "en" ? "中文 Demo" : "English Demo"}
          </button>
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
                {primaryLabels[item.href as keyof typeof primaryLabels] || item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
