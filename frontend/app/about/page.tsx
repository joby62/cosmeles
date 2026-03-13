import FeatureShell from "@/components/site/FeatureShell";
import { getRequestSitePreferences } from "@/lib/sitePreferences.server";

export default async function AboutPage() {
  const { locale } = await getRequestSitePreferences();
  const copy =
    locale === "zh"
      ? {
          eyebrow: "关于婕选",
          title: "婕选想把个护独立站做成一个先讲清楚、再让人下决定的地方。",
          summary: "我们不想用堆砌信息、制造焦虑或强推转化的方式卖东西。婕选更关心的是：产品是否适合、差异是否说清楚、成分是否可查、配送与退货是否提前可见。",
          highlights: ["信息更轻，但判断更稳", "先讲适配，再谈卖点", "成分透明本身就是信任层"],
          primaryCta: "进入选购",
          secondaryCta: "查看常见问题",
        }
      : {
          eyebrow: "About Jeslect",
          title: "Jeslect is building a beauty storefront around clarity before conversion.",
          summary: "The new brand layer is intentionally calmer: fewer claims, more routine fit, lower information density, and clearer product reasoning. The goal is not to overwhelm users into checkout. The goal is to help them choose with less friction.",
          highlights: ["Clarity over clutter", "Routine fit before hype", "Ingredient transparency as trust"],
          primaryCta: "Shop Jeslect",
          secondaryCta: "Read FAQ",
        };

  return (
    <FeatureShell
      eyebrow={copy.eyebrow}
      title={copy.title}
      summary={copy.summary}
      highlights={copy.highlights}
      primaryCta={{ href: "/shop", label: copy.primaryCta }}
      secondaryCta={{ href: "/support/faq", label: copy.secondaryCta }}
    />
  );
}
