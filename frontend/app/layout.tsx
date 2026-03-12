import type { Metadata } from "next";
import "./globals.css";
import DemoLocaleProvider from "@/components/site/DemoLocaleProvider";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";

export const metadata: Metadata = {
  metadataBase: new URL("https://jeslect.com"),
  title: "Jeslect | Build a clearer routine",
  description:
    "Jeslect is building an English-first skincare, body care, and hair care storefront around product clarity, routine fit, and calmer shopping decisions.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-US" suppressHydrationWarning>
      <body>
        <DemoLocaleProvider>
          <div className="site-shell">
            <SiteHeader />
            <main className="site-main">{children}</main>
            <SiteFooter />
          </div>
        </DemoLocaleProvider>
      </body>
    </html>
  );
}
