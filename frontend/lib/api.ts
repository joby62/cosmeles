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

export type ProductListMeta = {
  total: number;
  offset: number;
  limit: number;
};

export type ProductListResponse = {
  items: Product[];
  meta: ProductListMeta;
};

export type ProductDedupSuggestRequest = {
  category?: string;
  title_query?: string;
  ingredient_hints?: string[];
  model_tier?: "mini" | "lite" | "pro";
  max_scan_products?: number;
  max_compare_per_product?: number;
  compare_batch_size?: number;
  min_confidence?: number;
};

export type ProductDedupSuggestion = {
  group_id: string;
  keep_id: string;
  remove_ids: string[];
  confidence: number;
  reason?: string;
  analysis_text?: string | null;
  compared_ids?: string[];
};

export type ProductDedupSuggestResponse = {
  status: string;
  scanned_products: number;
  requested_model_tier?: "mini" | "lite" | "pro" | null;
  model?: string | null;
  suggestions: ProductDedupSuggestion[];
  involved_products: Product[];
  failures: string[];
};

export type IngredientLibraryBuildRequest = {
  category?: string;
  force_regenerate?: boolean;
  max_sources_per_ingredient?: number;
};

export type IngredientLibraryBuildItem = {
  ingredient_id: string;
  category: string;
  ingredient_name: string;
  ingredient_name_en?: string | null;
  source_count: number;
  source_trace_ids: string[];
  storage_path?: string | null;
  status: "created" | "updated" | "skipped" | "failed";
  model?: string | null;
  error?: string | null;
};

export type IngredientLibraryBuildResponse = {
  status: string;
  scanned_products: number;
  unique_ingredients: number;
  backfilled_from_storage: number;
  submitted_to_model: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  items: IngredientLibraryBuildItem[];
  failures: string[];
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

export type IngredientLibraryListResponse = {
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
  generated_at?: string | null;
  generator: Record<string, unknown>;
  profile: IngredientLibraryProfile;
  storage_path: string;
};

export type IngredientLibraryDetailResponse = {
  status: string;
  item: IngredientLibraryDetailItem;
};

export type ProductRouteMappingScore = {
  route_key: string;
  route_title: string;
  confidence: number;
  reason: string;
};

export type ProductRouteMappingEvidenceItem = {
  ingredient_name_cn: string;
  ingredient_name_en: string;
  rank: number;
  impact: string;
};

export type ProductRouteMappingEvidence = {
  positive: ProductRouteMappingEvidenceItem[];
  counter: ProductRouteMappingEvidenceItem[];
};

export type ProductRouteMappingResult = {
  product_id: string;
  category: string;
  rules_version: string;
  fingerprint: string;
  generated_at: string;
  prompt_key: string;
  prompt_version: string;
  model: string;
  primary_route: ProductRouteMappingScore;
  secondary_route: ProductRouteMappingScore;
  route_scores: ProductRouteMappingScore[];
  evidence: ProductRouteMappingEvidence;
  confidence_reason: string;
  needs_review: boolean;
  analysis_text: string;
  storage_path: string;
};

export type ProductRouteMappingBuildRequest = {
  category?: string;
  force_regenerate?: boolean;
  only_unmapped?: boolean;
};

export type ProductRouteMappingBuildItem = {
  product_id: string;
  category: string;
  status: "created" | "updated" | "skipped" | "failed";
  primary_route?: ProductRouteMappingScore | null;
  secondary_route?: ProductRouteMappingScore | null;
  route_scores: ProductRouteMappingScore[];
  storage_path?: string | null;
  model?: string | null;
  error?: string | null;
};

export type ProductRouteMappingBuildResponse = {
  status: string;
  scanned_products: number;
  submitted_to_model: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  items: ProductRouteMappingBuildItem[];
  failures: string[];
};

export type ProductRouteMappingDetailResponse = {
  status: string;
  item: ProductRouteMappingResult;
};

export type ProductRouteMappingIndexItem = {
  product_id: string;
  category: string;
  status: string;
  primary_route_key: string;
  primary_route_title: string;
  primary_confidence: number;
  secondary_route_key?: string | null;
  secondary_route_title?: string | null;
  secondary_confidence?: number | null;
  needs_review: boolean;
  rules_version: string;
  last_generated_at?: string | null;
};

export type ProductRouteMappingIndexListResponse = {
  status: string;
  category?: string | null;
  total: number;
  items: ProductRouteMappingIndexItem[];
};

export type ProductFeaturedSlotItem = {
  category: string;
  target_type_key: string;
  product_id: string;
  updated_at: string;
  updated_by?: string | null;
};

export type ProductFeaturedSlotListResponse = {
  status: string;
  category?: string | null;
  total: number;
  items: ProductFeaturedSlotItem[];
};

export type ProductBatchDeleteRequest = {
  ids: string[];
  keep_ids?: string[];
  remove_doubao_artifacts?: boolean;
};

export type ProductBatchDeleteResponse = {
  status: string;
  deleted_ids: string[];
  skipped_ids: string[];
  missing_ids: string[];
  removed_files: number;
  removed_dirs: number;
};

export type OrphanStorageCleanupRequest = {
  dry_run?: boolean;
  min_age_minutes?: number;
  max_delete?: number;
};

export type OrphanStorageCleanupResponse = {
  status: string;
  dry_run: boolean;
  min_age_minutes: number;
  max_delete: number;
  images: {
    scanned_images: number;
    kept_images: number;
    orphan_images: number;
    deleted_images: number;
    orphan_paths: string[];
    deleted_paths: string[];
  };
  runs: {
    scanned_runs: number;
    kept_runs: number;
    orphan_runs: number;
    deleted_runs: number;
    deleted_run_files: number;
    orphan_run_dirs: string[];
    deleted_run_dirs: string[];
  };
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
    name: string;
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
    doubao_models?: Record<string, string> | null;
    doubao_artifacts?: Record<string, string> | null;
  };
};

