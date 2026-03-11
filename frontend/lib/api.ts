import type { CategoryKey } from "@/lib/site";

export type Product = {
  id: string;
  category: string;
  brand?: string | null;
  name?: string | null;
  description?: string | null;
  one_sentence?: string | null;
  tags?: string[] | null;
  image_url?: string | null;
  created_at?: string | null;
};

type ProductListMeta = {
  total: number;
  offset: number;
  limit: number;
};

type ProductListResponse = {
  items: Product[];
  meta: ProductListMeta;
};

export type ProductDoc = {
  product: {
    category: string;
    brand?: string | null;
    name?: string | null;
  };
  summary: {
    one_sentence: string;
    pros: string[];
    cons: string[];
    who_for: string[];
    who_not_for: string[];
  };
  ingredients: Array<{
    rank?: number | null;
    name: string;
    abundance_level?: "major" | "trace" | null;
    order_confidence?: number | null;
    type: string;
    functions: string[];
    risk: "low" | "mid" | "high";
    notes: string;
  }>;
  evidence: {
    image_path?: string | null;
    doubao_raw?: string | null;
    doubao_vision_text?: string | null;
    doubao_pipeline_mode?: string | null;
  };
};

export type ProductAnalysisKeyIngredient = {
  ingredient_name_cn: string;
  ingredient_name_en: string;
  rank: number;
  role: string;
  impact: string;
};

export type ProductAnalysisProfile = {
  category: CategoryKey;
  route_key: string;
  route_title: string;
  headline: string;
  positioning_summary: string;
  best_for: string[];
  not_ideal_for: string[];
  usage_tips: string[];
  watchouts: string[];
  key_ingredients: ProductAnalysisKeyIngredient[];
  confidence: number;
  confidence_reason: string;
  needs_review: boolean;
};

export type ProductAnalysisDetailResponse = {
  status: string;
  item: {
    product_id: string;
    category: CategoryKey;
    profile: ProductAnalysisProfile;
  };
};

export type ProductAnalysisIndexItem = {
  product_id: string;
  category: string;
  route_key: string;
  route_title: string;
  headline: string;
  confidence: number;
};

type ProductAnalysisIndexListResponse = {
  status: string;
  category?: string | null;
  total: number;
  items: ProductAnalysisIndexItem[];
};

export type MobileBagItem = {
  item_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
  product: Product;
  target_type_title?: string | null;
  target_type_level: "subcategory" | "category" | "unknown";
  is_featured: boolean;
};

type MobileBagListResponse = {
  status: string;
  category?: string | null;
  total_items: number;
  total_quantity: number;
  items: MobileBagItem[];
};

type ApiFetchInit = RequestInit & {
  next?: {
    revalidate?: number;
  };
};

function getBaseForFetch(): string {
  if (typeof window !== "undefined") {
    const pageProtocol = window.location.protocol;
    const isHttpsPage = pageProtocol === "https:";
    const direct = process.env.NEXT_PUBLIC_API_BASE?.trim();

    if (isHttpsPage) return "";
    if (!direct) return "";

    try {
      const url = new URL(direct);
      const currentHost = window.location.hostname;
      const isLoopback = url.hostname === "127.0.0.1" || url.hostname === "localhost";
      const isRemotePage = currentHost !== "127.0.0.1" && currentHost !== "localhost";
      if (isLoopback && isRemotePage) {
        url.hostname = currentHost;
      }
      return url.toString().replace(/\/$/, "");
    } catch {
      return direct.replace(/\/$/, "");
    }
  }

  return process.env.INTERNAL_API_BASE || "http://nginx";
}

