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

export type ShampooBundleKey =
  | "deep-oil-control"
  | "anti-dandruff-itch"
  | "gentle-soothing"
  | "deep-repair"
  | "volume-support";

export type CoreIngredient = {
  name: string;
  mechanism: string;
};

export type ShampooBundle = {
  key: ShampooBundleKey;
  title: string;
  shortLabel: string;
  fitRule: string;
  whyRecommend: string;
  whyNotOthers: string;
  notFor: string[];
  usage: string;
  coreIngredients: CoreIngredient[];
};

type RouteDecision = {
  bundleKey: ShampooBundleKey;
  baseFilter: string;
  painFilter: string;
  bonusFilter?: string;
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

const bundleMap: Record<ShampooBundleKey, ShampooBundle> = {
  "deep-oil-control": {
    key: "deep-oil-control",
    title: "深层控油型：给头皮的“吸油面纸”",
    shortLabel: "深层控油型",
    fitRule: "适用：油头 + 无明显受损（A-C-C），或高出油优先控制油脂环境的人群。",
    whyRecommend:
      "针对油脂分泌过旺导致的溢脂性环境。这一型通过更强的清洁底色带走顽固油脂，再用锌盐和水杨酸压低皮脂活跃度，延长头发的蓬松寿命。",
    whyNotOthers:
      "滋润型或纯温和型洗剂对重油头往往是“隔靴搔痒”，洗完短时间内仍会有油垢感，甚至可能放大头皮异味问题。",
    notFor: [
      "干性头皮：可能出现起皮、紧绷。",
      "严重受损发质：发丝可能更干涩，需做分区洗。",
      "头皮湿疹/破损期：强清洁会加重刺激。",
    ],
    usage:
      "采用“双重洗发液法”：第一次带走表层油脂，第二次停留约 1 分钟让控油成分接触头皮，发尾务必配合护发素。",
    coreIngredients: [
      {
        name: "PCA 锌 / 葡萄糖酸锌",
        mechanism: "控油核心，抑制 5α-还原酶，降低油脂生成指令。",
      },
      {
        name: "C14-16 烯烃磺酸钠 / 月桂酰肌氨酸钠",
        mechanism: "高效去油洗剂，顽固油脂清除更彻底。",
      },
      {
        name: "水杨酸",
        mechanism: "疏通毛囊口老废角质，减少油脂栓和头皮痘风险。",
      },
    ],
  },
  "anti-dandruff-itch": {
    key: "anti-dandruff-itch",
    title: "去屑止痒型：针对真菌的“特种部队”",
    shortLabel: "去屑止痒型",
    fitRule: "适用：有屑且痒（-A-），无论油性或干性。",
    whyRecommend:
      "大多数头屑都与马拉色菌失衡相关。这一型会优先上抗真菌活性，从源头抑制真菌，而不是只做“把白屑洗掉”的表面清洁。",
    whyNotOthers:
      "普通洗发水只能暂时冲掉可见皮屑，真菌负荷不下降的话，24 小时内往往会反复。",
    notFor: [
      "无头屑人群：长期高频使用可能打乱头皮菌群。",
      "头皮有开放性伤口：应先处理伤口和炎症。",
    ],
    usage:
      "关键是接触时间：在头皮停留 3-5 分钟再冲洗，抗真菌成分才有发挥空间。",
    coreIngredients: [
      {
        name: "吡罗克酮乙醇胺盐（OCT）",
        mechanism: "广谱抗真菌，抑制头屑相关真菌生长。",
      },
      {
        name: "吡硫鎓锌（ZPT）",
        mechanism: "干扰真菌细胞膜运输，降低真菌存活率。",
      },
      {
        name: "水杨酸 / 薄荷醇",
        mechanism: "前者软化角质屑，后者提供快速止痒体感。",
      },
    ],
  },
  "gentle-soothing": {
    key: "gentle-soothing",
    title: "温和舒缓型：头皮的“维稳屏障”",
    shortLabel: "温和舒缓型",
    fitRule: "适用：敏感头皮（-B-）或想长期维持低刺激清洁的人群。",
    whyRecommend:
      "当头皮已经发红、刺痛或频繁不适时，第一目标不是“洗得更猛”，而是恢复屏障耐受。这一型会优先低刺激表活并叠加抗炎舒缓成分。",
    whyNotOthers:
      "控油或去屑强功效线通常带来更高刺激阈值，可能继续拉扯已经脆弱的头皮屏障。",
    notFor: [
      "重油发质：可能觉得不够“干净到位”。",
      "长期大量造型品人群：清洁力可能不足以彻底卸残留。",
    ],
    usage:
      "用 37°C 左右温水，按摩动作放轻，先把头皮舒适度稳定下来，再考虑进阶功能。",
    coreIngredients: [
      {
        name: "APG / 氨基酸表活",
        mechanism: "低刺激清洁，尽量不破坏头皮天然皮脂膜。",
      },
      {
        name: "红没药醇 / 积雪草提取物",
        mechanism: "缓和炎症反应，减轻泛红和刺痛感。",
      },
      {
        name: "泛醇（Pro-V B5）/ 神经酰胺",
        mechanism: "补水并辅助屏障修护，减少干燥性瘙痒反复。",
      },
    ],
  },
  "deep-repair": {
    key: "deep-repair",
    title: "深度修护型：发丝的“水泥填补剂”",
    shortLabel: "深度修护型",
    fitRule: "适用：干性/受损发丝（B/C-C-A），或油头+受损的分区护理人群。",
    whyRecommend:
      "染烫受损本质是毛鳞片结构损伤，这一型会优先补蛋白与脂质，封堵裂隙并降低断裂风险。若你是油头+受损，会采用“头皮清洁 + 发丝修护”并行策略。",
    whyNotOthers:
      "清爽控油型为了蓬松常会提高去脂力度，对受损发丝不友好，可能放大干枯和断裂。",
    notFor: [
      "细软塌发质：可能出现贴头皮或厚重感。",
      "油性头皮且涂到头皮：可能加重毛囊负担。",
    ],
    usage:
      "重点涂发中到发尾；若“头皮油+发尾干”，建议分区洗：头皮控油款，发丝修护款。",
    coreIngredients: [
      {
        name: "水解角蛋白 / 蚕丝蛋白",
        mechanism: "填补发丝蛋白缺口，提升韧性。",
      },
      {
        name: "18-MEA / 植物油脂",
        mechanism: "重建疏水层，恢复光泽和润滑。",
      },
      {
        name: "聚季铵盐-10 / 适量硅油",
        mechanism: "中和负电荷、降低静电与打结。",
      },
    ],
  },
  "volume-support": {
    key: "volume-support",
    title: "蓬松支撑型：发根的“骨骼支架”",
    shortLabel: "蓬松支撑型",
    fitRule: "适用：细软塌、视觉发量少（A/B-C-B）。",
    whyRecommend:
      "这一型目标是“减负 + 增硬”：降低沉积负担，同时让单根发丝支撑力提升，帮助发根更容易立起来。",
    whyNotOthers:
      "高硅油或重滋润路线会增加发丝重量，细软发更容易贴头皮，蓬松感掉得更快。",
    notFor: [
      "粗硬自然卷/沙发发质：可能出现更炸、更难打理。",
      "重度干枯受损：单靠蓬松线不够，需要修护线配合。",
    ],
    usage:
      "彻底冲净后逆着发根吹风，配合高分子支撑成分，蓬松持续时间会更稳定。",
    coreIngredients: [
      {
        name: "咖啡因",
        mechanism: "促进头皮微循环，帮助毛囊维持生长期。",
      },
      {
        name: "水解小麦蛋白",
        mechanism: "吸附发丝表面增加单根支撑度。",
      },
      {
        name: "海盐 / 膨胀因子 + 无硅油体系",
        mechanism: "拉开发丝间隙并减少重量负担，形成视觉发量感。",
      },
    ],
  },
};

const routeDecisions: Record<ShampooRouteKey, RouteDecision> = {
  "fast-anti-dandruff": {
    bundleKey: "anti-dandruff-itch",
    baseFilter: "Q1 底色保留当前清洁强度，优先保证抗真菌活性发挥。",
    painFilter: "Q2 触发“有屑且痒”快路径，直接进入去屑止痒线。",
    bonusFilter: "快路径已完成，不再继续 Q3。",
  },
  "fast-sensitive-soothe": {
    bundleKey: "gentle-soothing",
    baseFilter: "Q1 底色回退到低刺激清洁框架。",
    painFilter: "Q2 触发“发红/刺痛”快路径，优先舒缓与屏障修护。",
    bonusFilter: "快路径已完成，不再继续 Q3。",
  },
  "oil-repair-balance": {
    bundleKey: "deep-repair",
    baseFilter: "Q1=油性，清洁底色仍要保持对头皮油脂的控制。",
    painFilter: "Q2 无特殊不适，继续以发丝状态做细化。",
    bonusFilter: "Q3=受损，添加修护插件并建议分区洗。",
  },
  "oil-lightweight-volume": {
    bundleKey: "volume-support",
    baseFilter: "Q1=油性，保持清爽底色。",
    painFilter: "Q2 无特殊不适，进入发质插件阶段。",
    bonusFilter: "Q3=细软塌，锁定蓬松支撑插件。",
  },
  "oil-control-clean": {
    bundleKey: "deep-oil-control",
    baseFilter: "Q1=油性，底色走高效控油清洁。",
    painFilter: "Q2 无特殊不适，不需要药理去屑或舒缓优先。",
    bonusFilter: "Q3=健康发丝，以控油稳定为主。",
  },
  "balance-repair": {
    bundleKey: "deep-repair",
    baseFilter: "Q1=平衡节奏，底色保持温和。",
    painFilter: "Q2 无特殊不适，继续按发丝状态分流。",
    bonusFilter: "Q3=受损，进入深度修护线。",
  },
  "balance-lightweight": {
    bundleKey: "volume-support",
    baseFilter: "Q1=平衡节奏，清洁不过度。",
    painFilter: "Q2 无特殊不适，继续按发质定位。",
    bonusFilter: "Q3=细软塌，进入蓬松支撑线。",
  },
  "balance-simple": {
    bundleKey: "gentle-soothing",
    baseFilter: "Q1=平衡节奏，优先稳定可持续。",
    painFilter: "Q2 无头皮困扰，无需功效线加码。",
    bonusFilter: "Q3=健康发丝，收敛到温和维稳线。",
  },
  "moisture-repair": {
    bundleKey: "deep-repair",
    baseFilter: "Q1=低出油，底色以滋润舒适为主。",
    painFilter: "Q2 无头皮困扰，继续按发丝状态判断。",
    bonusFilter: "Q3=受损，锁定修护与补脂。",
  },
  "moisture-lightweight": {
    bundleKey: "volume-support",
    baseFilter: "Q1=低出油，仍需避免发根负担过重。",
    painFilter: "Q2 无特殊不适，进入发质插件阶段。",
    bonusFilter: "Q3=细软塌，优先轻盈与支撑。",
  },
  "moisture-gentle": {
    bundleKey: "gentle-soothing",
    baseFilter: "Q1=低出油，底色优先温和舒适。",
    painFilter: "Q2 无明显困扰，维持低刺激框架。",
    bonusFilter: "Q3=健康发丝，避免功能堆叠。",
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
  const decision = resolveRouteDecision(s);
  const lines = [
    `第一级过滤（底色）：${decision.baseFilter}`,
    `第二级过滤（核心痛点）：${decision.painFilter}`,
  ];
  if (decision.bonusFilter) {
    lines.push(`第三级过滤（加分项）：${decision.bonusFilter}`);
  }
  return lines;
}

export function buildShampooWhyRecommend(s: ReadyShampooSignals): string {
  return resolveShampooBundle(s).whyRecommend;
}

export function buildShampooNotForLines(s: ReadyShampooSignals): string[] {
  return resolveShampooBundle(s).notFor;
}

export function buildShampooWhyNotOthers(s: ReadyShampooSignals): string {
  return resolveShampooBundle(s).whyNotOthers;
}

export function buildShampooUsageLine(s: ReadyShampooSignals): string {
  return resolveShampooBundle(s).usage;
}

export function buildShampooResultTitle(s: ReadyShampooSignals): string {
  return resolveShampooBundle(s).title;
}

export function buildShampooFitRule(s: ReadyShampooSignals): string {
  return resolveShampooBundle(s).fitRule;
}

export function buildShampooCoreIngredients(s: ReadyShampooSignals): CoreIngredient[] {
  return resolveShampooBundle(s).coreIngredients;
}

export function buildShampooWikiDeepHref(s: ReadyShampooSignals): string {
  return `/m/wiki/shampoo?focus=${resolveShampooBundle(s).key}`;
}

export function resolveShampooBundle(s: ReadyShampooSignals): ShampooBundle {
  const route = resolveRouteKey(s);
  const decision = routeDecisions[route];
  return bundleMap[decision.bundleKey];
}

function resolveRouteDecision(s: ReadyShampooSignals): RouteDecision {
  const route = resolveRouteKey(s);
  return routeDecisions[route];
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
