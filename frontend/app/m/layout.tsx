import "../globals.css";
import MobileCategoryRail from "@/components/mobile/MobileCategoryRail";
import MobileTopBar from "@/components/mobile/MobileTopBar";

export const metadata = {
  title: "予选 · 省下挑花眼的时间，只留最对位的一件。",
  description: "以 Apple 式的克制美学，把洗护选择做成低密度、可浏览、可对比的体验。",
};

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[color:var(--bg)] text-black">
      <header className="sticky top-0 z-50">
        <MobileTopBar />
        <MobileCategoryRail />
      </header>

      <main className="mx-auto max-w-[680px] px-4 py-6">{children}</main>
    </div>
  );
}
