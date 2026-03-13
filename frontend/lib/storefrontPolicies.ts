import type { SiteLocale } from "@/lib/sitePreferences";
import * as en from "@/lib/storefrontPolicies.en";
import * as zh from "@/lib/storefrontPolicies.zh";

export * from "@/lib/storefrontPolicies.en";

export function getStorefrontPolicyCopy(locale: SiteLocale = "en") {
  return locale === "zh" ? zh : en;
}
