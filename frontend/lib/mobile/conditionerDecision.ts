export type TargetSignal = "tangle" | "frizz" | "dry-ends" | "flat-roots";
export type HairSignal = "short" | "mid-long" | "long-damaged" | "fine-flat";
export type UseSignal = "tips-quick" | "hold-1-3" | "more-for-smooth" | "touch-scalp";
export type AvoidSignal = "still-rough" | "next-day-flat" | "strong-fragrance" | "residue-film";

export type ConditionerSignals = {
  target?: TargetSignal;
  hair?: HairSignal;
  use?: UseSignal;
  avoid?: AvoidSignal;
};

export function normalizeConditionerSignals(
  raw: Record<string, string | string[] | undefined>,
): ConditionerSignals {
  const value = (k: string) => {
    const v = raw[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const target = value("target");
  const hair = value("hair");
  const use = value("use");
  const avoid = value("avoid");

  return {
    target: isTargetSignal(target) ? target : undefined,
    hair: isHairSignal(hair) ? hair : undefined,
    use: isUseSignal(use) ? use : undefined,
    avoid: isAvoidSignal(avoid) ? avoid : undefined,
  };
}

export function isCompleteConditionerSignals(
  s: ConditionerSignals,
): s is Required<ConditionerSignals> {
  return Boolean(s.target && s.hair && s.use && s.avoid);
}

export function toConditionerSearchParams(s: ConditionerSignals): URLSearchParams {
  const qp = new URLSearchParams();
  if (s.target) qp.set("target", s.target);
  if (s.hair) qp.set("hair", s.hair);
  if (s.use) qp.set("use", s.use);
  if (s.avoid) qp.set("avoid", s.avoid);
  return qp;
}

function isTargetSignal(v?: string): v is TargetSignal {
  return v === "tangle" || v === "frizz" || v === "dry-ends" || v === "flat-roots";
}

function isHairSignal(v?: string): v is HairSignal {
  return v === "short" || v === "mid-long" || v === "long-damaged" || v === "fine-flat";
}

function isUseSignal(v?: string): v is UseSignal {
  return v === "tips-quick" || v === "hold-1-3" || v === "more-for-smooth" || v === "touch-scalp";
}

function isAvoidSignal(v?: string): v is AvoidSignal {
  return v === "still-rough" || v === "next-day-flat" || v === "strong-fragrance" || v === "residue-film";
}
