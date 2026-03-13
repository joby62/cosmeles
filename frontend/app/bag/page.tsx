import BagPanel from "@/components/site/BagPanel";
import Link from "next/link";
import { BAG_RELEASE_NOTES, BAG_SUPPORT_LINKS, BAG_TRUST_POINTS } from "@/lib/storefrontTrust";

export default function BagPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8">
      <section className="rounded-[40px] border border-black/8 bg-white/92 px-5 py-8 shadow-[0_28px_72px_rgba(15,23,42,0.08)] md:px-8 md:py-10">
        <div className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
          袋中
        </div>
        <h1 className="site-display mt-5 text-[42px] leading-[0.98] tracking-[-0.05em] text-slate-950 sm:text-[56px]">
          把 shortlist、支持信息和下一步动作放在同一处。
        </h1>
        <p className="mt-5 max-w-3xl text-[17px] leading-8 text-slate-600">
          婕选的袋中页，不只是暂存商品，也应该把商品详情、对比、探索、配送、退货和支持入口都维持在一步之内。
          目标很简单：基础信息不隐藏，shortlist 不丢失，在真实 commerce 字段接通前也不伪装成完整购物车。
        </p>

        <div className="mt-7 grid gap-3 md:grid-cols-3">
          {BAG_TRUST_POINTS.map((item) => (
            <article
              key={item}
              className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4 text-[14px] leading-6 text-slate-700"
            >
              {item}
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10 grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <div>
          <BagPanel />
        </div>

        <div className="space-y-6">
          <article className="rounded-[32px] border border-black/8 bg-white/92 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">当前角色</p>
            <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-slate-950">
              在支付开放前，先保证 shortlist 可恢复、可继续判断。
            </h2>
            <div className="mt-5 space-y-2">
              {BAG_RELEASE_NOTES.map((item) => (
                <p key={item} className="text-[14px] leading-6 text-slate-700">
                  {item}
                </p>
              ))}
            </div>
            <div className="mt-5 space-y-3">
              {BAG_SUPPORT_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4 transition hover:-translate-y-[1px] hover:bg-white hover:shadow-[0_12px_28px_rgba(15,23,42,0.05)]"
                >
                  <h3 className="text-[18px] font-semibold tracking-[-0.03em] text-slate-950">{item.title}</h3>
                  <p className="mt-2 text-[14px] leading-6 text-slate-600">{item.summary}</p>
                </Link>
              ))}
            </div>
          </article>

          <article className="rounded-[32px] border border-black/8 bg-[linear-gradient(180deg,#eef6ff_0%,#ffffff_100%)] p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-sky-700">还想再看一轮？</p>
            <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-slate-950">
              在最终留下 shortlist 前，先去测配或对比。
            </h2>
            <p className="mt-3 text-[15px] leading-7 text-slate-600">
              测配负责收窄路线，对比负责并排判断近似候选；袋中则让留下来的商品继续保持可见，直到支付和价格能力逐步接上。
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/match"
                className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-5 text-[14px] font-semibold text-white"
              >
                去测配
              </Link>
              <Link
                href="/saved"
                className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[14px] font-semibold text-slate-700"
              >
                查看已存
              </Link>
              <Link
                href="/compare"
                className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[14px] font-semibold text-slate-700"
              >
                去对比
              </Link>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
