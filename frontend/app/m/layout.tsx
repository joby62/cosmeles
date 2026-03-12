import "../globals.css";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import MobileLocationConsent from "@/components/mobile/MobileLocationConsent";
import MobileTopBar from "@/components/mobile/MobileTopBar";

export const metadata = {
  title: "予选 · 浴室里的最终答案",
  description: "以 Apple 式的克制美学，把洗护选择做成低密度、可浏览、可对比的体验。",
};

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="m-shell min-h-dvh bg-[color:var(--m-bg)] text-[color:var(--m-text)]">
      <header className="sticky top-0 z-50">
        <MobileTopBar />
      </header>

      <main className="m-mobile-main mx-auto max-w-[680px] px-4 py-6">{children}</main>
      <MobileLocationConsent />
      <MobileBottomNav />
    </div>
  );
}
