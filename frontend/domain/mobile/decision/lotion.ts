import rawConfig from "../../../../shared/mobile/decision/lotion.json";

import {
  parseDecisionProfileConfig,
  type DecisionProfileOption,
  type DecisionProfileStep,
} from "./profileConfig";

export type LotionStepKey = "q1" | "q2" | "q3" | "q4" | "q5";
export type LotionOptionValue = "A" | "B" | "C" | "D" | "E";
export type LotionProfileOption = DecisionProfileOption<LotionOptionValue>;
export type LotionProfileStep = DecisionProfileStep<LotionStepKey, LotionOptionValue>;

const parsed = parseDecisionProfileConfig<LotionStepKey, LotionOptionValue>({
  rawConfig,
  sourceName: "shared/mobile/decision/lotion.json",
  expectedCategory: "lotion",
  stepKeys: ["q1", "q2", "q3", "q4", "q5"],
  optionValues: ["A", "B", "C", "D", "E"],
});

const LOTION_PROFILE_STEPS = parsed.steps;
const LOTION_CHOICE_LABELS = parsed.choiceLabels;

export function listLotionProfileSteps(): readonly LotionProfileStep[] {
  return LOTION_PROFILE_STEPS;
}

export function getLotionChoiceLabel(
  key: LotionStepKey,
  value: LotionOptionValue,
): string | null {
  return LOTION_CHOICE_LABELS[key]?.[value] || null;
}
