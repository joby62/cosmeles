import Link from "next/link";
import FeatureShell from "@/components/site/FeatureShell";
import { POLICY_SCOPE_NOTE, SUPPORT_HUB_LINKS, SUPPORT_LEGAL_LINKS } from "@/lib/storefrontPolicies";

export default function SupportHubPage() {
  return (
    <FeatureShell
      eyebrow="Support"
      title="Keep policy, support, and launch-scope answers in one place."
      summary="Jeslect support is currently focused on pre-purchase clarity for the US storefront: fit questions, Bag behavior, shipping and returns expectations, and the legal scope of this pre-checkout build."
      metaNote={POLICY_SCOPE_NOTE}
      highlights={["US pre-checkout scope", "Visible policy layer", "Pre-purchase support only"]}
      primaryCta={{ href: "/support/faq", label: "Read FAQ" }}
      secondaryCta={{ href: "/bag", label: "Open bag" }}
    >
      <div className="space-y-8">
        <section>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Core support</p>
              <h2 className="mt-3 text-[24px] font-semibold tracking-[-0.03em] text-slate-950">Keep the shopping basics visible before checkout exists.</h2>
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {SUPPORT_HUB_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-[28px] border border-black/8 bg-slate-50 px-5 py-5 transition hover:-translate-y-[1px] hover:bg-white hover:shadow-[0_12px_28px_rgba(15,23,42,0.05)]"
              >
                <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-slate-950">{item.title}</h2>
                <p className="mt-3 text-[14px] leading-6 text-slate-600">{item.summary}</p>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Legal scope</p>
            <h2 className="mt-3 text-[24px] font-semibold tracking-[-0.03em] text-slate-950">Keep policy language aligned with the real storefront scope.</h2>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {SUPPORT_LEGAL_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-[28px] border border-black/8 bg-slate-50 px-5 py-5 transition hover:-translate-y-[1px] hover:bg-white hover:shadow-[0_12px_28px_rgba(15,23,42,0.05)]"
              >
                <h2 className="text-[20px] font-semibold tracking-[-0.03em] text-slate-950">{item.title}</h2>
                <p className="mt-3 text-[14px] leading-6 text-slate-600">{item.summary}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </FeatureShell>
  );
}
