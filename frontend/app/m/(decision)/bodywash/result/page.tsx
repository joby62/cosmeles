import { renderDecisionResultShell } from "@/features/mobile-decision/DecisionResultShellPage";
import { getDecisionShellConfig } from "@/features/mobile-decision/decisionShellConfig";

type Search = Record<string, string | string[] | undefined>;

export default async function ResultPage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  return renderDecisionResultShell({
    config: getDecisionShellConfig("bodywash"),
    searchParams,
  });
}
