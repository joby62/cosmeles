import type { MobileSelectionCategory } from "@/lib/api";
import { applyMobileReturnTo } from "@/lib/mobile/flowReturn";
import {
  applyResultCtaAttribution,
  type ResultCtaAttribution,
} from "@/lib/mobile/resultCtaAttribution";
import {
  DECISION_CONTINUATION_SOURCE,
  DECISION_ENTRY_SOURCE,
  resolveDecisionContinuationSource,
  type DecisionContinuationSource,
  type DecisionEntrySource,
} from "@/features/mobile-decision/decisionSources";

export { DECISION_ENTRY_SOURCE, DECISION_CONTINUATION_SOURCE, resolveDecisionContinuationSource };
export type { DecisionEntrySource, DecisionContinuationSource };

type BuildDecisionProfileEntryHrefOptions = {
  category: MobileSelectionCategory;
  source: string;
  resultAttribution?: ResultCtaAttribution | null;
  returnTo?: string | null;
};

// Shared owner for fresh decision profile entry hrefs.
export function buildDecisionProfileEntryHref(
  options: BuildDecisionProfileEntryHrefOptions,
): string {
  const params = new URLSearchParams();
  params.set("step", "1");
  applyResultCtaAttribution(params, options.resultAttribution || null);
  applyMobileReturnTo(params, options.returnTo || null);
  const source = String(options.source || "").trim();
  if (source) {
    // Explicit caller source must win over propagated attribution source.
    params.set("source", source);
  }
  return `/m/${options.category}/profile?${params.toString()}`;
}
