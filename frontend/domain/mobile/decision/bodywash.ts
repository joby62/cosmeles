import rawConfig from "../../../../shared/mobile/decision/bodywash.json";

import {
  parseDecisionProfileConfig,
  type DecisionProfileOption,
  type DecisionProfileStep,
} from "./profileConfig";

export type BodyWashStepKey = "q1" | "q2" | "q3" | "q4" | "q5";
export type BodyWashOptionValue = "A" | "B" | "C" | "D";
export type BodyWashProfileOption = DecisionProfileOption<BodyWashOptionValue>;
export type BodyWashProfileStep = DecisionProfileStep<BodyWashStepKey, BodyWashOptionValue>;

const parsed = parseDecisionProfileConfig<BodyWashStepKey, BodyWashOptionValue>({
  rawConfig,
  sourceName: "shared/mobile/decision/bodywash.json",
  expectedCategory: "bodywash",
  stepKeys: ["q1", "q2", "q3", "q4", "q5"],
  optionValues: ["A", "B", "C", "D"],
});

const BODYWASH_PROFILE_STEPS = parsed.steps;
const BODYWASH_CHOICE_LABELS = parsed.choiceLabels;

export function listBodyWashProfileSteps(): readonly BodyWashProfileStep[] {
  return BODYWASH_PROFILE_STEPS;
}

export function getBodyWashChoiceLabel(
  key: BodyWashStepKey,
  value: BodyWashOptionValue,
): string | null {
  return BODYWASH_CHOICE_LABELS[key]?.[value] || null;
}
