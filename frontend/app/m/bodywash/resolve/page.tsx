import { redirect } from "next/navigation";
import {
  isReadyBodyWashResult,
  normalizeBodyWashSignals,
  toBodyWashSearchParams,
} from "@/lib/mobile/bodywashDecision";

type Search = Record<string, string | string[] | undefined>;

export default async function BodyWashResolvePage({
  searchParams,
}: {
  searchParams?: Search | Promise<Search>;
}) {
  const raw = (await Promise.resolve(searchParams)) || {};
  const signals = normalizeBodyWashSignals(raw);

  if (!isReadyBodyWashResult(signals)) {
    redirect("/m/bodywash/profile");
  }

  redirect(`/m/bodywash/result?${toBodyWashSearchParams(signals).toString()}`);
}
