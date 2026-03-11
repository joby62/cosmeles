import Link from "next/link";
import ProductCard from "@/components/site/ProductCard";
import TrustStrip from "@/components/site/TrustStrip";
import { fetchAllProducts, type Product } from "@/lib/api";
import { categoryHref, CATEGORIES, SHOP_CONCERNS, TRUST_ITEMS, type CategoryKey } from "@/lib/site";

export default async function ShopHubPage() {
  let products: Product[] = [];
  let loadError: string | null = null;

  try {
    products = await fetchAllProducts();
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  }

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
            {firstEdit.slice(0, 4).map((product, index) => (
              <ProductCard key={product.id} product={product} priority={index < 2} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
