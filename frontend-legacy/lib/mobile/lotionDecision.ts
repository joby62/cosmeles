export type Q1Signal = "A" | "B" | "C" | "D";
export type Q2Signal = "A" | "B";
export type Q3Signal = "A" | "B" | "C" | "D" | "E";
export type Q4Signal = "A" | "B" | "C";
export type Q5Signal = "A" | "B" | "C";

export type LotionSignals = {
  q1?: Q1Signal;
  q2?: Q2Signal;
  q3?: Q3Signal;
  q4?: Q4Signal;
  q5?: Q5Signal;
};

const q1Labels: Record<Q1Signal, string> = {
  A: "干燥寒冷 / 长时间待在暖气房",
  B: "炎热潮湿 / 夏季易出汗环境",
  C: "换季温差大 / 经常刮风",
  D: "气候温和 / 室内温湿度适宜",
};

const q2Labels: Record<Q2Signal, string> = {
  A: "极度敏感（易泛红、动不动就干痒、有湿疹/荨麻疹病史）",
  B: "屏障健康（耐受力强，用猛药极少翻车）",
};

const q3Labels: Record<Q3Signal, string> = {
  A: "极度干屑（小腿有蛇皮纹、脱屑、干到紧绷瘙痒）",
  B: "躯干痘痘（前胸后背出油多，常起红肿痘或粉刺）",
  C: "粗糙颗粒（大腿/手臂有鸡皮肤、毛孔粗糙、手肘脚踝角质厚）",
  D: "暗沉色差（关节发黑、有晒痕、全身肤色不均）",
  E: "状态正常（无明显痛点，只需日常维稳与保养）",
};

const q4Labels: Record<Q4Signal, string> = {
  A: "秒吸收的轻薄水感（最怕粘腻沾睡衣，哪怕需要频繁补涂也只选清爽的）",
  B: "适中滋润的丝滑乳液感（平衡型，好推开且有一定保湿续航）",
  C: "强包裹的丰润油膏感（必须有厚重的膜感，不然总觉得没涂够）",
};

const q5Labels: Record<Q5Signal, string> = {
  A: "极致纯净（孕妇/哺乳期可用，或极度排斥香精、色素、防腐剂）",
  B: "情绪留香（看重身体乳的调香，希望带香入睡或伪体香）",
  C: "无特殊限制（更看重实际功效，对香气和纯净度无执念）",
};

export function normalizeLotionSignals(raw: Record<string, string | string[] | undefined>): LotionSignals {
  const value = (k: string) => {
    const v = raw[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const q1 = value("q1");
  const q2 = value("q2");
  const q3 = value("q3");
  const q4 = value("q4");
  const q5 = value("q5");

  return {
    q1: isQ1(q1) ? q1 : undefined,
    q2: isQ2(q2) ? q2 : undefined,
    q3: isQ3(q3) ? q3 : undefined,
    q4: isQ4(q4) ? q4 : undefined,
    q5: isQ5(q5) ? q5 : undefined,
  };
}

export function isCompleteLotionSignals(s: LotionSignals): s is Required<LotionSignals> {
  return Boolean(s.q1 && s.q2 && s.q3 && s.q4 && s.q5);
}

export function toLotionSearchParams(s: LotionSignals): URLSearchParams {
  const qp = new URLSearchParams();
  if (s.q1) qp.set("q1", s.q1);
  if (s.q2) qp.set("q2", s.q2);
  if (s.q3) qp.set("q3", s.q3);
  if (s.q4) qp.set("q4", s.q4);
  if (s.q5) qp.set("q5", s.q5);
  return qp;
}

export function lotionChoiceLabel(
  key: "q1" | "q2" | "q3" | "q4" | "q5",
  value: "A" | "B" | "C" | "D" | "E",
): string {
  if (key === "q1") return q1Labels[value as Q1Signal];
  if (key === "q2") return q2Labels[value as Q2Signal];
  if (key === "q3") return q3Labels[value as Q3Signal];
  if (key === "q4") return q4Labels[value as Q4Signal];
  return q5Labels[value as Q5Signal];
}

function isQ1(v?: string): v is Q1Signal {
  return v === "A" || v === "B" || v === "C" || v === "D";
}

function isQ2(v?: string): v is Q2Signal {
  return v === "A" || v === "B";
}

function isQ3(v?: string): v is Q3Signal {
  return v === "A" || v === "B" || v === "C" || v === "D" || v === "E";
}

function isQ4(v?: string): v is Q4Signal {
  return v === "A" || v === "B" || v === "C";
}

function isQ5(v?: string): v is Q5Signal {
  return v === "A" || v === "B" || v === "C";
}
