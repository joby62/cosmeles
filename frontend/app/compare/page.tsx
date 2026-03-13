import CompareExperience from "@/components/site/CompareExperience";
import FeatureShell from "@/components/site/FeatureShell";
import { isCategoryKey, type CategoryKey } from "@/lib/site";
import { getRequestSitePreferences } from "@/lib/sitePreferences.server";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? String(value[0] || "").trim() : String(value || "").trim();
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const { locale } = await getRequestSitePreferences();
  const resolvedSearchParams = (await Promise.resolve(searchParams)) || {};
  const categoryValue = firstValue(resolvedSearchParams.category);
  const initialCategory: CategoryKey = isCategoryKey(categoryValue) ? categoryValue : "shampoo";
  const initialPick = firstValue(resolvedSearchParams.pick);
  const copy =
    locale === "zh"
      ? {
          eyebrow: "对比",
          title: "把商品放回你的已存路线基础里，再判断谁更适合。",
          summary: "婕选对比页会复用当前已接通的 compare engine。选择一个品类，挑 2 到 3 个商品，把决定放到同一屏里读清楚。",
          highlights: ["真实对比引擎", "历史结果可恢复", "中文结果壳层"],
          primaryCta: "进入选购",
          secondaryCta: "搜索商品",
        }
      : {
          eyebrow: "Compare",
          title: "Compare products against your saved routine basis.",
          summary: "Jeslect Compare now uses the live mobile compare engine inside the new storefront shell. Pick a category, choose 2 to 3 products, and read the decision in a calmer English layout.",
          highlights: ["Live compare engine", "Saved compare history", "English result layout"],
          primaryCta: "Browse products",
          secondaryCta: "Search products",
        };

  return (
    <FeatureShell
      eyebrow={copy.eyebrow}
      title={copy.title}
      summary={copy.summary}
      highlights={copy.highlights}
      primaryCta={{ href: "/shop", label: copy.primaryCta }}
      secondaryCta={{ href: "/search", label: copy.secondaryCta }}
    >
      <CompareExperience initialCategory={initialCategory} initialPick={initialPick} />
    </FeatureShell>
  );
}
