"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchIngredientLibrary,
  fetchMobileWikiProducts,
  resolveImageUrl,
  type IngredientLibraryListItem,
  type MobileWikiFacet,
  type MobileWikiProductItem,
} from "@/lib/api";
import { isWikiCategoryKey, WIKI_MAP, WIKI_ORDER, type WikiCategoryKey } from "@/lib/mobile/ingredientWiki";

type CategoryTheme = {
  heroClass: string;
  hazeClass: string;
  accentClass: string;
};

type NameParts = {
  main: string;
  sub: string | null;
};

type WikiEntryTab = "product" | "ingredient";

type IngredientSecondaryFilter = {
  key: string;
  label: string;
  keywords: string[];
};

type SearchParamsLike = {
  get(name: string): string | null;
} | null | undefined;

const ALL_SECONDARY_KEY = "all";

const ENTRY_TABS: Array<{ key: WikiEntryTab; label: string }> = [
  { key: "product", label: "产品" },
  { key: "ingredient", label: "成分" },
];

const CATEGORY_THEME: Record<WikiCategoryKey, CategoryTheme> = {
  shampoo: {
    heroClass:
      "bg-[radial-gradient(circle_at_25%_18%,rgba(235,250,255,0.96),rgba(186,222,238,0.9)_45%,rgba(133,181,206,0.94)_100%)]",
    hazeClass: "bg-[radial-gradient(circle_at_70%_80%,rgba(16,53,80,0.42),rgba(10,20,36,0)_64%)]",
    accentClass: "bg-[#8fd3f2]",
  },
  bodywash: {
    heroClass:
      "bg-[radial-gradient(circle_at_70%_18%,rgba(242,248,255,0.96),rgba(194,211,246,0.9)_44%,rgba(121,143,210,0.94)_100%)]",
    hazeClass: "bg-[radial-gradient(circle_at_22%_82%,rgba(28,38,92,0.42),rgba(10,20,36,0)_64%)]",
    accentClass: "bg-[#9fb5ff]",
  },
  conditioner: {
    heroClass:
      "bg-[radial-gradient(circle_at_24%_16%,rgba(248,244,255,0.97),rgba(214,198,245,0.91)_44%,rgba(152,129,216,0.94)_100%)]",
    hazeClass: "bg-[radial-gradient(circle_at_72%_82%,rgba(56,24,102,0.42),rgba(10,20,36,0)_64%)]",
    accentClass: "bg-[#bea1ff]",
  },
  lotion: {
    heroClass:
      "bg-[radial-gradient(circle_at_24%_18%,rgba(255,248,232,0.97),rgba(246,220,173,0.91)_44%,rgba(217,168,96,0.94)_100%)]",
    hazeClass: "bg-[radial-gradient(circle_at_70%_82%,rgba(90,56,18,0.4),rgba(10,20,36,0)_64%)]",
    accentClass: "bg-[#e7bd72]",
  },
  cleanser: {
    heroClass:
      "bg-[radial-gradient(circle_at_24%_18%,rgba(242,252,255,0.97),rgba(189,223,236,0.9)_44%,rgba(117,176,203,0.94)_100%)]",
    hazeClass: "bg-[radial-gradient(circle_at_72%_82%,rgba(16,66,84,0.42),rgba(10,20,36,0)_64%)]",
    accentClass: "bg-[#87c7dd]",
  },
};

