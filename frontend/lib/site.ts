import type { SiteLocale } from "@/lib/sitePreferences";
import * as en from "@/lib/site.en";
import * as zh from "@/lib/site.zh";
import type { CategoryKey, CategoryMeta } from "@/lib/site.en";

export type { CategoryKey, CategoryMeta, ConcernMeta } from "@/lib/site.en";

export const CATEGORY_ORDER = en.CATEGORY_ORDER;
export const CATEGORY_META = en.CATEGORY_META;
export const CATEGORIES = en.CATEGORIES;
export const SHOP_CONCERNS = en.SHOP_CONCERNS;
export const TRUST_ITEMS = en.TRUST_ITEMS;
export const PRIMARY_NAV = en.PRIMARY_NAV;
export const SUPPORT_NAV = en.SUPPORT_NAV;
export const LEARN_TOPICS = en.LEARN_TOPICS;
export const isCategoryKey = en.isCategoryKey;
export const normalizeCategoryKey = en.normalizeCategoryKey;
export const categoryHref = en.categoryHref;

function getSiteContent(locale: SiteLocale = "en") {
  return locale === "zh" ? zh : en;
}

export function getCategories(locale: SiteLocale = "en") {
  return getSiteContent(locale).CATEGORIES;
}

export function getShopConcerns(locale: SiteLocale = "en") {
  return getSiteContent(locale).SHOP_CONCERNS;
}

export function getTrustItems(locale: SiteLocale = "en") {
  return getSiteContent(locale).TRUST_ITEMS;
}

export function getPrimaryNav(locale: SiteLocale = "en") {
  return getSiteContent(locale).PRIMARY_NAV;
}

export function getSupportNav(locale: SiteLocale = "en") {
  return getSiteContent(locale).SUPPORT_NAV;
}

export function getLearnTopics(locale: SiteLocale = "en") {
  return getSiteContent(locale).LEARN_TOPICS;
}

export function getCategoryMeta(value: string | null | undefined, locale: SiteLocale = "en"): CategoryMeta | null {
  const key = normalizeCategoryKey(value);
  return key ? getSiteContent(locale).CATEGORY_META[key] : null;
}

export function getCategoryMetaByKey(key: CategoryKey, locale: SiteLocale = "en"): CategoryMeta {
  return getSiteContent(locale).CATEGORY_META[key];
}
