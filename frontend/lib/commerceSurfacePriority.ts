import type { Product, ProductAnalysisIndexItem } from "@/lib/api";
import { CONCERN_COLLECTION_LIST } from "@/lib/collections";
import {
  commerceFilledFieldCount,
  commerceHasField,
  commerceStatusRank,
  sortProductsByCommerceReadiness,
} from "@/lib/productCommerce";
import { CATEGORIES } from "@/lib/site";
import { SEARCH_SUGGESTIONS } from "@/lib/storefrontTrust";

export type CommerceSurfaceKind = "home" | "shop" | "category" | "collection" | "search";
export type CommerceSurfaceTier = "hero" | "discovery" | "catalog";

export type CommerceSurfaceCoverage = {
  tier: CommerceSurfaceTier;
  score: number;
  labels: string[];
  kinds: CommerceSurfaceKind[];
};

type SurfaceAccumulator = {
  score: number;
  labels: string[];
  kinds: Set<CommerceSurfaceKind>;
};

type SurfaceSummary = {
  total: number;
  hero: number;
  discovery: number;
  needs_price: number;
  needs_inventory: number;
  needs_shipping_eta: number;
  needs_pack_size: number;
};

const SURFACE_WEIGHTS: Record<CommerceSurfaceKind, number> = {
  home: 8,
  shop: 8,
  category: 4,
  collection: 5,
  search: 3,
};

const SURFACE_TIER_ORDER: Record<CommerceSurfaceTier, number> = {
  hero: 0,
  discovery: 1,
  catalog: 2,
};

function productLabel(product: Product): string {
  return `${product.brand || ""} ${product.name || ""}`.trim();
}

