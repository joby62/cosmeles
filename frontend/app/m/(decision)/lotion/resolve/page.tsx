import { redirect } from "next/navigation";
import { applyMobileReturnTo, parseMobileReturnTo } from "@/lib/mobile/flowReturn";
import { applyResultCtaAttribution, parseResultCtaAttribution } from "@/lib/mobile/resultCtaAttribution";
import {
  isCompleteLotionSignals,
  normalizeLotionSignals,
  toLotionSearchParams,
} from "@/lib/mobile/lotionDecision";

type Search = Record<string, string | string[] | undefined>;

export default async function LotionResolvePage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const raw = (await Promise.resolve(searchParams)) || {};
  const signals = normalizeLotionSignals(raw);
  const attribution = parseResultCtaAttribution(raw);
  const returnTo = parseMobileReturnTo(raw);

  if (!isCompleteLotionSignals(signals)) {
    const profileParams = new URLSearchParams();
    applyResultCtaAttribution(profileParams, attribution);
    applyMobileReturnTo(profileParams, returnTo);
    const profileQuery = profileParams.toString();
    redirect(profileQuery ? `/m/lotion/profile?${profileQuery}` : "/m/lotion/profile");
  }

  const resultParams = toLotionSearchParams(signals);
  applyResultCtaAttribution(resultParams, attribution);
  applyMobileReturnTo(resultParams, returnTo);
  redirect(`/m/lotion/result?${resultParams.toString()}`);
}
