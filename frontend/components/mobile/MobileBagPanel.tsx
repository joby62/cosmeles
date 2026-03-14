"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { deleteMobileBagItem, fetchMobileBagItems, resolveImageUrl, type MobileBagItem } from "@/lib/api";
import {
  appendMobileUtilityRouteState,
  type MobileUtilityRouteState,
} from "@/features/mobile-utility/routeState";
import {
  describeDecisionContinuationAction,
  describeDecisionContinuationSurface,
} from "@/features/mobile-utility/decisionContinuationCopy";
import { useMobileUtilityContinuationLinks } from "@/features/mobile-utility/useMobileUtilityContinuationLinks";

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

function categoryTag(level: string): string {
  if (level === "subcategory") return "细分类";
  if (level === "category") return "一级类目";
  return "待映射";
}

type Props = {
  routeState?: MobileUtilityRouteState | null;
};

export default function MobileBagPanel({ routeState = null }: Props) {
  const [items, setItems] = useState<MobileBagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const continuationLinks = useMobileUtilityContinuationLinks({
    routeState,
    sourceFallback: "m_me_bag",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetchMobileBagItems({ limit: 120, offset: 0 });
      setItems(resp.items || []);
      setTotalQuantity(resp.total_quantity || 0);
    } catch (err) {
      setItems([]);
      setTotalQuantity(0);
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
      <h1 className="text-[30px] leading-[1.12] font-semibold tracking-[-0.02em] text-black/90">购物袋</h1>
      <p className="mt-3 text-[15px] leading-[1.55] text-black/60">
        当前设备共 {items.length} 件，累计数量 {totalQuantity}，{describeDecisionContinuationSurface("bag")}
      </p>

      <div className="mt-6 space-y-3">
        {loading ? (
          <article className="rounded-2xl border border-black/10 bg-white px-4 py-4 text-[14px] text-black/55">
            正在加载购物袋...
          </article>
        ) : null}

        {error ? (
          <article className="rounded-2xl border border-[#ff8f8f]/45 bg-[#ff5f5f]/10 px-4 py-4 text-[13px] leading-[1.55] text-[#b53a3a]">
            购物袋加载失败：{error}
          </article>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <article className="rounded-2xl border border-black/10 bg-white px-4 py-4 text-[14px] text-black/55">
            购物袋为空。可在产品百科中点击“加入购物袋”。
          </article>
        ) : null}

        {!loading && !error
          ? items.map((item) => {
              const p = item.product;
              const continuation = continuationLinks.resolveByCategory(p.category);
              return (
                <article key={item.item_id} className="overflow-hidden rounded-[24px] border border-black/10 bg-white">
                  <div className="flex gap-3 p-3">
                    <Link
                      href={appendMobileUtilityRouteState(`/m/wiki/product/${encodeURIComponent(p.id)}`, routeState)}
                      className="relative h-[84px] w-[84px] shrink-0 overflow-hidden rounded-xl bg-[#f4f5f9]"
                    >
                      <Image src={p.image_url ? resolveImageUrl(p) : `/images/${p.id}.png`} alt={p.name || p.id} fill sizes="84px" className="object-cover" />
                    </Link>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-full bg-black/[0.06] px-2.5 py-0.5 text-[11px] text-black/68">{categoryTag(item.target_type_level)}</span>
                        <span className="text-[11px] text-black/45">{formatTime(item.updated_at)}</span>
                      </div>
                      <h2 className="mt-1 line-clamp-2 text-[16px] leading-[1.35] font-semibold text-black/88">
                        {p.name || "未命名产品"}
                      </h2>
                      <p className="mt-1 text-[12px] text-black/58">{p.brand || "品牌未识别"}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {item.target_type_title ? (
                          <span className="rounded-full border border-[#cfe2ff] bg-[#f4f8ff] px-2.5 py-0.5 text-[11px] text-[#244f9e]">
                            {item.target_type_title}
                          </span>
                        ) : null}
                        {item.is_featured ? (
                          <span className="rounded-full border border-[#1f7a45]/35 bg-[#eaf8ef] px-2.5 py-0.5 text-[11px] text-[#116a3f]">
                            当前主推
                          </span>
                        ) : null}
                        <span className="rounded-full border border-black/10 bg-black/[0.02] px-2.5 py-0.5 text-[11px] text-black/62">
                          数量 x{item.quantity}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex border-t border-black/8 px-3 py-2">
                    <Link
                      href={continuation.href}
                      className="inline-flex h-8 items-center rounded-full border border-[#0071e3]/28 bg-[#0071e3]/10 px-3 text-[12px] font-semibold text-[#005fbf] active:bg-[#0071e3]/15"
                    >
                      {describeDecisionContinuationAction(continuation.action)}
                    </Link>
                    <Link
                      href={appendMobileUtilityRouteState(`/m/wiki/product/${encodeURIComponent(p.id)}`, routeState)}
                      className="ml-2 inline-flex h-8 items-center rounded-full border border-black/12 px-3 text-[12px] font-medium text-black/74 active:bg-black/[0.03]"
                    >
                      查看详情
                    </Link>
                    <button
                      type="button"
                      disabled={busyId === item.item_id}
                      onClick={async () => {
                        setBusyId(item.item_id);
                        setError(null);
                        try {
                          await deleteMobileBagItem(item.item_id);
                          setItems((prev) => prev.filter((x) => x.item_id !== item.item_id));
                          setTotalQuantity((prev) => Math.max(0, prev - Math.max(1, item.quantity)));
                        } catch (err) {
                          setError(err instanceof Error ? err.message : String(err));
                        } finally {
                          setBusyId(null);
                        }
                      }}
                      className="ml-auto inline-flex h-8 items-center rounded-full border border-[#ff3b30]/30 bg-[#fff5f4] px-3 text-[12px] font-medium text-[#c23d36] disabled:opacity-55"
                    >
                      {busyId === item.item_id ? "删除中..." : "移出购物袋"}
                    </button>
                  </div>
                </article>
              );
            })
          : null}
      </div>
    </section>
  );
}
