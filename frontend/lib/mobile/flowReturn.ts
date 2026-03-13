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

export function parseMobileReturnTo(search: SearchLike): string | null {
  const value = readValue(search, "return_to");
  if (!value.startsWith("/m/")) return null;
  return value;
}

export function applyMobileReturnTo(
  params: URLSearchParams,
  returnTo: string | null | undefined,
): URLSearchParams {
  if (!returnTo) return params;
  params.set("return_to", returnTo);
  return params;
}

export function buildCompareBasisReturnTo(category: string): string {
  const params = new URLSearchParams({
    category,
    profile_refreshed: "1",
  });
  return `/m/compare?${params.toString()}`;
}
