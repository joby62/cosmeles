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
