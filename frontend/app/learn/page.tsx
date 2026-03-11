import Image from "next/image";
import Link from "next/link";
import {
  fetchIngredientLibrary,
  fetchMobileWikiProducts,
  resolveImageUrl,
  type IngredientLibraryListItem,
  type MobileWikiProductItem,
} from "@/lib/api";
import { CATEGORIES, categoryHref, normalizeCategoryKey, type CategoryKey } from "@/lib/site";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type LearnTab = "products" | "ingredients";

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? String(value[0] || "").trim() : String(value || "").trim();
}

function buildLearnHref(tab: LearnTab, category: CategoryKey, query = ""): string {
  const params = new URLSearchParams();
  if (tab !== "products") params.set("tab", tab);
  if (category !== "shampoo") params.set("category", category);
  if (query.trim()) params.set("q", query.trim());
  const serialized = params.toString();
  return serialized ? `/learn?${serialized}` : "/learn";
}

function productTitle(item: MobileWikiProductItem): string {
  return item.product.name || item.product.brand || "Untitled product";
}

function ingredientTitle(item: IngredientLibraryListItem): string {
  return item.ingredient_name_en || item.ingredient_name || "Untitled ingredient";
}

export default async function LearnPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const resolvedSearchParams = (await Promise.resolve(searchParams)) || {};
  const tab: LearnTab = firstValue(resolvedSearchParams.tab) === "ingredients" ? "ingredients" : "products";
  const category = normalizeCategoryKey(firstValue(resolvedSearchParams.category)) || "shampoo";
  const query = firstValue(resolvedSearchParams.q);

  let productPayload:
    | {
        items: MobileWikiProductItem[];
        total: number;
      }
    | null = null;
  let ingredientPayload:
    | {
        items: IngredientLibraryListItem[];
        total: number;
      }
    | null = null;
  let loadError: string | null = null;

  try {
    if (tab === "products") {
      const response = await fetchMobileWikiProducts({
        category,
        q: query || undefined,
        limit: 18,
        offset: 0,
      });
      productPayload = {
        items: response.items || [],
        total: response.total || 0,
      };
    } else {
      const response = await fetchIngredientLibrary({
        category,
        q: query || undefined,
        limit: 18,
        offset: 0,
      });
      ingredientPayload = {
        items: response.items || [],
        total: response.total || 0,
      };
    }
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error);
  }

  const activeCategory = CATEGORIES.find((entry) => entry.key === category);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8">
      <section className="overflow-hidden rounded-[40px] border border-black/8 bg-white/92 px-5 py-8 shadow-[0_28px_72px_rgba(15,23,42,0.08)] md:px-8 md:py-10">
        <div className="max-w-3xl">
          <div className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
            Jeslect Learn
          </div>
          <h1 className="site-display mt-5 text-[42px] leading-[0.98] tracking-[-0.05em] text-slate-950 sm:text-[56px]">
            Browse product knowledge and ingredient reading in one place.
          </h1>
          <p className="mt-5 text-[17px] leading-8 text-slate-600">
            Use product encyclopedia entries when you want routine context. Switch to ingredients when you want the
            formulation layer explained in plain English.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href={buildLearnHref("products", category, query)}
              className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-[14px] font-semibold ${
                tab === "products"
                  ? "bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] text-white shadow-[0_12px_30px_rgba(0,113,227,0.26)]"
                  : "border border-black/10 bg-white text-slate-700"
              }`}
            >
              Product encyclopedia
            </Link>
            <Link
              href={buildLearnHref("ingredients", category, query)}
              className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-[14px] font-semibold ${
                tab === "ingredients"
                  ? "bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] text-white shadow-[0_12px_30px_rgba(0,113,227,0.26)]"
                  : "border border-black/10 bg-white text-slate-700"
              }`}
            >
              Ingredient library
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-[32px] border border-black/8 bg-white/92 p-5 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Filters</p>
            <h2 className="mt-3 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">
              {tab === "products" ? "Filter live product encyclopedia entries." : "Filter ingredient profiles by category."}
            </h2>
          </div>

          <form action="/learn" className="flex w-full flex-col gap-3 lg:max-w-xl lg:flex-row">
            <input type="hidden" name="tab" value={tab} />
            <input type="hidden" name="category" value={category} />
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder={tab === "products" ? "Search by product or brand" : "Search by ingredient name"}
              className="h-12 flex-1 rounded-full border border-black/10 bg-white px-5 text-[15px] text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            />
            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-6 text-[14px] font-semibold text-white shadow-[0_14px_36px_rgba(0,113,227,0.28)]"
            >
              Search
            </button>
          </form>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {CATEGORIES.map((entry) => {
            const active = entry.key === category;
            return (
              <Link
                key={entry.key}
                href={buildLearnHref(tab, entry.key, query)}
                className={`inline-flex h-10 items-center justify-center rounded-full px-4 text-[13px] font-medium ${
                  active ? "bg-slate-950 text-white" : "border border-black/8 bg-slate-50 text-slate-700"
                }`}
              >
                {entry.label}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {tab === "products" ? "Product encyclopedia" : "Ingredient library"}
            </p>
            <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.04em] text-slate-950">
              {tab === "products"
                ? `${productPayload?.total || 0} live product entries in ${activeCategory?.label || "this category"}`
                : `${ingredientPayload?.total || 0} ingredient profiles in ${activeCategory?.label || "this category"}`}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={categoryHref(category)}
              className="rounded-full border border-black/8 bg-white px-4 py-2 text-[13px] font-medium text-slate-700"
            >
              Shop {activeCategory?.label || "category"}
            </Link>
            <Link
              href="/search"
              className="rounded-full border border-black/8 bg-white px-4 py-2 text-[13px] font-medium text-slate-700"
            >
              Search storefront
            </Link>
          </div>
        </div>

        {loadError ? (
          <article className="mt-6 rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-5 text-[14px] leading-6 text-rose-700">
            Learn loading failed: {loadError}
          </article>
        ) : null}

        {!loadError && tab === "products" ? (
          productPayload && productPayload.items.length > 0 ? (
            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {productPayload.items.map((item) => {
                const title = productTitle(item);
                return (
                  <article
                    key={item.product.id}
                    className="overflow-hidden rounded-[28px] border border-black/8 bg-white/94 shadow-[0_20px_46px_rgba(15,23,42,0.06)]"
                  >
                    <Link href={`/learn/product/${encodeURIComponent(item.product.id)}`} className="block">
                      <div className="relative aspect-[1/1.02] overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef4fb_100%)]">
                        <Image
                          src={resolveImageUrl(item.product)}
                          alt={title}
                          fill
                          sizes="(min-width: 1280px) 280px, (min-width: 768px) 33vw, 100vw"
                          className="object-cover"
                        />
                      </div>
                    </Link>
                    <div className="p-5">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-black/8 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                          {item.category_label}
                        </span>
                        {item.target_type_title ? (
                          <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700">
                            {item.target_type_title}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-4 text-[12px] font-medium uppercase tracking-[0.18em] text-slate-500">
                        {item.product.brand || "Jeslect"}
                      </p>
                      <h3 className="mt-2 text-[22px] font-semibold leading-[1.15] tracking-[-0.03em] text-slate-950">
                        {title}
                      </h3>
                      <p className="mt-3 line-clamp-3 text-[14px] leading-6 text-slate-600">
                        {item.product.one_sentence || "Open this product encyclopedia entry for ingredient context and fit notes."}
                      </p>
                      <div className="mt-5 flex flex-wrap gap-2">
                        <Link
                          href={`/learn/product/${encodeURIComponent(item.product.id)}`}
                          className="inline-flex h-10 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-4 text-[13px] font-semibold text-white"
                        >
                          Open learn entry
                        </Link>
                        <Link
                          href={`/product/${encodeURIComponent(item.product.id)}`}
                          className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-semibold text-slate-700"
                        >
                          Shop profile
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <article className="mt-6 rounded-[28px] border border-black/8 bg-white/92 px-5 py-5 text-[15px] leading-6 text-slate-600">
              No product encyclopedia entries matched that filter yet.
            </article>
          )
        ) : null}

        {!loadError && tab === "ingredients" ? (
          ingredientPayload && ingredientPayload.items.length > 0 ? (
            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {ingredientPayload.items.map((item) => (
                <article
                  key={`${item.category}-${item.ingredient_id}`}
                  className="rounded-[28px] border border-black/8 bg-white/94 p-5 shadow-[0_20px_46px_rgba(15,23,42,0.06)]"
                >
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-black/8 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                      {item.category}
                    </span>
                    <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700">
                      {item.source_count} source{item.source_count === 1 ? "" : "s"}
                    </span>
                  </div>
                  <h3 className="mt-4 text-[22px] font-semibold leading-[1.12] tracking-[-0.03em] text-slate-950">
                    {ingredientTitle(item)}
                  </h3>
                  {item.ingredient_name_en && item.ingredient_name_en !== item.ingredient_name ? (
                    <p className="mt-2 text-[13px] font-medium uppercase tracking-[0.14em] text-slate-500">
                      {item.ingredient_name}
                    </p>
                  ) : null}
                  <p className="mt-3 line-clamp-4 text-[14px] leading-6 text-slate-600">{item.summary}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link
                      href={`/learn/ingredient/${encodeURIComponent(item.category)}/${encodeURIComponent(item.ingredient_id)}`}
                      className="inline-flex h-10 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-4 text-[13px] font-semibold text-white"
                    >
                      Open ingredient
                    </Link>
                    <Link
                      href={categoryHref(category)}
                      className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-semibold text-slate-700"
                    >
                      Shop category
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <article className="mt-6 rounded-[28px] border border-black/8 bg-white/92 px-5 py-5 text-[15px] leading-6 text-slate-600">
              No ingredient entries matched that filter yet.
            </article>
          )
        ) : null}
      </section>
    </div>
  );
}
