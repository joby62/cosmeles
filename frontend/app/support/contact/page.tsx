import FeatureShell from "@/components/site/FeatureShell";
import { CONTACT_SECTIONS } from "@/lib/storefrontTrust";

export default function ContactPage() {
  return (
    <FeatureShell
      eyebrow="Contact"
      title="Support contact belongs inside the storefront trust layer."
      summary="Jeslect contact trust is built around clear routing. Customers should know where product questions, shipping questions, and returns questions belong before they ever submit a request."
      highlights={["Visible support path", "Response expectations", "Lower-friction help routing"]}
      primaryCta={{ href: "/support/faq", label: "Read FAQ first" }}
      secondaryCta={{ href: "/bag", label: "Open bag" }}
    >
      <div className="space-y-4">
        {CONTACT_SECTIONS.map((section) => (
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
