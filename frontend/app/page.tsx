"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { BRAND } from "@/lib/brand";
import { TOP_CATEGORIES, CATEGORY_CONFIG, type CategoryKey } from "@/lib/catalog";
import { getInitialLang, subscribeLang, type Lang } from "@/lib/i18n";

function cx(...arr: Array<string | false | undefined | null>) {
  return arr.filter(Boolean).join(" ");
}

export default function HomePage() {
  const [lang, setLang] = useState<Lang>("zh");
  const [navKey, setNavKey] = useState<CategoryKey | null>(null);

  useEffect(() => {
    setLang(getInitialLang());
    return subscribeLang(() => setLang(getInitialLang()));
  }, []);

  useEffect(() => {
    const on = (e: any) => {
      const k = (e?.detail?.key ?? null) as CategoryKey | null;
      setNavKey(k);
    };
    window.addEventListener("matchup:nav", on);
    return () => window.removeEventListener("matchup:nav", on);
  }, []);

  const appName = lang === "zh" ? BRAND.appNameZh : BRAND.appNameEn;
  const slogan = lang === "zh" ? BRAND.sloganZh : BRAND.sloganEn;
  const subline = lang === "zh" ? BRAND.heroSublineZh : BRAND.heroSublineEn;
  const footer = lang === "zh" ? BRAND.footerZh : BRAND.footerEn;

  // hover hint 同语言（如果 catalog 没有 en，就退回 zh，避免中英夹杂）
  const hoverHint = navKey
    ? (lang === "en" ? (CATEGORY_CONFIG[navKey].en ?? CATEGORY_CONFIG[navKey].zh) : CATEGORY_CONFIG[navKey].zh)
    : "";

  return (
    <section id="hero" className="relative">
      <div className="text-center pt-14 md:pt-20 pb-10 md:pb-14">
        <h1
          className={cx(
            "mx-auto max-w-[980px]",
            "text-[56px] md:text-[68px] lg:text-[80px]",
            "font-semibold tracking-[-0.02em]",
            "leading-[1.05]"
          )}
        >
          {appName}
        </h1>

        <div className="mt-3 md:mt-4">
          <div className="text-[19px] md:text-[21px] font-semibold tracking-[-0.01em] text-black/75">
            {slogan}
          </div>
        </div>

        <div
          className={cx(
            "mt-6 md:mt-7",
            navKey ? "opacity-70 translate-y-[1px]" : "opacity-100 translate-y-0",
            "transition-all duration-200 ease-out"
          )}
        >
          {/* ✅ 副文案：不加粗 */}
          <div className="mx-auto max-w-[820px] text-[17px] md:text-[19px] leading-[1.55] text-black/60">
            {subline}
          </div>

          {navKey && (
            <div className="mt-3 text-[12px] tracking-[0.04em] text-black/35">
              {hoverHint}
            </div>
          )}
        </div>

        <div className="mt-10 md:mt-12 flex flex-wrap items-center justify-center gap-2">
          {TOP_CATEGORIES.map((k) => (
            <Link
              key={k}
              href={`/c/${k}`}
              className={cx(
                "px-4 py-2 rounded-full",
                "text-[12px] font-medium tracking-[0.02em]",
                "border border-black/[0.08]",
                "bg-white/40 hover:bg-white/60",
                "transition-colors"
              )}
            >
              {CATEGORY_CONFIG[k].zh}
            </Link>
          ))}
          <Link
            href="/compare"
            className={cx(
              "px-4 py-2 rounded-full",
              "text-[12px] font-medium tracking-[0.02em]",
              "border border-black/[0.08]",
              "bg-white/60 hover:bg-white/75",
              "transition-colors"
            )}
          >
            横向对比
          </Link>
        </div>

        <div className="mt-12 text-[12px] text-black/35">{footer}</div>
      </div>
    </section>
  );
}