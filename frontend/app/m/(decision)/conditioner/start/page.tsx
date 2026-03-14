import { runDecisionStartShell } from "@/features/mobile-decision/DecisionStartShellPage";
import type { DecisionShellSearch } from "@/features/mobile-decision/decisionShellConfig";

export default async function ConditionerStart({
  searchParams,
}: {
  searchParams?: Promise<DecisionShellSearch>;
}) {
  return runDecisionStartShell({
    category: "conditioner",
    searchParams,
  });
}
