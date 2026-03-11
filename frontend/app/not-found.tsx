import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-12">
      <article className="rounded-[36px] border border-black/8 bg-white/92 px-6 py-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
          Page not found
        </div>
        <h1 className="site-display mt-5 text-[40px] leading-[0.98] tracking-[-0.05em] text-slate-950">This route is not part of the new Jeslect storefront.</h1>
        <p className="mt-5 max-w-2xl text-[16px] leading-7 text-slate-600">
          The new storefront is being rebuilt with a different public information architecture. Start again from Home or Shop.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-5 text-[14px] font-semibold text-white"
          >
            Home
          </Link>
          <Link
            href="/shop"
            className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[14px] font-semibold text-slate-700"
          >
            Shop
          </Link>
        </div>
      </article>
    </div>
  );
}
