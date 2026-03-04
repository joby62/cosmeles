"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AddToBagButton from "@/components/mobile/AddToBagButton";
import {
  fetchIngredientLibrary,
  fetchMobileWikiProducts,
  type IngredientLibraryListItem,
  type MobileSelectionCategory,
  type MobileWikiProductItem,
} from "@/lib/api";
import { WIKI_MAP, WIKI_ORDER, type WikiCategoryKey } from "@/lib/mobile/ingredientWiki";

const CATEGORY_LABEL: Record<MobileSelectionCategory, string> = {
  shampoo: "洗发水",
  bodywash: "沐浴露",
  conditioner: "护发素",
  lotion: "润肤霜",
  cleanser: "洗面奶",
};

type WikiTab = "product" | "ingredient";

function normalizeLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function summaryFocus(summary: string | null | undefined): string {
  const text = normalizeLine(summary || "");
  if (!text) return "暂无关键结论";
  const first = text.split(/[。！？!?.]/).map((part) => part.trim()).find(Boolean) || text;
  return first.length > 34 ? `${first.slice(0, 33)}…` : first;
}

function routeTag(item: MobileWikiProductItem): string {
  if (item.target_type_title) return item.target_type_title;
  if (item.mapping_ready) return "一级类目";
  return "未完成类型映射";
}

