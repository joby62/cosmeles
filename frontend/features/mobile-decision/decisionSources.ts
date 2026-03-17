export const DECISION_ENTRY_SOURCE = {
  chooseStart: "choose_start",
  bottomNavChoose: "bottom_nav_choose",
  categoryRailChoose: "category_rail_choose",
  decisionStart: "decision_start",
  decisionResultRestart: "decision_result_restart",
  utilityCompareReentry: "utility_compare_reentry",
  utilityWikiReentry: "utility_wiki_reentry",
} as const;

export type DecisionEntrySource = (typeof DECISION_ENTRY_SOURCE)[keyof typeof DECISION_ENTRY_SOURCE];

export const DECISION_CONTINUATION_SOURCE = {
  meResume: "m_me_resume",
  meBag: "m_me_bag",
  meHistorySelection: "m_me_history_selection",
  meHistoryCompare: "m_me_history_compare",
} as const;

export type DecisionContinuationSource =
  (typeof DECISION_CONTINUATION_SOURCE)[keyof typeof DECISION_CONTINUATION_SOURCE];

export function resolveDecisionSource(raw: string | null | undefined): string {
  return String(raw || "").trim();
}

export function resolveDecisionContinuationSource(
  source: string | null | undefined,
  fallback: DecisionContinuationSource,
): string {
  const normalized = resolveDecisionSource(source);
  return normalized || fallback;
}