const INGREDIENT_SECONDARY_FILTERS: Record<WikiCategoryKey, IngredientSecondaryFilter[]> = {
  shampoo: [
    { key: "oil-control", label: "深层控油", keywords: ["控油", "净油", "去油", "水杨酸", "锌"] },
    { key: "dandruff", label: "去屑止痒", keywords: ["去屑", "止痒", "oct", "zpt", "薄荷"] },
    { key: "soothing", label: "温和舒缓", keywords: ["舒缓", "温和", "积雪草", "泛醇", "红没药醇"] },
    { key: "strength", label: "防脱强韧", keywords: ["防脱", "强韧", "咖啡因", "生物素", "多肽"] },
    { key: "balance", label: "水油平衡", keywords: ["保湿", "平衡", "神经酰胺", "甘油", "甜菜碱"] },
  ],
  bodywash: [
    { key: "repair", label: "舒缓修护", keywords: ["修护", "舒缓", "脂类", "屏障"] },
    { key: "acne", label: "控油净痘", keywords: ["控油", "净痘", "痘", "水杨酸"] },
    { key: "renew", label: "角质更新", keywords: ["焕肤", "角质", "乳酸", "尿素"] },
    { key: "bright", label: "亮肤提光", keywords: ["亮肤", "提亮", "烟酰胺"] },
    { key: "fragrance", label: "香氛氛围", keywords: ["香氛", "留香", "香味"] },
  ],
  conditioner: [
    { key: "smooth", label: "柔顺抗躁", keywords: ["柔顺", "顺滑", "抗躁", "解结"] },
    { key: "repair", label: "结构修护", keywords: ["修护", "蛋白", "角蛋白", "修复"] },
    { key: "light", label: "轻盈蓬松", keywords: ["轻盈", "蓬松", "不压"] },
    { key: "hydrate", label: "基础保湿", keywords: ["保湿", "滋润", "泛醇"] },
    { key: "color", label: "锁色固色", keywords: ["锁色", "固色"] },
  ],
  lotion: [
    { key: "light", label: "轻盈保湿", keywords: ["轻盈", "保湿", "补水"] },
    { key: "repair", label: "重度修护", keywords: ["修护", "厚重", "屏障"] },
    { key: "renew", label: "焕肤净痘", keywords: ["焕肤", "净痘", "aha", "bha"] },
    { key: "bright", label: "亮肤提光", keywords: ["亮肤", "提亮"] },
    { key: "fragrance", label: "留香氛围", keywords: ["香氛", "留香"] },
  ],
  cleanser: [
    { key: "apg", label: "APG舒缓", keywords: ["apg", "舒缓"] },
    { key: "amino", label: "氨基酸温和", keywords: ["氨基酸", "温和"] },
    { key: "deep-clean", label: "净肤清洁", keywords: ["净肤", "清洁", "皂", "泥", "bha"] },
    { key: "polish", label: "抛光焕亮", keywords: ["酵素", "抛光", "焕亮"] },
  ],
};

function normalizeLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function splitIngredientName(raw: string): NameParts {
  const text = raw.trim();
  const idx = text.indexOf("(");
  if (idx <= 0) {
    return { main: text, sub: null };
  }
  return {
    main: text.slice(0, idx).trim(),
    sub: text.slice(idx).trim() || null,
  };
}

function summaryFocus(summary: string | null | undefined): string {
  const text = normalizeLine(summary || "");
  if (!text) return "暂无关键结论";
  const first = text.split(/[。！？!?.]/).map((part) => part.trim()).find(Boolean) || text;
  return first.length > 32 ? `${first.slice(0, 31)}…` : first;
}

function parseWikiState(searchParams: SearchParamsLike): {
  entryTab: WikiEntryTab;
  active: WikiCategoryKey;
  query: string;
  productSubtypeKey: string;
  ingredientFilterKey: string;
} {
  const tabValue = searchParams?.get("tab");
  const categoryValue = searchParams?.get("category") || "";
  return {
    entryTab: tabValue === "ingredient" ? "ingredient" : "product",
    active: isWikiCategoryKey(categoryValue) ? categoryValue : "shampoo",
    query: normalizeLine(searchParams?.get("q") || ""),
    productSubtypeKey: normalizeLine(searchParams?.get("p_sub") || "") || ALL_SECONDARY_KEY,
    ingredientFilterKey: normalizeLine(searchParams?.get("i_sub") || "") || ALL_SECONDARY_KEY,
  };
}

function buildWikiQueryString(state: {
  entryTab: WikiEntryTab;
  active: WikiCategoryKey;
  query: string;
  productSubtypeKey: string;
  ingredientFilterKey: string;
}): string {
  const params = new URLSearchParams();
  if (state.entryTab !== "product") params.set("tab", state.entryTab);
  if (state.active !== "shampoo") params.set("category", state.active);
  if (state.query.trim()) params.set("q", state.query.trim());
  if (state.productSubtypeKey !== ALL_SECONDARY_KEY) params.set("p_sub", state.productSubtypeKey);
  if (state.ingredientFilterKey !== ALL_SECONDARY_KEY) params.set("i_sub", state.ingredientFilterKey);
  return params.toString();
}

function buildReturnHref(baseHref: string, returnTo: string): string {
  return `${baseHref}?return_to=${encodeURIComponent(returnTo)}`;
}

function readStoredScroll(key: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const y = Number(raw);
    return Number.isFinite(y) ? y : null;
  } catch {
    return null;
  }
}

function writeStoredScroll(key: string, y: number): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, String(Math.max(0, Math.round(y))));
  } catch {
    // Ignore storage quota issues; state is still kept in the URL.
  }
}

