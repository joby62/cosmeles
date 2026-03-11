import Link from "next/link";

type MobileSelectionStartHeroProps = {
  categoryLabel: string;
  startHref: string;
  backHref?: string;
  pageTitle?: string;
  primaryLabel?: string;
};

export default function MobileSelectionStartHero({
  categoryLabel,
  startHref,
  backHref = "/m/choose",
  pageTitle = "开始测配",
  primaryLabel = "开始测配",
}: MobileSelectionStartHeroProps) {
  return (
    <section className="pb-10">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[26px] leading-[1.14] font-semibold tracking-[-0.02em] text-black/90">{pageTitle}</h1>
        <Link
          href={backHref}
          className="inline-flex h-9 items-center rounded-full border border-black/12 bg-white/70 px-4 text-[13px] font-medium text-black/70 active:bg-black/[0.03]"
        >
          返回
        </Link>
      </div>

      <article className="relative mt-5 overflow-hidden rounded-[32px] border border-black/10 bg-white/84 px-6 py-7 shadow-[0_18px_48px_rgba(23,52,98,0.12)] backdrop-blur-[14px]">
        <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-[#6bb3ff]/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-14 -left-8 h-44 w-44 rounded-full bg-[#7f8fff]/30 blur-3xl" />

        <div className="relative z-[1]">
          <div className="inline-flex h-7 items-center rounded-full border border-[#c8dbff] bg-[#edf5ff] px-3 text-[11px] font-semibold tracking-[0.03em] text-[#2f5db2] dark:border-[#6f95d8]/48 dark:bg-[#223a62]/76 dark:text-[#b8d7ff]">
            {categoryLabel}
          </div>

          <h2 className="mt-4 text-[34px] leading-[1.08] font-semibold tracking-[-0.03em] text-black/92">
            {categoryLabel} · 浴室里的最终答案
          </h2>

          <div className="mt-7">
            <Link
              href={startHref}
              className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-6 text-[15px] font-semibold text-white shadow-[0_12px_28px_rgba(0,113,227,0.3)] active:opacity-95"
            >
              {primaryLabel}
            </Link>
          </div>
        </div>
      </article>
    </section>
  );
}
