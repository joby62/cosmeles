import BagPanel from "@/components/site/BagPanel";

export default function BagPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-8">
      <section className="rounded-[40px] border border-black/8 bg-white/92 px-5 py-8 shadow-[0_28px_72px_rgba(15,23,42,0.08)] md:px-8 md:py-10">
        <div className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
          Bag
        </div>
        <h1 className="site-display mt-5 text-[42px] leading-[0.98] tracking-[-0.05em] text-slate-950 sm:text-[56px]">
          Keep the shortlist visible before checkout exists.
        </h1>
        <p className="mt-5 max-w-3xl text-[17px] leading-8 text-slate-600">
          The current bag is a saved shortlist for the US launch build. It already supports product recall and removal while
          checkout, pricing, and order layers are still being rebuilt.
        </p>
      </section>

      <section className="mt-10">
        <BagPanel />
      </section>
    </div>
  );
}
