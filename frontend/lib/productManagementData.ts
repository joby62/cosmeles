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

export type ProductManagementDataError = {
  stage: string;
  detail: string;
};

export type ProductManagementLoadState<T> =
  | { ok: true; data: T }
  | { ok: false; error: ProductManagementDataError };

export type ProductManagementData = {
  products: ProductManagementLoadState<Product[]>;
  aiMetrics: ProductManagementLoadState<AIMetricsSummary>;
  routeMappings: ProductManagementLoadState<ProductRouteMappingIndexItem[]>;
  analysisIndex: ProductManagementLoadState<ProductAnalysisIndexItem[]>;
  featuredSlots: ProductManagementLoadState<ProductFeaturedSlotItem[]>;
  categoryStats: Array<[string, number]>;
  issues: ProductManagementDataError[];
};

export async function loadProductManagementData(): Promise<ProductManagementData> {
  const [products, aiMetrics, routeMappings, analysisIndex, featuredSlots] = await Promise.all([
    loadResource("products", fetchAllProducts()),
    loadResource("ai_metrics", fetchAIMetricsSummary({ sinceHours: 24 * 7 })),
    loadResource("route_mapping_index", fetchProductRouteMappingIndex().then((result) => result.items)),
    loadResource("product_analysis_index", fetchProductAnalysisIndex().then((result) => result.items)),
    loadResource("featured_slots", fetchProductFeaturedSlots().then((result) => result.items)),
  ]);

  const categoryCounts = new Map<string, number>();
  if (products.ok) {
    for (const item of products.data) {
      const key = item.category || "unknown";
      categoryCounts.set(key, (categoryCounts.get(key) || 0) + 1);
    }
  }

  return {
    products,
    aiMetrics,
    routeMappings,
    analysisIndex,
    featuredSlots,
    categoryStats: Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1]),
    issues: [products, aiMetrics, routeMappings, analysisIndex, featuredSlots]
      .filter((item): item is { ok: false; error: ProductManagementDataError } => !item.ok)
      .map((item) => item.error),
  };
}

export function hasProductManagementData<T>(
  value: ProductManagementLoadState<T>,
): value is { ok: true; data: T } {
  return value.ok;
}

export function getProductManagementError<T>(
  value: ProductManagementLoadState<T>,
): ProductManagementDataError | null {
  return value.ok ? null : value.error;
}

async function loadResource<T>(
  stage: string,
  promise: Promise<T>,
): Promise<ProductManagementLoadState<T>> {
  try {
    return { ok: true, data: await promise };
  } catch (error) {
    return {
      ok: false,
      error: {
        stage,
        detail: formatError(error),
      },
    };
  }
}

function formatError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
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
