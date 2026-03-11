import {
  fetchAIMetricsSummary,
  fetchAllProducts,
  fetchProductAnalysisIndex,
  fetchProductFeaturedSlots,
  fetchProductRouteMappingIndex,
  type AIMetricsSummary,
  type Product,
  type ProductAnalysisIndexItem,
  type ProductFeaturedSlotItem,
  type ProductRouteMappingIndexItem,
} from "@/lib/api";
import { CATEGORY_CONFIG } from "@/lib/catalog";

export type ProductManagementData = {
  products: Product[];
  aiMetrics: AIMetricsSummary;
  routeMappings: ProductRouteMappingIndexItem[];
  analysisIndex: ProductAnalysisIndexItem[];
  featuredSlots: ProductFeaturedSlotItem[];
  categoryStats: Array<[string, number]>;
};

export async function loadProductManagementData(): Promise<ProductManagementData> {
  const [products, aiMetrics, routeMappings, analysisIndex, featuredSlots] = await Promise.all([
    fetchAllProducts(),
    fetchAIMetricsSummary({ sinceHours: 24 * 7 }),
    fetchProductRouteMappingIndex().then((result) => result.items),
    fetchProductAnalysisIndex().then((result) => result.items),
    fetchProductFeaturedSlots().then((result) => result.items),
  ]);

  const categoryCounts = new Map<string, number>();
  for (const item of products) {
    const key = item.category || "unknown";
    categoryCounts.set(key, (categoryCounts.get(key) || 0) + 1);
  }

  return {
    products,
    aiMetrics,
    routeMappings,
    analysisIndex,
    featuredSlots,
    categoryStats: Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1]),
  };
}

export function categoryLabel(category?: string | null): string {
  if (!category) return "-";
  const key = category.toLowerCase() as keyof typeof CATEGORY_CONFIG;
  return CATEGORY_CONFIG[key]?.zh || category;
}

export function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function num(value?: number | null): string {
  if (typeof value !== "number") return "-";
  return String(Math.round(value));
}
