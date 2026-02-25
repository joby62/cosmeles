export interface Product {
  id: string;
  name: string;
  brand?: string;
  category?: string;
  description?: string;
  image_url?: string;
  tags?: string[];
  highlights?: string[];
}

/**
 * 在 Server Component / Route Handler 里，Node fetch 不能用相对路径（/api/...），必须是绝对 URL
 * 在浏览器里，反而应该优先用相对路径以保持同域
 */
function getApiBase(): string {
  // 浏览器环境
  if (typeof window !== "undefined") return "";

  // Node / Server 环境：优先用 env 指定的站点域名（上线时最稳）
  const site =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.VERCEL_URL;

  if (site) {
    // VERCEL_URL 可能没有协议
    if (site.startsWith("http://") || site.startsWith("https://")) return site;
    return `https://${site}`;
  }

  // 本地开发 fallback：你的后端端口 8000
  return "http://127.0.0.1:8000";
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const base = getApiBase();
  const url = `${base}/api${path.startsWith("/") ? path : `/${path}`}`;

  const res = await fetch(url, {
    ...options,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${url}`);
  }

  return res.json();
}

export async function fetchProducts(): Promise<Product[]> {
  return apiFetch<Product[]>("/products");
}

export async function fetchProduct(id: string): Promise<Product> {
  return apiFetch<Product>(`/products/${id}`);
}

export function resolveImageUrl(product: Product): string {
  if (product.image_url) return product.image_url;

  const base = getApiBase();
  // 浏览器返回 /images/... 同域；服务端返回绝对 URL
  const prefix = typeof window !== "undefined" ? "" : base;
  return `${prefix}/images/${product.id}.png`;
}