function matchesIngredientSecondary(item: IngredientLibraryListItem, filter: IngredientSecondaryFilter | undefined): boolean {
  if (!filter) return true;
  const haystack = `${item.ingredient_name} ${item.ingredient_name_en || ""} ${item.summary}`.toLowerCase();
  return filter.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

function SearchIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
      <path d="M16 16L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SwitchIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path d="M7 7H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7 7L11 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 17H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M20 17L16 20.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path d="M7 7L17 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M17 7L7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function WikiPageFallback() {
  return (
    <section className="m-wiki-page -mx-4 -mt-6 min-h-[calc(100dvh-3rem)] bg-[color:var(--m-wiki-canvas)] px-4 pb-36 pt-4 text-white">
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="h-8 w-24 rounded-2xl bg-white/40" />
            <div className="h-8 w-40 rounded-full border border-[color:var(--m-wiki-border)] bg-[color:var(--m-wiki-frost)]" />
          </div>
          <div className="h-[52px] w-[52px] rounded-[26px] border border-[color:var(--m-wiki-border)] bg-[color:var(--m-wiki-frost)]" />
        </div>
        <div className="flex gap-3 overflow-hidden pb-1">
          <div className="h-[54px] w-[124px] rounded-[27px] border border-[color:var(--m-wiki-border)] bg-[color:var(--m-wiki-frost)]" />
          <div className="h-[54px] w-[124px] rounded-[27px] border border-[color:var(--m-wiki-border)] bg-[color:var(--m-wiki-frost)]" />
        </div>
      </div>
    </section>
  );
}

