import { redirect } from "next/navigation";
import { applyMobileReturnTo, parseMobileReturnTo } from "@/lib/mobile/flowReturn";
import { applyResultCtaAttribution, parseResultCtaAttribution } from "@/lib/mobile/resultCtaAttribution";
import {
  isReadyBodyWashResult,
  normalizeBodyWashSignals,
  toBodyWashSearchParams,
} from "@/lib/mobile/bodywashDecision";

type Search = Record<string, string | string[] | undefined>;

export default async function BodyWashResolvePage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const raw = (await Promise.resolve(searchParams)) || {};
  const signals = normalizeBodyWashSignals(raw);
  const attribution = parseResultCtaAttribution(raw);
  const returnTo = parseMobileReturnTo(raw);

  if (!isReadyBodyWashResult(signals)) {
    const profileParams = new URLSearchParams();
    applyResultCtaAttribution(profileParams, attribution);
    applyMobileReturnTo(profileParams, returnTo);
    const profileQuery = profileParams.toString();
    redirect(profileQuery ? `/m/bodywash/profile?${profileQuery}` : "/m/bodywash/profile");
  }

  const resultParams = toBodyWashSearchParams(signals);
  applyResultCtaAttribution(resultParams, attribution);
  applyMobileReturnTo(resultParams, returnTo);
  redirect(`/m/bodywash/result?${resultParams.toString()}`);
}
