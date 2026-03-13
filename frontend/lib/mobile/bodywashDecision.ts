import { getBodyWashChoiceLabel } from "@/domain/mobile/decision/bodywash";

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
  q3: Q3SkinSignal;
  q4: Q4FinishSignal;
  q5: Q5SpecialSignal;
};

export type BodyWashRouteKey = "rescue" | "purge" | "polish" | "glow" | "shield" | "vibe";

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

export function isReadyBodyWashResult(s: BodyWashSignals): s is ReadyBodyWashSignals {
  return Boolean(s.q1 && s.q2 && s.q3 && s.q4 && s.q5);
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
  const choiceLabel = getBodyWashChoiceLabel(key, value);
  if (!choiceLabel) {
    throw new Error(`Missing shared bodywash choice label for ${key}:${value}`);
  }
  return choiceLabel;
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
