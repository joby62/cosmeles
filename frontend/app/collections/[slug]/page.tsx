import Link from "next/link";
import { notFound } from "next/navigation";
import ProductCard from "@/components/site/ProductCard";
import TrustStrip from "@/components/site/TrustStrip";
import { fetchAllProducts, fetchProductAnalysisIndex, type Product } from "@/lib/api";
import { getConcernCollection } from "@/lib/collections";
import { getMatchRouteMeta } from "@/lib/match";
import { sortProductsByCommerceReadiness } from "@/lib/productCommerce";
import { analysisCardProofSummary } from "@/lib/productEvidence";
import { getRequestSitePreferences } from "@/lib/sitePreferences.server";
import { getCategoryMeta, getTrustItems } from "@/lib/site";
import { getStorefrontTrustCopy } from "@/lib/storefrontTrust";

export const dynamic = "force-dynamic";

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}) {
  const { locale } = await getRequestSitePreferences();
  const resolvedParams = await Promise.resolve(params);
  const collection = getConcernCollection(resolvedParams.slug, locale);
  if (!collection) notFound();
  const trustItems = getTrustItems(locale);
  const { SEARCH_TRUST_POINTS: searchTrustPoints, SHOP_SUPPORT_LINKS: shopSupportLinks } = getStorefrontTrustCopy(locale);

  let products: Product[] = [];
  let analysisItems: Awaited<ReturnType<typeof fetchProductAnalysisIndex>> = [];
  let loadError: string | null = null;

  try {
    const analysisByCategory = await Promise.all(
      collection.categoryKeys.map((categoryKey) => fetchProductAnalysisIndex(categoryKey).catch(() => [])),
    );
    [products, analysisItems] = await Promise.all([
      fetchAllProducts(),
      Promise.resolve(analysisByCategory.flat()),
    ]);
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error);
  }

  const routePairs = collection.routeKeys.map(({ category, routeKey }) => ({
    category,
    routeKey,
    route: getMatchRouteMeta(category, routeKey, locale),
  }));

  const routeKeySet = new Set(routePairs.map((item) => `${item.category}:${item.routeKey}`));
  const analysisById = new Map(analysisItems.map((item) => [item.product_id, item]));
  const visibleProducts = sortProductsByCommerceReadiness(
    products
      .filter((product) => collection.categoryKeys.includes(product.category as typeof collection.categoryKeys[number]))
      .filter((product) => {
        const analysis = analysisById.get(product.id);
        if (!analysis) return false;
        return routeKeySet.has(`${analysis.category}:${analysis.route_key}`);
      }),
  ).slice(0, 12);

  const copy =
    locale === "zh"
      ? {
          eyebrow: "问题专题",
          primaryCta: "开始测配",
          secondaryCta: "查看这条路线",
          fallbackSummary: "打开对应品类页，查看已映射到这条路线的商品。",
          usageEyebrow: "怎么用这个专题",
          searchCta: "搜索这个问题",
          compareCta: "对比商品",
          trustEyebrow: "支持层",
          trustTitle: "即使按问题浏览，支持信息也应该一直在附近。",
          productsEyebrow: "专题商品",
          productsTitle: "当前已映射到这个问题的商品",
          loadError: "专题加载失败",
          empty: "当前还没有完全映射到这个问题专题的在线商品。你可以先去测配，或打开相关品类继续看。",
          nextEyebrow: "下一步",
          nextTitle: "先用问题专题缩小范围，再进入更具体的路线判断。",
          nextSummary: "专题页先降低浏览摩擦。测配负责生成基础路线，对比负责处理近似候选，商品页和袋中继续承接信任层。",
          nextLinks: ["开始测配", "去对比", "查看探索", "查看袋中"],
        }
      : {
          eyebrow: "Concern collection",
          primaryCta: "Find my match",
          secondaryCta: "Shop this path",
          fallbackSummary: "Open the related category to see products mapped to this route.",
          usageEyebrow: "How to use this collection",
          searchCta: "Search this concern",
          compareCta: "Compare products",
          trustEyebrow: "Trust layer",
          trustTitle: "Keep support visible while you browse by concern.",
          productsEyebrow: "Collection products",
          productsTitle: "Products currently mapped to this concern",
          loadError: "Collection loading failed",
          empty: "No live products are fully mapped to this concern collection yet. Start with Match or open one of the related categories.",
          nextEyebrow: "Next step",
          nextTitle: "Use concern pages to narrow the field, then move into route-level decisions.",
          nextSummary: "Collections should reduce browsing friction first. Match decides your basis. Compare tests the close calls. PDP and Bag carry the trust layer.",
          nextLinks: ["Start Match", "Run Compare", "Open Learn", "View Bag"],
        };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8">
      <section className="overflow-hidden rounded-[40px] border border-black/8 bg-white/92 px-5 py-8 shadow-[0_28px_72px_rgba(15,23,42,0.08)] md:px-8 md:py-10">
        <div className="grid gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
          <div>
            <div className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
              {copy.eyebrow}
            </div>
            <h1 className="site-display mt-5 text-[44px] leading-[0.96] tracking-[-0.05em] text-slate-950 sm:text-[56px]">
              {collection.heroTitle}
            </h1>
            <p className="mt-5 max-w-3xl text-[17px] leading-8 text-slate-600">{collection.heroSummary}</p>
            <p className="mt-4 max-w-3xl text-[15px] leading-7 text-slate-500">{collection.shopperSummary}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href={collection.matchCategory === "shampoo" ? "/match" : `/match?category=${encodeURIComponent(collection.matchCategory)}`}
                className="inline-flex h-12 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-6 text-[14px] font-semibold text-white shadow-[0_14px_36px_rgba(0,113,227,0.28)]"
              >
                {copy.primaryCta}
              </Link>
              <Link
                href={`/shop/${encodeURIComponent(collection.matchCategory)}`}
                className="inline-flex h-12 items-center justify-center rounded-full border border-black/10 bg-white px-6 text-[14px] font-semibold text-slate-700"
              >
                {copy.secondaryCta}
              </Link>
            </div>
            <TrustStrip items={trustItems} className="mt-6" />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {routePairs.map((item) => {
              const category = getCategoryMeta(item.category, locale);
              return (
                <article key={`${item.category}:${item.routeKey}`} className="rounded-[26px] border border-black/8 bg-slate-50 px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {category?.label || item.category}
                  </div>
                  <h2 className="mt-3 text-[20px] font-semibold tracking-[-0.03em] text-slate-950">
                    {item.route?.title || item.routeKey}
                  </h2>
                  <p className="mt-2 text-[14px] leading-6 text-slate-600">
                    {item.route?.summary || copy.fallbackSummary}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-10 grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <article className="rounded-[32px] border border-black/8 bg-white/92 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.usageEyebrow}</p>
          <div className="mt-5 space-y-3">
            {searchTrustPoints.map((item) => (
              <div key={item} className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4 text-[14px] leading-6 text-slate-700">
                {item}
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/search?q=${encodeURIComponent(collection.suggestedSearches[0] || collection.label.toLowerCase())}`}
              className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[14px] font-semibold text-slate-700"
            >
              {copy.searchCta}
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
          <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.04em] text-slate-950">
            {copy.trustTitle}
          </h2>
          <div className="mt-5 space-y-3">
            {shopSupportLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-[24px] border border-black/8 bg-white px-4 py-4 transition hover:-translate-y-[1px] hover:shadow-[0_12px_28px_rgba(15,23,42,0.05)]"
              >
                <h3 className="text-[17px] font-semibold tracking-[-0.02em] text-slate-950">{item.title}</h3>
                <p className="mt-2 text-[14px] leading-6 text-slate-600">{item.summary}</p>
              </Link>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.productsEyebrow}</p>
            <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.04em] text-slate-950">{copy.productsTitle}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {collection.categoryKeys.map((categoryKey) => {
              const category = getCategoryMeta(categoryKey, locale);
              if (!category) return null;
              return (
                <Link
                  key={category.key}
                  href={`/shop/${category.key}`}
                  className="rounded-full border border-black/8 bg-white px-4 py-2 text-[13px] font-medium text-slate-700"
                >
                  {category.label}
                </Link>
              );
            })}
          </div>
        </div>

        {loadError ? (
          <article className="mt-6 rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-5 text-[14px] leading-6 text-rose-700">
            {copy.loadError}: {loadError}
          </article>
        ) : visibleProducts.length > 0 ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleProducts.map((product, index) => {
              const analysis = analysisById.get(product.id);
              const categoryKey = getCategoryMeta(product.category, locale)?.key || collection.matchCategory;
              const routeMeta = analysis ? getMatchRouteMeta(categoryKey, analysis.route_key, locale) : null;
              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  priority={index < 3}
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

      <section className="mt-12 rounded-[36px] border border-black/8 bg-white/92 px-6 py-8 shadow-[0_22px_56px_rgba(15,23,42,0.07)]">
        <div className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.nextEyebrow}</p>
            <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.04em] text-slate-950">{copy.nextTitle}</h2>
            <p className="mt-4 text-[15px] leading-7 text-slate-600">{copy.nextSummary}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href={collection.matchCategory === "shampoo" ? "/match" : `/match?category=${encodeURIComponent(collection.matchCategory)}`}
              className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4 text-[14px] font-medium text-slate-700"
            >
              {copy.nextLinks[0]}
            </Link>
            <Link
              href="/compare"
              className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4 text-[14px] font-medium text-slate-700"
            >
              {copy.nextLinks[1]}
            </Link>
            <Link
              href={`/learn?category=${encodeURIComponent(collection.learnCategory)}`}
              className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4 text-[14px] font-medium text-slate-700"
            >
              {copy.nextLinks[2]}
            </Link>
            <Link
              href="/bag"
              className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4 text-[14px] font-medium text-slate-700"
            >
              {copy.nextLinks[3]}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
