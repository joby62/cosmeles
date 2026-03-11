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

const q1Labels: Record<Q1Signal, string> = {
  A: "大油田（全脸泛油，刚洗完很快又油了，经常油光满面）",
  B: "混油皮（T区出油明显易长黑头，U区正常或偏干）",
  C: "中性/混干（出油量正常，只有换季或秋冬偶尔感到干燥）",
  D: "大干皮（极少出油，洗脸后常感紧绷，甚至有起皮脱屑）",
};

const q2Labels: Record<Q2Signal, string> = {
  A: "重度敏感（有红血丝、常泛红发痒、处于烂脸期/皮炎期、极易刺痛）",
  B: "轻度敏感（换季或受刺激时偶尔泛红，挑选护肤品需要谨慎）",
  C: "屏障健康（“城墙皮”，基本不过敏，对猛药耐受度高）",
};

const q3Labels: Record<Q3Signal, string> = {
  A: "每天浓妆（全妆，常使用防水彩妆/高倍防水防晒，需强力二次清洁洗去卸妆油残留）",
  B: "日常淡妆/通勤防晒（仅涂抹普通防晒霜、隔离或轻薄气垫）",
  C: "仅素颜（基本不化妆，仅需洗去日常分泌的皮脂与灰尘）",
};

const q4Labels: Record<Q4Signal, string> = {
  A: "黑头与闭口粉刺（T区毛孔粗大，有顽固脂栓）",
  B: "红肿破口痘（有正在发炎、红肿疼痛或已经破口的痘痘）",
  C: "暗沉粗糙（角质层较厚，摸起来不平滑，肤色不均/无光泽）",
  D: "极度缺水紧绷（洗脸是件痛苦的事，洗完立刻干涩刺痛）",
  E: "无明显痛点（状态稳定，日常健康维稳即可）",
};

const q5Labels: Record<Q5Signal, string> = {
  A: "喜欢丰富绵密的泡沫（注重起泡的仪式感和缓冲感）",
  B: "喜欢“搓盘子”般的绝对清爽感（追求极致去油，摸起来一点都不滑）",
  C: "喜欢洗后保留水润滑溜感（抗拒紧绷，甚至偏好微微的膜感或保湿感）",
  D: "喜欢无泡/低泡的温和感（只要温和不刺激就行，对泡沫无执念）",
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
