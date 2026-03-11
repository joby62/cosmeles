import ProductCard from "@/components/site/ProductCard";
import { fetchAllProducts, type Product } from "@/lib/api";
import { CATEGORIES } from "@/lib/site";

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
  const resolvedSearchParams = (await Promise.resolve(searchParams)) || {};
  const query = firstValue(resolvedSearchParams.q);

  let products: Product[] = [];
  let loadError: string | null = null;
  try {
    products = await fetchAllProducts();
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  }

  const results = query ? products.filter((product) => matchesQuery(product, query)).slice(0, 18) : [];

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8">
      <section className="rounded-[40px] border border-black/8 bg-white/92 px-5 py-8 shadow-[0_28px_72px_rgba(15,23,42,0.08)] md:px-8 md:py-10">
        <div className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
          Search
        </div>
        <h1 className="site-display mt-5 text-[42px] leading-[0.98] tracking-[-0.05em] text-slate-950 sm:text-[56px]">
          Search products, brands, or ingredient language.
        </h1>
        <form className="mt-6">
          <label className="sr-only" htmlFor="search-input">
            Search products
          </label>
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              id="search-input"
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search products, brands, or concerns"
              className="h-12 flex-1 rounded-full border border-black/10 bg-white px-5 text-[15px] text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            />
            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-6 text-[14px] font-semibold text-white shadow-[0_14px_36px_rgba(0,113,227,0.28)]"
            >
              Search
            </button>
          </div>
        </form>
        {!query ? (
          <div className="mt-6 flex flex-wrap gap-2">
            {CATEGORIES.map((category) => (
              <a
                key={category.key}
                href={`/shop/${category.key}`}
                className="rounded-full border border-black/8 bg-slate-50 px-4 py-2 text-[13px] font-medium text-slate-700"
              >
                {category.label}
              </a>
            ))}
          </div>
        ) : null}
      </section>

      {loadError ? (
        <article className="mt-8 rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-5 text-[14px] leading-6 text-rose-700">
          Search failed: {loadError}
        </article>
      ) : null}

      {!loadError && query ? (
        <section className="mt-10">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Results</p>
          <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.04em] text-slate-950">
            {results.length} matches for &quot;{query}&quot;
          </h2>
          {results.length > 0 ? (
            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {results.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <article className="mt-6 rounded-[28px] border border-black/8 bg-white/92 px-5 py-5 text-[15px] leading-6 text-slate-600">
              No live products matched that search yet. Try a brand, a category name, or a routine concern.
            </article>
          )}
        </section>
      ) : null}
    </div>
  );
}
