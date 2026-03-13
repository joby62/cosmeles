import type { Metadata } from "next";
import "./globals.css";
import SitePreferenceProvider from "@/components/site/SitePreferenceProvider";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import { getRequestSitePreferences } from "@/lib/sitePreferences.server";
import { getDocumentLang } from "@/lib/sitePreferences";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getRequestSitePreferences();

  return {
    metadataBase: new URL("https://jeslect.com"),
    title: locale === "zh" ? "婕选 | 更清楚地选，更从容地买" : "Jeslect | Build a clearer routine",
    description:
      locale === "zh"
        ? "婕选以英文独立站为主，同时提供中文切换，围绕产品适配、清晰比较与更低负担的个护决策组织体验。"
        : "Jeslect is building an English-first beauty storefront around clearer fit, calmer comparison, and lower-friction shopping decisions.",
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const preferences = await getRequestSitePreferences();

  return (
    <html lang={getDocumentLang(preferences.locale)} suppressHydrationWarning>
      <body>
        <SitePreferenceProvider initialLocale={preferences.locale}>
          <div className="site-shell">
            <SiteHeader />
            <main className="site-main">{children}</main>
            <SiteFooter />
          </div>
        </SitePreferenceProvider>
      </body>
    </html>
  );
}
