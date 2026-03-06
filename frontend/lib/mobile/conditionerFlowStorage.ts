export const CONDITIONER_PROFILE_DRAFT_KEY = "mx_mobile_conditioner_profile_draft_v2";
export const CONDITIONER_LAST_RESULT_QUERY_KEY = "mx_mobile_conditioner_last_result_query_v1";

export function normalizeConditionerResultQueryString(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const cQ1 = params.get("c_q1");
  const cQ2 = params.get("c_q2");
  const cQ3 = params.get("c_q3");
  const isABC = (v: string | null) => v === "A" || v === "B" || v === "C";
  if (!isABC(cQ1) || !isABC(cQ2) || !isABC(cQ3)) return null;
  const clean = new URLSearchParams();
  clean.set("c_q1", cQ1);
  clean.set("c_q2", cQ2);
  clean.set("c_q3", cQ3);
  return clean.toString();
}
