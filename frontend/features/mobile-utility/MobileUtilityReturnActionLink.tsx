import Link from "next/link";
import {
  resolveMobileUtilityReturnAction,
  type MobileUtilityRouteState,
} from "@/features/mobile-utility/routeState";

const DEFAULT_CLASS_NAME =
  "m-pressable inline-flex h-9 items-center rounded-full border border-black/12 bg-white/82 px-4 text-[12px] font-semibold text-black/72 active:bg-black/[0.03]";

type Props = {
  routeState: MobileUtilityRouteState;
  className?: string;
};

export default function MobileUtilityReturnActionLink({
  routeState,
  className = DEFAULT_CLASS_NAME,
}: Props) {
  const action = resolveMobileUtilityReturnAction(routeState);
  if (!action) return null;
  return <Link href={action.href} className={className}>{action.label}</Link>;
}
