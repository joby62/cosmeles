import BagPanel from "@/components/site/BagPanel";
import Link from "next/link";
import { BAG_RELEASE_NOTES, BAG_SUPPORT_LINKS, BAG_TRUST_POINTS } from "@/lib/storefrontTrust";

export default function BagPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8">
      <section className="rounded-[40px] border border-black/8 bg-white/92 px-5 py-8 shadow-[0_28px_72px_rgba(15,23,42,0.08)] md:px-8 md:py-10">
        <div className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
          Bag
        </div>
        <h1 className="site-display mt-5 text-[42px] leading-[0.98] tracking-[-0.05em] text-slate-950 sm:text-[56px]">
          Keep your shortlist, trust details, and next step in one place.
        </h1>
        <p className="mt-5 max-w-3xl text-[17px] leading-8 text-slate-600">
          Jeslect Bag is where saved products stay close to product detail, compare, learn, shipping, returns, and support.
          The goal is simple: no hidden basics, no lost shortlist, and no fake checkout signals before real commerce data exists.
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
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Current bag role</p>
            <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-slate-950">
              Keep the shortlist recoverable before checkout goes live.
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
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-sky-700">Need another pass first?</p>
            <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-slate-950">
              Use Match or Compare before you finalize the shortlist.
            </h2>
            <p className="mt-3 text-[15px] leading-7 text-slate-600">
              Match narrows the route. Compare tests close candidates side by side. Bag keeps the surviving products visible while checkout and pricing are still out of scope.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/match"
                className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-5 text-[14px] font-semibold text-white"
              >
                Open match
              </Link>
              <Link
                href="/saved"
                className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[14px] font-semibold text-slate-700"
              >
                Open saved
              </Link>
              <Link
                href="/compare"
                className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[14px] font-semibold text-slate-700"
              >
                Run compare
              </Link>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
