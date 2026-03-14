import { runDecisionStartShell } from "@/features/mobile-decision/DecisionStartShellPage";
import type { DecisionShellSearch } from "@/features/mobile-decision/decisionShellConfig";

export default async function LotionStart({
  searchParams,
}: {
  searchParams?: Promise<DecisionShellSearch>;
}) {
  return runDecisionStartShell({
    category: "lotion",
    searchParams,
  });
}