export type AIJobCreateRequest = {
  capability: string;
  input: Record<string, unknown>;
  trace_id?: string;
  run_immediately?: boolean;
};

export type SSEEvent = {
  event: string;
  data: Record<string, unknown>;
};

export type AIJobView = {
  id: string;
  capability: string;
  status: string;
  trace_id?: string | null;
  input: Record<string, unknown>;
  output?: Record<string, unknown> | null;
  prompt_key?: string | null;
  prompt_version?: string | null;
  model?: string | null;
  error_code?: string | null;
  error_http_status?: number | null;
  error_message?: string | null;
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
};

export type AIRunView = {
  id: string;
  job_id: string;
  capability: string;
  status: string;
  prompt_key?: string | null;
  prompt_version?: string | null;
  model?: string | null;
  request: Record<string, unknown>;
  response?: Record<string, unknown> | null;
  latency_ms?: number | null;
  error_code?: string | null;
  error_http_status?: number | null;
  error_message?: string | null;
  created_at: string;
};

export type AIMetricsSummary = {
  capability?: string | null;
  since_hours: number;
  window_start: string;
  total_jobs: number;
  succeeded_jobs: number;
  failed_jobs: number;
  running_jobs: number;
  queued_jobs: number;
  success_rate: number;
  timeout_failures: number;
  timeout_rate: number;
  total_runs: number;
  succeeded_runs: number;
  failed_runs: number;
  avg_latency_ms?: number | null;
  p95_latency_ms?: number | null;
  total_estimated_cost: number;
  avg_task_cost?: number | null;
  priced_runs: number;
  cost_coverage_rate: number;
};

export type MobileSelectionCategory = "shampoo" | "bodywash" | "conditioner" | "lotion" | "cleanser";

