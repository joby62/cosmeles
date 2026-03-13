"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AddToBagButton from "@/components/site/AddToBagButton";
import { useSitePreferences } from "@/components/site/SitePreferenceProvider";
import {
  fetchMobileSelectionSession,
  fetchProductAnalysis,
  pinMobileSelectionSession,
  resolveImageUrl,
  type MobileSelectionResolveResponse,
  type ProductAnalysisProfile,
} from "@/lib/api";
import { getMatchChoice, getMatchConfig, getMatchRouteMeta } from "@/lib/match";
import { getCategoryMeta, type CategoryKey } from "@/lib/site";

type MatchResultViewProps = {
  sessionId: string;
};

function formatTimestamp(value: string | null | undefined, locale: "en" | "zh"): string {
  const raw = String(value || "").trim();
  if (!raw) return locale === "zh" ? "暂无时间" : "No timestamp";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    month: locale === "zh" ? "numeric" : "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function productName(entry: MobileSelectionResolveResponse, locale: "en" | "zh"): string {
  return entry.recommended_product.name || entry.recommended_product.brand || (locale === "zh" ? "未命名商品" : "Untitled product");
}

function signalReason(routeTitle: string, delta: number, locale: "en" | "zh"): string {
  if (locale === "zh") {
    if (delta > 0) return `这个答案把结果进一步推向了“${routeTitle}”。`;
    if (delta < 0) return `这个答案和“${routeTitle}”方向相反，但不足以改写最终结果。`;
    return "这个答案没有改变主要路线，只是让结果保持稳定。";
  }
  if (delta > 0) return `This answer pushed the result further toward "${routeTitle}".`;
  if (delta < 0) return `This answer pulled against "${routeTitle}", but not enough to rewrite the final route.`;
  return "This answer held the main route steady rather than changing it.";
}

function buildMatchHref(category: CategoryKey): string {
  return category === "shampoo" ? "/match" : `/match?category=${encodeURIComponent(category)}`;
}

