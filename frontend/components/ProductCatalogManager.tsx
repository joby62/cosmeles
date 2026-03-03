"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  Product,
  ProductFeaturedSlotItem,
  ProductRouteMappingIndexItem,
} from "@/lib/api";
import { clearProductFeaturedSlot, resolveImageUrl, setProductFeaturedSlot } from "@/lib/api";
import { CATEGORY_CONFIG } from "@/lib/catalog";

const ROUTE_MAPPED_CATEGORIES = new Set(["shampoo", "bodywash"]);
const CATEGORY_LEVEL_TARGET_KEY = "__category__";

export default function ProductCatalogManager({
  initialProducts,
  initialRouteMappings,
  initialFeaturedSlots,
}: {
  initialProducts: Product[];
  initialRouteMappings: ProductRouteMappingIndexItem[];
  initialFeaturedSlots: ProductFeaturedSlotItem[];
}) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSubtype, setSelectedSubtype] = useState<string>("all");
  const [featuredSlots, setFeaturedSlots] = useState<ProductFeaturedSlotItem[]>(initialFeaturedSlots);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const routeMappingByProductId = useMemo(() => {
    const map = new Map<string, ProductRouteMappingIndexItem>();
    for (const item of initialRouteMappings) {
      if (item.status !== "ready") continue;
      map.set(item.product_id, item);
    }
    return map;
  }, [initialRouteMappings]);

  const featuredBySlot = useMemo(() => {
    const map = new Map<string, ProductFeaturedSlotItem>();
    for (const item of featuredSlots) {
      map.set(`${item.category}::${item.target_type_key}`, item);
    }
    return map;
  }, [featuredSlots]);

  const categoryStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of initialProducts) {
      const key = String(item.category || "").trim().toLowerCase() || "unknown";
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [initialProducts]);

  const subtypeOptions = useMemo(() => {
    if (!ROUTE_MAPPED_CATEGORIES.has(selectedCategory)) return [];
    const seen = new Map<string, { title: string; count: number }>();
    for (const product of initialProducts) {
      if (String(product.category || "").trim().toLowerCase() !== selectedCategory) continue;
      const mapping = routeMappingByProductId.get(product.id);
      if (!mapping) continue;
      const key = String(mapping.primary_route_key || "").trim();
      if (!key) continue;
      const title = String(mapping.primary_route_title || key).trim();
      const prev = seen.get(key);
      if (prev) {
        prev.count += 1;
      } else {
        seen.set(key, { title, count: 1 });
      }
    }
    return Array.from(seen.entries())
      .map(([key, value]) => ({ key, title: value.title, count: value.count }))
      .sort((a, b) => b.count - a.count);
  }, [selectedCategory, initialProducts, routeMappingByProductId]);

  const filteredProducts = useMemo(() => {
    return initialProducts.filter((product) => {
      const category = String(product.category || "").trim().toLowerCase();
      if (selectedCategory !== "all" && category !== selectedCategory) return false;
      if (ROUTE_MAPPED_CATEGORIES.has(selectedCategory) && selectedSubtype !== "all") {
        const mapping = routeMappingByProductId.get(product.id);
        return String(mapping?.primary_route_key || "").trim() === selectedSubtype;
      }
      return true;
    });
  }, [initialProducts, routeMappingByProductId, selectedCategory, selectedSubtype]);

  async function markFeatured(product: Product) {
    const category = String(product.category || "").trim().toLowerCase();
    const slotKey = resolveTargetTypeKey(product, routeMappingByProductId);
    if (!category || !slotKey) {
      setError("该产品尚未形成可用映射，无法设置主推。");
      return;
    }
    const busy = `${category}::${slotKey}`;
    setBusyKey(busy);
    setError(null);
    try {
      const saved = await setProductFeaturedSlot({
        category,
        target_type_key: slotKey,
        product_id: product.id,
      });
      setFeaturedSlots((prev) => {
        const next = prev.filter((item) => !(item.category === category && item.target_type_key === slotKey));
        next.push(saved);
        return next;
      });
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusyKey(null);
    }
  }

  async function unmarkFeatured(product: Product) {
    const category = String(product.category || "").trim().toLowerCase();
    const slotKey = resolveTargetTypeKey(product, routeMappingByProductId);
    if (!category || !slotKey) return;
    const busy = `${category}::${slotKey}`;
    setBusyKey(busy);
    setError(null);
    try {
      await clearProductFeaturedSlot({
        category,
        target_type_key: slotKey,
      });
      setFeaturedSlots((prev) => prev.filter((item) => !(item.category === category && item.target_type_key === slotKey)));
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <section className="mt-8">
      <div className="rounded-[24px] border border-black/10 bg-white p-4">
        <div className="text-[14px] font-semibold text-black/84">产品展示筛选与主推配置</div>
        <p className="mt-1 text-[12px] leading-[1.55] text-black/62">
          洗发水/沐浴露支持二级子类筛选与子类主推；护发素/润肤露/洗面奶先按一级类目配置主推。mobile strict 模式下，未配置主推会直接报错。
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedCategory("all");
              setSelectedSubtype("all");
            }}
            className={tagClass(selectedCategory === "all")}
          >
            全部 ({initialProducts.length})
          </button>
          {categoryStats.map(([category, count]) => (
            <button
              key={category}
              type="button"
              onClick={() => {
                setSelectedCategory(category);
                setSelectedSubtype("all");
              }}
              className={tagClass(selectedCategory === category)}
            >
              {categoryLabel(category)} ({count})
            </button>
          ))}
        </div>

        {ROUTE_MAPPED_CATEGORIES.has(selectedCategory) ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedSubtype("all")}
              className={tagClass(selectedSubtype === "all")}
            >
              全部子类
            </button>
            {subtypeOptions.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setSelectedSubtype(item.key)}
                className={tagClass(selectedSubtype === item.key)}
              >
                {item.title} ({item.count})
              </button>
            ))}
          </div>
        ) : null}

        {error ? <div className="mt-2 text-[12px] text-[#b42318]">{error}</div> : null}
      </div>

      {filteredProducts.length === 0 ? (
        <section className="mt-5 rounded-[24px] border border-dashed border-black/16 bg-white px-6 py-10 text-center">
          <div className="text-[15px] text-black/58">当前筛选无产品。</div>
        </section>
      ) : (
        <section className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((item) => {
            const mapping = routeMappingByProductId.get(item.id);
            const slotKey = resolveTargetTypeKey(item, routeMappingByProductId);
            const category = String(item.category || "").trim().toLowerCase();
            const slot = slotKey ? featuredBySlot.get(`${category}::${slotKey}`) : undefined;
            const isFeatured = slot ? slot.product_id === item.id : false;
            const featureBusy = slotKey ? busyKey === `${category}::${slotKey}` : false;

            return (
              <article
                key={item.id}
                className={`group relative overflow-hidden rounded-[26px] border bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(0,0,0,0.08)] ${
                  isFeatured ? "border-[#1f7a45]/35" : "border-black/10 hover:border-black/16"
                }`}
              >
                <Link href={`/product/${item.id}`} className="block">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-black/8 bg-[#f6f7fb]">
                    <Image
                      src={resolveImageUrl(item)}
                      alt={item.name || item.id}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-medium text-black/64">
                        {categoryLabel(item.category)}
                      </span>
                      <span className="text-[11px] text-black/45">{formatTime(item.created_at)}</span>
                    </div>

                    <h3 className="mt-2 text-[20px] font-semibold leading-[1.25] tracking-[-0.02em] text-black/88">
                      {item.name || "未命名产品"}
                    </h3>
                    <div className="mt-1 text-[13px] text-black/56">{item.brand || "品牌未识别"}</div>
                    <p
                      className="mt-3 text-[13px] leading-[1.6] text-black/66"
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {item.one_sentence || "暂无一句话摘要，点击进入查看详细信息。"}
                    </p>
                  </div>
                </Link>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {mapping ? (
                    <>
                      <span className="rounded-full border border-[#cfe2ff] bg-[#f4f8ff] px-2 py-0.5 text-[11px] text-[#244f9e]">
                        主类：{mapping.primary_route_title}
                      </span>
                      {mapping.secondary_route_title ? (
                        <span className="rounded-full border border-[#d8f1e3] bg-[#f4fbf7] px-2 py-0.5 text-[11px] text-[#116a3f]">
                          次类：{mapping.secondary_route_title}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span className="rounded-full border border-black/12 bg-black/[0.02] px-2 py-0.5 text-[11px] text-black/56">
                      {ROUTE_MAPPED_CATEGORIES.has(category) ? "未完成类型映射" : "一级类目"}
                    </span>
                  )}
                  {isFeatured ? (
                    <span className="rounded-full border border-[#1f7a45]/40 bg-[#eaf8ef] px-2 py-0.5 text-[11px] text-[#116a3f]">
                      当前主推
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={!slotKey || featureBusy}
                    onClick={() => markFeatured(item)}
                    className="inline-flex h-8 items-center rounded-full bg-black px-3 text-[12px] font-semibold text-white disabled:bg-black/25"
                  >
                    {featureBusy ? "设置中..." : slotKey ? "设为主推" : "未映射不可设主推"}
                  </button>
                  {isFeatured ? (
                    <button
                      type="button"
                      disabled={featureBusy}
                      onClick={() => unmarkFeatured(item)}
                      className="inline-flex h-8 items-center rounded-full border border-black/14 bg-white px-3 text-[12px] font-semibold text-black/75 disabled:opacity-50"
                    >
                      取消主推
                    </button>
                  ) : null}
                </div>

                <div className="mt-3 text-[11px] text-black/38">ID: {item.id}</div>
              </article>
            );
          })}
        </section>
      )}
    </section>
  );
}

function resolveTargetTypeKey(
  product: Product,
  routeMappingByProductId: Map<string, ProductRouteMappingIndexItem>,
): string | null {
  const category = String(product.category || "").trim().toLowerCase();
  if (!category) return null;
  if (ROUTE_MAPPED_CATEGORIES.has(category)) {
    const mapping = routeMappingByProductId.get(product.id);
    const key = String(mapping?.primary_route_key || "").trim();
    return key || null;
  }
  return CATEGORY_LEVEL_TARGET_KEY;
}

function categoryLabel(category?: string | null): string {
  if (!category) return "-";
  const key = category.toLowerCase() as keyof typeof CATEGORY_CONFIG;
  return CATEGORY_CONFIG[key]?.zh || category;
}

function formatTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function tagClass(active: boolean): string {
  return `rounded-full border px-3 py-1 text-[12px] ${
    active ? "border-black bg-black text-white" : "border-black/12 bg-white text-black/68"
  }`;
}

function formatError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

