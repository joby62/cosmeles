"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useSitePreferences } from "@/components/site/SitePreferenceProvider";
import {
  fetchMobileCompareBootstrap,
  listMobileCompareSessions,
  resolveImageUrl,
  runMobileCompareJobStream,
  type MobileCompareBootstrapResponse,
  type MobileCompareProductLibraryItem,
  type MobileCompareSession,
} from "@/lib/api";
import { getCategories, type CategoryKey } from "@/lib/site";

const MAX_SELECTION = 3;

type CompareExperienceProps = {
  initialCategory: CategoryKey;
  initialPick?: string;
};

function formatUpdatedAt(value: string | null | undefined, locale: "en" | "zh"): string {
  const raw = String(value || "").trim();
  if (!raw) return locale === "zh" ? "暂无最近活动" : "No recent activity";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    month: locale === "zh" ? "numeric" : "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatProductName(item: MobileCompareProductLibraryItem, locale: "en" | "zh"): string {
  return item.product.name || item.product.brand || (locale === "zh" ? "未命名商品" : "Untitled product");
}

function compareItems(
  a: MobileCompareProductLibraryItem,
  b: MobileCompareProductLibraryItem,
  locale: "en" | "zh",
): number {
  if (a.is_recommendation !== b.is_recommendation) return a.is_recommendation ? -1 : 1;
  if (a.is_most_used !== b.is_most_used) return a.is_most_used ? -1 : 1;
  if (a.usage_count !== b.usage_count) return b.usage_count - a.usage_count;
  return formatProductName(a, locale).localeCompare(formatProductName(b, locale), locale === "zh" ? "zh" : "en");
}

function statusLabel(session: MobileCompareSession, locale: "en" | "zh"): string {
  if (session.status === "done") return locale === "zh" ? "可查看" : "Ready";
  if (session.status === "failed") return locale === "zh" ? "需要重试" : "Retry needed";
  return session.stage_label || (locale === "zh" ? "处理中" : "Running");
}

