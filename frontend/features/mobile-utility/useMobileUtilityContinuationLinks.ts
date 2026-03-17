"use client";

import { useMemo } from "react";
import type { DecisionContinuationAction } from "@/domain/mobile/progress/decisionResume";
import {
  DECISION_CONTINUATION_SOURCE,
  resolveDecisionContinuationSource,
  type DecisionContinuationSource,
} from "@/features/mobile-decision/decisionEntryHref";
import {
  appendMobileUtilityRouteState,
  type MobileUtilityRouteState,
} from "@/features/mobile-utility/routeState";
import { useDecisionContinuationMap } from "@/features/mobile-utility/useDecisionContinuation";

type ContinuationLink = {
  action: DecisionContinuationAction;
  href: string;
};

type UseContinuationLinksOptions = {
  routeState?: MobileUtilityRouteState | null;
  sourceFallback: DecisionContinuationSource;
};

export const MOBILE_UTILITY_CONTINUATION_SURFACE = {
  meBag: "me_bag",
  meHistorySelection: "me_history_selection",
  meHistoryCompare: "me_history_compare",
} as const;

export type MobileUtilityContinuationSurface =
  (typeof MOBILE_UTILITY_CONTINUATION_SURFACE)[keyof typeof MOBILE_UTILITY_CONTINUATION_SURFACE];

type UseContinuationLinksBySurfaceOptions = {
  routeState?: MobileUtilityRouteState | null;
  surface: MobileUtilityContinuationSurface;
};

const CONTINUATION_SOURCE_FALLBACK_BY_SURFACE: Record<
  MobileUtilityContinuationSurface,
  DecisionContinuationSource
> = {
  [MOBILE_UTILITY_CONTINUATION_SURFACE.meBag]:
    DECISION_CONTINUATION_SOURCE.meBag,
  [MOBILE_UTILITY_CONTINUATION_SURFACE.meHistorySelection]:
    DECISION_CONTINUATION_SOURCE.meHistorySelection,
  [MOBILE_UTILITY_CONTINUATION_SURFACE.meHistoryCompare]:
    DECISION_CONTINUATION_SOURCE.meHistoryCompare,
};

function buildFallbackChoosePath(source: string): string {
  return `/m/choose?source=${encodeURIComponent(source)}`;
}

export function useMobileUtilityContinuationLinks({
  routeState = null,
  sourceFallback,
}: UseContinuationLinksOptions) {
  const source = resolveDecisionContinuationSource(routeState?.source, sourceFallback);
  const continuationMap = useDecisionContinuationMap({ source });

  return useMemo(
    () => ({
      resolveByCategory(category: string | null | undefined): ContinuationLink {
        const target = continuationMap?.resolveByCategory(category) || {
          action: "go_choose" as const,
          href: buildFallbackChoosePath(source),
        };
        return {
          action: target.action,
          href: appendMobileUtilityRouteState(target.href, routeState, { includeSource: false }),
        };
      },
    }),
    [continuationMap, routeState, source],
  );
}

export function useMobileUtilitySurfaceContinuationLinks({
  routeState = null,
  surface,
}: UseContinuationLinksBySurfaceOptions) {
  return useMobileUtilityContinuationLinks({
    routeState,
    sourceFallback: CONTINUATION_SOURCE_FALLBACK_BY_SURFACE[surface],
  });
}
