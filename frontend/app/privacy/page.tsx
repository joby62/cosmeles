import FeatureShell from "@/components/site/FeatureShell";
import { POLICY_SCOPE_NOTE, PRIVACY_SECTIONS } from "@/lib/storefrontPolicies";

export default function PrivacyPage() {
  return (
    <FeatureShell
      eyebrow="Privacy"
      title="Privacy should explain the current data scope without hiding behind legal fog."
      summary="This page covers what the current Jeslect US storefront uses to run browsing, saved state, fit tools, and support-layer visibility. It also clarifies what this build does not collect yet."
      metaNote={POLICY_SCOPE_NOTE}
      highlights={["Current data scope", "No checkout data yet", "Readable US baseline"]}
      primaryCta={{ href: "/cookies", label: "Cookie choices" }}
      secondaryCta={{ href: "/support", label: "Support hub" }}
    >
      <div className="space-y-4">
        {PRIVACY_SECTIONS.map((section) => (
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
