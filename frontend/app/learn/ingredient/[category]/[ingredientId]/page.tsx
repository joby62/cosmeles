import Link from "next/link";
import { fetchIngredientLibraryItem } from "@/lib/api";
import { categoryHref, getCategoryMeta, normalizeCategoryKey } from "@/lib/site";

function formatConfidence(value: number): string {
  if (!Number.isFinite(value)) return "Unknown";
  return `${Math.round(value * 100)}%`;
}

export default async function LearnIngredientDetailPage({
  params,
}: {
  params:
    | Promise<{
        category: string;
        ingredientId: string;
      }>
    | {
        category: string;
        ingredientId: string;
      };
}) {
  const resolvedParams = await Promise.resolve(params);
  const category = normalizeCategoryKey(resolvedParams.category) || resolvedParams.category;
  const ingredientId = String(resolvedParams.ingredientId || "").trim();

  let item: Awaited<ReturnType<typeof fetchIngredientLibraryItem>> | null = null;
  let loadError: string | null = null;

  try {
    item = await fetchIngredientLibraryItem(category, ingredientId);
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error);
  }

  if (!item || loadError) {
    return (
      <div className="mx-auto max-w-4xl px-4 pb-16 pt-8">
        <article className="rounded-[32px] border border-rose-200 bg-rose-50 px-6 py-6 text-rose-700 shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em]">Ingredient unavailable</p>
          <h1 className="mt-3 text-[34px] font-semibold tracking-[-0.04em]">This ingredient profile could not be loaded.</h1>
          <p className="mt-4 text-[15px] leading-7">{loadError || "Unknown ingredient profile error."}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/learn?tab=ingredients"
              className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-5 text-[14px] font-semibold text-white"
            >
              Back to ingredients
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

  const categoryMeta = getCategoryMeta(item.category);
  const normalizedItemCategory = normalizeCategoryKey(item.category);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8">
      <section className="overflow-hidden rounded-[40px] border border-black/8 bg-white/92 px-5 py-8 shadow-[0_28px_72px_rgba(15,23,42,0.08)] md:px-8 md:py-10">
        <div className="max-w-3xl">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-black/8 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
              {categoryMeta?.label || item.category}
            </span>
            <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700">
              {item.source_count} source{item.source_count === 1 ? "" : "s"}
            </span>
            <span className="rounded-full border border-black/8 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
              Confidence {formatConfidence(item.profile.confidence)}
            </span>
          </div>
          <h1 className="site-display mt-5 text-[42px] leading-[0.98] tracking-[-0.05em] text-slate-950 sm:text-[56px]">
            {item.ingredient_name_en || item.ingredient_name}
          </h1>
          {item.ingredient_name_en && item.ingredient_name_en !== item.ingredient_name ? (
            <p className="mt-3 text-[13px] font-medium uppercase tracking-[0.16em] text-slate-500">{item.ingredient_name}</p>
          ) : null}
          <p className="mt-5 text-[17px] leading-8 text-slate-600">{item.profile.summary || "No summary is available yet."}</p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href={`/learn?tab=ingredients&category=${encodeURIComponent(item.category)}`}
              className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-5 text-[14px] font-semibold text-white"
            >
              Back to ingredient list
            </Link>
            <Link
              href={categoryHref(normalizedItemCategory || "shampoo")}
              className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[14px] font-semibold text-slate-700"
            >
              Shop this category
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-6">
          <article className="rounded-[32px] border border-black/8 bg-white/92 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Benefits</p>
                <div className="mt-4 space-y-3">
                  {item.profile.benefits.length > 0 ? (
                    item.profile.benefits.map((value) => (
                      <div key={value} className="rounded-[22px] border border-emerald-100 bg-emerald-50 px-4 py-4 text-[14px] leading-6 text-slate-700">
                        {value}
                      </div>
                    ))
                  ) : (
                    <p className="text-[14px] leading-6 text-slate-600">No structured benefits were generated yet.</p>
                  )}
                </div>
              </div>
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Risks or watchouts</p>
                <div className="mt-4 space-y-3">
                  {item.profile.risks.length > 0 ? (
                    item.profile.risks.map((value) => (
                      <div key={value} className="rounded-[22px] border border-amber-100 bg-amber-50 px-4 py-4 text-[14px] leading-6 text-slate-700">
                        {value}
                      </div>
                    ))
                  ) : (
                    <p className="text-[14px] leading-6 text-slate-600">No specific risks were generated for this ingredient.</p>
                  )}
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-[32px] border border-black/8 bg-white/92 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Suitable for</p>
                <div className="mt-4 space-y-3">
                  {item.profile.suitable_for.length > 0 ? (
                    item.profile.suitable_for.map((value) => (
                      <div key={value} className="rounded-[22px] border border-black/8 bg-slate-50 px-4 py-4 text-[14px] leading-6 text-slate-700">
                        {value}
                      </div>
                    ))
                  ) : (
                    <p className="text-[14px] leading-6 text-slate-600">No suitability guidance is available yet.</p>
                  )}
                </div>
              </div>
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Avoid for</p>
                <div className="mt-4 space-y-3">
                  {item.profile.avoid_for.length > 0 ? (
                    item.profile.avoid_for.map((value) => (
                      <div key={value} className="rounded-[22px] border border-black/8 bg-slate-50 px-4 py-4 text-[14px] leading-6 text-slate-700">
                        {value}
                      </div>
                    ))
                  ) : (
                    <p className="text-[14px] leading-6 text-slate-600">No avoid-for guidance is available yet.</p>
                  )}
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-[32px] border border-black/8 bg-white/92 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Usage tips</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {item.profile.usage_tips.length > 0 ? (
                item.profile.usage_tips.map((value) => (
                  <div key={value} className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4 text-[14px] leading-6 text-slate-700">
                    {value}
                  </div>
                ))
              ) : (
                <p className="text-[14px] leading-6 text-slate-600">No structured usage guidance is available yet.</p>
              )}
            </div>
          </article>
        </div>

        <div className="space-y-6">
          <article className="rounded-[32px] border border-black/8 bg-white/92 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Source examples</p>
            <div className="mt-4 space-y-3">
              {item.source_samples.length > 0 ? (
                item.source_samples.slice(0, 8).map((sample) => (
                  <article key={sample.trace_id} className="rounded-[22px] border border-black/8 bg-slate-50 px-4 py-4">
                    <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-500">{sample.brand || "Brand not mapped"}</p>
                    <h3 className="mt-2 text-[18px] font-semibold tracking-[-0.02em] text-slate-950">{sample.name || "Untitled source product"}</h3>
                    <p className="mt-3 text-[14px] leading-6 text-slate-600">{sample.one_sentence || "No one-line summary was captured for this source sample."}</p>
                  </article>
                ))
              ) : (
                <p className="text-[14px] leading-6 text-slate-600">No source samples were included with this ingredient profile.</p>
              )}
            </div>
          </article>

          <article className="rounded-[32px] border border-black/8 bg-white/92 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Why confidence landed here</p>
            <p className="mt-4 text-[14px] leading-7 text-slate-700">{item.profile.reason || "No confidence note is available for this ingredient yet."}</p>
            {item.generated_at ? (
              <p className="mt-4 text-[13px] leading-6 text-slate-500">Generated at {item.generated_at}</p>
            ) : null}
          </article>
        </div>
      </section>
    </div>
  );
}
