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

export type IngredientLibraryListItem = {
  ingredient_id: string;
  category: string;
  ingredient_name: string;
  ingredient_name_en?: string | null;
  summary: string;
  source_count: number;
  source_trace_ids: string[];
  generated_at?: string | null;
  storage_path: string;
};

type IngredientLibraryListResponse = {
  status: string;
  category?: string | null;
  query?: string | null;
  total: number;
  offset: number;
  limit: number;
  items: IngredientLibraryListItem[];
};

export type IngredientLibrarySourceSample = {
  trace_id: string;
  brand: string;
  name: string;
  one_sentence: string;
  ingredient: Record<string, unknown>;
};

export type IngredientLibraryProfile = {
  summary: string;
  benefits: string[];
  risks: string[];
  usage_tips: string[];
  suitable_for: string[];
  avoid_for: string[];
  confidence: number;
  reason: string;
  analysis_text: string;
};

export type IngredientLibraryDetailItem = {
  ingredient_id: string;
  category: string;
  ingredient_name: string;
  ingredient_name_en?: string | null;
  ingredient_key?: string | null;
  source_count: number;
  source_trace_ids: string[];
  source_samples: IngredientLibrarySourceSample[];
  source_json: Record<string, unknown>;
  generated_at?: string | null;
  generator: Record<string, unknown>;
  profile: IngredientLibraryProfile;
  storage_path: string;
};

type IngredientLibraryDetailResponse = {
  status: string;
  item: IngredientLibraryDetailItem;
};

export type MobileWikiFacet = {
  key: string;
  label: string;
  count: number;
};

export type MobileWikiProductItem = {
  product: Product;
  category_label: string;
  target_type_key?: string | null;
  target_type_title?: string | null;
  target_type_level: "subcategory" | "category" | "unknown";
  mapping_ready: boolean;
  primary_confidence?: number | null;
  secondary_type_key?: string | null;
  secondary_type_title?: string | null;
  secondary_confidence?: number | null;
  is_featured: boolean;
};

type MobileWikiProductListResponse = {
  status: string;
  category?: string | null;
  target_type_key?: string | null;
  query?: string | null;
  total: number;
  offset: number;
  limit: number;
  categories: MobileWikiFacet[];
  subtypes: MobileWikiFacet[];
  items: MobileWikiProductItem[];
};

export type MobileWikiProductDetailResponse = {
  status: string;
  item: MobileWikiProductItem & {
    doc: ProductDoc;
    ingredient_refs: Array<{
      index: number;
      name: string;
      ingredient_id?: string | null;
      status: "resolved" | "unresolved" | "conflict";
      matched_alias?: string | null;
      reason?: string | null;
    }>;
  };
};

export type MobileSelectionResolveRequest = {
  category: CategoryKey;
  answers: Record<string, string>;
  reuse_existing?: boolean;
};

export type MobileSelectionChoice = {
  key: string;
  value: string;
  label: string;
};

export type MobileSelectionRuleHit = {
  rule: string;
  effect: string;
};

export type MobileSelectionRecommendationSource =
  | "featured_slot"
  | "route_mapping"
  | "category_fallback";

export type MobileSelectionMatrixRouteScore = {
  route_key: string;
  route_title: string;
  score_before_mask: number;
  score_after_mask?: number | null;
  is_excluded: boolean;
  rank: number;
  gap_from_best?: number | null;
};

export type MobileSelectionMatrixQuestionRouteDelta = {
  route_key: string;
  route_title: string;
  delta: number;
};

export type MobileSelectionMatrixQuestionContribution = {
  question_key: string;
  question_title: string;
  answer_value: string;
  answer_label: string;
  route_deltas: MobileSelectionMatrixQuestionRouteDelta[];
};

export type MobileSelectionMatrixVetoRoute = {
  route_key: string;
  route_title: string;
};

export type MobileSelectionMatrixTriggeredVeto = {
  trigger: string;
  note: string;
  excluded_routes: MobileSelectionMatrixVetoRoute[];
};

export type MobileSelectionMatrixTopRoute = {
  route_key: string;
  route_title: string;
  score_after_mask: number;
};

