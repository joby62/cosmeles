import { redirect } from "next/navigation";
import SelectionPublishedResultFlow from "@/components/mobile/SelectionPublishedResultFlow";
import SelectionResultErrorState from "@/components/mobile/SelectionResultErrorState";
import { fetchMobileSelectionResult } from "@/lib/api";
import { formatRuntimeError } from "@/lib/error";
import { applyMobileReturnTo, parseMobileReturnTo } from "@/lib/mobile/flowReturn";
import { applyResultCtaAttribution, parseResultCtaAttribution } from "@/lib/mobile/resultCtaAttribution";

type Search = Record<string, string | string[] | undefined>;

function getValue(raw: Search, key: string): string | null {
  const value = raw[key];
  const picked = Array.isArray(value) ? value[0] : value;
  return typeof picked === "string" && picked.trim() ? picked.trim() : null;
}

function parseAnswers(raw: Search): Record<string, string> | null {
  const cQ1 = getValue(raw, "c_q1");
  const cQ2 = getValue(raw, "c_q2");
  const cQ3 = getValue(raw, "c_q3");
  if (!cQ1 || !cQ2 || !cQ3) return null;
  return { c_q1: cQ1, c_q2: cQ2, c_q3: cQ3 };
}

export default async function ConditionerResultPage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const raw = (await Promise.resolve(searchParams)) || {};
  const attribution = parseResultCtaAttribution(raw);
  const returnTo = parseMobileReturnTo(raw);
  const startParams = new URLSearchParams({ step: "1" });
  applyResultCtaAttribution(startParams, attribution);
  applyMobileReturnTo(startParams, returnTo);
  const startHref = `/m/conditioner/profile?${startParams.toString()}`;
  const profileParams = new URLSearchParams();
  applyResultCtaAttribution(profileParams, attribution);
  applyMobileReturnTo(profileParams, returnTo);
  const profileQuery = profileParams.toString();
  const profileHref = profileQuery ? `/m/conditioner/profile?${profileQuery}` : "/m/conditioner/profile";
  const answers = parseAnswers(raw);
  if (!answers) {
    redirect(profileHref);
  }

  let result: Awaited<ReturnType<typeof fetchMobileSelectionResult>> | null = null;
  let resultError: string | null = null;
  try {
    result = await fetchMobileSelectionResult({
      category: "conditioner",
      answers,
    });
  } catch (err) {
    resultError = formatRuntimeError(err);
  }

  if (!result) {
    return (
      <SelectionResultErrorState
        heading="护发素预生成结果暂时不可用"
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
      titlePrefix="护发素决策"
      emptyImageLabel="Conditioner"
      startHref={startHref}
      profileHref={profileHref}
      result={result.item}
      analyticsContext={
        attribution
          ? {
              page: "selection_result",
              route: "/m/conditioner/result",
              source: attribution.source || "m_compare_result",
              resultCta: attribution.resultCta,
              fromCompareId: attribution.fromCompareId,
            }
          : null
      }
    />
  );
}