export default function MobileWikiPage() {
  const [tab, setTab] = useState<WikiTab>("product");

  const [productCategory, setProductCategory] = useState<"all" | MobileSelectionCategory>("all");
  const [productSubtype, setProductSubtype] = useState("all");
  const [productQuery, setProductQuery] = useState("");
  const [productLoading, setProductLoading] = useState(true);
  const [productError, setProductError] = useState<string | null>(null);
  const [productItems, setProductItems] = useState<MobileWikiProductItem[]>([]);
  const [productCategoryOptions, setProductCategoryOptions] = useState<Array<{ key: string; label: string; count: number }>>([]);
  const [productSubtypeOptions, setProductSubtypeOptions] = useState<Array<{ key: string; label: string; count: number }>>([]);

  const [ingredientCategory, setIngredientCategory] = useState<WikiCategoryKey>("shampoo");
  const [ingredientQuery, setIngredientQuery] = useState("");
  const [ingredientLoading, setIngredientLoading] = useState(false);
  const [ingredientError, setIngredientError] = useState<string | null>(null);
  const [ingredientItems, setIngredientItems] = useState<IngredientLibraryListItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (tab !== "product") return;

    void fetchMobileWikiProducts({
      category: productCategory === "all" ? undefined : productCategory,
      target_type_key: productSubtype === "all" ? undefined : productSubtype,
      q: productQuery.trim() || undefined,
      offset: 0,
      limit: 120,
    })
      .then((resp) => {
        if (cancelled) return;
        setProductItems(resp.items || []);
        setProductCategoryOptions(resp.categories || []);
        setProductSubtypeOptions(resp.subtypes || []);
      })
      .catch((err) => {
        if (cancelled) return;
        setProductItems([]);
        setProductCategoryOptions([]);
        setProductSubtypeOptions([]);
        setProductError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setProductLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tab, productCategory, productSubtype, productQuery]);

  useEffect(() => {
    let cancelled = false;
    if (tab !== "ingredient") return;

    void fetchIngredientLibrary({
      category: ingredientCategory,
      q: ingredientQuery.trim() || undefined,
      offset: 0,
      limit: 120,
    })
      .then((resp) => {
        if (cancelled) return;
        setIngredientItems(resp.items || []);
      })
      .catch((err) => {
        if (cancelled) return;
        setIngredientItems([]);
        setIngredientError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setIngredientLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tab, ingredientCategory, ingredientQuery]);

  const canShowSubtype = useMemo(
    () => productCategory === "shampoo" || productCategory === "bodywash",
    [productCategory],
  );

  return (
    <section className="m-wiki-page -mx-4 -mt-6 min-h-[calc(100dvh-3rem)] bg-[color:var(--m-wiki-canvas)] px-4 pb-36 pt-4 text-white">
      <div className="m-wiki-card rounded-[24px] p-3 backdrop-blur-xl">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setTab("product");
              setProductLoading(true);
              setProductError(null);
            }}
            className={`m-pressable h-10 rounded-2xl border text-[14px] font-semibold ${
              tab === "product"
                ? "border-white/35 bg-white/16 text-white"
                : "border-white/12 bg-white/[0.03] text-white/72 active:bg-white/[0.08]"
            }`}
          >
            产品百科
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("ingredient");
              setIngredientLoading(true);
              setIngredientError(null);
            }}
            className={`m-pressable h-10 rounded-2xl border text-[14px] font-semibold ${
              tab === "ingredient"
                ? "border-white/35 bg-white/16 text-white"
                : "border-white/12 bg-white/[0.03] text-white/72 active:bg-white/[0.08]"
            }`}
          >
            成分百科
          </button>
        </div>

        <div className="mt-3 flex h-11 items-center rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
          <input
            value={tab === "product" ? productQuery : ingredientQuery}
            onChange={(e) => {
              if (tab === "product") {
                setProductLoading(true);
                setProductError(null);
                setProductQuery(e.target.value);
                return;
              }
              setIngredientLoading(true);
              setIngredientError(null);
              setIngredientQuery(e.target.value);
            }}
            placeholder={tab === "product" ? "搜索产品名/品牌" : "搜索成分名称"}
            className="h-full w-full bg-transparent text-[16px] text-white/92 outline-none placeholder:text-white/36"
          />
          {tab === "product" && productQuery ? (
            <button
              type="button"
              onClick={() => {
                setProductLoading(true);
                setProductError(null);
                setProductQuery("");
              }}
              className="m-pressable rounded-full bg-white/10 px-2.5 py-1 text-[12px] text-white/72 active:bg-white/18"
            >
              清除
            </button>
          ) : null}
          {tab === "ingredient" && ingredientQuery ? (
            <button
              type="button"
              onClick={() => {
                setIngredientLoading(true);
                setIngredientError(null);
                setIngredientQuery("");
              }}
              className="m-pressable rounded-full bg-white/10 px-2.5 py-1 text-[12px] text-white/72 active:bg-white/18"
            >
              清除
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-5">
        <p className="m-wiki-kicker text-[13px] text-[#4ea0ff]">知识中心</p>
        <h1 data-m-large-title={tab === "product" ? "产品百科" : "成分百科"} className="mt-1 text-[34px] leading-[1.08] font-semibold tracking-[-0.03em]">
          {tab === "product" ? "产品百科" : "成分百科"}
        </h1>
        <p className="mt-1 text-[15px] leading-[1.52] text-white/66">
          {tab === "product"
            ? "先看类目与细分类，再看每个产品的映射类型与是否主推。"
            : "按品类查看成分解析，了解功效、风险与适配人群。"}
        </p>
      </div>

      {tab === "product" ? (
        <section className="mt-4 space-y-4">
          <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-w-max gap-2">
              <button
                type="button"
                onClick={() => {
                  setProductLoading(true);
                  setProductError(null);
                  setProductCategory("all");
                  setProductSubtype("all");
                }}
                className={`m-pressable inline-flex h-8 items-center rounded-full border px-3 text-[12px] ${
                  productCategory === "all"
                    ? "border-white/35 bg-white/16 text-white"
                    : "border-white/12 bg-white/[0.03] text-white/72 active:bg-white/[0.08]"
                }`}
              >
                全部
              </button>
              {productCategoryOptions.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setProductLoading(true);
                    setProductError(null);
                    setProductCategory(item.key as MobileSelectionCategory);
                    setProductSubtype("all");
                  }}
                  className={`m-pressable inline-flex h-8 items-center rounded-full border px-3 text-[12px] ${
                    productCategory === item.key
                      ? "border-white/35 bg-white/16 text-white"
                      : "border-white/12 bg-white/[0.03] text-white/72 active:bg-white/[0.08]"
                  }`}
                >
                  {item.label} ({item.count})
                </button>
              ))}
            </div>
          </div>

          {canShowSubtype ? (
            <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-w-max gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setProductLoading(true);
                    setProductError(null);
                    setProductSubtype("all");
                  }}
                  className={`m-pressable inline-flex h-8 items-center rounded-full border px-3 text-[12px] ${
                    productSubtype === "all"
                      ? "border-white/35 bg-white/16 text-white"
                      : "border-white/12 bg-white/[0.03] text-white/72 active:bg-white/[0.08]"
                  }`}
                >
                  全部细分
                </button>
                {productSubtypeOptions.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setProductLoading(true);
                      setProductError(null);
                      setProductSubtype(item.key);
                    }}
                    className={`m-pressable inline-flex h-8 items-center rounded-full border px-3 text-[12px] ${
                      productSubtype === item.key
                        ? "border-white/35 bg-white/16 text-white"
                        : "border-white/12 bg-white/[0.03] text-white/72 active:bg-white/[0.08]"
                    }`}
                  >
                    {item.label} ({item.count})
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {productLoading ? (
            <article className="m-wiki-card-soft rounded-[22px] px-4 py-4 text-[14px] text-white/66">正在加载产品百科...</article>
          ) : null}

          {productError ? (
            <article className="rounded-[22px] border border-[#ff8f8f]/45 bg-[#ff5f5f]/10 px-4 py-4 text-[13px] leading-[1.55] text-[#ffc9c9]">
              产品百科加载失败：{productError}
            </article>
          ) : null}

          {!productLoading && !productError && productItems.length === 0 ? (
            <article className="m-wiki-card-soft rounded-[22px] px-4 py-4 text-[14px] text-white/66">当前筛选无产品。</article>
          ) : null}

          {!productLoading && !productError
            ? productItems.map((item) => {
                const p = item.product;
                const categoryLabel = CATEGORY_LABEL[p.category as MobileSelectionCategory] || item.category_label || p.category;
                return (
                  <article key={p.id} className="m-wiki-card-soft overflow-hidden rounded-[22px] border border-white/10 bg-black/18">
                    <Link href={`/m/wiki/product/${encodeURIComponent(p.id)}`} className="block px-4 pt-4">
                      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/12 bg-black/20">
                        <Image
                          src={p.image_url || `/images/${p.id}.png`}
                          alt={p.name || p.id}
                          fill
                          sizes="100vw"
                          className="object-cover"
                        />
                      </div>
                    </Link>

                    <div className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/16 bg-white/[0.06] px-2.5 py-0.5 text-[11px] text-white/76">
                          {categoryLabel}
                        </span>
                        <span className="rounded-full border border-[#cfe2ff]/45 bg-[#244f9e]/25 px-2.5 py-0.5 text-[11px] text-[#dbe9ff]">
                          {routeTag(item)}
                        </span>
                        {item.is_featured ? (
                          <span className="rounded-full border border-[#1f7a45]/45 bg-[#116a3f]/30 px-2.5 py-0.5 text-[11px] text-[#c6f2d8]">
                            当前主推
                          </span>
                        ) : null}
                      </div>

                      <Link href={`/m/wiki/product/${encodeURIComponent(p.id)}`} className="block">
                        <h2 className="mt-2 text-[20px] leading-[1.25] font-semibold tracking-[-0.02em] text-white/92">
                          {p.name || "未命名产品"}
                        </h2>
                        <p className="mt-1 text-[13px] text-white/62">{p.brand || "品牌未识别"}</p>
                        <p className="mt-2 line-clamp-2 text-[13px] leading-[1.55] text-white/70">
                          {summaryFocus(p.one_sentence)}
                        </p>
                      </Link>

                      <div className="mt-3">
                        <AddToBagButton productId={p.id} compact />
                      </div>
                    </div>
                  </article>
                );
              })
            : null}
        </section>
      ) : (
        <section className="mt-4 space-y-4">
          <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-w-max gap-2">
              {WIKI_ORDER.map((key) => {
                const category = WIKI_MAP[key];
                const active = ingredientCategory === key;
                return (
                  <button
                    key={category.key}
                    type="button"
                    onClick={() => {
                      setIngredientLoading(true);
                      setIngredientError(null);
                      setIngredientCategory(key);
                    }}
                    className={`m-pressable inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] ${
                      active
                        ? "border-white/35 bg-white/16 text-white"
                        : "border-white/12 bg-white/[0.03] text-white/72 active:bg-white/[0.08]"
                    }`}
                  >
                    <Image
                      src={`/m/categories/${category.key}.png`}
                      alt={category.label}
                      width={18}
                      height={18}
                      className="h-[18px] w-[18px] rounded-full object-cover"
                    />
                    {category.label}
                  </button>
                );
              })}
            </div>
          </div>

          {ingredientLoading ? (
            <article className="m-wiki-card-soft rounded-[22px] px-4 py-4 text-[14px] text-white/66">正在加载成分百科...</article>
          ) : null}

          {ingredientError ? (
            <article className="rounded-[22px] border border-[#ff8f8f]/45 bg-[#ff5f5f]/10 px-4 py-4 text-[13px] leading-[1.55] text-[#ffc9c9]">
              成分百科加载失败：{ingredientError}
            </article>
          ) : null}

          {!ingredientLoading && !ingredientError && ingredientItems.length === 0 ? (
            <article className="m-wiki-card-soft rounded-[22px] px-4 py-4 text-[14px] text-white/66">当前分类暂无已生成成分。</article>
          ) : null}

          {!ingredientLoading && !ingredientError
            ? ingredientItems.map((item) => (
                <Link
                  key={item.ingredient_id}
                  href={`/m/wiki/${ingredientCategory}/${item.ingredient_id}`}
                  className="m-wiki-card-soft block rounded-[22px] border border-white/10 bg-black/18 px-4 py-3 active:scale-[0.998]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="line-clamp-2 text-[18px] leading-[1.25] font-semibold text-white/92">{item.ingredient_name}</h2>
                    <span className="shrink-0 rounded-full border border-white/14 bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/72">
                      样本 {item.source_count}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[13px] leading-[1.55] text-white/70">{summaryFocus(item.summary)}</p>
                </Link>
              ))
            : null}
        </section>
      )}
    </section>
  );
}
