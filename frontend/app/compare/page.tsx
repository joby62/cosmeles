import Link from "next/link";
import FeatureShell from "@/components/site/FeatureShell";

const steps = [
  {
    title: "Choose a category first",
    summary: "Compare works better when the routine layer stays focused.",
    href: "/shop",
  },
  {
    title: "Open the product profiles",
    summary: "Use product pages to inspect ingredient and fit signals before comparing.",
    href: "/search",
  },
  {
    title: "Return to side-by-side decisions",
    summary: "The rebuilt compare experience will land here as the new storefront catches up.",
    href: "/match",
  },
];

export default function ComparePage() {
  return (
    <FeatureShell
      eyebrow="Compare"
      title="Side-by-side comparison is moving into the new storefront shell."
      summary="The old compare engine already exists, but the public English storefront needs its own decision layout and copy structure. For now, use product profiles as the first review layer."
      highlights={["Ingredient-led differences", "Clearer tradeoff language", "Reusable compare history later"]}
      primaryCta={{ href: "/shop", label: "Browse products" }}
      secondaryCta={{ href: "/search", label: "Search profiles" }}
    >
      <div className="grid gap-3 md:grid-cols-3">
        {steps.map((step) => (
          <Link key={step.title} href={step.href} className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4">
            <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-slate-950">{step.title}</h2>
            <p className="mt-3 text-[14px] leading-6 text-slate-600">{step.summary}</p>
          </Link>
        ))}
      </div>
    </FeatureShell>
  );
}
