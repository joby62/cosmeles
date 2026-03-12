import Link from "next/link";
import ProductCard from "@/components/site/ProductCard";
import TrustStrip from "@/components/site/TrustStrip";
import { analysisCardProofSummary } from "@/lib/productEvidence";
import { getMatchConfig } from "@/lib/match";
import { fetchAllProducts, fetchProductAnalysisIndex, type Product } from "@/lib/api";
import { categoryHref, CATEGORIES, SHOP_CONCERNS, TRUST_ITEMS, type CategoryKey } from "@/lib/site";
import { LAUNCH_STATUS_POINTS, SHOP_SUPPORT_LINKS } from "@/lib/storefrontTrust";

export default async function ShopHubPage() {
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
  for (const category of CATEGORIES) categoryCounts.set(category.key, 0);
  for (const product of products) {
    const key = String(product.category || "").trim().toLowerCase() as CategoryKey;
    if (categoryCounts.has(key)) {
      categoryCounts.set(key, (categoryCounts.get(key) || 0) + 1);
    }
  }

  const firstEdit = CATEGORIES.map((category) =>
    products.find((product) => String(product.category || "").trim().toLowerCase() === category.key),
  ).filter((item): item is Product => Boolean(item));
  const routePreview = CATEGORIES.map((category) => {
    const routes = Object.values(getMatchConfig(category.key).routes).slice(0, 2);
    return { category, routes };
  });

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8">
      <section className="overflow-hidden rounded-[40px] border border-black/8 bg-white/92 px-5 py-8 shadow-[0_28px_72px_rgba(15,23,42,0.08)] md:px-8 md:py-10">
        <div className="max-w-3xl">
          <div className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
            Shop hub
          </div>
          <h1 className="site-display mt-5 text-[42px] leading-[0.98] tracking-[-0.05em] text-slate-950 sm:text-[56px]">
            Shop by concern, not by guesswork.
          </h1>
          <p className="mt-5 text-[17px] leading-8 text-slate-600">
            Start with the routine problem you want to solve, then narrow down through category pages with clearer product
            signals and ingredient visibility.
          </p>
          <div className="mt-5 rounded-[24px] border border-amber-200 bg-amber-50/70 px-4 py-4 text-[14px] leading-6 text-slate-700">
            The current US shop layer is live for discovery, fit, compare, and saved shortlist behavior. Price, stock,
            checkout, and final delivery ETA are not in the product feed yet.
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/search"
              className="inline-flex h-12 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-6 text-[14px] font-semibold text-white shadow-[0_14px_36px_rgba(0,113,227,0.28)]"
            >
              Search products
            </Link>
            <Link
              href="/match"
              className="inline-flex h-12 items-center justify-center rounded-full border border-black/10 bg-white px-6 text-[14px] font-semibold text-slate-700"
            >
              Start match
            </Link>
          </div>
          <TrustStrip items={TRUST_ITEMS} className="mt-6" />
        </div>
      </section>

      <section className="mt-12">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Concern shortcuts</p>
          <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.04em] text-slate-950">Lead with the issue, then choose the routine layer.</h2>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {SHOP_CONCERNS.map((concern) => (
            <Link
              key={concern.key}
              href={concern.href}
              className="rounded-[28px] border border-black/8 bg-white/92 p-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)]"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">Concern</div>
              <h3 className="mt-3 text-[22px] font-semibold tracking-[-0.03em] text-slate-950">{concern.label}</h3>
              <p className="mt-3 text-[14px] leading-6 text-slate-600">{concern.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Category pages</p>
            <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.04em] text-slate-950">Choose the routine layer you want to improve.</h2>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {CATEGORIES.map((category) => (
            <Link
              key={category.key}
              href={categoryHref(category.key)}
              className="rounded-[28px] border border-black/8 bg-[linear-gradient(180deg,#fbfdff_0%,#f3f7fc_100%)] p-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)]"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{category.shortLabel}</div>
              <h3 className="mt-3 text-[22px] font-semibold tracking-[-0.03em] text-slate-950">{category.label}</h3>
              <p className="mt-3 text-[14px] leading-6 text-slate-600">{category.description}</p>
              <div className="mt-5 text-[13px] font-medium text-slate-700">{categoryCounts.get(category.key) || 0} products</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Current edit</p>
            <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.04em] text-slate-950">Open the clearest live product profiles first.</h2>
          </div>
        </div>

        {loadError ? (
          <article className="mt-6 rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-5 text-[14px] leading-6 text-rose-700">
            Product loading failed: {loadError}
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
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">How to browse this storefront</p>
          <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.04em] text-slate-950">
            Start with a concern, then let the route language do the narrowing.
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
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-sky-700">Trust layer</p>
          <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.04em] text-slate-950">
            Shipping, returns, and support should stay close to discovery.
          </h2>
          <div className="mt-5 space-y-2">
            {LAUNCH_STATUS_POINTS.slice(0, 2).map((item) => (
              <p key={item} className="text-[14px] leading-6 text-slate-700">
                {item}
              </p>
            ))}
          </div>
          <div className="mt-5 space-y-3">
            {SHOP_SUPPORT_LINKS.map((item) => (
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
