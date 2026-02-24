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

const API_PREFIX = "/api";

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_PREFIX}${path}`, {
    ...options,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${path}`);
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
  if (product.image_url) {
    return product.image_url;
  }
  // fallback（旧数据兜底）
  return `/images/${product.id}.png`;
}