import MatchExperience from "@/components/site/MatchExperience";
import FeatureShell from "@/components/site/FeatureShell";
import { isCategoryKey, type CategoryKey } from "@/lib/site";
import { getRequestSitePreferences } from "@/lib/sitePreferences.server";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? String(value[0] || "").trim() : String(value || "").trim();
}

export default async function MatchPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const { locale } = await getRequestSitePreferences();
  const resolvedSearchParams = (await Promise.resolve(searchParams)) || {};
  const categoryValue = firstValue(resolvedSearchParams.category);
  const hasExplicitCategory = Boolean(categoryValue);
  const initialCategory: CategoryKey = isCategoryKey(categoryValue) ? categoryValue : "shampoo";
  const copy =
    locale === "zh"
      ? {
          eyebrow: "测配",
          title: "在比较或选购之前，先把更适合你的路线收出来。",
          summary: "婕选测配会先聚焦一个品类，用一段简短问答帮你生成可复用的适配基础，并保存在当前设备上。",
          highlights: ["单任务问答流", "设备侧保存", "可复用的对比基础"],
          primaryCta: "进入选购",
          secondaryCta: "打开对比",
        }
      : {
          eyebrow: "Match",
          title: "Find a calmer product fit before you compare or shop.",
          summary: "Jeslect Match now runs inside the new US storefront shell. Start with one category, answer a short sequence, and save a reusable fit basis for this device.",
          highlights: ["Single-task question flow", "Saved by device", "Reusable compare basis"],
          primaryCta: "Browse products",
          secondaryCta: "Open compare",
        };

  return (
    <FeatureShell
      eyebrow={copy.eyebrow}
      title={copy.title}
      summary={copy.summary}
      highlights={copy.highlights}
      primaryCta={{ href: "/shop", label: copy.primaryCta }}
      secondaryCta={{ href: "/compare", label: copy.secondaryCta }}
    >
      <MatchExperience initialCategory={initialCategory} hasExplicitCategory={hasExplicitCategory} />
    </FeatureShell>
  );
}
