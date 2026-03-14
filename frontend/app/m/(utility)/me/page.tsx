import { redirect } from "next/navigation";
import {
  appendMobileUtilityRouteState,
  parseMobileUtilityRouteState,
} from "@/features/mobile-utility/routeState";
import {
  pickMobileMeTab,
  resolveMobileMeEntryPath,
} from "@/features/mobile-utility/meRouteIntent";

type Search = Record<string, string | string[] | undefined>;

export default async function MobileMeEntryPage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const raw = (await Promise.resolve(searchParams)) || {};
  const tab = pickMobileMeTab(raw.tab);
  const routeState = parseMobileUtilityRouteState(raw);
  redirect(appendMobileUtilityRouteState(resolveMobileMeEntryPath(tab), routeState));
}
