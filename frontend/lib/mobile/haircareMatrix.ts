export type AnswerMap = Record<string, string>;
export type ScoreMap = Record<string, number>;

export type MatrixConfig = {
  categories: string[];
  scoringMatrix: Record<string, Record<string, Record<string, number>>>;
  vetoMasks: Array<{
    trigger: Record<string, string>;
    mask: Record<string, number>;
  }>;
};

export type MatrixResult = {
  bestMatch: string;
  scores: ScoreMap;
  top2: Array<{ category: string; score: number }>;
};

export type MatrixCsvTestRow = {
  testId: string;
  desc: string;
  q1: string;
  q2: string;
  q3: string;
  cQ1: string;
  cQ2: string;
  cQ3: string;
  expShampoo: string;
  expConditioner: string;
};

export type MatrixCsvTestResult = {
  row: MatrixCsvTestRow;
  shampoo: MatrixResult;
  conditioner: MatrixResult;
  shampooPass: boolean;
  conditionerPass: boolean;
  pass: boolean;
};

export type MatrixCsvRunSummary = {
  total: number;
  passed: number;
  accuracy: number;
  results: MatrixCsvTestResult[];
};

export type QuestionOption = {
  value: string;
  label: string;
};

export type MatrixQuestion = {
  key: string;
  label: string;
  options: QuestionOption[];
};

function top2(scores: ScoreMap): Array<{ category: string; score: number }> {
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([category, score]) => ({ category, score }));
}

export function calculateBestMatch(userAnswers: AnswerMap, config: MatrixConfig): MatrixResult {
  const scores: ScoreMap = Object.fromEntries(config.categories.map((category) => [category, 0]));
  const excluded = new Set<string>();

  for (const [questionKey, answerVal] of Object.entries(userAnswers)) {
    const answerWeights = config.scoringMatrix[questionKey]?.[answerVal];
    if (!answerWeights) continue;
    for (const [category, points] of Object.entries(answerWeights)) {
      if (category in scores) {
        scores[category] += points;
      }
    }
  }

  for (const veto of config.vetoMasks) {
    const triggered = Object.entries(veto.trigger).every(([tKey, tVal]) => userAnswers[tKey] === tVal);
    if (!triggered) continue;
    for (const [category, maskValue] of Object.entries(veto.mask)) {
      if (category in scores && maskValue <= 0) {
        excluded.add(category);
      }
    }
  }

  for (const category of excluded) {
    scores[category] = Number.NEGATIVE_INFINITY;
  }

  let bestMatch = config.categories[0];
  for (const category of config.categories.slice(1)) {
    if ((scores[category] ?? Number.NEGATIVE_INFINITY) > (scores[bestMatch] ?? Number.NEGATIVE_INFINITY)) {
      bestMatch = category;
    }
  }

  return {
    bestMatch,
    scores,
    top2: top2(scores),
  };
}

export const SHAMPOO_CONFIG: MatrixConfig = {
  categories: ["deep-oil-control", "anti-dandruff-itch", "gentle-soothing", "anti-hair-loss", "moisture-balance"],
  scoringMatrix: {
    q1: {
      A: { "deep-oil-control": 15, "anti-dandruff-itch": 5, "gentle-soothing": -10, "anti-hair-loss": -15, "moisture-balance": -15 },
      B: { "deep-oil-control": -5, "anti-dandruff-itch": 0, "gentle-soothing": 5, "anti-hair-loss": 0, "moisture-balance": 5 },
      C: { "deep-oil-control": -15, "anti-dandruff-itch": -5, "gentle-soothing": 10, "anti-hair-loss": 0, "moisture-balance": 15 },
    },
    q2: {
      A: { "deep-oil-control": 0, "anti-dandruff-itch": 30, "gentle-soothing": 0, "anti-hair-loss": 0, "moisture-balance": -10 },
      B: { "deep-oil-control": -20, "anti-dandruff-itch": -15, "gentle-soothing": 30, "anti-hair-loss": -10, "moisture-balance": 5 },
      C: { "deep-oil-control": 5, "anti-dandruff-itch": 0, "gentle-soothing": 5, "anti-hair-loss": 30, "moisture-balance": 0 },
      D: { "deep-oil-control": 2, "anti-dandruff-itch": -5, "gentle-soothing": -5, "anti-hair-loss": -5, "moisture-balance": 5 },
    },
    q3: {
      A: { "deep-oil-control": -5, "anti-dandruff-itch": 0, "gentle-soothing": 5, "anti-hair-loss": 0, "moisture-balance": 8 },
      B: { "deep-oil-control": 5, "anti-dandruff-itch": 0, "gentle-soothing": 0, "anti-hair-loss": 5, "moisture-balance": -5 },
      C: { "deep-oil-control": 0, "anti-dandruff-itch": 0, "gentle-soothing": 0, "anti-hair-loss": 0, "moisture-balance": 0 },
    },
  },
  vetoMasks: [
    { trigger: { q2: "B" }, mask: { "deep-oil-control": 0, "anti-dandruff-itch": 0, "anti-hair-loss": 0 } },
    { trigger: { q2: "A" }, mask: { "moisture-balance": 0 } },
    { trigger: { q1: "C" }, mask: { "deep-oil-control": 0 } },
  ],
};

