export type SkinSignal = "oily-acne" | "combo" | "dry-sensitive" | "stable";
export type IssueSignal = "oil-shine" | "tight-after" | "sting-red" | "residue";
export type SceneSignal = "morning-quick" | "night-clean" | "post-workout" | "after-sunscreen";
export type AvoidSignal = "over-clean" | "strong-fragrance" | "low-foam" | "complex-formula";

export type CleanserSignals = {
  skin?: SkinSignal;
  issue?: IssueSignal;
  scene?: SceneSignal;
  avoid?: AvoidSignal;
};

const segmentTexts: Record<SkinSignal, string> = {
  "oily-acne": "你属于油痘易闷人群，核心是清爽但不能暴力去脂。",
  combo: "你属于混合肤质人群，核心是 T 区与两颊的平衡清洁。",
  "dry-sensitive": "你属于干敏脆弱人群，核心是先稳住耐受和舒适度。",
  stable: "你属于稳定维持人群，核心是低波动、好坚持。",
};

const issueTexts: Record<IssueSignal, string> = {
  "oil-shine": "你最在意油光和闷感，重点是清爽净感与回油速度平衡。",
  "tight-after": "你最在意洗后紧绷，重点是清洁后依然舒适。",
  "sting-red": "你最在意刺痛泛红，重点是减少刺激变量。",
  residue: "你最在意防晒/轻妆残留，重点是清洁效率与冲净体验。",
};

const sceneTexts: Record<SceneSignal, string> = {
  "morning-quick": "你的场景是晨间快洗，重点是温和、快速、稳定。",
  "night-clean": "你的场景是夜间清洁，重点是完整清洁但不过度。",
  "post-workout": "你的场景是运动后，重点是快速净汗不拔干。",
  "after-sunscreen": "你的场景是防晒后，重点是洗净残留与肤感平衡。",
};

const avoidTexts: Record<AvoidSignal, string> = {
  "over-clean": "你明确排除过强清洁，所以避开去脂过猛路线。",
  "strong-fragrance": "你明确排除重香路线，所以优先低气味负担。",
  "low-foam": "你明确排除低泡无感路线，所以保留适度清洁反馈。",
  "complex-formula": "你明确排除复杂配方，所以优先简洁稳定。",
};

const notForByIssue: Record<IssueSignal, string> = {
  "oil-shine": "如果你要强脱脂“吱嘎感”，这个答案不适合你。",
  "tight-after": "如果你追求非常强的清洁力，这个答案不适合你。",
  "sting-red": "如果刺痛泛红持续加重，请先停止试新并优先就医。",
  residue: "如果你需要浓妆卸妆能力，请配合专门卸妆步骤。",
};

const notForByAvoid: Record<AvoidSignal, string> = {
  "over-clean": "如果你偏好强力洁净冲击感，这个答案不适合你。",
  "strong-fragrance": "如果你偏好明显留香洁面，这个答案不适合你。",
  "low-foam": "如果你只接受极低泡温吞洗感，这个答案不适合你。",
  "complex-formula": "如果你想要多重功效堆叠，这个答案不适合你。",
};

export function normalizeCleanserSignals(raw: Record<string, string | string[] | undefined>): CleanserSignals {
  const value = (k: string) => {
    const v = raw[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const skin = value("skin");
  const issue = value("issue");
  const scene = value("scene");
  const avoid = value("avoid");

  return {
    skin: isSkinSignal(skin) ? skin : undefined,
    issue: isIssueSignal(issue) ? issue : undefined,
    scene: isSceneSignal(scene) ? scene : undefined,
    avoid: isAvoidSignal(avoid) ? avoid : undefined,
  };
}

export function isCompleteCleanserSignals(s: CleanserSignals): s is Required<CleanserSignals> {
  return Boolean(s.skin && s.issue && s.scene && s.avoid);
}

export function toCleanserSearchParams(s: CleanserSignals): URLSearchParams {
  const qp = new URLSearchParams();
  if (s.skin) qp.set("skin", s.skin);
  if (s.issue) qp.set("issue", s.issue);
  if (s.scene) qp.set("scene", s.scene);
  if (s.avoid) qp.set("avoid", s.avoid);
  return qp;
}

export function buildCleanserSegmentLine(s: Required<CleanserSignals>): string {
  return segmentTexts[s.skin];
}

export function buildCleanserReasonLines(s: Required<CleanserSignals>): string[] {
  return [issueTexts[s.issue], sceneTexts[s.scene], avoidTexts[s.avoid]];
}

export function buildCleanserNotForLines(s: Required<CleanserSignals>): string[] {
  return [notForByIssue[s.issue], notForByAvoid[s.avoid]];
}

export function shouldFallbackCleanser(s: Required<CleanserSignals>): boolean {
  return s.skin === "dry-sensitive" && (s.issue === "sting-red" || s.avoid === "over-clean");
}

export function buildCleanserRollbackLine(s: Required<CleanserSignals>): string | null {
  if (!shouldFallbackCleanser(s)) return null;
  return "当前信号提示耐受优先，先回退到温和极简洁面路线，避免继续加大清洁刺激。";
}

export function buildCleanserWhyNotOthers(s: Required<CleanserSignals>): string {
  if (shouldFallbackCleanser(s)) {
    return "你的信号同时指向“先稳耐受”，所以我们主动回退到温和洁面，不给强清洁备选。";
  }
  const alt = s.issue === "oil-shine" ? "强脱脂清洁路线" : s.issue === "residue" ? "多步骤复杂清洁路线" : "重香刺激路线";
  return `你的四个信号收敛到“清洁够用 + 肤感可持续 + 节奏稳定”，所以我们没有给你 ${alt}，也没有第二名。`;
}

export function buildCleanserUsageLine(s: Required<CleanserSignals>): string {
  if (s.scene === "morning-quick") return "晨间一次温和清洁即可，控制在 20-30 秒并彻底冲净。";
  if (s.scene === "after-sunscreen") return "防晒后先做好卸除，再用洁面完成收尾，避免二次过度清洁。";
  if (s.scene === "post-workout") return "运动后尽快清洁汗液与皮脂，使用常规用量即可，不要反复搓洗。";
  return "夜间清洁以一次到位为主，维持固定产品与频次更容易稳定。";
}

function isSkinSignal(v?: string): v is SkinSignal {
  return v === "oily-acne" || v === "combo" || v === "dry-sensitive" || v === "stable";
}

function isIssueSignal(v?: string): v is IssueSignal {
  return v === "oil-shine" || v === "tight-after" || v === "sting-red" || v === "residue";
}

function isSceneSignal(v?: string): v is SceneSignal {
  return v === "morning-quick" || v === "night-clean" || v === "post-workout" || v === "after-sunscreen";
}

function isAvoidSignal(v?: string): v is AvoidSignal {
  return v === "over-clean" || v === "strong-fragrance" || v === "low-foam" || v === "complex-formula";
}
