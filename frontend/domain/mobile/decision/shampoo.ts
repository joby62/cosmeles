import rawConfig from "../../../../shared/mobile/decision/shampoo.json";

export type ShampooStepKey = "q1" | "q2" | "q3";
export type ShampooOptionValue = "A" | "B" | "C" | "D";

export type ShampooProfileOption = {
  value: ShampooOptionValue;
  label: string;
  sub: string;
  choiceLabel: string;
};

export type ShampooProfileStep = {
  key: ShampooStepKey;
  title: string;
  note: string;
  options: readonly ShampooProfileOption[];
};

type RawShampooConfig = {
  schema_version: string;
  category: string;
  profile?: {
    steps?: RawShampooProfileStep[];
  };
};

type RawShampooProfileStep = {
  key: string;
  title: string;
  note: string;
  options?: RawShampooProfileOption[];
};

type RawShampooProfileOption = {
  value: string;
  label: string;
  sub: string;
  choice_label: string;
};

const STEP_KEYS: ShampooStepKey[] = ["q1", "q2", "q3"];
const STEP_KEY_SET = new Set<ShampooStepKey>(STEP_KEYS);
const OPTION_VALUE_SET = new Set<ShampooOptionValue>(["A", "B", "C", "D"]);

const parsed = parseShampooConfig(rawConfig as RawShampooConfig);
const SHAMPOO_PROFILE_STEPS = parsed.steps;
const SHAMPOO_CHOICE_LABELS = buildChoiceLabelMap(parsed.steps);

export function listShampooProfileSteps(): readonly ShampooProfileStep[] {
  return SHAMPOO_PROFILE_STEPS;
}

export function getShampooChoiceLabel(
  key: ShampooStepKey,
  value: ShampooOptionValue,
): string | null {
  return SHAMPOO_CHOICE_LABELS[key]?.[value] || null;
}

function parseShampooConfig(raw: RawShampooConfig): { steps: readonly ShampooProfileStep[] } {
  if (String(raw.schema_version || "").trim() !== "mobile_decision_category.v1") {
    throw new Error("shared/mobile/decision/shampoo.json has unsupported schema_version");
  }
  if (String(raw.category || "").trim() !== "shampoo") {
    throw new Error("shared/mobile/decision/shampoo.json has mismatched category");
  }
  const rawSteps = Array.isArray(raw.profile?.steps) ? raw.profile.steps : [];
  const steps = rawSteps.map(parseShampooStep);
  if (steps.length !== STEP_KEYS.length) {
    throw new Error("shared/mobile/decision/shampoo.json has incomplete profile steps");
  }
  return { steps };
}

function parseShampooStep(raw: RawShampooProfileStep): ShampooProfileStep {
  const key = normalizeStepKey(raw.key);
  if (!key) {
    throw new Error(`shared/mobile/decision/shampoo.json has invalid step key '${String(raw.key || "")}'`);
  }
  const title = String(raw.title || "").trim();
  const note = String(raw.note || "").trim();
  const options = Array.isArray(raw.options) ? raw.options.map(parseShampooOption) : [];
  if (!title || !note || options.length === 0) {
    throw new Error(`shared/mobile/decision/shampoo.json step '${key}' is incomplete`);
  }
  return { key, title, note, options };
}

function parseShampooOption(raw: RawShampooProfileOption): ShampooProfileOption {
  const value = normalizeOptionValue(raw.value);
  const label = String(raw.label || "").trim();
  const sub = String(raw.sub || "").trim();
  const choiceLabel = String(raw.choice_label || "").trim();
  if (!value || !label || !sub || !choiceLabel) {
    throw new Error("shared/mobile/decision/shampoo.json contains an incomplete profile option");
  }
  return { value, label, sub, choiceLabel };
}

function buildChoiceLabelMap(steps: readonly ShampooProfileStep[]): Record<ShampooStepKey, Partial<Record<ShampooOptionValue, string>>> {
  return steps.reduce(
    (acc, step) => {
      acc[step.key] = step.options.reduce<Partial<Record<ShampooOptionValue, string>>>((optionAcc, option) => {
        optionAcc[option.value] = option.choiceLabel;
        return optionAcc;
      }, {});
      return acc;
    },
    {} as Record<ShampooStepKey, Partial<Record<ShampooOptionValue, string>>>,
  );
}

function normalizeStepKey(raw: string): ShampooStepKey | null {
  const value = String(raw || "").trim() as ShampooStepKey;
  return STEP_KEY_SET.has(value) ? value : null;
}

function normalizeOptionValue(raw: string): ShampooOptionValue | null {
  const value = String(raw || "").trim() as ShampooOptionValue;
  return OPTION_VALUE_SET.has(value) ? value : null;
}
