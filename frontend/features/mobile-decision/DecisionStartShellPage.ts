import { redirect } from "next/navigation";
import type { MobileSelectionCategory } from "@/lib/api";
import { applyMobileReturnTo, parseMobileReturnTo } from "@/lib/mobile/flowReturn";
import {
  applyResultCtaAttribution,
  parseResultCtaAttribution,
} from "@/lib/mobile/resultCtaAttribution";
import type { DecisionShellSearch } from "@/features/mobile-decision/decisionShellConfig";
import { resolveDecisionAnalyticsSource } from "@/features/mobile-decision/decisionQuestionAnalytics";

export async function runDecisionStartShell({
  category,
  searchParams,
}: {
  category: MobileSelectionCategory;
  searchParams?: Promise<DecisionShellSearch>;
}): Promise<never> {
  const raw = (await Promise.resolve(searchParams)) || {};
  const attribution = parseResultCtaAttribution(raw);
  const returnTo = parseMobileReturnTo(raw);
  const source = resolveDecisionAnalyticsSource(raw, "decision_start");

  const params = new URLSearchParams({ step: "1" });
  params.set("source", source);
  applyResultCtaAttribution(params, attribution);
  applyMobileReturnTo(params, returnTo);
  redirect(`/m/${category}/profile?${params.toString()}`);
}
