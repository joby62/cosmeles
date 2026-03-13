import FeatureShell from "@/components/site/FeatureShell";
import { getStorefrontPolicyCopy } from "@/lib/storefrontPolicies";
import { getRequestSitePreferences } from "@/lib/sitePreferences.server";

export default async function CookiesPage() {
  const { locale } = await getRequestSitePreferences();
  const { COOKIE_SECTIONS, POLICY_SCOPE_NOTE } = getStorefrontPolicyCopy(locale);
  const copy =
    locale === "zh"
      ? {
          eyebrow: "Cookie 说明",
          title: "Cookie 与必要状态的说明，应该把必须的和可选的明确分开。",
          summary: "当前婕选依赖必要状态来维持袋中、已存、测配和对比的恢复能力；如果未来加入可选分析或广告工具，也应该单独说明。",
          highlights: ["必要状态优先说明", "可选工具单独呈现", "移动端也易读"],
          primaryCta: "查看隐私说明",
          secondaryCta: "返回支持中心",
        }
      : {
          eyebrow: "Cookies",
          title: "Cookie explanations should separate required storefront state from everything optional.",
          summary: "Jeslect currently relies on necessary state to keep Bag, Saved, Match, and Compare recoverable. Optional analytics or advertising tools should remain separate and readable if they are added later.",
          highlights: ["Necessary state first", "Optional tools separate", "Mobile-readable choices"],
          primaryCta: "Privacy page",
          secondaryCta: "Support hub",
        };
  return (
    <FeatureShell
      eyebrow={copy.eyebrow}
      title={copy.title}
      summary={copy.summary}
      metaNote={POLICY_SCOPE_NOTE}
      highlights={copy.highlights}
      primaryCta={{ href: "/privacy", label: copy.primaryCta }}
      secondaryCta={{ href: "/support", label: copy.secondaryCta }}
    >
      <div className="space-y-4">
        {COOKIE_SECTIONS.map((section) => (
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
