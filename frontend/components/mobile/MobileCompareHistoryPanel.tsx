"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { listMobileCompareSessions, type MobileCompareSession } from "@/lib/api";

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function decisionLabel(decision?: string | null): string {
  if (decision === "keep") return "继续用";
  if (decision === "switch") return "建议换";
  if (decision === "hybrid") return "分场景";
  return "进行中";
}

export default function MobileCompareHistoryPanel() {
  const [items, setItems] = useState<MobileCompareSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sessions = await listMobileCompareSessions({ limit: 80, offset: 0 });
      setItems(sessions);
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="pb-28">
      <h1 className="text-[30px] leading-[1.12] font-semibold tracking-[-0.02em] text-black/90">历史对比</h1>
      <p className="mt-3 text-[15px] leading-[1.55] text-black/60">这里展示当前设备完成过的横向对比记录。</p>

      <div className="mt-6 space-y-3">
        {loading ? (
          <article className="rounded-2xl border border-black/10 bg-white px-4 py-4 text-[14px] text-black/55">
            正在加载对比记录...
          </article>
        ) : null}

        {error ? (
          <article className="rounded-2xl border border-[#ff8f8f]/45 bg-[#ff5f5f]/10 px-4 py-4 text-[13px] leading-[1.55] text-[#b53a3a]">
            对比记录加载失败：{error}
          </article>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <article className="rounded-2xl border border-black/10 bg-white px-4 py-4 text-[14px] text-black/55">
            还没有对比记录。先去 VS 对比完成一次分析。
          </article>
        ) : null}

        {!loading && !error
          ? items.map((item) => (
              <article key={item.compare_id} className="rounded-[24px] border border-black/10 bg-white px-4 py-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex h-7 items-center rounded-full bg-black/[0.06] px-3 text-[12px] text-black/72">
                    {item.category} · {item.status}
                  </span>
                  <span className="text-[12px] text-black/45">{formatTime(item.updated_at)}</span>
                </div>
                <h2 className="mt-3 text-[16px] leading-[1.35] font-semibold text-black/88">
                  {item.result?.headline || item.message || "对比进行中"}
                </h2>
                <p className="mt-2 text-[13px] text-black/60">
                  结论：{decisionLabel(item.result?.decision)} · 置信度 {Math.round((item.result?.confidence || 0) * 100)}%
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/m/compare/result/${encodeURIComponent(item.compare_id)}`}
                    className="inline-flex h-9 items-center rounded-full border border-black/15 px-4 text-[13px] font-medium text-black/78 active:bg-black/[0.03]"
                  >
                    查看结果
                  </Link>
                  <Link
                    href={`/m/compare?category=${encodeURIComponent(String(item.category || ""))}`}
                    className="inline-flex h-9 items-center rounded-full border border-black/15 px-4 text-[13px] font-medium text-black/78 active:bg-black/[0.03]"
                  >
                    再做一次
                  </Link>
                </div>
              </article>
            ))
          : null}
      </div>
    </section>
  );
}
