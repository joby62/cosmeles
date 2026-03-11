import FeatureShell from "@/components/site/FeatureShell";

const returnPoints = [
  "Return eligibility should be visible before checkout starts.",
  "Refund timing and item condition rules need plain-language summaries.",
  "Exceptions, if any, should be named directly instead of hidden in dense policy text.",
];

export default function ReturnsPage() {
  return (
    <FeatureShell
      eyebrow="Returns"
      title="Returns language should reduce hesitation, not create more of it."
      summary="The new storefront is setting up a visible return path so customers understand the return window, refund timing, and category exceptions without digging through hidden legal copy."
      highlights={["Visible return window", "Refund timing clarity", "Named exceptions"]}
      primaryCta={{ href: "/shop", label: "Back to shop" }}
      secondaryCta={{ href: "/support/contact", label: "Contact support" }}
    >
      <div className="space-y-3">
        {returnPoints.map((item) => (
          <article key={item} className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4 text-[14px] leading-6 text-slate-700">
            {item}
          </article>
        ))}
      </div>
    </FeatureShell>
  );
}
