import { runDecisionStartShell } from "@/features/mobile-decision/DecisionStartShellPage";
import type { DecisionShellSearch } from "@/features/mobile-decision/decisionShellConfig";

export default async function ShampooStart({
  searchParams,
}: {
  searchParams?: Promise<DecisionShellSearch>;
}) {
  return runDecisionStartShell({
    category: "shampoo",
    searchParams,
  });
}
