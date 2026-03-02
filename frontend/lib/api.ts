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
  suggestions: ProductDedupSuggestion[];
  involved_products: Product[];
  failures: string[];
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

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getBaseForFetch();

  // path 统一要求以 / 开头
  const url = base ? new URL(path, base).toString() : path;

  const res = await fetch(url, {
    ...init,
    // 生产建议不缓存（你也可以按需调）
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
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

export async function deleteProductsBatch(payload: ProductBatchDeleteRequest): Promise<ProductBatchDeleteResponse> {
  return apiFetch<ProductBatchDeleteResponse>("/api/products/batch-delete", {
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
  status: string;
  trace_id: string;
  category?: string;
  image_path?: string | null;
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

  const res = await fetch(url, { method: "POST", body: fd });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`INGEST ${res.status}: ${text}`);
  }
  return (await res.json()) as IngestResult;
}

export async function ingestProductStage1(input: Pick<IngestInput, "image" | "category" | "brand" | "name">): Promise<IngestStage1Result> {
  const base = getBaseForFetch();
  const url = base ? new URL("/api/upload/stage1", base).toString() : "/api/upload/stage1";
  const fd = new FormData();
  if (input.image) fd.append("image", input.image);
  if (input.category) fd.append("category", input.category);
  if (input.brand) fd.append("brand", input.brand);
  if (input.name) fd.append("name", input.name);

  const res = await fetch(url, { method: "POST", body: fd });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`STAGE1 ${res.status}: ${text}`);
  }
  return (await res.json()) as IngestStage1Result;
}

export async function ingestProductStage1Stream(
  input: Pick<IngestInput, "image" | "category" | "brand" | "name">,
  onEvent: (event: SSEEvent) => void,
): Promise<IngestStage1Result> {
  const fd = new FormData();
  if (input.image) fd.append("image", input.image);
  if (input.category) fd.append("category", input.category);
  if (input.brand) fd.append("brand", input.brand);
  if (input.name) fd.append("name", input.name);
  return postSSE<IngestStage1Result>("/api/upload/stage1/stream", { method: "POST", body: fd }, onEvent);
}

export async function ingestProductStage2(input: Pick<IngestInput, "category" | "brand" | "name"> & { traceId: string }): Promise<IngestResult> {
  const base = getBaseForFetch();
  const url = base ? new URL("/api/upload/stage2", base).toString() : "/api/upload/stage2";
  const fd = new FormData();
  fd.append("trace_id", input.traceId);
  if (input.category) fd.append("category", input.category);
  if (input.brand) fd.append("brand", input.brand);
  if (input.name) fd.append("name", input.name);

  const res = await fetch(url, { method: "POST", body: fd });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`STAGE2 ${res.status}: ${text}`);
  }
  return (await res.json()) as IngestResult;
}

export async function ingestProductStage2Stream(
  input: Pick<IngestInput, "category" | "brand" | "name"> & { traceId: string },
  onEvent: (event: SSEEvent) => void,
): Promise<IngestResult> {
  const fd = new FormData();
  fd.append("trace_id", input.traceId);
  if (input.category) fd.append("category", input.category);
  if (input.brand) fd.append("brand", input.brand);
  if (input.name) fd.append("name", input.name);
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
  const url = base ? new URL(path, base).toString() : path;
  const res = await fetch(url, {
    ...init,
    headers: {
      accept: "text/event-stream",
      ...(init.headers || {}),
    },
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
