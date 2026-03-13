"use client";

import Link from "next/link";
import BrandLockup from "@/components/site/BrandLockup";
import { useSitePreferences } from "@/components/site/SitePreferenceProvider";
import { getSupportNav } from "@/lib/site";

export default function SiteFooter() {
  const { locale } = useSitePreferences();
  const supportNav = getSupportNav(locale);

  return (
    <footer className="border-t border-black/8 bg-white/80">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <BrandLockup locale={locale} tone="footer" />
            <h2 className="mt-4 text-[28px] font-semibold tracking-[-0.03em] text-slate-950">
              {locale === "zh"
                ? "英文主站优先，中文可从同一套决策链路切换进入。"
                : "English-first storefront, with Chinese available from the same shell."}
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-600">
              {locale === "zh"
                ? "婕选会把产品适配、对比、探索、支持与 shortlist 恢复保持在同一套独立站壳层里，避免英文站和中文站各自漂移。"
                : "Jeslect keeps product fit, compare, learn, support, and saved shortlist recovery inside one storefront shell so the English baseline stays stable while Chinese remains available."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {supportNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl border border-black/8 bg-white px-4 py-3 text-[13px] font-medium text-slate-700 transition hover:border-sky-200 hover:text-slate-950"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
