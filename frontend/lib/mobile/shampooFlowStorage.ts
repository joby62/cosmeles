export const SHAMPOO_PROFILE_DRAFT_KEY = "mx_mobile_shampoo_profile_draft_v2";
export const SHAMPOO_LAST_RESULT_QUERY_KEY = "mx_mobile_shampoo_last_result_query_v1";

export function normalizeShampooResultQueryString(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const q1 = params.get("q1");
  const q2 = params.get("q2");
  const q3 = params.get("q3");
  const isABC = (v: string | null) => v === "A" || v === "B" || v === "C";
  const isABCD = (v: string | null) => v === "A" || v === "B" || v === "C" || v === "D";
  if (!isABC(q1) || !isABCD(q2) || !isABC(q3)) return null;
  const clean = new URLSearchParams();
  clean.set("q1", q1);
  clean.set("q2", q2);
  clean.set("q3", q3);
  return clean.toString();
}
