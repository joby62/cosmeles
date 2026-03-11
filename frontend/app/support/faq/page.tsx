import FeatureShell from "@/components/site/FeatureShell";
import { POLICY_SCOPE_NOTE, SUPPORT_FAQ_ITEMS } from "@/lib/storefrontPolicies";

export default function FaqPage() {
  return (
    <FeatureShell
      eyebrow="FAQ"
      title="Put the common storefront-scope questions where customers can find them early."
      summary="Jeslect FAQ is structured around pre-purchase clarity for the US launch: bag continuity, fit-tool logic, current commerce limits, and where support and policy answers live while checkout is still out of scope."
      metaNote={POLICY_SCOPE_NOTE}
      highlights={["Launch-scope honesty", "Fit-tool clarity", "Visible support paths"]}
      primaryCta={{ href: "/support", label: "Support hub" }}
      secondaryCta={{ href: "/support/contact", label: "Contact support" }}
    >
      <div className="space-y-3">
        {SUPPORT_FAQ_ITEMS.map((item) => (
          <article key={item.question} className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4">
            <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-slate-950">{item.question}</h2>
            <p className="mt-3 text-[14px] leading-6 text-slate-600">{item.answer}</p>
          </article>
        ))}
      </div>
    </FeatureShell>
  );
}
