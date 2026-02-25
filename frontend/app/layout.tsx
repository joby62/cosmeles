import "./globals.css";
import Link from "next/link";
import Image from "next/image";
import { TOP_CATEGORIES, CATEGORY_CONFIG } from "@/lib/catalog";
import { BRAND } from "@/lib/brand";

export const metadata = {
  title: BRAND.zhName,
  description: BRAND.slogan,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        {/* Apple-like Top Nav */}
        <header className="site-nav">
          <div className="site-nav__inner">
            {/* Left: logo */}
            <Link href="/" className="site-nav__logo" aria-label={BRAND.zhName}>
              <Image
                src="/brand/logo.png"
                alt={BRAND.zhName}
                width={18}
                height={18}
                priority
              />
            </Link>

            {/* Center: categories */}
            <nav className="site-nav__links" aria-label="categories">
              {TOP_CATEGORIES.map((k) => (
                <Link key={k} href={`/c/${k}`} className="site-nav__link">
                  {CATEGORY_CONFIG[k].zh}
                </Link>
              ))}
              <Link href="/compare" className="site-nav__link">
                横向对比
              </Link>
            </nav>

            {/* Right: placeholder */}
            <div className="site-nav__right" />
          </div>
        </header>

        <main className="page-shell">{children}</main>

        <footer className="site-footer">
          Demo · {BRAND.zhName} · {BRAND.slogan}
        </footer>
      </body>
    </html>
  );
}