import "./globals.css";
import Link from "next/link";
import { TOP_CATEGORIES, CATEGORY_CONFIG } from "@/lib/catalog";

export const metadata = {
  title: "Cosmeles",
  description: "选购橱窗 Demo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-black text-white">
        {/* Top bar (Apple-like minimal nav) */}
        <header className="sticky top-0 z-50 border-b border-white/10 bg-black/70 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
            <Link href="/" className="text-sm font-semibold tracking-wide text-white/90 hover:text-white">
              Cosmeles
            </Link>

            <nav className="hidden gap-6 text-sm text-white/70 md:flex">
              {TOP_CATEGORIES.map((k) => (
                <Link key={k} href={`/c/${k}`} className="hover:text-white">
                  {CATEGORY_CONFIG[k].zh}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <Link
                href="/compare"
                className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
              >
                横向对比
              </Link>
            </div>
          </div>
        </header>

        {children}

        <footer className="border-t border-white/10 bg-black">
          <div className="mx-auto max-w-6xl px-6 py-10 text-xs text-white/50">
            Demo · Cosmeles · 仅用于橱窗体验验证
          </div>
        </footer>
      </body>
    </html>
  );
}