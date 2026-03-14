type SearchValue = string | string[] | null | undefined;
type SearchRecord = Record<string, SearchValue>;

export type ResultCtaAttribution = {
  resultCta: string;
  fromCompareId: string;
  source?: string | null;
};

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

export function parseResultCtaAttribution(search: SearchLike): ResultCtaAttribution | null {
  const resultCta = readValue(search, "result_cta");
  // Legacy deep links may still carry from_compare_id; keep adapter read-only compatibility here.
  const fromCompareId = readValue(search, "compare_id") || readValue(search, "from_compare_id");
  if (!resultCta || !fromCompareId) return null;
  const source = readValue(search, "source");
  return {
    resultCta,
    fromCompareId,
    source: source || null,
  };
}

export function applyResultCtaAttribution(
  params: URLSearchParams,
  attribution: ResultCtaAttribution | null | undefined,
): URLSearchParams {
  if (!attribution) return params;
  params.set("result_cta", attribution.resultCta);
  params.set("compare_id", attribution.fromCompareId);
  if (attribution.source) {
    params.set("source", attribution.source);
  }
  return params;
}

export function buildResultCtaEventProps(
  attribution: ResultCtaAttribution | null | undefined,
): Record<string, unknown> {
  if (!attribution) return {};
  return {
    result_cta: attribution.resultCta,
    compare_id: attribution.fromCompareId,
    source: attribution.source || undefined,
  };
}
