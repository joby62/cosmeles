type SearchValue = string | string[] | null | undefined;
type SearchRecord = Record<string, SearchValue>;

type SearchLike = Pick<URLSearchParams, "get"> | SearchRecord | null | undefined;

export type MobileUtilityRouteState = {
  source: string | null;
  returnTo: string | null;
  scenarioId: string | null;
  resultCta: string | null;
};

type ApplyRouteStateOptions = {
  includeSource?: boolean;
  includeReturnTo?: boolean;
  includeScenarioId?: boolean;
  includeResultCta?: boolean;
};

const DEFAULT_APPLY_OPTIONS: Required<ApplyRouteStateOptions> = {
  includeSource: true,
  includeReturnTo: true,
  includeScenarioId: true,
  includeResultCta: true,
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
  if (Array.isArray(raw)) return String(raw[0] || "").trim();
  return String(raw || "").trim();
}

function normalizeReturnTo(raw: string): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/m/")) return null;
  return raw;
}

export function parseMobileUtilityRouteState(search: SearchLike): MobileUtilityRouteState {
  const source = readValue(search, "source");
  const returnTo = normalizeReturnTo(readValue(search, "return_to"));
  const scenarioId = readValue(search, "scenario_id");
  const resultCta = readValue(search, "result_cta");
  return {
    source: source || null,
    returnTo,
    scenarioId: scenarioId || null,
    resultCta: resultCta || null,
  };
}

export function hasMobileUtilityRouteContext(state: MobileUtilityRouteState): boolean {
  return Boolean(state.returnTo || state.scenarioId || state.resultCta || state.source);
}

export function hasMobileUtilityResultContext(state: MobileUtilityRouteState): boolean {
  return Boolean(state.returnTo && state.scenarioId && state.resultCta);
}

export function resolveMobileUtilitySource(state: MobileUtilityRouteState, fallback: string): string {
  return state.source || fallback;
}

export function resolveMobileUtilityReturnHref(
  state: MobileUtilityRouteState,
  fallback = "/m/choose",
): string {
  return state.returnTo || fallback;
}

export function describeMobileUtilityReturnLabel(state: MobileUtilityRouteState): string {
  if (hasMobileUtilityResultContext(state)) return "返回上一步结果";
  return "回到个性挑选";
}

export function applyMobileUtilityRouteState(
  params: URLSearchParams,
  state: MobileUtilityRouteState | null | undefined,
  options?: ApplyRouteStateOptions,
): URLSearchParams {
  if (!state) return params;
  const applied = { ...DEFAULT_APPLY_OPTIONS, ...(options || {}) };
  if (applied.includeSource && state.source) {
    params.set("source", state.source);
  }
  if (applied.includeReturnTo && state.returnTo) {
    params.set("return_to", state.returnTo);
  }
  if (applied.includeScenarioId && state.scenarioId) {
    params.set("scenario_id", state.scenarioId);
  }
  if (applied.includeResultCta && state.resultCta) {
    params.set("result_cta", state.resultCta);
  }
  return params;
}

export function appendMobileUtilityRouteState(
  path: string,
  state: MobileUtilityRouteState | null | undefined,
  options?: ApplyRouteStateOptions,
): string {
  if (!state) return path;
  const [pathWithQuery, hash = ""] = path.split("#", 2);
  const [pathname, query = ""] = pathWithQuery.split("?", 2);
  const params = new URLSearchParams(query);
  applyMobileUtilityRouteState(params, state, options);
  const nextQuery = params.toString();
  return `${pathname}${nextQuery ? `?${nextQuery}` : ""}${hash ? `#${hash}` : ""}`;
}
