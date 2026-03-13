import FeatureShell from "@/components/site/FeatureShell";
import { getStorefrontPolicyCopy } from "@/lib/storefrontPolicies";
import { getRequestSitePreferences } from "@/lib/sitePreferences.server";

export default async function FaqPage() {
  const { locale } = await getRequestSitePreferences();
  const { POLICY_SCOPE_NOTE, SUPPORT_FAQ_ITEMS } = getStorefrontPolicyCopy(locale);
  const copy =
    locale === "zh"
      ? {
          eyebrow: "常见问题",
          title: "把用户最常问的站点边界问题，放到足够早就能看见的位置。",
          summary: "婕选 FAQ 主要围绕售前清晰度展开：袋中连续性、测配与对比的关系、当前 commerce 能力边界，以及支持与政策入口在哪里。",
          highlights: ["能力边界坦诚", "适配工具说清楚", "支持路径可见"],
          primaryCta: "返回支持中心",
          secondaryCta: "联系支持",
        }
      : {
          eyebrow: "FAQ",
          title: "Put the most common storefront-boundary questions where people can see them early.",
          summary: "Jeslect FAQ is mainly about pre-purchase clarity: bag continuity, how Match and Compare connect, the current commerce boundary, and where support or policy links live.",
          highlights: ["Scope stays honest", "Fit tools stay explained", "Support paths stay visible"],
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