export type MobileSelectionMatrixAnalysis = {
  routes: MobileSelectionMatrixRouteScore[];
  question_contributions: MobileSelectionMatrixQuestionContribution[];
  triggered_vetoes: MobileSelectionMatrixTriggeredVeto[];
  top2: MobileSelectionMatrixTopRoute[];
};

export type MobileSelectionResolveResponse = {
  status: string;
  session_id: string;
  reused: boolean;
  is_pinned: boolean;
  pinned_at?: string | null;
  category: CategoryKey;
  rules_version: string;
  route: {
    key: string;
    title: string;
  };
  choices: MobileSelectionChoice[];
  rule_hits: MobileSelectionRuleHit[];
  recommendation_source: MobileSelectionRecommendationSource;
  matrix_analysis: MobileSelectionMatrixAnalysis;
  recommended_product: Product;
  links: {
    product: string;
    wiki: string;
  };
  created_at: string;
};

export type MobileSelectionPinRequest = {
  pinned: boolean;
};

export type MobileCompareCategoryItem = {
  key: CategoryKey;
  label: string;
  enabled: boolean;
};

export type MobileCompareProductLibraryItem = {
  product: Product;
  is_recommendation: boolean;
  is_most_used: boolean;
  usage_count: number;
};

export type MobileCompareBootstrapResponse = {
  status: string;
  trace_id: string;
  categories: MobileCompareCategoryItem[];
  selected_category: CategoryKey;
  profile: {
    has_history_profile: boolean;
    basis: "none" | "latest" | "pinned";
    can_skip: boolean;
    last_completed_at?: string | null;
    summary: string[];
  };
  recommendation: {
    exists: boolean;
    session_id?: string | null;
    route_key?: string | null;
    route_title?: string | null;
    product?: Product | null;
  };
  product_library: {
    recommendation_product_id?: string | null;
    most_used_product_id?: string | null;
    items: MobileCompareProductLibraryItem[];
  };
  source_guide: {
    title: string;
    value_points: string[];
  };
};

export type MobileCompareJobTargetInput = {
  source: "upload_new" | "history_product";
  upload_id?: string | null;
  product_id?: string | null;
};

export type MobileCompareJobRequest = {
  category: CategoryKey;
  profile_mode: "reuse_latest";
  targets: MobileCompareJobTargetInput[];
  options?: {
    language?: string;
    include_inci_order_diff?: boolean;
    include_function_rank_diff?: boolean;
  };
};

export type MobileCompareResultSection = {
  key: "keep_benefits" | "keep_watchouts" | "ingredient_order_diff" | "profile_fit_advice";
  title: string;
  items: string[];
};

export type MobileCompareResult = {
  status: string;
  trace_id: string;
  compare_id: string;
  category: CategoryKey;
  personalization: {
    status: string;
    basis: string;
    missing_fields: string[];
  };
  verdict: {
    decision: "keep" | "switch" | "hybrid";
    headline: string;
    confidence: number;
  };
  sections: MobileCompareResultSection[];
  ingredient_diff: {
    overlap: string[];
    only_current: string[];
    only_recommended: string[];
    inci_order_diff: Array<{
      ingredient: string;
      current_rank: number;
      recommended_rank: number;
    }>;
    function_rank_diff: Array<{
      function: string;
      current_score: number;
      recommended_score: number;
    }>;
  };
  transparency: {
    model?: string | null;
    warnings: string[];
    missing_fields: string[];
  };
  recommendation: MobileSelectionResolveResponse;
  current_product: ProductDoc;
  recommended_product: ProductDoc;
  products?: Array<{
    target_id: string;
    source: "upload_new" | "history_product";
    brand?: string | null;
    name?: string | null;
    one_sentence?: string | null;
  }>;
  pair_results?: Array<{
    pair_key: string;
    left_target_id: string;
    right_target_id: string;
    left_title: string;
    right_title: string;
    verdict: {
      decision: "keep" | "switch" | "hybrid";
      headline: string;
      confidence: number;
    };
    sections: MobileCompareResultSection[];
    ingredient_diff: {
      overlap: string[];
      only_current: string[];
      only_recommended: string[];
      inci_order_diff: Array<{
        ingredient: string;
        current_rank: number;
        recommended_rank: number;
      }>;
      function_rank_diff: Array<{
        function: string;
        current_score: number;
        recommended_score: number;
      }>;
    };
  }>;
  overall?: {
    decision: "keep" | "switch" | "hybrid";
    headline: string;
    confidence: number;
    summary_items: string[];
  } | null;
  created_at: string;
};

