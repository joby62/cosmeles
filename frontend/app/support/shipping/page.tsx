import FeatureShell from "@/components/site/FeatureShell";
import { POLICY_SCOPE_NOTE, SHIPPING_POLICY_SECTIONS } from "@/lib/storefrontPolicies";

export default function ShippingPage() {
  return (
    <FeatureShell
      eyebrow="Shipping"
      title="Shipping should stay readable before a customer ever reaches payment."
      summary="This page defines how Jeslect frames shipping on the current US pre-checkout storefront: what should already be visible now, what belongs in the future commerce feed, and which details should never feel hidden."
      metaNote={POLICY_SCOPE_NOTE}
      highlights={["US-first shipping scope", "Readable pre-order timing", "No hidden delivery basics"]}
      primaryCta={{ href: "/support", label: "Support hub" }}
      secondaryCta={{ href: "/bag", label: "Open bag" }}
    >
      <div className="space-y-4">
        {SHIPPING_POLICY_SECTIONS.map((section) => (
          <article key={section.title} className="rounded-[28px] border border-black/8 bg-slate-50 px-5 py-5">
            <h2 className="text-[20px] font-semibold tracking-[-0.03em] text-slate-950">{section.title}</h2>
            <div className="mt-4 space-y-2">
              {section.items.map((item) => (
                <p key={item} className="text-[14px] leading-6 text-slate-700">
                  {item}
                </p>
              ))}
            </div>
          </article>
        ))}
      </div>
    </FeatureShell>
  );
}
