import Link from "next/link";

const CATS = [
  { key: "shampoo", zh: "洗发水", note: "已开放", href: "/m/shampoo/start", open: true },
  { key: "bodywash", zh: "沐浴露", note: "即将开放", href: "", open: false },
  { key: "conditioner", zh: "护发素", note: "即将开放", href: "", open: false },
  { key: "lotion", zh: "润肤露", note: "即将开放", href: "", open: false },
  { key: "cleanser", zh: "洗面奶", note: "即将开放", href: "", open: false },
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
              className="w-[170px] shrink-0 rounded-3xl border border-black/10 bg-white px-4 py-4 active:bg-black/[0.03]"
            >
              <div className="inline-flex h-8 items-center rounded-full bg-black/[0.06] px-3 text-[12px] text-black/60">
                {c.note}
              </div>
              <div className="mt-3 text-[22px] font-semibold tracking-[-0.02em] text-black/88">{c.zh}</div>
              <div className="mt-5 text-[13px] text-black/45">进入唯一答案路径</div>
            </Link>
          ) : (
            <div
              key={c.key}
              className="w-[170px] shrink-0 rounded-3xl border border-black/8 bg-black/[0.015] px-4 py-4"
            >
              <div className="inline-flex h-8 items-center rounded-full bg-black/[0.05] px-3 text-[12px] text-black/45">
                {c.note}
              </div>
              <div className="mt-3 text-[22px] font-semibold tracking-[-0.02em] text-black/55">{c.zh}</div>
              <div className="mt-5 text-[13px] text-black/35">暂未开放</div>
            </div>
          )
        ))}
        </div>
      </div>
    </div>
  );
}
