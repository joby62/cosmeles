"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IngredientLibraryListItem,
  Product,
  ProductRouteMappingIndexItem,
  deleteIngredientLibraryBatch,
  fetchIngredientLibrary,
} from "@/lib/api";
import { CATEGORY_CONFIG } from "@/lib/catalog";

type CategorySummary = {
  category: string;
  product_count: number;
  ingredient_count: number;
  top_ingredients: Array<{ ingredient_id: string; name: string; source_count: number }>;
  subtype_summaries: SubtypeSummary[];
};

type SubtypeSummary = {
  key: string;
  title: string;
  product_count: number;
  ingredient_count: number;
  top_ingredients: Array<{ ingredient_id: string; name: string; product_count: number }>;
  top_products: Array<{ product_id: string; title: string; ingredient_count: number }>;
};

type TopIngredient = { ingredient_id: string; name: string; source_count: number };
type SubtypeBucket = {
  title: string;
  productSet: Set<string>;
  ingredientIdSet: Set<string>;
  ingredientCoverage: Map<string, { name: string; productSet: Set<string> }>;
  productIngredientCount: Map<string, number>;
};
type CategoryBucket = {
  productSet: Set<string>;
  topIngredients: TopIngredient[];
  subtypeBuckets: Map<string, SubtypeBucket>;
};

const PAGE_LIMIT = 500;
const MAX_SCAN_PAGES = 2000;

