import type { Metadata } from "next";
import "./globals.css";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";

export const metadata: Metadata = {
  metadataBase: new URL("https://jeslect.com"),
  title: "婕选 | 更清楚地选，更从容地买",
  description:
    "婕选正在围绕产品适配、清晰比较与更低负担的个护决策，重建中文独立站体验。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="site-shell">
          <SiteHeader />
          <main className="site-main">{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
