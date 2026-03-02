"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Product,
  ProductDedupSuggestResponse,
  deleteProductsBatch,
  resolveImageUrl,
  suggestProductDuplicates,
} from "@/lib/api";

export default function ProductDedupManager({ initialProducts }: { initialProducts: Product[] }) {
  const router = useRouter();
  const [titleQuery, setTitleQuery] = useState("");
  const [ingredientHints, setIngredientHints] = useState("");
  const [scanning, setScanning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ProductDedupSuggestResponse | null>(null);
  const [selectedRemoveIds, setSelectedRemoveIds] = useState<string[]>([]);
  const [deleteSummary, setDeleteSummary] = useState<string | null>(null);

  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    for (const item of initialProducts) map.set(item.id, item);
    for (const item of report?.involved_products || []) map.set(item.id, item);
    return map;
  }, [initialProducts, report?.involved_products]);

  const keepIds = useMemo(() => {
    return new Set((report?.suggestions || []).map((item) => item.keep_id));
  }, [report?.suggestions]);

  async function runDedupScan() {
    setScanning(true);
    setError(null);
    setDeleteSummary(null);
    try {
      const hints = Array.from(
        new Set(
          ingredientHints
            .split(/[\n,，]/g)
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      );
      const result = await suggestProductDuplicates({
        title_query: titleQuery.trim() || undefined,
        ingredient_hints: hints,
        max_scan_products: 120,
        max_compare_per_product: 6,
        min_confidence: 70,
      });
      setReport(result);
      setSelectedRemoveIds(Array.from(new Set(result.suggestions.flatMap((item) => item.remove_ids))));
    } catch (err) {
      setError(err instanceof Error ? err.message : "重复检查失败，请稍后重试。");
    } finally {
      setScanning(false);
    }
  }

  function toggleRemove(productId: string, checked: boolean) {
    setSelectedRemoveIds((prev) => {
      if (checked) return Array.from(new Set([...prev, productId]));
      return prev.filter((id) => id !== productId);
    });
  }

  async function confirmDelete() {
    if (selectedRemoveIds.length === 0) {
      setDeleteSummary("当前没有勾选待删除产品。");
      return;
    }
    setDeleting(true);
    setError(null);
    setDeleteSummary(null);
    try {
      const result = await deleteProductsBatch({
        ids: selectedRemoveIds,
        keep_ids: Array.from(keepIds),
        remove_doubao_artifacts: true,
      });
      setDeleteSummary(
        `删除完成：${result.deleted_ids.length} 条，跳过 ${result.skipped_ids.length} 条，缺失 ${result.missing_ids.length} 条。`,
      );
      setSelectedRemoveIds([]);
      setReport(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败，请稍后重试。");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1180px] px-6 py-10">
      <section className="rounded-[30px] border border-black/10 bg-gradient-to-br from-[#f8fbff] via-white to-[#f2f8f1] p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/product" className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/70 hover:bg-black/[0.03]">
            返回产品列表
          </Link>
          <span className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/62">
            使用模型：doubao-seed-2-0-pro（高级文本能力）
          </span>
        </div>
        <h1 className="mt-3 text-[34px] font-semibold tracking-[-0.02em] text-black/90">产品重复检查与删除</h1>
        <p className="mt-2 text-[14px] leading-[1.6] text-black/65">
          支持按标题关键词和成分关键词筛选候选产品。系统会先调用豆包分析重合组并预勾选建议删除项，你可以取消勾选后再确认删除。
        </p>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-black/70">标题关键词（可选）</span>
            <input
              value={titleQuery}
              onChange={(e) => setTitleQuery(e.target.value)}
              placeholder="例如：DOVE DEEP MOISTURE"
              className="h-10 rounded-xl border border-black/12 bg-white px-3 text-[13px] outline-none focus:border-black/35"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-black/70">成分关键词（可选，逗号或换行分隔）</span>
            <textarea
              value={ingredientHints}
              onChange={(e) => setIngredientHints(e.target.value)}
              placeholder="例如：烟酰胺, 椰油酰胺丙基甜菜碱"
              rows={2}
              className="rounded-xl border border-black/12 bg-white px-3 py-2 text-[13px] outline-none focus:border-black/35"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={runDedupScan}
            disabled={scanning}
            className="inline-flex h-10 items-center justify-center rounded-full bg-black px-5 text-[13px] font-semibold text-white disabled:bg-black/25"
          >
            {scanning ? "豆包分析中..." : "开始重复检查"}
          </button>
          <button
            type="button"
            onClick={confirmDelete}
            disabled={deleting || selectedRemoveIds.length === 0}
            className="inline-flex h-10 items-center justify-center rounded-full border border-[#ef4444]/40 bg-[#fff5f5] px-5 text-[13px] font-semibold text-[#b42318] disabled:opacity-50"
          >
            {deleting ? "删除中..." : `确认删除 (${selectedRemoveIds.length})`}
          </button>
        </div>

        {error ? <div className="mt-3 text-[13px] text-[#b42318]">{error}</div> : null}
        {deleteSummary ? <div className="mt-3 text-[13px] text-[#116a3f]">{deleteSummary}</div> : null}
      </section>

      {report ? (
        <section className="mt-6 space-y-4">
          <div className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-[13px] text-black/70">
            扫描产品：{report.scanned_products}，发现重合组：{report.suggestions.length}
            {report.failures.length > 0 ? `，失败任务：${report.failures.length}` : ""}
          </div>

          {report.suggestions.map((group) => {
            const keep = productMap.get(group.keep_id);
            return (
              <article key={group.group_id} className="rounded-[24px] border border-black/10 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[14px] font-semibold text-black/84">
                    {group.group_id} · 保留 1 条 / 建议删除 {group.remove_ids.length} 条
                  </div>
                  <span className="rounded-full bg-[#fff4e6] px-2.5 py-0.5 text-[11px] font-medium text-[#9b5a00]">
                    置信度 {group.confidence}
                  </span>
                </div>
                {group.reason ? <p className="mt-1 text-[12px] text-black/64">{group.reason}</p> : null}

                <div className="mt-3 rounded-xl border border-[#d8f1e3] bg-[#f4fbf7] p-3">
                  <div className="text-[11px] font-semibold text-[#116a3f]">保留产品</div>
                  <ProductRow product={keep} />
                </div>

                <div className="mt-3 rounded-xl border border-black/10 bg-[#fbfcff] p-3">
                  <div className="text-[11px] font-semibold text-black/72">建议删除（可取消勾选）</div>
                  <div className="mt-2 space-y-2">
                    {group.remove_ids.map((pid) => {
                      const product = productMap.get(pid);
                      const checked = selectedRemoveIds.includes(pid);
                      return (
                        <label key={pid} className="flex items-start gap-2 rounded-lg border border-black/10 bg-white p-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => toggleRemove(pid, e.target.checked)}
                            className="mt-1 h-4 w-4"
                          />
                          <div className="min-w-0 flex-1">
                            <ProductRow product={product} />
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {group.analysis_text ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-[12px] font-medium text-black/76">豆包分析原文</summary>
                    <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap rounded-xl border border-black/10 bg-[#f8fafc] p-2 text-[12px] leading-[1.5] text-black/70">
                      {group.analysis_text}
                    </pre>
                  </details>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : null}
    </main>
  );
}

function ProductRow({ product }: { product?: Product }) {
  if (!product) {
    return <div className="text-[12px] text-black/45">产品信息缺失</div>;
  }
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-14 w-14 overflow-hidden rounded-lg border border-black/10 bg-black/[0.03]">
        <Image src={resolveImageUrl(product)} alt={product.name || product.id} fill className="object-cover" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold text-black/85">{product.name || "未命名产品"}</div>
        <div className="truncate text-[12px] text-black/62">{product.brand || "品牌未识别"}</div>
        <div className="truncate text-[11px] text-black/44">ID: {product.id}</div>
      </div>
    </div>
  );
}
