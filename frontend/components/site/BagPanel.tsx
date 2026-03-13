"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { deleteMobileBagItem, fetchMobileBagItems, resolveImageUrl, type MobileBagItem } from "@/lib/api";
import {
  commerceBadgeLabel,
  commerceInventoryLabel,
  commerceMissingFieldsLabel,
  commercePackSizeLabel,
  commercePriceLabel,
  commerceShippingEtaLabel,
} from "@/lib/productCommerce";

export default function BagPanel() {
  const [items, setItems] = useState<MobileBagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchMobileBagItems({ limit: 120, offset: 0 });
      setItems(response.items || []);
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
    <div className="space-y-4">
      {loading ? (
        <article className="rounded-[28px] border border-black/8 bg-white/92 px-5 py-5 text-[15px] text-slate-600">
          正在加载袋中内容...
        </article>
      ) : null}

      {error ? (
        <article className="rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-5 text-[14px] leading-6 text-rose-700">
          袋中加载失败：{error}
        </article>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <article className="rounded-[28px] border border-black/8 bg-white/92 px-5 py-5 text-[15px] leading-6 text-slate-600">
          你的袋中还是空的。可以先从商品画像页开始，把想回看的商品先存起来。
        </article>
      ) : null}

      {!loading && !error
        ? items.map((item) => {
          const product = item.product;
          const productName = product.name || "未命名商品";
          const productBrand = product.brand || "Jeslect";
            const packSizeLabel = commercePackSizeLabel(product.commerce);
            const statusLabel = commerceBadgeLabel(product.commerce);
            const priceLabel = commercePriceLabel(product.commerce);
            const inventoryLabel = commerceInventoryLabel(product.commerce);
            const shippingEtaLabel = commerceShippingEtaLabel(product.commerce);
            return (
              <article
                key={item.item_id}
                className="overflow-hidden rounded-[28px] border border-black/8 bg-white/94 shadow-[0_18px_44px_rgba(15,23,42,0.06)]"
              >
                <div className="flex flex-col gap-4 p-4 sm:flex-row">
                  <Link
                    href={`/product/${encodeURIComponent(product.id)}`}
                    className="relative block aspect-square overflow-hidden rounded-[22px] bg-[linear-gradient(180deg,#f8fbff_0%,#edf4fb_100%)] sm:h-[132px] sm:w-[132px] sm:shrink-0"
                  >
                    <Image
                      src={resolveImageUrl(product)}
                      alt={productName}
                      fill
                      sizes="132px"
                      className="object-cover"
                    />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-black/8 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                        数量 {item.quantity}
                      </span>
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700">
                        {statusLabel}
                      </span>
                      {packSizeLabel ? (
                        <span className="rounded-full border border-black/8 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                          {packSizeLabel}
                        </span>
                      ) : null}
                      {item.target_type_title ? (
                        <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700">
                          {item.target_type_title}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-4 text-[12px] font-medium uppercase tracking-[0.18em] text-slate-500">{productBrand}</p>
                    <h2 className="mt-2 text-[24px] font-semibold leading-[1.1] tracking-[-0.03em] text-slate-950">
                      {productName}
                    </h2>
                    <p className="mt-3 text-[14px] leading-6 text-slate-600">
                      {product.one_sentence || "打开完整商品画像页，查看成分和使用情境。"}
                    </p>
                    {priceLabel || inventoryLabel || shippingEtaLabel ? (
                      <div className="mt-3 rounded-[20px] border border-black/8 bg-slate-50 px-4 py-3">
                        {priceLabel ? <div className="text-[18px] font-semibold tracking-[-0.03em] text-slate-950">{priceLabel}</div> : null}
                        <div className="mt-1 flex flex-wrap gap-2">
                          {inventoryLabel ? (
                            <span className="rounded-full border border-black/8 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">{inventoryLabel}</span>
                          ) : null}
                          {shippingEtaLabel ? (
                            <span className="rounded-full border border-black/8 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">{shippingEtaLabel}</span>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    <p className="mt-2 text-[13px] leading-6 text-slate-500">{commerceMissingFieldsLabel(product.commerce)}</p>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <Link
                        href={`/product/${encodeURIComponent(product.id)}`}
                        className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-medium text-slate-700"
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
                            setItems((current) => current.filter((entry) => entry.item_id !== item.item_id));
                          } catch (err) {
                            setError(err instanceof Error ? err.message : String(err));
                          } finally {
                            setBusyId(null);
                          }
                        }}
                        className="inline-flex h-10 items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-4 text-[13px] font-medium text-rose-700 disabled:opacity-60"
                      >
                        {busyId === item.item_id ? "移除中..." : "移除"}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        : null}
    </div>
  );
}
