import Image from "next/image";
import Link from "next/link";
import AddToBagButton from "@/components/site/AddToBagButton";
import ProductCard from "@/components/site/ProductCard";
import RecentProductTracker from "@/components/site/RecentProductTracker";
import TrustStrip from "@/components/site/TrustStrip";
import {
  fetchAllProducts,
  fetchProductAnalysis,
  fetchProductDoc,
  resolveStoredImageUrl,
  type Product,
} from "@/lib/api";
import { getMatchRouteMeta } from "@/lib/match";
import { getCategoryMeta, TRUST_ITEMS } from "@/lib/site";
import { PDP_SUPPORT_LINKS, PDP_TRUST_NOTES, PRODUCT_RELEASE_NOTES } from "@/lib/storefrontTrust";

function mergeUnique(items: string[]): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolvedParams = await Promise.resolve(params);
  const id = String(resolvedParams.id || "").trim();

  let docError: string | null = null;
  let doc: Awaited<ReturnType<typeof fetchProductDoc>> | null = null;
  let analysis: Awaited<ReturnType<typeof fetchProductAnalysis>> | null = null;
  let relatedProducts: Product[] = [];

  try {
    [doc, analysis, relatedProducts] = await Promise.all([
      fetchProductDoc(id),
      fetchProductAnalysis(id).catch(() => null),
      fetchAllProducts().then((items) => items).catch(() => []),
    ]);
  } catch (err) {
    docError = err instanceof Error ? err.message : String(err);
  }

  if (!doc || docError) {
    return (
      <div className="mx-auto max-w-4xl px-4 pb-16 pt-8">
        <article className="rounded-[32px] border border-rose-200 bg-rose-50 px-6 py-6 text-rose-700 shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em]">Product unavailable</p>
          <h1 className="mt-3 text-[34px] font-semibold tracking-[-0.04em]">This product could not be loaded.</h1>
          <p className="mt-4 text-[15px] leading-7">The storefront did not receive a usable product response.</p>
          <p className="mt-3 rounded-[20px] border border-rose-200 bg-white/70 px-4 py-3 text-[13px] leading-6">
            {docError || "Unknown product loading error."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/shop"
              className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-5 text-[14px] font-semibold text-white"
            >
              Back to shop
            </Link>
            <Link
              href="/support/contact"
              className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[14px] font-semibold text-slate-700"
            >
              Contact support
            </Link>
          </div>
        </article>
      </div>
    );
  }

  const productName = doc.product.name || "Untitled product";
  const productBrand = doc.product.brand || "Jeslect";
  const category = getCategoryMeta(doc.product.category);
  const imageSrc = resolveStoredImageUrl(doc.evidence.image_path);
  const profile = analysis?.item.profile || null;
  const routeMeta = profile ? getMatchRouteMeta(profile.category, profile.route_key) : null;
  const summaryText = profile?.positioning_summary || doc.summary.one_sentence || "Open the ingredient list and usage notes before you buy.";
  const bestFor = mergeUnique(profile?.best_for || doc.summary.who_for || []);
  const notIdealFor = mergeUnique(profile?.not_ideal_for || doc.summary.who_not_for || []);
  const benefits = mergeUnique(doc.summary.pros || []);
  const watchouts = mergeUnique(profile?.watchouts || doc.summary.cons || []);
  const usageTips = mergeUnique(profile?.usage_tips || []);
  const keyIngredients =
    profile?.key_ingredients?.slice(0, 6) ||
    doc.ingredients.slice(0, 6).map((item) => ({
      ingredient_name_cn: item.name,
      ingredient_name_en: item.name,
      rank: item.rank || 0,
      role: item.type || "Ingredient",
      impact: item.functions.join(", "),
    }));
  const related = relatedProducts
    .filter((item) => item.id !== id && item.category === doc.product.category)
    .slice(0, 3);
  const routeTitle = routeMeta?.title || profile?.route_title || null;
  const routeSummary = routeMeta?.summary || null;
  const fitHeadline = profile?.headline || null;
  const fitReason = profile?.confidence_reason || null;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8">
      {category ? (
        <RecentProductTracker
          snapshot={{
            productId: id,
            category: category.key,
            name: productName,
            brand: productBrand,
            summary: summaryText,
            imageUrl: imageSrc,
            routeTitle,
            routeSummary,
          }}
        />
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1fr_0.92fr] lg:items-start">
        <article className="overflow-hidden rounded-[36px] border border-black/8 bg-white/92 shadow-[0_28px_72px_rgba(15,23,42,0.08)]">
          <div className="relative aspect-[4/4.6] bg-[linear-gradient(180deg,#f8fbff_0%,#edf4fb_100%)]">
            {imageSrc ? (
              <Image
                src={imageSrc}
                alt={productName}
                fill
                priority
                sizes="(min-width: 1024px) 46vw, 100vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center px-8 text-center text-[15px] text-slate-500">
                Product imagery is still being mapped for this profile.
              </div>
            )}
          </div>
        </article>

        <article className="rounded-[36px] border border-black/8 bg-white/94 p-6 shadow-[0_28px_72px_rgba(15,23,42,0.08)] lg:sticky lg:top-24">
          <div className="flex flex-wrap items-center gap-2">
            {category ? (
              <span className="rounded-full border border-black/8 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                {category.label}
              </span>
            ) : null}
            {profile?.route_title ? (
              <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700">
                {routeMeta?.title || profile.route_title}
              </span>
            ) : null}
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700">
              Catalog live
            </span>
            {typeof profile?.confidence === "number" ? (
              <span className="rounded-full border border-black/8 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                Confidence {profile.confidence}%
              </span>
            ) : null}
          </div>
          <p className="mt-4 text-[12px] font-medium uppercase tracking-[0.18em] text-slate-500">{productBrand}</p>
          <h1 className="mt-2 text-[38px] font-semibold leading-[0.98] tracking-[-0.05em] text-slate-950">{productName}</h1>
          <p className="mt-4 text-[16px] leading-7 text-slate-600">{summaryText}</p>
          {routeMeta?.summary ? <p className="mt-3 text-[14px] leading-6 text-slate-500">{routeMeta.summary}</p> : null}
          <div className="mt-6 flex flex-wrap gap-3">
            <AddToBagButton productId={id} />
            <Link
              href={`/compare?category=${encodeURIComponent(doc.product.category)}&pick=${encodeURIComponent(id)}`}
              className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[13px] font-semibold text-slate-700"
            >
              Compare
            </Link>
            <Link
              href={doc.product.category === "shampoo" ? "/match" : `/match?category=${encodeURIComponent(doc.product.category)}`}
              className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[13px] font-semibold text-slate-700"
            >
              Find my match
            </Link>
          </div>
          <TrustStrip items={TRUST_ITEMS} className="mt-6" />
          <div className="mt-6 rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-500">Current release status</p>
            <div className="mt-3 space-y-2">
              {PRODUCT_RELEASE_NOTES.map((item) => (
                <p key={item} className="text-[13px] leading-6 text-slate-700">
                  {item}
                </p>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/bag" className="rounded-full border border-black/8 bg-white px-4 py-2 text-[13px] font-medium text-slate-700">
                Saved shortlist
              </Link>
              <Link href="/support/faq" className="rounded-full border border-black/8 bg-white px-4 py-2 text-[13px] font-medium text-slate-700">
                Why no price yet
              </Link>
            </div>
          </div>
        </article>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-6">
          <article className="rounded-[32px] border border-black/8 bg-white/92 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Benefits</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {benefits.length > 0 ? (
                benefits.slice(0, 6).map((item) => (
                  <div key={item} className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4 text-[14px] leading-6 text-slate-700">
                    {item}
                  </div>
                ))
              ) : (
                <p className="text-[14px] leading-6 text-slate-600">No structured benefit summary is available yet.</p>
              )}
            </div>
          </article>

          <article className="rounded-[32px] border border-black/8 bg-white/92 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Best for</p>
                <ul className="mt-4 space-y-3">
                  {bestFor.length > 0 ? (
                    bestFor.map((item) => (
                      <li key={item} className="rounded-[22px] border border-emerald-100 bg-emerald-50 px-4 py-4 text-[14px] leading-6 text-slate-700">
                        {item}
                      </li>
                    ))
                  ) : (
                    <li className="text-[14px] leading-6 text-slate-600">No best-for profile is available yet.</li>
                  )}
                </ul>
              </div>

              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Not ideal for</p>
                <ul className="mt-4 space-y-3">
                  {notIdealFor.length > 0 ? (
                    notIdealFor.map((item) => (
                      <li key={item} className="rounded-[22px] border border-amber-100 bg-amber-50 px-4 py-4 text-[14px] leading-6 text-slate-700">
                        {item}
                      </li>
                    ))
                  ) : (
                    <li className="text-[14px] leading-6 text-slate-600">No explicit edge cases are mapped yet.</li>
                  )}
                </ul>
              </div>
            </div>
          </article>

          <article className="rounded-[32px] border border-black/8 bg-white/92 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">How to use</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {usageTips.length > 0 ? (
                usageTips.map((item) => (
                  <div key={item} className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4 text-[14px] leading-6 text-slate-700">
                    {item}
                  </div>
                ))
              ) : (
                <p className="text-[14px] leading-6 text-slate-600">
                  Structured usage guidance is still being rebuilt. Use this product with the routine notes from the full profile.
                </p>
              )}
            </div>
          </article>

          <article className="rounded-[32px] border border-black/8 bg-white/92 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Ingredients</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {keyIngredients.map((item) => (
                <article key={`${item.ingredient_name_en}-${item.rank}`} className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4">
                  <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-slate-950">{item.ingredient_name_en || item.ingredient_name_cn}</h3>
                  <p className="mt-2 text-[13px] font-medium uppercase tracking-[0.12em] text-slate-500">{item.role}</p>
                  <p className="mt-2 text-[14px] leading-6 text-slate-600">{item.impact}</p>
                </article>
              ))}
            </div>
            <div className="mt-5 rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4">
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-500">Full ingredient list</p>
              <p className="mt-3 text-[14px] leading-7 text-slate-700">
                {doc.ingredients.length > 0 ? doc.ingredients.map((item) => item.name).join(", ") : "No ingredient list is available yet."}
              </p>
            </div>
          </article>
        </div>

        <div className="space-y-6">
          <article className="rounded-[32px] border border-black/8 bg-white/92 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Route fit</p>
            <h2 className="mt-4 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">
              Why this product belongs in this route
            </h2>
            <p className="mt-3 text-[15px] leading-7 text-slate-600">
              {fitHeadline || "Jeslect keeps the route explanation and product explanation aligned so the recommendation feels consistent across pages."}
            </p>

            {routeTitle ? (
              <div className="mt-5 rounded-[24px] border border-sky-100 bg-sky-50 px-4 py-4">
                <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-sky-700">Matched route</div>
                <div className="mt-2 text-[20px] font-semibold tracking-[-0.03em] text-slate-950">{routeTitle}</div>
                {routeSummary ? <p className="mt-2 text-[14px] leading-6 text-slate-700">{routeSummary}</p> : null}
                {fitReason ? <p className="mt-3 text-[13px] leading-6 text-slate-600">{fitReason}</p> : null}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={doc.product.category === "shampoo" ? "/match" : `/match?category=${encodeURIComponent(doc.product.category)}`}
                className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-5 text-[13px] font-semibold text-white"
              >
                Recheck with match
              </Link>
              <Link
                href={`/learn/product/${encodeURIComponent(id)}`}
                className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[13px] font-semibold text-slate-700"
              >
                Read learn entry
              </Link>
            </div>
          </article>

          <article className="rounded-[32px] border border-black/8 bg-white/92 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Decision support</p>
            <h2 className="mt-4 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">Still deciding?</h2>
            <p className="mt-3 text-[15px] leading-7 text-slate-600">
              Use compare when two products seem close, or use match when you want the routine narrowed down around your own needs.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/compare"
                className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-5 text-[13px] font-semibold text-white"
              >
                Compare side by side
              </Link>
              <Link
                href={doc.product.category === "shampoo" ? "/match" : `/match?category=${encodeURIComponent(doc.product.category)}`}
                className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[13px] font-semibold text-slate-700"
              >
                Get a match
              </Link>
            </div>
          </article>

          <article className="rounded-[32px] border border-black/8 bg-white/92 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Watchouts</p>
            <ul className="mt-4 space-y-3">
              {watchouts.length > 0 ? (
                watchouts.map((item) => (
                  <li key={item} className="rounded-[22px] border border-amber-100 bg-amber-50 px-4 py-4 text-[14px] leading-6 text-slate-700">
                    {item}
                  </li>
                ))
              ) : (
                <li className="text-[14px] leading-6 text-slate-600">No structured caution notes are available yet.</li>
              )}
            </ul>
          </article>

          <article className="rounded-[32px] border border-black/8 bg-white/92 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Shipping, returns, and support</p>
            <h2 className="mt-4 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">
              Keep the trust layer visible before checkout exists.
            </h2>
            <p className="mt-3 text-[15px] leading-7 text-slate-600">
              The product page should answer the basic confidence questions before you leave it: how shipping is framed,
              where returns live, and how support is routed.
            </p>

            <div className="mt-5 space-y-3">
              {PDP_SUPPORT_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-[22px] border border-black/8 bg-slate-50 px-4 py-4 transition hover:-translate-y-[1px] hover:bg-white hover:shadow-[0_12px_28px_rgba(15,23,42,0.05)]"
                >
                  <h3 className="text-[15px] font-semibold text-slate-950">{item.title}</h3>
                  <p className="mt-2 text-[14px] leading-6 text-slate-600">{item.summary}</p>
                </Link>
              ))}
            </div>

            <div className="mt-6 rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4">
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-500">Bag continuity</p>
              <p className="mt-3 text-[14px] leading-6 text-slate-700">{PDP_TRUST_NOTES[0]}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/bag" className="rounded-full border border-black/8 bg-white px-4 py-2 text-[13px] font-medium text-slate-700">
                  Open bag
                </Link>
                <Link href="/saved" className="rounded-full border border-black/8 bg-white px-4 py-2 text-[13px] font-medium text-slate-700">
                  Saved activity
                </Link>
                <Link href="/support/faq" className="rounded-full border border-black/8 bg-white px-4 py-2 text-[13px] font-medium text-slate-700">
                  More FAQ
                </Link>
              </div>
            </div>
          </article>
        </div>
      </section>

      {related.length > 0 ? (
        <section className="mt-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Related products</p>
              <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.04em] text-slate-950">Explore the same routine layer.</h2>
            </div>
            <Link href={`/shop/${encodeURIComponent(doc.product.category)}`} className="text-[14px] font-semibold text-sky-700">
              View category
            </Link>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {related.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
