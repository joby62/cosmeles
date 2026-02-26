export const SHAMPOO_FEATURED_PRODUCT_ID = "db1422ec-6263-45cc-966e-0ee9292fd8f1";

export type ScalpSignal = "very-oily" | "oily" | "normal" | "dry-sensitive";
export type IssueSignal = "flat-oily" | "itch-dandruff" | "dry-frizz" | "none";
export type SceneSignal = "rush-morning" | "daily-commute" | "post-workout";
export type AvoidSignal = "strong-fragrance" | "high-cleansing" | "none";

export type ShampooSignals = {
  scalp?: ScalpSignal;
  issue?: IssueSignal;
  scene?: SceneSignal;
  avoid?: AvoidSignal;
};

const scalpTexts: Record<ScalpSignal, string> = {
  "very-oily": "你头皮出油偏快，需要清洁够用但不过度拔干。",
  oily: "你是偏油头皮，重点是洗后清爽并维持蓬松。",
  normal: "你属于中性头皮，优先稳定、日常可持续使用。",
  "dry-sensitive": "你头皮偏干或偏敏，优先降低刺激感和紧绷感。",
};

const issueTexts: Record<IssueSignal, string> = {
  "flat-oily": "你最在意的是容易塌和黏，核心目标是蓬松感。",
  "itch-dandruff": "你有头皮痒或头屑困扰，需要温和且干净的平衡。",
  "dry-frizz": "你在意毛躁和干涩，需要基础柔顺与保湿。",
  none: "你目前没有明显困扰，重点是长期稳定好用。",
};

const sceneTexts: Record<SceneSignal, string> = {
  "rush-morning": "你的场景是赶时间，要求起泡快、冲洗快、结果稳定。",
  "daily-commute": "你的场景是通勤日常，需要每天都能放心用。",
  "post-workout": "你的场景是运动后，重点是清爽感和气味负担控制。",
};

const avoidTexts: Record<AvoidSignal, string> = {
  "strong-fragrance": "你明确排除了浓香路线，所以会优先克制气味。",
  "high-cleansing": "你明确不想过强清洁，所以会避开去脂过猛的路线。",
  none: "你没有明确排除项，可以按综合匹配直接拍板。",
};

const notForByAvoid: Record<AvoidSignal, string> = {
  "strong-fragrance": "如果你只接受完全无香配方，这个答案不适合你。",
  "high-cleansing": "如果你希望强去油、强清洁型洗感，这个答案不适合你。",
  none: "如果你追求重修护发膜感，这个答案不适合你。",
};

const notForByIssue: Record<IssueSignal, string> = {
  "flat-oily": "如果你已经有明显头皮炎症，请先优先处理头皮问题。",
  "itch-dandruff": "如果你需要药理级去屑方案，这个答案不适合你。",
  "dry-frizz": "如果你是重度漂烫受损，需要更高强度修护线。",
  none: "如果你追求极端功能型路线，这个答案不适合你。",
};

export function normalizeShampooSignals(
  raw: Record<string, string | string[] | undefined>,
): ShampooSignals {
  const value = (k: string) => {
    const v = raw[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const scalp = value("scalp");
  const issue = value("issue");
  const scene = value("scene");
  const avoid = value("avoid");

  return {
    scalp: isScalpSignal(scalp) ? scalp : undefined,
    issue: isIssueSignal(issue) ? issue : undefined,
    scene: isSceneSignal(scene) ? scene : undefined,
    avoid: isAvoidSignal(avoid) ? avoid : undefined,
  };
}

export function isCompleteShampooSignals(s: ShampooSignals): s is Required<ShampooSignals> {
  return Boolean(s.scalp && s.issue && s.scene && s.avoid);
}

export function toSignalSearchParams(s: ShampooSignals): URLSearchParams {
  const qp = new URLSearchParams();
  if (s.scalp) qp.set("scalp", s.scalp);
  if (s.issue) qp.set("issue", s.issue);
  if (s.scene) qp.set("scene", s.scene);
  if (s.avoid) qp.set("avoid", s.avoid);
  return qp;
}

export function buildShampooReasonLines(s: Required<ShampooSignals>): string[] {
  return [scalpTexts[s.scalp], issueTexts[s.issue], sceneTexts[s.scene], avoidTexts[s.avoid]];
}

export function buildShampooNotForLines(s: Required<ShampooSignals>): string[] {
  return [notForByAvoid[s.avoid], notForByIssue[s.issue]];
}

export function buildShampooWhyNotOthers(s: Required<ShampooSignals>): string {
  const concern =
    s.issue === "dry-frizz"
      ? "重修护路线"
      : s.issue === "itch-dandruff"
        ? "强功效去屑路线"
        : "高刺激清洁路线";
  return `你的四个信号同时指向“日常稳定 + 清爽蓬松 + 不折腾”，所以我们没有给你 ${concern}，也没有给第二名。`;
}

export function buildShampooUsageLine(s: Required<ShampooSignals>): string {
  if (s.scene === "post-workout") return "运动后一次按压起泡清洁，冲净后直接结束，不必叠加强清洁。";
  if (s.scene === "rush-morning") return "早上一次常规清洗即可，重点放在头皮按摩 20 秒后冲净。";
  return "按日常频率使用，先清洁头皮再带过发丝，保持稳定节奏更重要。";
}

function isScalpSignal(v?: string): v is ScalpSignal {
  return v === "very-oily" || v === "oily" || v === "normal" || v === "dry-sensitive";
}

function isIssueSignal(v?: string): v is IssueSignal {
  return v === "flat-oily" || v === "itch-dandruff" || v === "dry-frizz" || v === "none";
}

function isSceneSignal(v?: string): v is SceneSignal {
  return v === "rush-morning" || v === "daily-commute" || v === "post-workout";
}

function isAvoidSignal(v?: string): v is AvoidSignal {
  return v === "strong-fragrance" || v === "high-cleansing" || v === "none";
}
