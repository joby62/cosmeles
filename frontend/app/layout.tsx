import "./globals.css";
import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import DesktopTopNavGate from "@/components/DesktopTopNavGate";

export const metadata: Metadata = {
  title: `${BRAND.appNameZh} · ${BRAND.sloganZh}`,
  description: BRAND.heroSublineZh,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        {/* Desktop 才显示顶部导航；/m 独立移动壳层 */}
        <DesktopTopNavGate />

        {/* ✅ 只虚化 main（不影响 top nav / flyout） */}
        <main id="app-main">{children}</main>
      </body>
    </html>
  );
}
