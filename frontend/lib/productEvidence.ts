import type {
  ProductAnalysisEvidenceItem,
  ProductAnalysisIndexItem,
  ProductAnalysisMissingCode,
  ProductAnalysisProfile,
  ProductAnalysisSubtypeFitVerdict,
} from "@/lib/api";

const FIT_VERDICT_LABELS: Record<ProductAnalysisSubtypeFitVerdict, string> = {
  strong_fit: "Strong fit",
  fit_with_limits: "Fit with limits",
  weak_fit: "Weak fit",
  mismatch: "Mismatch risk",
};

const FIT_VERDICT_SUMMARIES: Record<ProductAnalysisSubtypeFitVerdict, string> = {
  strong_fit: "This profile lines up cleanly with the intended route and needs fewer caveats.",
  fit_with_limits: "This profile can still work for the route, but it comes with a few tradeoffs worth checking first.",
  weak_fit: "This profile only fits a narrower slice of the route, so compare before you save it.",
  mismatch: "This profile is likely outside the safest route match and should be rechecked before you commit.",
};

const MISSING_CODE_LABELS: Record<ProductAnalysisMissingCode, string> = {
  route_support_missing: "Route support is still lightly evidenced.",
  evidence_too_sparse: "The evidence base is still sparse.",
  active_strength_unclear: "Active strength is not fully clear yet.",
  ingredient_order_unclear: "Ingredient order certainty is still limited.",
  formula_signal_conflict: "Some formula signals still point in different directions.",
  ingredient_library_absent: "Ingredient library support is incomplete for part of this formula.",
  summary_signal_too_weak: "The summary signal is still weaker than ideal.",
};

function pickIngredientName(item: ProductAnalysisEvidenceItem): string {
  return item.ingredient_name_en || item.ingredient_name_cn || "Formula signal";
}

function compactImpact(text: string): string {
  return String(text || "").trim().replace(/\s+/g, " ");
}

export function analysisConfidenceLabel(confidence?: number | null): string | null {
  return typeof confidence === "number" ? `Fit confidence ${confidence}%` : null;
}

export function analysisVerdictLabel(verdict?: ProductAnalysisSubtypeFitVerdict | null): string | null {
  return verdict ? FIT_VERDICT_LABELS[verdict] : null;
}

export function analysisVerdictSummary(verdict?: ProductAnalysisSubtypeFitVerdict | null): string | null {
  return verdict ? FIT_VERDICT_SUMMARIES[verdict] : null;
}

export function analysisReviewLabel(needsReview?: boolean | null): string | null {
  return needsReview ? "Needs evidence review" : null;
}

export function analysisMissingNotes(codes?: ProductAnalysisMissingCode[] | null, limit = 2): string[] {
  return (codes || []).slice(0, limit).map((code) => MISSING_CODE_LABELS[code] || code);
}

export function analysisPositiveProof(profile?: ProductAnalysisProfile | null, limit = 3): string[] {
  return (profile?.evidence?.positive || []).slice(0, limit).map((item) => `${pickIngredientName(item)}: ${compactImpact(item.impact)}`);
}

export function analysisCounterProof(profile?: ProductAnalysisProfile | null, limit = 2): string[] {
  const counter = (profile?.evidence?.counter || []).slice(0, limit).map((item) => `${pickIngredientName(item)}: ${compactImpact(item.impact)}`);
  return [...counter, ...analysisMissingNotes(profile?.evidence?.missing_codes, Math.max(0, limit - counter.length))].slice(0, limit);
}

export function analysisCardProofSummary(item?: ProductAnalysisIndexItem | null): string | null {
  if (!item) return null;
  if (item.needs_review) {
    return "Useful directional fit, but this profile still has evidence edges to keep in mind.";
  }
  if (item.subtype_fit_verdict) {
    return FIT_VERDICT_SUMMARIES[item.subtype_fit_verdict];
  }
  if (typeof item.confidence === "number" && item.confidence > 0) {
    return `Current analysis confidence is ${item.confidence}%, which is enough to use as a decision aid while reviews are not live yet.`;
  }
  return null;
}
