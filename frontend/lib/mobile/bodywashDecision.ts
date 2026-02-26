export type FeelSignal = "dry-tight" | "slimy" | "itch-red" | "odor-fast";
export type SceneSignal = "quick-morning" | "night-care" | "post-workout" | "dry-season";
export type SkinSignal = "dry" | "oily" | "sensitive" | "stable";
export type AvoidSignal = "strong-fragrance" | "hard-rinse" | "too-strong-clean" | "complex-formula";

export type BodyWashSignals = {
  feel?: FeelSignal;
  scene?: SceneSignal;
  skin?: SkinSignal;
  avoid?: AvoidSignal;
};

const feelTexts: Record<FeelSignal, string> = {
  "dry-tight": "你最怕洗后紧绷发干，核心是清洁后依然舒适。",
  slimy: "你最怕冲不净有膜感，核心是清爽快冲。",
  "itch-red": "你最怕痒和泛红，核心是降低刺激负担。",
  "odor-fast": "你最怕体味回潮快，核心是净味与日常平衡。",
};

const sceneTexts: Record<SceneSignal, string> = {
  "quick-morning": "你的场景是早晨快冲，要求高效率且稳定。",
  "night-care": "你的场景是晚间认真洗，要求肤感舒适并可持续。",
  "post-workout": "你的场景是运动后冲洗，重点是快冲清爽。",
  "dry-season": "你的场景是换季或干冷期，重点是减少紧绷。",
};

const skinTexts: Record<SkinSignal, string> = {
  dry: "你身体皮肤偏干，优先保留清洁后的舒适度。",
  oily: "你身体皮肤偏油，优先兼顾清爽与冲净速度。",
  sensitive: "你身体皮肤偏敏，优先低刺激路线。",
  stable: "你皮肤状态基本稳定，可按综合信号直接拍板。",
};

const avoidTexts: Record<AvoidSignal, string> = {
  "strong-fragrance": "你明确排除重香路线，所以优先克制气味。",
  "hard-rinse": "你明确排除难冲净路线，所以优先快冲洁净感。",
  "too-strong-clean": "你明确排除强清洁路线，所以避开去脂过猛。",
  "complex-formula": "你明确排除复杂堆料路线，所以优先简单稳定方案。",
};

const notForBySkin: Record<SkinSignal, string> = {
  dry: "如果你只接受极致去油洗感，这个答案不适合你。",
  oily: "如果你追求厚重滋润膜感，这个答案不适合你。",
  sensitive: "如果你当前有明确皮肤炎症，请先优先就医处理。",
  stable: "如果你只追求强功能型清洁刺激感，这个答案不适合你。",
};

const notForByAvoid: Record<AvoidSignal, string> = {
  "strong-fragrance": "如果你希望明显留香型沐浴露，这个答案不适合你。",
  "hard-rinse": "如果你偏好强膜感“包裹”体验，这个答案不适合你。",
  "too-strong-clean": "如果你要强去油力，建议换到更高强度清洁线。",
  "complex-formula": "如果你偏好多重功效叠加路线，这个答案不适合你。",
};

export function normalizeBodyWashSignals(
  raw: Record<string, string | string[] | undefined>,
): BodyWashSignals {
  const value = (k: string) => {
    const v = raw[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const feel = value("feel");
  const scene = value("scene");
  const skin = value("skin");
  const avoid = value("avoid");

  return {
    feel: isFeelSignal(feel) ? feel : undefined,
    scene: isSceneSignal(scene) ? scene : undefined,
    skin: isSkinSignal(skin) ? skin : undefined,
    avoid: isAvoidSignal(avoid) ? avoid : undefined,
  };
}

export function isCompleteBodyWashSignals(s: BodyWashSignals): s is Required<BodyWashSignals> {
  return Boolean(s.feel && s.scene && s.skin && s.avoid);
}

export function toBodyWashSearchParams(s: BodyWashSignals): URLSearchParams {
  const qp = new URLSearchParams();
  if (s.feel) qp.set("feel", s.feel);
  if (s.scene) qp.set("scene", s.scene);
  if (s.skin) qp.set("skin", s.skin);
  if (s.avoid) qp.set("avoid", s.avoid);
  return qp;
}

export function buildBodyWashReasonLines(s: Required<BodyWashSignals>): string[] {
  return [feelTexts[s.feel], sceneTexts[s.scene], skinTexts[s.skin], avoidTexts[s.avoid]];
}

export function buildBodyWashNotForLines(s: Required<BodyWashSignals>): string[] {
  return [notForBySkin[s.skin], notForByAvoid[s.avoid]];
}

export function buildBodyWashWhyNotOthers(s: Required<BodyWashSignals>): string {
  const alt = s.skin === "sensitive" ? "重香重功效路线" : s.feel === "slimy" ? "厚膜感滋润路线" : "强去脂清洁路线";
  return `你的四个信号同时指向“清洁够用 + 肤感可持续 + 决策负担低”，所以我们没有给你 ${alt}，也没有给第二名。`;
}

export function buildBodyWashUsageLine(s: Required<BodyWashSignals>): string {
  if (s.scene === "post-workout") return "运动后一次起泡、重点带过易出汗区域，30 秒内冲净即可。";
  if (s.scene === "quick-morning") return "早晨快冲场景下，按压一次起泡，完成基础清洁后直接冲净。";
  return "保持日常固定用量，别频繁换品，连续 1-2 周最容易看到稳定肤感。";
}

function isFeelSignal(v?: string): v is FeelSignal {
  return v === "dry-tight" || v === "slimy" || v === "itch-red" || v === "odor-fast";
}

function isSceneSignal(v?: string): v is SceneSignal {
  return v === "quick-morning" || v === "night-care" || v === "post-workout" || v === "dry-season";
}

function isSkinSignal(v?: string): v is SkinSignal {
  return v === "dry" || v === "oily" || v === "sensitive" || v === "stable";
}

function isAvoidSignal(v?: string): v is AvoidSignal {
  return v === "strong-fragrance" || v === "hard-rinse" || v === "too-strong-clean" || v === "complex-formula";
}
