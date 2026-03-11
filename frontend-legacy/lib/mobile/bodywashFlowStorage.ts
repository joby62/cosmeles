export const BODYWASH_PROFILE_DRAFT_KEY = "mx_mobile_bodywash_profile_draft_v2";
export const BODYWASH_LAST_RESULT_QUERY_KEY = "mx_mobile_bodywash_last_result_query_v1";

export function normalizeBodyWashResultQueryString(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const q1 = params.get("q1");
  const q2 = params.get("q2");
  const q3 = params.get("q3");
  const q4 = params.get("q4");
  const q5 = params.get("q5");
  const isAB = (v: string | null) => v === "A" || v === "B";
  const isABCD = (v: string | null) => v === "A" || v === "B" || v === "C" || v === "D";
  if (!isABCD(q1) || !isAB(q2) || !isABCD(q3) || !isAB(q4) || !isAB(q5)) return null;
  const clean = new URLSearchParams();
  clean.set("q1", q1);
  clean.set("q2", q2);
  clean.set("q3", q3);
  clean.set("q4", q4);
  clean.set("q5", q5);
  return clean.toString();
}
