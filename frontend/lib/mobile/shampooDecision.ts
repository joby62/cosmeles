export const SHAMPOO_FEATURED_PRODUCT_ID = "db1422ec-6263-45cc-966e-0ee9292fd8f1";

export type Q1OilSignal = "A" | "B" | "C";
export type Q2ScalpSignal = "A" | "B" | "C";
export type Q3DamageSignal = "A" | "B" | "C";

export type ShampooSignals = {
  q1?: Q1OilSignal;
  q2?: Q2ScalpSignal;
  q3?: Q3DamageSignal;
};

export type ReadyShampooSignals = ShampooSignals & {
  q1: Q1OilSignal;
  q2: Q2ScalpSignal;
  q3?: Q3DamageSignal;
};

export type ShampooRouteKey =
  | "fast-anti-dandruff"
  | "fast-sensitive-soothe"
  | "oil-repair-balance"
  | "oil-lightweight-volume"
  | "oil-control-clean"
  | "balance-repair"
  | "balance-lightweight"
  | "balance-simple"
  | "moisture-repair"
  | "moisture-lightweight"
  | "moisture-gentle";

type RoutePlan = {
  key: ShampooRouteKey;
  title: string;
  base: string;
  addon: string;
  why: string;
  notFor: string[];
  usage: string;
};

const q1Labels: Record<Q1OilSignal, string> = {
  A: "一天不洗就塌/油",
  B: "2-3天洗一次正好",
  C: "3天以上不洗也不油",
};

const q2Labels: Record<Q2ScalpSignal, string> = {
  A: "有头屑且发痒",
  B: "头皮发红/刺痛/长痘",
  C: "无特殊感觉",
};

const q3Labels: Record<Q3DamageSignal, string> = {
  A: "频繁染烫/干枯易断",
  B: "细软塌/贴头皮",
  C: "原生发/健康",
};

const q1BaseLine: Record<Q1OilSignal, string> = {
  A: "你的底色是高出油节奏，先把清洁效率做对位。",
  B: "你的底色是温和平衡节奏，不走强清洁也不走厚重滋润。",
  C: "你的底色是低出油节奏，优先舒适度与保湿稳定。",
};

const q2Line: Record<Q2ScalpSignal, string> = {
  A: "你当前有头屑+发痒，先处理抗真菌去屑，再谈其他功能。",
  B: "你当前有发红/刺痛信号，先回退刺激负担并做舒缓修护。",
  C: "你当前没有明显头皮不适，继续按发质做细分收敛。",
};

const q3AddOnLine: Record<Q3DamageSignal, string> = {
  A: "功能插件走修护路线：提高受损发丝管理能力。",
  B: "功能插件走轻盈路线：避免压塌，保持发根支撑。",
  C: "功能插件走简配路线：减少堆叠，保持长期稳定。",
};

