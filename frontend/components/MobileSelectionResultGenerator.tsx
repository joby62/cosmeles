"use client";

import { useMemo, useState } from "react";
import ProductWorkbenchJobConsole from "@/components/workbench/ProductWorkbenchJobConsole";
import { useProductWorkbenchJobs } from "@/components/workbench/useProductWorkbenchJobs";
import {
  MobileSelectionResultBuildRequest,
  MobileSelectionResultBuildResponse,
  Product,
  ProductWorkbenchJob,
  cancelMobileSelectionResultJob,
  createMobileSelectionResultJob,
  fetchMobileSelectionResultJob,
  listMobileSelectionResultJobs,
  retryMobileSelectionResultJob,
} from "@/lib/api";
import { CATEGORY_CONFIG } from "@/lib/catalog";

type SelectionResultCategory = "all" | "shampoo" | "bodywash" | "conditioner" | "lotion" | "cleanser";

const SUPPORTED_CATEGORIES = ["shampoo", "bodywash", "conditioner", "lotion", "cleanser"] as const;
const ACTIVE_JOB_STORAGE_KEY = "selection-result-active-job-id";

export default function MobileSelectionResultGenerator({
  initialProducts,
}: {
  initialProducts: Product[];
}) {
  const [selectedCategory, setSelectedCategory] = useState<SelectionResultCategory>("all");
  const [forceRegenerate, setForceRegenerate] = useState(false);
  const [onlyMissing, setOnlyMissing] = useState(false);
  const jobService = useMemo(
    () => ({
      listJobs: listMobileSelectionResultJobs,
      fetchJob: fetchMobileSelectionResultJob,
      createJob: createMobileSelectionResultJob,
      cancelJob: cancelMobileSelectionResultJob,
      retryJob: retryMobileSelectionResultJob,
    }),
    [],
  );

  const {
    jobLoading,
    jobsLoading,
    errorMessage,
    activeJob,
    activeRunning,
    progressValue,
    liveText,
    result,
    sortedJobs,
    refreshJobs,
    startJob,
    cancelActiveJob: cancelTrackedJob,
    retryJob: retryTrackedJob,
    selectJob,
  } = useProductWorkbenchJobs<MobileSelectionResultBuildRequest, MobileSelectionResultBuildResponse>({
    storageKey: ACTIVE_JOB_STORAGE_KEY,
    listLimit: 40,
    parseResult: (job) => parseSelectionResultBuildResult(job.result as Record<string, unknown> | undefined),
    service: jobService,
  });

  const supportedProducts = useMemo(() => {
    return initialProducts.filter((item) => {
      const category = String(item.category || "").trim().toLowerCase();
      return SUPPORTED_CATEGORIES.includes(category as (typeof SUPPORTED_CATEGORIES)[number]);
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

  async function startBuild() {
    if (activeRunning) return;
    await startJob({
      category: selectedCategory === "all" ? undefined : selectedCategory,
      force_regenerate: forceRegenerate,
      only_missing: onlyMissing,
    });
  }

  return (
    <section className="mt-8 rounded-[30px] border border-black/10 bg-gradient-to-br from-[#f8fbff] via-white to-[#f7f5ff] p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/62">
          Stage G · 测评结果场景生成（后台任务）
        </span>
        <span className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/62">
          用户导向解释层 · Doubao Pro
        </span>
      </div>

      <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.02em] text-black/90">测评结果场景生成台</h2>
      <p className="mt-2 text-[14px] leading-[1.6] text-black/65">
        在产品增强分析之后，按当前问卷题库自动枚举所有有效组合，生成“先讲清用户情况，再承接主推产品”的结果页 JSON。矩阵、主推、产品分析有变化时，重跑即可按指纹增量更新。
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <span className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] font-medium text-black/72">
          支持产品数：{supportedProducts.length}
        </span>
        <span className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] font-medium text-black/72">
          当前链路：用户情况优先 + strict 发布
        </span>
        {categoryStats.map(([category, count]) => (
          <span key={category} className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] text-black/66">
            {categoryLabel(category)} · {count}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(["all", ...SUPPORTED_CATEGORIES] as SelectionResultCategory[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setSelectedCategory(item)}
            disabled={activeRunning || jobLoading}
            className={`rounded-full border px-3 py-1 text-[12px] ${
              selectedCategory === item ? "border-black bg-black text-white" : "border-black/12 bg-white text-black/68"
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
            checked={onlyMissing}
            onChange={(event) => setOnlyMissing(event.target.checked)}
            disabled={activeRunning || jobLoading}
          />
          仅补未发布场景
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void startBuild()}
          disabled={jobLoading || activeRunning || supportedProducts.length === 0}
          className="inline-flex h-10 items-center justify-center rounded-full bg-black px-5 text-[13px] font-semibold text-white disabled:bg-black/25"
        >
          {jobLoading && !activeRunning ? "提交中..." : "一键生成测评结果场景"}
        </button>
        <button
          type="button"
          onClick={() => void cancelTrackedJob()}
          disabled={jobLoading || !activeRunning || !activeJob}
          className="inline-flex h-10 items-center justify-center rounded-full border border-[#ef4444]/40 bg-[#fff5f5] px-5 text-[13px] font-semibold text-[#b42318] disabled:opacity-45"
        >
          中止当前任务
        </button>
        <button
          type="button"
          onClick={() => void refreshJobs()}
          disabled={jobsLoading}
          className="inline-flex h-10 items-center justify-center rounded-full border border-black/14 bg-white px-5 text-[13px] font-semibold text-black/78 disabled:opacity-45"
        >
          {jobsLoading ? "刷新中..." : "刷新任务"}
        </button>
      </div>

      <div className="mt-3 text-[12px] text-black/64">{formatJobHint(activeJob)}</div>
      {errorMessage ? <div className="mt-2 text-[13px] text-[#b42318]">{errorMessage}</div> : null}

      <ProductWorkbenchJobConsole
        activeJob={activeJob}
        activeRunning={activeRunning}
        progressValue={progressValue}
        countersText={
          activeJob
            ? `scenarios ${activeJob.counters.scanned_products} · submitted ${activeJob.counters.submitted_to_model} · created ${activeJob.counters.created} · updated ${activeJob.counters.updated} · skipped ${activeJob.counters.skipped} · failed ${activeJob.counters.failed}`
            : null
        }
        liveText={liveText}
        prettyText={result ? buildSummary(result) : ""}
        jobs={sortedJobs}
        jobLoading={jobLoading}
        onSelectJob={selectJob}
        onRetryJob={(jobId) => {
          void retryTrackedJob(jobId);
        }}
      />
    </section>
  );
}

function categoryLabel(category?: string | null): string {
  if (!category) return "-";
  const key = category.toLowerCase() as keyof typeof CATEGORY_CONFIG;
  return CATEGORY_CONFIG[key]?.zh || category;
}

function parseSelectionResultBuildResult(
  value: Record<string, unknown> | undefined,
): MobileSelectionResultBuildResponse | null {
  if (!value || typeof value !== "object") return null;
  const status = String(value.status || "").trim();
  if (!status) return null;
  return {
    status,
    scanned_scenarios: Number(value.scanned_scenarios || 0),
    submitted_to_model: Number(value.submitted_to_model || 0),
    created: Number(value.created || 0),
    updated: Number(value.updated || 0),
    skipped: Number(value.skipped || 0),
    failed: Number(value.failed || 0),
    items: Array.isArray(value.items) ? (value.items as MobileSelectionResultBuildResponse["items"]) : [],
    failures: Array.isArray(value.failures) ? (value.failures as string[]) : [],
  };
}

function formatJobHint(job: ProductWorkbenchJob | null): string {
  if (!job) return "待命：可创建新的结果场景生成任务。";
  if (job.status === "queued") return "任务排队中，等待执行。";
  if (job.status === "running") return "任务运行中，刷新页面后可恢复。";
  if (job.status === "cancelling") return "已收到取消请求，当前场景完成后停止。";
  if (job.status === "cancelled") return "任务已取消，可按需重试。";
  if (job.status === "failed") return "任务失败，可查看日志定位并重试。";
  return "任务已完成。";
}

function buildSummary(result: MobileSelectionResultBuildResponse): string {
  const lines: string[] = [];
  lines.push(`状态: ${result.status}`);
  lines.push(`扫描场景: ${result.scanned_scenarios}`);
  lines.push(`提交模型: ${result.submitted_to_model}`);
  lines.push(`created=${result.created}, updated=${result.updated}, skipped=${result.skipped}, failed=${result.failed}`);

  const changed = result.items.filter((item) => item.status === "created" || item.status === "updated");
  if (changed.length > 0) {
    lines.push("");
    lines.push("本次写入:");
    for (const item of changed.slice(0, 12)) {
      lines.push(
        `- ${item.category} / ${item.route_title || item.route_key || "-"} / ${item.answers_hash.slice(0, 8)} / ${item.status}`,
      );
    }
  }

  if (result.failures.length > 0) {
    lines.push("");
    lines.push("失败样本:");
    for (const item of result.failures.slice(0, 8)) {
      lines.push(`- ${item}`);
    }
  }

  return lines.join("\n");
}
