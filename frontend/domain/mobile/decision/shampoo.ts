import rawConfig from "../../../../shared/mobile/decision/shampoo.json";

import {
  parseDecisionProfileConfig,
  type DecisionProfileOption,
  type DecisionProfileStep,
} from "./profileConfig";

export type ShampooStepKey = "q1" | "q2" | "q3";
export type ShampooOptionValue = "A" | "B" | "C" | "D";
export type ShampooProfileOption = DecisionProfileOption<ShampooOptionValue>;
export type ShampooProfileStep = DecisionProfileStep<ShampooStepKey, ShampooOptionValue>;

const parsed = parseDecisionProfileConfig<ShampooStepKey, ShampooOptionValue>({
  rawConfig,
  sourceName: "shared/mobile/decision/shampoo.json",
  expectedCategory: "shampoo",
  stepKeys: ["q1", "q2", "q3"],
  optionValues: ["A", "B", "C", "D"],
});
const SHAMPOO_PROFILE_STEPS = parsed.steps;
const SHAMPOO_CHOICE_LABELS = parsed.choiceLabels;

export function listShampooProfileSteps(): readonly ShampooProfileStep[] {
  return SHAMPOO_PROFILE_STEPS;
}

export function getShampooChoiceLabel(
  key: ShampooStepKey,
  value: ShampooOptionValue,
): string | null {
  return SHAMPOO_CHOICE_LABELS[key]?.[value] || null;
}
