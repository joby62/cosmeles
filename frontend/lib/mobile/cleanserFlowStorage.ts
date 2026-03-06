export const CLEANSER_PROFILE_DRAFT_KEY = "mx_mobile_cleanser_profile_draft_v2";
export const CLEANSER_LAST_RESULT_QUERY_KEY = "mx_mobile_cleanser_last_result_query_v1";

export function normalizeCleanserResultQueryString(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const q1 = params.get("q1");
  const q2 = params.get("q2");
  const q3 = params.get("q3");
  const q4 = params.get("q4");
  const q5 = params.get("q5");
  const isABC = (v: string | null) => v === "A" || v === "B" || v === "C";
  const isABCD = (v: string | null) => v === "A" || v === "B" || v === "C" || v === "D";
  const isABCDE = (v: string | null) => v === "A" || v === "B" || v === "C" || v === "D" || v === "E";
  if (!isABCD(q1) || !isABC(q2) || !isABC(q3) || !isABCDE(q4) || !isABCD(q5)) return null;
  const clean = new URLSearchParams();
  clean.set("q1", q1);
  clean.set("q2", q2);
  clean.set("q3", q3);
  clean.set("q4", q4);
  clean.set("q5", q5);
  return clean.toString();
}
