import FeatureShell from "@/components/site/FeatureShell";
import { FAQ_ITEMS } from "@/lib/storefrontTrust";

export default function FaqPage() {
  return (
    <FeatureShell
      eyebrow="FAQ"
      title="Put the common questions in front of the customer early."
      summary="Jeslect FAQ is structured around the pre-purchase confidence layer: saved bag behavior, match and compare logic, and where support information stays visible."
      highlights={["Shopping confidence", "Catalog-only honesty", "Support visibility"]}
      primaryCta={{ href: "/bag", label: "Open bag" }}
      secondaryCta={{ href: "/support/contact", label: "Contact support" }}
    >
      <div className="space-y-3">
        {FAQ_ITEMS.map((item) => (
          <article key={item.question} className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4">
            <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-slate-950">{item.question}</h2>
            <p className="mt-3 text-[14px] leading-6 text-slate-600">{item.answer}</p>
          </article>
        ))}
      </div>
    </FeatureShell>
  );
}
