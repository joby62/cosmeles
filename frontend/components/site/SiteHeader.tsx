"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import BrandLockup from "@/components/site/BrandLockup";
import { useSitePreferences } from "@/components/site/SitePreferenceProvider";
import { type SiteLocale } from "@/lib/sitePreferences";
import { getPrimaryNav } from "@/lib/site";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SelectorGroup<T extends string>({
  value,
  items,
  onChange,
}: {
  value: T;
  items: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-black/8 bg-white/92 p-1 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={`inline-flex h-8 items-center justify-center rounded-full px-3 text-[12px] font-semibold transition ${
            item.value === value ? "bg-slate-950 text-white" : "text-slate-600"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export default function SiteHeader() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { locale, setLocale } = useSitePreferences();
  const primaryNav = getPrimaryNav(locale);

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

  const localeItems: Array<{ value: SiteLocale; label: string }> = [
    { value: "en", label: "EN" },
    { value: "zh", label: "中" },
  ];

  function handleLocaleChange(nextLocale: SiteLocale) {
    if (nextLocale === locale) return;
    setLocale(nextLocale);
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-black/8 bg-[rgba(248,250,252,0.88)] backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="min-w-0">
            <BrandLockup locale={locale} tone="header" />
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {primaryNav.map((item) => {
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
            <div className="hidden items-center gap-2 sm:flex">
              <SelectorGroup value={locale} items={localeItems} onChange={handleLocaleChange} />
            </div>

            {quickActions.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={
                  item.tone === "primary"
                    ? "inline-flex h-10 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-4 text-[13px] font-semibold text-white shadow-[0_12px_30px_rgba(0,113,227,0.28)] transition hover:brightness-[1.03]"
                    : "hidden h-10 items-center justify-center rounded-full border border-black/10 bg-white/90 px-4 text-[13px] font-medium text-slate-700 transition hover:bg-white hover:text-slate-950 sm:inline-flex"
                }
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-3 md:hidden">
          <div className="flex flex-wrap gap-2 sm:hidden">
            <SelectorGroup value={locale} items={localeItems} onChange={handleLocaleChange} />
          </div>

          <nav className="flex gap-2 overflow-x-auto pb-1">
            {primaryNav.map((item) => {
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
      </div>
    </header>
  );
}
