"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Product,
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

  const [jobLoading, setJobLoading] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobs, setJobs] = useState<ProductWorkbenchJob[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<ProductWorkbenchJob | null>(null);

  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ProductDedupSuggestResponse | null>(null);
  const [selectedRemoveIds, setSelectedRemoveIds] = useState<string[]>([]);
  const [deleteSummary, setDeleteSummary] = useState<string | null>(null);

  const categoryStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of initialProducts) {
      const key = (item.category || "unknown").trim().toLowerCase();
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [initialProducts]);

  const sortedJobs = useMemo(
    () => [...jobs].sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || ""))),
    [jobs],
  );

  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    for (const item of initialProducts) map.set(item.id, item);
    for (const item of report?.involved_products || []) map.set(item.id, item);
    return map;
  }, [initialProducts, report?.involved_products]);

  const keepIds = useMemo(() => {
    return new Set((report?.suggestions || []).map((item) => item.keep_id));
  }, [report?.suggestions]);

  const activeRunning = activeJob?.status === "queued" || activeJob?.status === "running" || activeJob?.status === "cancelling";
  const progressValue = Math.max(0, Math.min(100, Number(activeJob?.percent || 0)));
  const streamRawText = activeJob?.logs?.join("\n") || "";
  const streamPrettyText = report ? buildPrettySummary(report) : "";

  const rememberActiveJob = useCallback((jobId: string) => {
    const value = String(jobId || "").trim();
    if (!value) return;
    window.localStorage.setItem(ACTIVE_JOB_STORAGE_KEY, value);
    setActiveJobId(value);
  }, []);

  const clearActiveJob = useCallback(() => {
    window.localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
    setActiveJobId(null);
  }, []);

  const loadJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const rows = await listProductDedupJobs({ limit: 30, offset: 0 });
      setJobs(rows);
      if (!activeJobId) {
        const running = rows.find((item) => item.status === "queued" || item.status === "running" || item.status === "cancelling");
        if (running) rememberActiveJob(running.job_id);
      }
      const latestDone = rows.find((item) => item.status === "done" && item.result && typeof item.result === "object");
      const parsed = parseDedupResult(latestDone?.result as Record<string, unknown> | undefined);
      if (parsed) {
        setReport(parsed);
        setSelectedRemoveIds(Array.from(new Set(parsed.suggestions.flatMap((item) => item.remove_ids))));
      }
    } catch (err) {
      setError(formatErrorDetail(err));
      setJobs([]);
    } finally {
      setJobsLoading(false);
    }
  }, [activeJobId, rememberActiveJob]);

  useEffect(() => {
    const raw = window.localStorage.getItem(ACTIVE_JOB_STORAGE_KEY);
    if (raw && raw.trim()) setActiveJobId(raw.trim());
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadJobs();
    }, 2800);
    return () => window.clearInterval(timer);
  }, [loadJobs]);

  useEffect(() => {
    if (!activeJobId) {
      setActiveJob(null);
      return;
    }
    let cancelled = false;
    let timer: number | null = null;

    const pull = async () => {
      try {
        const job = await fetchProductDedupJob(activeJobId);
        if (cancelled) return;
        setActiveJob(job);
        const parsed = parseDedupResult(job.result as Record<string, unknown> | undefined);
        if (parsed) {
          setReport(parsed);
          setSelectedRemoveIds(Array.from(new Set(parsed.suggestions.flatMap((item) => item.remove_ids))));
        }
        if (job.status === "done" || job.status === "failed" || job.status === "cancelled") {
          clearActiveJob();
          void loadJobs();
          return;
        }
      } catch (err) {
        if (cancelled) return;
        setError(formatErrorDetail(err));
      }
      if (cancelled) return;
      timer = window.setTimeout(() => {
        void pull();
      }, 2200);
    };

    void pull();
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [activeJobId, clearActiveJob, loadJobs]);

  async function runDedupScan() {
    if (activeRunning) return;
    setJobLoading(true);
    setError(null);
    setDeleteSummary(null);
    setReport(null);
    setSelectedRemoveIds([]);

    try {
      const maxScanProducts = Math.max(1, Math.min(500, initialProducts.length || 1));
      const job = await createProductDedupJob({
        category: selectedCategory || undefined,
        model_tier: selectedModelTier,
        max_scan_products: maxScanProducts,
        compare_batch_size: 1,
        min_confidence: MIN_CONFIDENCE_FOR_API,
      });
      setActiveJob(job);
      rememberActiveJob(job.job_id);
      await loadJobs();
    } catch (err) {
      setError(formatErrorDetail(err));
    } finally {
      setJobLoading(false);
    }
  }

  async function cancelActiveJob() {
    if (!activeJob) return;
    setJobLoading(true);
    setError(null);
    try {
      const resp = await cancelProductDedupJob(activeJob.job_id);
      setActiveJob(resp.job);
      await loadJobs();
    } catch (err) {
      setError(formatErrorDetail(err));
    } finally {
      setJobLoading(false);
    }
  }

  async function retryJob(jobId: string) {
    setJobLoading(true);
    setError(null);
    try {
      const job = await retryProductDedupJob(jobId);
      setActiveJob(job);
      rememberActiveJob(job.job_id);
      await loadJobs();
    } catch (err) {
      setError(formatErrorDetail(err));
    } finally {
      setJobLoading(false);
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
      await loadJobs();
    } catch (err) {
      setError(formatErrorDetail(err));
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
          Stage B · AI 重合度检测（后台任务）
        </span>
        <span className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/62">
          模型档位：{selectedModelTier.toUpperCase()}
        </span>
        <span className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/62">
          实际模型：{report?.model || "-"}
        </span>
      </div>

      <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.02em] text-black/90">AI 重合度清理台</h2>
      <p className="mt-2 text-[14px] leading-[1.6] text-black/65">
        一次性扫描同品类产品，两两调用豆包判断重合度。命中置信度 {">"}{AUTO_SELECT_CONFIDENCE_GT}% 的 trace_id 自动勾选待删除清单，刷新后可恢复任务进度。
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
          {jobLoading && !activeRunning ? "提交中..." : "开始同品类两两分析（后台）"}
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
          onClick={() => void loadJobs()}
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
      {error ? <div className="mt-2 text-[13px] text-[#b42318]">{error}</div> : null}
      {deleteSummary ? <div className="mt-2 text-[13px] text-[#116a3f]">{deleteSummary}</div> : null}

      <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[13px] font-semibold text-black/82">当前任务</div>
          <div className="text-[12px] text-black/58">
            {activeJob ? `${activeJob.job_id} · ${activeJob.status}` : "暂无运行任务"}
          </div>
        </div>
        <div className="mt-2 text-[12px] text-black/64">
          {activeJob?.stage_label || activeJob?.stage || "待命"} · {activeJob?.message || "等待创建任务"}
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10">
          <div className="h-full rounded-full bg-black transition-all" style={{ width: `${progressValue}%` }} />
        </div>
        <div className="mt-2 text-[12px] text-black/58">
          进度 {progressValue}% · {activeJob?.current_index || 0}/{activeJob?.current_total || 0}
        </div>
        {activeJob ? (
          <div className="mt-2 text-[12px] text-black/58">
            scanned {activeJob.counters.scanned_products} · compared {activeJob.counters.compared_pairs} · suggestions {activeJob.counters.suggestions} · failed {activeJob.counters.failed}
          </div>
        ) : null}
      </div>

      {(streamRawText || streamPrettyText || activeRunning) && (
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-black/10 bg-[#fbfcff] p-2.5">
            <div className="text-[11px] font-semibold text-[#3151d8]">实时文本</div>
            <pre className="mt-1 max-h-52 overflow-auto whitespace-pre-wrap text-[12px] leading-[1.55] text-black/74">
              {streamRawText || (activeRunning ? "等待任务日志..." : "-")}
            </pre>
          </div>
          <div className="rounded-xl border border-black/10 bg-white p-2.5">
            <div className="text-[11px] font-semibold text-[#3151d8]">最终美化文本</div>
            <pre className="mt-1 max-h-52 overflow-auto whitespace-pre-wrap text-[12px] leading-[1.55] text-black/74">
              {streamPrettyText || (activeRunning ? "分析中..." : "-")}
            </pre>
          </div>
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-black/10 bg-[#f8fafc] p-4">
        <div className="text-[13px] font-semibold text-black/82">最近任务</div>
        <div className="mt-3 max-h-[220px] space-y-2 overflow-auto pr-1">
          {sortedJobs.map((job) => {
            const canRetry = job.status === "failed" || job.status === "cancelled";
            return (
              <div key={job.job_id} className="rounded-xl border border-black/10 bg-white px-3 py-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveJob(job);
                    if (job.status === "running" || job.status === "queued" || job.status === "cancelling") {
                      rememberActiveJob(job.job_id);
                    }
                  }}
                  className="w-full text-left"
                >
                  <div className="truncate text-[12px] font-semibold text-black/78">
                    {job.job_id} · {job.status} · {job.percent}%
                  </div>
                  <div className="mt-0.5 truncate text-[12px] text-black/58">{job.stage_label || job.stage || "-"} · {job.message || "-"}</div>
                  <div className="mt-0.5 text-[11px] text-black/48">updated_at: {job.updated_at}</div>
                </button>
                {canRetry ? (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => void retryJob(job.job_id)}
                      disabled={jobLoading}
                      className="inline-flex h-8 items-center justify-center rounded-full border border-[#3151d8]/30 bg-[#eef2ff] px-3 text-[12px] font-semibold text-[#3151d8] disabled:opacity-45"
                    >
                      失败重试
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
          {sortedJobs.length === 0 ? <div className="text-[12px] text-black/52">暂无历史任务。</div> : null}
        </div>
      </div>

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
  if (!job) return "待命：可创建新的重合度扫描任务。";
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

function formatErrorDetail(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