const routePlans: Record<ShampooRouteKey, RoutePlan> = {
  "fast-anti-dandruff": {
    key: "fast-anti-dandruff",
    title: "抗真菌去屑主推型洗发水",
    base: "Base：中高强度清洁底色（不过度拔干）。",
    addon: "Add-on：去屑抗真菌活性优先（快路径）。",
    why: "你触发了“头屑且发痒”直接判定，先把头皮问题压住，效率最高。",
    notFor: [
      "如果你只追求香味或顺滑手感，这条路线不适合。",
      "若头皮炎症持续加重，应优先皮肤科处理。",
    ],
    usage: "先连续使用 2-4 周观察头屑和痒感变化，稳定后再决定是否切换日常线。",
  },
  "fast-sensitive-soothe": {
    key: "fast-sensitive-soothe",
    title: "低刺激舒缓修护型洗发水",
    base: "Base：氨基酸/APG 温和底色，避开 SLS/SLES。",
    addon: "Add-on：舒缓修护插件优先（快路径）。",
    why: "你触发了“发红/刺痛”直接判定，先把刺激源降下来，头皮更容易回稳。",
    notFor: [
      "如果你要强去油冲击感，这条路线不适合。",
      "持续刺痛泛红请先停用并就医。",
    ],
    usage: "先把洗发频次和单次用量固定住，连续 1-2 周优先看舒适度是否回稳。",
  },
  "oil-repair-balance": {
    key: "oil-repair-balance",
    title: "头皮净澈 + 发丝修护组合型",
    base: "Base：高效控油清洁底色。",
    addon: "Add-on：阳离子聚合物修护插件。",
    why: "你是“油性头皮 + 受损发丝”典型组合，必须同时解决头皮与发丝，不做单边取舍。",
    notFor: ["如果你只要极轻薄无感顺滑，这条路线不适合。", "若有明显头皮炎症，先处理头皮问题。"],
    usage: "重点揉洗头皮，泡沫带过发丝，避免发尾反复搓洗。",
  },
  "oil-lightweight-volume": {
    key: "oil-lightweight-volume",
    title: "控油轻盈蓬松型",
    base: "Base：控油清洁底色。",
    addon: "Add-on：轻盈无硅或低负担蓬松插件。",
    why: "你的目标是抑油同时避免贴头皮，关键是轻盈蓬松，而不是厚重顺滑。",
    notFor: ["如果你偏好重度滋润膜感，这条路线不适合。", "重度受损发丝需额外修护步骤。"],
    usage: "洗后重点吹起发根，护发产品避免碰头皮。",
  },
  "oil-control-clean": {
    key: "oil-control-clean",
    title: "高效控油简配型",
    base: "Base：中高强度控油底色。",
    addon: "Add-on：简化成分插件。",
    why: "你更需要稳定控油和清爽感，优先可持续执行，而不是功能堆叠。",
    notFor: ["如果你主要困扰是严重干枯受损，这条路线不适合。", "偏敏头皮要关注刺激反应。"],
    usage: "按固定频次使用，避免一天多次强洗。",
  },
  "balance-repair": {
    key: "balance-repair",
    title: "温和平衡修护型",
    base: "Base：温和平衡底色。",
    addon: "Add-on：修护插件优先。",
    why: "你出油节奏中等，但发丝受损明显，温和与修护并行是更稳解法。",
    notFor: ["如果你要极强去油力，这条路线不适合。", "极重度受损建议叠加发膜护理。"],
    usage: "发尾停留时间略长于头皮区域，冲净后再决定是否叠加护发素。",
  },
  "balance-lightweight": {
    key: "balance-lightweight",
    title: "温和平衡轻盈型",
    base: "Base：温和平衡底色。",
    addon: "Add-on：轻盈蓬松插件。",
    why: "你不需要极端清洁，也不适合厚重配方，轻盈平衡更稳。",
    notFor: ["如果你追求明显厚重顺滑感，这条路线不适合。", "明显头屑痒需切换去屑线。"],
    usage: "单次正常用量即可，重点保持稳定频次。",
  },
  "balance-simple": {
    key: "balance-simple",
    title: "温和平衡简配型",
    base: "Base：温和平衡底色。",
    addon: "Add-on：简化功能插件。",
    why: "你更适合低波动日常方案，减少复杂变量更容易长期稳定。",
    notFor: ["如果你要强功能见效路线，这个方案不适合。", "出现敏感反应时应回退温和线。"],
    usage: "把产品固定 2 周再判断，不要频繁横跳更换。",
  },
  "moisture-repair": {
    key: "moisture-repair",
    title: "滋润修护型",
    base: "Base：滋润补水底色。",
    addon: "Add-on：修护插件优先。",
    why: "你本身不油且发丝受损，优先保湿修护比控油更重要。",
    notFor: ["如果你头皮很快出油，这条路线不适合。", "若贴头皮明显，需减少用量。"],
    usage: "重点照顾发中到发尾，头皮区域用量控制。",
  },
  "moisture-lightweight": {
    key: "moisture-lightweight",
    title: "滋润轻盈型",
    base: "Base：柔和滋润底色。",
    addon: "Add-on：轻盈插件防止压塌。",
    why: "你需要滋润但不想塌，关键是保湿与轻盈同时达成。",
    notFor: ["如果你追求强控油，这条路线不适合。", "严重干枯仍需额外修护。"],
    usage: "少量多次比一次大量更稳。",
  },
  "moisture-gentle": {
    key: "moisture-gentle",
    title: "滋润温和简配型",
    base: "Base：低刺激滋润底色。",
    addon: "Add-on：简配维持插件。",
    why: "你没有明显头皮问题，重点是温和舒适与长期稳定。",
    notFor: ["如果你要强去油或强去屑，这条路线不适合。", "出现头皮异常时要重新判断。"],
    usage: "按舒适频次使用即可，优先稳定，不追求刺激感。",
  },
};

