import { redirect } from "next/navigation";
import type { MobileSelectionCategory } from "@/lib/api";
import { parseMobileReturnTo } from "@/lib/mobile/flowReturn";
import { parseResultCtaAttribution } from "@/lib/mobile/resultCtaAttribution";
import type { DecisionShellSearch } from "@/features/mobile-decision/decisionShellConfig";
import {
  buildDecisionProfileEntryHref,
  DECISION_ENTRY_SOURCE,
} from "@/features/mobile-decision/decisionEntryHref";
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
  const source = resolveDecisionAnalyticsSource(raw, DECISION_ENTRY_SOURCE.decisionStart);
  redirect(
    buildDecisionProfileEntryHref({
      category,
      source,
      resultAttribution: attribution,
      returnTo,
    }),
  );
}
