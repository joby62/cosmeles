import Link from "next/link";
import MobileBagPanel from "@/components/mobile/MobileBagPanel";
import {
  describeMobileUtilityReturnLabel,
  hasMobileUtilityRouteContext,
  parseMobileUtilityRouteState,
  resolveMobileUtilityReturnHref,
} from "@/features/mobile-utility/routeState";

type Search = Record<string, string | string[] | undefined>;

export default async function MobileMeBagPage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const raw = (await Promise.resolve(searchParams)) || {};
  const routeState = parseMobileUtilityRouteState(raw);
  const showReturnAction = hasMobileUtilityRouteContext(routeState);
  const returnHref = resolveMobileUtilityReturnHref(routeState);
  const returnLabel = describeMobileUtilityReturnLabel(routeState);

  return (
    <section className="space-y-3">
      {showReturnAction ? (
        <Link
          href={returnHref}
          className="m-pressable inline-flex h-9 items-center rounded-full border border-black/12 bg-white/82 px-4 text-[12px] font-semibold text-black/72 active:bg-black/[0.03]"
        >
          {returnLabel}
        </Link>
      ) : null}
      <MobileBagPanel routeState={routeState} />
    </section>
  );
}
