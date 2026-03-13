import FeatureShell from "@/components/site/FeatureShell";
import { getStorefrontPolicyCopy } from "@/lib/storefrontPolicies";
import { getRequestSitePreferences } from "@/lib/sitePreferences.server";

export default async function PrivacyPage() {
  const { locale } = await getRequestSitePreferences();
  const { POLICY_SCOPE_NOTE, PRIVACY_SECTIONS } = getStorefrontPolicyCopy(locale);
  const copy =
    locale === "zh"
      ? {
          eyebrow: "隐私",
          title: "隐私说明应该讲清楚当前数据范围，而不是躲在难懂的法律雾里。",
          summary: "这里说明当前婕选独立站为了浏览、已存状态、适配工具和支持可见性会处理哪些数据，也明确哪些信息当前版本并不会收集。",
          highlights: ["当前数据范围", "暂无支付数据", "表达清楚可读"],
          primaryCta: "查看 Cookie 说明",
          secondaryCta: "返回支持中心",
        }
      : {
          eyebrow: "Privacy",
          title: "Privacy should explain the current data scope without hiding behind legal fog.",
          summary: "This page covers what the current Jeslect storefront uses to run browsing, saved state, fit tools, and support-layer visibility. It also clarifies what this build does not collect yet.",
          highlights: ["Current data scope", "No checkout data yet", "Readable baseline"],
          primaryCta: "Cookie choices",
          secondaryCta: "Support hub",
        };
  return (
    <FeatureShell
      eyebrow={copy.eyebrow}
      title={copy.title}
      summary={copy.summary}
      metaNote={POLICY_SCOPE_NOTE}
      highlights={copy.highlights}
      primaryCta={{ href: "/cookies", label: copy.primaryCta }}
      secondaryCta={{ href: "/support", label: copy.secondaryCta }}
    >
      <div className="space-y-4">
        {PRIVACY_SECTIONS.map((section) => (
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
