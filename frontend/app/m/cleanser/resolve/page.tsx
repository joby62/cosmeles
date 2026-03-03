import { redirect } from "next/navigation";
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

  if (!isCompleteCleanserSignals(signals)) {
    redirect("/m/cleanser/profile");
  }

  redirect(`/m/cleanser/result?${toCleanserSearchParams(signals).toString()}`);
}
