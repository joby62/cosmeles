import "./globals.css";
import type { Metadata } from "next";

import { BRAND } from "@/lib/brand";
import AppleNav from "@/components/AppleNav";

export const metadata: Metadata = {
  title: `${BRAND.appNameZh} · ${BRAND.sloganZh}`,
  description: BRAND.heroSublineZh,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-dvh bg-[#f5f5f7] text-black antialiased">
        <AppleNav />

        {/* ✅ 只虚化 main（不影响 top nav） */}
        <main id="page-main" className="mx-auto max-w-[1024px] px-5 pt-10 md:pt-14">
          {children}
        </main>
      </body>
    </html>
  );
}