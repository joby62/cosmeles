"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSitePreferences } from "@/components/site/SitePreferenceProvider";
import { fetchMobileCompareResult, resolveImageUrl, resolveStoredImageUrl, type MobileCompareResult } from "@/lib/api";
import { getMatchRouteMeta } from "@/lib/match";
import { getCategoryMeta } from "@/lib/site";

type CompareResultViewProps = {
  compareId: string;
};

function decisionLabel(value: "keep" | "switch" | "hybrid", locale: "en" | "zh"): string {
  if (value === "keep") return locale === "zh" ? "保留" : "Keep";
  if (value === "switch") return locale === "zh" ? "切换" : "Switch";
  return locale === "zh" ? "混合" : "Hybrid";
}

function decisionTone(value: "keep" | "switch" | "hybrid"): string {
  if (value === "keep") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value === "switch") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function formatDateTime(value: string | null | undefined, locale: "en" | "zh"): string {
  const raw = String(value || "").trim();
  if (!raw) return locale === "zh" ? "未知时间" : "Unknown time";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    month: locale === "zh" ? "numeric" : "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function productTitle(brand?: string | null, name?: string | null, fallback = "Untitled product"): string {
  return [brand, name].filter(Boolean).join(" ").trim() || name || brand || fallback;
}

function takePreview(items: string[], count = 4): string[] {
  return items.map((item) => item.trim()).filter(Boolean).slice(0, count);
}

function ProductVisual({
  src,
  title,
  eyebrow,
  summary,
  emptyLabel,
}: {
  src: string | null;
  title: string;
  eyebrow: string;
  summary: string;
  emptyLabel: string;
}) {
  return (
    <article className="overflow-hidden rounded-[28px] border border-black/8 bg-white/94 shadow-[0_18px_44px_rgba(15,23,42,0.06)]">
      <div className="relative aspect-[1/0.88] bg-[linear-gradient(180deg,#f8fbff_0%,#edf4fb_100%)]">
        {src ? (
          <Image src={src} alt={title} fill sizes="(min-width: 768px) 28vw, 100vw" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-[14px] text-slate-500">{emptyLabel}</div>
        )}
      </div>
      <div className="p-5">
        <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
        <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-slate-950">{title}</h2>
        <p className="mt-3 text-[14px] leading-6 text-slate-600">{summary}</p>
      </div>
    </article>
  );
}

