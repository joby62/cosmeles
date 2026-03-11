import FeatureShell from "@/components/site/FeatureShell";
import { POLICY_SCOPE_NOTE, TERMS_SECTIONS } from "@/lib/storefrontPolicies";

export default function TermsPage() {
  return (
    <FeatureShell
      eyebrow="Terms"
      title="Terms should match the real storefront scope, not an imaginary completed shop."
      summary="These terms describe the current Jeslect US storefront as it exists today: discovery, fit, compare, learn, saved shortlist behavior, and public policy content before checkout is launched."
      metaNote={POLICY_SCOPE_NOTE}
      highlights={["Current scope only", "Bag is not an order", "Readable rules"]}
      primaryCta={{ href: "/privacy", label: "Privacy page" }}
      secondaryCta={{ href: "/support", label: "Support hub" }}
    >
      <div className="space-y-4">
        {TERMS_SECTIONS.map((section) => (
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
