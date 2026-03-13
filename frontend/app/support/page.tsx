import Link from "next/link";
import FeatureShell from "@/components/site/FeatureShell";
import { getStorefrontPolicyCopy } from "@/lib/storefrontPolicies";
import { getRequestSitePreferences } from "@/lib/sitePreferences.server";

export default async function SupportHubPage() {
  const { locale } = await getRequestSitePreferences();
  const { POLICY_SCOPE_NOTE, SUPPORT_HUB_LINKS, SUPPORT_LEGAL_LINKS } = getStorefrontPolicyCopy(locale);
  const copy =
    locale === "zh"
      ? {
          eyebrow: "支持",
          title: "把配送、退货、联系和政策边界收在一个足够清楚的入口里。",
          summary: "当前婕选支持层主要服务于售前决策：商品适配、袋中行为、配送与退货预期，以及当前独立站的真实能力边界。",
          highlights: ["售前支持优先", "政策层持续可见", "站点边界明确表达"],
          primaryCta: "查看常见问题",
          secondaryCta: "打开袋中",
          core: "核心支持",
          coreTitle: "在支付开放前，先把购物基础信息前置出来。",
          legal: "法律与政策",
          legalTitle: "政策语言应该和站点真实能力一致，而不是假装商城已经完整。",
        }
      : {
          eyebrow: "Support",
          title: "Keep shipping, returns, contact, and policy scope in one clear storefront layer.",
          summary: "Jeslect support currently serves pre-purchase decisions first: product fit, bag behavior, shipping and returns expectations, and the actual boundary of the current storefront build.",
          highlights: ["Pre-purchase support first", "Policy layer stays visible", "Scope stays explicit"],
          primaryCta: "Read FAQ",
          secondaryCta: "Open bag",
          core: "Core support",
          coreTitle: "Before checkout opens, the shopping basics need to stay visible.",
          legal: "Legal and policy",
          legalTitle: "Policy language should match the storefront that actually exists, not an imaginary finished commerce stack.",
        };

  return (
    <FeatureShell
      eyebrow={copy.eyebrow}
      title={copy.title}
      summary={copy.summary}
      metaNote={POLICY_SCOPE_NOTE}
      highlights={copy.highlights}
      primaryCta={{ href: "/support/faq", label: copy.primaryCta }}
      secondaryCta={{ href: "/bag", label: copy.secondaryCta }}
    >
      <div className="space-y-8">
        <section>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{copy.core}</p>
              <h2 className="mt-3 text-[24px] font-semibold tracking-[-0.03em] text-slate-950">{copy.coreTitle}</h2>
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{copy.legal}</p>
            <h2 className="mt-3 text-[24px] font-semibold tracking-[-0.03em] text-slate-950">{copy.legalTitle}</h2>
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
