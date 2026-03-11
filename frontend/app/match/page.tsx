import Link from "next/link";
import FeatureShell from "@/components/site/FeatureShell";
import { CATEGORIES } from "@/lib/site";

export default function MatchPage() {
  return (
    <FeatureShell
      eyebrow="Match"
      title="Jeslect Match is being rebuilt around the new US storefront."
      summary="The personalized flow will reconnect here once the new shell, copy system, and decision steps are fully migrated. Until then, start with category shopping and product profiles."
      highlights={["Single-task flow", "Lower-friction routine fit", "Resume support"]}
      primaryCta={{ href: "/shop", label: "Shop categories" }}
      secondaryCta={{ href: "/compare", label: "Open compare" }}
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {CATEGORIES.map((category) => (
          <Link
            key={category.key}
            href={`/shop/${category.key}`}
            className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4 text-[14px] font-medium text-slate-700"
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{category.eyebrow}</div>
            <div className="mt-2 text-[18px] font-semibold tracking-[-0.03em] text-slate-950">{category.label}</div>
            <div className="mt-2 text-[13px] leading-6 text-slate-600">{category.routineHint}</div>
          </Link>
        ))}
      </div>
    </FeatureShell>
  );
}
