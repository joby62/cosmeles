import Link from "next/link";
import { notFound } from "next/navigation";
import ProductCard from "@/components/site/ProductCard";
import TrustStrip from "@/components/site/TrustStrip";
import { fetchAllProducts, fetchProductAnalysisIndex, type Product } from "@/lib/api";
import { categoryHref, getCategoryMeta, normalizeCategoryKey, TRUST_ITEMS } from "@/lib/site";

export default async function ShopCategoryPage({
  params,
}: {
  params: Promise<{ category: string }> | { category: string };
}) {
  const resolvedParams = await Promise.resolve(params);
  const categoryKey = normalizeCategoryKey(resolvedParams.category);
  if (!categoryKey) notFound();

  const category = getCategoryMeta(categoryKey);
  if (!category) notFound();

  let products: Product[] = [];
  let analysisItems: Awaited<ReturnType<typeof fetchProductAnalysisIndex>> = [];
  let loadError: string | null = null;

  try {
    [products, analysisItems] = await Promise.all([
      fetchAllProducts(),
      fetchProductAnalysisIndex(categoryKey).catch(() => []),
    ]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  }

  const visibleProducts = products.filter((item) => String(item.category || "").trim().toLowerCase() === categoryKey);
  const analysisById = new Map(analysisItems.map((item) => [item.product_id, item]));

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8">
      <section className="overflow-hidden rounded-[40px] border border-black/8 bg-white/92 px-5 py-8 shadow-[0_28px_72px_rgba(15,23,42,0.08)] md:px-8 md:py-10">
        <div className="max-w-3xl">
          <div className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
            {category.eyebrow}
          </div>
          <h1 className="site-display mt-5 text-[42px] leading-[0.98] tracking-[-0.05em] text-slate-950 sm:text-[56px]">
            {category.label}
          </h1>
          <p className="mt-5 text-[17px] leading-8 text-slate-600">{category.description}</p>
          <p className="mt-3 text-[15px] leading-7 text-slate-500">{category.routineHint}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href={category.key === "shampoo" ? "/match" : `/match?category=${encodeURIComponent(category.key)}`}
              className="inline-flex h-12 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-6 text-[14px] font-semibold text-white shadow-[0_14px_36px_rgba(0,113,227,0.28)]"
            >
              Find my match
            </Link>
            <Link
              href="/compare"
              className="inline-flex h-12 items-center justify-center rounded-full border border-black/10 bg-white px-6 text-[14px] font-semibold text-slate-700"
            >
              Compare products
            </Link>
            <Link
              href="/shop"
              className="inline-flex h-12 items-center justify-center rounded-full border border-black/10 bg-white px-6 text-[14px] font-semibold text-slate-700"
            >
              Back to shop
            </Link>
          </div>
          <TrustStrip items={TRUST_ITEMS} className="mt-6" />
        </div>
      </section>

      {loadError ? (
        <article className="mt-8 rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-5 text-[14px] leading-6 text-rose-700">
          Product loading failed: {loadError}
        </article>
      ) : null}

      {!loadError && visibleProducts.length === 0 ? (
        <article className="mt-8 rounded-[28px] border border-black/8 bg-white/92 px-5 py-5 text-[15px] leading-6 text-slate-600">
          There are no live products in this category yet. Browse another category while the storefront mapping catches up.
        </article>
      ) : null}

      {!loadError && visibleProducts.length > 0 ? (
        <section className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Product profiles</p>
              <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.04em] text-slate-950">
                {visibleProducts.length} products currently mapped
              </h2>
            </div>
            <div className="flex flex-wrap gap-2 text-[13px] font-medium text-slate-600">
              <Link href={categoryHref(category.key)} className="rounded-full border border-black/8 bg-white px-4 py-2">
                Refresh category
              </Link>
              <Link href="/search" className="rounded-full border border-black/8 bg-white px-4 py-2">
                Search all products
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleProducts.map((product, index) => {
              const analysis = analysisById.get(product.id);
              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  priority={index < 3}
                  headline={analysis?.headline || product.one_sentence}
                  routeTitle={analysis?.route_title}
                />
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
