import CompareExperience from "@/components/site/CompareExperience";
import FeatureShell from "@/components/site/FeatureShell";
import { isCategoryKey, type CategoryKey } from "@/lib/site";

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
  const resolvedSearchParams = (await Promise.resolve(searchParams)) || {};
  const categoryValue = firstValue(resolvedSearchParams.category);
  const initialCategory: CategoryKey = isCategoryKey(categoryValue) ? categoryValue : "shampoo";
  const initialPick = firstValue(resolvedSearchParams.pick);

  return (
    <FeatureShell
      eyebrow="对比"
      title="把商品放回你的已存路线基础里，再判断谁更适合。"
      summary="婕选对比页会复用当前已接通的 compare engine。选择一个品类，挑 2 到 3 个商品，把决定放到同一屏里读清楚。"
      highlights={["真实对比引擎", "历史结果可恢复", "以中文壳层承接结果"]}
      primaryCta={{ href: "/shop", label: "进入选购" }}
      secondaryCta={{ href: "/search", label: "搜索商品" }}
    >
      <CompareExperience initialCategory={initialCategory} initialPick={initialPick} />
    </FeatureShell>
  );
}
