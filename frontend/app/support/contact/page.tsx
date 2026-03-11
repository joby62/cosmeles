import FeatureShell from "@/components/site/FeatureShell";
import { CONTACT_ROUTE_SECTIONS, POLICY_SCOPE_NOTE } from "@/lib/storefrontPolicies";

export default function ContactPage() {
  return (
    <FeatureShell
      eyebrow="Contact"
      title="Contact routing should stay clear about what Jeslect can and cannot support today."
      summary="This page defines the support scope for the current US storefront. It is focused on pre-purchase clarity, not live payment or post-order operations."
      metaNote={POLICY_SCOPE_NOTE}
      highlights={["Pre-purchase support", "No order help yet", "Clear request scope"]}
      primaryCta={{ href: "/support/faq", label: "Read FAQ first" }}
      secondaryCta={{ href: "/support", label: "Support hub" }}
    >
      <div className="space-y-4">
        {CONTACT_ROUTE_SECTIONS.map((section) => (
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
