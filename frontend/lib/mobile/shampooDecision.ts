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

export function resolveShampooRouteKey(s: ReadyShampooSignals): ShampooRouteKey {
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
