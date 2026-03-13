import { getConditionerChoiceLabel } from "@/domain/mobile/decision/conditioner";

export type CQ1Signal = "A" | "B" | "C";
export type CQ2Signal = "A" | "B" | "C";
export type CQ3Signal = "A" | "B" | "C";

export type ConditionerSignals = {
  c_q1?: CQ1Signal;
  c_q2?: CQ2Signal;
  c_q3?: CQ3Signal;
};

export function normalizeConditionerSignals(
  raw: Record<string, string | string[] | undefined>,
): ConditionerSignals {
  const value = (k: string) => {
    const v = raw[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const cQ1 = value("c_q1");
  const cQ2 = value("c_q2");
  const cQ3 = value("c_q3");

  return {
    c_q1: isABC(cQ1) ? cQ1 : undefined,
    c_q2: isABC(cQ2) ? cQ2 : undefined,
    c_q3: isABC(cQ3) ? cQ3 : undefined,
  };
}

export function isCompleteConditionerSignals(
  s: ConditionerSignals,
): s is Required<ConditionerSignals> {
  return Boolean(s.c_q1 && s.c_q2 && s.c_q3);
}

export function toConditionerSearchParams(s: ConditionerSignals): URLSearchParams {
  const qp = new URLSearchParams();
  if (s.c_q1) qp.set("c_q1", s.c_q1);
  if (s.c_q2) qp.set("c_q2", s.c_q2);
  if (s.c_q3) qp.set("c_q3", s.c_q3);
  return qp;
}

export function conditionerChoiceLabel(key: "c_q1" | "c_q2" | "c_q3", value: "A" | "B" | "C"): string {
  const choiceLabel = getConditionerChoiceLabel(key, value);
  if (!choiceLabel) {
    throw new Error(`Missing shared conditioner choice label for ${key}:${value}`);
  }
  return choiceLabel;
}

function isABC(v?: string): v is "A" | "B" | "C" {
  return v === "A" || v === "B" || v === "C";
}
