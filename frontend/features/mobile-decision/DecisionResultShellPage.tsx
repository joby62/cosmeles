import { redirect } from "next/navigation";
import SelectionPublishedResultFlow from "@/components/mobile/SelectionPublishedResultFlow";
import SelectionResultErrorState from "@/components/mobile/SelectionResultErrorState";
import type {
  DecisionShellConfig,
  DecisionShellSearch,
} from "@/features/mobile-decision/decisionShellConfig";
import {
  buildDecisionProfileEntryHref,
  DECISION_ENTRY_SOURCE,
} from "@/features/mobile-decision/decisionEntryHref";
import { fetchMobileSelectionResult } from "@/lib/api";
import { formatRuntimeError } from "@/lib/error";
import { applyMobileReturnTo, parseMobileReturnTo } from "@/lib/mobile/flowReturn";
import {
  applyResultCtaAttribution,
  parseResultCtaAttribution,
} from "@/lib/mobile/resultCtaAttribution";

export async function renderDecisionResultShell({
  config,
  searchParams,
}: {
  config: DecisionShellConfig;
  searchParams?: Promise<DecisionShellSearch>;
}) {
  const raw = (await Promise.resolve(searchParams)) || {};
  const attribution = parseResultCtaAttribution(raw);
  const returnTo = parseMobileReturnTo(raw);

  const startHref = buildDecisionProfileEntryHref({
    category: config.category,
    source: attribution?.source || DECISION_ENTRY_SOURCE.decisionResultRestart,
    resultAttribution: attribution,
    returnTo,
  });

  const profileParams = new URLSearchParams();
  applyResultCtaAttribution(profileParams, attribution);
  applyMobileReturnTo(profileParams, returnTo);
  const profileQuery = profileParams.toString();
  const profileHref = profileQuery
    ? `/m/${config.category}/profile?${profileQuery}`
    : `/m/${config.category}/profile`;

  const answers = config.parseResultAnswers(raw);
  if (!answers) {
    redirect(profileHref);
  }

  const resultHref = `/m/${config.category}/result?${new URLSearchParams(answers).toString()}`;

  let result: Awaited<ReturnType<typeof fetchMobileSelectionResult>> | null = null;
  let resultError: string | null = null;
  try {
    result = await fetchMobileSelectionResult({
      category: config.category,
      answers,
    });
  } catch (err) {
    resultError = formatRuntimeError(err);
  }

  if (!result) {
    return (
      <SelectionResultErrorState
        heading={config.resultErrorHeading}
        error={resultError || "unknown"}
        startHref={startHref}
        profileHref={profileHref}
      />
    );
  }

  if (returnTo) {
    redirect(returnTo);
  }

  return (
    <SelectionPublishedResultFlow
      titlePrefix={config.titlePrefix}
      emptyImageLabel={config.emptyImageLabel}
      startHref={startHref}
      profileHref={profileHref}
      resultHref={resultHref}
      result={result.item}
      analyticsContext={{
        page: "selection_result",
        route: `/m/${config.category}/result`,
        source: attribution?.source || "decision_result",
      }}
    />
  );
}
