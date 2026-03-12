"use client";

import Link from "next/link";
import BrandLockup from "@/components/site/BrandLockup";
import { useDemoLocale } from "@/components/site/DemoLocaleProvider";
import { SUPPORT_NAV } from "@/lib/site";

export default function SiteFooter() {
  const { locale } = useDemoLocale();
  const supportLabels =
    locale === "zh"
      ? {
          "/support": "支持",
          "/support/shipping": "配送",
          "/support/returns": "退货",
          "/support/faq": "常见问题",
          "/support/contact": "联系",
          "/privacy": "隐私",
          "/terms": "条款",
          "/cookies": "Cookies",
        }
      : {
          "/support": "Support",
          "/support/shipping": "Shipping",
          "/support/returns": "Returns",
          "/support/faq": "FAQ",
          "/support/contact": "Contact",
          "/privacy": "Privacy",
          "/terms": "Terms",
          "/cookies": "Cookies",
        };

  return (
    <footer className="border-t border-black/8 bg-white/80">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <BrandLockup locale={locale} tone="footer" />
            <h2 className="mt-4 text-[28px] font-semibold tracking-[-0.03em] text-slate-950">
              {locale === "zh"
                ? "中文壳层 demo，先把品牌字标与导航气质立住。"
                : "English-first storefront, built for a calmer US decision flow."}
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-600">
              {locale === "zh"
                ? "这一版只演示语言切换、导航标签和“婕选”品牌 lockup。主信息架构与页面正文暂不大改，先保证 demo 观感自然。"
                : "Jeslect is rebuilding the product journey around clearer routine fit, cleaner comparison, and lower-friction product discovery."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {SUPPORT_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl border border-black/8 bg-white px-4 py-3 text-[13px] font-medium text-slate-700 transition hover:border-sky-200 hover:text-slate-950"
              >
                {supportLabels[item.href as keyof typeof supportLabels] || item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
