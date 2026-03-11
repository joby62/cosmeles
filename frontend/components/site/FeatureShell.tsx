import type { ReactNode } from "react";
import Link from "next/link";

type FeatureShellProps = {
  eyebrow: string;
  title: string;
  summary: string;
  highlights: string[];
  primaryCta?: { href: string; label: string };
  secondaryCta?: { href: string; label: string };
  children?: ReactNode;
};

export default function FeatureShell({
  eyebrow,
  title,
  summary,
  highlights,
  primaryCta,
  secondaryCta,
  children,
}: FeatureShellProps) {
  return (
    <section className="mx-auto max-w-5xl px-4 py-10">
      <div className="overflow-hidden rounded-[36px] border border-black/8 bg-white/92 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] md:p-8">
        <div className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
          {eyebrow}
        </div>
        <h1 className="mt-4 text-[36px] font-semibold leading-[1.02] tracking-[-0.04em] text-slate-950 md:text-[52px]">
          {title}
        </h1>
        <p className="mt-4 max-w-3xl text-[16px] leading-7 text-slate-600">{summary}</p>

        <div className="mt-6 flex flex-wrap gap-2">
          {highlights.map((item) => (
            <span
              key={item}
              className="inline-flex rounded-full border border-black/8 bg-slate-50 px-3 py-1.5 text-[12px] font-medium text-slate-700"
            >
              {item}
            </span>
          ))}
        </div>

        {(primaryCta || secondaryCta) ? (
          <div className="mt-7 flex flex-wrap gap-3">
            {primaryCta ? (
              <Link
                href={primaryCta.href}
                className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-5 text-[14px] font-semibold text-white shadow-[0_12px_30px_rgba(0,113,227,0.26)]"
              >
                {primaryCta.label}
              </Link>
            ) : null}
            {secondaryCta ? (
              <Link
                href={secondaryCta.href}
                className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[14px] font-semibold text-slate-700"
              >
                {secondaryCta.label}
              </Link>
            ) : null}
          </div>
        ) : null}

        {children ? <div className="mt-8">{children}</div> : null}
      </div>
    </section>
  );
}
