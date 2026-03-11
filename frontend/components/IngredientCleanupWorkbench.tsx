"use client";

import Link from "next/link";
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
type IngredientFilterOption = { key: string; title: string; count: number };
type IngredientTagItem = {
  ingredient_id: string;
  category: string;
  ingredient_name: string;
  ingredient_name_en?: string | null;
  source_count: number;
  href: string;
  summary: string;
  subtype_titles: string[];
};
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

  const visualizationCategoryOptions = useMemo<IngredientFilterOption[]>(() => {
    const counts = new Map<string, number>();
    for (const item of allIngredients) {
      const category = String(item.category || "").trim().toLowerCase();
      if (!category) continue;
      counts.set(category, (counts.get(category) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([key, count]) => ({ key, title: categoryLabel(key), count }))
      .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
  }, [allIngredients]);

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

  const visualizationSubtypeOptionsByCategory = useMemo(() => {
    const bucket = new Map<string, Map<string, { title: string; ingredientIds: Set<string> }>>();
    for (const item of allIngredients) {
      const category = String(item.category || "").trim().toLowerCase();
      const ingredientId = String(item.ingredient_id || "").trim();
      if (!category || !ingredientId) continue;
      const subtypeHits = new Map<string, string>();
      for (const productId of uniqueTraceIds(item.source_trace_ids)) {
        const mapping = routeByProductId.get(productId);
        if (!mapping) continue;
        const mappedCategory = String(mapping.category || "").trim().toLowerCase();
        const subtypeKey = String(mapping.primary_route_key || "").trim();
        if (!subtypeKey || mappedCategory !== category) continue;
        subtypeHits.set(subtypeKey, String(mapping.primary_route_title || subtypeKey).trim() || subtypeKey);
      }
      if (subtypeHits.size === 0) continue;
      const categoryBucket = bucket.get(category) || new Map<string, { title: string; ingredientIds: Set<string> }>();
      for (const [subtypeKey, subtypeTitle] of subtypeHits.entries()) {
        const subtypeBucket = categoryBucket.get(subtypeKey) || { title: subtypeTitle, ingredientIds: new Set<string>() };
        subtypeBucket.ingredientIds.add(ingredientId);
        categoryBucket.set(subtypeKey, subtypeBucket);
      }
      bucket.set(category, categoryBucket);
    }

    const out = new Map<string, IngredientFilterOption[]>();
    for (const [category, categoryBucket] of bucket.entries()) {
      out.set(
        category,
        Array.from(categoryBucket.entries())
          .map(([key, value]) => ({ key, title: value.title, count: value.ingredientIds.size }))
          .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title)),
      );
    }
    return out;
  }, [allIngredients, routeByProductId]);

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

  const visualizationSubtypeOptions = detailCategory ? visualizationSubtypeOptionsByCategory.get(detailCategory) || [] : [];

  const visualizationIngredients = useMemo<IngredientTagItem[]>(() => {
    const items = allIngredients.filter((item) => {
      const category = String(item.category || "").trim().toLowerCase();
      if (!category) return false;
      if (detailCategory && category !== detailCategory) return false;
      if (!detailSubtype) return true;
      return uniqueTraceIds(item.source_trace_ids).some((id) => {
        const mapping = routeByProductId.get(id);
        if (!mapping) return false;
        const mappedCategory = String(mapping.category || "").trim().toLowerCase();
        const mappedKey = String(mapping.primary_route_key || "").trim();
        return mappedCategory === category && mappedKey === detailSubtype;
      });
    });

    return items
      .map((item) => {
        const category = String(item.category || "").trim().toLowerCase();
        const subtypeTitles = new Set<string>();
        for (const sourceId of uniqueTraceIds(item.source_trace_ids)) {
          const mapping = routeByProductId.get(sourceId);
          if (!mapping) continue;
          const mappedCategory = String(mapping.category || "").trim().toLowerCase();
          if (mappedCategory !== category) continue;
          const subtypeTitle = String(mapping.primary_route_title || mapping.primary_route_key || "").trim();
          if (subtypeTitle) subtypeTitles.add(subtypeTitle);
        }
        return {
          ingredient_id: item.ingredient_id,
          category,
          ingredient_name: ingredientDisplayName(item),
          ingredient_name_en: item.ingredient_name_en || null,
          source_count: Number(item.source_count || uniqueTraceIds(item.source_trace_ids).length || 0),
          href: `/product/ingredients/${encodeURIComponent(category)}/${encodeURIComponent(item.ingredient_id)}`,
          summary: item.summary || "",
          subtype_titles: Array.from(subtypeTitles).sort((a, b) => a.localeCompare(b)),
        };
      })
      .sort((a, b) => b.source_count - a.source_count || a.ingredient_name.localeCompare(b.ingredient_name));
  }, [allIngredients, detailCategory, detailSubtype, routeByProductId]);

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
    <section className="mt-8 space-y-5">
      <IngredientVisualizationPanel
        loading={loading}
        exportingCsv={exportingCsv}
        totalIngredients={allIngredients.length}
        error={error}
        selectedCategory={detailCategory}
        selectedSubtype={detailSubtype}
        categoryOptions={visualizationCategoryOptions}
        subtypeOptions={visualizationSubtypeOptions}
        ingredientTags={visualizationIngredients}
        summaryRows={summaryRows}
        onCategoryChange={setDetailCategory}
        onSubtypeChange={setDetailSubtype}
        onRefresh={() => {
          void loadAllIngredients();
        }}
        onExport={() => {
          void exportAllCsv();
        }}
      />

      <IngredientCleanupPanel
        loading={loading}
        detailQuery={detailQuery}
        detailCategory={detailCategory}
        detailSubtype={detailSubtype}
        categoryOptions={categoryOptions}
        subtypeOptions={subtypeOptions}
        removeArtifacts={removeArtifacts}
        deleting={deleting}
        selectedCount={selectedIngredientIds.length}
        filteredCount={filteredIngredients.length}
        deleteSummary={deleteSummary}
        deleteError={deleteError}
        filteredIngredients={filteredIngredients}
        selectedSet={selectedSet}
        onDetailQueryChange={setDetailQuery}
        onDetailCategoryChange={setDetailCategory}
        onDetailSubtypeChange={setDetailSubtype}
        onReload={() => {
          void loadAllIngredients();
        }}
        onSelectAll={selectAllFiltered}
        onClearSelection={clearSelection}
        onRemoveArtifactsChange={setRemoveArtifacts}
        onDeleteSelected={() => {
          void deleteSelectedIngredients();
        }}
        onToggleIngredient={toggleIngredientSelection}
      />
    </section>
  );
}

