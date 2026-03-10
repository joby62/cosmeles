"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProductWorkbenchJobConsole from "@/components/workbench/ProductWorkbenchJobConsole";
import { formatErrorDetail, useProductWorkbenchJobs } from "@/components/workbench/useProductWorkbenchJobs";
import {
  Product,
  ProductDedupSuggestRequest,
  ProductDedupSuggestResponse,
  ProductWorkbenchJob,
  cancelProductDedupJob,
  createProductDedupJob,
  deleteProductsBatch,
  fetchProductDedupJob,
  listProductDedupJobs,
  resolveImageUrl,
  retryProductDedupJob,
} from "@/lib/api";
import { CATEGORY_CONFIG } from "@/lib/catalog";

const AUTO_SELECT_CONFIDENCE_GT = 95;
const MIN_CONFIDENCE_FOR_API = AUTO_SELECT_CONFIDENCE_GT + 1;
const ACTIVE_JOB_STORAGE_KEY = "dedup-active-job-id";
const MODEL_TIER_OPTIONS: Array<{ value: ModelTier; label: string }> = [
  { value: "mini", label: "Mini" },
  { value: "lite", label: "Lite" },
  { value: "pro", label: "Pro" },
];
type ModelTier = "mini" | "lite" | "pro";

export default function ProductDedupManager({
  initialProducts,
  showBackLink = false,
}: {
  initialProducts: Product[];
  showBackLink?: boolean;
}) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedModelTier, setSelectedModelTier] = useState<ModelTier>("pro");
  const [deleting, setDeleting] = useState(false);
  const [selectedRemoveIds, setSelectedRemoveIds] = useState<string[]>([]);
  const [deleteSummary, setDeleteSummary] = useState<string | null>(null);
  const [selectionSeedJobId, setSelectionSeedJobId] = useState<string | null>(null);
  const jobService = useMemo(
    () => ({
      listJobs: listProductDedupJobs,
      fetchJob: fetchProductDedupJob,
      createJob: createProductDedupJob,
      cancelJob: cancelProductDedupJob,
      retryJob: retryProductDedupJob,
    }),
    [],
  );

  const {
    jobLoading,
    jobsLoading,
    errorMessage,
    setErrorMessage,
    activeJob,
    activeRunning,
    progressValue,
    liveText,
    sortedJobs,
    result: report,
    resultJobId,
    refreshJobs,
    startJob,
    cancelActiveJob: cancelTrackedJob,
    retryJob: retryTrackedJob,
    selectJob,
    clearResult,
  } = useProductWorkbenchJobs<ProductDedupSuggestRequest, ProductDedupSuggestResponse>({
    storageKey: ACTIVE_JOB_STORAGE_KEY,
    listLimit: 30,
    parseResult: (job) => parseDedupResult(job.result as Record<string, unknown> | undefined),
    service: jobService,
  });

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
    if (!report || !resultJobId || selectionSeedJobId === resultJobId) return;
    setSelectedRemoveIds(Array.from(new Set(report.suggestions.flatMap((item) => item.remove_ids))));
    setSelectionSeedJobId(resultJobId);
  }, [report, resultJobId, selectionSeedJobId]);

  const streamPrettyText = report ? buildPrettySummary(report) : "";

  async function runDedupScan() {
    if (activeRunning) return;
    setDeleteSummary(null);
    clearResult();
    setSelectedRemoveIds([]);
    setSelectionSeedJobId(null);

    const maxScanProducts = Math.max(1, Math.min(500, initialProducts.length || 1));
    await startJob({
      category: selectedCategory || undefined,
      model_tier: selectedModelTier,
      max_scan_products: maxScanProducts,
      compare_batch_size: 1,
      min_confidence: MIN_CONFIDENCE_FOR_API,
    });
  }

  async function cancelActiveJob() {
    await cancelTrackedJob();
  }

  async function retryJob(jobId: string) {
    await retryTrackedJob(jobId);
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
    setErrorMessage(null);
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
      clearResult();
      setSelectionSeedJobId(null);
      router.refresh();
      await refreshJobs();
    } catch (err) {
      setErrorMessage(formatErrorDetail(err));
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
          Stage B · 同品归并（后台任务）
        </span>
        <span className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/62">
          模型档位：{selectedModelTier.toUpperCase()}
        </span>
        <span className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/62">
          实际模型：{report?.model || "-"}
        </span>
      </div>

      <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.02em] text-black/90">同品归并台</h2>
      <p className="mt-2 text-[14px] leading-[1.6] text-black/65">
        一次性扫描同品类产品，两两调用豆包判断是否为同品。命中置信度 {">"}{AUTO_SELECT_CONFIDENCE_GT}% 的 trace_id 会自动进入待删候选，仍需人工确认后再删除。
      </p>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-[260px_220px_1fr]">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-black/70">分析范围</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-10 rounded-xl border border-black/12 bg-white px-3 text-[13px] outline-none focus:border-black/35"
            disabled={activeRunning}
          >
            <option value="">全部品类（系统按品类分别两两分析）</option>
            {categoryStats.map(([category, count]) => (
              <option key={category} value={category}>
                {categoryLabel(category)} · {count}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-black/70">模型档位</span>
          <select
            value={selectedModelTier}
            onChange={(e) => setSelectedModelTier(e.target.value as ModelTier)}
            className="h-10 rounded-xl border border-black/12 bg-white px-3 text-[13px] outline-none focus:border-black/35"
            disabled={activeRunning}
          >
            {MODEL_TIER_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
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
          onClick={() => void runDedupScan()}
          disabled={activeRunning || jobLoading}
          className="inline-flex h-10 items-center justify-center rounded-full bg-black px-5 text-[13px] font-semibold text-white disabled:bg-black/25"
        >
          {jobLoading && !activeRunning ? "提交中..." : "开始同品归并分析（后台）"}
        </button>
        <button
          type="button"
          onClick={() => void cancelActiveJob()}
          disabled={jobLoading || !activeRunning || !activeJob}
          className="inline-flex h-10 items-center justify-center rounded-full border border-[#ef4444]/40 bg-[#fff5f5] px-5 text-[13px] font-semibold text-[#b42318] disabled:opacity-45"
        >
          终止当前任务
        </button>
        <button
          type="button"
          onClick={() => void refreshJobs()}
          disabled={jobsLoading}
          className="inline-flex h-10 items-center justify-center rounded-full border border-black/14 bg-white px-5 text-[13px] font-semibold text-black/78 disabled:opacity-45"
        >
          {jobsLoading ? "刷新中..." : "刷新任务"}
        </button>
        <button
          type="button"
          onClick={() => void confirmDelete()}
          disabled={deleting || selectedRemoveIds.length === 0}
          className="inline-flex h-10 items-center justify-center rounded-full border border-[#ef4444]/40 bg-[#fff5f5] px-5 text-[13px] font-semibold text-[#b42318] disabled:opacity-50"
        >
          {deleting ? "删除中..." : `确认删除 (${selectedRemoveIds.length})`}
        </button>
      </div>

      <div className="mt-3 text-[12px] text-black/64">{formatJobHint(activeJob)}</div>
      {errorMessage ? <div className="mt-2 text-[13px] text-[#b42318]">{errorMessage}</div> : null}
      {deleteSummary ? <div className="mt-2 text-[13px] text-[#116a3f]">{deleteSummary}</div> : null}

      <ProductWorkbenchJobConsole
        activeJob={activeJob}
        activeRunning={activeRunning}
        progressValue={progressValue}
        countersText={
          activeJob
            ? `scanned ${activeJob.counters.scanned_products} · compared ${activeJob.counters.compared_pairs} · suggestions ${activeJob.counters.suggestions} · failed ${activeJob.counters.failed}`
            : null
        }
        liveText={liveText}
        prettyText={streamPrettyText}
        jobs={sortedJobs}
        jobLoading={jobLoading}
        onSelectJob={selectJob}
        onRetryJob={(jobId) => {
          void retryJob(jobId);
        }}
      />

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

function parseDedupResult(value: Record<string, unknown> | undefined): ProductDedupSuggestResponse | null {
  if (!value || typeof value !== "object") return null;
  const status = String(value.status || "").trim();
  if (!status) return null;
  return {
    status,
    scanned_products: Number(value.scanned_products || 0),
    requested_model_tier: (value.requested_model_tier as "mini" | "lite" | "pro" | null | undefined) || null,
    model: (value.model as string | null | undefined) || null,
    suggestions: Array.isArray(value.suggestions) ? (value.suggestions as ProductDedupSuggestResponse["suggestions"]) : [],
    involved_products: Array.isArray(value.involved_products) ? (value.involved_products as Product[]) : [],
    failures: Array.isArray(value.failures) ? (value.failures as string[]) : [],
  };
}

function formatJobHint(job: ProductWorkbenchJob | null): string {
  if (!job) return "待命：可创建新的同品归并任务。";
  if (job.status === "queued") return "任务排队中，等待执行。";
  if (job.status === "running") return "任务运行中，刷新页面后可恢复。";
  if (job.status === "cancelling") return "已收到取消请求，当前处理单元结束后停止。";
  if (job.status === "cancelled") return "任务已取消，可按需重试。";
  if (job.status === "failed") return "任务失败，可查看日志定位并重试。";
  return "任务已完成。";
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
