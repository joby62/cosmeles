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
  if (key === "c_q1") {
    if (value === "A") return "频繁漂/染/烫 (干枯空洞)";
    if (value === "B") return "偶尔染烫/经常使用热工具 (轻度受损)";
    return "原生发/几乎不折腾 (健康)";
  }
  if (key === "c_q2") {
    if (value === "A") return "细软少/极易贴头皮";
    if (value === "B") return "粗硬/沙发/天生毛躁";
    return "正常适中";
  }
  if (value === "A") return "刚染完，需要锁色/固色";
  if (value === "B") return "打结梳不开，需要极致顺滑";
  return "发尾不干枯，保持自然蓬松就行";
}

function isABC(v?: string): v is "A" | "B" | "C" {
  return v === "A" || v === "B" || v === "C";
}
