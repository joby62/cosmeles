export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8001";

export type Product = {
  id: string;
  category?: string;
  brand?: string;
  name?: string;
};

export type ProductSummary = {
  one_sentence?: string;
  pros?: string[];
  cons?: string[];
  who_for?: string[];
  who_not_for?: string[];
};

export type ProductDoc = {
  product: Product;
  summary?: ProductSummary;
  ingredients?: any[];
  evidence?: any;
};

export type ProductCard = {
  id: string;
  category?: string;
  brand?: string;
  name?: string;
  one_sentence?: string;
  tags?: string[];
};

export function imageUrl(productId: string) {
  return `${API_BASE}/images/${productId}.png`;
}

function safeStr(v: any) {
  if (typeof v === "string") return v;
  if (v == null) return "";
  return String(v);
}

function pickTagsFromSummary(s?: ProductSummary): string[] {
  const out: string[] = [];
  if (!s) return out;

  const pros = Array.isArray(s.pros) ? s.pros : [];
  for (const p of pros.slice(0, 3)) {
    const t = safeStr(p).trim();
    if (t) out.push(t);
  }
  return out;
}

function normalizeListPayload(data: any): ProductCard[] {
  // 兼容后端可能返回：
  // 1) { items: [...] }
  // 2) { products: [...] }
  // 3) [...]
  const arr =
    (data && Array.isArray(data.items) && data.items) ||
    (data && Array.isArray(data.products) && data.products) ||
    (Array.isArray(data) && data) ||
    [];

  return arr.map((x: any) => {
    const p = x?.product ?? x;
    const s = x?.summary ?? undefined;

    const id = safeStr(p?.id || x?.id);
    return {
      id,
      category: safeStr(p?.category || x?.category) || undefined,
      brand: safeStr(p?.brand || x?.brand) || undefined,
      name: safeStr(p?.name || x?.name) || undefined,
      one_sentence: safeStr(s?.one_sentence || x?.one_sentence) || undefined,
      tags: pickTagsFromSummary(s),
    };
  });
}

export async function fetchProducts(): Promise<ProductCard[]> {
  const res = await fetch(`${API_BASE}/api/products`, { cache: "no-store" });
  if (!res.ok) throw new Error(`fetchProducts failed: ${res.status}`);
  const data = await res.json();
  return normalizeListPayload(data);
}

export async function fetchProduct(productId: string): Promise<ProductDoc> {
  if (!productId) throw new Error("fetchProduct called without id");
  const res = await fetch(`${API_BASE}/api/products/${productId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`fetchProduct failed: ${res.status}`);
  const data = await res.json();

  // 兼容后端直接返回 doc 或 { doc: ... }
  const doc = data?.doc ?? data;
  return doc as ProductDoc;
}