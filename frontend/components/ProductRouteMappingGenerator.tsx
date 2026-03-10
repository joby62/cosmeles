"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Product,
  ProductRouteMappingBuildResponse,
  ProductWorkbenchJob,
  cancelProductRouteMappingJob,
  createProductRouteMappingJob,
  fetchProductRouteMappingJob,
  listProductRouteMappingJobs,
  retryProductRouteMappingJob,
} from "@/lib/api";
import { CATEGORY_CONFIG } from "@/lib/catalog";

type RouteMappingCategory = "all" | "shampoo" | "bodywash" | "conditioner" | "lotion" | "cleanser";

const ACTIVE_JOB_STORAGE_KEY = "route-mapping-active-job-id";

export default function ProductRouteMappingGenerator({
  initialProducts,
}: {
  initialProducts: Product[];
}) {
  const [jobLoading, setJobLoading] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<ProductWorkbenchJob[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<ProductWorkbenchJob | null>(null);
  const [result, setResult] = useState<ProductRouteMappingBuildResponse | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<RouteMappingCategory>("all");
  const [forceRegenerate, setForceRegenerate] = useState(false);
  const [onlyUnmapped, setOnlyUnmapped] = useState(false);

  const supportedProducts = useMemo(() => {
    return initialProducts.filter((item) => {
      const category = String(item.category || "").trim().toLowerCase();
      return category === "shampoo" || category === "bodywash" || category === "conditioner" || category === "lotion" || category === "cleanser";
    });
  }, [initialProducts]);

  const categoryStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of supportedProducts) {
      const key = (item.category || "unknown").trim().toLowerCase();
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [supportedProducts]);

  const sortedJobs = useMemo(
    () => [...jobs].sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || ""))),
    [jobs],
  );

  const activeRunning = activeJob?.status === "queued" || activeJob?.status === "running" || activeJob?.status === "cancelling";
  const progressValue = Math.max(0, Math.min(100, Number(activeJob?.percent || 0)));
  const liveText = activeJob?.logs?.join("\n") || "";
  const prettyText = result ? buildSummary(result) : "";

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
      const rows = await listProductRouteMappingJobs({ limit: 40, offset: 0 });
      setJobs(rows);
      if (!activeJobId) {
        const running = rows.find((item) => item.status === "queued" || item.status === "running" || item.status === "cancelling");
        if (running) rememberActiveJob(running.job_id);
      }
      const latestDone = rows.find((item) => item.status === "done" && item.result && typeof item.result === "object");
      const parsed = parseRouteMappingResult(latestDone?.result as Record<string, unknown> | undefined);
      if (parsed) setResult(parsed);
    } catch (err) {
      setError(formatErrorDetail(err));
      setJobs([]);
    } finally {
      setJobsLoading(false);
    }
  }, [activeJobId, rememberActiveJob]);

  useEffect(() => {
    const raw = window.localStorage.getItem(ACTIVE_JOB_STORAGE_KEY);
    if (raw && raw.trim()) {
      setActiveJobId(raw.trim());
    }
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
        const job = await fetchProductRouteMappingJob(activeJobId);
        if (cancelled) return;
        setActiveJob(job);
        const parsed = parseRouteMappingResult(job.result as Record<string, unknown> | undefined);
        if (parsed) setResult(parsed);
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

  async function startBuild() {
    if (activeRunning) return;
    setJobLoading(true);
    setError(null);
    try {
      const job = await createProductRouteMappingJob({
        category: selectedCategory === "all" ? undefined : selectedCategory,
        force_regenerate: forceRegenerate,
        only_unmapped: onlyUnmapped,
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
      const resp = await cancelProductRouteMappingJob(activeJob.job_id);
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
      const job = await retryProductRouteMappingJob(jobId);
      setActiveJob(job);
      rememberActiveJob(job.job_id);
      await loadJobs();
    } catch (err) {
      setError(formatErrorDetail(err));
    } finally {
      setJobLoading(false);
    }
  }

  return (
    <section className="mt-8 rounded-[30px] border border-black/10 bg-gradient-to-br from-[#f7fbff] via-white to-[#f2f8f2] p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/62">
          Stage D · 产品类型映射（后台任务）
        </span>
        <span className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/62">
          类型映射模型固定：Doubao Pro
        </span>
      </div>

      <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.02em] text-black/90">产品类型映射台</h2>
      <p className="mt-2 text-[14px] leading-[1.6] text-black/65">
        按决策模型对单品做类型映射，后台执行可取消、可重试、可刷新恢复，输出主类/次类与全量置信度用于 mobile 端精准选品。
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <span className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] font-medium text-black/72">
          支持产品数：{supportedProducts.length}
        </span>
        {categoryStats.map(([category, count]) => (
          <span key={category} className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] text-black/66">
            {categoryLabel(category)} · {count}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(["all", "shampoo", "bodywash", "conditioner", "lotion", "cleanser"] as RouteMappingCategory[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setSelectedCategory(item)}
            disabled={activeRunning || jobLoading}
            className={`rounded-full border px-3 py-1 text-[12px] ${
              selectedCategory === item
                ? "border-black bg-black text-white"
                : "border-black/12 bg-white text-black/68"
            } disabled:opacity-40`}
          >
            {item === "all" ? "全部品类" : categoryLabel(item)}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-[12px] text-black/66">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={forceRegenerate}
            onChange={(event) => setForceRegenerate(event.target.checked)}
            disabled={activeRunning || jobLoading}
          />
          强制重跑（忽略已有指纹）
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={onlyUnmapped}
            onChange={(event) => setOnlyUnmapped(event.target.checked)}
            disabled={activeRunning || jobLoading}
          />
          仅处理未映射产品
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void startBuild()}
          disabled={jobLoading || activeRunning || supportedProducts.length === 0}
          className="inline-flex h-10 items-center justify-center rounded-full bg-black px-5 text-[13px] font-semibold text-white disabled:bg-black/25"
        >
          {jobLoading && !activeRunning ? "提交中..." : "一键构建类型映射（后台）"}
        </button>
        <button
          type="button"
          onClick={() => void cancelActiveJob()}
          disabled={jobLoading || !activeRunning || !activeJob}
          className="inline-flex h-10 items-center justify-center rounded-full border border-[#ef4444]/40 bg-[#fff5f5] px-5 text-[13px] font-semibold text-[#b42318] disabled:opacity-45"
        >
          中止当前任务
        </button>
        <button
          type="button"
          onClick={() => void loadJobs()}
          disabled={jobsLoading}
          className="inline-flex h-10 items-center justify-center rounded-full border border-black/14 bg-white px-5 text-[13px] font-semibold text-black/78 disabled:opacity-45"
        >
          {jobsLoading ? "刷新中..." : "刷新任务"}
        </button>
      </div>

      <div className="mt-3 text-[12px] text-black/64">{formatJobHint(activeJob)}</div>
      {error ? <div className="mt-2 text-[13px] text-[#b42318]">{error}</div> : null}

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
            scanned {activeJob.counters.scanned_products} · submitted {activeJob.counters.submitted_to_model} · created {activeJob.counters.created} · updated {activeJob.counters.updated} · skipped {activeJob.counters.skipped} · failed {activeJob.counters.failed}
          </div>
        ) : null}
      </div>

      {(liveText || prettyText || activeRunning) && (
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-black/10 bg-[#fbfcff] p-2.5">
            <div className="text-[11px] font-semibold text-[#3151d8]">实时文本</div>
            <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap text-[12px] leading-[1.55] text-black/74">
              {liveText || (activeRunning ? "等待任务日志..." : "-")}
            </pre>
          </div>
          <div className="rounded-xl border border-black/10 bg-white p-2.5">
            <div className="text-[11px] font-semibold text-[#3151d8]">最终美化文本</div>
            <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap text-[12px] leading-[1.55] text-black/74">
              {prettyText || (activeRunning ? "分析中..." : "-")}
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
    </section>
  );
}

function categoryLabel(category?: string | null): string {
  if (!category) return "-";
  const key = category.toLowerCase() as keyof typeof CATEGORY_CONFIG;
  return CATEGORY_CONFIG[key]?.zh || category;
}

function parseRouteMappingResult(value: Record<string, unknown> | undefined): ProductRouteMappingBuildResponse | null {
  if (!value || typeof value !== "object") return null;
  const status = String(value.status || "").trim();
  if (!status) return null;
  return {
    status,
    scanned_products: Number(value.scanned_products || 0),
    submitted_to_model: Number(value.submitted_to_model || 0),
    created: Number(value.created || 0),
    updated: Number(value.updated || 0),
    skipped: Number(value.skipped || 0),
    failed: Number(value.failed || 0),
    items: Array.isArray(value.items) ? (value.items as ProductRouteMappingBuildResponse["items"]) : [],
    failures: Array.isArray(value.failures) ? (value.failures as string[]) : [],
  };
}

function formatJobHint(job: ProductWorkbenchJob | null): string {
  if (!job) return "待命：可创建新的类型映射任务。";
  if (job.status === "queued") return "任务排队中，等待执行。";
  if (job.status === "running") return "任务运行中，刷新页面后可恢复。";
  if (job.status === "cancelling") return "已收到取消请求，当前处理单元结束后停止。";
  if (job.status === "cancelled") return "任务已取消，可按需重试。";
  if (job.status === "failed") return "任务失败，可查看日志定位并重试。";
  return "任务已完成。";
}

function buildSummary(result: ProductRouteMappingBuildResponse): string {
  const lines: string[] = [];
  lines.push(`状态: ${result.status}`);
  lines.push(`扫描产品: ${result.scanned_products}`);
  lines.push(`提交模型: ${result.submitted_to_model}`);
  lines.push(`created=${result.created}, updated=${result.updated}, skipped=${result.skipped}, failed=${result.failed}`);

  const createdOrUpdated = result.items.filter((item) => item.status === "created" || item.status === "updated");
  if (createdOrUpdated.length > 0) {
    lines.push("");
    lines.push("本次写入:");
    for (const item of createdOrUpdated.slice(0, 30)) {
      const primary = item.primary_route?.route_title || item.primary_route?.route_key || "-";
      const secondary = item.secondary_route?.route_title || item.secondary_route?.route_key || "-";
      lines.push(
        `- ${item.category} / ${item.product_id} -> 主类: ${primary}, 次类: ${secondary}, 存储: ${item.storage_path || "-"}`,
      );
    }
  }

  if (result.failures.length > 0) {
    lines.push("");
    lines.push(`失败: ${result.failures.length}`);
    for (const failure of result.failures.slice(0, 10)) {
      lines.push(`- ${failure}`);
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
