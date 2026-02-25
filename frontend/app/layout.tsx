import "./globals.css";
import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import TopNav from "@/components/TopNav";

export const metadata: Metadata = {
  title: `${BRAND.appNameZh} · ${BRAND.sloganZh}`,
  description: BRAND.heroSublineZh,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        {/* Top Nav：永远不被虚化 */}
        <TopNav />

        {/* ✅ 只虚化 main（不影响 top nav / flyout） */}
        <main id="app-main">{children}</main>
      </body>
    </html>
  );
}