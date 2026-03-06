export type Q1OilSignal = "A" | "B" | "C";
export type Q2ScalpSignal = "A" | "B" | "C" | "D";
export type Q3DamageSignal = "A" | "B" | "C";

export type ShampooSignals = {
  q1?: Q1OilSignal;
  q2?: Q2ScalpSignal;
  q3?: Q3DamageSignal;
};

export type ReadyShampooSignals = ShampooSignals & {
  q1: Q1OilSignal;
  q2: Q2ScalpSignal;
  q3: Q3DamageSignal;
};

const q1Labels: Record<Q1OilSignal, string> = {
  A: "一天不洗就塌/油",
  B: "2-3天洗一次正好",
  C: "3天以上不洗也不油",
};

const q2Labels: Record<Q2ScalpSignal, string> = {
  A: "有头屑且发痒",
  B: "头皮发红/刺痛/长痘",
  C: "掉发明显/发根脆弱",
  D: "无特殊感觉",
};

const q3Labels: Record<Q3DamageSignal, string> = {
  A: "频繁染烫/干枯易断",
  B: "细软塌/贴头皮",
  C: "原生发/健康",
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
    q2: isABCD(q2) ? q2 : undefined,
    q3: isABC(q3) ? q3 : undefined,
  };
}

export function isReadyShampooResult(s: ShampooSignals): s is ReadyShampooSignals {
  return Boolean(s.q1 && s.q2 && s.q3);
}

export function toSignalSearchParams(s: ShampooSignals): URLSearchParams {
  const qp = new URLSearchParams();
  if (s.q1) qp.set("q1", s.q1);
  if (s.q2) qp.set("q2", s.q2);
  if (s.q3) qp.set("q3", s.q3);
  return qp;
}

export function shampooChoiceLabel(key: "q1" | "q2" | "q3", value: "A" | "B" | "C" | "D"): string {
  if (key === "q1" && isABC(value)) return q1Labels[value];
  if (key === "q2" && isABCD(value)) return q2Labels[value];
  if (key === "q3" && isABC(value)) return q3Labels[value];
  return value;
}

function isABC(v?: string): v is "A" | "B" | "C" {
  return v === "A" || v === "B" || v === "C";
}

function isABCD(v?: string): v is "A" | "B" | "C" | "D" {
  return v === "A" || v === "B" || v === "C" || v === "D";
}
