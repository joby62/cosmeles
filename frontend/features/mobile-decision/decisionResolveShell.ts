import { redirect } from "next/navigation";
import type {
  DecisionShellConfig,
  DecisionShellSearch,
} from "@/features/mobile-decision/decisionShellConfig";
import { applyMobileReturnTo, parseMobileReturnTo } from "@/lib/mobile/flowReturn";
import {
  applyResultCtaAttribution,
  parseResultCtaAttribution,
} from "@/lib/mobile/resultCtaAttribution";

export async function runDecisionResolveShell({
  config,
  searchParams,
}: {
  config: DecisionShellConfig;
  searchParams?: Promise<DecisionShellSearch>;
}): Promise<never> {
  const raw = (await Promise.resolve(searchParams)) || {};
  const attribution = parseResultCtaAttribution(raw);
  const returnTo = parseMobileReturnTo(raw);
  const signals = config.normalizeSignals(raw);

  if (!config.isComplete(signals)) {
    const profileParams = new URLSearchParams();
    applyResultCtaAttribution(profileParams, attribution);
    applyMobileReturnTo(profileParams, returnTo);
    const profileQuery = profileParams.toString();
    redirect(profileQuery ? `/m/${config.category}/profile?${profileQuery}` : `/m/${config.category}/profile`);
  }

  const resultParams = config.toSearchParams(signals);
  applyResultCtaAttribution(resultParams, attribution);
  applyMobileReturnTo(resultParams, returnTo);
  redirect(`/m/${config.category}/result?${resultParams.toString()}`);
}
