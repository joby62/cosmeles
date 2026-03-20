"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import {
  runMobileCompareJobStream,
  type MobileSelectionCategory,
} from "@/lib/api";
import {
  markMobileTargetHandled,
  trackMobileEvent,
} from "@/lib/mobileAnalytics";
import { appendMobileUtilityRouteState } from "@/features/mobile-utility/routeState";

type Props = {
  category: MobileSelectionCategory;
  recommendationProductId: string | null;
  currentUploadId: string | null;
  fallbackHref: string;
  resultHref: string;
  page: string;
  route: string;
  source: string;
  scenarioId: string;
  className: string;
  analyticsId?: string;
  children: string;
};

export default function DecisionResultCompareEntryLink({
  category,
  recommendationProductId,
  currentUploadId,
  fallbackHref,
  resultHref,
  page,
  route,
  source,
  scenarioId,
  className,
  analyticsId,
  children,
}: Props) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const eventProps = {
    page,
    route,
    source,
    category,
    scenario_id: scenarioId,
    result_cta: "compare",
    target_path: fallbackHref,
  } as const;

  return (
    <button
      type="button"
      disabled={isPending}
      data-analytics-id={analyticsId}
      data-analytics-dead-click-watch="true"
      onClick={async () => {
        if (isPending) return;
        markMobileTargetHandled(analyticsId);
        void trackMobileEvent("result_compare_entry_click", eventProps);

        if (!currentUploadId || !recommendationProductId) {
          startTransition(() => {
            router.push(fallbackHref);
          });
          return;
        }

        setIsPending(true);
        try {
          const compareResult = await runMobileCompareJobStream(
            {
              category,
              profile_mode: "reuse_latest",
              targets: [
                { source: "upload_new", upload_id: currentUploadId },
                { source: "history_product", product_id: recommendationProductId },
              ],
              options: {
                include_inci_order_diff: true,
                include_function_rank_diff: true,
              },
            },
            () => {},
          );
          const compareResultHref = appendMobileUtilityRouteState(
            `/m/compare/result/${encodeURIComponent(compareResult.compare_id)}`,
            {
              source: "compare_result",
              returnTo: resultHref,
              scenarioId,
              resultCta: "compare",
              compareId: compareResult.compare_id,
            },
            { includeSource: true },
          );
          startTransition(() => {
            router.push(compareResultHref);
          });
          return;
        } catch {
          startTransition(() => {
            router.push(fallbackHref);
          });
        } finally {
          setIsPending(false);
        }
      }}
      className={className}
    >
      <span>{isPending ? "正在进入对比裁决..." : children}</span>
      <span className="text-black/34">→</span>
    </button>
  );
}
