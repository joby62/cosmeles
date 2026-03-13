export type DecisionProfileOption<TOption extends string> = {
  value: TOption;
  label: string;
  sub: string;
  choiceLabel: string;
};

export type DecisionProfileStep<TStep extends string, TOption extends string> = {
  key: TStep;
  title: string;
  note: string;
  options: readonly DecisionProfileOption<TOption>[];
};

type RawDecisionCategoryConfig = {
  schema_version?: string;
  category?: string;
  profile?: {
    steps?: RawDecisionProfileStep[];
  };
};

type RawDecisionProfileStep = {
  key?: string;
  title?: string;
  note?: string;
  options?: RawDecisionProfileOption[];
};

type RawDecisionProfileOption = {
  value?: string;
  label?: string;
  sub?: string;
  choice_label?: string;
};

type ParseDecisionProfileConfigArgs<TStep extends string, TOption extends string> = {
  rawConfig: RawDecisionCategoryConfig;
  sourceName: string;
  expectedCategory: string;
  stepKeys: readonly TStep[];
  optionValues: readonly TOption[];
};

export function parseDecisionProfileConfig<TStep extends string, TOption extends string>({
  rawConfig,
  sourceName,
  expectedCategory,
  stepKeys,
  optionValues,
}: ParseDecisionProfileConfigArgs<TStep, TOption>): {
  steps: readonly DecisionProfileStep<TStep, TOption>[];
  choiceLabels: Record<TStep, Partial<Record<TOption, string>>>;
} {
  const schemaVersion = String(rawConfig.schema_version || "").trim();
  if (schemaVersion !== "mobile_decision_category.v1") {
    throw new Error(`${sourceName} has unsupported schema_version`);
  }

  const category = String(rawConfig.category || "").trim();
  if (category !== expectedCategory) {
    throw new Error(`${sourceName} has mismatched category '${category || "-"}'`);
  }

  const stepKeySet = new Set(stepKeys);
  const optionValueSet = new Set(optionValues);
  const rawSteps = Array.isArray(rawConfig.profile?.steps) ? rawConfig.profile.steps : [];
  const seenStepKeys = new Set<TStep>();
  const steps = rawSteps.map((rawStep) =>
    parseDecisionProfileStep(rawStep, {
      expectedStepKeys: stepKeySet,
      optionValueSet,
      seenStepKeys,
      sourceName,
    }),
  );

  if (steps.length !== stepKeys.length) {
    throw new Error(`${sourceName} has incomplete profile steps`);
  }

  return {
    steps,
    choiceLabels: buildChoiceLabelMap(steps),
  };
}

function parseDecisionProfileStep<TStep extends string, TOption extends string>(
  rawStep: RawDecisionProfileStep,
  {
    expectedStepKeys,
    optionValueSet,
    seenStepKeys,
    sourceName,
  }: {
    expectedStepKeys: Set<TStep>;
    optionValueSet: Set<TOption>;
    seenStepKeys: Set<TStep>;
    sourceName: string;
  },
): DecisionProfileStep<TStep, TOption> {
  const key = String(rawStep.key || "").trim() as TStep;
  if (!expectedStepKeys.has(key)) {
    throw new Error(`${sourceName} has invalid step key '${String(rawStep.key || "")}'`);
  }
  if (seenStepKeys.has(key)) {
    throw new Error(`${sourceName} has duplicate step key '${key}'`);
  }
  seenStepKeys.add(key);

  const title = String(rawStep.title || "").trim();
  const note = String(rawStep.note || "").trim();
  const options = Array.isArray(rawStep.options)
    ? rawStep.options.map((rawOption) => parseDecisionProfileOption(rawOption, optionValueSet, sourceName))
    : [];
  if (!title || !note || options.length === 0) {
    throw new Error(`${sourceName} step '${key}' is incomplete`);
  }

  return { key, title, note, options };
}

function parseDecisionProfileOption<TOption extends string>(
  rawOption: RawDecisionProfileOption,
  optionValueSet: Set<TOption>,
  sourceName: string,
): DecisionProfileOption<TOption> {
  const value = String(rawOption.value || "").trim() as TOption;
  const label = String(rawOption.label || "").trim();
  const sub = String(rawOption.sub || "").trim();
  const choiceLabel = String(rawOption.choice_label || "").trim();
  if (!optionValueSet.has(value) || !label || !sub || !choiceLabel) {
    throw new Error(`${sourceName} contains an incomplete profile option`);
  }
  return { value, label, sub, choiceLabel };
}

function buildChoiceLabelMap<TStep extends string, TOption extends string>(
  steps: readonly DecisionProfileStep<TStep, TOption>[],
): Record<TStep, Partial<Record<TOption, string>>> {
  return steps.reduce(
    (acc, step) => {
      acc[step.key] = step.options.reduce<Partial<Record<TOption, string>>>((optionAcc, option) => {
        optionAcc[option.value] = option.choiceLabel;
        return optionAcc;
      }, {});
      return acc;
    },
    {} as Record<TStep, Partial<Record<TOption, string>>>,
  );
}
