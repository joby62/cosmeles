import { redirect } from "next/navigation";
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

  if (!isCompleteLotionSignals(signals)) {
    redirect("/m/lotion/profile");
  }

  redirect(`/m/lotion/result?${toLotionSearchParams(signals).toString()}`);
}
