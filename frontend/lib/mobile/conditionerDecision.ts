export type TargetSignal = "tangle" | "frizz" | "dry-ends" | "flat-roots";
export type HairSignal = "short" | "mid-long" | "long-damaged" | "fine-flat";
export type UseSignal = "tips-quick" | "hold-1-3" | "more-for-smooth" | "touch-scalp";
export type AvoidSignal = "still-rough" | "next-day-flat" | "strong-fragrance" | "residue-film";

export type ConditionerSignals = {
  target?: TargetSignal;
  hair?: HairSignal;
  use?: UseSignal;
  avoid?: AvoidSignal;
};

const targetTexts: Record<TargetSignal, string> = {
  tangle: "你最想解决的是打结难梳，重点是梳理顺滑感。",
  frizz: "你最想解决的是毛躁炸开，重点是控躁与服帖。",
  "dry-ends": "你最想解决的是发尾干硬分叉，重点是尾段修护感。",
  "flat-roots": "你最想解决的是贴头皮扁塌，重点是轻盈不压塌。",
};

const hairTexts: Record<HairSignal, string> = {
  short: "你是短到中短发，优先轻量、快用快冲。",
  "mid-long": "你是中长发，优先顺滑与可持续手感。",
  "long-damaged": "你是长发或烫染受损，优先修护与控躁平衡。",
  "fine-flat": "你是细软易塌发质，优先轻盈不厚重。",
};

const useTexts: Record<UseSignal, string> = {
  "tips-quick": "你习惯只抹发尾快冲，重点是短停留也有效。",
  "hold-1-3": "你能停留 1-3 分钟，重点是稳定释放顺滑效果。",
  "more-for-smooth": "你用量偏多追求更顺，重点是避免堆积厚膜。",
  "touch-scalp": "你容易碰到头皮，重点是降低厚重残留感。",
};

const avoidTexts: Record<AvoidSignal, string> = {
  "still-rough": "你不能接受冲完仍发涩，所以优先真实顺滑感。",
  "next-day-flat": "你不能接受第二天就塌，所以优先轻盈路线。",
  "strong-fragrance": "你不能接受重香，所以优先克制气味。",
  "residue-film": "你不能接受残留膜感，所以优先冲净与轻负担。",
};

const notForByHair: Record<HairSignal, string> = {
  short: "如果你追求重度发膜级修护感，这个答案不适合你。",
  "mid-long": "如果你要极端轻薄到几乎无感，这个答案不适合你。",
  "long-damaged": "如果你是重度受损到需高强度护理，这个答案不适合你。",
  "fine-flat": "如果你只要厚重油润包裹感，这个答案不适合你。",
};

const notForByAvoid: Record<AvoidSignal, string> = {
  "still-rough": "如果你只靠一次就期待发质级改变，这个答案不适合你。",
  "next-day-flat": "如果你接受塌感来换取极厚重顺滑，这个答案不适合你。",
  "strong-fragrance": "如果你偏爱明显留香路线，这个答案不适合你。",
  "residue-film": "如果你偏好强膜感包裹体验，这个答案不适合你。",
};

export function normalizeConditionerSignals(
  raw: Record<string, string | string[] | undefined>,
): ConditionerSignals {
  const value = (k: string) => {
    const v = raw[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const target = value("target");
  const hair = value("hair");
  const use = value("use");
  const avoid = value("avoid");

  return {
    target: isTargetSignal(target) ? target : undefined,
    hair: isHairSignal(hair) ? hair : undefined,
    use: isUseSignal(use) ? use : undefined,
    avoid: isAvoidSignal(avoid) ? avoid : undefined,
  };
}

export function isCompleteConditionerSignals(
  s: ConditionerSignals,
): s is Required<ConditionerSignals> {
  return Boolean(s.target && s.hair && s.use && s.avoid);
}

export function toConditionerSearchParams(s: ConditionerSignals): URLSearchParams {
  const qp = new URLSearchParams();
  if (s.target) qp.set("target", s.target);
  if (s.hair) qp.set("hair", s.hair);
  if (s.use) qp.set("use", s.use);
  if (s.avoid) qp.set("avoid", s.avoid);
  return qp;
}

export function buildConditionerReasonLines(s: Required<ConditionerSignals>): string[] {
  return [targetTexts[s.target], hairTexts[s.hair], useTexts[s.use], avoidTexts[s.avoid]];
}

export function buildConditionerNotForLines(s: Required<ConditionerSignals>): string[] {
  return [notForByHair[s.hair], notForByAvoid[s.avoid]];
}

export function buildConditionerWhyNotOthers(s: Required<ConditionerSignals>): string {
  const alt = s.hair === "fine-flat" ? "厚重修护路线" : s.target === "frizz" ? "极轻薄快冲路线" : "强香强膜感路线";
  return `你的四个信号共同指向“顺滑有效 + 不压塌 + 可持续使用”，所以我们没有给你 ${alt}，也没有给第二名。`;
}

export function buildConditionerUsageLine(s: Required<ConditionerSignals>): string {
  if (s.use === "tips-quick") return "每次只抹发中到发尾，停留 30-60 秒后冲净，避免碰到头皮。";
  if (s.use === "hold-1-3") return "保持 1-3 分钟停留更稳，冲净到无滑膜感即可。";
  return "用量从少到多试，不够再加，先保证冲净与轻盈，再追求更顺。";
}

function isTargetSignal(v?: string): v is TargetSignal {
  return v === "tangle" || v === "frizz" || v === "dry-ends" || v === "flat-roots";
}

function isHairSignal(v?: string): v is HairSignal {
  return v === "short" || v === "mid-long" || v === "long-damaged" || v === "fine-flat";
}

function isUseSignal(v?: string): v is UseSignal {
  return v === "tips-quick" || v === "hold-1-3" || v === "more-for-smooth" || v === "touch-scalp";
}

function isAvoidSignal(v?: string): v is AvoidSignal {
  return v === "still-rough" || v === "next-day-flat" || v === "strong-fragrance" || v === "residue-film";
}
