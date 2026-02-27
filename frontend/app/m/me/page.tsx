"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { clearPickHistory, readPickHistory, type PickHistoryEntry } from "@/lib/mobile/pickHistory";

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MobileMePage() {
  const entries = useSyncExternalStore(
    // localStorage has no native event in same tab for set/remove by current page,
    // so we manually trigger a synthetic event after writes below.
    (onStoreChange) => {
      const handler = () => onStoreChange();
      window.addEventListener("matchup-history-change", handler);
      window.addEventListener("storage", handler);
      return () => {
        window.removeEventListener("matchup-history-change", handler);
        window.removeEventListener("storage", handler);
      };
    },
    () => readPickHistory(),
    () => [] as PickHistoryEntry[],
  );

  const handleClear = () => {
    clearPickHistory();
  };

  return (
    <section className="pb-10">
      <h1 className="text-[30px] leading-[1.12] font-semibold tracking-[-0.02em] text-black/90">我的</h1>
      <p className="mt-3 text-[15px] leading-[1.55] text-black/60">这里会记录你刚完成挑选时的选项和最终结果卡。</p>

      {entries.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          className="mt-4 inline-flex h-9 items-center rounded-full border border-black/15 px-4 text-[13px] font-medium text-black/72 active:bg-black/[0.04]"
        >
          清空记录
        </button>
      )}

      <div className="mt-6 space-y-3">
        {entries.length === 0 && (
          <div className="rounded-2xl border border-black/10 bg-white px-4 py-4 text-[14px] text-black/55">
            还没有历史记录。完成一次“开始选择”后，结果会自动出现在这里。
          </div>
        )}

        {entries.map((entry) => (
          <article key={entry.id} className="rounded-2xl border border-black/10 bg-white px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex h-7 items-center rounded-full bg-black/[0.06] px-3 text-[12px] text-black/72">
                {entry.categoryLabel}
              </span>
              <span className="text-[12px] text-black/45">{formatTime(entry.createdAt)}</span>
            </div>

            <h2 className="mt-3 text-[17px] font-semibold leading-[1.35] text-black/88">{entry.resultTitle}</h2>
            <p className="mt-2 text-[13px] leading-[1.5] text-black/60">{entry.resultSummary}</p>

            <div className="mt-3 flex flex-wrap gap-2">
              {entry.signals.slice(0, 3).map((line) => (
                <span
                  key={`${entry.id}-${line}`}
                  className="inline-flex max-w-full items-center rounded-full bg-black/[0.04] px-3 py-1 text-[12px] text-black/62"
                >
                  {line}
                </span>
              ))}
            </div>

            <div className="mt-4">
              <Link
                href={entry.resultHref}
                className="inline-flex h-9 items-center rounded-full border border-black/15 px-4 text-[13px] font-medium text-black/78 active:bg-black/[0.03]"
              >
                查看当时结果卡
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
