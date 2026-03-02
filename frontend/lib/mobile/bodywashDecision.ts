export type Q1EnvSignal = "A" | "B" | "C" | "D";
export type Q2ToleranceSignal = "A" | "B";
export type Q3SkinSignal = "A" | "B" | "C" | "D";
export type Q4FinishSignal = "A" | "B";
export type Q5SpecialSignal = "A" | "B";

export type BodyWashSignals = {
  q1?: Q1EnvSignal;
  q2?: Q2ToleranceSignal;
  q3?: Q3SkinSignal;
  q4?: Q4FinishSignal;
  q5?: Q5SpecialSignal;
};

export type ReadyBodyWashSignals = BodyWashSignals & {
  q1: Q1EnvSignal;
  q2: Q2ToleranceSignal;
  q3?: Q3SkinSignal;
  q4?: Q4FinishSignal;
  q5?: Q5SpecialSignal;
};

export type BodyWashRouteKey = "rescue" | "purge" | "polish" | "glow" | "shield" | "vibe";

const q1Labels: Record<Q1EnvSignal, string> = {
  A: "干燥寒冷",
  B: "干燥炎热",
  C: "潮湿闷热",
  D: "潮湿寒冷",
};

const q2Labels: Record<Q2ToleranceSignal, string> = {
  A: "极度敏感",
  B: "屏障健康",
};

const q3Labels: Record<Q3SkinSignal, string> = {
  A: "出油旺盛",
  B: "缺油干涩",
  C: "角质堆积（鸡皮/厚茧）",
  D: "状态正常（无明显痛点）",
};

const q4Labels: Record<Q4FinishSignal, string> = {
  A: "清爽干脆",
  B: "柔滑滋润",
};

const q5Labels: Record<Q5SpecialSignal, string> = {
  A: "极致纯净",
  B: "情绪留香",
};

export function normalizeBodyWashSignals(raw: Record<string, string | string[] | undefined>): BodyWashSignals {
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

export function isBodyWashFastPath(s: BodyWashSignals): boolean {
  return s.q2 === "A";
}

export function isReadyBodyWashResult(s: BodyWashSignals): s is ReadyBodyWashSignals {
  if (!s.q1 || !s.q2) return false;
  if (s.q2 === "A") return true;
  return Boolean(s.q3 && s.q4 && s.q5);
}

export function toBodyWashSearchParams(s: BodyWashSignals): URLSearchParams {
  const qp = new URLSearchParams();
  if (s.q1) qp.set("q1", s.q1);
  if (s.q2) qp.set("q2", s.q2);
  if (s.q3) qp.set("q3", s.q3);
  if (s.q4) qp.set("q4", s.q4);
  if (s.q5) qp.set("q5", s.q5);
  return qp;
}

export function bodyWashChoiceLabel(
  key: "q1" | "q2" | "q3" | "q4" | "q5",
  value: "A" | "B" | "C" | "D",
): string {
  if (key === "q1") return q1Labels[value as Q1EnvSignal];
  if (key === "q2") return q2Labels[value as Q2ToleranceSignal];
  if (key === "q3") return q3Labels[value as Q3SkinSignal];
  if (key === "q4") return q4Labels[value as Q4FinishSignal];
  return q5Labels[value as Q5SpecialSignal];
}

export function resolveBodyWashRouteKey(s: ReadyBodyWashSignals): BodyWashRouteKey {
  if (s.q2 === "A" || s.q5 === "A") return "rescue";

  if (s.q3 === "C") return "polish";
  if (s.q3 === "A") return "purge";

  if (s.q3 === "B") return "shield";
  if (s.q1 === "A") return "shield";
  if (s.q1 === "D" && s.q4 === "B") return "shield";

  if ((s.q1 === "B" || s.q1 === "C") && s.q3 === "D" && s.q2 === "B") return "glow";

  return "vibe";
}

function isQ1(v?: string): v is Q1EnvSignal {
  return v === "A" || v === "B" || v === "C" || v === "D";
}

function isQ2(v?: string): v is Q2ToleranceSignal {
  return v === "A" || v === "B";
}

function isQ3(v?: string): v is Q3SkinSignal {
  return v === "A" || v === "B" || v === "C" || v === "D";
}

function isQ4(v?: string): v is Q4FinishSignal {
  return v === "A" || v === "B";
}

function isQ5(v?: string): v is Q5SpecialSignal {
  return v === "A" || v === "B";
}
