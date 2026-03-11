"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  fetchMobileBagItems,
  listMobileCompareSessions,
  listMobileSelectionSessions,
  resolveImageUrl,
  type MobileBagItem,
  type MobileCompareSession,
  type MobileSelectionResolveResponse,
} from "@/lib/api";
import { clearRecentProducts, readRecentProducts, type RecentProductSnapshot } from "@/lib/recentProducts";
import { getMatchRouteMeta } from "@/lib/match";
import { getCategoryMeta } from "@/lib/site";

type SavedHubState = {
  bagItems: MobileBagItem[];
  matchSessions: MobileSelectionResolveResponse[];
  compareSessions: MobileCompareSession[];
  recentProducts: RecentProductSnapshot[];
};

type SavedHubErrors = {
  bag: string | null;
  matches: string | null;
  compares: string | null;
};

const EMPTY_ERRORS: SavedHubErrors = {
  bag: null,
  matches: null,
  compares: null,
};

function formatDateTime(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) return "No recent activity";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function sortByDateDesc<T>(items: T[], getValue: (item: T) => string | null | undefined): T[] {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(String(getValue(left) || ""));
    const rightTime = Date.parse(String(getValue(right) || ""));
    return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
  });
}

function compareStatusTone(session: MobileCompareSession): string {
  if (session.status === "failed") return "border-rose-200 bg-rose-50 text-rose-700";
  if (session.status === "running") return "border-amber-200 bg-amber-50 text-amber-700";
  if (session.result?.decision === "switch") return "border-sky-200 bg-sky-50 text-sky-700";
  if (session.result?.decision === "hybrid") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function compareStatusLabel(session: MobileCompareSession): string {
  if (session.status === "failed") return "Failed";
  if (session.status === "running") return session.stage_label || "Running";
  if (session.result?.decision === "switch") return "Switch";
  if (session.result?.decision === "hybrid") return "Hybrid";
  return "Keep";
}

function productName(name?: string | null, brand?: string | null, fallback = "Untitled product"): string {
  return name?.trim() || brand?.trim() || fallback;
}

function EmptyState({
  title,
  summary,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  title: string;
  summary: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <div className="rounded-[24px] border border-dashed border-black/10 bg-slate-50 px-5 py-5">
      <h3 className="text-[18px] font-semibold tracking-[-0.03em] text-slate-950">{title}</h3>
      <p className="mt-3 text-[14px] leading-6 text-slate-600">{summary}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={primaryHref}
          className="inline-flex h-10 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-4 text-[13px] font-semibold text-white"
        >
          {primaryLabel}
        </Link>
        {secondaryHref && secondaryLabel ? (
          <Link
            href={secondaryHref}
            className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-medium text-slate-700"
          >
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default function SavedHub() {
  const [state, setState] = useState<SavedHubState>({
    bagItems: [],
    matchSessions: [],
    compareSessions: [],
    recentProducts: [],
  });
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<SavedHubErrors>(EMPTY_ERRORS);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [bagResult, matchResult, compareResult] = await Promise.allSettled([
        fetchMobileBagItems({ limit: 12, offset: 0 }),
        listMobileSelectionSessions({ limit: 6, offset: 0 }),
        listMobileCompareSessions({ limit: 6, offset: 0 }),
      ]);

      if (cancelled) return;

      setState({
        bagItems: bagResult.status === "fulfilled" ? bagResult.value.items || [] : [],
        matchSessions:
          matchResult.status === "fulfilled"
            ? sortByDateDesc(matchResult.value || [], (item) => item.created_at)
            : [],
        compareSessions:
          compareResult.status === "fulfilled"
            ? sortByDateDesc(compareResult.value || [], (item) => item.updated_at || item.created_at)
            : [],
        recentProducts: readRecentProducts(),
      });

      setErrors({
        bag:
          bagResult.status === "rejected"
            ? bagResult.reason instanceof Error
              ? bagResult.reason.message
              : String(bagResult.reason)
            : null,
        matches:
          matchResult.status === "rejected"
            ? matchResult.reason instanceof Error
              ? matchResult.reason.message
              : String(matchResult.reason)
            : null,
        compares:
          compareResult.status === "rejected"
            ? compareResult.reason instanceof Error
              ? compareResult.reason.message
              : String(compareResult.reason)
            : null,
      });

      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const summaryCards = useMemo(
    () => [
      {
        label: "Bag items",
        value: state.bagItems.length,
        summary: "Keep saved products visible while you compare or step away.",
      },
      {
        label: "Saved matches",
        value: state.matchSessions.length,
        summary: "Reuse the route basis Jeslect already stored for this device.",
      },
      {
        label: "Compare runs",
        value: state.compareSessions.length,
        summary: "Pick up the compare path without rebuilding the same shortlist.",
      },
      {
        label: "Recently viewed",
        value: state.recentProducts.length,
        summary: "Return to products you opened most recently across the storefront.",
      },
    ],
    [state],
  );

  return (
    <div className="space-y-8">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <article key={card.label} className="rounded-[26px] border border-black/8 bg-white/92 px-5 py-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">{card.label}</p>
            <div className="mt-3 text-[32px] font-semibold tracking-[-0.05em] text-slate-950">{card.value}</div>
            <p className="mt-3 text-[14px] leading-6 text-slate-600">{card.summary}</p>
          </article>
        ))}
      </section>

      {loading ? (
        <article className="rounded-[28px] border border-black/8 bg-white/92 px-5 py-5 text-[15px] leading-7 text-slate-600 shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
          Loading saved bag, match, compare, and recent product activity...
        </article>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <article className="rounded-[32px] border border-black/8 bg-white/94 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Bag continuity</p>
              <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-slate-950">Keep the shortlist alive.</h2>
            </div>
            <Link
              href="/bag"
              className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-medium text-slate-700"
            >
              Open bag
            </Link>
          </div>

          {errors.bag ? (
            <div className="mt-5 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4 text-[14px] leading-6 text-rose-700">
              Bag loading failed: {errors.bag}
            </div>
          ) : null}

          {!errors.bag && state.bagItems.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                title="No saved bag items yet"
                summary="Start from Shop, Match, or Compare and the surviving products will stay visible here."
                primaryHref="/shop"
                primaryLabel="Browse shop"
                secondaryHref="/match"
                secondaryLabel="Find my match"
              />
            </div>
          ) : null}

          {!errors.bag && state.bagItems.length > 0 ? (
            <div className="mt-5 space-y-4">
              {state.bagItems.slice(0, 4).map((item) => {
                const title = productName(item.product.name, item.product.brand);
                const category = getCategoryMeta(item.product.category);
                return (
                  <article key={item.item_id} className="flex flex-col gap-4 rounded-[24px] border border-black/8 bg-slate-50 p-4 sm:flex-row">
                    <Link
                      href={`/product/${encodeURIComponent(item.product.id)}`}
                      className="relative block aspect-square overflow-hidden rounded-[20px] bg-white sm:h-[110px] sm:w-[110px] sm:shrink-0"
                    >
                      <Image src={resolveImageUrl(item.product)} alt={title} fill sizes="110px" className="object-cover" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {category ? (
                          <span className="rounded-full border border-black/8 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                            {category.label}
                          </span>
                        ) : null}
                        <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700">
                          Quantity {item.quantity}
                        </span>
                      </div>
                      <h3 className="mt-4 text-[22px] font-semibold tracking-[-0.03em] text-slate-950">{title}</h3>
                      <p className="mt-2 text-[14px] leading-6 text-slate-600">
                        {item.product.one_sentence || "Open the product page to keep ingredients, compare, and trust details close."}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                          href={`/product/${encodeURIComponent(item.product.id)}`}
                          className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-medium text-slate-700"
                        >
                          View product
                        </Link>
                        <Link
                          href={`/compare?category=${encodeURIComponent(item.product.category)}&pick=${encodeURIComponent(item.product.id)}`}
                          className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-medium text-slate-700"
                        >
                          Compare
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </article>

        <article className="rounded-[32px] border border-black/8 bg-white/94 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Recently viewed</p>
              <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-slate-950">Return to the product pages you opened.</h2>
            </div>
            {state.recentProducts.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  clearRecentProducts();
                  setState((current) => ({ ...current, recentProducts: [] }));
                }}
                className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-medium text-slate-700"
              >
                Clear recent
              </button>
            ) : null}
          </div>

          {state.recentProducts.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                title="No recently viewed products yet"
                summary="Open a product page and Jeslect will keep it here so you can get back without searching again."
                primaryHref="/shop"
                primaryLabel="Browse shop"
                secondaryHref="/search"
                secondaryLabel="Search products"
              />
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {state.recentProducts.slice(0, 4).map((item) => {
                const category = getCategoryMeta(item.category);
                return (
                  <article key={item.productId} className="flex flex-col gap-4 rounded-[24px] border border-black/8 bg-slate-50 p-4 sm:flex-row">
                    <Link
                      href={`/product/${encodeURIComponent(item.productId)}`}
                      className="relative block aspect-square overflow-hidden rounded-[20px] bg-white sm:h-[110px] sm:w-[110px] sm:shrink-0"
                    >
                      <Image src={item.imageUrl || "/placeholder-product.svg"} alt={item.name} fill sizes="110px" className="object-cover" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {category ? (
                          <span className="rounded-full border border-black/8 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                            {category.label}
                          </span>
                        ) : null}
                        {item.routeTitle ? (
                          <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700">
                            {item.routeTitle}
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-4 text-[22px] font-semibold tracking-[-0.03em] text-slate-950">{item.name}</h3>
                      <p className="mt-2 text-[14px] leading-6 text-slate-600">{item.summary}</p>
                      {item.routeSummary ? <p className="mt-2 text-[13px] leading-6 text-slate-500">{item.routeSummary}</p> : null}
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-black/8 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                          Viewed {formatDateTime(item.viewedAt)}
                        </span>
                        <Link
                          href={`/product/${encodeURIComponent(item.productId)}`}
                          className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-medium text-slate-700"
                        >
                          Reopen product
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <article className="rounded-[32px] border border-black/8 bg-white/94 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Saved matches</p>
              <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-slate-950">Keep the route basis reusable.</h2>
            </div>
            <Link
              href="/match"
              className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-medium text-slate-700"
            >
              Open match
            </Link>
          </div>

          {errors.matches ? (
            <div className="mt-5 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4 text-[14px] leading-6 text-rose-700">
              Match history failed: {errors.matches}
            </div>
          ) : null}

          {!errors.matches && state.matchSessions.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                title="No saved matches yet"
                summary="Run Match once and Jeslect will keep the route basis ready for compare and product revisit."
                primaryHref="/match"
                primaryLabel="Start match"
                secondaryHref="/learn"
                secondaryLabel="Learn first"
              />
            </div>
          ) : null}

          {!errors.matches && state.matchSessions.length > 0 ? (
            <div className="mt-5 space-y-4">
              {state.matchSessions.slice(0, 4).map((session) => {
                const routeMeta = getMatchRouteMeta(session.category, session.route.key);
                const category = getCategoryMeta(session.category);
                const title = productName(session.recommended_product.name, session.recommended_product.brand);
                return (
                  <article key={session.session_id} className="rounded-[24px] border border-black/8 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {category ? (
                        <span className="rounded-full border border-black/8 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                          {category.label}
                        </span>
                      ) : null}
                      <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700">
                        {routeMeta?.title || session.route.title}
                      </span>
                      {session.is_pinned ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700">
                          Pinned
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-4 text-[22px] font-semibold tracking-[-0.03em] text-slate-950">{title}</h3>
                    <p className="mt-2 text-[14px] leading-6 text-slate-600">
                      {routeMeta?.summary || "This saved match can keep guiding compare and product decisions on this device."}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-black/8 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                        Saved {formatDateTime(session.created_at)}
                      </span>
                      <Link
                        href={`/match/${encodeURIComponent(session.session_id)}`}
                        className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-medium text-slate-700"
                      >
                        View match
                      </Link>
                      <Link
                        href={`/product/${encodeURIComponent(session.recommended_product.id)}`}
                        className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-medium text-slate-700"
                      >
                        View product
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </article>

        <article className="rounded-[32px] border border-black/8 bg-white/94 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Compare history</p>
              <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-slate-950">Resume the side-by-side path.</h2>
            </div>
            <Link
              href="/compare"
              className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-medium text-slate-700"
            >
              Open compare
            </Link>
          </div>

          {errors.compares ? (
            <div className="mt-5 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4 text-[14px] leading-6 text-rose-700">
              Compare history failed: {errors.compares}
            </div>
          ) : null}

          {!errors.compares && state.compareSessions.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                title="No compare history yet"
                summary="After Match narrows the route, Compare will keep the latest side-by-side results here."
                primaryHref="/compare"
                primaryLabel="Start compare"
                secondaryHref="/match"
                secondaryLabel="Create route basis"
              />
            </div>
          ) : null}

          {!errors.compares && state.compareSessions.length > 0 ? (
            <div className="mt-5 space-y-4">
              {state.compareSessions.slice(0, 4).map((session) => {
                const category = getCategoryMeta(session.category);
                const summary =
                  session.result?.headline ||
                  session.message ||
                  session.error?.detail ||
                  "Jeslect keeps this compare session available so you can pick the thread back up.";

                return (
                  <article key={session.compare_id} className="rounded-[24px] border border-black/8 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {category ? (
                        <span className="rounded-full border border-black/8 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                          {category.label}
                        </span>
                      ) : null}
                      <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${compareStatusTone(session)}`}>
                        {compareStatusLabel(session)}
                      </span>
                      {session.status === "done" && typeof session.result?.confidence === "number" ? (
                        <span className="rounded-full border border-black/8 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                          {Math.round(session.result.confidence * 100)}%
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-4 text-[14px] leading-6 text-slate-600">{summary}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-black/8 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                        Updated {formatDateTime(session.updated_at || session.created_at)}
                      </span>
                      <Link
                        href={session.status === "done" ? `/compare/${encodeURIComponent(session.compare_id)}` : "/compare"}
                        className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-medium text-slate-700"
                      >
                        {session.status === "done" ? "View result" : "Open compare"}
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </article>
      </section>
    </div>
  );
}
