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
      eyebrow="Match"
      title="Find a calmer product fit before you compare or shop."
      summary="Jeslect Match now runs inside the new US storefront shell. Start with one category, answer a short sequence, and save a reusable fit basis for this device."
      highlights={["Single-task question flow", "Saved by device", "Reusable compare basis"]}
      primaryCta={{ href: "/shop", label: "Browse products" }}
      secondaryCta={{ href: "/compare", label: "Open compare" }}
    >
      <MatchExperience initialCategory={initialCategory} hasExplicitCategory={hasExplicitCategory} />
    </FeatureShell>
  );
}