export function normalizeShampooSignals(raw: Record<string, string | string[] | undefined>): ShampooSignals {
  const value = (k: string) => {
    const v = raw[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const q1 = value("q1");
  const q2 = value("q2");
  const q3 = value("q3");

  return {
    q1: isABC(q1) ? q1 : undefined,
    q2: isABC(q2) ? q2 : undefined,
    q3: isABC(q3) ? q3 : undefined,
  };
}

export function isShampooFastPath(s: ShampooSignals): boolean {
  return s.q2 === "A" || s.q2 === "B";
}

export function isReadyShampooResult(s: ShampooSignals): s is ReadyShampooSignals {
  if (!s.q1 || !s.q2) return false;
  if (isShampooFastPath(s)) return true;
  return Boolean(s.q3);
}

export function toSignalSearchParams(s: ShampooSignals): URLSearchParams {
  const qp = new URLSearchParams();
  if (s.q1) qp.set("q1", s.q1);
  if (s.q2) qp.set("q2", s.q2);
  if (s.q3) qp.set("q3", s.q3);
  return qp;
}

export function shampooChoiceLabel(key: "q1" | "q2" | "q3", value: "A" | "B" | "C"): string {
  if (key === "q1") return q1Labels[value];
  if (key === "q2") return q2Labels[value];
  return q3Labels[value];
}

export function buildShampooTraceLines(s: ReadyShampooSignals): string[] {
  const lines = [`Q1 ${s.q1} · ${q1Labels[s.q1]}`, `Q2 ${s.q2} · ${q2Labels[s.q2]}`];
  if (s.q3) lines.push(`Q3 ${s.q3} · ${q3Labels[s.q3]}`);
  return lines;
}

export function buildShampooReasonLines(s: ReadyShampooSignals): string[] {
  const lines = [q1BaseLine[s.q1], q2Line[s.q2]];
  if (s.q3) lines.push(q3AddOnLine[s.q3]);
  const plan = resolveShampooPlan(s);
  lines.push(`${plan.base} ${plan.addon}`);
  return lines;
}

export function buildShampooNotForLines(s: ReadyShampooSignals): string[] {
  return resolveShampooPlan(s).notFor;
}

export function buildShampooWhyNotOthers(s: ReadyShampooSignals): string {
  return resolveShampooPlan(s).why;
}

export function buildShampooUsageLine(s: ReadyShampooSignals): string {
  return resolveShampooPlan(s).usage;
}

export function buildShampooResultTitle(s: ReadyShampooSignals): string {
  return resolveShampooPlan(s).title;
}

export function resolveShampooPlan(s: ReadyShampooSignals): RoutePlan {
  const route = resolveRouteKey(s);
  return routePlans[route];
}

function resolveRouteKey(s: ReadyShampooSignals): ShampooRouteKey {
  if (s.q2 === "A") return "fast-anti-dandruff";
  if (s.q2 === "B") return "fast-sensitive-soothe";

  const q3 = s.q3 || "C";

  if (s.q1 === "A" && q3 === "A") return "oil-repair-balance";
  if (s.q1 === "A" && q3 === "B") return "oil-lightweight-volume";
  if (s.q1 === "A" && q3 === "C") return "oil-control-clean";

  if (s.q1 === "B" && q3 === "A") return "balance-repair";
  if (s.q1 === "B" && q3 === "B") return "balance-lightweight";
  if (s.q1 === "B" && q3 === "C") return "balance-simple";

  if (s.q1 === "C" && q3 === "A") return "moisture-repair";
  if (s.q1 === "C" && q3 === "B") return "moisture-lightweight";
  return "moisture-gentle";
}

function isABC(v?: string): v is "A" | "B" | "C" {
  return v === "A" || v === "B" || v === "C";
}
