import FeatureShell from "@/components/site/FeatureShell";
import { getStorefrontPolicyCopy } from "@/lib/storefrontPolicies";
import { getRequestSitePreferences } from "@/lib/sitePreferences.server";

export default async function ReturnsPage() {
  const { locale } = await getRequestSitePreferences();
  const { POLICY_SCOPE_NOTE, RETURNS_POLICY_SECTIONS } = getStorefrontPolicyCopy(locale);
  const copy =
    locale === "zh"
      ? {
          eyebrow: "退货",
          title: "退货规则应该降低犹豫，而不是制造新的担心。",
          summary: "这里定义婕选当前独立站的退货基线：哪些内容今天就该能读懂，退货信任如何嵌进商品和袋中的决策链路，以及哪些部分仍依赖后续运营落地。",
          highlights: ["时限前置", "条件直白", "例外不隐藏"],
          primaryCta: "返回支持中心",
          secondaryCta: "联系支持",
        }
      : {
          eyebrow: "Returns",
          title: "Returns language should reduce hesitation instead of creating more friction.",
          summary: "This page defines the current returns baseline for Jeslect: what should already be readable today, how return trust fits into product and bag decisions, and which pieces still depend on launch operations.",
          highlights: ["Return window visible early", "Plain-language conditions", "Exceptions stay explicit"],
          primaryCta: "Back to support",
          secondaryCta: "Contact support",
        };
  return (
    <FeatureShell
      eyebrow={copy.eyebrow}
      title={copy.title}
      summary={copy.summary}
      metaNote={POLICY_SCOPE_NOTE}
      highlights={copy.highlights}
      primaryCta={{ href: "/support", label: copy.primaryCta }}
      secondaryCta={{ href: "/support/contact", label: copy.secondaryCta }}
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
