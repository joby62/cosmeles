import "./globals.css";
import type { Metadata } from "next";

import { BRAND } from "@/lib/brand";
import TopNav from "@/components/TopNav";

export const metadata: Metadata = {
  title: `${BRAND.appNameZh} · ${BRAND.slogan}`,
  description: BRAND.heroSubline,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-dvh bg-[#f5f5f7] text-black antialiased">
        {/* Top Nav (44px breathing space) */}
        <TopNav />

        {/* Main */}
        <main className="mx-auto max-w-[1024px] px-5 pt-10 md:pt-14">
          {children}
        </main>
      </body>
    </html>
  );
}