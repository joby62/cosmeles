import FeatureShell from "@/components/site/FeatureShell";
import { COOKIE_SECTIONS, POLICY_SCOPE_NOTE } from "@/lib/storefrontPolicies";

export default function CookiesPage() {
  return (
    <FeatureShell
      eyebrow="Cookies"
      title="Cookie explanations should separate required storefront state from everything optional."
      summary="Jeslect currently relies on necessary state to keep Bag, Saved, Match, and Compare recoverable. Optional analytics or advertising tools should remain separate and readable if they are added later."
      metaNote={POLICY_SCOPE_NOTE}
      highlights={["Necessary state first", "Optional tools separate", "Mobile-readable choices"]}
      primaryCta={{ href: "/privacy", label: "Privacy page" }}
      secondaryCta={{ href: "/support", label: "Support hub" }}
    >
      <div className="space-y-4">
        {COOKIE_SECTIONS.map((section) => (
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
