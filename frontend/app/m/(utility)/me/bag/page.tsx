import MobileBagPanel from "@/components/mobile/MobileBagPanel";
import MobileUtilityReturnActionLink from "@/features/mobile-utility/MobileUtilityReturnActionLink";
import {
  parseMobileUtilityRouteState,
} from "@/features/mobile-utility/routeState";

type Search = Record<string, string | string[] | undefined>;

export default async function MobileMeBagPage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const raw = (await Promise.resolve(searchParams)) || {};
  const routeState = parseMobileUtilityRouteState(raw);

  return (
    <section className="space-y-3">
      <MobileUtilityReturnActionLink routeState={routeState} />
      <MobileBagPanel routeState={routeState} />
    </section>
  );
}