export default function IngredientCleanupWorkbench({
  initialProducts,
  initialRouteMappings,
}: {
  initialProducts: Product[];
  initialRouteMappings: ProductRouteMappingIndexItem[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allIngredients, setAllIngredients] = useState<IngredientLibraryListItem[]>([]);
  const [showDetails, setShowDetails] = useState(false);

  const [detailQuery, setDetailQuery] = useState("");
  const [detailCategory, setDetailCategory] = useState("");
  const [detailSubtype, setDetailSubtype] = useState("");
  const [selectedIngredientIds, setSelectedIngredientIds] = useState<string[]>([]);
  const [removeArtifacts, setRemoveArtifacts] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteSummary, setDeleteSummary] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);

  const productById = useMemo(() => {
    const map = new Map<string, Product>();
    for (const item of initialProducts) {
      map.set(item.id, item);
    }
    return map;
  }, [initialProducts]);

  const routeByProductId = useMemo(() => {
    const map = new Map<string, ProductRouteMappingIndexItem>();
    for (const item of initialRouteMappings) {
      const productId = String(item.product_id || "").trim();
      const routeKey = String(item.primary_route_key || "").trim();
      if (!productId || !routeKey) continue;
      map.set(productId, item);
    }
    return map;
  }, [initialRouteMappings]);

  const loadAllIngredients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let offset = 0;
      let total = Number.POSITIVE_INFINITY;
      const rows: IngredientLibraryListItem[] = [];
      let page = 0;
      while (offset < total && page < MAX_SCAN_PAGES) {
        const resp = await fetchIngredientLibrary({ offset, limit: PAGE_LIMIT });
        const items = resp.items || [];
        total = Number(resp.total || 0);
        rows.push(...items);
        if (items.length === 0) break;
        offset += items.length;
        page += 1;
      }
      if (offset < total) {
        throw new Error(
          `[stage=ingredient_cleanup_load_all] ingredient pages exceeded limit ${MAX_SCAN_PAGES}, loaded=${offset}, total=${total}`,
        );
      }
      setAllIngredients(dedupeIngredients(rows));
    } catch (err) {
      setError(formatErrorDetail(err));
      setAllIngredients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAllIngredients();
  }, [loadAllIngredients]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const item of initialProducts) {
      const category = String(item.category || "").trim().toLowerCase();
      if (category) set.add(category);
    }
    for (const item of allIngredients) {
      const category = String(item.category || "").trim().toLowerCase();
      if (category) set.add(category);
    }
    return Array.from(set).sort();
  }, [allIngredients, initialProducts]);

  const subtypeOptionsByCategory = useMemo(() => {
    const out = new Map<string, Array<{ key: string; title: string; count: number }>>();
    const bucket = new Map<string, Map<string, { title: string; count: number }>>();
    for (const mapping of initialRouteMappings) {
      const category = String(mapping.category || "").trim().toLowerCase();
      const key = String(mapping.primary_route_key || "").trim();
      if (!category || !key) continue;
      const title = String(mapping.primary_route_title || key).trim() || key;
      const catMap = bucket.get(category) || new Map<string, { title: string; count: number }>();
      const prev = catMap.get(key);
      catMap.set(key, { title, count: prev ? prev.count + 1 : 1 });
      bucket.set(category, catMap);
    }
    for (const [category, catMap] of bucket.entries()) {
      const arr = Array.from(catMap.entries())
        .map(([key, value]) => ({ key, title: value.title, count: value.count }))
        .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
      out.set(category, arr);
    }
    return out;
  }, [initialRouteMappings]);

  useEffect(() => {
    if (!detailCategory) {
      setDetailSubtype("");
      return;
    }
    const options = subtypeOptionsByCategory.get(detailCategory) || [];
    if (!options.some((item) => item.key === detailSubtype)) {
      setDetailSubtype("");
    }
  }, [detailCategory, detailSubtype, subtypeOptionsByCategory]);

  const summaryRows = useMemo(() => {
    const categoryBuckets = new Map<string, CategoryBucket>();

    for (const item of allIngredients) {
      const category = String(item.category || "").trim().toLowerCase() || "unknown";
      const sourceIds = uniqueTraceIds(item.source_trace_ids);
      const categoryBucket =
        categoryBuckets.get(category) ||
        {
          productSet: new Set<string>(),
          topIngredients: [] as TopIngredient[],
          subtypeBuckets: new Map<string, SubtypeBucket>(),
        };
      for (const productId of sourceIds) {
        categoryBucket.productSet.add(productId);
      }
      categoryBucket.topIngredients.push({
        ingredient_id: item.ingredient_id,
        name: ingredientDisplayName(item),
        source_count: Number(item.source_count || sourceIds.length || 0),
      });

      for (const productId of sourceIds) {
        const mapping = routeByProductId.get(productId);
        if (!mapping) continue;
        const mappedCategory = String(mapping.category || "").trim().toLowerCase();
        if (mappedCategory !== category) continue;
        const subtypeKey = String(mapping.primary_route_key || "").trim();
        if (!subtypeKey) continue;
        const subtypeTitle = String(mapping.primary_route_title || subtypeKey).trim() || subtypeKey;
        const subtypeBucket =
          categoryBucket.subtypeBuckets.get(subtypeKey) ||
          {
            title: subtypeTitle,
            productSet: new Set<string>(),
            ingredientIdSet: new Set<string>(),
            ingredientCoverage: new Map<string, { name: string; productSet: Set<string> }>(),
            productIngredientCount: new Map<string, number>(),
          };
        subtypeBucket.productSet.add(productId);
        subtypeBucket.ingredientIdSet.add(item.ingredient_id);
        const coverage =
          subtypeBucket.ingredientCoverage.get(item.ingredient_id) ||
          { name: ingredientDisplayName(item), productSet: new Set<string>() };
        coverage.productSet.add(productId);
        subtypeBucket.ingredientCoverage.set(item.ingredient_id, coverage);
        subtypeBucket.productIngredientCount.set(productId, (subtypeBucket.productIngredientCount.get(productId) || 0) + 1);
        categoryBucket.subtypeBuckets.set(subtypeKey, subtypeBucket);
      }

      categoryBuckets.set(category, categoryBucket);
    }

    const rows: CategorySummary[] = [];
    for (const [category, bucket] of categoryBuckets.entries()) {
      const topIngredients = dedupeTopIngredients(bucket.topIngredients).slice(0, 8);
      const subtypeSummaries: SubtypeSummary[] = [];
      for (const [subtypeKey, subtype] of bucket.subtypeBuckets.entries()) {
        const topSubIngredients = Array.from(subtype.ingredientCoverage.entries())
          .map(([ingredientId, value]) => ({
            ingredient_id: ingredientId,
            name: value.name,
            product_count: value.productSet.size,
          }))
          .sort((a, b) => b.product_count - a.product_count || a.name.localeCompare(b.name))
          .slice(0, 6);
        const topProducts = Array.from(subtype.productIngredientCount.entries())
          .map(([productId, ingredientCount]) => ({
            product_id: productId,
            ingredient_count: ingredientCount,
            title: productTitle(productById.get(productId), productId),
          }))
          .sort((a, b) => b.ingredient_count - a.ingredient_count || a.title.localeCompare(b.title))
          .slice(0, 8);
        subtypeSummaries.push({
          key: subtypeKey,
          title: subtype.title,
          product_count: subtype.productSet.size,
          ingredient_count: subtype.ingredientIdSet.size,
          top_ingredients: topSubIngredients,
          top_products: topProducts,
        });
      }
      subtypeSummaries.sort((a, b) => b.product_count - a.product_count || a.title.localeCompare(b.title));
      rows.push({
        category,
        product_count: bucket.productSet.size,
        ingredient_count: topIngredients.length > 0 ? dedupeTopIngredients(bucket.topIngredients).length : 0,
        top_ingredients: topIngredients,
        subtype_summaries: subtypeSummaries,
      });
    }
    rows.sort((a, b) => b.product_count - a.product_count || a.category.localeCompare(b.category));
    return rows;
  }, [allIngredients, productById, routeByProductId]);

  const filteredIngredients = useMemo(() => {
    const query = detailQuery.trim().toLowerCase();
    return allIngredients.filter((item) => {
      const category = String(item.category || "").trim().toLowerCase();
      if (detailCategory && category !== detailCategory) return false;
      if (detailSubtype) {
        const sourceIds = uniqueTraceIds(item.source_trace_ids);
        const hit = sourceIds.some((id) => {
          const mapping = routeByProductId.get(id);
          if (!mapping) return false;
          const mappedCategory = String(mapping.category || "").trim().toLowerCase();
          const mappedKey = String(mapping.primary_route_key || "").trim();
          return mappedCategory === category && mappedKey === detailSubtype;
        });
        if (!hit) return false;
      }
      if (!query) return true;
      const haystack = `${item.ingredient_name} ${item.ingredient_name_en || ""} ${item.summary}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [allIngredients, detailCategory, detailQuery, detailSubtype, routeByProductId]);

  const selectedSet = useMemo(() => new Set(selectedIngredientIds), [selectedIngredientIds]);
  const subtypeOptions = detailCategory ? subtypeOptionsByCategory.get(detailCategory) || [] : [];

  function toggleIngredientSelection(ingredientId: string, checked: boolean) {
    setSelectedIngredientIds((prev) => {
      if (checked) return Array.from(new Set([...prev, ingredientId]));
      return prev.filter((id) => id !== ingredientId);
    });
  }

  function selectAllFiltered() {
    setSelectedIngredientIds((prev) => Array.from(new Set([...prev, ...filteredIngredients.map((item) => item.ingredient_id)])));
  }

  function clearSelection() {
    setSelectedIngredientIds([]);
  }

  async function deleteSelectedIngredients() {
    if (selectedIngredientIds.length === 0) {
      setDeleteSummary("当前没有勾选成分。");
      return;
    }
    setDeleting(true);
    setDeleteSummary(null);
    setDeleteError(null);
    try {
      const result = await deleteIngredientLibraryBatch({
        ingredient_ids: selectedIngredientIds,
        remove_doubao_artifacts: removeArtifacts,
      });
      setDeleteSummary(`清理完成：删除 ${result.deleted_ids.length} 条，缺失 ${result.missing_ids.length} 条，失败 ${result.failed_items.length} 条。`);
      if (result.failed_items.length > 0) {
        setDeleteError(result.failed_items.slice(0, 8).map((item) => `${item.ingredient_id}: ${item.error}`).join("\n"));
      }
      setSelectedIngredientIds([]);
      await loadAllIngredients();
      router.refresh();
    } catch (err) {
      setDeleteError(formatErrorDetail(err));
    } finally {
      setDeleting(false);
    }
  }

  async function exportAllCsv() {
    if (allIngredients.length === 0) {
      setError("[stage=ingredient_cleanup_export] no ingredients loaded to export.");
      return;
    }
    setExportingCsv(true);
    setError(null);
    try {
      const csv = buildFullIngredientCsv(allIngredients, routeByProductId);
      const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
      const href = window.URL.createObjectURL(blob);
      const now = new Date();
      const stamp = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
        String(now.getHours()).padStart(2, "0"),
        String(now.getMinutes()).padStart(2, "0"),
        String(now.getSeconds()).padStart(2, "0"),
      ].join("");
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `ingredient_cleanup_full_${stamp}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(href);
    } catch (err) {
      setError(formatErrorDetail(err));
    } finally {
      setExportingCsv(false);
    }
  }

  return (
    <section className="mt-8 rounded-[30px] border border-black/10 bg-white p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/62">
          Stage E · 成分清理
        </span>
      </div>
      <h2 className="mt-3 text-[28px] font-semibold tracking-[-0.02em] text-black/90">成分清理台</h2>
      <p className="mt-2 text-[14px] text-black/65">默认展示摘要；按需展开成分明细并批量清理。映射可用时自动展示二级分类简况与产品使用排行。</p>

      <div className="mt-4 rounded-2xl border border-black/10 bg-[#f8fafc] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadAllIngredients()}
            disabled={loading}
            className="inline-flex h-9 items-center justify-center rounded-full border border-black/14 bg-white px-4 text-[12px] font-semibold text-black/78 disabled:opacity-45"
          >
            {loading ? "刷新中..." : "刷新摘要"}
          </button>
          <button
            type="button"
            onClick={() => setShowDetails((prev) => !prev)}
            className="inline-flex h-9 items-center justify-center rounded-full border border-black/14 bg-white px-4 text-[12px] font-semibold text-black/78"
          >
            {showDetails ? "隐藏成分明细" : "显示成分明细"}
          </button>
          <button
            type="button"
            onClick={() => void exportAllCsv()}
            disabled={loading || exportingCsv || allIngredients.length === 0}
            className="inline-flex h-9 items-center justify-center rounded-full border border-black/14 bg-white px-4 text-[12px] font-semibold text-black/78 disabled:opacity-45"
            title="导出全量成分 CSV（不受当前摘要/筛选影响）"
          >
            {exportingCsv ? "导出中..." : "导出全量 CSV"}
          </button>
          <span className="text-[12px] text-black/58">成分总数 {allIngredients.length} 条</span>
        </div>

        {error ? <div className="mt-2 text-[13px] text-[#b42318]">{error}</div> : null}

        <div className="mt-3 grid grid-cols-1 gap-2 xl:grid-cols-2">
          {summaryRows.map((row) => (
            <div key={row.category} className="rounded-xl border border-black/10 bg-white p-3">
              <div className="text-[13px] font-semibold text-black/84">
                {categoryLabel(row.category)} · 产品 {row.product_count} · 唯一成分 {row.ingredient_count}
              </div>
              <div className="mt-1 text-[12px] text-black/62">
                一级 Top：{row.top_ingredients.slice(0, 4).map((item) => `${item.name}(${item.source_count})`).join(" · ") || "-"}
              </div>

              {row.subtype_summaries.length > 0 ? (
                <details className="mt-2 rounded-lg border border-black/8 bg-[#fbfcff] p-2">
                  <summary className="cursor-pointer text-[12px] font-semibold text-[#3151d8]">二级分类简况（已建立映射）</summary>
                  <div className="mt-2 space-y-2">
                    {row.subtype_summaries.slice(0, 6).map((sub) => (
                      <div key={`${row.category}-${sub.key}`} className="rounded-lg border border-black/8 bg-white p-2">
                        <div className="text-[12px] font-semibold text-black/82">
                          {sub.title} · 产品 {sub.product_count} · 成分 {sub.ingredient_count}
                        </div>
                        <div className="mt-0.5 text-[11px] text-black/58">
                          Top 成分：{sub.top_ingredients.slice(0, 3).map((item) => `${item.name}(${item.product_count})`).join(" · ") || "-"}
                        </div>
                        <div className="mt-0.5 text-[11px] text-black/58">
                          产品使用最多：{sub.top_products.slice(0, 3).map((item, idx) => `#${idx + 1} ${item.title}(${item.ingredient_count})`).join(" · ") || "-"}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              ) : (
                <div className="mt-2 text-[11px] text-black/52">二级映射未建立，当前仅展示一级分类摘要。</div>
              )}
            </div>
          ))}
          {!loading && summaryRows.length === 0 ? <div className="text-[12px] text-black/52">暂无成分摘要数据。</div> : null}
        </div>
      </div>

      {showDetails ? (
        <div className="mt-5 rounded-2xl border border-black/10 bg-white p-4">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <input
              value={detailQuery}
              onChange={(e) => setDetailQuery(e.target.value)}
              placeholder="按成分名/摘要检索"
              className="h-10 rounded-xl border border-black/12 bg-white px-3 text-[13px] outline-none focus:border-black/35"
            />
            <select
              value={detailCategory}
              onChange={(e) => setDetailCategory(e.target.value)}
              className="h-10 rounded-xl border border-black/12 bg-white px-3 text-[13px] outline-none focus:border-black/35"
            >
              <option value="">全部一级分类</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {categoryLabel(category)}
                </option>
              ))}
            </select>
            <select
              value={detailSubtype}
              onChange={(e) => setDetailSubtype(e.target.value)}
              disabled={!detailCategory || subtypeOptions.length === 0}
              className="h-10 rounded-xl border border-black/12 bg-white px-3 text-[13px] outline-none focus:border-black/35 disabled:opacity-45"
            >
              <option value="">全部二级分类</option>
              {subtypeOptions.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.title} · {item.count}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void loadAllIngredients()}
              disabled={loading}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-black/12 bg-white px-4 text-[13px] font-semibold text-black/78 disabled:opacity-45"
            >
              {loading ? "加载中..." : "重载明细"}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={selectAllFiltered}
              className="inline-flex h-9 items-center justify-center rounded-full border border-black/12 bg-white px-4 text-[12px] font-semibold text-black/75"
            >
              勾选当前列表
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="inline-flex h-9 items-center justify-center rounded-full border border-black/12 bg-white px-4 text-[12px] font-semibold text-black/75"
            >
              清空勾选
            </button>
            <label className="inline-flex items-center gap-2 rounded-full border border-black/12 bg-white px-3 py-1.5 text-[12px] text-black/72">
              <input
                type="checkbox"
                checked={removeArtifacts}
                onChange={(e) => setRemoveArtifacts(e.target.checked)}
                className="h-4 w-4"
              />
              删除关联 doubao_runs
            </label>
            <button
              type="button"
              onClick={deleteSelectedIngredients}
              disabled={deleting || selectedIngredientIds.length === 0}
              className="inline-flex h-9 items-center justify-center rounded-full border border-[#ef4444]/40 bg-[#fff5f5] px-4 text-[12px] font-semibold text-[#b42318] disabled:opacity-50"
            >
              {deleting ? "清理中..." : `删除勾选 (${selectedIngredientIds.length})`}
            </button>
            <span className="text-[12px] text-black/58">当前筛选 {filteredIngredients.length} 条</span>
          </div>

          {deleteSummary ? <div className="mt-2 text-[13px] text-[#116a3f]">{deleteSummary}</div> : null}
          {deleteError ? <pre className="mt-2 whitespace-pre-wrap text-[12px] text-[#b42318]">{deleteError}</pre> : null}

          <div className="mt-3 max-h-[360px] space-y-2 overflow-auto pr-1">
            {filteredIngredients.map((item) => {
              const checked = selectedSet.has(item.ingredient_id);
              return (
                <label key={item.ingredient_id} className="flex items-start gap-2 rounded-lg border border-black/10 bg-[#fbfcff] p-2.5">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => toggleIngredientSelection(item.ingredient_id, e.target.checked)}
                    className="mt-1 h-4 w-4"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-black/84">{ingredientDisplayName(item)}</div>
                    <div className="truncate text-[12px] text-black/62">
                      {categoryLabel(item.category)} · source {item.source_count} · id: {item.ingredient_id}
                    </div>
                    <div className="truncate text-[12px] text-black/56">{item.summary || "-"}</div>
                  </div>
                </label>
              );
            })}
            {!loading && filteredIngredients.length === 0 ? <div className="text-[12px] text-black/52">当前筛选无成分数据。</div> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function dedupeIngredients(items: IngredientLibraryListItem[]): IngredientLibraryListItem[] {
  const map = new Map<string, IngredientLibraryListItem>();
  for (const item of items) {
    const id = String(item.ingredient_id || "").trim();
    if (!id) continue;
    if (!map.has(id)) {
      map.set(id, item);
    }
  }
  return Array.from(map.values());
}

function uniqueTraceIds(sourceTraceIds: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of sourceTraceIds || []) {
    const id = String(raw || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function dedupeTopIngredients(
  items: Array<{ ingredient_id: string; name: string; source_count: number }>,
): Array<{ ingredient_id: string; name: string; source_count: number }> {
  const map = new Map<string, { ingredient_id: string; name: string; source_count: number }>();
  for (const item of items) {
    const id = String(item.ingredient_id || "").trim();
    if (!id) continue;
    const prev = map.get(id);
    if (!prev || item.source_count > prev.source_count) {
      map.set(id, item);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.source_count - a.source_count || a.name.localeCompare(b.name));
}

function ingredientDisplayName(item: IngredientLibraryListItem): string {
  return item.ingredient_name_en ? `${item.ingredient_name} / ${item.ingredient_name_en}` : item.ingredient_name;
}

function productTitle(product: Product | undefined, fallbackId: string): string {
  if (!product) return fallbackId;
  const brand = String(product.brand || "").trim();
  const name = String(product.name || "").trim();
  if (brand && name) return `${brand} ${name}`;
  return name || brand || product.id || fallbackId;
}

function categoryLabel(category?: string | null): string {
  if (!category) return "-";
  const key = category.toLowerCase() as keyof typeof CATEGORY_CONFIG;
  return CATEGORY_CONFIG[key]?.zh || category;
}

function formatErrorDetail(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function buildFullIngredientCsv(
  items: IngredientLibraryListItem[],
  routeByProductId: Map<string, ProductRouteMappingIndexItem>,
): string {
  const headers = [
    "category",
    "ingredient_id",
    "ingredient_name_cn",
    "ingredient_name_en",
    "ingredient_name_display",
    "source_count",
    "source_product_count",
    "source_trace_ids",
    "mapped_subtype_keys",
    "mapped_subtype_titles",
    "summary",
    "generated_at",
    "storage_path",
  ];
  const lines = [headers.map(csvEscape).join(",")];
  for (const item of items) {
    const sourceIds = uniqueTraceIds(item.source_trace_ids);
    const subtypeKeys = new Set<string>();
    const subtypeTitles = new Set<string>();
    for (const sourceId of sourceIds) {
      const mapping = routeByProductId.get(sourceId);
      if (!mapping) continue;
      const key = String(mapping.primary_route_key || "").trim();
      const title = String(mapping.primary_route_title || "").trim();
      if (key) subtypeKeys.add(key);
      if (title) subtypeTitles.add(title);
    }
    const row = [
      String(item.category || ""),
      String(item.ingredient_id || ""),
      String(item.ingredient_name || ""),
      String(item.ingredient_name_en || ""),
      ingredientDisplayName(item),
      String(item.source_count || 0),
      String(sourceIds.length),
      sourceIds.join("|"),
      Array.from(subtypeKeys).sort().join("|"),
      Array.from(subtypeTitles).sort().join("|"),
      String(item.summary || ""),
      String(item.generated_at || ""),
      String(item.storage_path || ""),
    ];
    lines.push(row.map(csvEscape).join(","));
  }
  return lines.join("\n");
}

function csvEscape(value: string): string {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes("\"") || text.includes("\n") || text.includes("\r")) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}