export type MobileCompareSession = {
  status: "running" | "done" | "failed";
  compare_id: string;
  category: CategoryKey | string;
  created_at: string;
  updated_at: string;
  stage?: string | null;
  stage_label?: string | null;
  message?: string | null;
  percent: number;
  pair_index?: number | null;
  pair_total?: number | null;
  targets_snapshot?: MobileCompareJobTargetInput[];
  result?: {
    decision?: "keep" | "switch" | "hybrid" | null;
    headline?: string | null;
    confidence: number;
    created_at?: string | null;
  } | null;
  error?: {
    code: string;
    detail: string;
    http_status: number;
    retryable: boolean;
  } | null;
};

export type SSEEvent = {
  event: string;
  data: Record<string, unknown>;
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

async function postSSE<T>(path: string, init: RequestInit, onEvent: (event: SSEEvent) => void): Promise<T> {
  const base = getBaseForFetch();
  const url = base ? new URL(path, base).toString() : path;
  const headersValue = new Headers({
    accept: "text/event-stream",
  });

  const initHeaders = new Headers(init.headers || {});
  initHeaders.forEach((value, key) => {
    headersValue.set(key, value);
  });

  const response = await fetch(url, {
    ...init,
    headers: headersValue,
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`${path} ${response.status}: ${text}`);
  }

  if (!response.body) {
    throw new Error(`${path}: stream body is empty`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: T | null = null;
  let finalError: string | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r\n/g, "\n");

    while (true) {
      const splitIndex = buffer.indexOf("\n\n");
      if (splitIndex < 0) break;
      const raw = buffer.slice(0, splitIndex).trim();
      buffer = buffer.slice(splitIndex + 2);
      if (!raw || raw.startsWith(":")) continue;

      let event = "message";
      const dataLines: string[] = [];
      for (const line of raw.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }

      const dataRaw = dataLines.join("\n");
      let data: Record<string, unknown> = {};
      try {
        data = dataRaw ? (JSON.parse(dataRaw) as Record<string, unknown>) : {};
      } catch {
        data = { raw: dataRaw };
      }

      onEvent({ event, data });
      if (event === "result") {
        finalResult = data as T;
      } else if (event === "error") {
        finalError = typeof data.detail === "string" ? data.detail : JSON.stringify(data);
      }
    }
  }

  if (finalError) {
    throw new Error(finalError);
  }
  if (finalResult == null) {
    throw new Error(`${path}: stream ended without result`);
  }
  return finalResult;
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

export async function fetchIngredientLibrary(params?: {
  category?: string;
  q?: string;
  offset?: number;
  limit?: number;
}): Promise<IngredientLibraryListResponse> {
  const search = new URLSearchParams();
  if (params?.category) search.set("category", params.category);
  if (params?.q) search.set("q", params.q);
  if (typeof params?.offset === "number") search.set("offset", String(params.offset));
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  const query = search.toString();
  const path = query ? `/api/products/ingredients/library?${query}` : "/api/products/ingredients/library";
  return apiFetch<IngredientLibraryListResponse>(path);
}

export async function fetchIngredientLibraryItem(category: string, ingredientId: string): Promise<IngredientLibraryDetailItem> {
  const categoryValue = category.trim();
  const ingredientValue = ingredientId.trim();
  if (!categoryValue || !ingredientValue) {
    throw new Error("category and ingredientId are required.");
  }
  const path = `/api/products/ingredients/library/${encodeURIComponent(categoryValue)}/${encodeURIComponent(ingredientValue)}`;
  const response = await apiFetch<IngredientLibraryDetailResponse>(path);
  return response.item;
}

export async function fetchMobileWikiProducts(params?: {
  category?: CategoryKey;
  target_type_key?: string;
  q?: string;
  offset?: number;
  limit?: number;
}): Promise<MobileWikiProductListResponse> {
  const search = new URLSearchParams();
  if (params?.category) search.set("category", params.category);
  if (params?.target_type_key) search.set("target_type_key", params.target_type_key);
  if (params?.q) search.set("q", params.q);
  if (typeof params?.offset === "number") search.set("offset", String(params.offset));
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  const query = search.toString();
  const path = query ? `/api/mobile/wiki/products?${query}` : "/api/mobile/wiki/products";
  return apiFetch<MobileWikiProductListResponse>(path);
}

export async function fetchMobileWikiProductDetail(productId: string): Promise<MobileWikiProductDetailResponse["item"]> {
  const value = productId.trim();
  if (!value) throw new Error("productId is required.");
  const response = await apiFetch<MobileWikiProductDetailResponse>(`/api/mobile/wiki/products/${encodeURIComponent(value)}`);
  return response.item;
}

export async function resolveMobileSelection(
  payload: MobileSelectionResolveRequest,
): Promise<MobileSelectionResolveResponse> {
  return apiFetch<MobileSelectionResolveResponse>("/api/mobile/selection/resolve", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchMobileSelectionSession(sessionId: string): Promise<MobileSelectionResolveResponse> {
  const value = sessionId.trim();
  if (!value) throw new Error("sessionId is required.");
  return apiFetch<MobileSelectionResolveResponse>(`/api/mobile/selection/sessions/${encodeURIComponent(value)}`);
}

export async function listMobileSelectionSessions(params?: {
  category?: CategoryKey;
  offset?: number;
  limit?: number;
}): Promise<MobileSelectionResolveResponse[]> {
  const search = new URLSearchParams();
  if (params?.category) search.set("category", params.category);
  if (typeof params?.offset === "number") search.set("offset", String(params.offset));
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  const query = search.toString();
  const path = query ? `/api/mobile/selection/sessions?${query}` : "/api/mobile/selection/sessions";
  return apiFetch<MobileSelectionResolveResponse[]>(path);
}

export async function pinMobileSelectionSession(
  sessionId: string,
  payload: MobileSelectionPinRequest,
): Promise<MobileSelectionResolveResponse> {
  const value = sessionId.trim();
  if (!value) throw new Error("sessionId is required.");
  return apiFetch<MobileSelectionResolveResponse>(`/api/mobile/selection/sessions/${encodeURIComponent(value)}/pin`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
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

export async function fetchMobileCompareBootstrap(category?: CategoryKey): Promise<MobileCompareBootstrapResponse> {
  const query = category ? `?category=${encodeURIComponent(category)}` : "";
  return apiFetch<MobileCompareBootstrapResponse>(`/api/mobile/compare/bootstrap${query}`);
}

export async function runMobileCompareJobStream(
  payload: MobileCompareJobRequest,
  onEvent: (event: SSEEvent) => void,
): Promise<MobileCompareResult> {
  return postSSE<MobileCompareResult>(
    "/api/mobile/compare/jobs/stream",
    {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
    },
    onEvent,
  );
}

export async function fetchMobileCompareResult(compareId: string): Promise<MobileCompareResult> {
  const value = compareId.trim();
  if (!value) throw new Error("compareId is required.");
  return apiFetch<MobileCompareResult>(`/api/mobile/compare/results/${encodeURIComponent(value)}`);
}

export async function listMobileCompareSessions(params?: {
  category?: CategoryKey;
  offset?: number;
  limit?: number;
}): Promise<MobileCompareSession[]> {
  const search = new URLSearchParams();
  if (params?.category) search.set("category", params.category);
  if (typeof params?.offset === "number") search.set("offset", String(params.offset));
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  const query = search.toString();
  const path = query ? `/api/mobile/compare/sessions?${query}` : "/api/mobile/compare/sessions";
  return apiFetch<MobileCompareSession[]>(path);
}

export function resolveImageUrl(product: Product): string {
  if (!product.image_url) return "/placeholder-product.svg";
  return normalizePublicImagePath(product.image_url);
}

export function resolveStoredImageUrl(imagePath?: string | null): string | null {
  if (!imagePath) return null;
  return normalizePublicImagePath(imagePath);
}
