import FeatureShell from "@/components/site/FeatureShell";
import { POLICY_SCOPE_NOTE, RETURNS_POLICY_SECTIONS } from "@/lib/storefrontPolicies";

export default function ReturnsPage() {
  return (
    <FeatureShell
      eyebrow="Returns"
      title="Returns language should reduce hesitation before ordering opens."
      summary="This page sets the current Jeslect return baseline for the US storefront: what should already be understandable today, how return trust fits into product and bag decisions, and which pieces still depend on live commerce operations."
      metaNote={POLICY_SCOPE_NOTE}
      highlights={["Visible timing", "Readable conditions", "No hidden exceptions"]}
      primaryCta={{ href: "/support", label: "Support hub" }}
      secondaryCta={{ href: "/support/contact", label: "Contact support" }}
    >
      <div className="space-y-4">
        {RETURNS_POLICY_SECTIONS.map((section) => (
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
