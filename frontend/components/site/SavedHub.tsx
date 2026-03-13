"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSitePreferences } from "@/components/site/SitePreferenceProvider";
import {
  fetchMobileBagItems,
  listMobileCompareSessions,
  listMobileSelectionSessions,
  resolveImageUrl,
  type MobileBagItem,
  type MobileCompareSession,
  type MobileSelectionResolveResponse,
} from "@/lib/api";
import { getMatchRouteMeta } from "@/lib/match";
import { clearRecentProducts, readRecentProducts, type RecentProductSnapshot } from "@/lib/recentProducts";
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

function formatDateTime(value: string | null | undefined, locale: "en" | "zh"): string {
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

function compareStatusLabel(session: MobileCompareSession, locale: "en" | "zh"): string {
  if (session.status === "failed") return locale === "zh" ? "失败" : "Failed";
  if (session.status === "running") return session.stage_label || (locale === "zh" ? "处理中" : "Running");
  if (session.result?.decision === "switch") return locale === "zh" ? "切换" : "Switch";
  if (session.result?.decision === "hybrid") return locale === "zh" ? "混合" : "Hybrid";
  return locale === "zh" ? "保留" : "Keep";
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
  const { locale } = useSitePreferences();
  const copy =
    locale === "zh"
      ? {
          summaryCards: [
            { label: "袋中商品", summary: "离开、比较或回看之后，shortlist 也应该继续可见。" },
            { label: "已存测配", summary: "复用当前设备上已经生成好的路线基础。" },
            { label: "对比记录", summary: "不用重建 shortlist，也能继续之前的对比判断。" },
            { label: "最近浏览", summary: "回到你刚刚打开过的商品和决策路径。" },
          ],
          loading: "正在加载已存的袋中、测配、对比和最近浏览内容...",
          bagEyebrow: "袋中连续性",
          bagTitle: "让 shortlist 持续活着。",
          openBag: "打开袋中",
          bagFailed: "袋中加载失败",
          emptyBagTitle: "还没有已存的袋中商品",
          emptyBagSummary: "从选购、测配或对比开始后，留下来的商品都会继续显示在这里。",
          browseShop: "进入选购",
          startMatch: "开始测配",
          quantity: (count: number) => `数量 ${count}`,
          bagFallback: "打开商品详情页，把成分、对比和信任信息继续放在一步之内。",
          viewProduct: "查看商品",
          compare: "对比",
          recentEyebrow: "最近浏览",
          recentTitle: "回到你刚刚打开过的商品页。",
          clearRecent: "清空最近浏览",
          emptyRecentTitle: "还没有最近浏览的商品",
          emptyRecentSummary: "打开任意商品页后，婕选会把它保存在这里，方便你不靠搜索回到原位。",
          searchProducts: "搜索商品",
          viewedAt: (value: string) => `浏览于 ${value}`,
          reopenProduct: "重新打开商品",
          matchesEyebrow: "已存测配",
          matchesTitle: "把路线基础留下来继续复用。",
          openMatch: "打开测配",
          matchesFailed: "测配历史加载失败",
          emptyMatchesTitle: "还没有已存测配",
          emptyMatchesSummary: "先完成一次测配，婕选就会把路线基础保留下来，供对比和商品回看继续使用。",
          learnFirst: "先去探索",
          pinned: "已固定",
          matchFallback: "这份已存测配可以继续服务之后的对比和商品决策。",
          savedAt: (value: string) => `保存于 ${value}`,
          viewMatch: "查看测配",
          compareEyebrow: "对比历史",
          compareTitle: "继续之前的并排判断。",
          openCompare: "打开对比",
          compareFailed: "对比历史加载失败",
          emptyCompareTitle: "还没有对比历史",
          emptyCompareSummary: "当测配先把路线收窄后，对比会把最近的并排结果保存在这里。",
          createBasis: "先建路线基础",
          compareFallback: "婕选会把这次对比保留下来，方便你之后继续往下判断。",
          updatedAt: (value: string) => `更新于 ${value}`,
          viewResult: "查看结果",
        }
      : {
          summaryCards: [
            { label: "Bag items", summary: "Your shortlist should stay visible after you leave, compare, or revisit." },
            { label: "Saved matches", summary: "Reuse the route basis already created on this device." },
            { label: "Compare history", summary: "Continue earlier compare calls without rebuilding the shortlist." },
            { label: "Recently viewed", summary: "Return to the products and decision paths you opened most recently." },
          ],
          loading: "Loading saved bag, match, compare, and recent-view content...",
          bagEyebrow: "Bag continuity",
          bagTitle: "Keep the shortlist alive.",
          openBag: "Open bag",
          bagFailed: "Bag failed",
          emptyBagTitle: "No saved bag items yet",
          emptyBagSummary: "Once you start from Shop, Match, or Compare, the products you keep should stay visible here.",
          browseShop: "Browse shop",
          startMatch: "Start match",
          quantity: (count: number) => `Quantity ${count}`,
          bagFallback: "Open the product page to keep ingredients, compare, and trust details close.",
          viewProduct: "View product",
          compare: "Compare",
          recentEyebrow: "Recently viewed",
          recentTitle: "Return to the product pages you opened.",
          clearRecent: "Clear recent",
          emptyRecentTitle: "No recently viewed products yet",
          emptyRecentSummary: "Open a product page and Jeslect will keep it here so you can get back without searching again.",
          searchProducts: "Search products",
          viewedAt: (value: string) => `Viewed ${value}`,
          reopenProduct: "Reopen product",
          matchesEyebrow: "Saved matches",
          matchesTitle: "Keep the route basis reusable.",
          openMatch: "Open match",
          matchesFailed: "Match history failed",
          emptyMatchesTitle: "No saved matches yet",
          emptyMatchesSummary: "Run Match once and Jeslect will keep the route basis ready for compare and product revisit.",
          learnFirst: "Learn first",
          pinned: "Pinned",
          matchFallback: "This saved match can keep guiding compare and product decisions on this device.",
          savedAt: (value: string) => `Saved ${value}`,
          viewMatch: "View match",
          compareEyebrow: "Compare history",
          compareTitle: "Resume the side-by-side path.",
          openCompare: "Open compare",
          compareFailed: "Compare history failed",
          emptyCompareTitle: "No compare history yet",
          emptyCompareSummary: "After Match narrows the route, Compare will keep the latest side-by-side results here.",
          createBasis: "Create route basis",
          compareFallback: "Jeslect keeps this compare session available so you can pick the thread back up.",
          updatedAt: (value: string) => `Updated ${value}`,
          viewResult: "View result",
        };

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
      { ...copy.summaryCards[0], value: state.bagItems.length },
      { ...copy.summaryCards[1], value: state.matchSessions.length },
      { ...copy.summaryCards[2], value: state.compareSessions.length },
      { ...copy.summaryCards[3], value: state.recentProducts.length },
    ],
    [copy.summaryCards, state],
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
          {copy.loading}
        </article>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <article className="rounded-[32px] border border-black/8 bg-white/94 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.bagEyebrow}</p>
              <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-slate-950">{copy.bagTitle}</h2>
            </div>
            <Link
              href="/bag"
              className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-medium text-slate-700"
            >
              {copy.openBag}
            </Link>
          </div>

          {errors.bag ? (
            <div className="mt-5 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4 text-[14px] leading-6 text-rose-700">
              {copy.bagFailed}: {errors.bag}
            </div>
          ) : null}

          {!errors.bag && state.bagItems.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                title={copy.emptyBagTitle}
                summary={copy.emptyBagSummary}
                primaryHref="/shop"
                primaryLabel={copy.browseShop}
                secondaryHref="/match"
                secondaryLabel={copy.startMatch}
              />
            </div>
          ) : null}

          {!errors.bag && state.bagItems.length > 0 ? (
            <div className="mt-5 space-y-4">
              {state.bagItems.slice(0, 4).map((item) => {
                const title = productName(item.product.name, item.product.brand, locale === "zh" ? "未命名商品" : "Untitled product");
                const category = getCategoryMeta(item.product.category, locale);
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
                          {copy.quantity(item.quantity)}
                        </span>
                      </div>
                      <h3 className="mt-4 text-[22px] font-semibold tracking-[-0.03em] text-slate-950">{title}</h3>
                      <p className="mt-2 text-[14px] leading-6 text-slate-600">{item.product.one_sentence || copy.bagFallback}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                          href={`/product/${encodeURIComponent(item.product.id)}`}
                          className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-medium text-slate-700"
                        >
                          {copy.viewProduct}
                        </Link>
                        <Link
                          href={`/compare?category=${encodeURIComponent(item.product.category)}&pick=${encodeURIComponent(item.product.id)}`}
                          className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-medium text-slate-700"
                        >
                          {copy.compare}
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
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.recentEyebrow}</p>
              <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-slate-950">{copy.recentTitle}</h2>
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
                {copy.clearRecent}
              </button>
            ) : null}
          </div>

          {state.recentProducts.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                title={copy.emptyRecentTitle}
                summary={copy.emptyRecentSummary}
                primaryHref="/shop"
                primaryLabel={copy.browseShop}
                secondaryHref="/search"
                secondaryLabel={copy.searchProducts}
              />
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {state.recentProducts.slice(0, 4).map((item) => {
                const category = getCategoryMeta(item.category, locale);
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
                          {copy.viewedAt(formatDateTime(item.viewedAt, locale))}
                        </span>
                        <Link
                          href={`/product/${encodeURIComponent(item.productId)}`}
                          className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-medium text-slate-700"
                        >
                          {copy.reopenProduct}
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
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.matchesEyebrow}</p>
              <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-slate-950">{copy.matchesTitle}</h2>
            </div>
            <Link
              href="/match"
              className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-medium text-slate-700"
            >
              {copy.openMatch}
            </Link>
          </div>

          {errors.matches ? (
            <div className="mt-5 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4 text-[14px] leading-6 text-rose-700">
              {copy.matchesFailed}: {errors.matches}
            </div>
          ) : null}

          {!errors.matches && state.matchSessions.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                title={copy.emptyMatchesTitle}
                summary={copy.emptyMatchesSummary}
                primaryHref="/match"
                primaryLabel={copy.startMatch}
                secondaryHref="/learn"
                secondaryLabel={copy.learnFirst}
              />
            </div>
          ) : null}

          {!errors.matches && state.matchSessions.length > 0 ? (
            <div className="mt-5 space-y-4">
              {state.matchSessions.slice(0, 4).map((session) => {
                const routeMeta = getMatchRouteMeta(session.category, session.route.key, locale);
                const category = getCategoryMeta(session.category, locale);
                const title = productName(
                  session.recommended_product.name,
                  session.recommended_product.brand,
                  locale === "zh" ? "未命名商品" : "Untitled product",
                );
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
                          {copy.pinned}
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-4 text-[22px] font-semibold tracking-[-0.03em] text-slate-950">{title}</h3>
                    <p className="mt-2 text-[14px] leading-6 text-slate-600">{routeMeta?.summary || copy.matchFallback}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-black/8 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                        {copy.savedAt(formatDateTime(session.created_at, locale))}
                      </span>
                      <Link
                        href={`/match/${encodeURIComponent(session.session_id)}`}
                        className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-medium text-slate-700"
                      >
                        {copy.viewMatch}
                      </Link>
                      <Link
                        href={`/product/${encodeURIComponent(session.recommended_product.id)}`}
                        className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-medium text-slate-700"
                      >
                        {copy.viewProduct}
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
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.compareEyebrow}</p>
              <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-slate-950">{copy.compareTitle}</h2>
            </div>
            <Link
              href="/compare"
              className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-medium text-slate-700"
            >
              {copy.openCompare}
            </Link>
          </div>

          {errors.compares ? (
            <div className="mt-5 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4 text-[14px] leading-6 text-rose-700">
              {copy.compareFailed}: {errors.compares}
            </div>
          ) : null}

          {!errors.compares && state.compareSessions.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                title={copy.emptyCompareTitle}
                summary={copy.emptyCompareSummary}
                primaryHref="/compare"
                primaryLabel={copy.compare}
                secondaryHref="/match"
                secondaryLabel={copy.createBasis}
              />
            </div>
          ) : null}

          {!errors.compares && state.compareSessions.length > 0 ? (
            <div className="mt-5 space-y-4">
              {state.compareSessions.slice(0, 4).map((session) => {
                const category = getCategoryMeta(session.category, locale);
                const summary = session.result?.headline || session.message || session.error?.detail || copy.compareFallback;

                return (
                  <article key={session.compare_id} className="rounded-[24px] border border-black/8 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {category ? (
                        <span className="rounded-full border border-black/8 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                          {category.label}
                        </span>
                      ) : null}
                      <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${compareStatusTone(session)}`}>
                        {compareStatusLabel(session, locale)}
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
                        {copy.updatedAt(formatDateTime(session.updated_at || session.created_at, locale))}
                      </span>
                      <Link
                        href={session.status === "done" ? `/compare/${encodeURIComponent(session.compare_id)}` : "/compare"}
                        className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-medium text-slate-700"
                      >
                        {session.status === "done" ? copy.viewResult : copy.openCompare}
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