export type MobileSelectionResolveRequest = {
  category: MobileSelectionCategory;
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

export type MobileSelectionResolveResponse = {
  status: string;
  session_id: string;
  reused: boolean;
  is_pinned: boolean;
  pinned_at?: string | null;
  category: MobileSelectionCategory;
  rules_version: string;
  route: {
    key: string;
    title: string;
  };
  choices: MobileSelectionChoice[];
  rule_hits: MobileSelectionRuleHit[];
  recommended_product: Product;
  links: {
    product: string;
    wiki: string;
  };
  created_at: string;
};

export type MobileSelectionBatchDeleteRequest = {
  ids: string[];
};

export type MobileSelectionBatchDeleteResponse = {
  status: string;
  deleted_ids: string[];
  not_found_ids: string[];
  forbidden_ids: string[];
};

export type MobileSelectionPinRequest = {
  pinned: boolean;
};

export type MobileCompareCategoryItem = {
  key: MobileSelectionCategory;
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
  selected_category: MobileSelectionCategory;
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

export type MobileCompareUploadResponse = {
  status: string;
  trace_id: string;
  upload_id: string;
  category: MobileSelectionCategory;
  image_path?: string | null;
  created_at: string;
};

export type MobileCompareJobTargetInput = {
  source: "upload_new" | "history_product";
  upload_id?: string | null;
  product_id?: string | null;
};

export type MobileCompareJobRequest = {
  category: MobileSelectionCategory;
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
  category: MobileSelectionCategory;
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
  category: MobileSelectionCategory | string;
  created_at: string;
  updated_at: string;
  stage?: string | null;
  stage_label?: string | null;
  message?: string | null;
  percent: number;
  pair_index?: number | null;
  pair_total?: number | null;
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

function getBaseForFetch(): string {
  // 在浏览器里优先直连后端，避免 /api 重写层在 multipart 上传时吞掉真实错误。
  if (typeof window !== "undefined") {
    const pageProtocol = window.location.protocol;
    const isHttpsPage = pageProtocol === "https:";
    const direct = process.env.NEXT_PUBLIC_API_BASE?.trim();

    // HTTPS 页面下强制走同源，避免 Mixed Content（https 页面请求 http://...）
    // 生产域名场景应由 Next rewrite/Caddy 转发到后端，而不是浏览器直连 :8000。
    if (isHttpsPage) return "";

    if (direct) {
      try {
        const url = new URL(direct);
        const currentHost = window.location.hostname;
        const isLoopback = url.hostname === "127.0.0.1" || url.hostname === "localhost";
        const isRemotePage = currentHost !== "127.0.0.1" && currentHost !== "localhost";
        // 页面运行在远端 IP/域名时，避免把请求打到本机 loopback 导致 CORS 失败。
        if (isLoopback && isRemotePage) {
          url.hostname = currentHost;
        }
        return url.toString().replace(/\/$/, "");
      } catch {
        return direct.replace(/\/$/, "");
      }
    }
    return "";
  }

  // 在 Next Server/SSR 里：Node fetch 需要绝对 URL
  // 走 nginx 容器名（docker compose 内部 DNS）
  return process.env.INTERNAL_API_BASE || "http://nginx";
}

async function getForwardedServerHeaders(): Promise<Record<string, string>> {
  if (typeof window !== "undefined") return {};
  try {
    const { headers } = await import("next/headers");
    const incoming = await headers();
    const out: Record<string, string> = {};

    const cookie = incoming.get("cookie");
    if (cookie) out.cookie = cookie;

    const deviceId = incoming.get("x-mobile-device-id");
    if (deviceId) out["x-mobile-device-id"] = deviceId;
    return out;
  } catch {
    return {};
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getBaseForFetch();
  const forwarded = await getForwardedServerHeaders();

  // path 统一要求以 / 开头
  const url = base ? new URL(path, base).toString() : path;
  const headers = new Headers({
    "content-type": "application/json",
    ...forwarded,
  });
  const initHeaders = new Headers(init?.headers || {});
  initHeaders.forEach((value, key) => {
    headers.set(key, value);
  });

  const res = await fetch(url, {
    ...init,
    // 生产建议不缓存（你也可以按需调）
    cache: "no-store",
    credentials: "include",
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export async function fetchProducts(): Promise<Product[]> {
  return apiFetch<Product[]>("/api/products");
}

export async function fetchAllProducts(): Promise<Product[]> {
  const limit = 200;
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;
  const out: Product[] = [];

  while (offset < total) {
    const page = await apiFetch<ProductListResponse>(`/api/products/page?offset=${offset}&limit=${limit}`);
    out.push(...page.items);
    total = page.meta.total;
    offset += page.meta.limit;
    if (page.items.length === 0) break;
  }

  return out;
}

export async function fetchProduct(id: string): Promise<Product> {
  return apiFetch<Product>(`/api/products/${id}`);
}

export async function fetchProductDoc(id: string): Promise<ProductDoc> {
  return apiFetch<ProductDoc>(`/api/products/${id}`);
}

export async function suggestProductDuplicates(payload: ProductDedupSuggestRequest): Promise<ProductDedupSuggestResponse> {
  return apiFetch<ProductDedupSuggestResponse>("/api/products/dedup/suggest", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function suggestProductDuplicatesStream(
  payload: ProductDedupSuggestRequest,
  onEvent: (event: SSEEvent) => void,
): Promise<ProductDedupSuggestResponse> {
  return postSSE<ProductDedupSuggestResponse>(
    "/api/products/dedup/suggest/stream",
    {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
    },
    onEvent,
  );
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

export async function fetchIngredientLibraryItem(
  category: string,
  ingredientId: string,
): Promise<IngredientLibraryDetailResponse> {
  const categoryValue = category.trim();
  const ingredientValue = ingredientId.trim();
  if (!categoryValue || !ingredientValue) {
    throw new Error("category and ingredientId are required.");
  }
  const path = `/api/products/ingredients/library/${encodeURIComponent(categoryValue)}/${encodeURIComponent(ingredientValue)}`;
  return apiFetch<IngredientLibraryDetailResponse>(path);
}

export async function buildIngredientLibraryStream(
  payload: IngredientLibraryBuildRequest,
  onEvent: (event: SSEEvent) => void,
): Promise<IngredientLibraryBuildResponse> {
  return postSSE<IngredientLibraryBuildResponse>(
    "/api/products/ingredients/library/build/stream",
    {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
    },
    onEvent,
  );
}

export async function buildProductRouteMappingStream(
  payload: ProductRouteMappingBuildRequest,
  onEvent: (event: SSEEvent) => void,
): Promise<ProductRouteMappingBuildResponse> {
  return postSSE<ProductRouteMappingBuildResponse>(
    "/api/products/route-mapping/build/stream",
    {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
    },
    onEvent,
  );
}

export async function fetchProductRouteMapping(
  productId: string,
): Promise<ProductRouteMappingDetailResponse> {
  const value = productId.trim();
  if (!value) throw new Error("productId is required.");
  return apiFetch<ProductRouteMappingDetailResponse>(
    `/api/products/${encodeURIComponent(value)}/route-mapping`,
  );
}

export async function fetchProductRouteMappingIndex(params?: {
  category?: string;
}): Promise<ProductRouteMappingIndexListResponse> {
  const search = new URLSearchParams();
  if (params?.category) search.set("category", params.category);
  const query = search.toString();
  const path = query ? `/api/products/route-mapping/index?${query}` : "/api/products/route-mapping/index";
  return apiFetch<ProductRouteMappingIndexListResponse>(path);
}

export async function fetchProductFeaturedSlots(params?: {
  category?: string;
}): Promise<ProductFeaturedSlotListResponse> {
  const search = new URLSearchParams();
  if (params?.category) search.set("category", params.category);
  const query = search.toString();
  const path = query ? `/api/products/featured-slots?${query}` : "/api/products/featured-slots";
  return apiFetch<ProductFeaturedSlotListResponse>(path);
}

export async function setProductFeaturedSlot(payload: {
  category: string;
  target_type_key: string;
  product_id: string;
  updated_by?: string;
}): Promise<ProductFeaturedSlotItem> {
  return apiFetch<ProductFeaturedSlotItem>("/api/products/featured-slots", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function clearProductFeaturedSlot(payload: {
  category: string;
  target_type_key: string;
}): Promise<{ status: string; category: string; target_type_key: string; deleted: boolean }> {
  return apiFetch<{ status: string; category: string; target_type_key: string; deleted: boolean }>(
    "/api/products/featured-slots/clear",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function deleteProductsBatch(payload: ProductBatchDeleteRequest): Promise<ProductBatchDeleteResponse> {
  return apiFetch<ProductBatchDeleteResponse>("/api/products/batch-delete", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function cleanupOrphanStorage(payload: OrphanStorageCleanupRequest): Promise<OrphanStorageCleanupResponse> {
  return apiFetch<OrphanStorageCleanupResponse>("/api/maintenance/storage/orphans/cleanup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createAIJob(payload: AIJobCreateRequest): Promise<AIJobView> {
  return apiFetch<AIJobView>("/api/ai/jobs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createAIJobStream(
  payload: AIJobCreateRequest,
  onEvent: (event: SSEEvent) => void,
): Promise<AIJobView> {
  const result = await postSSE<{ job?: AIJobView }>("/api/ai/jobs/stream", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "content-type": "application/json" },
  }, onEvent);

  if (!result.job) {
    throw new Error("AI stream finished without final job result.");
  }
  return result.job;
}

export async function fetchAIRuns(params?: {
  jobId?: string;
  offset?: number;
  limit?: number;
}): Promise<AIRunView[]> {
  const search = new URLSearchParams();
  if (params?.jobId) search.set("job_id", params.jobId);
  if (typeof params?.offset === "number") search.set("offset", String(params.offset));
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  const query = search.toString();
  const path = query ? `/api/ai/runs?${query}` : "/api/ai/runs";
  return apiFetch<AIRunView[]>(path);
}

export async function fetchLatestAIRunByJobId(jobId: string): Promise<AIRunView | null> {
  const runs = await fetchAIRuns({ jobId, limit: 1, offset: 0 });
  return runs[0] || null;
}

export async function fetchAIMetricsSummary(params?: {
  capability?: string;
  sinceHours?: number;
}): Promise<AIMetricsSummary> {
  const search = new URLSearchParams();
  if (params?.capability) search.set("capability", params.capability);
  if (typeof params?.sinceHours === "number") search.set("since_hours", String(params.sinceHours));
  const query = search.toString();
  const path = query ? `/api/ai/metrics/summary?${query}` : "/api/ai/metrics/summary";
  return apiFetch<AIMetricsSummary>(path);
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
  return apiFetch<MobileSelectionResolveResponse>(`/api/mobile/selection/sessions/${encodeURIComponent(sessionId)}`);
}

export async function listMobileSelectionSessions(params?: {
  category?: MobileSelectionCategory;
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

export async function deleteMobileSelectionSessionsBatch(
  payload: MobileSelectionBatchDeleteRequest,
): Promise<MobileSelectionBatchDeleteResponse> {
  return apiFetch<MobileSelectionBatchDeleteResponse>("/api/mobile/selection/sessions/batch/delete", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function pinMobileSelectionSession(
  sessionId: string,
  payload: MobileSelectionPinRequest,
): Promise<MobileSelectionResolveResponse> {
  return apiFetch<MobileSelectionResolveResponse>(
    `/api/mobile/selection/sessions/${encodeURIComponent(sessionId)}/pin`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function fetchMobileCompareBootstrap(category?: MobileSelectionCategory): Promise<MobileCompareBootstrapResponse> {
  const query = category ? `?category=${encodeURIComponent(category)}` : "";
  return apiFetch<MobileCompareBootstrapResponse>(`/api/mobile/compare/bootstrap${query}`);
}

export async function uploadMobileCompareCurrentProduct(input: {
  category: MobileSelectionCategory;
  image: File;
  brand?: string;
  name?: string;
}): Promise<MobileCompareUploadResponse> {
  const base = getBaseForFetch();
  const url = base ? new URL("/api/mobile/compare/current-product/upload", base).toString() : "/api/mobile/compare/current-product/upload";
  const fd = new FormData();
  fd.append("category", input.category);
  fd.append("image", input.image);
  if (input.brand) fd.append("brand", input.brand);
  if (input.name) fd.append("name", input.name);

  const res = await fetch(url, {
    method: "POST",
    body: fd,
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`COMPARE_UPLOAD ${res.status}: ${text}`);
  }
  return (await res.json()) as MobileCompareUploadResponse;
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
  return apiFetch<MobileCompareResult>(`/api/mobile/compare/results/${encodeURIComponent(compareId)}`);
}

export async function fetchMobileCompareSession(compareId: string): Promise<MobileCompareSession> {
  return apiFetch<MobileCompareSession>(`/api/mobile/compare/sessions/${encodeURIComponent(compareId)}`);
}

export async function listMobileCompareSessions(params?: {
  category?: MobileSelectionCategory;
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

export async function recordMobileCompareEvent(name: string, props: Record<string, unknown> = {}): Promise<{ status: string; trace_id: string }> {
  return apiFetch<{ status: string; trace_id: string }>("/api/mobile/compare/events", {
    method: "POST",
    body: JSON.stringify({ name, props }),
  });
}

function normalizePublicImagePath(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return path.startsWith("/") ? path : `/${path}`;
}

// 图片 URL：统一返回浏览器可访问地址（优先同域相对路径）
export function resolveImageUrl(product: Product): string {
  const p = product.image_url || `/images/${product.id}.png`;
  return normalizePublicImagePath(p);
}

export function resolveStoredImageUrl(imagePath?: string | null): string | null {
  if (!imagePath) return null;
  return normalizePublicImagePath(imagePath);
}

export type IngestInput = {
  image?: File;
  category?: string;
  brand?: string;
  name?: string;
  source?: "manual" | "doubao" | "auto";
  metaJson?: string;
  stage1ModelTier?: "mini" | "lite" | "pro";
  stage2ModelTier?: "mini" | "lite" | "pro";
};

export type IngestResult = {
  id: string;
  status: string;
  mode?: string;
  category?: string;
  image_path?: string | null;
  json_path?: string | null;
  doubao?: {
    pipeline_mode?: string | null;
    models?: { vision?: string; struct?: string } | null;
    vision_text?: string | null;
    struct_text?: string | null;
    artifacts?: { vision?: string | null; struct?: string | null; context?: string | null } | null;
  } | null;
};

export type IngestStage1Result = {
  status: "ok" | "needs_more_images" | string;
  trace_id: string;
  category?: string;
  image_path?: string | null;
  image_paths?: string[];
  needs_more_images?: boolean;
  missing_fields?: string[];
  required_view?: string | null;
  doubao?: {
    pipeline_mode?: string | null;
    models?: { vision?: string; struct?: string } | null;
    vision_text?: string | null;
    artifacts?: { vision?: string | null; context?: string | null } | null;
  } | null;
  next?: string;
};

// 上传入口（MVP）：支持 image + metaJson，后续直接对接豆包比对流
export async function ingestProduct(input: IngestInput): Promise<IngestResult> {
  const base = getBaseForFetch();
  const url = base ? new URL("/api/upload", base).toString() : "/api/upload";

  const fd = new FormData();
  if (input.image) fd.append("image", input.image);
  if (input.category) fd.append("category", input.category);
  if (input.brand) fd.append("brand", input.brand);
  if (input.name) fd.append("name", input.name);
  if (input.source) fd.append("source", input.source);
  if (input.metaJson) fd.append("meta_json", input.metaJson);
  if (input.stage1ModelTier) fd.append("stage1_model_tier", input.stage1ModelTier);
  if (input.stage2ModelTier) fd.append("stage2_model_tier", input.stage2ModelTier);

  const res = await fetch(url, { method: "POST", body: fd });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`INGEST ${res.status}: ${text}`);
  }
  return (await res.json()) as IngestResult;
}

export async function ingestProductStage1(
  input: Pick<IngestInput, "image" | "category" | "brand" | "name"> & { modelTier?: "mini" | "lite" | "pro" },
): Promise<IngestStage1Result> {
  const base = getBaseForFetch();
  const url = base ? new URL("/api/upload/stage1", base).toString() : "/api/upload/stage1";
  const fd = new FormData();
  if (input.image) fd.append("image", input.image);
  if (input.category) fd.append("category", input.category);
  if (input.brand) fd.append("brand", input.brand);
  if (input.name) fd.append("name", input.name);
  if (input.modelTier) fd.append("model_tier", input.modelTier);

  const res = await fetch(url, { method: "POST", body: fd });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`STAGE1 ${res.status}: ${text}`);
  }
  return (await res.json()) as IngestStage1Result;
}

export async function ingestProductStage1Stream(
  input: Pick<IngestInput, "image" | "category" | "brand" | "name"> & { modelTier?: "mini" | "lite" | "pro" },
  onEvent: (event: SSEEvent) => void,
): Promise<IngestStage1Result> {
  const fd = new FormData();
  if (input.image) fd.append("image", input.image);
  if (input.category) fd.append("category", input.category);
  if (input.brand) fd.append("brand", input.brand);
  if (input.name) fd.append("name", input.name);
  if (input.modelTier) fd.append("model_tier", input.modelTier);
  return postSSE<IngestStage1Result>("/api/upload/stage1/stream", { method: "POST", body: fd }, onEvent);
}

export async function ingestProductStage1Supplement(
  input: { traceId: string; image: File; modelTier?: "mini" | "lite" | "pro" },
): Promise<IngestStage1Result> {
  const base = getBaseForFetch();
  const url = base ? new URL("/api/upload/stage1/supplement", base).toString() : "/api/upload/stage1/supplement";
  const fd = new FormData();
  fd.append("trace_id", input.traceId);
  fd.append("image", input.image);
  if (input.modelTier) fd.append("model_tier", input.modelTier);

  const res = await fetch(url, { method: "POST", body: fd });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`STAGE1_SUPPLEMENT ${res.status}: ${text}`);
  }
  return (await res.json()) as IngestStage1Result;
}

export async function ingestProductStage1SupplementStream(
  input: { traceId: string; image: File; modelTier?: "mini" | "lite" | "pro" },
  onEvent: (event: SSEEvent) => void,
): Promise<IngestStage1Result> {
  const fd = new FormData();
  fd.append("trace_id", input.traceId);
  fd.append("image", input.image);
  if (input.modelTier) fd.append("model_tier", input.modelTier);
  return postSSE<IngestStage1Result>("/api/upload/stage1/supplement/stream", { method: "POST", body: fd }, onEvent);
}

export async function ingestProductStage2(
  input: Pick<IngestInput, "category" | "brand" | "name"> & { traceId: string; modelTier?: "mini" | "lite" | "pro" },
): Promise<IngestResult> {
  const base = getBaseForFetch();
  const url = base ? new URL("/api/upload/stage2", base).toString() : "/api/upload/stage2";
  const fd = new FormData();
  fd.append("trace_id", input.traceId);
  if (input.category) fd.append("category", input.category);
  if (input.brand) fd.append("brand", input.brand);
  if (input.name) fd.append("name", input.name);
  if (input.modelTier) fd.append("model_tier", input.modelTier);

  const res = await fetch(url, { method: "POST", body: fd });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`STAGE2 ${res.status}: ${text}`);
  }
  return (await res.json()) as IngestResult;
}

export async function ingestProductStage2Stream(
  input: Pick<IngestInput, "category" | "brand" | "name"> & { traceId: string; modelTier?: "mini" | "lite" | "pro" },
  onEvent: (event: SSEEvent) => void,
): Promise<IngestResult> {
  const fd = new FormData();
  fd.append("trace_id", input.traceId);
  if (input.category) fd.append("category", input.category);
  if (input.brand) fd.append("brand", input.brand);
  if (input.name) fd.append("name", input.name);
  if (input.modelTier) fd.append("model_tier", input.modelTier);
  return postSSE<IngestResult>("/api/upload/stage2/stream", { method: "POST", body: fd }, onEvent);
}

// 兼容旧调用
export async function ingestImage(file: File): Promise<{ id: string }> {
  const result = await ingestProduct({ image: file, source: "auto" });
  return { id: result.id };
}

async function postSSE<T>(
  path: string,
  init: RequestInit,
  onEvent: (event: SSEEvent) => void,
): Promise<T> {
  const base = getBaseForFetch();
  const forwarded = await getForwardedServerHeaders();
  const url = base ? new URL(path, base).toString() : path;
  const headers = new Headers({
    ...forwarded,
    accept: "text/event-stream",
  });
  const initHeaders = new Headers(init.headers || {});
  initHeaders.forEach((value, key) => {
    headers.set(key, value);
  });
  const res = await fetch(url, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${path} ${res.status}: ${text}`);
  }

  if (!res.body) {
    throw new Error(`${path}: stream body is empty`);
  }

  const reader = res.body.getReader();
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
      const idx = buffer.indexOf("\n\n");
      if (idx < 0) break;
      const raw = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 2);
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
        const detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data);
        finalError = detail;
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
