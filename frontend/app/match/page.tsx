import MatchExperience from "@/components/site/MatchExperience";
import FeatureShell from "@/components/site/FeatureShell";
import { isCategoryKey, type CategoryKey } from "@/lib/site";

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
  const resolvedSearchParams = (await Promise.resolve(searchParams)) || {};
  const categoryValue = firstValue(resolvedSearchParams.category);
  const hasExplicitCategory = Boolean(categoryValue);
  const initialCategory: CategoryKey = isCategoryKey(categoryValue) ? categoryValue : "shampoo";

  return (
    <FeatureShell
      eyebrow="测配"
      title="在比较或选购之前，先把更适合你的路线收出来。"
      summary="婕选测配会先聚焦一个品类，用一段简短问答帮你生成可复用的适配基础，并保存在当前设备上。"
      highlights={["单任务问答流", "设备侧保存", "可复用的对比基础"]}
      primaryCta={{ href: "/shop", label: "进入选购" }}
      secondaryCta={{ href: "/compare", label: "打开对比" }}
    >
      <MatchExperience initialCategory={initialCategory} hasExplicitCategory={hasExplicitCategory} />
    </FeatureShell>
  );
}