async function apiFetch<T>(path: string, init?: ApiFetchInit): Promise<T> {
  const base = getBaseForFetch();
  const url = base ? new URL(path, base).toString() : path;
  const headersValue = new Headers({
    "content-type": "application/json",
  });

  const initHeaders = new Headers(init?.headers || {});
  initHeaders.forEach((value, key) => {
    headersValue.set(key, value);
  });

  const method = String(init?.method || "GET").toUpperCase();
  const requestInit: ApiFetchInit = {
    ...init,
    credentials: "include",
    headers: headersValue,
  };

  if (method === "GET") {
    if (typeof window === "undefined") {
      if (!requestInit.cache && !requestInit.next) {
        requestInit.next = { revalidate: 300 };
      }
    } else if (!requestInit.cache) {
      requestInit.cache = "no-store";
    }
  } else if (!requestInit.cache) {
    requestInit.cache = "no-store";
  }

  const response = await fetch(url, requestInit);

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`API ${response.status}: ${text}`);
  }

  return (await response.json()) as T;
}

function normalizePublicImagePath(path: string): string {
  if (!path) return "/placeholder-product.svg";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return path.startsWith("/") ? path : `/${path}`;
}

export async function fetchAllProducts(): Promise<Product[]> {
  const limit = 200;
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;
  const items: Product[] = [];

  while (offset < total) {
    const page = await apiFetch<ProductListResponse>(`/api/products/page?offset=${offset}&limit=${limit}`);
    items.push(...page.items);
    total = page.meta.total;
    offset += page.meta.limit;
    if (page.items.length === 0) break;
  }

  return items;
}

export async function fetchProductDoc(id: string): Promise<ProductDoc> {
  const value = id.trim();
  if (!value) throw new Error("productId is required.");
  return apiFetch<ProductDoc>(`/api/products/${encodeURIComponent(value)}`);
}

export async function fetchProductAnalysis(id: string): Promise<ProductAnalysisDetailResponse> {
  const value = id.trim();
  if (!value) throw new Error("productId is required.");
  return apiFetch<ProductAnalysisDetailResponse>(`/api/products/${encodeURIComponent(value)}/analysis`);
}

export async function fetchProductAnalysisIndex(category?: string): Promise<ProductAnalysisIndexItem[]> {
  const search = new URLSearchParams();
  if (category) search.set("category", category);
  const query = search.toString();
  const path = query ? `/api/products/analysis/index?${query}` : "/api/products/analysis/index";
  const response = await apiFetch<ProductAnalysisIndexListResponse>(path);
  return response.items || [];
}

export async function fetchMobileBagItems(params?: {
  category?: CategoryKey;
  offset?: number;
  limit?: number;
}): Promise<MobileBagListResponse> {
  const search = new URLSearchParams();
  if (params?.category) search.set("category", params.category);
  if (typeof params?.offset === "number") search.set("offset", String(params.offset));
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  const query = search.toString();
  const path = query ? `/api/mobile/bag/items?${query}` : "/api/mobile/bag/items";
  return apiFetch<MobileBagListResponse>(path);
}

export async function upsertMobileBagItem(payload: {
  product_id: string;
  quantity?: number;
}): Promise<MobileBagItem> {
  return apiFetch<MobileBagItem>("/api/mobile/bag/items", {
    method: "POST",
    body: JSON.stringify({
      product_id: payload.product_id,
      quantity: payload.quantity ?? 1,
    }),
  });
}

export async function deleteMobileBagItem(itemId: string): Promise<{ status: string; item_id: string; deleted: boolean }> {
  const value = itemId.trim();
  if (!value) throw new Error("itemId is required.");
  return apiFetch<{ status: string; item_id: string; deleted: boolean }>(
    `/api/mobile/bag/items/${encodeURIComponent(value)}`,
    { method: "DELETE" },
  );
}

export function resolveImageUrl(product: Product): string {
  if (!product.image_url) return "/placeholder-product.svg";
  return normalizePublicImagePath(product.image_url);
}

export function resolveStoredImageUrl(imagePath?: string | null): string | null {
  if (!imagePath) return null;
  return normalizePublicImagePath(imagePath);
}
