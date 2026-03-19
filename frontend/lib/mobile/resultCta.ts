export const MOBILE_RESULT_CTA_VOCABULARY = [
  "bag_add",
  "compare",
  "rationale",
  "retry_same_category",
  "switch_category",
] as const;

export type MobileResultCta = (typeof MOBILE_RESULT_CTA_VOCABULARY)[number];

const MOBILE_RESULT_CTA_SET = new Set<string>(MOBILE_RESULT_CTA_VOCABULARY);

const MOBILE_RESULT_CTA_LEGACY_ALIAS: Record<string, MobileResultCta> = {
  bag: "bag_add",
  add_to_bag: "bag_add",
  product: "bag_add",
  compare: "compare",
  wiki: "rationale",
  rationale: "rationale",
  detail: "rationale",
  restart: "retry_same_category",
  rerun: "retry_same_category",
  retry: "retry_same_category",
  retry_same_category: "retry_same_category",
  switch: "switch_category",
  choose: "switch_category",
  me: "switch_category",
  switch_category: "switch_category",
};

export function normalizeMobileResultCta(raw: string | null | undefined): MobileResultCta | null {
  const normalized = String(raw || "").trim().toLowerCase();
  if (!normalized) return null;
  if (MOBILE_RESULT_CTA_SET.has(normalized)) {
    return normalized as MobileResultCta;
  }
  return MOBILE_RESULT_CTA_LEGACY_ALIAS[normalized] || null;
}
