type SearchValue = string | string[] | null | undefined;
type SearchRecord = Record<string, SearchValue>;
type SearchLike = Pick<URLSearchParams, "get"> | SearchRecord | null | undefined;

export type MobileCompareKeepCurrentClosureDecision = "keep" | "hybrid";
export type MobileCompareKeepCurrentClosureSource = "upload_new" | "history_product";

export type MobileCompareKeepCurrentClosureState = {
  decision: MobileCompareKeepCurrentClosureDecision | null;
  productSource: MobileCompareKeepCurrentClosureSource | null;
  productBrand: string;
  productName: string;
  productLabel: string;
  isCompleted: boolean;
};

function isSearchParamsLike(search: SearchLike): search is Pick<URLSearchParams, "get"> {
  if (!search || typeof search !== "object") return false;
  return "get" in search && typeof (search as { get?: unknown }).get === "function";
}

function readValue(search: SearchLike, key: string): string {
  if (!search) return "";
  if (isSearchParamsLike(search)) {
    return String(search.get(key) || "").trim();
  }
  const raw = (search as SearchRecord)[key];
  return Array.isArray(raw) ? String(raw[0] || "").trim() : String(raw || "").trim();
}

function normalizeDecision(
  raw: string | null | undefined,
): MobileCompareKeepCurrentClosureDecision | null {
  if (raw === "keep" || raw === "hybrid") return raw;
  return null;
}

function normalizeProductSource(
  raw: string | null | undefined,
): MobileCompareKeepCurrentClosureSource | null {
  if (raw === "upload_new" || raw === "history_product") return raw;
  return null;
}

function formatProductLabel(brand: string, name: string): string {
  const value = [brand, name].filter(Boolean).join(" ").trim();
  return value || "当前这款";
}

export function parseMobileCompareKeepCurrentClosure(
  search: SearchLike,
): MobileCompareKeepCurrentClosureState | null {
  if (readValue(search, "closure") !== "keep_current") return null;
  const productBrand = readValue(search, "product_brand");
  const productName = readValue(search, "product_name");
  const productSource = normalizeProductSource(readValue(search, "product_source"));
  return {
    decision: normalizeDecision(readValue(search, "decision")),
    productSource,
    productBrand,
    productName,
    productLabel: formatProductLabel(productBrand, productName),
    isCompleted: Boolean(productSource),
  };
}

export function buildMobileCompareKeepCurrentLandingTargetPath(
  category: string | null | undefined,
): string {
  const normalizedCategory = String(category || "").trim();
  if (!normalizedCategory) return "/m/me/use";
  return `/m/me/use?category=${encodeURIComponent(normalizedCategory)}`;
}
