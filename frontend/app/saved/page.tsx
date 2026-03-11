import Link from "next/link";
import SavedHub from "@/components/site/SavedHub";
import { SAVED_SUPPORT_LINKS, SAVED_TRUST_POINTS } from "@/lib/storefrontTrust";

export default function SavedPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8">
      <section className="rounded-[40px] border border-black/8 bg-white/92 px-5 py-8 shadow-[0_28px_72px_rgba(15,23,42,0.08)] md:px-8 md:py-10">
        <div className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
          Saved
        </div>
        <h1 className="site-display mt-5 text-[42px] leading-[0.98] tracking-[-0.05em] text-slate-950 sm:text-[56px]">
          Keep bag, match, compare, and recent product paths in one place.
        </h1>
        <p className="mt-5 max-w-3xl text-[17px] leading-8 text-slate-600">
          Jeslect should not make you rebuild the same decision twice. This page keeps the device-level shortlist,
          saved route basis, compare history, and recent product views recoverable from one English storefront hub.
        </p>

        <div className="mt-7 grid gap-3 md:grid-cols-3">
          {SAVED_TRUST_POINTS.map((item) => (
            <article
              key={item}
              className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4 text-[14px] leading-6 text-slate-700"
            >
              {item}
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div>
          <SavedHub />
        </div>

        <div className="space-y-6">
          <article className="rounded-[32px] border border-black/8 bg-white/92 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Keep trust visible</p>
            <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-slate-950">
              Recovery only works if shipping, returns, and support stay one step away.
            </h2>
            <div className="mt-5 space-y-3">
              {SAVED_SUPPORT_LINKS.map((item) => (
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
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-sky-700">Use the full decision chain</p>
            <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-slate-950">
              Move between Match, Compare, Learn, and Bag without losing the thread.
            </h2>
            <p className="mt-3 text-[15px] leading-7 text-slate-600">
              Saved is the recovery layer. Match narrows the route, Compare tests close options, Learn adds clarity, and Bag
              keeps the final shortlist visible.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/match"
                className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-5 text-[14px] font-semibold text-white"
              >
                Open match
              </Link>
              <Link
                href="/compare"
                className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[14px] font-semibold text-slate-700"
              >
                Run compare
              </Link>
              <Link
                href="/learn"
                className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[14px] font-semibold text-slate-700"
              >
                Read learn
              </Link>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
