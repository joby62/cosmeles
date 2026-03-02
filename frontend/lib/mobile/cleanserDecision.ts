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
