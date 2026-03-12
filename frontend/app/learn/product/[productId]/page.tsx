import Image from "next/image";
import Link from "next/link";
import EvidenceReadout from "@/components/site/EvidenceReadout";
import {
  fetchMobileWikiProductDetail,
  fetchProductAnalysis,
  resolveStoredImageUrl,
} from "@/lib/api";
import { getMatchRouteMeta } from "@/lib/match";
import {
  analysisConfidenceLabel,
  analysisCounterProof,
  analysisPositiveProof,
  analysisReviewLabel,
  analysisVerdictLabel,
  analysisVerdictSummary,
} from "@/lib/productEvidence";
import { categoryHref, getCategoryMeta, normalizeCategoryKey } from "@/lib/site";

function mergeUnique(items: string[]): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

export default async function LearnProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }> | { productId: string };
}) {
  const resolvedParams = await Promise.resolve(params);
  const productId = String(resolvedParams.productId || "").trim();

  let item: Awaited<ReturnType<typeof fetchMobileWikiProductDetail>> | null = null;
  let analysis: Awaited<ReturnType<typeof fetchProductAnalysis>> | null = null;
  let loadError: string | null = null;

  try {
    [item, analysis] = await Promise.all([
      fetchMobileWikiProductDetail(productId),
      fetchProductAnalysis(productId).catch(() => null),
    ]);
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error);
  }

  if (!item || loadError) {
    return (
      <div className="mx-auto max-w-4xl px-4 pb-16 pt-8">
        <article className="rounded-[32px] border border-rose-200 bg-rose-50 px-6 py-6 text-rose-700 shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em]">Learn entry unavailable</p>
          <h1 className="mt-3 text-[34px] font-semibold tracking-[-0.04em]">This product encyclopedia entry could not be loaded.</h1>
          <p className="mt-4 text-[15px] leading-7">{loadError || "Unknown learn entry error."}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/learn"
              className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-5 text-[14px] font-semibold text-white"
            >
              Back to learn
            </Link>
            <Link
              href="/shop"
              className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[14px] font-semibold text-slate-700"
            >
              Browse shop
            </Link>
          </div>
        </article>
      </div>
    );
  }

  const category = getCategoryMeta(item.product.category);
  const productName = item.product.name || "Untitled product";
  const productBrand = item.product.brand || "Jeslect";
  const imageSrc = resolveStoredImageUrl(item.doc.evidence.image_path);
  const profile = analysis?.item.profile || null;
  const routeMeta = profile ? getMatchRouteMeta(profile.category, profile.route_key) : null;
  const summaryText =
    profile?.positioning_summary || item.doc.summary.one_sentence || "Open the shopping profile when you want the storefront version.";
  const bestFor = mergeUnique(profile?.best_for || item.doc.summary.who_for || []);
  const notIdealFor = mergeUnique(profile?.not_ideal_for || item.doc.summary.who_not_for || []);
  const usageTips = mergeUnique(profile?.usage_tips || []);
  const normalizedCategory = normalizeCategoryKey(item.product.category);
  const confidenceLabel = analysisConfidenceLabel(profile?.confidence);
  const verdictLabel = analysisVerdictLabel(profile?.subtype_fit_verdict);
  const verdictSummary = analysisVerdictSummary(profile?.subtype_fit_verdict);
  const reviewLabel = analysisReviewLabel(profile?.needs_review);
  const positiveProof = analysisPositiveProof(profile, 3);
  const counterProof = analysisCounterProof(profile, 3);
  const fallbackSupport = item.doc.summary.pros.slice(0, 3);
  const fallbackGuardrails = item.doc.summary.cons.slice(0, 3);
  const resolvedIngredientCount = item.ingredient_refs.filter((ref) => ref.ingredient_id).length;
  const evidenceNote =
    profile?.subtype_fit_reason ||
    (resolvedIngredientCount > 0
      ? `${resolvedIngredientCount} ingredient links are already resolved into the Jeslect ingredient library.`
      : "Ingredient linking is still being expanded across this product profile.");
  const keyIngredients =
    profile?.key_ingredients?.slice(0, 6) ||
    item.doc.ingredients.slice(0, 6).map((ingredient) => ({
      ingredient_name_cn: ingredient.name,
      ingredient_name_en: ingredient.name,
      rank: ingredient.rank || 0,
      role: ingredient.type || "Ingredient",
      impact: ingredient.functions.join(", "),
    }));

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8">
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
                Product imagery is still being mapped for this encyclopedia entry.
              </div>
            )}
          </div>
        </article>

        <article className="rounded-[36px] border border-black/8 bg-white/94 p-6 shadow-[0_28px_72px_rgba(15,23,42,0.08)] lg:sticky lg:top-24">
          <div className="flex flex-wrap gap-2">
            {category ? (
              <span className="rounded-full border border-black/8 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                {category.label}
              </span>
            ) : null}
            {item.target_type_title ? (
              <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700">
                {item.target_type_title}
              </span>
            ) : null}
            {profile?.route_title ? (
              <span className="rounded-full border border-black/8 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                {routeMeta?.title || profile.route_title}
              </span>
            ) : null}
          </div>
          <p className="mt-4 text-[12px] font-medium uppercase tracking-[0.18em] text-slate-500">{productBrand}</p>
          <h1 className="mt-2 text-[38px] font-semibold leading-[0.98] tracking-[-0.05em] text-slate-950">{productName}</h1>
          <p className="mt-4 text-[16px] leading-7 text-slate-600">{summaryText}</p>
          {routeMeta?.summary ? <p className="mt-3 text-[14px] leading-6 text-slate-500">{routeMeta.summary}</p> : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/product/${encodeURIComponent(productId)}`}
              className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-5 text-[14px] font-semibold text-white"
            >
              Open shopping profile
            </Link>
            <Link
              href={`/compare?category=${encodeURIComponent(item.product.category)}&pick=${encodeURIComponent(productId)}`}
              className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[14px] font-semibold text-slate-700"
            >
              Compare this product
            </Link>
            <Link
              href={`/learn?category=${encodeURIComponent(item.product.category)}`}
              className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[14px] font-semibold text-slate-700"
            >
              Back to learn
            </Link>
          </div>
        </article>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-6">
          <article className="rounded-[32px] border border-black/8 bg-white/92 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Best for</p>
                <div className="mt-4 space-y-3">
                  {bestFor.length > 0 ? (
                    bestFor.map((value) => (
                      <div key={value} className="rounded-[22px] border border-emerald-100 bg-emerald-50 px-4 py-4 text-[14px] leading-6 text-slate-700">
                        {value}
                      </div>
                    ))
                  ) : (
                    <p className="text-[14px] leading-6 text-slate-600">No best-for guidance is mapped yet.</p>
                  )}
                </div>
              </div>
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Not ideal for</p>
                <div className="mt-4 space-y-3">
                  {notIdealFor.length > 0 ? (
                    notIdealFor.map((value) => (
                      <div key={value} className="rounded-[22px] border border-amber-100 bg-amber-50 px-4 py-4 text-[14px] leading-6 text-slate-700">
                        {value}
                      </div>
                    ))
                  ) : (
                    <p className="text-[14px] leading-6 text-slate-600">No edge-case guidance is mapped yet.</p>
                  )}
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-[32px] border border-black/8 bg-white/92 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">How to read this product</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {usageTips.length > 0 ? (
                usageTips.map((value) => (
                  <div key={value} className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4 text-[14px] leading-6 text-slate-700">
                    {value}
                  </div>
                ))
              ) : (
                <p className="text-[14px] leading-6 text-slate-600">
                  No structured usage tips are mapped yet. Use the shopping profile when you need purchase-oriented guidance.
                </p>
              )}
            </div>
          </article>

          <article className="rounded-[32px] border border-black/8 bg-white/92 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Key ingredients</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {keyIngredients.map((ingredient) => (
                <article
                  key={`${ingredient.ingredient_name_en}-${ingredient.rank}`}
                  className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4"
                >
                  <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-slate-950">
                    {ingredient.ingredient_name_en || ingredient.ingredient_name_cn}
                  </h3>
                  <p className="mt-2 text-[13px] font-medium uppercase tracking-[0.12em] text-slate-500">{ingredient.role}</p>
                  <p className="mt-2 text-[14px] leading-6 text-slate-600">{ingredient.impact}</p>
                </article>
              ))}
            </div>
          </article>
        </div>

        <div className="space-y-6">
          <EvidenceReadout
            eyebrow="Evidence basis"
            title="Read the same trust layer that powers the shopping profile."
            summary={
              verdictSummary ||
              "Learn entries reuse the product analysis layer so ingredient education and shopping guidance stay aligned."
            }
            badges={[confidenceLabel, verdictLabel, reviewLabel]}
            supportTitle="What supports this profile"
            supportItems={positiveProof.length > 0 ? positiveProof : fallbackSupport}
            supportEmpty="No structured supporting signals are available yet."
            guardrailTitle="What to keep in mind"
            guardrailItems={counterProof.length > 0 ? counterProof : fallbackGuardrails}
            guardrailEmpty="No structured evidence guardrails are mapped yet."
            note={evidenceNote}
          />

          <article className="rounded-[32px] border border-black/8 bg-white/92 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Resolved ingredient links</p>
            <div className="mt-4 space-y-3">
              {item.ingredient_refs.length > 0 ? (
                item.ingredient_refs.map((ref) =>
                  ref.ingredient_id ? (
                    <Link
                      key={`${ref.index}-${ref.name}`}
                      href={`/learn/ingredient/${encodeURIComponent(item.product.category)}/${encodeURIComponent(ref.ingredient_id)}`}
                      className="block rounded-[22px] border border-black/8 bg-slate-50 px-4 py-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700">
                          {ref.status}
                        </span>
                        <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-slate-500">
                          Ingredient {ref.index + 1}
                        </span>
                      </div>
                      <h3 className="mt-3 text-[18px] font-semibold tracking-[-0.02em] text-slate-950">{ref.name}</h3>
                    </Link>
                  ) : (
                    <article key={`${ref.index}-${ref.name}`} className="rounded-[22px] border border-black/8 bg-slate-50 px-4 py-4">
                      <div className="text-[12px] font-medium uppercase tracking-[0.12em] text-slate-500">Ingredient {ref.index + 1}</div>
                      <h3 className="mt-2 text-[18px] font-semibold tracking-[-0.02em] text-slate-950">{ref.name}</h3>
                      <p className="mt-2 text-[14px] leading-6 text-slate-600">
                        This ingredient is not linked to a standalone library profile yet.
                      </p>
                    </article>
                  ),
                )
              ) : (
                <p className="text-[14px] leading-6 text-slate-600">No ingredient links were resolved for this product yet.</p>
              )}
            </div>
          </article>

          <article className="rounded-[32px] border border-black/8 bg-white/92 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Full ingredient list</p>
            <p className="mt-4 text-[14px] leading-7 text-slate-700">
              {item.doc.ingredients.length > 0 ? item.doc.ingredients.map((ingredient) => ingredient.name).join(", ") : "No ingredient list is available."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={categoryHref(normalizedCategory || "shampoo")}
                className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-semibold text-slate-700"
              >
                Shop this category
              </Link>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
