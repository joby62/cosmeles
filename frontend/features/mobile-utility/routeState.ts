type SearchValue = string | string[] | null | undefined;
type SearchRecord = Record<string, SearchValue>;

type SearchLike = Pick<URLSearchParams, "get"> | SearchRecord | null | undefined;

export type MobileUtilityRouteState = {
  source: string | null;
  returnTo: string | null;
  scenarioId: string | null;
  resultCta: string | null;
  compareId: string | null;
};

export type MobileUtilityReturnAction = {
  href: string;
  label: string;
};

type ApplyRouteStateOptions = {
  includeSource?: boolean;
  includeReturnTo?: boolean;
  includeScenarioId?: boolean;
  includeResultCta?: boolean;
  includeCompareId?: boolean;
};

const DEFAULT_APPLY_OPTIONS: Required<ApplyRouteStateOptions> = {
  includeSource: true,
  includeReturnTo: true,
  includeScenarioId: true,
  includeResultCta: true,
  includeCompareId: true,
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
  // Legacy deep links may still carry from_compare_id; keep adapter read-only compatibility here.
  const compareId = readValue(search, "compare_id") || readValue(search, "from_compare_id");
  return {
    source: source || null,
    returnTo,
    scenarioId: scenarioId || null,
    resultCta: resultCta || null,
    compareId: compareId || null,
  };
}

export function hasMobileUtilityRouteContext(state: MobileUtilityRouteState): boolean {
  return Boolean(state.returnTo || state.scenarioId || state.resultCta || state.source || state.compareId);
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

export function resolveMobileUtilityReturnAction(
  state: MobileUtilityRouteState,
  fallback = "/m/choose",
): MobileUtilityReturnAction | null {
  if (!hasMobileUtilityRouteContext(state)) return null;
  return {
    href: resolveMobileUtilityReturnHref(state, fallback),
    label: describeMobileUtilityReturnLabel(state),
  };
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
  if (applied.includeCompareId && state.compareId) {
    params.set("compare_id", state.compareId);
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