export default function CompareResultView({ compareId }: CompareResultViewProps) {
  const { locale } = useSitePreferences();
  const copy =
    locale === "zh"
      ? {
          loading: "正在加载对比结果...",
          unavailableEyebrow: "对比结果不可用",
          unavailableTitle: "这个对比结果暂时无法加载。",
          unavailableFallback: "未知对比结果错误。",
          backToCompare: "返回对比",
          browseProducts: "浏览商品",
          confidence: "置信度",
          savedAt: "保存于",
          resultSummary:
            "这次对比会复用你已保存的路线基础，把最关键的取舍压缩成一个当前中文可读的结果页。",
          retryCompare: "再做一次对比",
          openSaved: "打开已存",
          openRecommendedProduct: "查看推荐商品",
          browseCategory: "浏览这个品类",
          currentProduct: "当前商品",
          recommendedProduct: "推荐商品",
          currentProductSummary: "这是你带入本次对比的商品。",
          recommendedProductSummary: "这是当前更贴近你已存路线基础的商品。",
          noImage: "暂时还没有可用的商品图片。",
          whyResult: "为什么会得到这个结果",
          savedRouteBasis: "已存路线基础",
          pairReadout: "两两对比读法",
          ingredientOverlap: "成分重叠",
          sharedIngredients: "共同成分",
          currentOnly: "仅当前商品有",
          recommendedOnly: "仅推荐商品有",
          noSharedIngredients: "当前结果里没有暴露出共同成分。",
          noCurrentOnly: "当前结果里没有暴露出当前商品独有成分。",
          noRecommendedOnly: "当前结果里没有暴露出推荐商品独有成分。",
          guardrails: "证据边界",
          guardrailTitle: "在根据结论行动前，先读清楚这次对比的边界。",
          guardrailSummary:
            "对比已经可以帮助你先缩小决策范围，但当前站点还在 pre-checkout 阶段，结果里仍可能存在字段缺失或模型警示。",
          warnings: "警示",
        }
      : {
          loading: "Loading compare result...",
          unavailableEyebrow: "Compare unavailable",
          unavailableTitle: "This compare result could not be loaded.",
          unavailableFallback: "Unknown compare result error.",
          backToCompare: "Back to compare",
          browseProducts: "Browse products",
          confidence: "Confidence",
          savedAt: "Saved",
          resultSummary:
            "This compare reused your saved routine basis and distilled the key tradeoffs into one storefront result.",
          retryCompare: "Run compare again",
          openSaved: "Open saved",
          openRecommendedProduct: "View recommended product",
          browseCategory: "Browse this category",
          currentProduct: "Current product",
          recommendedProduct: "Recommended product",
          currentProductSummary: "This is the product you brought into the compare.",
          recommendedProductSummary: "This is the product your saved profile currently favors.",
          noImage: "Product imagery is not available for this compare yet.",
          whyResult: "Why this result landed here",
          savedRouteBasis: "Saved route basis",
          pairReadout: "Pair-level readout",
          ingredientOverlap: "Ingredient overlap",
          sharedIngredients: "Shared ingredients",
          currentOnly: "Only in current product",
          recommendedOnly: "Only in recommended product",
          noSharedIngredients: "No ingredient overlap was exposed in the result payload.",
          noCurrentOnly: "No current-only ingredients were surfaced.",
          noRecommendedOnly: "No recommended-only ingredients were surfaced.",
          guardrails: "Evidence guardrails",
          guardrailTitle: "Read the compare limits before you act on the verdict.",
          guardrailSummary:
            "Compare is already useful for narrowing a decision, but this result can still carry missing fields or model warnings while the storefront is pre-checkout.",
          warnings: "Warnings",
        };

  const [result, setResult] = useState<MobileCompareResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const nextResult = await fetchMobileCompareResult(compareId);
        if (!cancelled) setResult(nextResult);
      } catch (loadError) {
        if (!cancelled) {
          setResult(null);
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [compareId]);

  const overallDecision = result?.overall?.decision || result?.verdict.decision || "keep";
  const overallHeadline =
    result?.overall?.headline || result?.verdict.headline || (locale === "zh" ? "对比结果" : "Compare result");
  const overallConfidence = Math.round((result?.overall?.confidence || result?.verdict.confidence || 0) * 100);
  const overallItems = useMemo(() => {
    if (!result) return [];
    return takePreview(
      result.overall?.summary_items?.length
        ? result.overall.summary_items
        : result.sections.flatMap((section) => section.items),
      4,
    );
  }, [result]);

  if (loading) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-10">
        <article className="rounded-[32px] border border-black/8 bg-white/92 px-6 py-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
          <p className="text-[15px] leading-7 text-slate-600">{copy.loading}</p>
        </article>
      </section>
    );
  }

  if (!result || error) {
    return (
      <section className="mx-auto max-w-4xl px-4 py-10">
        <article className="rounded-[32px] border border-rose-200 bg-rose-50 px-6 py-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-rose-700">{copy.unavailableEyebrow}</p>
          <h1 className="mt-3 text-[34px] font-semibold tracking-[-0.04em] text-rose-950">{copy.unavailableTitle}</h1>
          <p className="mt-4 text-[15px] leading-7 text-rose-800">{error || copy.unavailableFallback}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/compare"
              className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-5 text-[14px] font-semibold text-white"
            >
              {copy.backToCompare}
            </Link>
            <Link
              href="/shop"
              className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[14px] font-semibold text-slate-700"
            >
              {copy.browseProducts}
            </Link>
          </div>
        </article>
      </section>
    );
  }

  const category = getCategoryMeta(result.category, locale);
  const routeMeta = getMatchRouteMeta(result.category, result.recommendation.route.key, locale);
  const currentProductTitle = productTitle(
    result.current_product.product.brand,
    result.current_product.product.name,
    locale === "zh" ? "当前商品" : "Current product",
  );
  const recommendedProductTitle = productTitle(
    result.recommendation.recommended_product.brand,
    result.recommendation.recommended_product.name,
    locale === "zh" ? "推荐商品" : "Recommended product",
  );
  const currentImage = resolveStoredImageUrl(result.current_product.evidence.image_path);
  const recommendedImage = resolveImageUrl(result.recommendation.recommended_product);
  const recommendedProductId = result.recommendation.recommended_product.id;

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <article className="overflow-hidden rounded-[36px] border border-black/8 bg-white/92 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] md:p-8">
        <div className="flex flex-wrap items-center gap-2">
          {category ? (
            <span className="rounded-full border border-black/8 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
              {category.label}
            </span>
          ) : null}
          <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${decisionTone(overallDecision)}`}>
            {decisionLabel(overallDecision, locale)}
          </span>
          <span className="rounded-full border border-black/8 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
            {copy.confidence} {overallConfidence}%
          </span>
          {routeMeta ? (
            <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700">
              {routeMeta.title}
            </span>
          ) : null}
          <span className="rounded-full border border-black/8 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
            {copy.savedAt} {formatDateTime(result.created_at, locale)}
          </span>
        </div>

        <h1 className="mt-5 text-[38px] font-semibold leading-[0.98] tracking-[-0.05em] text-slate-950 md:text-[52px]">
          {overallHeadline}
        </h1>
        <p className="mt-4 max-w-3xl text-[16px] leading-7 text-slate-600">{copy.resultSummary}</p>
        {routeMeta?.summary ? <p className="mt-3 max-w-3xl text-[14px] leading-6 text-slate-500">{routeMeta.summary}</p> : null}

        {overallItems.length > 0 ? (
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {overallItems.map((item) => (
              <div key={item} className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4 text-[14px] leading-6 text-slate-700">
                {item}
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/compare"
            className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[14px] font-semibold text-slate-700"
          >
            {copy.retryCompare}
          </Link>
          <Link
            href="/saved"
            className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[14px] font-semibold text-slate-700"
          >
            {copy.openSaved}
          </Link>
          {recommendedProductId ? (
            <Link
              href={`/product/${encodeURIComponent(recommendedProductId)}`}
              className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-5 text-[14px] font-semibold text-white"
            >
              {copy.openRecommendedProduct}
            </Link>
          ) : (
            <Link
              href={`/shop/${encodeURIComponent(result.category)}`}
              className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-5 text-[14px] font-semibold text-white"
            >
              {copy.browseCategory}
            </Link>
          )}
        </div>
      </article>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <ProductVisual
          src={currentImage}
          eyebrow={copy.currentProduct}
          title={currentProductTitle}
          summary={result.current_product.summary.one_sentence || copy.currentProductSummary}
          emptyLabel={copy.noImage}
        />
        <ProductVisual
          src={recommendedImage}
          eyebrow={copy.recommendedProduct}
          title={recommendedProductTitle}
          summary={
            result.recommendation.recommended_product.one_sentence ||
            result.recommended_product.summary.one_sentence ||
            copy.recommendedProductSummary
          }
          emptyLabel={copy.noImage}
        />
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-6">
          <article className="rounded-[32px] border border-black/8 bg-white/92 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.whyResult}</p>
            {routeMeta ? (
              <div className="mt-4 rounded-[24px] border border-sky-100 bg-sky-50 px-4 py-4">
                <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-sky-700">{copy.savedRouteBasis}</div>
                <div className="mt-2 text-[18px] font-semibold tracking-[-0.03em] text-slate-950">{routeMeta.title}</div>
                <p className="mt-2 text-[14px] leading-6 text-slate-700">{routeMeta.summary}</p>
              </div>
            ) : null}
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {result.sections.map((section) => (
                <article key={section.key} className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4">
                  <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-slate-950">{section.title}</h2>
                  <div className="mt-3 space-y-2">
                    {takePreview(section.items, 5).map((item) => (
                      <p key={item} className="text-[14px] leading-6 text-slate-700">
                        {item}
                      </p>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </article>

          {result.pair_results?.length ? (
            <article className="rounded-[32px] border border-black/8 bg-white/92 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.pairReadout}</p>
              <div className="mt-4 space-y-4">
                {result.pair_results.map((pair) => (
                  <article key={pair.pair_key} className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${decisionTone(pair.verdict.decision)}`}>
                        {decisionLabel(pair.verdict.decision, locale)}
                      </span>
                      <span className="rounded-full border border-black/8 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                        {Math.round(pair.verdict.confidence * 100)}%
                      </span>
                    </div>
                    <h3 className="mt-3 text-[20px] font-semibold tracking-[-0.03em] text-slate-950">
                      {pair.left_title} vs {pair.right_title}
                    </h3>
                    <p className="mt-2 text-[14px] leading-6 text-slate-600">{pair.verdict.headline}</p>
                  </article>
                ))}
              </div>
            </article>
          ) : null}
        </div>

        <div className="space-y-6">
          <article className="rounded-[32px] border border-black/8 bg-white/92 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.ingredientOverlap}</p>
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-slate-950">{copy.sharedIngredients}</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {takePreview(result.ingredient_diff.overlap, 10).map((item) => (
                    <span key={item} className="rounded-full border border-black/8 bg-slate-50 px-3 py-1 text-[12px] text-slate-700">
                      {item}
                    </span>
                  ))}
                  {result.ingredient_diff.overlap.length === 0 ? (
                    <p className="text-[14px] leading-6 text-slate-600">{copy.noSharedIngredients}</p>
                  ) : null}
                </div>
              </div>

              <div>
                <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-slate-950">{copy.currentOnly}</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {takePreview(result.ingredient_diff.only_current, 10).map((item) => (
                    <span key={item} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[12px] text-amber-700">
                      {item}
                    </span>
                  ))}
                  {result.ingredient_diff.only_current.length === 0 ? (
                    <p className="text-[14px] leading-6 text-slate-600">{copy.noCurrentOnly}</p>
                  ) : null}
                </div>
              </div>

              <div>
                <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-slate-950">{copy.recommendedOnly}</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {takePreview(result.ingredient_diff.only_recommended, 10).map((item) => (
                    <span key={item} className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[12px] text-sky-700">
                      {item}
                    </span>
                  ))}
                  {result.ingredient_diff.only_recommended.length === 0 ? (
                    <p className="text-[14px] leading-6 text-slate-600">{copy.noRecommendedOnly}</p>
                  ) : null}
                </div>
              </div>
            </div>
          </article>

          {result.transparency.warnings.length > 0 || result.transparency.missing_fields.length > 0 ? (
            <article className="rounded-[32px] border border-black/8 bg-white/92 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.guardrails}</p>
              <h2 className="mt-4 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">{copy.guardrailTitle}</h2>
              <p className="mt-3 text-[15px] leading-7 text-slate-600">{copy.guardrailSummary}</p>
              {result.transparency.missing_fields.length > 0 ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {result.transparency.missing_fields.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-black/8 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600"
                    >
                      {item.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              ) : null}
              {result.transparency.warnings.length > 0 ? (
                <div className="mt-5 rounded-[24px] border border-amber-100 bg-amber-50 px-4 py-4">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-amber-700">{copy.warnings}</p>
                  <div className="mt-3 space-y-2">
                    {result.transparency.warnings.map((item) => (
                      <p key={item} className="text-[14px] leading-6 text-slate-700">
                        {item}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          ) : null}
        </div>
      </section>
    </section>
  );
}
