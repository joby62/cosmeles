import "../globals.css";

export const metadata = {
  title: "予选 · 个护决策工具",
  description: "回答少量问题，直接得到更适合你的护理方向和产品结果。",
};

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return <div className="m-shell min-h-dvh bg-[color:var(--m-bg)] text-[color:var(--m-text)]">{children}</div>;
}
