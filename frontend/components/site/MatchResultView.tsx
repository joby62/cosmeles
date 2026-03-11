"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AddToBagButton from "@/components/site/AddToBagButton";
import {
  fetchProductAnalysis,
  fetchMobileSelectionSession,
  pinMobileSelectionSession,
  resolveImageUrl,
  type ProductAnalysisProfile,
  type MobileSelectionResolveResponse,
} from "@/lib/api";
import { getMatchChoice, getMatchConfig, getMatchRouteMeta } from "@/lib/match";
import { getCategoryMeta, type CategoryKey } from "@/lib/site";

type MatchResultViewProps = {
  sessionId: string;
};

function formatTimestamp(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) return "No timestamp";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function productName(entry: MobileSelectionResolveResponse): string {
  return entry.recommended_product.name || entry.recommended_product.brand || "Untitled product";
}

function signalReason(routeTitle: string, delta: number): string {
  if (delta > 0) return `This answer pushed the result toward ${routeTitle}.`;
  if (delta < 0) return `This answer pulled against ${routeTitle}, but not enough to overturn the final result.`;
  return `This answer kept the result stable without changing the main route.`;
}

function buildMatchHref(category: CategoryKey): string {
  return category === "shampoo" ? "/match" : `/match?category=${encodeURIComponent(category)}`;
}

