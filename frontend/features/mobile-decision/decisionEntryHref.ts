import type { MobileSelectionCategory } from "@/lib/api";
import { applyMobileReturnTo } from "@/lib/mobile/flowReturn";
import {
  applyResultCtaAttribution,
  type ResultCtaAttribution,
} from "@/lib/mobile/resultCtaAttribution";

export const DECISION_ENTRY_SOURCE = {
  chooseStart: "choose_start",
  bottomNavChoose: "bottom_nav_choose",
  categoryRailChoose: "category_rail_choose",
  decisionStart: "decision_start",
  decisionResultRestart: "decision_result_restart",
  utilityCompareReentry: "utility_compare_reentry",
  utilityWikiReentry: "utility_wiki_reentry",
} as const;

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
