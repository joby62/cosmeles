export type SiteLocale = "en" | "zh";

export type SitePreferences = {
  locale: SiteLocale;
};

export const SITE_LOCALE_COOKIE = "jeslect_locale";

export const SITE_PREFERENCE_MAX_AGE = 60 * 60 * 24 * 365;

export const DEFAULT_SITE_PREFERENCES: SitePreferences = {
  locale: "en",
};

export function normalizeSiteLocale(value: string | null | undefined): SiteLocale {
  return String(value || "").trim().toLowerCase() === "zh" ? "zh" : "en";
}

export function getDocumentLang(locale: SiteLocale): string {
  return locale === "zh" ? "zh-CN" : "en-US";
}

export function getSitePreferencesFromValues(values?: Partial<Record<keyof SitePreferences, string | null | undefined>>): SitePreferences {
  return {
    locale: normalizeSiteLocale(values?.locale),
  };
}
