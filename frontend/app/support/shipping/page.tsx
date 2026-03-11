import FeatureShell from "@/components/site/FeatureShell";

const shippingPoints = [
  "US shipping will be surfaced before checkout, not buried at the end.",
  "Processing windows, delivery estimates, and tracking expectations belong in plain language.",
  "Regional delivery promises will stay explicit as UK support is added later.",
];

export default function ShippingPage() {
  return (
    <FeatureShell
      eyebrow="Shipping"
      title="Shipping should feel clear before purchase, not after payment."
      summary="Jeslect is structuring shipping policy around visible expectations: where products ship from, when orders leave the warehouse, and how delivery windows are communicated."
      highlights={["US-first delivery copy", "Visible processing windows", "Tracking expectations"]}
      primaryCta={{ href: "/shop", label: "Return to shop" }}
      secondaryCta={{ href: "/support/faq", label: "Open FAQ" }}
    >
      <div className="space-y-3">
        {shippingPoints.map((item) => (
          <article key={item} className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4 text-[14px] leading-6 text-slate-700">
            {item}
          </article>
        ))}
      </div>
    </FeatureShell>
  );
}
