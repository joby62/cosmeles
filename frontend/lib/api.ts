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

function getBaseForFetch(): string {
  // 在浏览器里优先直连后端，避免 /api 重写层在 multipart 上传时吞掉真实错误。
  if (typeof window !== "undefined") {
    const direct = process.env.NEXT_PUBLIC_API_BASE?.trim();
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

// 兼容旧调用
export async function ingestImage(file: File): Promise<{ id: string }> {
  const result = await ingestProduct({ image: file, source: "auto" });
  return { id: result.id };
}
