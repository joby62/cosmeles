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

// 上传（如果你已经删掉 upload 页面也没关系，这个导出不会害你）
// 走 /api/ingest（你后端若不是这个路径，就按你后端实际路由改）
export async function ingestImage(file: File): Promise<{ id: string }> {
  const base = getBaseForFetch();
  const url = base ? new URL("/api/ingest", base).toString() : "/api/ingest";

  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch(url, { method: "POST", body: fd });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`INGEST ${res.status}: ${text}`);
  }
  return (await res.json()) as { id: string };
}
