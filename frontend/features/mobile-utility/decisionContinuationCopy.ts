import type { DecisionContinuationAction } from "@/domain/mobile/progress/decisionResume";

export function describeDecisionContinuationAction(action: DecisionContinuationAction): string {
  if (action === "resume_profile") return "继续答题";
  if (action === "reopen_result") return "打开最近结果";
  return "回到个性挑选";
}
