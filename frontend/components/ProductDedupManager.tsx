"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Product,
  ProductDedupSuggestResponse,
  SSEEvent,
  deleteProductsBatch,
  resolveImageUrl,
  suggestProductDuplicatesStream,
} from "@/lib/api";
import { CATEGORY_CONFIG } from "@/lib/catalog";

const AUTO_SELECT_CONFIDENCE_GT = 95;
const MIN_CONFIDENCE_FOR_API = AUTO_SELECT_CONFIDENCE_GT + 1;

export default function ProductDedupManager({
  initialProducts,
  showBackLink = false,
}: {
  initialProducts: Product[];
  showBackLink?: boolean;
}) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [scanning, setScanning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ProductDedupSuggestResponse | null>(null);
  const [selectedRemoveIds, setSelectedRemoveIds] = useState<string[]>([]);
  const [deleteSummary, setDeleteSummary] = useState<string | null>(null);
  const [streamRawText, setStreamRawText] = useState("");
  const [streamPrettyText, setStreamPrettyText] = useState("");
  const [progressHint, setProgressHint] = useState<string>("");
  const streamQueueRef = useRef<string[]>([]);
  const streamTimerRef = useRef<number | null>(null);

  const categoryStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of initialProducts) {
      const key = (item.category || "unknown").trim().toLowerCase();
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [initialProducts]);

  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    for (const item of initialProducts) map.set(item.id, item);
    for (const item of report?.involved_products || []) map.set(item.id, item);
    return map;
  }, [initialProducts, report?.involved_products]);

  const keepIds = useMemo(() => {
    return new Set((report?.suggestions || []).map((item) => item.keep_id));
  }, [report?.suggestions]);

  useEffect(() => {
    return () => {
      stopRawTextDrainer();
      streamQueueRef.current = [];
    };
  }, []);

  async function runDedupScan() {
    setScanning(true);
    setError(null);
    setDeleteSummary(null);
    setReport(null);
    setSelectedRemoveIds([]);
    setStreamRawText("");
    setStreamPrettyText("");
    setProgressHint("准备开始同品类两两分析...");
    streamQueueRef.current = [];
    stopRawTextDrainer();

    try {
      const maxScanProducts = Math.max(1, Math.min(500, initialProducts.length || 1));
      const result = await suggestProductDuplicatesStream(
        {
          category: selectedCategory || undefined,
          max_scan_products: maxScanProducts,
          compare_batch_size: 20,
          min_confidence: MIN_CONFIDENCE_FOR_API,
        },
        (event) => onStreamEvent(event),
      );

      setReport(result);
      setSelectedRemoveIds(Array.from(new Set(result.suggestions.flatMap((item) => item.remove_ids))));
      setStreamPrettyText(buildPrettySummary(result));
      setStreamRawText((prev) => (prev.trim() ? prev : collectAnalysisText(result)));
      setProgressHint(
        result.suggestions.length > 0
          ? `分析完成：发现 ${result.suggestions.length} 组高重合，已自动勾选待删除 trace_id。`
          : `分析完成：未命中 >${AUTO_SELECT_CONFIDENCE_GT}% 的两两重合项。`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "重复检查失败，请稍后重试。");
    } finally {
      setScanning(false);
    }
  }

  function onStreamEvent(event: SSEEvent) {
    if (event.event !== "progress") return;
    const step = String(event.data.step || "");
    const delta = String(event.data.delta || "");
    const text = String(event.data.text || "");
    if (delta) enqueueRawDelta(delta);
    if (text) enqueueRawDelta(text);
    if (step) setProgressHint(formatProgressHint(event.data));
  }

  function enqueueRawDelta(chunk: string) {
    const value = String(chunk || "");
    if (!value) return;
    streamQueueRef.current.push(value);
    if (streamTimerRef.current != null) return;
    streamTimerRef.current = window.setInterval(() => {
      const queue = streamQueueRef.current;
      if (queue.length === 0) {
        stopRawTextDrainer();
        return;
      }
      const head = queue[0];
      if (!head) {
        queue.shift();
        return;
      }
      const nextChar = head[0];
      queue[0] = head.slice(1);
      if (!queue[0]) queue.shift();
      setStreamRawText((prev) => prev + nextChar);
    }, 16);
  }

  function stopRawTextDrainer() {
    if (streamTimerRef.current == null) return;
    window.clearInterval(streamTimerRef.current);
    streamTimerRef.current = null;
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
    <section className="mt-8 rounded-[30px] border border-black/10 bg-gradient-to-br from-[#f8fbff] via-white to-[#f2f8f1] p-6">
      <div className="flex flex-wrap items-center gap-2">
        {showBackLink ? (
          <Link href="/product" className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/70 hover:bg-black/[0.03]">
            返回产品列表
          </Link>
        ) : null}
        <span className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/62">
          桌面端 AI 流式分析（实时文本 + 最终总结）
        </span>
      </div>

      <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.02em] text-black/90">AI 重合度清理台</h2>
      <p className="mt-2 text-[14px] leading-[1.6] text-black/65">
        一次性扫描同品类产品，两两调用豆包判断重合度。命中置信度 {">"}{AUTO_SELECT_CONFIDENCE_GT}% 的 trace_id 会自动勾选到待删除清单，你审核后再确认删除。
      </p>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-[260px_1fr]">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-black/70">分析范围</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-10 rounded-xl border border-black/12 bg-white px-3 text-[13px] outline-none focus:border-black/35"
            disabled={scanning}
          >
            <option value="">全部品类（系统按品类分别两两分析）</option>
            {categoryStats.map(([category, count]) => (
              <option key={category} value={category}>
                {categoryLabel(category)} · {count}
              </option>
            ))}
          </select>
        </label>
        <div className="rounded-xl border border-black/10 bg-white px-3 py-2">
          <div className="text-[12px] text-black/62">自动勾选规则</div>
          <div className="mt-0.5 text-[13px] font-medium text-black/84">仅勾选置信度 {">"} {AUTO_SELECT_CONFIDENCE_GT}% 的重合项（按 trace_id）</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={runDedupScan}
          disabled={scanning}
          className="inline-flex h-10 items-center justify-center rounded-full bg-black px-5 text-[13px] font-semibold text-white disabled:bg-black/25"
        >
          {scanning ? "豆包分析中..." : "开始同品类两两分析"}
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

      {progressHint ? <div className="mt-3 text-[12px] text-black/64">{progressHint}</div> : null}
      {error ? <div className="mt-2 text-[13px] text-[#b42318]">{error}</div> : null}
      {deleteSummary ? <div className="mt-2 text-[13px] text-[#116a3f]">{deleteSummary}</div> : null}

      {(streamRawText || streamPrettyText || scanning) && (
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-black/10 bg-[#fbfcff] p-2.5">
            <div className="text-[11px] font-semibold text-[#3151d8]">实时文本</div>
            <pre className="mt-1 max-h-52 overflow-auto whitespace-pre-wrap text-[12px] leading-[1.55] text-black/74">
              {streamRawText || (scanning ? "等待模型输出..." : "-")}
            </pre>
          </div>
          <div className="rounded-xl border border-black/10 bg-white p-2.5">
            <div className="text-[11px] font-semibold text-[#3151d8]">最终美化文本</div>
            <pre className="mt-1 max-h-52 overflow-auto whitespace-pre-wrap text-[12px] leading-[1.55] text-black/74">
              {streamPrettyText || (scanning ? "分析中..." : "-")}
            </pre>
          </div>
        </div>
      )}

      {report ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-[13px] text-black/70">
            扫描产品：{report.scanned_products}，命中高重合组：{report.suggestions.length}
            {report.failures.length > 0 ? `，失败任务：${report.failures.length}` : ""}
          </div>

          {report.suggestions.map((group) => {
            const keep = productMap.get(group.keep_id);
            return (
              <article key={group.group_id} className="rounded-[24px] border border-black/10 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[14px] font-semibold text-black/84">
                    {group.group_id} · 保留 1 条 / 待删 {group.remove_ids.length} 条
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
                  <div className="text-[11px] font-semibold text-black/72">待删除（可取消勾选）</div>
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
        </div>
      ) : null}
    </section>
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
        <div className="truncate text-[11px] text-black/44">trace_id: {product.id}</div>
      </div>
    </div>
  );
}

function categoryLabel(category?: string | null): string {
  if (!category) return "-";
  const key = category.toLowerCase() as keyof typeof CATEGORY_CONFIG;
  return CATEGORY_CONFIG[key]?.zh || category;
}

function formatProgressHint(data: Record<string, unknown>): string {
  const step = String(data.step || "");
  if (step === "dedup_scan_start") {
    const scannedProducts = Number(data.scanned_products || 0);
    return `已开始：待扫描 ${scannedProducts} 条产品。`;
  }
  if (step === "dedup_category_start") {
    const category = String(data.category || "-");
    const products = Number(data.products || 0);
    return `正在分析品类 ${categoryLabel(category)}，共 ${products} 条。`;
  }
  if (step === "dedup_anchor_start") {
    const anchorIndex = Number(data.anchor_index || 0);
    const anchorTotal = Number(data.anchor_total || 0);
    const anchorId = String(data.anchor_id || "-");
    return `锚点进度 ${anchorIndex}/${anchorTotal}，trace_id: ${anchorId}`;
  }
  if (step === "dedup_anchor_done") {
    const anchorId = String(data.anchor_id || "-");
    const hits = Number(data.high_conf_pairs || 0);
    return `锚点完成：${anchorId}，高置信命中 ${hits} 对。`;
  }
  if (step === "dedup_scan_done") {
    const suggestions = Number(data.suggestions || 0);
    return `分析结束：命中 ${suggestions} 组。`;
  }
  if (step === "dedup_model_event") {
    const stage = String(data.stage || "");
    if (stage) return `模型执行中：${stage}`;
  }
  return "豆包分析中...";
}

function collectAnalysisText(report: ProductDedupSuggestResponse): string {
  const out: string[] = [];
  for (const item of report.suggestions) {
    const text = String(item.analysis_text || "").trim();
    if (text && !out.includes(text)) out.push(text);
  }
  return out.join("\n\n");
}

function buildPrettySummary(report: ProductDedupSuggestResponse): string {
  const lines: string[] = [];
  lines.push(`扫描产品数: ${report.scanned_products}`);
  lines.push(`高重合分组: ${report.suggestions.length}`);
  if (report.suggestions.length === 0) {
    lines.push(`未命中 >${AUTO_SELECT_CONFIDENCE_GT}% 的重合项。`);
  } else {
    lines.push("建议删除清单:");
    report.suggestions.forEach((item, idx) => {
      lines.push(
        `${idx + 1}. keep=${item.keep_id}, remove=${item.remove_ids.join(", ") || "-"}, confidence=${item.confidence}`,
      );
    });
  }
  if (report.failures.length > 0) {
    lines.push("");
    lines.push(`失败任务: ${report.failures.length}`);
    for (const msg of report.failures.slice(0, 5)) {
      lines.push(`- ${msg}`);
    }
  }
  return lines.join("\n");
}
