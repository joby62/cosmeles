import FeatureShell from "@/components/site/FeatureShell";
import { getStorefrontPolicyCopy } from "@/lib/storefrontPolicies";
import { getRequestSitePreferences } from "@/lib/sitePreferences.server";

export default async function ShippingPage() {
  const { locale } = await getRequestSitePreferences();
  const { POLICY_SCOPE_NOTE, SHIPPING_POLICY_SECTIONS } = getStorefrontPolicyCopy(locale);
  const copy =
    locale === "zh"
      ? {
          eyebrow: "配送",
          title: "在支付开放前，配送信息也应该先讲清楚。",
          summary: "这里定义的是婕选当前独立站如何表达配送：哪些内容现在就该可见，哪些字段仍依赖后续 commerce feed，以及哪些基础信息不该被隐藏。",
          highlights: ["美国市场优先", "时效表达可读", "基础配送信息前置"],
          primaryCta: "返回支持中心",
          secondaryCta: "查看袋中",
        }
      : {
          eyebrow: "Shipping",
          title: "Shipping expectations should be readable before checkout exists.",
          summary: "This page defines how Jeslect frames shipping on the current storefront: which details should already be visible, which fields still depend on a real commerce feed, and which basics should never feel hidden.",
          highlights: ["US-first framing", "Readable delivery timing", "Shipping basics surface early"],
          primaryCta: "Back to support",
          secondaryCta: "View bag",
        };
  return (
    <FeatureShell
      eyebrow={copy.eyebrow}
      title={copy.title}
      summary={copy.summary}
      metaNote={POLICY_SCOPE_NOTE}
      highlights={copy.highlights}
      primaryCta={{ href: "/support", label: copy.primaryCta }}
      secondaryCta={{ href: "/bag", label: copy.secondaryCta }}
    >
      <div className="space-y-4">
        {SHIPPING_POLICY_SECTIONS.map((section) => (
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
