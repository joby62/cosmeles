import { cookies } from "next/headers";
import { DEFAULT_SITE_PREFERENCES, SITE_LOCALE_COOKIE, type SitePreferences, getSitePreferencesFromValues } from "@/lib/sitePreferences";

export async function getRequestSitePreferences(): Promise<SitePreferences> {
  const cookieStore = await cookies();
  const locale = cookieStore.get(SITE_LOCALE_COOKIE)?.value;

  return getSitePreferencesFromValues({
    locale: locale || DEFAULT_SITE_PREFERENCES.locale,
  });
}