function matchesSearchQuery(product: Product, query: string): boolean {
  const haystack = [
    product.name,
    product.brand,
    product.one_sentence,
    product.description,
    ...(product.tags || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function addSurface(
  map: Map<string, SurfaceAccumulator>,
  productId: string,
  kind: CommerceSurfaceKind,
  label: string,
) {
  const current = map.get(productId) || {
    score: 0,
    labels: [],
    kinds: new Set<CommerceSurfaceKind>(),
  };

  current.score += SURFACE_WEIGHTS[kind];
  current.kinds.add(kind);
  if (!current.labels.includes(label)) {
    current.labels.push(label);
  }
  map.set(productId, current);
}

function pickCategoryHighlights(products: Product[]) {
  const sorted = sortProductsByCommerceReadiness(products);
  const byCategory = new Map<string, Product>();

  for (const item of sorted) {
    const category = String(item.category || "").trim().toLowerCase();
    if (!category || byCategory.has(category)) continue;
    byCategory.set(category, item);
  }

  return CATEGORIES.map((category) => byCategory.get(category.key)).filter((item): item is Product => Boolean(item));
}

function curatedSearchQueries(): string[] {
  const queries = new Set<string>();

  for (const item of SEARCH_SUGGESTIONS) {
    if (item.query.trim()) queries.add(item.query.trim().toLowerCase());
  }

  for (const collection of CONCERN_COLLECTION_LIST) {
    for (const query of collection.suggestedSearches) {
      if (query.trim()) queries.add(query.trim().toLowerCase());
    }
  }

  return Array.from(queries);
}

export function buildCommerceSurfaceMap(
  products: Product[],
  analysisItems: ProductAnalysisIndexItem[],
): Map<string, CommerceSurfaceCoverage> {
  const draft = new Map<string, SurfaceAccumulator>();
  const sorted = sortProductsByCommerceReadiness(products);
  const analysisById = new Map(analysisItems.map((item) => [item.product_id, item]));

  for (const product of pickCategoryHighlights(products)) {
    addSurface(draft, product.id, "home", "Home highlight");
    addSurface(draft, product.id, "shop", "Shop current edit");
  }

  for (const category of CATEGORIES) {
    const categoryProducts = sorted
      .filter((product) => String(product.category || "").trim().toLowerCase() === category.key)
      .slice(0, 6);
    for (const product of categoryProducts) {
      addSurface(draft, product.id, "category", `${category.label} first screen`);
    }
  }

  for (const collection of CONCERN_COLLECTION_LIST) {
    const routeKeys = new Set(collection.routeKeys.map((item) => `${item.category}:${item.routeKey}`));
    const visibleProducts = sortProductsByCommerceReadiness(
      products
        .filter((product) => collection.categoryKeys.includes(product.category as (typeof collection.categoryKeys)[number]))
        .filter((product) => {
          const analysis = analysisById.get(product.id);
          if (!analysis) return false;
          return routeKeys.has(`${analysis.category}:${analysis.route_key}`);
        }),
    ).slice(0, 12);

    for (const product of visibleProducts) {
      addSurface(draft, product.id, "collection", `Collection: ${collection.label}`);
    }
  }

  for (const query of curatedSearchQueries()) {
    const results = sortProductsByCommerceReadiness(products.filter((product) => matchesSearchQuery(product, query))).slice(0, 18);
    for (const product of results) {
      addSurface(draft, product.id, "search", `Search: ${query}`);
    }
  }

  const finalized = new Map<string, CommerceSurfaceCoverage>();
  for (const product of products) {
    const item = draft.get(product.id);
    const kinds = Array.from(item?.kinds || []);
    const tier: CommerceSurfaceTier = kinds.includes("home") || kinds.includes("shop")
      ? "hero"
      : kinds.length > 0
        ? "discovery"
        : "catalog";

    finalized.set(product.id, {
      tier,
      score: item?.score || 0,
      labels: item?.labels || [],
      kinds,
    });
  }

  return finalized;
}

export function getCommerceSurfaceCoverage(
  coverageMap: Map<string, CommerceSurfaceCoverage>,
  productId: string,
): CommerceSurfaceCoverage {
  return (
    coverageMap.get(productId) || {
      tier: "catalog",
      score: 0,
      labels: [],
      kinds: [],
    }
  );
}

export function sortProductsForCommerceOps(
  products: Product[],
  coverageMap: Map<string, CommerceSurfaceCoverage>,
): Product[] {
  return [...products].sort((left, right) => {
    const leftCoverage = getCommerceSurfaceCoverage(coverageMap, left.id);
    const rightCoverage = getCommerceSurfaceCoverage(coverageMap, right.id);

    const tierDelta = SURFACE_TIER_ORDER[leftCoverage.tier] - SURFACE_TIER_ORDER[rightCoverage.tier];
    if (tierDelta !== 0) return tierDelta;

    const scoreDelta = rightCoverage.score - leftCoverage.score;
    if (scoreDelta !== 0) return scoreDelta;

    const statusDelta = commerceStatusRank(left.commerce, "ops") - commerceStatusRank(right.commerce, "ops");
    if (statusDelta !== 0) return statusDelta;

    const filledDelta = commerceFilledFieldCount(right.commerce) - commerceFilledFieldCount(left.commerce);
    if (filledDelta !== 0) return filledDelta;

    return productLabel(left).localeCompare(productLabel(right));
  });
}

export function buildCommerceSurfaceSummary(
  products: Product[],
  coverageMap: Map<string, CommerceSurfaceCoverage>,
): SurfaceSummary {
  const surfacedProducts = products.filter((product) => getCommerceSurfaceCoverage(coverageMap, product.id).tier !== "catalog");

  return surfacedProducts.reduce<SurfaceSummary>(
    (summary, product) => {
      const coverage = getCommerceSurfaceCoverage(coverageMap, product.id);
      summary.total += 1;
      if (coverage.tier === "hero") {
        summary.hero += 1;
      } else {
        summary.discovery += 1;
      }
      if (!commerceHasField(product.commerce, "price")) summary.needs_price += 1;
      if (!commerceHasField(product.commerce, "inventory")) summary.needs_inventory += 1;
      if (!commerceHasField(product.commerce, "shipping_eta")) summary.needs_shipping_eta += 1;
      if (!commerceHasField(product.commerce, "pack_size")) summary.needs_pack_size += 1;
      return summary;
    },
    {
      total: 0,
      hero: 0,
      discovery: 0,
      needs_price: 0,
      needs_inventory: 0,
      needs_shipping_eta: 0,
      needs_pack_size: 0,
    },
  );
}
