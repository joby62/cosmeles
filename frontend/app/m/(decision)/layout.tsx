export default function MobileDecisionLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-dvh max-w-[680px] px-4 pb-[calc(env(safe-area-inset-bottom)+36px)] pt-[calc(env(safe-area-inset-top)+24px)]">
      {children}
    </main>
  );
}
