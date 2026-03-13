import { getCleanserChoiceLabel } from "@/domain/mobile/decision/cleanser";

export type Q1Signal = "A" | "B" | "C" | "D";
export type Q2Signal = "A" | "B" | "C";
export type Q3Signal = "A" | "B" | "C";
export type Q4Signal = "A" | "B" | "C" | "D" | "E";
export type Q5Signal = "A" | "B" | "C" | "D";

export type CleanserSignals = {
  q1?: Q1Signal;
  q2?: Q2Signal;
  q3?: Q3Signal;
  q4?: Q4Signal;
  q5?: Q5Signal;
};

export function normalizeCleanserSignals(raw: Record<string, string | string[] | undefined>): CleanserSignals {
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

export function isCompleteCleanserSignals(s: CleanserSignals): s is Required<CleanserSignals> {
  return Boolean(s.q1 && s.q2 && s.q3 && s.q4 && s.q5);
}

export function toCleanserSearchParams(s: CleanserSignals): URLSearchParams {
  const qp = new URLSearchParams();
  if (s.q1) qp.set("q1", s.q1);
  if (s.q2) qp.set("q2", s.q2);
  if (s.q3) qp.set("q3", s.q3);
  if (s.q4) qp.set("q4", s.q4);
  if (s.q5) qp.set("q5", s.q5);
  return qp;
}

export function cleanserChoiceLabel(
  key: "q1" | "q2" | "q3" | "q4" | "q5",
  value: "A" | "B" | "C" | "D" | "E",
): string {
  const choiceLabel = getCleanserChoiceLabel(key, value);
  if (!choiceLabel) {
    throw new Error(`Missing shared cleanser choice label for ${key}:${value}`);
  }
  return choiceLabel;
}

function isQ1(v?: string): v is Q1Signal {
  return v === "A" || v === "B" || v === "C" || v === "D";
}

function isQ2(v?: string): v is Q2Signal {
  return v === "A" || v === "B" || v === "C";
}

function isQ3(v?: string): v is Q3Signal {
  return v === "A" || v === "B" || v === "C";
}

function isQ4(v?: string): v is Q4Signal {
  return v === "A" || v === "B" || v === "C" || v === "D" || v === "E";
}

function isQ5(v?: string): v is Q5Signal {
  return v === "A" || v === "B" || v === "C" || v === "D";
}
