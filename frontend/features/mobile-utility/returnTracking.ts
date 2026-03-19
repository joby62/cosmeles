import {
  hasMobileUtilityResultContext,
  resolveMobileUtilityReturnAction,
  type MobileUtilityRouteState,
} from "@/features/mobile-utility/routeState";

type UtilityReturnTrackValue = string | null | undefined;

export type MobileUtilityReturnActionKey = "compare_return" | "compare_library_return" | "wiki_return";

export type MobileUtilityReturnTrackingOptions = {
  routeState: MobileUtilityRouteState;
  page: string;
  route: string;
  source: string;
  action: MobileUtilityReturnActionKey;
  category?: UtilityReturnTrackValue;
  compareId?: UtilityReturnTrackValue;
  targetPath?: UtilityReturnTrackValue;
};

export type MobileUtilityReturnTracking = {
  href: string;
  label: string;
  eventName?: "utility_return_click";
  eventProps?: Record<string, unknown>;
};

function normalizeValue(value: UtilityReturnTrackValue): string {
  return String(value || "").trim();
}

export function resolveMobileUtilityReturnTracking(
  options: MobileUtilityReturnTrackingOptions,
): MobileUtilityReturnTracking | null {
  const action = resolveMobileUtilityReturnAction(options.routeState);
  if (!action) return null;
  const targetPath = normalizeValue(options.targetPath) || action.href;
  const scenarioId = normalizeValue(options.routeState.scenarioId);
  const hasResultContext = hasMobileUtilityResultContext(options.routeState) && Boolean(scenarioId);
  if (!hasResultContext) {
    return {
      href: targetPath,
      label: action.label,
    };
  }
  const compareId = normalizeValue(options.compareId) || normalizeValue(options.routeState.compareId);
  const category = normalizeValue(options.category);
  const resultCta = normalizeValue(options.routeState.resultCta);
  return {
    href: targetPath,
    label: action.label,
    eventName: "utility_return_click",
    eventProps: {
      page: options.page,
      route: options.route,
      source: options.source,
      category: category || undefined,
      compare_id: compareId || undefined,
      scenario_id: scenarioId,
      result_cta: resultCta || undefined,
      target_path: targetPath,
      action: options.action,
    },
  };
}
