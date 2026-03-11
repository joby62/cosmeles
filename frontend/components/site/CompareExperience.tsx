"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  fetchMobileCompareBootstrap,
  listMobileCompareSessions,
  resolveImageUrl,
  runMobileCompareJobStream,
  type MobileCompareBootstrapResponse,
  type MobileCompareProductLibraryItem,
  type MobileCompareSession,
} from "@/lib/api";
import { CATEGORIES, type CategoryKey } from "@/lib/site";

const MAX_SELECTION = 3;

type CompareExperienceProps = {
  initialCategory: CategoryKey;
  initialPick?: string;
};

function formatUpdatedAt(value: string | null | undefined): string {
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

function formatProductName(item: MobileCompareProductLibraryItem): string {
  return item.product.name || item.product.brand || "Untitled product";
}

function compareItems(a: MobileCompareProductLibraryItem, b: MobileCompareProductLibraryItem): number {
  if (a.is_recommendation !== b.is_recommendation) return a.is_recommendation ? -1 : 1;
  if (a.is_most_used !== b.is_most_used) return a.is_most_used ? -1 : 1;
  if (a.usage_count !== b.usage_count) return b.usage_count - a.usage_count;
  return formatProductName(a).localeCompare(formatProductName(b), "en");
}

function statusLabel(session: MobileCompareSession): string {
  if (session.status === "done") return "Ready";
  if (session.status === "failed") return "Needs retry";
  return session.stage_label || "Running";
}

function statusTone(session: MobileCompareSession): string {
  if (session.status === "done") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (session.status === "failed") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

export default function CompareExperience({ initialCategory, initialPick = "" }: CompareExperienceProps) {
  const router = useRouter();
  const [category, setCategory] = useState<CategoryKey>(initialCategory);
  const [bootstrap, setBootstrap] = useState<MobileCompareBootstrapResponse | null>(null);
  const [sessions, setSessions] = useState<MobileCompareSession[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loadingBootstrap, setLoadingBootstrap] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [progressLabel, setProgressLabel] = useState("Select 2 to 3 products to compare.");
  const [progressPercent, setProgressPercent] = useState(0);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    setCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingBootstrap(true);
      setLoadingSessions(true);
      setBootstrapError(null);
      setHistoryError(null);
      setRunError(null);
      setProgressPercent(0);
      setProgressLabel("Select 2 to 3 products to compare.");

      try {
        const nextBootstrap = await fetchMobileCompareBootstrap(category);
        if (cancelled) return;
        setBootstrap(nextBootstrap);

        const validIds = new Set(nextBootstrap.product_library.items.map((item) => item.product.id));
        setSelectedIds((current) => {
          const kept = current.filter((id) => validIds.has(id)).slice(0, MAX_SELECTION);
          if (kept.length > 0) return kept;
          if (initialPick && validIds.has(initialPick)) return [initialPick];
          return [];
        });
      } catch (error) {
        if (cancelled) return;
        setBootstrap(null);
        setBootstrapError(error instanceof Error ? error.message : String(error));
      } finally {
        if (!cancelled) setLoadingBootstrap(false);
      }

      try {
        const nextSessions = await listMobileCompareSessions({ category, limit: 8, offset: 0 });
        if (cancelled) return;
        setSessions(nextSessions);
      } catch (error) {
        if (cancelled) return;
        setSessions([]);
        setHistoryError(error instanceof Error ? error.message : String(error));
      } finally {
        if (!cancelled) setLoadingSessions(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [category, initialPick]);

  const items = useMemo(
    () => [...(bootstrap?.product_library.items || [])].sort(compareItems),
    [bootstrap?.product_library.items],
  );

  const filteredItems = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => {
      const haystack = [item.product.brand, item.product.name, item.product.one_sentence]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [deferredSearch, items]);

  const selectionSummary = useMemo(
    () =>
      selectedIds
        .map((id) => items.find((item) => item.product.id === id))
        .filter((value): value is MobileCompareProductLibraryItem => Boolean(value)),
    [items, selectedIds],
  );

  const canStart =
    !running &&
    !loadingBootstrap &&
    Boolean(bootstrap?.profile.has_history_profile) &&
    selectedIds.length >= 2 &&
    selectedIds.length <= MAX_SELECTION;

  function updateCategory(nextCategory: CategoryKey) {
    setCategory(nextCategory);
    setSearch("");
    setSelectedIds([]);

    startTransition(() => {
      router.replace(nextCategory === "shampoo" ? "/compare" : `/compare?category=${encodeURIComponent(nextCategory)}`, {
        scroll: false,
      });
    });
  }

  function toggleProduct(productId: string) {
    setSelectedIds((current) => {
      if (current.includes(productId)) {
        return current.filter((id) => id !== productId);
      }
      if (current.length >= MAX_SELECTION) {
        return [...current];
      }
      return [...current, productId];
    });
  }

  async function startCompare() {
    if (!canStart) return;
    setRunning(true);
    setRunError(null);
    setProgressPercent(6);
    setProgressLabel("Preparing your side-by-side compare.");

    try {
      const result = await runMobileCompareJobStream(
        {
          category,
          profile_mode: "reuse_latest",
          targets: selectedIds.map((productId) => ({
            source: "history_product",
            product_id: productId,
          })),
          options: {
            language: "en",
            include_inci_order_diff: true,
            include_function_rank_diff: true,
          },
        },
        (event) => {
          const data = event.data || {};
          const stageLabel = typeof data.stage_label === "string" ? data.stage_label : null;
          const message = typeof data.message === "string" ? data.message : null;
          const percentValue = typeof data.percent === "number" ? data.percent : Number(data.percent);

          if (Number.isFinite(percentValue)) {
            setProgressPercent(Math.max(0, Math.min(100, Math.round(percentValue))));
          }
          if (message || stageLabel) {
            setProgressLabel(message || stageLabel || "Working through your compare.");
          }
        },
      );

      startTransition(() => {
        router.push(`/compare/${encodeURIComponent(result.compare_id)}`);
      });
    } catch (error) {
      setRunError(error instanceof Error ? error.message : String(error));
      setRunning(false);
      setProgressPercent(0);
      setProgressLabel("Select 2 to 3 products to compare.");
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((entry) => {
          const active = entry.key === category;
          return (
            <button
              key={entry.key}
              type="button"
              onClick={() => updateCategory(entry.key)}
              className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-[14px] font-medium transition ${
                active
                  ? "bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] text-white shadow-[0_12px_28px_rgba(0,113,227,0.24)]"
                  : "border border-black/8 bg-white text-slate-700"
              }`}
            >
              {entry.label}
            </button>
          );
        })}
      </div>

      <section className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <article className="rounded-[28px] border border-black/8 bg-white/92 p-5 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Compare basis</p>
          {loadingBootstrap ? (
            <p className="mt-4 text-[15px] leading-7 text-slate-600">Loading your available compare basis...</p>
          ) : bootstrapError ? (
            <p className="mt-4 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4 text-[14px] leading-6 text-rose-700">
              Compare bootstrap failed: {bootstrapError}
            </p>
          ) : bootstrap ? (
            <>
              <h2 className="mt-3 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">
                {bootstrap.profile.has_history_profile
                  ? "Your latest profile is ready for compare."
                  : "Compare still needs a saved profile basis."}
              </h2>
              <p className="mt-3 text-[15px] leading-7 text-slate-600">
                {bootstrap.profile.has_history_profile
                  ? "Pick 2 to 3 products from this routine layer. Jeslect will compare them against your latest saved fit profile."
                  : "The compare engine reuses your latest saved match profile. Once that basis exists, this page can run full side-by-side decisions."}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-black/8 bg-slate-50 px-3 py-1 text-[12px] font-medium text-slate-700">
                  Basis: {bootstrap.profile.basis}
                </span>
                {bootstrap.recommendation.route_title ? (
                  <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-[12px] font-medium text-sky-700">
                    {bootstrap.recommendation.route_title}
                  </span>
                ) : null}
                {bootstrap.profile.last_completed_at ? (
                  <span className="rounded-full border border-black/8 bg-slate-50 px-3 py-1 text-[12px] font-medium text-slate-700">
                    Saved {formatUpdatedAt(bootstrap.profile.last_completed_at)}
                  </span>
                ) : null}
              </div>

              {bootstrap.profile.summary.length > 0 ? (
                <div className="mt-5 space-y-2">
                  {bootstrap.profile.summary.slice(0, 3).map((item) => (
                    <div
                      key={item}
                      className="rounded-[20px] border border-black/8 bg-slate-50 px-4 py-3 text-[14px] leading-6 text-slate-700"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-6 rounded-[24px] border border-black/8 bg-[linear-gradient(180deg,#f8fbff_0%,#eef5fd_100%)] p-4">
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                  {bootstrap.source_guide.title}
                </p>
                <div className="mt-3 space-y-2">
                  {bootstrap.source_guide.value_points.slice(0, 3).map((item) => (
                    <p key={item} className="text-[14px] leading-6 text-slate-700">
                      {item}
                    </p>
                  ))}
                </div>
              </div>

              {!bootstrap.profile.has_history_profile ? (
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href={category === "shampoo" ? "/match" : `/match?category=${encodeURIComponent(category)}`}
                    className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-5 text-[14px] font-semibold text-white"
                  >
                    Build compare basis
                  </Link>
                  <Link
                    href={`/shop/${category}`}
                    className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[14px] font-semibold text-slate-700"
                  >
                    Browse this category
                  </Link>
                </div>
              ) : null}
            </>
          ) : null}
        </article>

        <article className="rounded-[28px] border border-black/8 bg-white/92 p-5 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Product selection</p>
              <h2 className="mt-3 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">
                Select up to 3 products in {CATEGORIES.find((entry) => entry.key === category)?.label}.
              </h2>
            </div>
            <div className="rounded-full border border-black/8 bg-slate-50 px-4 py-2 text-[13px] font-medium text-slate-700">
              {selectedIds.length} selected
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 md:flex-row">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter by brand or product name"
              className="h-12 flex-1 rounded-full border border-black/10 bg-white px-5 text-[15px] text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            />
            <button
              type="button"
              disabled={!canStart}
              onClick={() => {
                void startCompare();
              }}
              className="inline-flex h-12 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-6 text-[14px] font-semibold text-white shadow-[0_14px_36px_rgba(0,113,227,0.28)] disabled:opacity-45"
            >
              {running ? "Running compare..." : "Start compare"}
            </button>
          </div>

          {runError ? (
            <div className="mt-4 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4 text-[14px] leading-6 text-rose-700">
              Compare failed: {runError}
            </div>
          ) : null}

          {running ? (
            <div className="mt-4 rounded-[22px] border border-black/8 bg-slate-50 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[14px] font-medium text-slate-800">{progressLabel}</p>
                <span className="text-[12px] font-semibold text-slate-500">{progressPercent}%</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#2997ff_0%,#0071e3_100%)] transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          ) : null}

          {selectionSummary.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {selectionSummary.map((item) => (
                <button
                  key={item.product.id}
                  type="button"
                  onClick={() => toggleProduct(item.product.id)}
                  className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] font-medium text-sky-700"
                >
                  <span>{formatProductName(item)}</span>
                  <span>Remove</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {loadingBootstrap ? (
              <div className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-5 text-[14px] text-slate-600">
                Loading compare product library...
              </div>
            ) : filteredItems.length > 0 ? (
              filteredItems.map((item) => {
                const selected = selectedIds.includes(item.product.id);
                const disabled = !selected && selectedIds.length >= MAX_SELECTION;
                const productName = formatProductName(item);
                return (
                  <button
                    key={item.product.id}
                    type="button"
                    onClick={() => toggleProduct(item.product.id)}
                    disabled={disabled || running || !bootstrap?.profile.has_history_profile}
                    className={`group overflow-hidden rounded-[26px] border text-left shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition ${
                      selected
                        ? "border-sky-300 bg-sky-50/70"
                        : "border-black/8 bg-white/92 hover:-translate-y-[1px]"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <div className="relative aspect-[1/0.92] overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef4fb_100%)]">
                      <Image
                        src={resolveImageUrl(item.product)}
                        alt={productName}
                        fill
                        sizes="(min-width: 768px) 32vw, 100vw"
                        className="object-cover"
                      />
                    </div>
                    <div className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {item.is_recommendation ? (
                          <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700">
                            Recommended by your saved profile
                          </span>
                        ) : null}
                        {item.is_most_used ? (
                          <span className="rounded-full border border-black/8 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-700">
                            Most used
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-4 text-[12px] font-medium uppercase tracking-[0.18em] text-slate-500">
                        {item.product.brand || "Jeslect"}
                      </p>
                      <h3 className="mt-2 text-[21px] font-semibold leading-[1.12] tracking-[-0.03em] text-slate-950">
                        {productName}
                      </h3>
                      <p className="mt-3 line-clamp-3 text-[14px] leading-6 text-slate-600">
                        {item.product.one_sentence || "Use this profile as one side of the compare."}
                      </p>
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <span className="text-[12px] font-medium text-slate-500">Used {item.usage_count} times</span>
                        <span
                          className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
                            selected ? "bg-sky-600 text-white" : "border border-black/8 bg-white text-slate-700"
                          }`}
                        >
                          {selected ? "Selected" : "Select"}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-5 text-[14px] leading-6 text-slate-600">
                No products matched that filter in this category yet.
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="rounded-[28px] border border-black/8 bg-white/92 p-5 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Recent compare history</p>
            <h2 className="mt-3 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">Return to previous decisions without starting over.</h2>
          </div>
        </div>

        {loadingSessions ? (
          <div className="mt-6 rounded-[24px] border border-black/8 bg-slate-50 px-4 py-5 text-[14px] text-slate-600">
            Loading compare history...
          </div>
        ) : historyError ? (
          <div className="mt-6 rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-5 text-[14px] leading-6 text-rose-700">
            Compare history failed: {historyError}
          </div>
        ) : sessions.length > 0 ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {sessions.map((session) => (
              <article
                key={session.compare_id}
                className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${statusTone(session)}`}>
                    {statusLabel(session)}
                  </span>
                  <span className="rounded-full border border-black/8 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                    {formatUpdatedAt(session.updated_at)}
                  </span>
                </div>
                <h3 className="mt-4 text-[20px] font-semibold tracking-[-0.03em] text-slate-950">
                  {session.result?.headline || session.message || "Compare session"}
                </h3>
                <p className="mt-3 text-[14px] leading-6 text-slate-600">
                  {session.status === "done"
                    ? "Open the saved result and continue from the same compare output."
                    : session.status === "failed"
                      ? session.error?.detail || "The previous compare did not finish cleanly."
                      : session.stage_label || "This compare is still processing."}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  {session.status === "done" ? (
                    <Link
                      href={`/compare/${encodeURIComponent(session.compare_id)}`}
                      className="inline-flex h-10 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-4 text-[13px] font-semibold text-white"
                    >
                      Open result
                    </Link>
                  ) : null}
                  <Link
                    href={`/shop/${encodeURIComponent(category)}`}
                    className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-semibold text-slate-700"
                  >
                    Browse category
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-[24px] border border-black/8 bg-slate-50 px-4 py-5 text-[14px] leading-6 text-slate-600">
            No compare history is stored for this category yet.
          </div>
        )}
      </section>
    </div>
  );
}