function statusTone(session: MobileCompareSession): string {
  if (session.status === "done") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (session.status === "failed") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

export default function CompareExperience({ initialCategory, initialPick = "" }: CompareExperienceProps) {
  const router = useRouter();
  const { locale } = useSitePreferences();
  const categories = getCategories(locale);
  const copy =
    locale === "zh"
      ? {
          defaultProgress: "请选择 2 到 3 个商品进行对比。",
          preparing: "正在准备并排对比。",
          generating: "正在生成你的对比结果。",
          baseEyebrow: "对比基础",
          baseReadyTitle: "最新适配基础已经可以直接用于对比。",
          baseReadySummary: "从这个护理层里挑 2 到 3 个商品，婕选会把它们放回你最近一次保存的适配基础里进行判断。",
          baseMissingTitle: "对比仍然需要一份已保存的适配基础。",
          baseMissingSummary: "对比引擎会复用最近一次保存的测配结果。等这份基础存在后，这一页才能运行完整的并排判断。",
          basisLabel: "基础",
          savedAtLabel: "保存于",
          buildBasis: "先建立对比基础",
          browseCategory: "浏览这个品类",
          selectionEyebrow: "商品选择",
          selectionTitle: (label: string) => `在${label}里最多选择 3 个商品。`,
          selectedCount: (count: number) => `已选 ${count} 个`,
          searchPlaceholder: "按品牌或商品名筛选",
          start: "开始对比",
          starting: "对比中...",
          runFailed: "对比失败",
          remove: "移除",
          loadingLibrary: "正在加载可对比商品库...",
          recommended: "已存适配基础推荐",
          mostUsed: "最常使用",
          fallbackBrand: "Jeslect",
          fallbackSummary: "把这个商品作为对比中的一个候选。",
          usageCount: (count: number) => `已使用 ${count} 次`,
          selected: "已选择",
          select: "选择",
          noMatches: "当前这个筛选条件下还没有匹配到商品。",
          historyEyebrow: "最近对比历史",
          historyTitle: "不用重来，也能回到之前的判断结果。",
          loadingHistory: "正在加载对比历史...",
          historyFailed: "对比历史加载失败",
          compareTask: "对比任务",
          doneSummary: "打开已保存的结果，从同一份对比输出继续往下判断。",
          failedSummary: "上一次对比没有顺利完成。",
          runningSummary: "这个对比任务仍在处理中。",
          openResult: "打开结果",
          emptyHistory: "这个品类当前还没有已保存的对比历史。",
        }
      : {
          defaultProgress: "Select 2 to 3 products to compare.",
          preparing: "Preparing your side-by-side compare.",
          generating: "Generating your compare result.",
          baseEyebrow: "Compare basis",
          baseReadyTitle: "Your latest saved match is ready to anchor compare.",
          baseReadySummary:
            "Pick 2 to 3 products in this category and Jeslect will place them back into your latest saved match basis.",
          baseMissingTitle: "Compare still needs one saved match basis.",
          baseMissingSummary:
            "The compare engine reuses your latest saved match. Once that basis exists, this page can run the full side-by-side decision.",
          basisLabel: "Basis",
          savedAtLabel: "Saved",
          buildBasis: "Create match basis first",
          browseCategory: "Browse this category",
          selectionEyebrow: "Product selection",
          selectionTitle: (label: string) => `Choose up to 3 products in ${label}.`,
          selectedCount: (count: number) => `${count} selected`,
          searchPlaceholder: "Filter by brand or product name",
          start: "Start compare",
          starting: "Comparing...",
          runFailed: "Compare failed",
          remove: "Remove",
          loadingLibrary: "Loading compare-ready product library...",
          recommended: "Recommended from saved basis",
          mostUsed: "Most used",
          fallbackBrand: "Jeslect",
          fallbackSummary: "Use this product as one of the compare candidates.",
          usageCount: (count: number) => `Used ${count} times`,
          selected: "Selected",
          select: "Select",
          noMatches: "No products matched this filter.",
          historyEyebrow: "Recent compare history",
          historyTitle: "Resume earlier compare decisions without starting over.",
          loadingHistory: "Loading compare history...",
          historyFailed: "Compare history failed",
          compareTask: "Compare task",
          doneSummary: "Open the saved result and continue from the same compare output.",
          failedSummary: "The previous compare did not finish successfully.",
          runningSummary: "This compare task is still processing.",
          openResult: "Open result",
          emptyHistory: "There is no saved compare history for this category yet.",
        };

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
  const [progressLabel, setProgressLabel] = useState(copy.defaultProgress);
  const [progressPercent, setProgressPercent] = useState(0);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    setCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    if (!running) setProgressLabel(copy.defaultProgress);
  }, [copy.defaultProgress, running]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingBootstrap(true);
      setLoadingSessions(true);
      setBootstrapError(null);
      setHistoryError(null);
      setRunError(null);
      setProgressPercent(0);
      setProgressLabel(copy.defaultProgress);

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
  }, [category, copy.defaultProgress, initialPick]);

  const items = useMemo(
    () => [...(bootstrap?.product_library.items || [])].sort((left, right) => compareItems(left, right, locale)),
    [bootstrap?.product_library.items, locale],
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
    setProgressLabel(copy.preparing);

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
            language: locale,
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
            setProgressLabel(message || stageLabel || copy.generating);
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
      setProgressLabel(copy.defaultProgress);
    }
  }

  const categoryLabel = categories.find((entry) => entry.key === category)?.label || category;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2">
        {categories.map((entry) => {
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
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.baseEyebrow}</p>
          {loadingBootstrap ? (
            <p className="mt-4 text-[15px] leading-7 text-slate-600">{copy.loadingLibrary}</p>
          ) : bootstrapError ? (
            <p className="mt-4 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4 text-[14px] leading-6 text-rose-700">
              {copy.baseEyebrow}: {bootstrapError}
            </p>
          ) : bootstrap ? (
            <>
              <h2 className="mt-3 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">
                {bootstrap.profile.has_history_profile ? copy.baseReadyTitle : copy.baseMissingTitle}
              </h2>
              <p className="mt-3 text-[15px] leading-7 text-slate-600">
                {bootstrap.profile.has_history_profile ? copy.baseReadySummary : copy.baseMissingSummary}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-black/8 bg-slate-50 px-3 py-1 text-[12px] font-medium text-slate-700">
                  {copy.basisLabel}: {bootstrap.profile.basis}
                </span>
                {bootstrap.recommendation.route_title ? (
                  <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-[12px] font-medium text-sky-700">
                    {bootstrap.recommendation.route_title}
                  </span>
                ) : null}
                {bootstrap.profile.last_completed_at ? (
                  <span className="rounded-full border border-black/8 bg-slate-50 px-3 py-1 text-[12px] font-medium text-slate-700">
                    {copy.savedAtLabel} {formatUpdatedAt(bootstrap.profile.last_completed_at, locale)}
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
                    {copy.buildBasis}
                  </Link>
                  <Link
                    href={`/shop/${category}`}
                    className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[14px] font-semibold text-slate-700"
                  >
                    {copy.browseCategory}
                  </Link>
                </div>
              ) : null}
            </>
          ) : null}
        </article>

        <article className="rounded-[28px] border border-black/8 bg-white/92 p-5 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.selectionEyebrow}</p>
              <h2 className="mt-3 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">
                {copy.selectionTitle(categoryLabel)}
              </h2>
            </div>
            <div className="rounded-full border border-black/8 bg-slate-50 px-4 py-2 text-[13px] font-medium text-slate-700">
              {copy.selectedCount(selectedIds.length)}
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 md:flex-row">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={copy.searchPlaceholder}
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
              {running ? copy.starting : copy.start}
            </button>
          </div>

          {runError ? (
            <div className="mt-4 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4 text-[14px] leading-6 text-rose-700">
              {copy.runFailed}: {runError}
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
                  <span>{formatProductName(item, locale)}</span>
                  <span>{copy.remove}</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {loadingBootstrap ? (
              <div className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-5 text-[14px] text-slate-600">
                {copy.loadingLibrary}
              </div>
            ) : filteredItems.length > 0 ? (
              filteredItems.map((item) => {
                const selected = selectedIds.includes(item.product.id);
                const disabled = !selected && selectedIds.length >= MAX_SELECTION;
                const productName = formatProductName(item, locale);
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
                            {copy.recommended}
                          </span>
                        ) : null}
                        {item.is_most_used ? (
                          <span className="rounded-full border border-black/8 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-700">
                            {copy.mostUsed}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-4 text-[12px] font-medium uppercase tracking-[0.18em] text-slate-500">
                        {item.product.brand || copy.fallbackBrand}
                      </p>
                      <h3 className="mt-2 text-[21px] font-semibold leading-[1.12] tracking-[-0.03em] text-slate-950">
                        {productName}
                      </h3>
                      <p className="mt-3 line-clamp-3 text-[14px] leading-6 text-slate-600">
                        {item.product.one_sentence || copy.fallbackSummary}
                      </p>
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <span className="text-[12px] font-medium text-slate-500">{copy.usageCount(item.usage_count)}</span>
                        <span
                          className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
                            selected ? "bg-sky-600 text-white" : "border border-black/8 bg-white text-slate-700"
                          }`}
                        >
                          {selected ? copy.selected : copy.select}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-5 text-[14px] leading-6 text-slate-600">
                {copy.noMatches}
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="rounded-[28px] border border-black/8 bg-white/92 p-5 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.historyEyebrow}</p>
            <h2 className="mt-3 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">{copy.historyTitle}</h2>
          </div>
        </div>

        {loadingSessions ? (
          <div className="mt-6 rounded-[24px] border border-black/8 bg-slate-50 px-4 py-5 text-[14px] text-slate-600">
            {copy.loadingHistory}
          </div>
        ) : historyError ? (
          <div className="mt-6 rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-5 text-[14px] leading-6 text-rose-700">
            {copy.historyFailed}: {historyError}
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
                    {statusLabel(session, locale)}
                  </span>
                  <span className="rounded-full border border-black/8 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                    {formatUpdatedAt(session.updated_at, locale)}
                  </span>
                </div>
                <h3 className="mt-4 text-[20px] font-semibold tracking-[-0.03em] text-slate-950">
                  {session.result?.headline || session.message || copy.compareTask}
                </h3>
                <p className="mt-3 text-[14px] leading-6 text-slate-600">
                  {session.status === "done"
                    ? copy.doneSummary
                    : session.status === "failed"
                      ? session.error?.detail || copy.failedSummary
                      : session.stage_label || copy.runningSummary}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  {session.status === "done" ? (
                    <Link
                      href={`/compare/${encodeURIComponent(session.compare_id)}`}
                      className="inline-flex h-10 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-4 text-[13px] font-semibold text-white"
                    >
                      {copy.openResult}
                    </Link>
                  ) : null}
                  <Link
                    href={`/shop/${encodeURIComponent(category)}`}
                    className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-semibold text-slate-700"
                  >
                    {copy.browseCategory}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-[24px] border border-black/8 bg-slate-50 px-4 py-5 text-[14px] leading-6 text-slate-600">
            {copy.emptyHistory}
          </div>
        )}
      </section>
    </div>
  );
}
