"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { listMobileSelectionSessions, type MobileSelectionResolveResponse } from "@/lib/api";

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
  const [entries, setEntries] = useState<MobileSelectionResolveResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listMobileSelectionSessions({ limit: 40 });
      setEntries(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="pb-10">
      <h1 className="text-[30px] leading-[1.12] font-semibold tracking-[-0.02em] text-black/90">我的</h1>
      <p className="mt-3 text-[15px] leading-[1.55] text-black/60">这里展示后端记录的真实决策会话，跨设备也可复用。</p>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => {
            void load();
          }}
          className="inline-flex h-9 items-center rounded-full border border-black/15 px-4 text-[13px] font-medium text-black/72 active:bg-black/[0.04]"
        >
          刷新记录
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {loading && (
          <div className="rounded-2xl border border-black/10 bg-white px-4 py-4 text-[14px] text-black/55">
            正在加载后端会话记录...
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-[#ff8f8f]/45 bg-[#ff5f5f]/10 px-4 py-4 text-[14px] text-[#b53a3a]">
            加载失败：{error}
          </div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="rounded-2xl border border-black/10 bg-white px-4 py-4 text-[14px] text-black/55">
            还没有后端记录。完成一次“开始选择”后会自动落库。
          </div>
        )}

        {!loading && !error && entries.map((entry) => {
          const product = entry.recommended_product;
          return (
            <article key={entry.session_id} className="rounded-2xl border border-black/10 bg-white px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex h-7 items-center rounded-full bg-black/[0.06] px-3 text-[12px] text-black/72">
                  {entry.category} · {entry.route.title}
                </span>
                <span className="text-[12px] text-black/45">{formatTime(entry.created_at)}</span>
              </div>

              <h2 className="mt-3 text-[17px] font-semibold leading-[1.35] text-black/88">
                {product.brand || "未知品牌"} {product.name || "未命名产品"}
              </h2>
              <p className="mt-2 text-[13px] leading-[1.5] text-black/60">
                route={entry.route.key} · rules={entry.rules_version}{entry.reused ? " · reused" : ""}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {entry.choices.slice(0, 3).map((item) => (
                  <span
                    key={`${entry.session_id}-${item.key}-${item.value}`}
                    className="inline-flex max-w-full items-center rounded-full bg-black/[0.04] px-3 py-1 text-[12px] text-black/62"
                  >
                    {item.key} {item.value} · {item.label}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={entry.links.product}
                  className="inline-flex h-9 items-center rounded-full border border-black/15 px-4 text-[13px] font-medium text-black/78 active:bg-black/[0.03]"
                >
                  查看产品
                </Link>
                <Link
                  href={entry.links.wiki}
                  className="inline-flex h-9 items-center rounded-full border border-black/15 px-4 text-[13px] font-medium text-black/78 active:bg-black/[0.03]"
                >
                  查看成份
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
