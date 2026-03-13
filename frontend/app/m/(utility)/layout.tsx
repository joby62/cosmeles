import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import MobileTopBar from "@/components/mobile/MobileTopBar";

export default function MobileUtilityLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-50">
        <MobileTopBar />
      </header>
      <main className="m-mobile-main mx-auto max-w-[680px] px-4 py-6">{children}</main>
      <MobileBottomNav />
    </>
  );
}
