import Link from "next/link";
import { redirect } from "next/navigation";
import MobileCompareHistoryPanel from "@/components/mobile/MobileCompareHistoryPanel";
import MobileSelectionHistoryPanel from "@/components/mobile/MobileSelectionHistoryPanel";
import MobileUtilityReturnActionLink from "@/features/mobile-utility/MobileUtilityReturnActionLink";
import {
  normalizeMobileMeHistoryTab,
  pickMobileMeTab,
  resolveMobileMeHistoryRedirectPath,
  type MobileMeHistoryTab,
} from "@/features/mobile-utility/meRouteIntent";
import {
  appendMobileUtilityRouteState,
  parseMobileUtilityRouteState,
} from "@/features/mobile-utility/routeState";

type Search = Record<string, string | string[] | undefined>;

const TAB_META: Array<{ key: MobileMeHistoryTab; label: string }> = [
  { key: "selection", label: "历史选择" },
  { key: "compare", label: "历史对比" },
];

export default async function MobileMeHistoryPage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const raw = (await Promise.resolve(searchParams)) || {};
  const queryTab = pickMobileMeTab(raw.tab);
  const routeState = parseMobileUtilityRouteState(raw);
  const redirectPath = resolveMobileMeHistoryRedirectPath(queryTab);

  if (redirectPath) {
    redirect(appendMobileUtilityRouteState(redirectPath, routeState));
  }

  const activeTab = normalizeMobileMeHistoryTab(queryTab);

  return (
    <section className="pb-4">
      <MobileUtilityReturnActionLink
        routeState={routeState}
        className="m-pressable mb-3 inline-flex h-9 items-center rounded-full border border-black/12 bg-white/82 px-4 text-[12px] font-semibold text-black/72 active:bg-black/[0.03]"
      />
      <div className="sticky top-[48px] z-20 -mx-4 border-b border-black/8 bg-[color:var(--m-bg)] px-4 py-3 backdrop-blur">
        <div className="grid grid-cols-2 gap-2">
          {TAB_META.map((tab) => {
            const active = tab.key === activeTab;
            return (
              <Link
                key={tab.key}
                href={appendMobileUtilityRouteState(`/m/me/history?tab=${tab.key}`, routeState)}
                scroll={false}
                className={`m-pressable inline-flex h-9 items-center justify-center rounded-2xl border text-[13px] font-semibold ${
                  active
                    ? "border-[#0071e3]/32 bg-[#0071e3]/12 text-[#0071e3]"
                    : "border-black/10 bg-white/86 text-black/62 active:bg-black/[0.03] dark:border-white/15 dark:bg-white/[0.04] dark:text-white/72"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="pt-4">
        {activeTab === "compare" ? (
          <MobileCompareHistoryPanel routeState={routeState} />
        ) : (
          <MobileSelectionHistoryPanel routeState={routeState} />
        )}
      </div>
    </section>
  );
}
