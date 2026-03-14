import { redirect } from "next/navigation";
import {
  appendMobileUtilityRouteState,
  parseMobileUtilityRouteState,
} from "@/features/mobile-utility/routeState";

type Search = Record<string, string | string[] | undefined>;

export default async function MobileLegacyBagPage({
  searchParams,
}: {
  searchParams?: Promise<Search> | Search;
}) {
  const resolved = await Promise.resolve(searchParams ?? {});
  const routeState = parseMobileUtilityRouteState(resolved);
  redirect(appendMobileUtilityRouteState("/m/me/bag", routeState));
}
