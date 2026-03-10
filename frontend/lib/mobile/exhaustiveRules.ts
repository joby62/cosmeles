export type RuleQuestion = {
  key: string;
  title: string;
  options: Record<string, string>;
};

export type RuleConfig = {
  category: string;
  categories: string[];
  questions: RuleQuestion[];
  scoring_matrix: Record<string, Record<string, number[]>>;
  veto_masks: Array<{
    trigger: string;
    mask: number[];
    note?: string;
  }>;
};

export type RuleDistributionItem = {
  category: string;
  hits: number;
  percentage: number;
  warning: "depletion" | "monopoly" | null;
};

export type RuleExhaustiveResult = {
  category: string;
  dimensions: number;
  totalCases: number;
  distribution: RuleDistributionItem[];
};

type AnswerMap = Record<string, string>;

function evaluateAtomicClause(clause: string, answers: AnswerMap): boolean {
  const match = clause.trim().match(/^([a-zA-Z0-9_]+)\s*==\s*'([^']+)'$/);
  if (!match) return false;
  const [, key, value] = match;
  return answers[key] === value;
}

export function evalTrigger(trigger: string, answers: AnswerMap): boolean {
  const normalized = trigger.trim();
  if (!normalized) return false;
  return normalized.split(/\s+OR\s+/).some((orSegment) =>
    orSegment
      .split(/\s+AND\s+/)
      .every((andSegment) => evaluateAtomicClause(andSegment, answers)),
  );
}

function calculateBestMatch(answers: AnswerMap, config: RuleConfig): string {
  const scores = config.categories.map(() => 0);

  for (const [qKey, qVal] of Object.entries(answers)) {
    const weights = config.scoring_matrix[qKey]?.[qVal];
    if (!weights) continue;
    for (let i = 0; i < config.categories.length; i += 1) {
      scores[i] += weights[i] ?? 0;
    }
  }

  for (const veto of config.veto_masks) {
    if (!evalTrigger(veto.trigger, answers)) continue;
    for (let i = 0; i < config.categories.length; i += 1) {
      scores[i] *= veto.mask[i] ?? 1;
    }
  }

  let bestIndex = 0;
  for (let i = 1; i < config.categories.length; i += 1) {
    if (scores[i] > scores[bestIndex]) bestIndex = i;
  }
  return config.categories[bestIndex] ?? "";
}

function buildAllAnswerCombos(questions: RuleQuestion[]): AnswerMap[] {
  let combinations: AnswerMap[] = [{}];
  for (const question of questions) {
    const optionKeys = Object.keys(question.options);
    const next: AnswerMap[] = [];
    for (const existing of combinations) {
      for (const option of optionKeys) {
        next.push({ ...existing, [question.key]: option });
      }
    }
    combinations = next;
  }
  return combinations;
}

export function runExhaustiveRules(configs: RuleConfig[]): RuleExhaustiveResult[] {
  return configs.map((config) => {
    const combinations = buildAllAnswerCombos(config.questions);
    const totalCases = combinations.length;
    const hitMap = new Map<string, number>();

    for (const answers of combinations) {
      const best = calculateBestMatch(answers, config);
      hitMap.set(best, (hitMap.get(best) ?? 0) + 1);
    }

    const distribution: RuleDistributionItem[] = config.categories.map((category) => {
      const hits = hitMap.get(category) ?? 0;
      const percentage = totalCases > 0 ? (hits / totalCases) * 100 : 0;
      const warning =
        percentage < 2 ? "depletion" : percentage > 40 ? "monopoly" : null;
      return { category, hits, percentage, warning };
    });

    return {
      category: config.category,
      dimensions: config.questions.length,
      totalCases,
      distribution,
    };
  });
}
