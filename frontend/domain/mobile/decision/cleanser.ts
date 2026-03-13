import rawConfig from "../../../../shared/mobile/decision/cleanser.json";

import {
  parseDecisionProfileConfig,
  type DecisionProfileOption,
  type DecisionProfileStep,
} from "./profileConfig";

export type CleanserStepKey = "q1" | "q2" | "q3" | "q4" | "q5";
export type CleanserOptionValue = "A" | "B" | "C" | "D" | "E";
export type CleanserProfileOption = DecisionProfileOption<CleanserOptionValue>;
export type CleanserProfileStep = DecisionProfileStep<CleanserStepKey, CleanserOptionValue>;

const parsed = parseDecisionProfileConfig<CleanserStepKey, CleanserOptionValue>({
  rawConfig,
  sourceName: "shared/mobile/decision/cleanser.json",
  expectedCategory: "cleanser",
  stepKeys: ["q1", "q2", "q3", "q4", "q5"],
  optionValues: ["A", "B", "C", "D", "E"],
});

const CLEANSER_PROFILE_STEPS = parsed.steps;
const CLEANSER_CHOICE_LABELS = parsed.choiceLabels;

export function listCleanserProfileSteps(): readonly CleanserProfileStep[] {
  return CLEANSER_PROFILE_STEPS;
}

export function getCleanserChoiceLabel(
  key: CleanserStepKey,
  value: CleanserOptionValue,
): string | null {
  return CLEANSER_CHOICE_LABELS[key]?.[value] || null;
}