function MobileWikiPageContent() {
  const pathname = usePathname() || "/m/wiki";
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialState = parseWikiState(searchParams);
  const [entryTab, setEntryTab] = useState<WikiEntryTab>(() => initialState.entryTab);
  const [active, setActive] = useState<WikiCategoryKey>(() => initialState.active);
  const [query, setQuery] = useState(() => initialState.query);
  const [productSubtypeKey, setProductSubtypeKey] = useState(() => initialState.productSubtypeKey);
  const [ingredientFilterKey, setIngredientFilterKey] = useState(() => initialState.ingredientFilterKey);
  const [searchOpen, setSearchOpen] = useState(() => Boolean(initialState.query));
  const [searchFocused, setSearchFocused] = useState(false);
  const [ingredientItems, setIngredientItems] = useState<IngredientLibraryListItem[]>([]);
  const [ingredientLoading, setIngredientLoading] = useState(() => initialState.entryTab === "ingredient");
  const [ingredientError, setIngredientError] = useState<string | null>(null);
  const [productItems, setProductItems] = useState<MobileWikiProductItem[]>([]);
  const [productSubtypes, setProductSubtypes] = useState<MobileWikiFacet[]>([]);
  const [productLoading, setProductLoading] = useState(() => initialState.entryTab === "product");
  const [productError, setProductError] = useState<string | null>(null);

  const normalizedQuery = query.trim();
  const theme = CATEGORY_THEME[active];
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const hasRestoredInitialScrollRef = useRef(false);

  const stateQueryString = useMemo(
    () =>
      buildWikiQueryString({
        entryTab,
        active,
        query: normalizedQuery,
        productSubtypeKey,
        ingredientFilterKey,
      }),
    [active, entryTab, ingredientFilterKey, normalizedQuery, productSubtypeKey],
  );
  const currentQueryString = searchParams.toString();
  const returnTo = stateQueryString ? `${pathname}?${stateQueryString}` : pathname;
  const scrollStorageKey = useMemo(() => `m:wiki:scroll:${returnTo}`, [returnTo]);

  useEffect(() => {
    const nextHref = stateQueryString ? `${pathname}?${stateQueryString}` : pathname;
    const currentHref = currentQueryString ? `${pathname}?${currentQueryString}` : pathname;
    if (nextHref === currentHref) return;
    router.replace(nextHref, { scroll: false });
  }, [currentQueryString, pathname, router, stateQueryString]);

  useEffect(() => {
    if (hasRestoredInitialScrollRef.current) return;
    hasRestoredInitialScrollRef.current = true;
    const y = readStoredScroll(scrollStorageKey);
    if (!y || y < 12) return;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: y, behavior: "auto" });
    });
  }, [scrollStorageKey]);

  useEffect(() => {
    const persistScroll = () => {
      writeStoredScroll(scrollStorageKey, window.scrollY || 0);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        persistScroll();
      }
    };

    window.addEventListener("pagehide", persistScroll);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      persistScroll();
      window.removeEventListener("pagehide", persistScroll);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [scrollStorageKey]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("m-bottom-nav-yield", { detail: { active: searchOpen || searchFocused } }));
    return () => {
      window.dispatchEvent(new CustomEvent("m-bottom-nav-yield", { detail: { active: false } }));
    };
  }, [searchFocused, searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const rafId = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [searchOpen]);

  useEffect(() => {
    if (entryTab !== "product") return;
    let cancelled = false;

    fetchMobileWikiProducts({
      category: active,
      q: normalizedQuery || undefined,
      limit: 120,
    })
      .then((resp) => {
        if (cancelled) return;
        setProductItems(resp.items || []);
        setProductSubtypes(resp.subtypes || []);
      })
      .catch((e) => {
        if (cancelled) return;
        setProductItems([]);
        setProductSubtypes([]);
        setProductError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setProductLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [active, entryTab, normalizedQuery]);

  useEffect(() => {
    if (entryTab !== "ingredient") return;
    let cancelled = false;

    fetchIngredientLibrary({
      category: active,
      q: normalizedQuery || undefined,
      limit: 120,
    })
      .then((resp) => {
        if (cancelled) return;
        setIngredientItems(resp.items);
      })
      .catch((e) => {
        if (cancelled) return;
        setIngredientItems([]);
        setIngredientError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setIngredientLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [active, entryTab, normalizedQuery]);

  const sortedIngredientItems = useMemo(() => {
    return [...ingredientItems].sort((a, b) => {
      const countDiff = (b.source_count || 0) - (a.source_count || 0);
      if (countDiff !== 0) return countDiff;
      return a.ingredient_name.localeCompare(b.ingredient_name, "zh-Hans-CN");
    });
  }, [ingredientItems]);

  const ingredientSecondaryOptions = useMemo(() => {
    return [
      { key: ALL_SECONDARY_KEY, label: "全部分类" },
      ...INGREDIENT_SECONDARY_FILTERS[active].map((item) => ({
        key: item.key,
        label: item.label,
      })),
    ];
  }, [active]);

  const activeIngredientSecondary = useMemo(
    () => INGREDIENT_SECONDARY_FILTERS[active].find((item) => item.key === ingredientFilterKey),
    [active, ingredientFilterKey],
  );

  const filteredIngredientItems = useMemo(() => {
    if (ingredientFilterKey === ALL_SECONDARY_KEY) return sortedIngredientItems;
    return sortedIngredientItems.filter((item) => matchesIngredientSecondary(item, activeIngredientSecondary));
  }, [activeIngredientSecondary, ingredientFilterKey, sortedIngredientItems]);

  const productSecondaryOptions = useMemo(() => {
    const facets = productSubtypes
      .filter((item) => normalizeLine(item.label))
      .map((item) => ({
        key: item.key,
        label: item.label,
      }));
    return [{ key: ALL_SECONDARY_KEY, label: "全部分类" }, ...facets];
  }, [productSubtypes]);

  const filteredProductItems = useMemo(() => {
    if (productSubtypeKey === ALL_SECONDARY_KEY) return productItems;
    return productItems.filter((item) => {
      const targetTypeKey = normalizeLine(item.target_type_key || "");
      const secondaryTypeKey = normalizeLine(item.secondary_type_key || "");
      return targetTypeKey === productSubtypeKey || secondaryTypeKey === productSubtypeKey;
    });
  }, [productItems, productSubtypeKey]);

  const featuredProductItem = filteredProductItems[0] || null;
  const listProductItems = featuredProductItem ? filteredProductItems.slice(1) : filteredProductItems;
  const featuredProductTitle =
    featuredProductItem
      ? [featuredProductItem.product.brand, featuredProductItem.product.name].filter(Boolean).join(" ").trim() ||
        featuredProductItem.product.name ||
        "未命名产品"
      : "";
  const featuredProductHeadline = summaryFocus(featuredProductItem?.product.one_sentence);

  const featuredIngredientItem = filteredIngredientItems[0] || null;
  const featuredIngredientName = featuredIngredientItem ? splitIngredientName(featuredIngredientItem.ingredient_name) : null;
  const ingredientListItems = featuredIngredientItem ? filteredIngredientItems.slice(1) : filteredIngredientItems;

  const beginProductLoad = () => {
    setProductLoading(true);
    setProductError(null);
  };

  const beginIngredientLoad = () => {
    setIngredientLoading(true);
    setIngredientError(null);
  };

  const switchTab = (nextTab: WikiEntryTab) => {
    if (nextTab === entryTab) return;
    if (nextTab === "product") {
      beginProductLoad();
    } else {
      beginIngredientLoad();
    }
    setEntryTab(nextTab);
  };

  const switchCategory = (nextCategory: WikiCategoryKey) => {
    if (nextCategory === active) return;
    if (entryTab === "product") {
      beginProductLoad();
    } else {
      beginIngredientLoad();
    }
    setActive(nextCategory);
    setProductSubtypeKey(ALL_SECONDARY_KEY);
    setIngredientFilterKey(ALL_SECONDARY_KEY);
  };

  const clearQuery = () => {
    if (!query) return;
    if (entryTab === "product") {
      beginProductLoad();
    } else {
      beginIngredientLoad();
    }
    setQuery("");
  };

  const collapseSearch = () => {
    if (normalizedQuery) {
      clearQuery();
      return;
    }
    setSearchFocused(false);
    setSearchOpen(false);
  };

  return (
    <section className="m-wiki-page -mx-4 -mt-6 min-h-[calc(100dvh-3rem)] bg-[color:var(--m-wiki-canvas)] px-4 pb-36 pt-4 text-white">
      <div className="space-y-5">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h1 data-m-large-title="百科" className="text-[28px] leading-[1.08] font-semibold tracking-[-0.03em] text-[color:var(--m-wiki-text-strong)]">
                百科
              </h1>
              <div
                role="tablist"
                aria-label="百科类型"
                className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[color:var(--m-wiki-border)] bg-[color:var(--m-wiki-frost)] px-3 py-2 text-[13px] shadow-[0_8px_20px_rgba(16,29,52,0.05)] backdrop-blur-xl"
              >
                <SwitchIcon className="h-[15px] w-[15px] text-[color:var(--m-wiki-text-soft)]" />
                <span className="text-[12px] font-medium text-[color:var(--m-wiki-text-soft)]">切换</span>
                {ENTRY_TABS.map((tab, index) => {
                  const activeTab = tab.key === entryTab;
                  return (
                    <span key={tab.key} className="contents">
                      {index > 0 ? <span className="text-[12px] font-medium text-[color:var(--m-wiki-text-soft)]">|</span> : null}
                      <button
                        role="tab"
                        aria-selected={activeTab}
                        type="button"
                        onClick={() => {
                          switchTab(tab.key);
                        }}
                        className={`m-pressable inline-flex items-center rounded-full px-1 py-0.5 text-[14px] font-semibold tracking-[-0.01em] transition-colors ${
                          activeTab ? "text-[color:var(--m-wiki-text-strong)]" : "text-[color:var(--m-wiki-text-soft)]"
                        }`}
                      >
                        {tab.label}
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>

            <div
              className={`relative h-[52px] shrink-0 overflow-hidden rounded-[26px] transition-[width,box-shadow,border-color,background-color] duration-300 ${
                searchOpen
                  ? "m-wiki-input-shell w-[min(72vw,276px)] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_12px_30px_rgba(12,22,38,0.12)]"
                  : "w-[52px] border border-[color:var(--m-wiki-border)] bg-[color:var(--m-wiki-frost)] shadow-[0_10px_24px_rgba(16,29,52,0.06)]"
              }`}
            >
              <button
                type="button"
                aria-label="打开搜索"
                onClick={() => {
                  setSearchOpen(true);
                }}
                className={`m-pressable absolute inset-0 z-[1] flex items-center justify-center text-[color:var(--m-wiki-text-mid)] transition-opacity duration-200 ${
                  searchOpen ? "pointer-events-none opacity-0" : "opacity-100"
                }`}
              >
                <SearchIcon className="h-[18px] w-[18px]" />
              </button>

              <form
                className={`absolute inset-0 flex items-center transition-[opacity,transform] duration-200 ${
                  searchOpen ? "opacity-100" : "pointer-events-none translate-x-2 opacity-0"
                }`}
                onSubmit={(e) => {
                  e.preventDefault();
                }}
              >
                <div className="flex h-full w-full items-center gap-2 px-4">
                  <SearchIcon className="h-[18px] w-[18px] shrink-0 text-white/48" />
                  <input
                    ref={searchInputRef}
                    id="wiki-search"
                    value={query}
                    onFocus={() => {
                      setSearchFocused(true);
                    }}
                    onBlur={() => {
                      setSearchFocused(false);
                    }}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (next.trim() !== normalizedQuery) {
                        if (entryTab === "product") {
                          beginProductLoad();
                        } else {
                          beginIngredientLoad();
                        }
                      }
                      setQuery(next);
                    }}
                    placeholder="搜索产品及成分"
                    className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-white/92 outline-none placeholder:text-white/36"
                  />
                  <button
                    type="button"
                    aria-label={normalizedQuery ? "清除搜索" : "收起搜索"}
                    onClick={collapseSearch}
                    className="m-pressable flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-white/62 active:bg-white/[0.14]"
                  >
                    <CloseIcon />
                  </button>
                </div>
              </form>
            </div>
          </div>

          <section className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-w-max gap-3.5 pb-1 pt-0.5">
              {WIKI_ORDER.map((key) => {
                const item = WIKI_MAP[key];
                const activeTag = key === active;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      switchCategory(key);
                    }}
                    className={`m-wiki-category-card m-pressable relative inline-flex h-[56px] items-center gap-3.5 rounded-[28px] px-4.5 ${
                      activeTag ? "m-wiki-category-card-active" : ""
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] transition-colors ${
                        activeTag ? "bg-[rgba(10,132,255,0.12)] shadow-[inset_0_0_0_1px_rgba(10,132,255,0.08)]" : "bg-white/74"
                      }`}
                    >
                      <Image src={`/m/categories/${item.key}.png`} alt={item.label} width={22} height={22} className="h-[22px] w-[22px] rounded-[8px] object-cover" />
                    </span>
                    <span className="text-[16px] font-semibold tracking-[-0.022em]">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-w-max gap-2.5 pb-1">
              {(entryTab === "product" ? productSecondaryOptions : ingredientSecondaryOptions).map((item) => {
                const activeSecondary = entryTab === "product" ? productSubtypeKey === item.key : ingredientFilterKey === item.key;
                return (
                  <button
                    key={`${entryTab}-${item.key}`}
                    type="button"
                    onClick={() => {
                      if (entryTab === "product") {
                        setProductSubtypeKey(item.key);
                        return;
                      }
                      setIngredientFilterKey(item.key);
                    }}
                    className={`m-pressable inline-flex h-8 items-center rounded-full border px-4 text-[13px] font-medium transition-colors ${
                      activeSecondary
                        ? "border-[rgba(10,132,255,0.18)] bg-[rgba(10,132,255,0.10)] text-[#0a84ff] shadow-none"
                        : "border-[color:var(--m-wiki-border)] bg-[color:var(--m-wiki-frost)] text-[color:var(--m-wiki-text-soft)] active:bg-white/90"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <div key={entryTab} className="m-wiki-pane pt-1">
          {entryTab === "product" ? (
            <section className="space-y-4">
              {featuredProductItem ? (
                <Link
                  href={buildReturnHref(`/m/wiki/product/${encodeURIComponent(featuredProductItem.product.id)}`, returnTo)}
                  className="m-wiki-hero-card m-pressable block overflow-hidden rounded-[32px] transition-transform active:scale-[0.996]"
                >
                  <div className={`${theme.heroClass} relative overflow-hidden px-5 py-5`}>
                    <div className={`absolute inset-0 ${theme.hazeClass}`} />
                    <div className={`absolute right-[-42px] top-[-36px] h-[170px] w-[170px] rounded-full ${theme.accentClass} opacity-30 blur-3xl`} />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0)_34%,rgba(0,0,0,0.38)_100%)]" />

                    <div className="relative z-[1] flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="inline-flex rounded-full border border-white/32 bg-white/12 px-2.5 py-1 text-[12px] font-medium text-white/86 backdrop-blur-lg">
                          {featuredProductItem.target_type_title || featuredProductItem.category_label}
                        </div>
                        <p className="m-wiki-kicker mt-4 text-[12px] text-white/76">先看这款</p>
                        <h2 className="mt-1 line-clamp-2 text-[28px] leading-[1.08] font-semibold tracking-[-0.03em] text-white">
                          {featuredProductHeadline}
                        </h2>
                        <p className="mt-2 line-clamp-2 text-[14px] leading-[1.5] text-white/82">{featuredProductTitle}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className="inline-flex h-7 items-center rounded-full border border-white/20 bg-white/[0.08] px-3 text-[11px] text-white/84">
                            {featuredProductItem.mapping_ready ? "映射已完成" : "映射进行中"}
                          </span>
                          {typeof featuredProductItem.primary_confidence === "number" ? (
                            <span className="inline-flex h-7 items-center rounded-full border border-[#89c1ff]/44 bg-[#2f5e9f]/30 px-3 text-[11px] text-[#d6eaff]">
                              置信度 {featuredProductItem.primary_confidence}%
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="relative h-[96px] w-[96px] shrink-0 overflow-hidden rounded-[26px] border border-white/24 bg-white/12 shadow-[0_18px_34px_rgba(0,0,0,0.22)]">
                        <Image
                          src={resolveImageUrl(featuredProductItem.product)}
                          alt={featuredProductItem.product.name || featuredProductItem.product.id}
                          fill
                          sizes="96px"
                          className="object-cover"
                        />
                      </div>
                    </div>

                    <div className="relative z-[1] mt-5 flex items-center justify-between gap-3 rounded-[22px] border border-white/12 bg-black/24 px-4 py-3 backdrop-blur-2xl">
                      <p className="min-w-0 flex-1 text-[13px] leading-[1.45] text-white/76">查看完整分析、成分拆解与使用建议</p>
                      <span className="m-wiki-primary-cta inline-flex h-10 shrink-0 items-center rounded-full px-4 text-[14px] font-semibold">
                        查看完整分析
                      </span>
                    </div>
                  </div>
                </Link>
              ) : null}

              {listProductItems.map((item) => {
                const product = item.product;
                const productTitle = [product.brand, product.name].filter(Boolean).join(" ").trim() || product.name || "未命名产品";
                return (
                  <Link
                    key={product.id}
                    href={buildReturnHref(`/m/wiki/product/${encodeURIComponent(product.id)}`, returnTo)}
                    className="m-wiki-card-soft m-pressable group block overflow-hidden rounded-[26px] border border-white/10 px-4 py-4 transition-transform active:scale-[0.997]"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="relative h-[84px] w-[84px] shrink-0 overflow-hidden rounded-[18px] bg-white/10">
                        <Image
                          src={resolveImageUrl(product)}
                          alt={product.name || product.id}
                          fill
                          sizes="84px"
                          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap gap-1.5">
                          <span className="inline-flex h-6 items-center rounded-full border border-white/16 bg-white/[0.08] px-2.5 text-[11px] text-white/78">
                            {item.target_type_title || item.category_label}
                          </span>
                          {typeof item.primary_confidence === "number" ? (
                            <span className="inline-flex h-6 items-center rounded-full border border-[#89c1ff]/35 bg-[#2f5e9f]/24 px-2.5 text-[11px] text-[#d6eaff]">
                              {item.primary_confidence}%
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 line-clamp-2 text-[17px] leading-[1.35] font-semibold text-white/92">
                          {summaryFocus(product.one_sentence)}
                        </p>
                        <p className="mt-1 line-clamp-1 text-[13px] text-white/64">{productTitle}</p>
                        <p className="mt-2 text-[12px] text-white/54">{item.mapping_ready ? "映射已完成，可直接查看分析" : "映射尚未完成，先查看基础信息"}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}

              {productLoading ? (
                <div className="m-wiki-card-soft rounded-[24px] px-4 py-5 text-[14px] text-white/65">正在加载真实产品数据...</div>
              ) : null}

              {productError ? (
                <div className="rounded-[24px] border border-[#ff8f8f]/45 bg-[#ff5f5f]/10 px-4 py-5 text-[14px] text-[#ffd3d3]">
                  加载失败：{productError}
                </div>
              ) : null}

              {!productLoading && !productError && filteredProductItems.length === 0 ? (
                <div className="m-wiki-card-soft rounded-[24px] px-4 py-5 text-[14px] text-white/65">
                  当前分类暂无匹配产品，请调整关键词、一级分类或二级分类。
                </div>
              ) : null}
            </section>
          ) : (
            <section className="space-y-4">
              {featuredIngredientItem && featuredIngredientName ? (
                <Link
                  href={buildReturnHref(`/m/wiki/${active}/${featuredIngredientItem.ingredient_id}`, returnTo)}
                  className="m-wiki-hero-card m-pressable block overflow-hidden rounded-[32px] transition-transform active:scale-[0.996]"
                >
                  <div className={`${theme.heroClass} relative overflow-hidden px-5 py-5`}>
                    <div className={`absolute inset-0 ${theme.hazeClass}`} />
                    <div className={`absolute right-[-42px] top-[-36px] h-[170px] w-[170px] rounded-full ${theme.accentClass} opacity-30 blur-3xl`} />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0)_34%,rgba(0,0,0,0.38)_100%)]" />

                    <div className="relative z-[1] flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="inline-flex rounded-full border border-white/32 bg-white/12 px-2.5 py-1 text-[12px] font-medium text-white/86 backdrop-blur-lg">
                          {WIKI_MAP[active].label}
                        </div>
                        <p className="m-wiki-kicker mt-4 text-[12px] text-white/76">一句话重点</p>
                        <h2 className="mt-1 line-clamp-2 text-[28px] leading-[1.08] font-semibold tracking-[-0.03em] text-white">
                          {summaryFocus(featuredIngredientItem.summary)}
                        </h2>
                        <p className="mt-2 line-clamp-1 text-[15px] font-semibold text-white/88">{featuredIngredientName.main}</p>
                        {featuredIngredientName.sub ? <p className="mt-0.5 line-clamp-1 text-[13px] text-white/68">{featuredIngredientName.sub}</p> : null}
                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className="inline-flex h-7 items-center rounded-full border border-white/20 bg-white/[0.08] px-3 text-[11px] text-white/84">
                            来源样本 {featuredIngredientItem.source_count} 条
                          </span>
                        </div>
                      </div>

                      <div className="relative flex h-[82px] w-[82px] shrink-0 items-center justify-center rounded-[24px] border border-white/22 bg-white/12 shadow-[0_18px_34px_rgba(0,0,0,0.22)]">
                        <Image src={`/m/categories/${active}.png`} alt={WIKI_MAP[active].label} width={54} height={54} className="h-[54px] w-[54px] rounded-[18px] object-cover" />
                      </div>
                    </div>

                    <div className="relative z-[1] mt-5 flex items-center justify-between gap-3 rounded-[22px] border border-white/12 bg-black/24 px-4 py-3 backdrop-blur-2xl">
                      <p className="min-w-0 flex-1 text-[13px] leading-[1.45] text-white/76">先看一句话，再展开完整收益、风险与使用建议</p>
                      <span className="m-wiki-primary-cta inline-flex h-10 shrink-0 items-center rounded-full px-4 text-[14px] font-semibold">
                        查看详情
                      </span>
                    </div>
                  </div>
                </Link>
              ) : null}

              {ingredientListItems.map((item) => {
                const name = splitIngredientName(item.ingredient_name);
                return (
                  <Link
                    key={item.ingredient_id}
                    href={buildReturnHref(`/m/wiki/${active}/${item.ingredient_id}`, returnTo)}
                    className="m-wiki-card-soft m-pressable block overflow-hidden rounded-[26px] border border-white/10 px-4 py-4 transition-transform active:scale-[0.997]"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-[18px] bg-white/10">
                        <Image src={`/m/categories/${active}.png`} alt={WIKI_MAP[active].label} width={42} height={42} className="h-[42px] w-[42px] rounded-[14px] object-cover" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap gap-1.5">
                          <span className="inline-flex h-6 items-center rounded-full border border-white/16 bg-white/[0.08] px-2.5 text-[11px] text-white/78">
                            {WIKI_MAP[active].label}
                          </span>
                          <span className="inline-flex h-6 items-center rounded-full border border-white/16 bg-white/[0.08] px-2.5 text-[11px] text-white/62">
                            {item.source_count} 条样本
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-[17px] leading-[1.35] font-semibold text-white/92">
                          {summaryFocus(item.summary)}
                        </p>
                        <p className="mt-1 line-clamp-1 text-[13px] text-white/68">{name.main}</p>
                        {name.sub ? <p className="mt-0.5 line-clamp-1 text-[12px] text-white/52">{name.sub}</p> : null}
                      </div>
                    </div>
                  </Link>
                );
              })}

              {ingredientLoading ? (
                <div className="m-wiki-card-soft rounded-[24px] px-4 py-5 text-[14px] text-white/65">正在加载真实成分数据...</div>
              ) : null}

              {ingredientError ? (
                <div className="rounded-[24px] border border-[#ff8f8f]/45 bg-[#ff5f5f]/10 px-4 py-5 text-[14px] text-[#ffd3d3]">
                  加载失败：{ingredientError}
                </div>
              ) : null}

              {!ingredientLoading && !ingredientError && filteredIngredientItems.length === 0 ? (
                <div className="m-wiki-card-soft rounded-[24px] px-4 py-5 text-[14px] text-white/65">
                  当前分类暂无匹配成分，请调整关键词、一级分类或二级分类。
                </div>
              ) : null}
            </section>
          )}
        </div>
      </div>
    </section>
  );
}

export default function MobileWikiPage() {
  return (
    <Suspense fallback={<WikiPageFallback />}>
      <MobileWikiPageContent />
    </Suspense>
  );
}
