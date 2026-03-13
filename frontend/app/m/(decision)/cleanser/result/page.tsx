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
  const q1 = getValue(raw, "q1");
  const q2 = getValue(raw, "q2");
  const q3 = getValue(raw, "q3");
  const q4 = getValue(raw, "q4");
  const q5 = getValue(raw, "q5");

  const isQ1 = (v: string | null) => v === "A" || v === "B" || v === "C" || v === "D";
  const isQ2 = (v: string | null) => v === "A" || v === "B" || v === "C";
  const isQ3 = (v: string | null) => v === "A" || v === "B" || v === "C";
  const isQ4 = (v: string | null) => v === "A" || v === "B" || v === "C" || v === "D" || v === "E";
  const isQ5 = (v: string | null) => v === "A" || v === "B" || v === "C" || v === "D";
  if (!isQ1(q1) || !isQ2(q2) || !isQ3(q3) || !isQ4(q4) || !isQ5(q5)) return null;

  return { q1, q2, q3, q4, q5 };
}

export default async function CleanserResultPage({
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
  const startHref = `/m/cleanser/profile?${startParams.toString()}`;
  const profileParams = new URLSearchParams();
  applyResultCtaAttribution(profileParams, attribution);
  applyMobileReturnTo(profileParams, returnTo);
  const profileQuery = profileParams.toString();
  const profileHref = profileQuery ? `/m/cleanser/profile?${profileQuery}` : "/m/cleanser/profile";
  const answers = parseAnswers(raw);
  if (!answers) {
    redirect(profileHref);
  }

  let result: Awaited<ReturnType<typeof fetchMobileSelectionResult>> | null = null;
  let resultError: string | null = null;
  try {
    result = await fetchMobileSelectionResult({
      category: "cleanser",
      answers,
    });
  } catch (err) {
    resultError = formatRuntimeError(err);
  }

  if (!result) {
    return (
      <SelectionResultErrorState
        heading="洗面奶预生成结果暂时不可用"
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
      titlePrefix="洗面奶决策"
      emptyImageLabel="Cleanser"
      startHref={startHref}
      profileHref={profileHref}
      result={result.item}
      analyticsContext={
        attribution
          ? {
              page: "selection_result",
              route: "/m/cleanser/result",
              source: attribution.source || "m_compare_result",
              resultCta: attribution.resultCta,
              fromCompareId: attribution.fromCompareId,
            }
          : null
      }
    />
  );
}
