import Link from "next/link";
import ProductCard from "@/components/site/ProductCard";
import { fetchAllProducts, fetchProductAnalysisIndex, type Product } from "@/lib/api";
import { getMatchRouteMeta } from "@/lib/match";
import { sortProductsByCommerceReadiness } from "@/lib/productCommerce";
import { analysisCardProofSummary } from "@/lib/productEvidence";
import { getRequestSitePreferences } from "@/lib/sitePreferences.server";
import { getCategories, normalizeCategoryKey } from "@/lib/site";
import { getStorefrontTrustCopy } from "@/lib/storefrontTrust";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? String(value[0] || "").trim() : String(value || "").trim();
}

function matchesQuery(product: Product, query: string): boolean {
  const haystack = [
    product.name,
    product.brand,
    product.one_sentence,
    product.description,
    ...(product.tags || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const { locale } = await getRequestSitePreferences();
  const categories = getCategories(locale);
  const {
    SEARCH_SUGGESTIONS: searchSuggestions,
    SEARCH_TRUST_POINTS: searchTrustPoints,
    SHOP_SUPPORT_LINKS: shopSupportLinks,
  } = getStorefrontTrustCopy(locale);
  const resolvedSearchParams = (await Promise.resolve(searchParams)) || {};
  const query = firstValue(resolvedSearchParams.q);

  let products: Product[] = [];
  let analysisItems: Awaited<ReturnType<typeof fetchProductAnalysisIndex>> = [];
  let loadError: string | null = null;
  try {
    [products, analysisItems] = await Promise.all([
      fetchAllProducts(),
      fetchProductAnalysisIndex().catch(() => []),
    ]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  }

  const analysisById = new Map(analysisItems.map((item) => [item.product_id, item]));
  const results = query ? sortProductsByCommerceReadiness(products.filter((product) => matchesQuery(product, query))).slice(0, 18) : [];
  const resultCategories = Array.from(
    new Set(results.map((product) => normalizeCategoryKey(product.category)).filter(Boolean)),
  );

  const copy =
    locale === "zh"
      ? {
          eyebrow: "搜索",
          title: "按商品、品牌或问题线索，把范围先收窄。",
          label: "搜索商品",
          placeholder: "搜索商品、品牌或护理问题",
          submit: "搜索",
          suggestions: "推荐搜索",
          categoryShortcuts: "品类捷径",
          loadError: "搜索加载失败",
          results: "结果",
          resultsTitle: `${results.length} 个结果匹配“${query}”`,
          guidanceEyebrow: "搜索建议",
          guidanceTitle: "搜索不是终点，而是帮你找到下一步该去哪里。",
          matchCta: "去测配",
          compareCta: "去对比",
          trustEyebrow: "支持层",
          trustTitle: "搜索时也别把配送、退货和支持入口藏起来。",
          browseCategory: (label: string) => `查看${label}`,
          empty: "当前还没有与这个关键词匹配的在线商品。你可以换一个品牌名、品类名，或从护理问题继续搜索。",
        }
      : {
          eyebrow: "Search",
          title: "Search products, brands, or ingredient language.",
          label: "Search products",
          placeholder: "Search products, brands, or concerns",
          submit: "Search",
          suggestions: "Suggested searches",
          categoryShortcuts: "Category shortcuts",
          loadError: "Search failed",
          results: "Results",
          resultsTitle: `${results.length} matches for "${query}"`,
          guidanceEyebrow: "Search guidance",
          guidanceTitle: "Search should narrow the field, then push you toward the right next step.",
          matchCta: "Open match",
          compareCta: "Open compare",
          trustEyebrow: "Trust layer",
          trustTitle: "Keep support visible while you search.",
          browseCategory: (label: string) => `Browse ${label}`,
          empty: "No live products matched that search yet. Try a brand, a category name, or a routine concern.",
        };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8">
      <section className="rounded-[40px] border border-black/8 bg-white/92 px-5 py-8 shadow-[0_28px_72px_rgba(15,23,42,0.08)] md:px-8 md:py-10">
        <div className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
          {copy.eyebrow}
        </div>
        <h1 className="site-display mt-5 text-[42px] leading-[0.98] tracking-[-0.05em] text-slate-950 sm:text-[56px]">
          {copy.title}
        </h1>
        <form className="mt-6">
          <label className="sr-only" htmlFor="search-input">
            {copy.label}
          </label>
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              id="search-input"
              type="search"
              name="q"
              defaultValue={query}
              placeholder={copy.placeholder}
              className="h-12 flex-1 rounded-full border border-black/10 bg-white px-5 text-[15px] text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            />
            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-6 text-[14px] font-semibold text-white shadow-[0_14px_36px_rgba(0,113,227,0.28)]"
            >
              {copy.submit}
            </button>
          </div>
        </form>
        {!query ? (
          <div className="mt-6 space-y-5">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-500">{copy.suggestions}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {searchSuggestions.map((item) => (
                  <Link
                    key={item.query}
                    href={`/search?q=${encodeURIComponent(item.query)}`}
                    className="rounded-full border border-black/8 bg-slate-50 px-4 py-2 text-[13px] font-medium text-slate-700"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-500">{copy.categoryShortcuts}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {categories.map((category) => (
                  <Link
                    key={category.key}
                    href={`/shop/${category.key}`}
                    className="rounded-full border border-black/8 bg-slate-50 px-4 py-2 text-[13px] font-medium text-slate-700"
                  >
                    {category.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {loadError ? (
        <article className="mt-8 rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-5 text-[14px] leading-6 text-rose-700">
          {copy.loadError}: {loadError}
        </article>
      ) : null}

      {!loadError && query ? (
        <section className="mt-10 space-y-10">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.results}</p>
          <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.04em] text-slate-950">{copy.resultsTitle}</h2>

          <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
            <article className="rounded-[32px] border border-black/8 bg-white/92 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.guidanceEyebrow}</p>
              <h3 className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-slate-950">{copy.guidanceTitle}</h3>
              <div className="mt-5 space-y-3">
                {searchTrustPoints.map((item) => (
                  <div key={item} className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4 text-[14px] leading-6 text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/match"
                  className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-5 text-[14px] font-semibold text-white"
                >
                  {copy.matchCta}
                </Link>
                <Link
                  href="/compare"
                  className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[14px] font-semibold text-slate-700"
                >
                  {copy.compareCta}
                </Link>
              </div>
            </article>

            <article className="rounded-[32px] border border-black/8 bg-[linear-gradient(180deg,#eef6ff_0%,#ffffff_100%)] p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-sky-700">{copy.trustEyebrow}</p>
              <h3 className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-slate-950">{copy.trustTitle}</h3>
              <div className="mt-5 space-y-3">
                {shopSupportLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block rounded-[24px] border border-black/8 bg-white px-4 py-4 transition hover:-translate-y-[1px] hover:shadow-[0_12px_28px_rgba(15,23,42,0.05)]"
                  >
                    <h4 className="text-[17px] font-semibold tracking-[-0.02em] text-slate-950">{item.title}</h4>
                    <p className="mt-2 text-[14px] leading-6 text-slate-600">{item.summary}</p>
                  </Link>
                ))}
              </div>
            </article>
          </div>

          {resultCategories.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {resultCategories.map((categoryKey) => {
                const category = categories.find((item) => item.key === categoryKey);
                if (!category) return null;
                return (
                  <Link
                    key={category.key}
                    href={`/shop/${category.key}`}
                    className="rounded-full border border-black/8 bg-slate-50 px-4 py-2 text-[13px] font-medium text-slate-700"
                  >
                    {copy.browseCategory(category.label)}
                  </Link>
                );
              })}
            </div>
          ) : null}

          {results.length > 0 ? (
            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {results.map((product) => {
                const analysis = analysisById.get(product.id);
                const categoryKey = normalizeCategoryKey(product.category);
                const routeMeta =
                  analysis && categoryKey ? getMatchRouteMeta(categoryKey, analysis.route_key, locale) : null;
                return (
                  <ProductCard
                    key={product.id}
                    product={product}
                    headline={analysis?.headline || product.one_sentence}
                    routeTitle={routeMeta?.title || analysis?.route_title}
                    routeSummary={routeMeta?.summary || null}
                    fitConfidence={analysis?.confidence}
                    fitVerdict={analysis?.subtype_fit_verdict || null}
                    needsReview={analysis?.needs_review || false}
                    proofSummary={analysisCardProofSummary(analysis)}
                  />
                );
              })}
            </div>
          ) : (
            <article className="mt-6 rounded-[28px] border border-black/8 bg-white/92 px-5 py-5 text-[15px] leading-6 text-slate-600">
              {copy.empty}
            </article>
          )}
        </section>
      ) : null}
    </div>
  );
}
