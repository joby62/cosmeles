import { redirect } from "next/navigation";
import {
  appendMobileUtilityRouteState,
  parseMobileUtilityRouteState,
} from "@/features/mobile-utility/routeState";

type Search = Record<string, string | string[] | undefined>;

function pickTab(raw: string | string[] | undefined): string {
  if (Array.isArray(raw)) return String(raw[0] || "").trim().toLowerCase();
  return String(raw || "").trim().toLowerCase();
}

export default async function MobileMeEntryPage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const raw = (await Promise.resolve(searchParams)) || {};
  const tab = pickTab(raw.tab);
  const routeState = parseMobileUtilityRouteState(raw);

  if (tab === "selection" || tab === "compare") {
    redirect(appendMobileUtilityRouteState(`/m/me/history?tab=${tab}`, routeState));
  }

  if (tab === "bag") {
    redirect(appendMobileUtilityRouteState("/m/me/bag", routeState));
  }

  redirect(appendMobileUtilityRouteState("/m/me/use", routeState));
}