function IngredientVisualizationPanel({
  loading,
  exportingCsv,
  totalIngredients,
  error,
  selectedCategory,
  selectedSubtype,
  categoryOptions,
  subtypeOptions,
  ingredientTags,
  summaryRows,
  onCategoryChange,
  onSubtypeChange,
  onRefresh,
  onExport,
}: {
  loading: boolean;
  exportingCsv: boolean;
  totalIngredients: number;
  error: string | null;
  selectedCategory: string;
  selectedSubtype: string;
  categoryOptions: IngredientFilterOption[];
  subtypeOptions: IngredientFilterOption[];
  ingredientTags: IngredientTagItem[];
  summaryRows: CategorySummary[];
  onCategoryChange: (value: string) => void;
  onSubtypeChange: (value: string) => void;
  onRefresh: () => void;
  onExport: () => void;
}) {
  const [visualQuery, setVisualQuery] = useState("");
  const [showLongTail, setShowLongTail] = useState(false);
  const [activeIngredientId, setActiveIngredientId] = useState<string | null>(null);
  const [expandedOverviewCategories, setExpandedOverviewCategories] = useState<string[]>([]);

  const query = visualQuery.trim().toLowerCase();
  const visibleIngredientTags = useMemo(() => {
    if (!query) return ingredientTags;
    return ingredientTags.filter((item) => {
      const haystack = `${item.ingredient_name} ${item.ingredient_name_en || ""} ${item.summary} ${item.subtype_titles.join(" ")}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [ingredientTags, query]);

  const highFrequencyTags = useMemo(
    () => visibleIngredientTags.filter((item) => item.source_count > 2),
    [visibleIngredientTags],
  );
  const lowFrequencyTags = useMemo(
    () => visibleIngredientTags.filter((item) => item.source_count <= 2),
    [visibleIngredientTags],
  );
  const twoHitTags = useMemo(
    () => lowFrequencyTags.filter((item) => item.source_count === 2),
    [lowFrequencyTags],
  );
  const oneHitTags = useMemo(
    () => lowFrequencyTags.filter((item) => item.source_count <= 1),
    [lowFrequencyTags],
  );
  const visibleReferenceTotal = useMemo(
    () => visibleIngredientTags.reduce((sum, item) => sum + item.source_count, 0),
    [visibleIngredientTags],
  );
  const selectedSummaryRow = useMemo(
    () => (selectedCategory ? summaryRows.find((row) => row.category === selectedCategory) || null : null),
    [selectedCategory, summaryRows],
  );
  const selectedSubtypeSummary = useMemo(
    () => (selectedSummaryRow && selectedSubtype ? selectedSummaryRow.subtype_summaries.find((item) => item.key === selectedSubtype) || null : null),
    [selectedSubtype, selectedSummaryRow],
  );
  const overviewRows = useMemo(
    () => (selectedSummaryRow ? [selectedSummaryRow] : summaryRows),
    [selectedSummaryRow, summaryRows],
  );
  const activeIngredient = useMemo(
    () => visibleIngredientTags.find((item) => item.ingredient_id === activeIngredientId) || null,
    [activeIngredientId, visibleIngredientTags],
  );
  const previewIngredient = activeIngredient || highFrequencyTags[0] || visibleIngredientTags[0] || null;
  const formatCount = (value: number) => new Intl.NumberFormat("zh-CN").format(value);
  const overviewProductBase = useMemo(
    () => Math.max(1, overviewRows.reduce((sum, row) => sum + row.product_count, 0)),
    [overviewRows],
  );
  const overviewIngredientBase = useMemo(
    () => Math.max(1, overviewRows.reduce((sum, row) => sum + row.ingredient_count, 0)),
    [overviewRows],
  );
  const previewReferenceShare = previewIngredient ? ratioLabel(previewIngredient.source_count, Math.max(1, visibleReferenceTotal)) : "0%";
  const previewScopeLabel = selectedSubtype
    ? "占当前二级引用"
    : selectedCategory
      ? "占当前一级引用"
      : "占当前视图引用";
  const previewScopeTitle = selectedSubtypeSummary
    ? `${categoryLabel(selectedCategory)} · ${selectedSubtypeSummary.title}`
    : selectedSummaryRow
      ? categoryLabel(selectedSummaryRow.category)
      : "全部一级分类";
  const expandedOverviewSet = useMemo(() => new Set(expandedOverviewCategories), [expandedOverviewCategories]);

  function toggleOverviewCategory(category: string) {
    if (!category) return;
    setExpandedOverviewCategories((prev) =>
      prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category],
    );
  }

  return (
    <section
      id="ingredient-visualization-panel"
      className="ingredient-visual-shell scroll-mt-20 overflow-visible rounded-[34px] border border-black/10 bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_52%,#fcfdff_100%)]"
    >
      <div className="relative border-b border-black/8 px-6 py-6 md:px-7">
        <div className="ingredient-breathe-orb ingredient-breathe-orb-left" />
        <div className="ingredient-breathe-orb ingredient-breathe-orb-right" />
        <div className="relative flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-black/12 bg-white/78 px-3 py-1 text-[12px] font-semibold text-black/62 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            成分治理 · 可视化
          </span>
          <span className="rounded-full border border-[#dbeafe] bg-[#f4f8ff] px-3 py-1 text-[12px] font-semibold text-[#2450a0]">
            面向浏览与决策
          </span>
        </div>
        <h2 className="relative mt-3 text-[30px] font-semibold tracking-[-0.03em] text-black/90 md:text-[34px]">成分可视化</h2>
        <p className="relative mt-2 max-w-[780px] text-[14px] leading-[1.7] text-black/64">
          先看高频成分，再决定是否展开长尾。支持一级/二级分类过滤、关键词检索、即时预览与详情跳转，适合直接浏览和定位常见成分。
        </p>

        <div className="relative mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <VisualizationMetricCard label="当前展示" value={formatCount(visibleIngredientTags.length)} note="已按当前筛选与关键词过滤" />
          <VisualizationMetricCard label="高频成分" value={formatCount(highFrequencyTags.length)} note="引用次数 > 2，默认直接展开" />
          <VisualizationMetricCard label="长尾成分" value={formatCount(lowFrequencyTags.length)} note="引用次数 <= 2，默认折叠收起" />
          <VisualizationMetricCard label="引用总量" value={formatCount(visibleReferenceTotal)} note="按成分库 source_count 聚合" />
        </div>
      </div>

      <div className="px-6 pb-6 pt-5 md:px-7">
        <div className="ingredient-dock sticky top-24 z-20 rounded-[22px] border border-black/10 bg-white/86 px-5 py-4 shadow-[0_14px_32px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
              <div>
                <div className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-black/44 uppercase">一级品类</div>
                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      onCategoryChange("");
                      onSubtypeChange("");
                    }}
                    className={filterTagClass(!selectedCategory)}
                  >
                    全部成分 ({totalIngredients})
                  </button>
                  {categoryOptions.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        onCategoryChange(item.key);
                        onSubtypeChange("");
                      }}
                      className={filterTagClass(selectedCategory === item.key)}
                    >
                      {item.title} ({item.count})
                    </button>
                  ))}
                </div>
              </div>

              {selectedCategory && subtypeOptions.length > 0 ? (
                <div>
                  <div className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-black/44 uppercase">二级分类</div>
                  <div className="flex flex-wrap gap-2.5">
                    <button type="button" onClick={() => onSubtypeChange("")} className={filterTagClass(!selectedSubtype)}>
                      全部二级分类
                    </button>
                    {subtypeOptions.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => onSubtypeChange(item.key)}
                        className={filterTagClass(selectedSubtype === item.key)}
                      >
                        {item.title} ({item.count})
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              <div>
                <div className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-black/44 uppercase">工具区</div>
                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={onRefresh}
                    disabled={loading}
                    className="ingredient-tool-button"
                  >
                    {loading ? "刷新中..." : "刷新可视化"}
                  </button>
                  <button
                    type="button"
                    onClick={onExport}
                    disabled={loading || exportingCsv || totalIngredients === 0}
                    className="ingredient-tool-button"
                    title="导出全量成分 CSV（不受当前筛选影响）"
                  >
                    {exportingCsv ? "导出中..." : "导出全量 CSV"}
                  </button>
                </div>
              </div>
              <div className="rounded-[18px] border border-black/8 bg-white/88 px-4 py-3 text-[12px] leading-[1.65] text-black/58">
                当前展示 {formatCount(visibleIngredientTags.length)} 个成分。高频成分默认展开，低频长尾按{" "}
                <span className="font-semibold text-black/76">{formatCount(twoHitTags.length)} 个 2 引用</span> 和{" "}
                <span className="font-semibold text-black/76">{formatCount(oneHitTags.length)} 个 1 引用</span> 收起。
              </div>
            </div>
          </div>

          <div className="mt-3">
            <div className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-black/44 uppercase">关键词</div>
            <input
              value={visualQuery}
              onChange={(event) => setVisualQuery(event.target.value)}
              placeholder="按成分名、英文名、摘要或二级分类检索"
              className="h-11 w-full rounded-2xl border border-black/12 bg-white px-4 text-[13px] text-black/82 outline-none transition focus:border-black/28 focus:shadow-[0_0_0_4px_rgba(15,23,42,0.04)]"
            />
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-[24px] border border-[#f0b8b1] bg-[#fff4f2] px-4 py-3 text-[13px] leading-[1.6] text-[#b42318]">
            {error}
          </div>
        ) : null}

        <div className="ingredient-workbench mt-5 overflow-hidden rounded-[30px] border border-black/10 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] shadow-[0_22px_58px_rgba(15,23,42,0.08)]">
          <div className="ingredient-workbench-grid grid xl:grid-cols-[320px_minmax(0,1fr)_360px] 2xl:grid-cols-[340px_minmax(0,1fr)_380px] xl:h-[calc(100vh-248px)] xl:min-h-[760px] xl:max-h-[1120px]">
            <section className="ingredient-pane border-b border-black/8 bg-[linear-gradient(180deg,rgba(247,250,255,0.9),rgba(255,255,255,0.95))] xl:border-b-0 xl:border-r">
              <div className="ingredient-pane-frame">
                <div className="ingredient-pane-head border-b border-black/8 px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-black/10 bg-white/86 px-3 py-1 text-[11px] font-semibold tracking-[0.08em] text-black/56 uppercase">
                      即时预览
                    </span>
                    <span className="rounded-full border border-[#dbeafe] bg-[#f4f8ff] px-3 py-1 text-[11px] font-semibold text-[#2450a0]">
                      悬浮中栏标签切换
                    </span>
                  </div>
                  {previewIngredient ? (
                    <>
                      <h3 className="mt-4 text-[28px] font-semibold tracking-[-0.03em] text-black/90">{previewIngredient.ingredient_name}</h3>
                      <p className="mt-2 text-[12px] font-semibold tracking-[0.06em] text-black/46 uppercase">{previewScopeTitle}</p>
                    </>
                  ) : (
                    <h3 className="mt-4 text-[24px] font-semibold tracking-[-0.03em] text-black/90">即时预览</h3>
                  )}
                </div>
                <div className="ingredient-pane-body ingredient-scroll px-5 py-5">
                  {previewIngredient ? (
                    <>
                      <p className="text-[14px] leading-[1.7] text-black/64">
                        {previewIngredient.summary || "打开详情页查看完整成分说明、收益风险与来源样本。"}
                      </p>

                      <div className="mt-4 grid gap-3">
                        <VisualizationStatStrip title="被引用次数" value={formatCount(previewIngredient.source_count)} note="按成分库 source_count 聚合" />
                        <VisualizationStatStrip title={previewScopeLabel} value={previewReferenceShare} note="基于当前筛选范围计算" />
                        <VisualizationStatStrip
                          title="命中二级分类"
                          value={formatCount(previewIngredient.subtype_titles.length)}
                          note={previewIngredient.subtype_titles.slice(0, 3).join(" · ") || "当前范围内暂无二级分类标记"}
                        />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-[12px] font-semibold text-black/70">
                          {categoryLabel(previewIngredient.category)}
                        </span>
                        {previewIngredient.subtype_titles.map((title) => (
                          <span key={title} className="rounded-full border border-black/10 bg-white px-3 py-1 text-[12px] font-semibold text-black/64">
                            {title}
                          </span>
                        ))}
                      </div>

                      <Link
                        href={previewIngredient.href}
                        className="mt-5 inline-flex h-11 items-center justify-center rounded-full border border-black/12 bg-black px-5 text-[13px] font-semibold text-white transition hover:translate-y-[-1px] hover:bg-black/88"
                      >
                        查看成分详情
                      </Link>
                    </>
                  ) : (
                    <div className="text-[13px] leading-[1.7] text-black/58">当前筛选无可预览成分。</div>
                  )}
                </div>
              </div>
            </section>

            <section className="ingredient-pane border-b border-black/8 bg-white/92 xl:border-b-0 xl:border-r">
              <div className="ingredient-pane-frame">
                <div className="ingredient-pane-body ingredient-scroll px-4 py-4 md:px-5">
                  <section>
                    <div className="ingredient-section-head sticky top-0 z-10 rounded-[20px] border border-black/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,251,255,0.94))] px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)] backdrop-blur-xl">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-semibold tracking-[0.12em] text-black/44 uppercase">High Frequency</div>
                          <h3 className="mt-1 text-[24px] font-semibold tracking-[-0.02em] text-black/90">高频成分</h3>
                          <p className="mt-1 text-[13px] leading-[1.6] text-black/58">
                            优先展示引用次数更高的成分，适合先看主结构，再决定是否继续下钻。
                          </p>
                        </div>
                        <span className="rounded-full border border-[#dbeafe] bg-[#f4f8ff] px-3 py-1 text-[12px] font-semibold text-[#2450a0]">
                          {formatCount(highFrequencyTags.length)} 个高频 tag
                        </span>
                      </div>
                    </div>

                    {highFrequencyTags.length > 0 ? (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                        {highFrequencyTags.map((item) => (
                          <IngredientVisualizationCard
                            key={item.ingredient_id}
                            item={item}
                            active={previewIngredient?.ingredient_id === item.ingredient_id}
                            onActivate={() => setActiveIngredientId(item.ingredient_id)}
                          />
                        ))}
                      </div>
                    ) : lowFrequencyTags.length > 0 ? (
                      <div className="mt-4 rounded-[24px] border border-dashed border-black/14 bg-[#fbfcfe] px-4 py-4 text-[13px] leading-[1.65] text-black/60">
                        当前筛选下没有 <span className="font-semibold text-black/76">&gt;2 引用</span> 的高频成分，结果都落在低频长尾中。你可以展开下方长尾区继续查看。
                      </div>
                    ) : (
                      <div className="mt-4 rounded-[24px] border border-dashed border-black/14 bg-[#fbfcfe] px-4 py-4 text-[13px] leading-[1.65] text-black/60">
                        当前筛选无成分数据。
                      </div>
                    )}
                  </section>

                  <section className="mt-5">
                    <div className="ingredient-section-head sticky top-0 z-10 rounded-[20px] border border-black/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,251,255,0.94))] px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)] backdrop-blur-xl">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-semibold tracking-[0.12em] text-black/44 uppercase">Long Tail</div>
                          <h3 className="mt-1 text-[24px] font-semibold tracking-[-0.02em] text-black/90">低频长尾</h3>
                          <p className="mt-1 text-[13px] leading-[1.6] text-black/58">
                            引用次数小于等于 2 的成分默认收起，避免长尾噪声淹没高频信息；需要时再展开完整浏览。
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowLongTail((prev) => !prev)}
                          className="inline-flex h-10 items-center justify-center rounded-full border border-black/12 bg-black/[0.02] px-4 text-[12px] font-semibold text-black/74 transition hover:bg-black/[0.05]"
                        >
                          {showLongTail ? "收起低频长尾" : `展开低频长尾 (${formatCount(lowFrequencyTags.length)})`}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <VisualizationStatStrip title="2 引用" value={formatCount(twoHitTags.length)} note="相对可复现，适合继续观察是否需要归一。" />
                      <VisualizationStatStrip title="1 引用" value={formatCount(oneHitTags.length)} note="更偏单点样本，默认收起避免页面过密。" />
                    </div>

                    {showLongTail ? (
                      <div className="mt-4 space-y-4">
                        <VisualizationPillGroup
                          title="2 引用"
                          description="先看两次引用的长尾成分。"
                          items={twoHitTags}
                          activeIngredientId={previewIngredient?.ingredient_id || null}
                          onActivate={setActiveIngredientId}
                        />
                        <VisualizationPillGroup
                          title="1 引用"
                          description="单次引用的极长尾成分。"
                          items={oneHitTags}
                          activeIngredientId={previewIngredient?.ingredient_id || null}
                          onActivate={setActiveIngredientId}
                        />
                      </div>
                    ) : (
                      <div className="mt-4 rounded-[24px] border border-dashed border-black/14 bg-[#fbfcfe] px-4 py-4 text-[13px] leading-[1.7] text-black/58">
                        当前已折叠 {formatCount(lowFrequencyTags.length)} 个低频成分。
                        {lowFrequencyTags.length > 0 ? " 需要时展开即可查看完整长尾列表。" : " 当前筛选下没有低频长尾成分。"}
                      </div>
                    )}
                  </section>
                </div>
              </div>
            </section>

            <section className="ingredient-pane bg-[linear-gradient(180deg,rgba(247,250,255,0.9),rgba(255,255,255,0.95))]">
              <div className="ingredient-pane-frame">
                <div className="ingredient-pane-head border-b border-black/8 px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold tracking-[0.12em] text-black/44 uppercase">
                        {selectedSummaryRow ? "当前分布概览" : "一级分布概览"}
                      </div>
                      <h3 className="mt-1 text-[24px] font-semibold tracking-[-0.02em] text-black/90">
                        {selectedSummaryRow ? categoryLabel(selectedSummaryRow.category) : "一级分布概览"}
                      </h3>
                      <p className="mt-1 text-[12px] leading-[1.6] text-black/58">
                        {selectedSubtypeSummary
                          ? `当前已筛到 ${selectedSubtypeSummary.title}，下方二级占比按 ${categoryLabel(selectedSummaryRow?.category)} 计算。`
                          : selectedSummaryRow
                            ? "当前二级展开占比按所选一级分类计算。"
                            : "一级卡片展示当前视图占比，展开后可看二级分布。"}
                      </p>
                    </div>
                    <span className="rounded-full border border-[#dbeafe] bg-[#f4f8ff] px-3 py-1 text-[11px] font-semibold text-[#2450a0]">
                      {formatCount(overviewRows.length)} 个一级类目
                    </span>
                  </div>
                </div>
                <div className="ingredient-pane-body ingredient-scroll px-5 py-5">
                  {overviewRows.length > 0 ? (
                    <div className="space-y-3">
                      {overviewRows.map((row, index) => {
                        const autoOpen = row.category === selectedCategory || (!selectedCategory && index === 0);
                        const open = autoOpen || expandedOverviewSet.has(row.category);
                        const productShare = ratioLabel(row.product_count, overviewProductBase);
                        const ingredientShare = ratioLabel(row.ingredient_count, overviewIngredientBase);
                        return (
                          <div key={row.category} className={`rounded-[22px] border px-4 py-4 ${row.category === selectedCategory ? "border-sky-200 bg-[#f7fbff]" : "border-black/8 bg-[#fbfcff]"}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-[16px] font-semibold text-black/86">{categoryLabel(row.category)}</div>
                                <div className="mt-1 text-[12px] text-black/56">
                                  产品 {formatCount(row.product_count)} · 唯一成分 {formatCount(row.ingredient_count)}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => toggleOverviewCategory(row.category)}
                                className="inline-flex h-9 items-center justify-center rounded-full border border-black/10 bg-white px-3 text-[11px] font-semibold text-black/66 transition hover:bg-black/[0.03]"
                              >
                                {open ? "收起二级概览" : "展开二级概览"}
                              </button>
                            </div>

                            <div className="mt-3 grid gap-2">
                              <OverviewShareRow label="产品占当前视图" value={productShare} ratio={row.product_count / overviewProductBase} />
                              <OverviewShareRow label="成分占当前视图" value={ingredientShare} ratio={row.ingredient_count / overviewIngredientBase} />
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              {row.top_ingredients.slice(0, 3).map((item) => (
                                <span key={item.ingredient_id} className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-black/64">
                                  {item.name} · {item.source_count}
                                </span>
                              ))}
                            </div>

                            {open ? (
                              <div className="mt-4 border-t border-black/8 pt-4">
                                <div className="text-[11px] font-semibold tracking-[0.12em] text-black/42 uppercase">二级概览分布</div>
                                <div className="mt-3 space-y-3">
                                  {row.subtype_summaries.length > 0 ? (
                                    row.subtype_summaries.map((subtype) => {
                                      const subtypeProductShare = ratioLabel(subtype.product_count, Math.max(1, row.product_count));
                                      const subtypeIngredientShare = ratioLabel(subtype.ingredient_count, Math.max(1, row.ingredient_count));
                                      const highlighted = row.category === selectedCategory && subtype.key === selectedSubtype;
                                      return (
                                        <div
                                          key={`${row.category}-${subtype.key}`}
                                          className={`rounded-[18px] border px-3 py-3 ${highlighted ? "border-sky-200 bg-white shadow-[0_12px_26px_rgba(59,130,246,0.08)]" : "border-black/8 bg-white/92"}`}
                                        >
                                          <div className="flex items-center justify-between gap-2">
                                            <div className="text-[13px] font-semibold text-black/82">{subtype.title}</div>
                                            <span className="rounded-full border border-black/10 bg-black/[0.03] px-2.5 py-1 text-[11px] font-semibold text-black/62">
                                              产品 {formatCount(subtype.product_count)}
                                            </span>
                                          </div>
                                          <div className="mt-1 text-[12px] text-black/56">唯一成分 {formatCount(subtype.ingredient_count)}</div>
                                          <div className="mt-3 grid gap-2">
                                            <OverviewShareRow label="产品占当前一级" value={subtypeProductShare} ratio={subtype.product_count / Math.max(1, row.product_count)} />
                                            <OverviewShareRow label="成分占当前一级" value={subtypeIngredientShare} ratio={subtype.ingredient_count / Math.max(1, row.ingredient_count)} />
                                          </div>
                                          <div className="mt-3 flex flex-wrap gap-2">
                                            {subtype.top_ingredients.slice(0, 2).map((item) => (
                                              <span key={item.ingredient_id} className="rounded-full border border-black/10 bg-[#fbfcff] px-2.5 py-1 text-[11px] font-semibold text-black/60">
                                                {item.name} · {item.product_count}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <div className="text-[12px] text-black/54">当前一级分类暂无二级概览数据。</div>
                                  )}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-[13px] text-black/56">暂无分类摘要。</div>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes ingredientVisualBreathe {
          0%, 100% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 0.9;
          }
          50% {
            transform: translate3d(0, -6px, 0) scale(1.04);
            opacity: 1;
          }
        }

        @keyframes ingredientCardFloat {
          0%, 100% {
            transform: translate3d(0, 0, 0);
          }
          50% {
            transform: translate3d(0, -2px, 0);
          }
        }

        .ingredient-visual-shell {
          position: relative;
          box-shadow: 0 28px 80px rgba(15, 23, 42, 0.08);
        }

        .ingredient-breathe-orb {
          position: absolute;
          border-radius: 9999px;
          filter: blur(28px);
          animation: ingredientVisualBreathe 8.8s cubic-bezier(0.22, 0.78, 0.2, 1) infinite;
          opacity: 0.75;
        }

        .ingredient-breathe-orb-left {
          left: -36px;
          top: 18px;
          height: 112px;
          width: 112px;
          background: radial-gradient(circle, rgba(96, 165, 250, 0.22), rgba(96, 165, 250, 0));
        }

        .ingredient-breathe-orb-right {
          right: 18px;
          top: 14px;
          height: 128px;
          width: 128px;
          background: radial-gradient(circle, rgba(20, 184, 166, 0.16), rgba(20, 184, 166, 0));
          animation-delay: 1.6s;
        }

        .ingredient-tool-button {
          display: inline-flex;
          height: 40px;
          align-items: center;
          justify-content: center;
          border-radius: 9999px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: rgba(255, 255, 255, 0.92);
          padding: 0 16px;
          font-size: 12px;
          font-weight: 700;
          color: rgba(15, 23, 42, 0.78);
          transition: transform 180ms cubic-bezier(0.22, 0.78, 0.2, 1), box-shadow 180ms cubic-bezier(0.22, 0.78, 0.2, 1),
            background 180ms ease;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
        }

        .ingredient-tool-button:hover:not(:disabled) {
          transform: translate3d(0, -1px, 0);
          background: rgba(255, 255, 255, 1);
          box-shadow: 0 14px 30px rgba(15, 23, 42, 0.08);
        }

        .ingredient-tool-button:disabled {
          opacity: 0.45;
        }

        .ingredient-dock {
          isolation: isolate;
        }

        .ingredient-workbench {
          position: relative;
        }

        .ingredient-workbench-grid {
          align-items: stretch;
          min-height: 0;
          height: 100%;
        }

        .ingredient-pane {
          min-width: 0;
          min-height: 0;
          height: 100%;
        }

        .ingredient-pane-frame {
          display: flex;
          min-height: 0;
          height: 100%;
          flex-direction: column;
        }

        .ingredient-pane-head {
          flex-shrink: 0;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 251, 255, 0.94));
          backdrop-filter: blur(16px);
        }

        .ingredient-pane-body {
          flex: 1 1 0%;
          min-height: 0;
          height: 0;
        }

        .ingredient-section-head {
          isolation: isolate;
        }

        .ingredient-scroll {
          overflow: visible;
          overflow-x: hidden;
        }

        @media (min-width: 1280px) {
          .ingredient-scroll {
            overflow-y: auto;
            overscroll-behavior: contain;
            scrollbar-width: thin;
            scrollbar-color: rgba(15, 23, 42, 0.18) rgba(15, 23, 42, 0.04);
          }

          .ingredient-scroll::-webkit-scrollbar {
            width: 10px;
          }

          .ingredient-scroll::-webkit-scrollbar-track {
            background: rgba(15, 23, 42, 0.04);
            border-radius: 9999px;
          }

          .ingredient-scroll::-webkit-scrollbar-thumb {
            background: rgba(15, 23, 42, 0.18);
            border-radius: 9999px;
            border: 2px solid rgba(255, 255, 255, 0.75);
          }
        }

        .ingredient-preview-card {
          position: relative;
        }

        .ingredient-preview-glow {
          position: absolute;
          right: -34px;
          top: -30px;
          height: 120px;
          width: 120px;
          border-radius: 9999px;
          background: radial-gradient(circle, rgba(96, 165, 250, 0.22), rgba(96, 165, 250, 0));
          filter: blur(20px);
          animation: ingredientVisualBreathe 9.2s cubic-bezier(0.22, 0.78, 0.2, 1) infinite;
        }

        .ingredient-card {
          transition: transform 180ms cubic-bezier(0.22, 0.78, 0.2, 1), box-shadow 180ms cubic-bezier(0.22, 0.78, 0.2, 1),
            border-color 180ms ease, background 180ms ease;
        }

        .ingredient-card:hover,
        .ingredient-card:focus-visible,
        .ingredient-card[data-active="true"] {
          transform: translate3d(0, -2px, 0);
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.1);
          border-color: rgba(96, 165, 250, 0.24);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(246, 250, 255, 0.98));
        }

        .ingredient-card[data-active="true"] {
          animation: ingredientCardFloat 3.2s cubic-bezier(0.22, 0.78, 0.2, 1) infinite;
        }
      `}</style>
    </section>
  );
}

function VisualizationMetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-[24px] border border-black/10 bg-white/82 px-4 py-4 shadow-[0_14px_34px_rgba(15,23,42,0.05)] backdrop-blur-xl">
      <div className="text-[11px] font-semibold tracking-[0.1em] text-black/46 uppercase">{label}</div>
      <div className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-black/88">{value}</div>
      <div className="mt-2 text-[12px] leading-[1.6] text-black/56">{note}</div>
    </div>
  );
}

function VisualizationStatStrip({
  title,
  value,
  note,
}: {
  title: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-[22px] border border-black/8 bg-[#fbfcff] px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[13px] font-semibold text-black/82">{title}</div>
        <div className="text-[15px] font-semibold text-black/86">{value}</div>
      </div>
      <div className="mt-1 text-[12px] leading-[1.6] text-black/56">{note}</div>
    </div>
  );
}

function OverviewShareRow({
  label,
  value,
  ratio,
}: {
  label: string;
  value: string;
  ratio: number;
}) {
  const width = `${Math.max(6, Math.min(ratio * 100, 100)).toFixed(1)}%`;
  return (
    <div className="rounded-[18px] border border-black/8 bg-white/88 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold text-black/56">{label}</div>
        <div className="text-[11px] font-semibold text-black/74">{value}</div>
      </div>
      <div className="mt-2 h-2 rounded-full bg-black/[0.06]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,rgba(96,165,250,0.95),rgba(59,130,246,0.72))]"
          style={{ width }}
        />
      </div>
    </div>
  );
}

function IngredientVisualizationCard({
  item,
  active,
  onActivate,
}: {
  item: IngredientTagItem;
  active: boolean;
  onActivate: () => void;
}) {
  return (
    <Link
      href={item.href}
      className="ingredient-card group block rounded-[26px] border border-black/10 bg-white/92 p-4 outline-none shadow-[0_12px_30px_rgba(15,23,42,0.05)]"
      data-active={active ? "true" : "false"}
      title={item.summary || item.ingredient_name}
      onMouseEnter={onActivate}
      onFocus={onActivate}
      onTouchStart={onActivate}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="line-clamp-2 text-[15px] font-semibold leading-[1.45] text-black/86">{item.ingredient_name}</div>
        </div>
        <span className="shrink-0 rounded-full border border-[#dbeafe] bg-[#f4f8ff] px-2.5 py-1 text-[11px] font-semibold text-[#2450a0]">
          {item.source_count} 引用
        </span>
      </div>

      <p className="mt-3 line-clamp-2 min-h-[40px] text-[12px] leading-[1.65] text-black/58">
        {item.summary || "点击查看完整成分说明、收益风险与来源样本。"}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full border border-black/10 bg-black/[0.03] px-2.5 py-1 text-[11px] font-semibold text-black/60">
          {categoryLabel(item.category)}
        </span>
        {item.subtype_titles.slice(0, 2).map((title) => (
          <span key={title} className="rounded-full border border-black/10 bg-black/[0.03] px-2.5 py-1 text-[11px] font-semibold text-black/56">
            {title}
          </span>
        ))}
      </div>
    </Link>
  );
}

function VisualizationPillGroup({
  title,
  description,
  items,
  activeIngredientId,
  onActivate,
}: {
  title: string;
  description: string;
  items: IngredientTagItem[];
  activeIngredientId: string | null;
  onActivate: (ingredientId: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-[14px] font-semibold text-black/84">{title}</div>
          <div className="text-[12px] text-black/56">{description}</div>
        </div>
        <div className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] font-semibold text-black/62">
          {items.length} 个
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        {items.map((item) => (
          <Link
            key={item.ingredient_id}
            href={item.href}
            onMouseEnter={() => onActivate(item.ingredient_id)}
            onFocus={() => onActivate(item.ingredient_id)}
            onTouchStart={() => onActivate(item.ingredient_id)}
            className={`ingredient-card inline-flex min-h-12 max-w-full items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold text-black/80 shadow-[0_10px_22px_rgba(15,23,42,0.04)] ${
              activeIngredientId === item.ingredient_id ? "border-sky-200 bg-[#f7fbff]" : "border-black/10 bg-white/92"
            }`}
            data-active={activeIngredientId === item.ingredient_id ? "true" : "false"}
            title={item.summary || item.ingredient_name}
          >
            <span className="max-w-[260px] truncate">{item.ingredient_name}</span>
            <span className="rounded-full border border-[#dbeafe] bg-[#f4f8ff] px-2 py-0.5 text-[11px] font-semibold text-[#2450a0]">
              {item.source_count} 引用
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function IngredientCleanupPanel({
  loading,
  detailQuery,
  detailCategory,
  detailSubtype,
  categoryOptions,
  subtypeOptions,
  removeArtifacts,
  deleting,
  selectedCount,
  filteredCount,
  deleteSummary,
  deleteError,
  filteredIngredients,
  selectedSet,
  onDetailQueryChange,
  onDetailCategoryChange,
  onDetailSubtypeChange,
  onReload,
  onSelectAll,
  onClearSelection,
  onRemoveArtifactsChange,
  onDeleteSelected,
  onToggleIngredient,
}: {
  loading: boolean;
  detailQuery: string;
  detailCategory: string;
  detailSubtype: string;
  categoryOptions: string[];
  subtypeOptions: Array<{ key: string; title: string; count: number }>;
  removeArtifacts: boolean;
  deleting: boolean;
  selectedCount: number;
  filteredCount: number;
  deleteSummary: string | null;
  deleteError: string | null;
  filteredIngredients: IngredientLibraryListItem[];
  selectedSet: Set<string>;
  onDetailQueryChange: (value: string) => void;
  onDetailCategoryChange: (value: string) => void;
  onDetailSubtypeChange: (value: string) => void;
  onReload: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onRemoveArtifactsChange: (value: boolean) => void;
  onDeleteSelected: () => void;
  onToggleIngredient: (ingredientId: string, checked: boolean) => void;
}) {
  return (
    <section id="ingredient-cleanup-panel" className="scroll-mt-20 rounded-[30px] border border-black/10 bg-white p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/62">
          成分治理 · 清理
        </span>
      </div>
      <h2 className="mt-3 text-[28px] font-semibold tracking-[-0.02em] text-black/90">成分清理台</h2>
      <p className="mt-2 text-[14px] text-black/65">按一级/二级分类筛选成分，勾选后批量删除，并可同步清理关联 doubao 产物。</p>

      <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-4">
        <input
          value={detailQuery}
          onChange={(e) => onDetailQueryChange(e.target.value)}
          placeholder="按成分名/摘要检索"
          className="h-10 rounded-xl border border-black/12 bg-white px-3 text-[13px] outline-none focus:border-black/35"
        />
        <select
          value={detailCategory}
          onChange={(e) => onDetailCategoryChange(e.target.value)}
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
          onChange={(e) => onDetailSubtypeChange(e.target.value)}
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
          onClick={onReload}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-black/12 bg-white px-4 text-[13px] font-semibold text-black/78 disabled:opacity-45"
        >
          {loading ? "加载中..." : "重载清理列表"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onSelectAll}
          className="inline-flex h-9 items-center justify-center rounded-full border border-black/12 bg-white px-4 text-[12px] font-semibold text-black/75"
        >
          勾选当前列表
        </button>
        <button
          type="button"
          onClick={onClearSelection}
          className="inline-flex h-9 items-center justify-center rounded-full border border-black/12 bg-white px-4 text-[12px] font-semibold text-black/75"
        >
          清空勾选
        </button>
        <label className="inline-flex items-center gap-2 rounded-full border border-black/12 bg-white px-3 py-1.5 text-[12px] text-black/72">
          <input
            type="checkbox"
            checked={removeArtifacts}
            onChange={(e) => onRemoveArtifactsChange(e.target.checked)}
            className="h-4 w-4"
          />
          删除关联 doubao_runs
        </label>
        <button
          type="button"
          onClick={onDeleteSelected}
          disabled={deleting || selectedCount === 0}
          className="inline-flex h-9 items-center justify-center rounded-full border border-[#ef4444]/40 bg-[#fff5f5] px-4 text-[12px] font-semibold text-[#b42318] disabled:opacity-50"
        >
          {deleting ? "清理中..." : `删除勾选 (${selectedCount})`}
        </button>
        <span className="text-[12px] text-black/58">当前筛选 {filteredCount} 条</span>
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
                onChange={(e) => onToggleIngredient(item.ingredient_id, e.target.checked)}
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

function ratioLabel(value: number, total: number): string {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return "0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

function filterTagClass(active: boolean): string {
  return active
    ? "rounded-full border border-black bg-black px-3.5 py-2 text-[12px] font-semibold text-white shadow-[0_14px_28px_rgba(15,23,42,0.18)]"
    : "rounded-full border border-black/10 bg-white/92 px-3.5 py-2 text-[12px] font-semibold text-black/68 shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition hover:-translate-y-[1px] hover:bg-white hover:shadow-[0_14px_28px_rgba(15,23,42,0.08)]";
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
