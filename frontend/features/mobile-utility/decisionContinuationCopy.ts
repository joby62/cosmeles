import type { DecisionContinuationAction } from "@/domain/mobile/progress/decisionResume";

export function describeDecisionContinuationAction(action: DecisionContinuationAction): string {
  if (action === "resume_profile") return "继续答题";
  if (action === "reopen_result") return "查看最近结果";
  return "回到个性挑选";
}

type DecisionContinuationSurface = "history_selection" | "history_compare" | "bag";

export function describeDecisionContinuationSurface(surface: DecisionContinuationSurface): string {
  if (surface === "history_selection") return "这里保存已完成的真实推荐记录，可直接回看结果、产品和成分。";
  if (surface === "history_compare") return "这里保存横向对比记录，并可直接续接下一步决策。";
  return "可随时回到测配续接下一步。";
}
