export type GroupSignal = "dry-tight" | "rough-dull" | "sensitive-red" | "stable-maintain";
export type IssueSignal = "itch-flake" | "rough-patch" | "dull-no-soft" | "none";
export type SceneSignal = "after-shower" | "dry-cold" | "ac-room" | "night-repair";
export type AvoidSignal = "sticky-greasy" | "strong-fragrance" | "active-too-much" | "none";

export type LotionSignals = {
  group?: GroupSignal;
  issue?: IssueSignal;
  scene?: SceneSignal;
  avoid?: AvoidSignal;
};

const segmentTexts: Record<GroupSignal, string> = {
  "dry-tight": "你属于干燥紧绷人群，重点是先把舒适度和稳定感找回来。",
  "rough-dull": "你属于粗糙暗沉人群，重点是改善肤感与触感细腻度。",
  "sensitive-red": "你属于敏感脆弱人群，优先低刺激、少变量、稳屏障。",
  "stable-maintain": "你属于稳定维持人群，核心是长期可持续、低负担。",
};

const issueTexts: Record<IssueSignal, string> = {
  "itch-flake": "你当前有干痒或起屑倾向，说明屏障稳定性优先级更高。",
  "rough-patch": "你当前有局部粗糙（如手肘膝盖），需要更稳定的润泽覆盖。",
  "dull-no-soft": "你当前主要是不够柔软细腻，重点是改善触感而非堆叠功效。",
  none: "你没有明显困扰，适合用一条稳定路线长期维护。",
};

const sceneTexts: Record<SceneSignal, string> = {
  "after-shower": "你主要在洗澡后使用，最佳策略是趁微湿快速封住水分。",
  "dry-cold": "你主要在干冷换季使用，重点是提升保湿续航。",
  "ac-room": "你主要在空调环境使用，重点是白天补涂也不黏。",
  "night-repair": "你主要在夜间使用，重点是稳住到第二天的肤感。",
};

const avoidTexts: Record<AvoidSignal, string> = {
  "sticky-greasy": "你明确排除厚重黏腻路线，所以会优先清爽不糊。",
  "strong-fragrance": "你明确排除重香路线，所以会优先气味克制。",
  "active-too-much": "你明确排除复杂活性叠加，所以会优先极简稳定。",
  none: "你没有明确排除项，可以按综合信号直接拍板。",
};

const notForByIssue: Record<IssueSignal, string> = {
  "itch-flake": "如果你已经出现持续明显红疹，请先停止试新并优先就医。",
  "rough-patch": "如果你追求强去角质速效路线，这个答案不适合你。",
  "dull-no-soft": "如果你只要强功能高刺激体验，这个答案不适合你。",
  none: "如果你要短期强见效路线，这个答案不适合你。",
};

const notForByAvoid: Record<AvoidSignal, string> = {
  "sticky-greasy": "如果你偏爱油膜感很重的包裹体验，这个答案不适合你。",
  "strong-fragrance": "如果你偏好明显留香身体乳，这个答案不适合你。",
  "active-too-much": "如果你要多活性叠加“功能感”，这个答案不适合你。",
  none: "如果你只接受极轻薄到近乎无感，这个答案不适合你。",
};

export function normalizeLotionSignals(raw: Record<string, string | string[] | undefined>): LotionSignals {
  const value = (k: string) => {
    const v = raw[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const group = value("group");
  const issue = value("issue");
  const scene = value("scene");
  const avoid = value("avoid");

  return {
    group: isGroupSignal(group) ? group : undefined,
    issue: isIssueSignal(issue) ? issue : undefined,
    scene: isSceneSignal(scene) ? scene : undefined,
    avoid: isAvoidSignal(avoid) ? avoid : undefined,
  };
}

export function isCompleteLotionSignals(s: LotionSignals): s is Required<LotionSignals> {
  return Boolean(s.group && s.issue && s.scene && s.avoid);
}

export function toLotionSearchParams(s: LotionSignals): URLSearchParams {
  const qp = new URLSearchParams();
  if (s.group) qp.set("group", s.group);
  if (s.issue) qp.set("issue", s.issue);
  if (s.scene) qp.set("scene", s.scene);
  if (s.avoid) qp.set("avoid", s.avoid);
  return qp;
}

export function buildLotionSegmentLine(s: Required<LotionSignals>): string {
  return segmentTexts[s.group];
}

export function buildLotionReasonLines(s: Required<LotionSignals>): string[] {
  return [issueTexts[s.issue], sceneTexts[s.scene], avoidTexts[s.avoid]];
}

export function buildLotionNotForLines(s: Required<LotionSignals>): string[] {
  return [notForByIssue[s.issue], notForByAvoid[s.avoid]];
}

export function shouldFallbackLotion(s: Required<LotionSignals>): boolean {
  return s.group === "sensitive-red" && (s.issue === "itch-flake" || s.avoid === "active-too-much");
}

export function buildLotionRollbackLine(s: Required<LotionSignals>): string | null {
  if (!shouldFallbackLotion(s)) return null;
  return "当前信号显示屏障稳定性优先，先回退到极简修护路线，比追求功能更稳。";
}

export function buildLotionWhyNotOthers(s: Required<LotionSignals>): string {
  if (shouldFallbackLotion(s)) {
    return "你的人群信号与排除项都在提示“先稳再进阶”，所以我们主动回退到极简修护，不给功能型备选。";
  }
  const alt = s.avoid === "sticky-greasy" ? "厚重油润路线" : s.avoid === "active-too-much" ? "多活性功能路线" : "重香感路线";
  return `你的四个信号共同收敛到“稳定保湿 + 低负担 + 可持续”，所以我们没有给你 ${alt}，也没有第二名。`;
}

export function buildLotionUsageLine(s: Required<LotionSignals>): string {
  if (s.scene === "after-shower") return "洗澡后 3 分钟内涂抹一层，先照顾四肢和粗糙区域，再少量补全身。";
  if (s.scene === "ac-room") return "白天薄涂一层即可，局部干紧时补涂，不需要每次大面积重涂。";
  if (s.scene === "dry-cold") return "干冷期早晚各一次，优先手肘、膝盖和小腿，连续用比频繁换更有效。";
  return "夜间用量可略高于白天，重在稳定连续使用 1-2 周观察触感改善。";
}

function isGroupSignal(v?: string): v is GroupSignal {
  return v === "dry-tight" || v === "rough-dull" || v === "sensitive-red" || v === "stable-maintain";
}

function isIssueSignal(v?: string): v is IssueSignal {
  return v === "itch-flake" || v === "rough-patch" || v === "dull-no-soft" || v === "none";
}

function isSceneSignal(v?: string): v is SceneSignal {
  return v === "after-shower" || v === "dry-cold" || v === "ac-room" || v === "night-repair";
}

function isAvoidSignal(v?: string): v is AvoidSignal {
  return v === "sticky-greasy" || v === "strong-fragrance" || v === "active-too-much" || v === "none";
}
