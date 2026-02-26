import Link from "next/link";

const CATS = [
  { key: "shampoo", zh: "洗发水", href: "/m/shampoo/start" },
  { key: "bodywash", zh: "沐浴露", href: "/m/bodywash" },
  { key: "conditioner", zh: "护发素", href: "/m/conditioner" },
  { key: "lotion", zh: "润肤霜", href: "/m/lotion" },
  { key: "cleanser", zh: "洗面奶", href: "/m/cleanser" },
] as const;

export default function MobileChoose() {
  return (
    <div>
      <div className="text-[22px] font-semibold tracking-[-0.02em] text-black/90">
        你想先选哪一类？
      </div>
      <div className="mt-4 space-y-3">
        {CATS.map((c) => (
          <Link
            key={c.key}
            href={c.href}
            className="block rounded-[18px] bg-white/70 backdrop-blur px-5 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.08)] active:opacity-90"
          >
            <div className="text-[16px] font-semibold text-black/85">{c.zh}</div>
            <div className="mt-1 text-[13px] text-black/50">进入决策路径</div>
          </Link>
        ))}
      </div>
    </div>
  );
}