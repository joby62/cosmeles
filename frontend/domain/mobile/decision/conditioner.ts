import rawConfig from "../../../../shared/mobile/decision/conditioner.json";

import {
  parseDecisionProfileConfig,
  type DecisionProfileOption,
  type DecisionProfileStep,
} from "./profileConfig";

export type ConditionerStepKey = "c_q1" | "c_q2" | "c_q3";
export type ConditionerOptionValue = "A" | "B" | "C";
export type ConditionerProfileOption = DecisionProfileOption<ConditionerOptionValue>;
export type ConditionerProfileStep = DecisionProfileStep<ConditionerStepKey, ConditionerOptionValue>;

const parsed = parseDecisionProfileConfig<ConditionerStepKey, ConditionerOptionValue>({
  rawConfig,
  sourceName: "shared/mobile/decision/conditioner.json",
  expectedCategory: "conditioner",
  stepKeys: ["c_q1", "c_q2", "c_q3"],
  optionValues: ["A", "B", "C"],
});

const CONDITIONER_PROFILE_STEPS = parsed.steps;
const CONDITIONER_CHOICE_LABELS = parsed.choiceLabels;

export function listConditionerProfileSteps(): readonly ConditionerProfileStep[] {
  return CONDITIONER_PROFILE_STEPS;
}

export function getConditionerChoiceLabel(
  key: ConditionerStepKey,
  value: ConditionerOptionValue,
): string | null {
  return CONDITIONER_CHOICE_LABELS[key]?.[value] || null;
}
