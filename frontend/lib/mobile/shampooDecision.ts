import { getShampooChoiceLabel, type ShampooStepKey } from "@/domain/mobile/decision/shampoo";

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

export function shampooChoiceLabel(key: ShampooStepKey, value: "A" | "B" | "C" | "D"): string {
  return getShampooChoiceLabel(key, value) || value;
}

function isABC(v?: string): v is "A" | "B" | "C" {
  return v === "A" || v === "B" || v === "C";
}

function isABCD(v?: string): v is "A" | "B" | "C" | "D" {
  return v === "A" || v === "B" || v === "C" || v === "D";
}
