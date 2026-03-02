import { redirect } from "next/navigation";
import {
  isCompleteConditionerSignals,
  normalizeConditionerSignals,
  toConditionerSearchParams,
} from "@/lib/mobile/conditionerDecision";

type Search = Record<string, string | string[] | undefined>;

export default async function ConditionerResolvePage({
  searchParams,
}: {
  searchParams?: Search | Promise<Search>;
}) {
  const raw = (await Promise.resolve(searchParams)) || {};
  const signals = normalizeConditionerSignals(raw);

  if (!isCompleteConditionerSignals(signals)) {
    redirect("/m/conditioner/profile");
  }

  redirect(`/m/conditioner/result?${toConditionerSearchParams(signals).toString()}`);
}