export default function MatchResultView({ sessionId }: MatchResultViewProps) {
  const { locale } = useSitePreferences();
  const copy =
    locale === "zh"
      ? {
          loading: "正在加载已保存的测配结果...",
          unavailableEyebrow: "测配结果不可用",
          unavailableTitle: "这份已存测配暂时无法加载。",
          unavailableSummary: "当前设备没有返回一份可用的测配会话。",
          unavailableFallback: "未知测配加载错误。",
          backToMatch: "返回测配",
          contactSupport: "联系支持",
          matchEyebrow: "婕选测配",
          pinnedMatch: "已固定测配",
          routeFallback: "推荐路线",
          routeSummaryFallback: "婕选已经把你的答案收束成一条主路线，并把它保存成之后对比可复用的基础。",
          productDetail: "查看商品详情",
          openSaved: "打开已存",
          updating: "更新中...",
          unpin: "取消固定",
          pin: "固定这份测配",
          pinFailed: "固定状态更新失败",
          savedAt: "保存于",
          rulesVersion: "规则版本",
          recommendedProduct: "推荐商品",
          recommendedFallback: "把这份已存测配作为之后对比的路线基础。",
          compareRoute: "在这条路线里做对比",
          readLearn: "查看探索页",
          answerRecap: "答案回顾",
          topSignals: "关键驱动因素",
          topSignalsTitle: (routeTitle: string) => `为什么婕选会落到“${routeTitle}”`,
          noSignals: "这份测配还没有足够的题目级打分细节，无法排序关键驱动因素。",
          productFit: "为什么这个商品适合",
          productFitTitle: "让商品解释和路线结论保持一致。",
          productFitFallback:
            "如果有商品级分析，婕选会尽量让匹配路线和推荐商品说的是同一件事，而不是两套彼此分离的话术。",
          bestFor: "更适合",
          bestForFallback: "商品级 best-for 结构还在补录中。",
          watchouts: "需要注意",
          watchoutsFallback: "这个商品暂时还没有结构化的注意事项。",
          openMatchedProduct: "打开匹配商品页",
          compareWithinRoute: "在这条路线里对比",
          routeScores: "路线得分",
          routeScoresTitle: "看看路线栈是怎么排位的",
          topTwoGap: (gap: number) => `前两名差值 ${gap}`,
          excludedBySafety: "被安全筛选排除",
          routeAvailable: "这条路线仍然保留在当前打分栈中。",
          raw: "原始",
          live: "当前",
          excluded: "已排除",
          safetyFilters: "安全筛选",
          safetyFiltersTitle: "婕选把哪些路线挡在了外面",
          noSafetyFilters: "这份已存测配没有触发明确的安全筛选。",
          retake: "重新测配",
          shopCategory: "浏览这个品类",
          questionNumber: (index: number) => `问题 ${index}`,
          positiveDelta: (delta: number) => `+${delta}`,
        }
      : {
          loading: "Loading saved match result...",
          unavailableEyebrow: "Match unavailable",
          unavailableTitle: "This saved match could not be loaded.",
          unavailableSummary: "The storefront did not receive a usable match session for this device.",
          unavailableFallback: "Unknown match loading error.",
          backToMatch: "Back to match",
          contactSupport: "Contact support",
          matchEyebrow: "Jeslect Match",
          pinnedMatch: "Pinned match",
          routeFallback: "Recommended route",
          routeSummaryFallback:
            "Jeslect narrowed your answers into one main route and saved it as the decision basis for future compare runs.",
          productDetail: "View product detail",
          openSaved: "Open saved",
          updating: "Updating...",
          unpin: "Unpin",
          pin: "Pin this match",
          pinFailed: "Pin update failed",
          savedAt: "Saved",
          rulesVersion: "Rules",
          recommendedProduct: "Recommended product",
          recommendedFallback: "Use this saved match as the compare basis for this category.",
          compareRoute: "Compare this route",
          readLearn: "Read the learn page",
          answerRecap: "Answer recap",
          topSignals: "Top signals",
          topSignalsTitle: (routeTitle: string) => `Why Jeslect landed on ${routeTitle}`,
          noSignals: "This saved match does not have enough question-level scoring detail to rank the top signals yet.",
          productFit: "Why this product fits",
          productFitTitle: "Keep the product explanation aligned with the route.",
          productFitFallback:
            "Jeslect uses product-level analysis when it exists so the matched route and the recommended product keep telling the same story.",
          bestFor: "Best for",
          bestForFallback: "Product-level best-for guidance is still being mapped.",
          watchouts: "Watchouts",
          watchoutsFallback: "No structured watchouts were exposed for this product yet.",
          openMatchedProduct: "Open matched product profile",
          compareWithinRoute: "Compare within this route",
          routeScores: "Route scores",
          routeScoresTitle: "How the route stack ranked",
          topTwoGap: (gap: number) => `Top-two gap ${gap}`,
          excludedBySafety: "Excluded by safety filters",
          routeAvailable: "Route available in the scoring stack.",
          raw: "Raw",
          live: "Live",
          excluded: "Excluded",
          safetyFilters: "Safety filters",
          safetyFiltersTitle: "What Jeslect kept out of the route",
          noSafetyFilters: "No explicit safety filter was triggered in this saved match.",
          retake: "Retake this match",
          shopCategory: "Shop this category",
          questionNumber: (index: number) => `Question ${index}`,
          positiveDelta: (delta: number) => `+${delta}`,
        };

  const [result, setResult] = useState<MobileSelectionResolveResponse | null>(null);
  const [productProfile, setProductProfile] = useState<ProductAnalysisProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pinning, setPinning] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const recommendedProductId = result?.recommended_product.id || null;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setLoadError(null);
        setProductProfile(null);
        const response = await fetchMobileSelectionSession(sessionId);
        if (cancelled) return;
        setResult(response);
      } catch (error) {
        if (cancelled) return;
        setResult(null);
        setLoadError(error instanceof Error ? error.message : String(error));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (typeof recommendedProductId !== "string" || !recommendedProductId) return;
    const productId = recommendedProductId;
    let cancelled = false;

    async function loadProductProfile() {
      try {
        const response = await fetchProductAnalysis(productId);
        if (cancelled) return;
        setProductProfile(response.item.profile);
      } catch {
        if (!cancelled) setProductProfile(null);
      }
    }

    void loadProductProfile();
    return () => {
      cancelled = true;
    };
  }, [recommendedProductId]);

  const derived = useMemo(() => {
    if (!result) return null;

    const category = result.category as CategoryKey;
    const config = getMatchConfig(category, locale);
    const routeMeta = getMatchRouteMeta(category, result.route.key, locale);
    const routeTitle = routeMeta?.title || getCategoryMeta(category, locale)?.label || copy.routeFallback;

    const answers = config.steps
      .map((step) => {
        const choice = result.choices.find((item) => item.key === step.key);
        if (!choice) return null;
        const localizedChoice = getMatchChoice(category, step.key, choice.value, locale);
        return {
          question: step.title,
          answer: localizedChoice?.label || choice.value,
          description: localizedChoice?.description || step.note,
        };
      })
      .filter(
        (
          value,
        ): value is {
          question: string;
          answer: string;
          description: string;
        } => Boolean(value),
      );

    const routeScores = [...(result.matrix_analysis.routes || [])].sort((a, b) => a.rank - b.rank);
    const activeScores = routeScores
      .map((item) => (typeof item.score_after_mask === "number" ? item.score_after_mask : item.score_before_mask))
      .filter((value) => Number.isFinite(value));
    const minScore = activeScores.length > 0 ? Math.min(...activeScores) : 0;
    const maxScore = activeScores.length > 0 ? Math.max(...activeScores) : 1;
    const span = Math.max(1, maxScore - minScore);

    const topSignals = [...(result.matrix_analysis.question_contributions || [])]
      .map((item) => {
        const routeDelta = item.route_deltas.find((delta) => delta.route_key === result.route.key)?.delta ?? 0;
        const step = config.steps.find((entry) => entry.key === item.question_key);
        const localizedChoice = getMatchChoice(category, item.question_key, item.answer_value, locale);
        return {
          question: step?.title || item.question_key,
          answer: localizedChoice?.label || item.answer_value,
          delta: routeDelta,
          reason: signalReason(routeTitle, routeDelta, locale),
        };
      })
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 3);

    const guardrails = (result.matrix_analysis.triggered_vetoes || []).map((item) => {
      const excluded = item.excluded_routes
        .map((route) => getMatchRouteMeta(category, route.route_key, locale)?.title || route.route_key)
        .filter(Boolean);
      if (excluded.length === 0) {
        return locale === "zh"
          ? "婕选在生成最终路线前启用了一个或多个安全筛选。"
          : "Jeslect applied one or more safety filters before finalizing this route.";
      }
      return locale === "zh"
        ? `在这个品类里，婕选先用安全筛选排除了 ${excluded.join("、")}。`
        : `In this category, Jeslect filtered out ${excluded.join(", ")} before finalizing the route.`;
    });

    return {
      category,
      routeMeta,
      routeTitle,
      answers,
      routeScores,
      minScore,
      maxScore,
      span,
      topSignals,
      guardrails,
    };
  }, [copy.routeFallback, locale, result]);

  async function togglePin() {
    if (!result || pinning) return;
    try {
      setPinning(true);
      setPinError(null);
      const updated = await pinMobileSelectionSession(result.session_id, {
        pinned: !result.is_pinned,
      });
      setResult(updated);
    } catch (error) {
      setPinError(error instanceof Error ? error.message : String(error));
    } finally {
      setPinning(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <article className="rounded-[32px] border border-black/8 bg-white/94 px-6 py-8 text-[15px] leading-7 text-slate-600 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
          {copy.loading}
        </article>
      </div>
    );
  }

  if (!result || !derived || loadError) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <article className="rounded-[32px] border border-rose-200 bg-rose-50 px-6 py-6 text-rose-700 shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em]">{copy.unavailableEyebrow}</p>
          <h1 className="mt-3 text-[34px] font-semibold tracking-[-0.04em]">{copy.unavailableTitle}</h1>
          <p className="mt-4 text-[15px] leading-7">{copy.unavailableSummary}</p>
          <p className="mt-3 rounded-[20px] border border-rose-200 bg-white/70 px-4 py-3 text-[13px] leading-6">
            {loadError || copy.unavailableFallback}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/match"
              className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-5 text-[14px] font-semibold text-white"
            >
              {copy.backToMatch}
            </Link>
            <Link
              href="/support/contact"
              className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[14px] font-semibold text-slate-700"
            >
              {copy.contactSupport}
            </Link>
          </div>
        </article>
      </div>
    );
  }

  const categoryMeta = getCategoryMeta(derived.category, locale);
  const productId = result.recommended_product.id;
  const recommendedName = productName(result, locale);
  const productRouteMeta =
    productProfile ? getMatchRouteMeta(productProfile.category, productProfile.route_key, locale) : derived.routeMeta;
  const productBestFor = (productProfile?.best_for || []).filter(Boolean).slice(0, 3);
  const productWatchouts = (productProfile?.watchouts || []).filter(Boolean).slice(0, 3);
  const topTwo = result.matrix_analysis.top2 || [];
  const topTwoGap =
    topTwo.length >= 2
      ? Math.max(0, topTwo[0].score_after_mask - topTwo[1].score_after_mask)
      : null;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-8">
      <section className="overflow-hidden rounded-[38px] border border-black/8 bg-white/94 px-5 py-8 shadow-[0_28px_72px_rgba(15,23,42,0.08)] md:px-8 md:py-10">
        <div className="grid gap-8 lg:grid-cols-[0.98fr_1.02fr] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                {copy.matchEyebrow}
              </span>
              {categoryMeta ? (
                <span className="rounded-full border border-black/8 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                  {categoryMeta.label}
                </span>
              ) : null}
              {result.is_pinned ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700">
                  {copy.pinnedMatch}
                </span>
              ) : null}
            </div>

            <h1 className="site-display mt-5 text-[42px] leading-[0.98] tracking-[-0.05em] text-slate-950 sm:text-[56px]">
              {derived.routeMeta?.title || copy.routeFallback}
            </h1>
            <p className="mt-5 max-w-2xl text-[17px] leading-8 text-slate-600">
              {derived.routeMeta?.summary || copy.routeSummaryFallback}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <AddToBagButton productId={productId} />
              <Link
                href={`/product/${encodeURIComponent(productId)}`}
                className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[13px] font-semibold text-slate-700"
              >
                {copy.productDetail}
              </Link>
              <Link
                href="/saved"
                className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[13px] font-semibold text-slate-700"
              >
                {copy.openSaved}
              </Link>
              <button
                type="button"
                onClick={togglePin}
                disabled={pinning}
                className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[13px] font-semibold text-slate-700 disabled:cursor-wait disabled:opacity-70"
              >
                {pinning ? copy.updating : result.is_pinned ? copy.unpin : copy.pin}
              </button>
            </div>

            {pinError ? (
              <div className="mt-4 rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] leading-6 text-rose-700">
                {copy.pinFailed}: {pinError}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-2">
              <span className="rounded-full border border-black/8 bg-slate-50 px-3 py-1 text-[12px] font-medium text-slate-600">
                {copy.savedAt} {formatTimestamp(result.created_at, locale)}
              </span>
              <span className="rounded-full border border-black/8 bg-slate-50 px-3 py-1 text-[12px] font-medium text-slate-600">
                {copy.rulesVersion} {result.rules_version}
              </span>
            </div>
          </div>

          <article className="rounded-[30px] border border-black/8 bg-[linear-gradient(180deg,#fbfdff_0%,#f3f7fc_100%)] p-5 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <div className="flex items-start gap-4">
              <div className="relative h-[96px] w-[96px] shrink-0 overflow-hidden rounded-[24px] bg-white">
                <Image
                  src={resolveImageUrl(result.recommended_product)}
                  alt={recommendedName}
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.recommendedProduct}</div>
                <h2 className="mt-3 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">
                  {result.recommended_product.brand || "Jeslect"}
                </h2>
                <p className="mt-2 text-[16px] leading-7 text-slate-700">{recommendedName}</p>
                <p className="mt-3 text-[14px] leading-6 text-slate-600">
                  {productProfile?.positioning_summary || copy.recommendedFallback}
                </p>
                {productRouteMeta?.summary ? <p className="mt-2 text-[13px] leading-6 text-slate-500">{productRouteMeta.summary}</p> : null}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={`/compare?category=${encodeURIComponent(derived.category)}&pick=${encodeURIComponent(productId)}`}
                className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-5 text-[13px] font-semibold text-white"
              >
                {copy.compareRoute}
              </Link>
              <Link
                href={`/learn/product/${encodeURIComponent(productId)}`}
                className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[13px] font-semibold text-slate-700"
              >
                {copy.readLearn}
              </Link>
            </div>
          </article>
        </div>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <div className="space-y-6">
          <article className="rounded-[32px] border border-black/8 bg-white/94 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.answerRecap}</p>
            <div className="mt-4 grid gap-3">
              {derived.answers.map((item, index) => (
                <div key={item.question} className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{copy.questionNumber(index + 1)}</div>
                  <div className="mt-2 text-[13px] font-semibold text-slate-900">{item.question}</div>
                  <div className="mt-2 text-[15px] font-medium text-slate-700">{item.answer}</div>
                  <div className="mt-2 text-[14px] leading-6 text-slate-600">{item.description}</div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[32px] border border-black/8 bg-white/94 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.topSignals}</p>
            <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-slate-950">
              {copy.topSignalsTitle(derived.routeMeta?.title || copy.routeFallback)}
            </h2>
            <div className="mt-5 grid gap-3">
              {derived.topSignals.length > 0 ? (
                derived.topSignals.map((item) => (
                  <div key={`${item.question}-${item.answer}`} className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[15px] font-semibold tracking-[-0.02em] text-slate-950">{item.question}</div>
                      <div className="rounded-full border border-black/8 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                        {item.delta >= 0 ? copy.positiveDelta(item.delta) : item.delta}
                      </div>
                    </div>
                    <div className="mt-2 text-[14px] font-medium text-slate-700">{item.answer}</div>
                    <div className="mt-2 text-[14px] leading-6 text-slate-600">{item.reason}</div>
                  </div>
                ))
              ) : (
                <p className="text-[14px] leading-6 text-slate-600">{copy.noSignals}</p>
              )}
            </div>
          </article>

          <article className="rounded-[32px] border border-black/8 bg-white/94 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.productFit}</p>
            <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-slate-950">{copy.productFitTitle}</h2>
            <p className="mt-3 text-[15px] leading-7 text-slate-600">
              {productProfile?.positioning_summary || copy.productFitFallback}
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-emerald-100 bg-emerald-50 px-4 py-4">
                <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-emerald-700">{copy.bestFor}</div>
                <div className="mt-3 space-y-2">
                  {productBestFor.length > 0 ? (
                    productBestFor.map((item) => (
                      <p key={item} className="text-[14px] leading-6 text-slate-700">
                        {item}
                      </p>
                    ))
                  ) : (
                    <p className="text-[14px] leading-6 text-slate-600">{copy.bestForFallback}</p>
                  )}
                </div>
              </div>

              <div className="rounded-[24px] border border-amber-100 bg-amber-50 px-4 py-4">
                <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-amber-700">{copy.watchouts}</div>
                <div className="mt-3 space-y-2">
                  {productWatchouts.length > 0 ? (
                    productWatchouts.map((item) => (
                      <p key={item} className="text-[14px] leading-6 text-slate-700">
                        {item}
                      </p>
                    ))
                  ) : (
                    <p className="text-[14px] leading-6 text-slate-600">{copy.watchoutsFallback}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={`/product/${encodeURIComponent(productId)}`}
                className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-5 text-[13px] font-semibold text-white"
              >
                {copy.openMatchedProduct}
              </Link>
              <Link
                href={`/learn/product/${encodeURIComponent(productId)}`}
                className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[13px] font-semibold text-slate-700"
              >
                {copy.readLearn}
              </Link>
              <Link
                href={`/compare?category=${encodeURIComponent(derived.category)}&pick=${encodeURIComponent(productId)}`}
                className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[13px] font-semibold text-slate-700"
              >
                {copy.compareWithinRoute}
              </Link>
            </div>
          </article>
        </div>

        <div className="space-y-6">
          <article className="rounded-[32px] border border-black/8 bg-white/94 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.routeScores}</p>
                <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-slate-950">{copy.routeScoresTitle}</h2>
              </div>
              {topTwoGap !== null ? (
                <div className="rounded-full border border-black/8 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                  {copy.topTwoGap(topTwoGap)}
                </div>
              ) : null}
            </div>

            <div className="mt-5 space-y-3">
              {derived.routeScores.map((item) => {
                const routeMeta = getMatchRouteMeta(derived.category, item.route_key, locale);
                const score = typeof item.score_after_mask === "number" ? item.score_after_mask : item.score_before_mask;
                const width = clamp(((score - derived.minScore) / derived.span) * 100, 12, 100);
                return (
                  <div
                    key={item.route_key}
                    className={`rounded-[24px] border px-4 py-4 ${
                      item.is_excluded ? "border-rose-200 bg-rose-50" : "border-black/8 bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[15px] font-semibold tracking-[-0.02em] text-slate-950">
                          #{item.rank} {routeMeta?.title || item.route_key}
                        </div>
                        <div className="mt-1 text-[13px] leading-6 text-slate-600">
                          {item.is_excluded ? copy.excludedBySafety : routeMeta?.summary || copy.routeAvailable}
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-[12px] text-slate-500">
                        <div>
                          {copy.raw} {item.score_before_mask}
                        </div>
                        <div>{item.is_excluded ? copy.excluded : `${copy.live} ${item.score_after_mask}`}</div>
                      </div>
                    </div>
                    <div className="mt-3 h-2.5 rounded-full bg-white">
                      <div
                        className={`h-2.5 rounded-full ${item.is_excluded ? "bg-rose-300" : "bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)]"}`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="rounded-[32px] border border-black/8 bg-white/94 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.safetyFilters}</p>
            <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-slate-950">{copy.safetyFiltersTitle}</h2>
            <div className="mt-5 space-y-3">
              {derived.guardrails.length > 0 ? (
                derived.guardrails.map((item) => (
                  <div key={item} className="rounded-[24px] border border-sky-100 bg-sky-50 px-4 py-4 text-[14px] leading-6 text-sky-900">
                    {item}
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4 text-[14px] leading-6 text-slate-600">
                  {copy.noSafetyFilters}
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={buildMatchHref(derived.category)}
                className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[13px] font-semibold text-slate-700"
              >
                {copy.retake}
              </Link>
              <Link
                href={`/shop/${encodeURIComponent(derived.category)}`}
                className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[13px] font-semibold text-slate-700"
              >
                {copy.shopCategory}
              </Link>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
