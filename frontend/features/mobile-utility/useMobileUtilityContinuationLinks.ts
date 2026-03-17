"use client";

import { useMemo } from "react";
import type { DecisionContinuationAction } from "@/domain/mobile/progress/decisionResume";
import {
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
