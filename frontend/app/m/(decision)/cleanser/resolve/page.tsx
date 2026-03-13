import { redirect } from "next/navigation";
import { applyMobileReturnTo, parseMobileReturnTo } from "@/lib/mobile/flowReturn";
import { applyResultCtaAttribution, parseResultCtaAttribution } from "@/lib/mobile/resultCtaAttribution";
import {
  isCompleteCleanserSignals,
  normalizeCleanserSignals,
  toCleanserSearchParams,
} from "@/lib/mobile/cleanserDecision";

type Search = Record<string, string | string[] | undefined>;

export default async function CleanserResolvePage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const raw = (await Promise.resolve(searchParams)) || {};
  const signals = normalizeCleanserSignals(raw);
  const attribution = parseResultCtaAttribution(raw);
  const returnTo = parseMobileReturnTo(raw);

  if (!isCompleteCleanserSignals(signals)) {
    const profileParams = new URLSearchParams();
    applyResultCtaAttribution(profileParams, attribution);
    applyMobileReturnTo(profileParams, returnTo);
    const profileQuery = profileParams.toString();
    redirect(profileQuery ? `/m/cleanser/profile?${profileQuery}` : "/m/cleanser/profile");
  }

  const resultParams = toCleanserSearchParams(signals);
  applyResultCtaAttribution(resultParams, attribution);
  applyMobileReturnTo(resultParams, returnTo);
  redirect(`/m/cleanser/result?${resultParams.toString()}`);
}
