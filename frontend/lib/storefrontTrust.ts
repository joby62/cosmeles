import type { SiteLocale } from "@/lib/sitePreferences";
import * as en from "@/lib/storefrontTrust.en";
import * as zh from "@/lib/storefrontTrust.zh";

export * from "@/lib/storefrontTrust.en";

export function getStorefrontTrustCopy(locale: SiteLocale = "en") {
  return locale === "zh" ? zh : en;
}