export const CONDITIONER_CONFIG: MatrixConfig = {
  categories: ["c-color-lock", "c-airy-light", "c-structure-rebuild", "c-smooth-frizz", "c-basic-hydrate"],
  scoringMatrix: {
    c_q1: {
      A: { "c-color-lock": 15, "c-airy-light": -5, "c-structure-rebuild": 20, "c-smooth-frizz": 10, "c-basic-hydrate": -10 },
      B: { "c-color-lock": 5, "c-airy-light": 5, "c-structure-rebuild": 5, "c-smooth-frizz": 5, "c-basic-hydrate": 10 },
      C: { "c-color-lock": -15, "c-airy-light": 10, "c-structure-rebuild": -15, "c-smooth-frizz": -5, "c-basic-hydrate": 15 },
    },
    c_q2: {
      A: { "c-color-lock": 0, "c-airy-light": 25, "c-structure-rebuild": 5, "c-smooth-frizz": -20, "c-basic-hydrate": 5 },
      B: { "c-color-lock": 0, "c-airy-light": -15, "c-structure-rebuild": 10, "c-smooth-frizz": 25, "c-basic-hydrate": -5 },
      C: { "c-color-lock": 0, "c-airy-light": 5, "c-structure-rebuild": 0, "c-smooth-frizz": 5, "c-basic-hydrate": 5 },
    },
    c_q3: {
      A: { "c-color-lock": 25, "c-airy-light": 0, "c-structure-rebuild": 5, "c-smooth-frizz": 0, "c-basic-hydrate": 0 },
      B: { "c-color-lock": 0, "c-airy-light": -10, "c-structure-rebuild": 5, "c-smooth-frizz": 20, "c-basic-hydrate": 5 },
      C: { "c-color-lock": 0, "c-airy-light": 10, "c-structure-rebuild": 0, "c-smooth-frizz": -5, "c-basic-hydrate": 10 },
    },
  },
  vetoMasks: [
    { trigger: { c_q2: "A" }, mask: { "c-smooth-frizz": 0 } },
    { trigger: { c_q1: "C" }, mask: { "c-color-lock": 0, "c-structure-rebuild": 0 } },
  ],
};

export const SHAMPOO_QUESTIONS: MatrixQuestion[] = [
  {
    key: "q1",
    label: "Q1 头皮出油节奏",
    options: [
      { value: "A", label: "A 一天不洗就油" },
      { value: "B", label: "B 2-3 天洗一次" },
      { value: "C", label: "C 3 天以上不油" },
    ],
  },
  {
    key: "q2",
    label: "Q2 头皮痛点",
    options: [
      { value: "A", label: "A 头屑发痒" },
      { value: "B", label: "B 发红刺痛" },
      { value: "C", label: "C 掉发明显/发根脆弱" },
      { value: "D", label: "D 无特殊感觉" },
    ],
  },
  {
    key: "q3",
    label: "Q3 发丝状态",
    options: [
      { value: "A", label: "A 染烫受损" },
      { value: "B", label: "B 细软贴头皮" },
      { value: "C", label: "C 基本健康" },
    ],
  },
];

export const CONDITIONER_QUESTIONS: MatrixQuestion[] = [
  {
    key: "c_q1",
    label: "C_Q1 发丝受损史",
    options: [
      { value: "A", label: "A 频繁漂/染/烫 (干枯空洞)" },
      { value: "B", label: "B 偶尔染烫/经常使用热工具 (轻度受损)" },
      { value: "C", label: "C 原生发/几乎不折腾 (健康)" },
    ],
  },
  {
    key: "c_q2",
    label: "C_Q2 发丝物理形态",
    options: [
      { value: "A", label: "A 细软少/极易贴头皮" },
      { value: "B", label: "B 粗硬/沙发/天生毛躁" },
      { value: "C", label: "C 正常适中" },
    ],
  },
  {
    key: "c_q3",
    label: "C_Q3 当前最渴望的视觉效果",
    options: [
      { value: "A", label: "A 刚染完，需要锁色/固色" },
      { value: "B", label: "B 打结梳不开，需要极致顺滑" },
      { value: "C", label: "C 发尾不干枯，保持自然蓬松就行" },
    ],
  },
];

