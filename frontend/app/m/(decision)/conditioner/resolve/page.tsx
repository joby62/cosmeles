import { redirect } from "next/navigation";
import { applyMobileReturnTo, parseMobileReturnTo } from "@/lib/mobile/flowReturn";
import { applyResultCtaAttribution, parseResultCtaAttribution } from "@/lib/mobile/resultCtaAttribution";
import {
  isCompleteConditionerSignals,
  normalizeConditionerSignals,
  toConditionerSearchParams,
} from "@/lib/mobile/conditionerDecision";

type Search = Record<string, string | string[] | undefined>;

export default async function ConditionerResolvePage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const raw = (await Promise.resolve(searchParams)) || {};
  const signals = normalizeConditionerSignals(raw);
  const attribution = parseResultCtaAttribution(raw);
  const returnTo = parseMobileReturnTo(raw);

  if (!isCompleteConditionerSignals(signals)) {
    const profileParams = new URLSearchParams();
    applyResultCtaAttribution(profileParams, attribution);
    applyMobileReturnTo(profileParams, returnTo);
    const profileQuery = profileParams.toString();
    redirect(profileQuery ? `/m/conditioner/profile?${profileQuery}` : "/m/conditioner/profile");
  }

  const resultParams = toConditionerSearchParams(signals);
  applyResultCtaAttribution(resultParams, attribution);
  applyMobileReturnTo(resultParams, returnTo);
  redirect(`/m/conditioner/result?${resultParams.toString()}`);
}
