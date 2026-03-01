export type Product = {
  id: string;
  category: string;
  brand: string;
  name: string;
  description?: string | null;
  one_sentence?: string | null;
  tags?: string[] | null;
  image_url?: string | null;
  created_at?: string | null;
};

function getBaseForFetch(): string {
  // 在浏览器里：用相对路径，走同域 nginx（/api/...）
  if (typeof window !== "undefined") return "";

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

export async function fetchProduct(id: string): Promise<Product> {
  return apiFetch<Product>(`/api/products/${id}`);
}

// 图片 URL：浏览器用相对 /images/...（同域 nginx -> backend）
// SSR 也需要绝对 URL，走 nginx
export function resolveImageUrl(product: Product): string {
  const p = product.image_url || `/images/${product.id}.png`;
  if (typeof window !== "undefined") return p.startsWith("http") ? p : p;
  const base = process.env.INTERNAL_API_BASE || "http://nginx";
  return p.startsWith("http") ? p : new URL(p, base).toString();
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
