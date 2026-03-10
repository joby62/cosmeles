"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import MobileCompareHistoryPanel from "@/components/mobile/MobileCompareHistoryPanel";
import MobileSelectionHistoryPanel from "@/components/mobile/MobileSelectionHistoryPanel";

type MeTab = "selection" | "compare";

const TAB_META: Array<{ key: MeTab; label: string }> = [
  { key: "selection", label: "历史选择" },
  { key: "compare", label: "历史对比" },
];

function normalizeTab(raw: string | null | undefined): MeTab {
  if (raw === "compare") return "compare";
  return "selection";
}

export default function MobileMePage() {
  const pathname = usePathname();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<MeTab>("selection");

  useEffect(() => {
    const applyFromLocation = () => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "bag") {
        router.replace("/m/bag");
        return;
      }
      setActiveTab(normalizeTab(tab));
    };
    applyFromLocation();
    window.addEventListener("popstate", applyFromLocation);
    return () => {
      window.removeEventListener("popstate", applyFromLocation);
    };
  }, [router]);

  const renderPanel = () => {
    if (activeTab === "compare") return <MobileCompareHistoryPanel />;
    return <MobileSelectionHistoryPanel />;
  };

  return (
    <section className="pb-4">
      <div className="sticky top-[48px] z-20 -mx-4 border-b border-black/8 bg-[color:var(--m-bg)] px-4 py-3 backdrop-blur">
        <div className="grid grid-cols-2 gap-2">
          {TAB_META.map((tab) => {
            const active = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  router.replace(`${pathname}?tab=${tab.key}`);
                }}
                className={`m-pressable h-9 rounded-2xl border text-[13px] font-semibold ${
                  active
                    ? "border-black bg-black text-white"
                    : "border-black/10 bg-white text-black/68 active:bg-black/[0.03]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-4">{renderPanel()}</div>
    </section>
  );
}