export default function MatchResultView({ sessionId }: MatchResultViewProps) {
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
    const productId: string = recommendedProductId;
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
    const config = getMatchConfig(category);
    const routeMeta = getMatchRouteMeta(category, result.route.key);
    const routeTitle = routeMeta?.title || getCategoryMeta(category)?.label || "Recommended route";

    const answers = config.steps
      .map((step) => {
        const choice = result.choices.find((item) => item.key === step.key);
        if (!choice) return null;
        const localizedChoice = getMatchChoice(category, step.key, choice.value);
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
        const localizedChoice = getMatchChoice(category, item.question_key, item.answer_value);
        return {
          question: step?.title || item.question_key,
          answer: localizedChoice?.label || item.answer_value,
          delta: routeDelta,
          reason: signalReason(routeTitle, routeDelta),
        };
      })
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 3);

    const guardrails = (result.matrix_analysis.triggered_vetoes || []).map((item) => {
      const excluded = item.excluded_routes
        .map((route) => getMatchRouteMeta(category, route.route_key)?.title || route.route_key)
        .filter(Boolean);
      if (excluded.length === 0) {
        return "Jeslect applied one or more safety filters before finalizing this route.";
      }
      return `Jeslect ruled out ${excluded.join(", ")} after applying safety filters for this category.`;
    });

    return {
      category,
      config,
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
  }, [result]);

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
          Loading your saved Jeslect match...
        </article>
      </div>
    );
  }

  if (!result || !derived || loadError) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <article className="rounded-[32px] border border-rose-200 bg-rose-50 px-6 py-6 text-rose-700 shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em]">Match unavailable</p>
          <h1 className="mt-3 text-[34px] font-semibold tracking-[-0.04em]">This saved match could not be loaded.</h1>
          <p className="mt-4 text-[15px] leading-7">The storefront did not receive a usable match session for this device.</p>
          <p className="mt-3 rounded-[20px] border border-rose-200 bg-white/70 px-4 py-3 text-[13px] leading-6">
            {loadError || "Unknown match loading error."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/match"
              className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-5 text-[14px] font-semibold text-white"
            >
              Back to match
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

  const categoryMeta = getCategoryMeta(derived.category);
  const productId = result.recommended_product.id;
  const recommendedName = productName(result);
  const productRouteMeta =
    productProfile ? getMatchRouteMeta(productProfile.category, productProfile.route_key) : derived.routeMeta;
  const productBestFor = (productProfile?.best_for || []).filter(Boolean).slice(0, 3);
  const productWatchouts = (productProfile?.watchouts || []).filter(Boolean).slice(0, 3);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-8">
      <section className="overflow-hidden rounded-[38px] border border-black/8 bg-white/94 px-5 py-8 shadow-[0_28px_72px_rgba(15,23,42,0.08)] md:px-8 md:py-10">
        <div className="grid gap-8 lg:grid-cols-[0.98fr_1.02fr] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                Jeslect Match
              </span>
              {categoryMeta ? (
                <span className="rounded-full border border-black/8 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                  {categoryMeta.label}
                </span>
              ) : null}
              {result.is_pinned ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700">
                  Pinned match
                </span>
              ) : null}
            </div>

            <h1 className="site-display mt-5 text-[42px] leading-[0.98] tracking-[-0.05em] text-slate-950 sm:text-[56px]">
              {derived.routeMeta?.title || "Recommended route"}
            </h1>
            <p className="mt-5 max-w-2xl text-[17px] leading-8 text-slate-600">
              {derived.routeMeta?.summary ||
                "Jeslect narrowed your answers into one main route and saved it as the decision basis for future compare runs."}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <AddToBagButton productId={productId} />
              <Link
                href={`/product/${encodeURIComponent(productId)}`}
                className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[13px] font-semibold text-slate-700"
              >
                View product details
              </Link>
              <button
                type="button"
                onClick={togglePin}
                disabled={pinning}
                className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[13px] font-semibold text-slate-700 disabled:cursor-wait disabled:opacity-70"
              >
                {pinning ? "Updating..." : result.is_pinned ? "Unpin match" : "Pin this match"}
              </button>
            </div>

            {pinError ? (
              <div className="mt-4 rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] leading-6 text-rose-700">
                Pin update failed: {pinError}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-2">
              <span className="rounded-full border border-black/8 bg-slate-50 px-3 py-1 text-[12px] font-medium text-slate-600">
                Saved {formatTimestamp(result.created_at)}
              </span>
              <span className="rounded-full border border-black/8 bg-slate-50 px-3 py-1 text-[12px] font-medium text-slate-600">
                Rule set {result.rules_version}
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
                <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Recommended product</div>
                <h2 className="mt-3 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">
                  {result.recommended_product.brand || "Jeslect"}
                </h2>
                <p className="mt-2 text-[16px] leading-7 text-slate-700">{recommendedName}</p>
                <p className="mt-3 text-[14px] leading-6 text-slate-600">
                  {productProfile?.positioning_summary ||
                    `Use this saved match as the compare basis for ${categoryMeta?.label.toLowerCase() || derived.category}.`}
                </p>
                {productRouteMeta?.summary ? <p className="mt-2 text-[13px] leading-6 text-slate-500">{productRouteMeta.summary}</p> : null}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={`/compare?category=${encodeURIComponent(derived.category)}&pick=${encodeURIComponent(productId)}`}
                className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-5 text-[13px] font-semibold text-white"
              >
                Compare this route
              </Link>
              <Link
                href={`/learn/product/${encodeURIComponent(productId)}`}
                className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[13px] font-semibold text-slate-700"
              >
                Read the learn page
              </Link>
            </div>
          </article>
        </div>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <div className="space-y-6">
          <article className="rounded-[32px] border border-black/8 bg-white/94 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Answer recap</p>
            <div className="mt-4 grid gap-3">
              {derived.answers.map((item) => (
                <div key={item.question} className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4">
                  <div className="text-[13px] font-semibold text-slate-900">{item.question}</div>
                  <div className="mt-2 text-[15px] font-medium text-slate-700">{item.answer}</div>
                  <div className="mt-2 text-[14px] leading-6 text-slate-600">{item.description}</div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[32px] border border-black/8 bg-white/94 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Top signals</p>
            <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-slate-950">
              Why Jeslect landed on {derived.routeMeta?.title || "this route"}
            </h2>
            <div className="mt-5 grid gap-3">
              {derived.topSignals.length > 0 ? (
                derived.topSignals.map((item) => (
                  <div key={`${item.question}-${item.answer}`} className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[15px] font-semibold tracking-[-0.02em] text-slate-950">{item.question}</div>
                      <div className="rounded-full border border-black/8 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                        {item.delta >= 0 ? "+" : ""}
                        {item.delta}
                      </div>
                    </div>
                    <div className="mt-2 text-[14px] font-medium text-slate-700">{item.answer}</div>
                    <div className="mt-2 text-[14px] leading-6 text-slate-600">{item.reason}</div>
                  </div>
                ))
              ) : (
                <p className="text-[14px] leading-6 text-slate-600">
                  This saved match does not have enough question-level scoring detail to rank the top signals yet.
                </p>
              )}
            </div>
          </article>

          <article className="rounded-[32px] border border-black/8 bg-white/94 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Why this product fits</p>
            <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-slate-950">
              Keep the product explanation aligned with the route.
            </h2>
            <p className="mt-3 text-[15px] leading-7 text-slate-600">
              {productProfile?.positioning_summary ||
                "Jeslect uses product-level analysis when it exists so the matched route and the recommended product keep telling the same story."}
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-emerald-100 bg-emerald-50 px-4 py-4">
                <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Best for</div>
                <div className="mt-3 space-y-2">
                  {productBestFor.length > 0 ? (
                    productBestFor.map((item) => (
                      <p key={item} className="text-[14px] leading-6 text-slate-700">
                        {item}
                      </p>
                    ))
                  ) : (
                    <p className="text-[14px] leading-6 text-slate-600">Product-level best-for guidance is still being mapped.</p>
                  )}
                </div>
              </div>

              <div className="rounded-[24px] border border-amber-100 bg-amber-50 px-4 py-4">
                <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-amber-700">Watchouts</div>
                <div className="mt-3 space-y-2">
                  {productWatchouts.length > 0 ? (
                    productWatchouts.map((item) => (
                      <p key={item} className="text-[14px] leading-6 text-slate-700">
                        {item}
                      </p>
                    ))
                  ) : (
                    <p className="text-[14px] leading-6 text-slate-600">No structured watchouts were exposed for this product yet.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={`/product/${encodeURIComponent(productId)}`}
                className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-5 text-[13px] font-semibold text-white"
              >
                Open matched product profile
              </Link>
              <Link
                href={`/learn/product/${encodeURIComponent(productId)}`}
                className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[13px] font-semibold text-slate-700"
              >
                Read the learn explanation
              </Link>
              <Link
                href={`/compare?category=${encodeURIComponent(derived.category)}&pick=${encodeURIComponent(productId)}`}
                className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[13px] font-semibold text-slate-700"
              >
                Compare within this route
              </Link>
            </div>
          </article>
        </div>

        <div className="space-y-6">
          <article className="rounded-[32px] border border-black/8 bg-white/94 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Route scores</p>
                <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-slate-950">How the route stack ranked</h2>
              </div>
              {result.matrix_analysis.top2.length >= 2 ? (
                <div className="rounded-full border border-black/8 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                  Top-two gap{" "}
                  {Math.max(0, result.matrix_analysis.top2[0].score_after_mask - result.matrix_analysis.top2[1].score_after_mask)}
                </div>
              ) : null}
            </div>

            <div className="mt-5 space-y-3">
              {derived.routeScores.map((item) => {
                const routeMeta = getMatchRouteMeta(derived.category, item.route_key);
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
                          {item.is_excluded ? "Excluded by safety filters" : routeMeta?.summary || "Route available in the scoring stack."}
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-[12px] text-slate-500">
                        <div>Raw {item.score_before_mask}</div>
                        <div>{item.is_excluded ? "Excluded" : `Live ${item.score_after_mask}`}</div>
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
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Safety filters</p>
            <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-slate-950">What Jeslect kept out of the route</h2>
            <div className="mt-5 space-y-3">
              {derived.guardrails.length > 0 ? (
                derived.guardrails.map((item) => (
                  <div key={item} className="rounded-[24px] border border-sky-100 bg-sky-50 px-4 py-4 text-[14px] leading-6 text-sky-900">
                    {item}
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4 text-[14px] leading-6 text-slate-600">
                  No explicit safety filter was triggered in this saved match.
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={buildMatchHref(derived.category)}
                className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[13px] font-semibold text-slate-700"
              >
                Retake this match
              </Link>
              <Link
                href={`/shop/${encodeURIComponent(derived.category)}`}
                className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[13px] font-semibold text-slate-700"
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