export const MATRIX_CSV_DATA = `test_id,desc,q1,q2,q3,c_q1,c_q2,c_q3,exp_shampoo,exp_conditioner
1,classic commuter oily scalp,A,D,C,C,C,C,deep-oil-control,c-basic-hydrate
2,regularly styled routine,B,D,A,A,C,C,moisture-balance,c-structure-rebuild
3,naturally fine flat hair,A,D,B,B,A,C,deep-oil-control,c-airy-light
4,natural frizz curls,C,D,C,B,B,B,moisture-balance,c-smooth-frizz
5,seasonal mild dandruff,B,A,C,C,C,C,anti-dandruff-itch,c-basic-hydrate
6,recently dyed fresh color,B,D,A,B,C,A,moisture-balance,c-color-lock`;

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  fields.push(current.trim());
  return fields;
}

function parseCsvRows(csvText: string): MatrixCsvTestRow[] {
  const lines = csvText.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]);
  const rows: MatrixCsvTestRow[] = [];

  for (const line of lines.slice(1)) {
    const values = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() ?? "";
    });
    rows.push({
      testId: row.test_id ?? "",
      desc: row.desc ?? "",
      q1: row.q1 ?? "",
      q2: row.q2 ?? "",
      q3: row.q3 ?? "",
      cQ1: row.c_q1 ?? "",
      cQ2: row.c_q2 ?? "",
      cQ3: row.c_q3 ?? "",
      expShampoo: row.exp_shampoo ?? "",
      expConditioner: row.exp_conditioner ?? "",
    });
  }

  return rows;
}

function parseNumericTestIdValue(raw: string): number | null {
  const value = raw.trim();
  if (!/^-?\d+$/.test(value)) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

const testIdCollator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export function compareMatrixTestId(a: string, b: string): number {
  const left = a.trim();
  const right = b.trim();

  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;

  const leftNum = parseNumericTestIdValue(left);
  const rightNum = parseNumericTestIdValue(right);
  if (leftNum !== null && rightNum !== null && leftNum !== rightNum) return leftNum - rightNum;
  if (leftNum !== null && rightNum === null) return -1;
  if (leftNum === null && rightNum !== null) return 1;
  return testIdCollator.compare(left, right);
}

function dedupeAndSortRows(rows: MatrixCsvTestRow[]): MatrixCsvTestRow[] {
  const dedupedById = new Map<string, MatrixCsvTestRow>();
  const rowsWithoutId: MatrixCsvTestRow[] = [];

  for (const row of rows) {
    const testId = row.testId.trim();
    if (!testId) {
      rowsWithoutId.push(row);
      continue;
    }
    // 相同 test_id 以最后一条为准，便于直接覆盖修正。
    dedupedById.set(testId, { ...row, testId });
  }

  return [...dedupedById.values(), ...rowsWithoutId].sort((a, b) => compareMatrixTestId(a.testId, b.testId));
}

export function runMatrixCsvTests(csvText = MATRIX_CSV_DATA): MatrixCsvRunSummary {
  const rows = dedupeAndSortRows(parseCsvRows(csvText));
  const results: MatrixCsvTestResult[] = rows.map((row) => {
    const shampooAnswers: AnswerMap = { q1: row.q1, q2: row.q2, q3: row.q3 };
    const conditionerAnswers: AnswerMap = { c_q1: row.cQ1, c_q2: row.cQ2, c_q3: row.cQ3 };
    const shampoo = calculateBestMatch(shampooAnswers, SHAMPOO_CONFIG);
    const conditioner = calculateBestMatch(conditionerAnswers, CONDITIONER_CONFIG);
    const shampooPass = shampoo.bestMatch === row.expShampoo;
    const conditionerPass = conditioner.bestMatch === row.expConditioner;
    return {
      row,
      shampoo,
      conditioner,
      shampooPass,
      conditionerPass,
      pass: shampooPass && conditionerPass,
    };
  });

  const total = results.length;
  const passed = results.filter((item) => item.pass).length;
  const accuracy = total > 0 ? (passed / total) * 100 : 0;

  return {
    total,
    passed,
    accuracy,
    results,
  };
}
