type SearchValue = string | string[] | null | undefined;
type SearchRecord = Record<string, SearchValue>;
type SearchLike = Pick<URLSearchParams, "get"> | SearchRecord;

function isSearchParamsLike(search: SearchLike): search is Pick<URLSearchParams, "get"> {
  return "get" in search && typeof search.get === "function";
}

function readValue(search: SearchLike, key: string): string {
  if (isSearchParamsLike(search)) {
    return String(search.get(key) || "").trim();
  }
  const raw = (search as SearchRecord)[key];
  return Array.isArray(raw) ? String(raw[0] || "").trim() : String(raw || "").trim();
}

export function normalizeMobileReturnTo(raw: string | null | undefined): string | null {
  const value = String(raw || "").trim();
  if (!value) return null;
  if (value === "/m" || value.startsWith("/m/")) return value;
  return null;
}

export function parseMobileReturnTo(search: SearchLike): string | null {
  return normalizeMobileReturnTo(readValue(search, "return_to"));
}

export function applyMobileReturnTo(
  params: URLSearchParams,
  returnTo: string | null | undefined,
): URLSearchParams {
  const normalized = normalizeMobileReturnTo(returnTo);
  if (!normalized) return params;
  params.set("return_to", normalized);
  return params;
}

export function buildCompareBasisReturnTo(category: string): string {
  const params = new URLSearchParams({
    category,
    profile_refreshed: "1",
  });
  return `/m/compare?${params.toString()}`;
}
