import type { Lang } from "@/lib/i18n";

export const BRAND = {
  // App name
  appNameZh: "予选",
  appNameEn: "MatchUp",

  // Slogan
  sloganZh: "浴室里的最终答案",
  sloganEn: "The final answer for your bathroom.",

  // Hero subline（你指定的副文案）
  heroSublineZh: "省下挑花眼的时间，只留最合适的一件。",
  heroSublineEn: "Less browsing. More matching.",

  // Footer
  footerZh: "Demo · 予选 · 浴室里的最终答案",
  footerEn: "Demo · MatchUp · The final answer for your bathroom.",

  /**
   * ✅ Logo：先解决“挂掉”
   * 你说现在是 png，所以默认走 /logo.png
   * 之后你换成 svg，只需要改这里，不用改组件。
   */
  logoSrc: "/brand/logo.svg",
  logoAltZh: "予选",
  logoAltEn: "MatchUp",
} as const;

export function brandByLang(lang: Lang) {
  return {
    appName: lang === "zh" ? BRAND.appNameZh : BRAND.appNameEn,
    slogan: lang === "zh" ? BRAND.sloganZh : BRAND.sloganEn,
    heroSubline: lang === "zh" ? BRAND.heroSublineZh : BRAND.heroSublineEn,
    footer: lang === "zh" ? BRAND.footerZh : BRAND.footerEn,
    logoSrc: BRAND.logoSrc,
    logoAlt: lang === "zh" ? BRAND.logoAltZh : BRAND.logoAltEn,
  } as const;
}
