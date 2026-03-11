import FeatureShell from "@/components/site/FeatureShell";
import { SHIPPING_SECTIONS } from "@/lib/storefrontTrust";

export default function ShippingPage() {
  return (
    <FeatureShell
      eyebrow="Shipping"
      title="Shipping should feel clear before purchase, not after payment."
      summary="Jeslect shipping trust is built around plain-language expectations: what gets shown before checkout, how US delivery is framed first, and which shipping details should never feel hidden."
      highlights={["US-first delivery framing", "Visible processing windows", "Tracking clarity"]}
      primaryCta={{ href: "/bag", label: "Open bag" }}
      secondaryCta={{ href: "/support/faq", label: "Open FAQ" }}
    >
      <div className="space-y-4">
        {SHIPPING_SECTIONS.map((section) => (
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
