import { getDecisionShellConfig } from "@/features/mobile-decision/decisionShellConfig";
import { runDecisionResolveShell } from "@/features/mobile-decision/decisionResolveShell";

type Search = Record<string, string | string[] | undefined>;

export default async function ResolvePage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  return runDecisionResolveShell({
    config: getDecisionShellConfig("cleanser"),
    searchParams,
  });
}
