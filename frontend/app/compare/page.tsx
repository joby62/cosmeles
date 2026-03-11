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
      eyebrow="Compare"
      title="Compare products against your saved routine basis."
      summary="Jeslect Compare now uses the live mobile compare engine inside the new storefront shell. Pick a category, choose 2 to 3 products, and read the decision in a calmer English layout."
      highlights={["Live compare engine", "Saved compare history", "English result layout"]}
      primaryCta={{ href: "/shop", label: "Browse products" }}
      secondaryCta={{ href: "/search", label: "Search products" }}
    >
      <CompareExperience initialCategory={initialCategory} initialPick={initialPick} />
    </FeatureShell>
  );
}
