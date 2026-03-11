import Link from "next/link";
import ProductCard from "@/components/site/ProductCard";
import TrustStrip from "@/components/site/TrustStrip";
import { fetchAllProducts, type Product } from "@/lib/api";
import { categoryHref, CATEGORIES, LEARN_TOPICS, SHOP_CONCERNS, TRUST_ITEMS, type CategoryKey } from "@/lib/site";

function pickHighlights(products: Product[]) {
  const byCategory = new Map<CategoryKey, Product>();

  for (const item of products) {
    const key = String(item.category || "").trim().toLowerCase() as CategoryKey;
    if (!byCategory.has(key)) {
      byCategory.set(key, item);
    }
  }

  return CATEGORIES.map((category) => byCategory.get(category.key)).filter((item): item is Product => Boolean(item));
}

export default async function HomePage() {
  let products: Product[] = [];
  let loadError: string | null = null;

  try {
    products = await fetchAllProducts();
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  }

  const highlights = pickHighlights(products).slice(0, 4);
  const counts = new Map<CategoryKey, number>();
  for (const category of CATEGORIES) counts.set(category.key, 0);
  for (const item of products) {
    const key = String(item.category || "").trim().toLowerCase() as CategoryKey;
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8">
      <section className="overflow-hidden rounded-[40px] border border-black/8 bg-white/92 px-5 py-8 shadow-[0_28px_72px_rgba(15,23,42,0.08)] md:px-8 md:py-10">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700">
              Jeslect US launch
            </div>
            <h1 className="site-display mt-5 text-[44px] leading-[0.96] tracking-[-0.05em] text-slate-950 sm:text-[56px] lg:text-[72px]">
              Find products that fit your routine.
            </h1>
            <p className="mt-5 max-w-2xl text-[17px] leading-8 text-slate-600">
              Jeslect is rebuilding the shopping journey around clear product fit, lower-friction comparison, and calmer
              routine decisions for hair, body, and skin.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/match"
                className="inline-flex h-12 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-6 text-[14px] font-semibold text-white shadow-[0_14px_36px_rgba(0,113,227,0.28)]"
              >
                Find my match
              </Link>
              <Link
                href="/shop"
                className="inline-flex h-12 items-center justify-center rounded-full border border-black/10 bg-white px-6 text-[14px] font-semibold text-slate-700"
              >
                Shop the current edit
              </Link>
            </div>
            <TrustStrip items={TRUST_ITEMS} className="mt-6" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {CATEGORIES.map((category) => (
              <Link
                key={category.key}
                href={categoryHref(category.key)}
                className="rounded-[28px] border border-black/8 bg-[linear-gradient(180deg,#fbfdff_0%,#f3f7fc_100%)] p-5 transition hover:-translate-y-[1px] hover:shadow-[0_18px_44px_rgba(15,23,42,0.08)]"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{category.eyebrow}</div>
                <h2 className="mt-3 text-[24px] font-semibold tracking-[-0.03em] text-slate-950">{category.label}</h2>
                <p className="mt-3 text-[14px] leading-6 text-slate-600">{category.description}</p>
                <div className="mt-5 flex items-center justify-between text-[13px] font-medium text-slate-700">
                  <span>{counts.get(category.key) || 0} products currently mapped</span>
                  <span>Open</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-slate-500">Shop by concern</p>
            <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.04em] text-slate-950">Start with the problem you want to solve.</h2>
          </div>
          <Link href="/shop" className="text-[14px] font-semibold text-sky-700">
            View all categories
          </Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {SHOP_CONCERNS.map((concern) => (
            <Link
              key={concern.key}
              href={concern.href}
              className="rounded-[28px] border border-black/8 bg-white/88 p-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)] transition hover:-translate-y-[1px]"
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
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-slate-500">Current product edit</p>
            <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.04em] text-slate-950">Start with the clearest category picks we have live now.</h2>
          </div>
          <Link href="/shop" className="text-[14px] font-semibold text-sky-700">
            Open shop
          </Link>
        </div>

        {loadError ? (
          <article className="mt-6 rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-5 text-[14px] leading-6 text-rose-700">
            Product loading failed: {loadError}
          </article>
        ) : (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {highlights.map((product, index) => (
              <ProductCard key={product.id} product={product} priority={index < 2} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-12 grid gap-4 lg:grid-cols-3">
        <article className="rounded-[32px] border border-black/8 bg-white/92 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-sky-700">Match</p>
          <h2 className="mt-4 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">Not sure where to start?</h2>
          <p className="mt-3 text-[15px] leading-7 text-slate-600">
            Answer a few quick questions and let Jeslect rebuild the routine around your current needs.
          </p>
          <Link href="/match" className="mt-6 inline-flex text-[14px] font-semibold text-sky-700">
            Open match
          </Link>
        </article>

        <article className="rounded-[32px] border border-black/8 bg-white/92 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-sky-700">Compare</p>
          <h2 className="mt-4 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">See differences side by side.</h2>
          <p className="mt-3 text-[15px] leading-7 text-slate-600">
            Compare ingredient profile, use case, and fit signals before you commit to a product change.
          </p>
          <Link href="/compare" className="mt-6 inline-flex text-[14px] font-semibold text-sky-700">
            Open compare
          </Link>
        </article>

        <article className="rounded-[32px] border border-black/8 bg-white/92 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-sky-700">Learn</p>
          <h2 className="mt-4 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">Learn before you buy.</h2>
          <div className="mt-4 space-y-3">
            {LEARN_TOPICS.map((topic) => (
              <Link key={topic.title} href={topic.href} className="block rounded-[22px] border border-black/8 bg-slate-50 px-4 py-4">
                <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-slate-900">{topic.title}</h3>
                <p className="mt-2 text-[14px] leading-6 text-slate-600">{topic.summary}</p>
              </Link>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-12 rounded-[36px] border border-black/8 bg-[linear-gradient(180deg,#eef6ff_0%,#ffffff_100%)] px-6 py-8 shadow-[0_22px_56px_rgba(15,23,42,0.07)]">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-sky-700">Support</p>
            <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.04em] text-slate-950">Simple shipping. Clear returns. No buried basics.</h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-slate-600">
              US launch pages need shipping, returns, FAQ, and contact paths visible before checkout ever enters the picture.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/support/shipping" className="rounded-[24px] border border-black/8 bg-white px-4 py-4 text-[14px] font-medium text-slate-700">
              Shipping policy
            </Link>
            <Link href="/support/returns" className="rounded-[24px] border border-black/8 bg-white px-4 py-4 text-[14px] font-medium text-slate-700">
              Returns policy
            </Link>
            <Link href="/support/faq" className="rounded-[24px] border border-black/8 bg-white px-4 py-4 text-[14px] font-medium text-slate-700">
              Shopping FAQ
            </Link>
            <Link href="/support/contact" className="rounded-[24px] border border-black/8 bg-white px-4 py-4 text-[14px] font-medium text-slate-700">
              Contact Jeslect
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
