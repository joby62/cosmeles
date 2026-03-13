"use client";

import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import MobileFrictionSignals from "@/components/mobile/MobileFrictionSignals";
import MobilePageAnalytics from "@/components/mobile/MobilePageAnalytics";
import {
  fetchMobileCompareBootstrap,
  type MobileCompareProductLibraryItem,
  type MobileSelectionCategory,
} from "@/lib/api";
import { trackMobileEvent } from "@/lib/mobileAnalytics";
import { getMobileCategoryLabel } from "@/lib/mobile/routeCopy";
import {
  applyMobileUtilityRouteState,
  describeMobileUtilityReturnLabel,
  hasMobileUtilityRouteContext,
  parseMobileUtilityRouteState,
  resolveMobileUtilityReturnHref,
  resolveMobileUtilitySource,
} from "@/features/mobile-utility/routeState";

const CATEGORY_ORDER: MobileSelectionCategory[] = ["shampoo", "bodywash", "conditioner", "lotion", "cleanser"];
const MAX_TOTAL_SELECTION = 3;
const LIBRARY_RETURN_PARAM = "from_library";
const LIBRARY_PICK_PARAM = "pick";
const LIBRARY_PRESELECT_PARAM = "picked";

type OrderedLibraryItem = {
  raw: MobileCompareProductLibraryItem;
  productId: string;
  title: string;
  subtitle: string;
  keywords: string;
};

type CollectionFilter = "all" | "repurchase" | "sam" | "pdl" | "ancestry";

function normalizeCategory(raw: unknown): MobileSelectionCategory | null {
  const value = String(raw || "").trim().toLowerCase() as MobileSelectionCategory;
  if (!CATEGORY_ORDER.includes(value)) return null;
  return value;
}

function parsePickedProductIds(raw: unknown): string[] {
  const text = String(raw || "").trim();
  if (!text) return [];
  return Array.from(
    new Set(
      text
        .split(",")
        .map((item) => String(item || "").trim())
        .filter(Boolean),
    ),
  ).slice(0, MAX_TOTAL_SELECTION);
}

function resolveProductImage(raw?: string | null): string | null {
  const value = String(raw || "").trim();
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("/")) return value;
  return `/${value}`;
}

function orderLibraryItems(items: MobileCompareProductLibraryItem[]): OrderedLibraryItem[] {
  return items
    .map((item) => {
      const productId = String(item.product.id || "").trim();
      if (!productId) return null;
      const title =
        [item.product.brand, item.product.name].filter(Boolean).join(" ").trim() ||
        String(item.product.one_sentence || "").trim() ||
        "待补全名称产品";
      const subtitle = String(item.product.one_sentence || item.product.description || "").trim();
      const keywordParts = [
        item.product.brand,
        item.product.name,
        item.product.one_sentence,
        item.product.description,
        ...(Array.isArray(item.product.tags) ? item.product.tags : []),
      ]
        .map((part) => String(part || "").trim())
        .filter(Boolean);
      return {
        raw: item,
        productId,
        title,
        subtitle,
        keywords: keywordParts.join(" ").toLowerCase(),
      };
    })
    .filter((item): item is OrderedLibraryItem => Boolean(item));
}

function matchesCollection(item: OrderedLibraryItem, filter: CollectionFilter): boolean {
  if (filter === "all") return true;
  if (filter === "repurchase") {
    return item.raw.is_most_used || Number(item.raw.usage_count) > 0;
  }
  if (filter === "sam") {
    return /山姆|sam|member/i.test(item.keywords);
  }
  if (filter === "pdl") {
    return /胖东来|pdl/i.test(item.keywords);
  }
  return /祖宗|老牌|国货|经典|祖传/i.test(item.keywords);
}

async function safeTrack(name: string, props: Record<string, unknown>) {
  try {
    await trackMobileEvent(name, props);
  } catch {
    // 埋点失败不阻塞主流程
  }
}

function MobileCompareLibraryPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialCategory = normalizeCategory(searchParams?.get("category")) || "shampoo";
  const preselectedIds = useMemo(() => parsePickedProductIds(searchParams?.get(LIBRARY_PRESELECT_PARAM)), [searchParams]);

  const [category, setCategory] = useState<MobileSelectionCategory>(initialCategory);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<OrderedLibraryItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(preselectedIds);
  const [query, setQuery] = useState("");
  const [collection, setCollection] = useState<CollectionFilter>("all");
  const [notice, setNotice] = useState<string | null>(null);

  const utilityRouteState = useMemo(() => parseMobileUtilityRouteState(searchParams), [searchParams]);
  const analyticsSource = resolveMobileUtilitySource(utilityRouteState, "m_compare_library");
  const showReturnAction = hasMobileUtilityRouteContext(utilityRouteState);
  const returnActionHref = resolveMobileUtilityReturnHref(utilityRouteState);
  const returnActionLabel = describeMobileUtilityReturnLabel(utilityRouteState);
  const analyticsRoute = searchParams?.toString() ? `${pathname}?${searchParams.toString()}` : pathname || "/m/compare/library";
  const categoryLabel = getMobileCategoryLabel(category);

  useEffect(() => {
    let cancelled = false;

    void fetchMobileCompareBootstrap(category)
      .then((data) => {
        if (cancelled) return;
        const ordered = orderLibraryItems(data.product_library.items || []);
        const available = new Set(ordered.map((item) => item.productId));
        setItems(ordered);
        setSelectedIds((prev) => prev.filter((id) => available.has(id)).slice(0, MAX_TOTAL_SELECTION));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [category]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 1600);
    return () => {
      window.clearTimeout(timer);
    };
  }, [notice]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      if (!matchesCollection(item, collection)) return false;
      if (!normalizedQuery) return true;
      return item.keywords.includes(normalizedQuery);
    });
  }, [collection, items, query]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const collectionFilters: Array<{ key: CollectionFilter; label: string }> = [
    { key: "all", label: "全部" },
    { key: "repurchase", label: "高复购" },
    { key: "sam", label: "山姆严选" },
    { key: "pdl", label: "胖东来严选" },
    { key: "ancestry", label: "祖宗严选" },
  ];

  function toggleProduct(productId: string) {
    let blocked = false;
    setSelectedIds((prev) => {
      if (prev.includes(productId)) return prev.filter((id) => id !== productId);
      if (prev.length >= MAX_TOTAL_SELECTION) {
        blocked = true;
        return prev;
      }
      return [...prev, productId];
    });
    if (blocked) {
      setNotice("一次最多带回 3 款产品。");
    }
  }

  function goBackToCompare(withSelection: boolean) {
    const params = new URLSearchParams();
    params.set("category", category);
    params.set(LIBRARY_RETURN_PARAM, "1");
    if (withSelection && selectedIds.length > 0) {
      params.set(LIBRARY_PICK_PARAM, selectedIds.join(","));
    }
    applyMobileUtilityRouteState(params, utilityRouteState);
    void safeTrack(withSelection ? "compare_library_apply" : "compare_library_back", {
      category,
      selected_count: selectedIds.length,
      result_count: filteredItems.length,
      collection,
      has_query: Boolean(query.trim()),
    });
    router.push(`/m/compare?${params.toString()}`);
  }

  return (
    <section className="m-compare-page m-compare-page-selection pb-10">
      <MobilePageAnalytics page="mobile_compare_library" route={analyticsRoute} source={analyticsSource} category={category} />
      <MobileFrictionSignals page="mobile_compare_library" route={analyticsRoute} source={analyticsSource} category={category} />

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[28px] leading-[1.14] font-semibold tracking-[-0.02em] text-black/90">产品库筛选</h1>
        <div className="flex items-center gap-2">
          {showReturnAction ? (
            <button
              type="button"
              onClick={() => router.push(returnActionHref)}
              className="inline-flex h-9 items-center rounded-full border border-[#0a84ff]/26 bg-[#eef5ff] px-4 text-[12px] font-semibold text-[#1858b0] active:bg-[#e2efff]"
            >
              {returnActionLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => goBackToCompare(false)}
            className="inline-flex h-9 items-center rounded-full border border-black/12 bg-white/72 px-4 text-[13px] font-medium text-black/72 active:bg-black/[0.03]"
          >
            返回对比
          </button>
        </div>
      </div>
      <p className="mt-2 text-[14px] leading-[1.55] text-black/62">在这里做搜索和集合筛选，选好后一键带回横向对比。</p>

      <div className="m-compare-recommend-card mt-4">
        <div className="m-compare-recommend-kicker">当前品类</div>
        <div className="m-compare-recommend-title mt-2">{categoryLabel}</div>
        <div className="mt-4 flex flex-wrap gap-2">
          {CATEGORY_ORDER.map((item) => {
            const active = item === category;
            return (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setLoading(true);
                  setError(null);
                  setItems([]);
                  setCategory(item);
                  setQuery("");
                  setCollection("all");
                  setSelectedIds([]);
                }}
                className={`inline-flex h-9 items-center rounded-full border px-4 text-[13px] font-medium ${
                  active
                    ? "border-[#0a84ff]/45 bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] text-white shadow-[0_8px_20px_rgba(0,113,227,0.24)]"
                    : "border-black/12 bg-white/72 text-black/72 active:bg-black/[0.03]"
                }`}
              >
                {getMobileCategoryLabel(item)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 rounded-[24px] border border-black/10 bg-white/82 p-4 shadow-[0_12px_30px_rgba(20,39,73,0.08)] backdrop-blur">
        <label htmlFor="compare-library-search" className="text-[12px] font-medium text-black/54">
          搜索产品
        </label>
        <div className="mt-2">
          <input
            id="compare-library-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="输入品牌、产品名或功效关键词"
            className="m-compare-upload-input h-11 w-full rounded-2xl border px-4 text-[14px] outline-none"
          />
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {collectionFilters.map((item) => {
            const active = item.key === collection;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setCollection(item.key)}
                className={`m-compare-recommend-meta-chip shrink-0 ${active ? "border-[#0a84ff]/38 bg-[#eaf3ff] text-[#1f5fb9] dark:border-[#69adff]/45 dark:bg-[#264570]/66 dark:text-[#c6e1ff]" : ""}`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="mt-3 text-[12px] text-black/56">
          共 {filteredItems.length} 款可选，已选 {selectedIds.length}/{MAX_TOTAL_SELECTION}
        </div>
      </div>

      {notice ? (
        <div className="mt-3 rounded-xl border border-[#ffd596]/70 bg-[#fff6e6] px-3 py-2 text-[12px] text-[#8b5a12] dark:border-[#c99345]/58 dark:bg-[#4f391b]/60 dark:text-[#ffdca3]">
          {notice}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-4 text-[13px] text-black/56">正在加载产品库...</div>
      ) : error ? (
        <div className="mt-4 rounded-2xl border border-[#ff8f8f]/45 bg-[#ff5f5f]/10 px-4 py-3 text-[13px] text-[#b53a3a] dark:border-[#ff8f8f]/35 dark:bg-[#5a1f26]/45 dark:text-[#ffd1d1]">
          {error}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="mt-4 rounded-[24px] border border-black/10 bg-white/75 px-4 py-5 text-[13px] text-black/58">
          当前筛选下没有匹配产品，换个集合或关键词再试试。
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {filteredItems.map((item) => {
            const selected = selectedSet.has(item.productId);
            const image = resolveProductImage(item.raw.product.image_url);
            const blocked = !selected && selectedIds.length >= MAX_TOTAL_SELECTION;
            return (
              <button
                key={item.productId}
                type="button"
                onClick={() => toggleProduct(item.productId)}
                className={`m-compare-product-card m-compare-product-card-press m-pressable relative flex flex-col rounded-[22px] border px-2.5 pb-2.5 pt-3 text-left ${
                  selected ? "m-compare-product-card-selected" : "m-compare-product-card-default"
                } ${blocked ? "opacity-60" : "active:scale-[0.985]"}`}
                aria-pressed={selected}
              >
                <div className="relative h-[94px] w-full overflow-hidden rounded-[16px] bg-[linear-gradient(148deg,#f4f6fb,#d9e3f1)]">
                  {image ? (
                    <Image src={image} alt={item.title} fill sizes="220px" className="object-contain p-2" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[11px] text-black/35">无图</div>
                  )}
                  <div
                    className={`m-compare-check absolute right-1 top-1 z-[3] inline-flex h-7 w-7 items-center justify-center rounded-full border ${
                      selected ? "m-compare-check-selected" : "m-compare-check-unselected"
                    }`}
                    aria-hidden
                  >
                    <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full text-[11px] leading-none">✓</span>
                  </div>
                </div>

                <div className="mt-2 min-h-[64px]">
                  <div className="mb-1.5 flex flex-wrap gap-1.5">
                    {item.raw.is_recommendation ? (
                      <span className="m-compare-badge m-compare-badge-reco inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-semibold">
                        与你更匹配
                      </span>
                    ) : null}
                    {item.raw.is_most_used || item.raw.usage_count > 0 ? (
                      <span className="m-compare-badge m-compare-badge-most-sub inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-semibold">
                        高复购
                      </span>
                    ) : null}
                  </div>
                  <div className="line-clamp-2 text-[13px] leading-[1.3] font-medium text-black/86">{item.title}</div>
                  {item.subtitle ? <div className="mt-1 line-clamp-2 text-[11px] leading-[1.5] text-black/55">{item.subtitle}</div> : null}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div
        className="sticky z-40 mt-5"
        style={{ bottom: "calc(88px + max(env(safe-area-inset-bottom), 0px) + var(--m-chrome-bottom-inset))" }}
      >
        <div className="rounded-[26px] border border-black/10 bg-[rgba(245,248,255,0.82)] p-3 shadow-[0_20px_44px_rgba(20,39,73,0.12)] backdrop-blur-[18px]">
          <div className="text-[12px] font-medium text-black/56">至少带回 2 款即可继续对比</div>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => goBackToCompare(false)}
              className="inline-flex h-11 items-center justify-center rounded-full border border-black/12 bg-white px-4 text-[14px] font-medium text-black/72 active:bg-black/[0.03]"
            >
              仅返回
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedIds.length < 2) {
                  setNotice("请至少选择 2 款产品再带回。");
                  return;
                }
                goBackToCompare(true);
              }}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-5 text-[15px] font-semibold text-white shadow-[0_10px_24px_rgba(0,113,227,0.28)]"
            >
              带回对比（{selectedIds.length}）
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function MobileCompareLibraryPageFallback() {
  return <section className="m-compare-page pb-10" />;
}

export default function MobileCompareLibraryPage() {
  return (
    <Suspense fallback={<MobileCompareLibraryPageFallback />}>
      <MobileCompareLibraryPageContent />
    </Suspense>
  );
}
