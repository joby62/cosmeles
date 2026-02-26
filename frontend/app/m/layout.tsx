import "../globals.css";

export const metadata = {
  title: "予选 · 浴室里的最终答案",
  description: "以 Apple 式的克制美学，把洗护选择做成低密度、可浏览、可对比的体验。",
};

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[color:var(--bg)] text-black">
      {/* Mobile Shell：先留极简头部，后面你再做 Apple Store 式顶部栏 */}
      <header className="sticky top-0 z-50">
        <div className="h-12 bg-[color:var(--bg)]/88 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--bg)]/75">
          <div className="mx-auto flex h-12 max-w-[680px] items-center px-4">
            <div className="text-[13px] font-semibold tracking-[0.02em] text-black/85">
              予选
            </div>
          </div>
        </div>
        <div className="h-px bg-black/[0.06]" />
      </header>

      <main className="mx-auto max-w-[680px] px-4 py-6">{children}</main>
    </div>
  );
}