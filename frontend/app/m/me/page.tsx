"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  deleteMobileSelectionSessionsBatch,
  listMobileSelectionSessions,
  type MobileSelectionResolveResponse,
} from "@/lib/api";

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
  const [deleting, setDeleting] = useState(false);
  const [managing, setManaging] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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

  const toggleSelected = useCallback((sessionId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(sessionId)) return prev.filter((id) => id !== sessionId);
      return [...prev, sessionId];
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.length === entries.length) return [];
      return entries.map((item) => item.session_id);
    });
  }, [entries]);

  const deleteSelected = useCallback(async () => {
    if (selectedIds.length === 0) return;
    try {
      setDeleting(true);
      setError(null);
      const result = await deleteMobileSelectionSessionsBatch({ ids: selectedIds });
      if (result.forbidden_ids.length > 0) {
        setError(`有 ${result.forbidden_ids.length} 条记录不属于当前设备，未删除。`);
      }
      setSelectedIds([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  }, [load, selectedIds]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const valid = new Set(entries.map((item) => item.session_id));
      return prev.filter((id) => valid.has(id));
    });
  }, [entries]);

  const allSelected = entries.length > 0 && selectedIds.length === entries.length;

  return (
    <section className="pb-10">
      <h1 className="text-[30px] leading-[1.12] font-semibold tracking-[-0.02em] text-black/90">我的</h1>
      <p className="mt-3 text-[15px] leading-[1.55] text-black/60">这里展示当前设备的真实决策记录，可多选删除。</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            void load();
          }}
          disabled={loading || deleting}
          className="inline-flex h-9 items-center rounded-full border border-black/15 px-4 text-[13px] font-medium text-black/72 active:bg-black/[0.04]"
        >
          {loading ? "刷新中..." : "刷新记录"}
        </button>
        <button
          type="button"
          onClick={() => {
            setManaging((prev) => !prev);
            setSelectedIds([]);
          }}
          disabled={loading || deleting || entries.length === 0}
          className="inline-flex h-9 items-center rounded-full border border-black/15 px-4 text-[13px] font-medium text-black/72 disabled:opacity-50 active:bg-black/[0.04]"
        >
          {managing ? "完成管理" : "管理记录"}
        </button>
        {managing && (
          <>
            <button
              type="button"
              onClick={toggleSelectAll}
              disabled={deleting || entries.length === 0}
              className="inline-flex h-9 items-center rounded-full border border-black/15 px-4 text-[13px] font-medium text-black/72 disabled:opacity-50 active:bg-black/[0.04]"
            >
              {allSelected ? "取消全选" : "全选"}
            </button>
            <button
              type="button"
              onClick={() => {
                void deleteSelected();
              }}
              disabled={deleting || selectedIds.length === 0}
              className="inline-flex h-9 items-center rounded-full border border-[#d96f6f]/40 bg-[#ff5f5f]/10 px-4 text-[13px] font-medium text-[#b53a3a] disabled:opacity-50 active:bg-[#ff5f5f]/15"
            >
              {deleting ? "删除中..." : `删除已选 (${selectedIds.length})`}
            </button>
          </>
        )}
      </div>

      {managing && (
        <div className="mt-3 text-[12px] text-black/45">
          管理模式下可多选并删除当前设备的历史记录。
        </div>
      )}

      <div className="mt-6 space-y-3">
        {loading && (
          <div className="rounded-2xl border border-black/10 bg-white px-4 py-4 text-[14px] text-black/55">
            正在加载后端会话记录...
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-[#ff8f8f]/45 bg-[#ff5f5f]/10 px-4 py-4 text-[14px] text-[#b53a3a]">
            操作失败：{error}
          </div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="rounded-2xl border border-black/10 bg-white px-4 py-4 text-[14px] text-black/55">
            还没有后端记录。完成一次“开始选择”后会自动落库。
          </div>
        )}

        {!loading && entries.map((entry) => {
          const product = entry.recommended_product;
          const checked = selectedIds.includes(entry.session_id);
          return (
            <article
              key={entry.session_id}
              className={`rounded-2xl border bg-white px-4 py-4 ${
                checked ? "border-[#6f9dff]/60 ring-2 ring-[#6f9dff]/20" : "border-black/10"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex h-7 items-center rounded-full bg-black/[0.06] px-3 text-[12px] text-black/72">
                  {entry.category} · {entry.route.title}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-black/45">{formatTime(entry.created_at)}</span>
                  {managing && (
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelected(entry.session_id)}
                      className="h-4 w-4 accent-[#5b8cff]"
                      aria-label={`选择记录 ${entry.session_id}`}
                    />
                  )}
                </div>
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
