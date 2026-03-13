import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-12">
      <article className="rounded-[36px] border border-black/8 bg-white/92 px-6 py-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
          页面未找到
        </div>
        <h1 className="site-display mt-5 text-[40px] leading-[0.98] tracking-[-0.05em] text-slate-950">这个地址不在当前婕选中文站的公开路径里。</h1>
        <p className="mt-5 max-w-2xl text-[16px] leading-7 text-slate-600">
          当前独立站已经按新的公开信息架构重建。你可以从首页或选购页重新开始。
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-5 text-[14px] font-semibold text-white"
          >
            返回首页
          </Link>
          <Link
            href="/shop"
            className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[14px] font-semibold text-slate-700"
          >
            进入选购
          </Link>
        </div>
      </article>
    </div>
  );
}
