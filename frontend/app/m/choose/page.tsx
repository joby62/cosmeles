import Link from "next/link";

const CATS = [
  { key: "shampoo", zh: "洗发水", note: "已开放", href: "/m/shampoo/start", open: true, image: "/m/categories/shampoo.png" },
  { key: "bodywash", zh: "沐浴露", note: "已开放", href: "/m/bodywash/start", open: true, image: "/m/categories/bodywash.png" },
  { key: "conditioner", zh: "护发素", note: "已开放", href: "/m/conditioner/start", open: true, image: "/m/categories/conditioner.png" },
  { key: "lotion", zh: "润肤霜", note: "即将开放", href: "", open: false, image: "/m/categories/lotion.png" },
  { key: "cleanser", zh: "洗面奶", note: "即将开放", href: "", open: false, image: "/m/categories/cleanser.png" },
] as const;

export default function MobileChoose() {
  return (
    <div>
      <div className="text-[13px] font-medium text-black/45">选择品类</div>
      <div className="mt-2 text-[28px] leading-[1.12] font-semibold tracking-[-0.02em] text-black/90">
        你想先解决哪一件
      </div>
      <p className="mt-2 text-[15px] leading-[1.52] text-black/58">
        横向滑动，进入对应决策路径。每个品类只会给一个最终答案。
      </p>

      <div className="mt-6 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max gap-3">
        {CATS.map((c) => (
          c.open ? (
            <Link
              key={c.key}
              href={c.href}
              className="relative aspect-square w-[188px] shrink-0 overflow-hidden rounded-3xl border border-black/10 bg-white p-3 active:bg-black/[0.03]"
            >
              <img src={c.image} alt={c.zh} className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/72 via-white/20 to-transparent" />
              <div className="relative z-10 flex h-full flex-col">
                <div className="inline-flex h-8 w-fit items-center rounded-full bg-white/86 px-3 text-[12px] text-black/62">
                  {c.note}
                </div>
                <div className="mt-4 text-[22px] font-semibold tracking-[-0.02em] text-black/90">{c.zh}</div>
                <div className="mt-3 text-[13px] text-black/56">进入唯一答案路径</div>
              </div>
            </Link>
          ) : (
            <div
              key={c.key}
              className="relative aspect-square w-[188px] shrink-0 overflow-hidden rounded-3xl border border-black/8 bg-black/[0.015] p-3"
            >
              <img
                src={c.image}
                alt={c.zh}
                className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-62"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/74 via-white/30 to-transparent" />
              <div className="relative z-10 flex h-full flex-col">
                <div className="inline-flex h-8 w-fit items-center rounded-full bg-white/84 px-3 text-[12px] text-black/45">
                  {c.note}
                </div>
                <div className="mt-4 text-[22px] font-semibold tracking-[-0.02em] text-black/58">{c.zh}</div>
                <div className="mt-3 text-[13px] text-black/38">暂未开放</div>
              </div>
            </div>
          )
        ))}
        </div>
      </div>
    </div>
  );
}
