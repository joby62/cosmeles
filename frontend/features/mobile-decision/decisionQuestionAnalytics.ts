import type {
  DecisionShellSearch,
  DecisionShellSignals,
} from "@/features/mobile-decision/decisionShellConfig";

type SearchLike = Pick<URLSearchParams, "get"> | DecisionShellSearch;

function isSearchParamsLike(search: SearchLike): search is Pick<URLSearchParams, "get"> {
  return "get" in search && typeof search.get === "function";
}

export function readDecisionSearchValue(search: SearchLike, key: string): string {
  if (isSearchParamsLike(search)) {
    return String(search.get(key) || "").trim();
  }
  const raw = (search as DecisionShellSearch)[key];
  return Array.isArray(raw) ? String(raw[0] || "").trim() : String(raw || "").trim();
}

export function resolveDecisionAnalyticsSource(search: SearchLike, fallback: string): string {
  const source = readDecisionSearchValue(search, "source");
  return source || fallback;
}

// Canonical step semantics: 1-based active question index in shared config order.
export function resolveDecisionQuestionStep(args: {
  requestedStep: number;
  stepKeys: readonly string[];
  signals: DecisionShellSignals;
}): number | null {
  const { requestedStep, stepKeys, signals } = args;
  if (stepKeys.length <= 0) return null;
  const normalizedRequested = Number.isFinite(requestedStep) ? Math.round(requestedStep) : 1;
  const clampedRequested = Math.min(Math.max(normalizedRequested, 1), stepKeys.length);

  // The canonical active step cannot move past the first unanswered step.
  let firstUnanswered = stepKeys.length;
  for (let index = 0; index < stepKeys.length; index += 1) {
    if (!signals[stepKeys[index]]) {
      firstUnanswered = index + 1;
      break;
    }
  }

  const canonicalUpperBound = Math.min(Math.max(firstUnanswered, 1), stepKeys.length);
  const activeStep = Math.min(clampedRequested, canonicalUpperBound);
  return stepKeys[activeStep - 1] ? activeStep : null;
}
