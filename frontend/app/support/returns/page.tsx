import FeatureShell from "@/components/site/FeatureShell";
import { RETURNS_SECTIONS } from "@/lib/storefrontTrust";

export default function ReturnsPage() {
  return (
    <FeatureShell
      eyebrow="Returns"
      title="Returns language should reduce hesitation, not create more of it."
      summary="Jeslect returns trust is built around three things: visible timing, understandable condition rules, and no surprise exceptions hidden at the very end."
      highlights={["Visible return window", "Refund timing clarity", "Named exceptions"]}
      primaryCta={{ href: "/bag", label: "Open bag" }}
      secondaryCta={{ href: "/support/contact", label: "Contact support" }}
    >
      <div className="space-y-4">
        {RETURNS_SECTIONS.map((section) => (
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
