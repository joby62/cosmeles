import "../globals.css";
import MobileCategoryRail from "@/components/mobile/MobileCategoryRail";

export const metadata = {
  title: "予选 · 浴室里的最终答案",
  description: "以 Apple 式的克制美学，把洗护选择做成低密度、可浏览、可对比的体验。",
};

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[color:var(--bg)] text-black">
      <header className="sticky top-0 z-50">
        <div className="h-12 bg-[color:var(--bg)]/88 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--bg)]/75">
          <div className="mx-auto flex h-12 max-w-[680px] items-center justify-between px-4">
            <div className="text-[14px] font-semibold tracking-[0.01em] text-black/88">予选</div>
            <div className="text-[12px] text-black/45">浴室里的最终答案</div>
          </div>
        </div>
        <MobileCategoryRail />
      </header>

      <main className="mx-auto max-w-[680px] px-4 py-6">{children}</main>
    </div>
  );
}
