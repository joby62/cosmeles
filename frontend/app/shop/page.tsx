import Link from "next/link";
import ProductCard from "@/components/site/ProductCard";
import TrustStrip from "@/components/site/TrustStrip";
import { analysisCardProofSummary } from "@/lib/productEvidence";
import { getMatchConfig } from "@/lib/match";
import { fetchAllProducts, fetchProductAnalysisIndex, type Product } from "@/lib/api";
import { sortProductsByCommerceReadiness } from "@/lib/productCommerce";
import { getRequestSitePreferences } from "@/lib/sitePreferences.server";
import { categoryHref, getCategories, getShopConcerns, getTrustItems, type CategoryKey } from "@/lib/site";
import { getStorefrontTrustCopy } from "@/lib/storefrontTrust";

export default async function ShopHubPage() {
  const { locale } = await getRequestSitePreferences();
  const categories = getCategories(locale);
  const concerns = getShopConcerns(locale);
  const trustItems = getTrustItems(locale);
  const { LAUNCH_STATUS_POINTS: launchStatusPoints, SHOP_SUPPORT_LINKS: shopSupportLinks } = getStorefrontTrustCopy(locale);

  let products: Product[] = [];
  let analysisItems: Awaited<ReturnType<typeof fetchProductAnalysisIndex>> = [];
  let loadError: string | null = null;

  try {
    [products, analysisItems] = await Promise.all([fetchAllProducts(), fetchProductAnalysisIndex().catch(() => [])]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  }

  const analysisById = new Map(analysisItems.map((item) => [item.product_id, item]));
  const categoryCounts = new Map<CategoryKey, number>();
  for (const category of categories) categoryCounts.set(category.key, 0);
  for (const product of products) {
    const key = String(product.category || "").trim().toLowerCase() as CategoryKey;
    if (categoryCounts.has(key)) {
      categoryCounts.set(key, (categoryCounts.get(key) || 0) + 1);
    }
  }

  const storefrontOrder = sortProductsByCommerceReadiness(products);
  const firstEdit = categories.map((category) =>
    storefrontOrder.find((product) => String(product.category || "").trim().toLowerCase() === category.key),
  ).filter((item): item is Product => Boolean(item));
  const routePreview = categories.map((category) => {
    const routes = Object.values(getMatchConfig(category.key, locale).routes).slice(0, 2);
    return { category, routes };
  });

  const copy =
    locale === "zh"
      ? {
          eyebrow: "选购中心",
          title: "先按问题进入，而不是在商品堆里盲选。",
          summary: "先从你想解决的护理问题出发，再沿着品类页把候选范围收窄，用更清楚的商品信号和成分信息做判断。",
          statusSummary: "当前选购层已支持发现、测配、对比和 shortlist 恢复。价格、库存、支付和最终配送时效仍在逐步接入真实数据。",
          searchCta: "搜索商品",
          matchCta: "开始测配",
          concernEyebrow: "问题捷径",
          concernTitle: "先锁定问题，再决定该走哪层护理路线。",
          concernChip: "问题",
          categoryEyebrow: "按品类进入",
          categoryTitle: "选你现在最想优化的护理层级。",
          currentEditEyebrow: "当前优先商品",
          currentEditTitle: "先从当前信息最完整的商品画像开始看。",
          browseEyebrow: "浏览方式",
          browseTitle: "先从问题出发，再让路线语言帮你把范围收紧。",
          trustEyebrow: "信任层",
          trustTitle: "配送、退货和支持信息应该始终贴着决策链路出现。",
          loadError: "商品加载失败",
          concernCount: (count: number) => `${count} 个商品`,
        }
      : {
          eyebrow: "Shop hub",
          title: "Shop by concern, not by guesswork.",
          summary: "Start with the routine problem you want to solve, then narrow down through category pages with clearer product signals and ingredient visibility.",
          statusSummary: "The current US shop layer is live for discovery, fit, compare, and saved shortlist behavior. Price, stock, checkout, and final delivery ETA are not in the product feed yet.",
          searchCta: "Search products",
          matchCta: "Start match",
          concernEyebrow: "Concern shortcuts",
          concernTitle: "Lead with the issue, then choose the routine layer.",
          concernChip: "Concern",
          categoryEyebrow: "Category pages",
          categoryTitle: "Choose the routine layer you want to improve.",
          currentEditEyebrow: "Current edit",
          currentEditTitle: "Open the clearest live product profiles first.",
          browseEyebrow: "How to browse this storefront",
          browseTitle: "Start with a concern, then let the route language do the narrowing.",
          trustEyebrow: "Trust layer",
          trustTitle: "Shipping, returns, and support should stay close to discovery.",
          loadError: "Product loading failed",
          concernCount: (count: number) => `${count} products`,
        };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8">
      <section className="overflow-hidden rounded-[40px] border border-black/8 bg-white/92 px-5 py-8 shadow-[0_28px_72px_rgba(15,23,42,0.08)] md:px-8 md:py-10">
        <div className="max-w-3xl">
          <div className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
            {copy.eyebrow}
          </div>
          <h1 className="site-display mt-5 text-[42px] leading-[0.98] tracking-[-0.05em] text-slate-950 sm:text-[56px]">
            {copy.title}
          </h1>
          <p className="mt-5 text-[17px] leading-8 text-slate-600">
            {copy.summary}
          </p>
          <div className="mt-5 rounded-[24px] border border-amber-200 bg-amber-50/70 px-4 py-4 text-[14px] leading-6 text-slate-700">
            {copy.statusSummary}
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/search"
              className="inline-flex h-12 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-6 text-[14px] font-semibold text-white shadow-[0_14px_36px_rgba(0,113,227,0.28)]"
            >
              {copy.searchCta}
            </Link>
            <Link
              href="/match"
              className="inline-flex h-12 items-center justify-center rounded-full border border-black/10 bg-white px-6 text-[14px] font-semibold text-slate-700"
            >
              {copy.matchCta}
            </Link>
          </div>
          <TrustStrip items={trustItems} className="mt-6" />
        </div>
      </section>

      <section className="mt-12">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.concernEyebrow}</p>
          <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.04em] text-slate-950">{copy.concernTitle}</h2>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {concerns.map((concern) => (
            <Link
              key={concern.key}
              href={concern.href}
              className="rounded-[28px] border border-black/8 bg-white/92 p-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)]"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">{copy.concernChip}</div>
              <h3 className="mt-3 text-[22px] font-semibold tracking-[-0.03em] text-slate-950">{concern.label}</h3>
              <p className="mt-3 text-[14px] leading-6 text-slate-600">{concern.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.categoryEyebrow}</p>
            <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.04em] text-slate-950">{copy.categoryTitle}</h2>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {categories.map((category) => (
            <Link
              key={category.key}
              href={categoryHref(category.key)}
              className="rounded-[28px] border border-black/8 bg-[linear-gradient(180deg,#fbfdff_0%,#f3f7fc_100%)] p-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)]"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{category.shortLabel}</div>
              <h3 className="mt-3 text-[22px] font-semibold tracking-[-0.03em] text-slate-950">{category.label}</h3>
              <p className="mt-3 text-[14px] leading-6 text-slate-600">{category.description}</p>
              <div className="mt-5 text-[13px] font-medium text-slate-700">{copy.concernCount(categoryCounts.get(category.key) || 0)}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.currentEditEyebrow}</p>
            <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.04em] text-slate-950">{copy.currentEditTitle}</h2>
          </div>
        </div>

        {loadError ? (
          <article className="mt-6 rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-5 text-[14px] leading-6 text-rose-700">
            {copy.loadError}: {loadError}
          </article>
        ) : (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {firstEdit.slice(0, 4).map((product, index) => {
              const analysis = analysisById.get(product.id);
              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  priority={index < 2}
                  headline={analysis?.headline || product.one_sentence}
                  routeTitle={analysis?.route_title}
                  fitConfidence={analysis?.confidence}
                  fitVerdict={analysis?.subtype_fit_verdict || null}
                  needsReview={analysis?.needs_review || false}
                  proofSummary={analysisCardProofSummary(analysis)}
                />
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-12 grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <article className="rounded-[32px] border border-black/8 bg-white/92 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.browseEyebrow}</p>
          <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.04em] text-slate-950">
            {copy.browseTitle}
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {routePreview.map(({ category, routes }) => (
              <article key={category.key} className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4">
                <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-500">{category.label}</div>
                <div className="mt-3 space-y-3">
                  {routes.map((route) => (
                    <div key={route.key}>
                      <div className="text-[15px] font-semibold tracking-[-0.02em] text-slate-950">{route.title}</div>
                      <p className="mt-1 text-[13px] leading-6 text-slate-600">{route.summary}</p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </article>

        <article className="rounded-[32px] border border-black/8 bg-[linear-gradient(180deg,#eef6ff_0%,#ffffff_100%)] p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-sky-700">{copy.trustEyebrow}</p>
          <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.04em] text-slate-950">
            {copy.trustTitle}
          </h2>
          <div className="mt-5 space-y-2">
            {launchStatusPoints.slice(0, 2).map((item) => (
              <p key={item} className="text-[14px] leading-6 text-slate-700">
                {item}
              </p>
            ))}
          </div>
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
    </div>
  );
}
