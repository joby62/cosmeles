import Link from "next/link";

export default function MobileHome() {
  return (
    <div className="pb-10">
      <h1 className="text-[44px] leading-[1.02] font-semibold tracking-[-0.03em] text-black/92">予选</h1>
      <p className="mt-2 text-[17px] leading-[1.35] font-semibold text-black/70">省下挑花眼的时间，只留最对位的一件。</p>

      <section className="mt-8">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-black/80">开始选择</h2>
        <div className="mt-3 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-3">
            <Link
              href="/m/shampoo/start"
              className="w-[172px] shrink-0 rounded-3xl border border-black/10 bg-white px-4 py-4 active:bg-black/[0.03]"
            >
              <div className="text-[38px] leading-none">🧴</div>
              <div className="mt-4 text-[22px] font-semibold tracking-[-0.02em] text-black/90">洗发露</div>
            </Link>

            <div className="w-[172px] shrink-0 rounded-3xl border border-black/8 bg-black/[0.02] px-4 py-4">
              <div className="text-[38px] leading-none opacity-45">🫧</div>
              <div className="mt-4 text-[22px] font-semibold tracking-[-0.02em] text-black/45">沐浴露</div>
            </div>

            <div className="w-[172px] shrink-0 rounded-3xl border border-black/8 bg-black/[0.02] px-4 py-4">
              <div className="text-[38px] leading-none opacity-45">🧪</div>
              <div className="mt-4 text-[22px] font-semibold tracking-[-0.02em] text-black/45">护发素</div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-9 rounded-3xl border border-dashed border-black/15 bg-white/40 px-5 py-7">
        <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-black/80">中间模块预留</h2>
        <p className="mt-2 text-[14px] leading-[1.55] text-black/52">
          这里先留空，后续放「本周建议」或「最近命中率最高的一题」。
        </p>
        <div className="mt-5">
          <Link
            href="/m/choose"
            className="inline-flex h-10 items-center justify-center rounded-full border border-black/15 bg-white px-4 text-[14px] font-semibold text-black/75 active:bg-black/[0.03]"
          >
            查看完整路径
          </Link>
        </div>
      </section>
    </div>
  );
}
