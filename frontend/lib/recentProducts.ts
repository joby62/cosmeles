import { normalizeCategoryKey, type CategoryKey } from "@/lib/site";

const RECENT_PRODUCTS_STORAGE_KEY = "jeslect:recent-products:v1";
const RECENT_PRODUCTS_LIMIT = 12;

export type RecentProductSnapshot = {
  productId: string;
  category: CategoryKey;
  name: string;
  brand: string;
  summary: string;
  imageUrl: string | null;
  routeTitle?: string | null;
  routeSummary?: string | null;
  viewedAt: string;
};

export type RecentProductInput = Omit<RecentProductSnapshot, "viewedAt"> & {
  viewedAt?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function coerceSnapshot(value: unknown): RecentProductSnapshot | null {
  if (!isRecord(value)) return null;

  const productId = normalizeText(value.productId);
  const category = normalizeCategoryKey(normalizeText(value.category));
  if (!productId || !category) return null;

  return {
    productId,
    category,
    name: normalizeText(value.name, "Untitled product"),
    brand: normalizeText(value.brand, "Jeslect"),
    summary: normalizeText(value.summary, "Open the product page for full details."),
    imageUrl: normalizeText(value.imageUrl) || null,
    routeTitle: normalizeText(value.routeTitle) || null,
    routeSummary: normalizeText(value.routeSummary) || null,
    viewedAt: normalizeText(value.viewedAt, new Date(0).toISOString()),
  };
}

function sortSnapshots(items: RecentProductSnapshot[]): RecentProductSnapshot[] {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.viewedAt);
    const rightTime = Date.parse(right.viewedAt);
    return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
  });
}

function readStorage(): RecentProductSnapshot[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(RECENT_PRODUCTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return sortSnapshots(parsed.map(coerceSnapshot).filter((item): item is RecentProductSnapshot => Boolean(item))).slice(
      0,
      RECENT_PRODUCTS_LIMIT,
    );
  } catch {
    return [];
  }
}

function writeStorage(items: RecentProductSnapshot[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RECENT_PRODUCTS_STORAGE_KEY, JSON.stringify(items.slice(0, RECENT_PRODUCTS_LIMIT)));
}

export function readRecentProducts(): RecentProductSnapshot[] {
  return readStorage();
}

export function rememberRecentProduct(input: RecentProductInput): RecentProductSnapshot[] {
  if (typeof window === "undefined") return [];

  const productId = normalizeText(input.productId);
  const category = normalizeCategoryKey(input.category);
  if (!productId || !category) return readStorage();

  const nextItem: RecentProductSnapshot = {
    productId,
    category,
    name: normalizeText(input.name, "Untitled product"),
    brand: normalizeText(input.brand, "Jeslect"),
    summary: normalizeText(input.summary, "Open the product page for full details."),
    imageUrl: normalizeText(input.imageUrl) || null,
    routeTitle: normalizeText(input.routeTitle) || null,
    routeSummary: normalizeText(input.routeSummary) || null,
    viewedAt: normalizeText(input.viewedAt, new Date().toISOString()),
  };

  const deduped = readStorage().filter((item) => item.productId !== nextItem.productId);
  const nextItems = sortSnapshots([nextItem, ...deduped]).slice(0, RECENT_PRODUCTS_LIMIT);
  writeStorage(nextItems);
  return nextItems;
}

export function clearRecentProducts(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(RECENT_PRODUCTS_STORAGE_KEY);
}
