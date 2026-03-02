import { redirect } from "next/navigation";
import {
  isReadyShampooResult,
  normalizeShampooSignals,
  toSignalSearchParams,
} from "@/lib/mobile/shampooDecision";

type Search = Record<string, string | string[] | undefined>;

export default async function ShampooResolvePage({
  searchParams,
}: {
  searchParams?: Search | Promise<Search>;
}) {
  const raw = (await Promise.resolve(searchParams)) || {};
  const signals = normalizeShampooSignals(raw);

  if (!isReadyShampooResult(signals)) {
    redirect("/m/shampoo/profile");
  }

  redirect(`/m/shampoo/result?${toSignalSearchParams(signals).toString()}`);
}
