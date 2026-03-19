import type { MobileSelectionCategory } from "@/lib/api";
import {
  buildDecisionProfileEntryHref,
  type DecisionEntrySource,
} from "@/features/mobile-decision/decisionEntryHref";
import {
  appendMobileUtilityRouteState,
  type MobileUtilityRouteState,
} from "@/features/mobile-utility/routeState";
import type { ResultCtaAttribution } from "@/lib/mobile/resultCtaAttribution";
import { normalizeMobileResultCta } from "@/lib/mobile/resultCta";

type BuildUtilityDecisionProfileEntryHrefOptions = {
  category: MobileSelectionCategory;
  source: DecisionEntrySource;
  routeState?: MobileUtilityRouteState | null;
  returnTo?: string | null;
};

function toUtilityResultAttribution(
  routeState: MobileUtilityRouteState | null | undefined,
): ResultCtaAttribution | null {
  if (!routeState) return null;
  const resultCta = normalizeMobileResultCta(routeState.resultCta);
  if (!resultCta) return null;
  const compareId = String(routeState.compareId || "").trim();
  return {
    resultCta,
    fromCompareId: compareId || undefined,
  };
}

export function buildUtilityDecisionProfileEntryHref(
  options: BuildUtilityDecisionProfileEntryHrefOptions,
): string {
  const baseHref = buildDecisionProfileEntryHref({
    category: options.category,
    source: options.source,
    resultAttribution: toUtilityResultAttribution(options.routeState),
    returnTo: options.returnTo || options.routeState?.returnTo || null,
  });
  return appendMobileUtilityRouteState(baseHref, options.routeState, {
    includeSource: false,
    includeReturnTo: false,
  });
}
