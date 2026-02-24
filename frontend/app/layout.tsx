import "./globals.css";
import Link from "next/link";
import Image from "next/image";
import { TOP_CATEGORIES, CATEGORY_CONFIG } from "@/lib/catalog";

export const metadata = {
  title: "Cosmeles",
  description: "选购橱窗 Demo",
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
          <nav className="site-nav__inner" aria-label="Primary">
            {/* Left: logo */}
            <Link href="/" className="site-nav__logo" aria-label="Cosmeles Home">
              <Image
                src="/brand/logo.png"
                alt="Cosmeles"
                width={16}
                height={16}
                priority
              />
            </Link>

            {/* Center: categories */}
            <div className="site-nav__links">
              {TOP_CATEGORIES.map((k) => (
                <Link key={k} className="site-nav__link" href={`/c/${k}`}>
                  {CATEGORY_CONFIG[k].zh}
                </Link>
              ))}
              <Link className="site-nav__link" href="/compare">
                横向对比
              </Link>
            </div>

            {/* Right: placeholder icons area (future) */}
            <div className="site-nav__right" aria-hidden="true" />
          </nav>
        </header>

        <main>{children}</main>

        <footer className="site-footer">
          Demo · Cosmeles · 仅用于橱窗体验验证
        </footer>
      </body>
    </html>
  );
}