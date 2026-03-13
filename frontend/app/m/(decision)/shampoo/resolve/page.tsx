import { redirect } from "next/navigation";
import { applyMobileReturnTo, parseMobileReturnTo } from "@/lib/mobile/flowReturn";
import { applyResultCtaAttribution, parseResultCtaAttribution } from "@/lib/mobile/resultCtaAttribution";
import {
  isReadyShampooResult,
  normalizeShampooSignals,
  toSignalSearchParams,
} from "@/lib/mobile/shampooDecision";

type Search = Record<string, string | string[] | undefined>;

export default async function ShampooResolvePage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const raw = (await Promise.resolve(searchParams)) || {};
  const signals = normalizeShampooSignals(raw);
  const attribution = parseResultCtaAttribution(raw);
  const returnTo = parseMobileReturnTo(raw);

  if (!isReadyShampooResult(signals)) {
    const profileParams = new URLSearchParams();
    applyResultCtaAttribution(profileParams, attribution);
    applyMobileReturnTo(profileParams, returnTo);
    const profileQuery = profileParams.toString();
    redirect(profileQuery ? `/m/shampoo/profile?${profileQuery}` : "/m/shampoo/profile");
  }

  const resultParams = toSignalSearchParams(signals);
  applyResultCtaAttribution(resultParams, attribution);
  applyMobileReturnTo(resultParams, returnTo);
  redirect(`/m/shampoo/result?${resultParams.toString()}`);
}
