"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ProductWorkbenchJobConsole from "@/components/workbench/ProductWorkbenchJobConsole";
import {
  formatErrorDetail,
  useProductWorkbenchJobs,
} from "@/components/workbench/useProductWorkbenchJobs";
import {
  Product,
  ProductAnalysisBuildRequest,
  ProductAnalysisBuildResponse,
  ProductAnalysisDetailResponse,
  ProductAnalysisIndexItem,
  ProductWorkbenchJob,
  cancelProductAnalysisJob,
  createProductAnalysisJob,
  fetchProductAnalysis,
  fetchProductAnalysisIndex,
  fetchProductAnalysisJob,
  listProductAnalysisJobs,
  retryProductAnalysisJob,
} from "@/lib/api";
import { CATEGORY_CONFIG } from "@/lib/catalog";

type AnalysisCategory = "all" | "shampoo" | "bodywash" | "conditioner" | "lotion" | "cleanser";

const SUPPORTED_CATEGORIES = ["shampoo", "bodywash", "conditioner", "lotion", "cleanser"] as const;
const ACTIVE_JOB_STORAGE_KEY = "product-analysis-active-job-id";

export default function ProductAnalysisGenerator({
  initialProducts,
  initialAnalysisIndex,
}: {
  initialProducts: Product[];
  initialAnalysisIndex: ProductAnalysisIndexItem[];
}) {
  const [selectedCategory, setSelectedCategory] = useState<AnalysisCategory>("all");
  const [forceRegenerate, setForceRegenerate] = useState(false);
  const [onlyUnanalyzed, setOnlyUnanalyzed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [indexItems, setIndexItems] = useState<ProductAnalysisIndexItem[]>(initialAnalysisIndex);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProductAnalysisDetailResponse | null>(null);
  const [indexedResultJobId, setIndexedResultJobId] = useState<string | null>(null);
  const jobService = useMemo(
    () => ({
      listJobs: listProductAnalysisJobs,
      fetchJob: fetchProductAnalysisJob,
      createJob: createProductAnalysisJob,
      cancelJob: cancelProductAnalysisJob,
      retryJob: retryProductAnalysisJob,
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
    result,
    resultJobId,
    sortedJobs,
    refreshJobs,
    startJob,
    cancelActiveJob,
    retryJob,
    selectJob,
  } = useProductWorkbenchJobs<ProductAnalysisBuildRequest, ProductAnalysisBuildResponse>({
    storageKey: ACTIVE_JOB_STORAGE_KEY,
    listLimit: 40,
    parseResult: (job) => parseAnalysisResult(job.result as Record<string, unknown> | undefined),
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
      const key = String(item.category || "").trim().toLowerCase();
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [supportedProducts]);

  const filteredIndexItems = useMemo(() => {
    return indexItems.filter((item) => {
      if (selectedCategory === "all") return true;
      return item.category === selectedCategory;
    });
  }, [indexItems, selectedCategory]);

  useEffect(() => {
    if (filteredIndexItems.length === 0) {
      if (selectedProductId) setSelectedProductId("");
      return;
    }
    if (filteredIndexItems.some((item) => item.product_id === selectedProductId)) return;
    setSelectedProductId(filteredIndexItems[0].product_id);
  }, [filteredIndexItems, selectedProductId]);

  useEffect(() => {
    if (!selectedProductId) {
      setDetail(null);
      setDetailError(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    void fetchProductAnalysis(selectedProductId)
      .then((resp) => {
        if (cancelled) return;
        setDetail(resp);
      })
      .catch((err) => {
        if (cancelled) return;
        setDetail(null);
        setDetailError(formatErrorDetail(err));
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProductId]);

  const reloadIndex = useCallback(async (options?: { silent?: boolean }) => {
    setRefreshing(true);
    try {
      const resp = await fetchProductAnalysisIndex({
        category: selectedCategory === "all" ? undefined : selectedCategory,
      });
      setIndexItems(resp.items || []);
    } catch (err) {
      if (!options?.silent) {
        setErrorMessage(formatErrorDetail(err));
      }
    } finally {
      setRefreshing(false);
    }
  }, [selectedCategory, setErrorMessage]);

  useEffect(() => {
    if (!result || !resultJobId || indexedResultJobId === resultJobId) return;
    let cancelled = false;
    void (async () => {
      await reloadIndex({ silent: true });
      if (cancelled) return;
      if (result.items?.[0]?.product_id) {
        setSelectedProductId(result.items[0].product_id);
      }
      setIndexedResultJobId(resultJobId);
    })();
    return () => {
      cancelled = true;
    };
  }, [indexedResultJobId, reloadIndex, result, resultJobId]);

  async function startBuild() {
    if (activeRunning) return;
    setIndexedResultJobId(null);
    await startJob({
      category: selectedCategory === "all" ? undefined : selectedCategory,
      force_regenerate: forceRegenerate,
      only_unanalyzed: onlyUnanalyzed,
    });
  }

  async function refreshAll() {
    await Promise.all([reloadIndex(), refreshJobs()]);
  }

  return (
    <section className="mt-8 rounded-[30px] border border-black/10 bg-gradient-to-br from-[#f7fbff] via-white to-[#f5faf3] p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/62">
          Stage F · 产品增强分析（后台任务）
        </span>
        <span className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/62">
          Doubao Pro · 刷新可恢复
        </span>
      </div>

      <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.02em] text-black/90">产品增强分析台</h2>
      <p className="mt-2 text-[14px] leading-[1.6] text-black/65">
        在成分分析和类型映射之后，基于二级类目、精简成分上下文和成分库摘要生成 mobile 端专用分析层。现在已切到统一后台任务架构，支持取消、重试、刷新恢复。
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <span className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] font-medium text-black/72">
          支持产品数：{supportedProducts.length}
        </span>
        <span className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] font-medium text-black/72">
          已生成分析：{indexItems.length}
        </span>
        {categoryStats.map(([category, count]) => (
          <span key={category} className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] text-black/66">
            {categoryLabel(category)} · {count}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(["all", ...SUPPORTED_CATEGORIES] as AnalysisCategory[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setSelectedCategory(item)}
            disabled={activeRunning || jobLoading}
            className={`rounded-full border px-3 py-1 text-[12px] ${
              selectedCategory === item ? "border-black bg-black text-white" : "border-black/12 bg-white text-black/68"
            } disabled:opacity-45`}
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
            checked={onlyUnanalyzed}
            onChange={(event) => setOnlyUnanalyzed(event.target.checked)}
            disabled={activeRunning || jobLoading}
          />
          仅处理未分析产品
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void startBuild()}
          disabled={jobLoading || activeRunning || supportedProducts.length === 0}
          className="inline-flex h-10 items-center justify-center rounded-full bg-black px-5 text-[13px] font-semibold text-white disabled:bg-black/25"
        >
          {jobLoading && !activeRunning ? "提交中..." : "一键构建产品增强分析（后台）"}
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
          onClick={() => void refreshAll()}
          disabled={refreshing || jobsLoading || activeRunning}
          className="inline-flex h-10 items-center justify-center rounded-full border border-black/14 bg-white px-5 text-[13px] font-semibold text-black/78 disabled:opacity-45"
        >
          {refreshing || jobsLoading ? "刷新中..." : "刷新索引与任务"}
        </button>
      </div>

      <div className="mt-3 text-[12px] text-black/64">{formatJobHint(activeJob)}</div>
      {!activeRunning && supportedProducts.length === 0 ? (
        <div className="mt-2 text-[13px] text-[#9a3412]">
          当前没有可做增强分析的支持产品，所以任务按钮会保持禁用。请先完成上传，或检查产品是否已经进入支持品类集合。
        </div>
      ) : null}
      {errorMessage ? <div className="mt-2 text-[13px] text-[#b42318]">{errorMessage}</div> : null}

      <ProductWorkbenchJobConsole
        activeJob={activeJob}
        activeRunning={activeRunning}
        progressValue={progressValue}
        countersText={
          activeJob
            ? `scanned ${activeJob.counters.scanned_products} · submitted ${activeJob.counters.submitted_to_model} · created ${activeJob.counters.created} · updated ${activeJob.counters.updated} · skipped ${activeJob.counters.skipped} · failed ${activeJob.counters.failed}`
            : null
        }
        liveText={liveText}
        prettyText={result ? buildSummary(result) : ""}
        jobs={sortedJobs}
        jobLoading={jobLoading}
        onSelectJob={selectJob}
        onRetryJob={(jobId) => {
          void retryJob(jobId);
        }}
      />

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-black/10 bg-[#f8fafc] p-4">
          <div className="text-[13px] font-semibold text-black/82">已生成索引</div>
          <div className="mt-3 max-h-[560px] space-y-2 overflow-auto pr-1">
            {filteredIndexItems.map((item) => {
              const active = item.product_id === selectedProductId;
              return (
                <button
                  key={item.product_id}
                  type="button"
                  onClick={() => setSelectedProductId(item.product_id)}
                  className={`w-full rounded-xl border px-3 py-2 text-left ${
                    active ? "border-black bg-black text-white" : "border-black/10 bg-white"
                  }`}
                >
                  <div className={`truncate text-[12px] font-semibold ${active ? "text-white" : "text-black/78"}`}>
                    {item.headline || item.product_id}
                  </div>
                  <div className={`mt-0.5 truncate text-[12px] ${active ? "text-white/78" : "text-black/58"}`}>
                    {categoryLabel(item.category)} · {item.route_title || item.route_key || "-"} · {item.confidence}%
                  </div>
                  <div className={`mt-0.5 text-[11px] ${active ? "text-white/68" : "text-black/48"}`}>
                    {item.subtype_fit_verdict || "-"} · {item.last_generated_at || "-"}
                  </div>
                </button>
              );
            })}
            {filteredIndexItems.length === 0 ? <div className="text-[12px] text-black/52">当前筛选无分析结果。</div> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-black/10 bg-white p-4">
          <div className="text-[13px] font-semibold text-black/82">分析详情</div>
          {detailLoading ? <div className="mt-3 text-[12px] text-black/56">加载中...</div> : null}
          {detailError ? <div className="mt-3 text-[12px] text-[#b42318]">{detailError}</div> : null}
          {!detailLoading && !detailError && detail ? <AnalysisDetailPanel detail={detail} /> : null}
          {!detailLoading && !detailError && !detail ? (
            <div className="mt-3 text-[12px] text-black/56">选择一条分析结果查看详情。</div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function AnalysisDetailPanel({ detail }: { detail: ProductAnalysisDetailResponse }) {
  const item = detail.item;
  const profile = item.profile;
  const diagnosticsEntries = Object.entries(profile.diagnostics || {}) as Array<
    [string, { score: number; reason: string }]
  >;
  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-[#cfe2ff] bg-[#f4f8ff] px-3 py-1 text-[11px] text-[#244f9e]">
          {profile.route_title || profile.route_key}
        </span>
        <span className="rounded-full border border-black/10 bg-[#fafafa] px-3 py-1 text-[11px] text-black/62">
          {profile.subtype_fit_verdict}
        </span>
        <span className="rounded-full border border-black/10 bg-[#fafafa] px-3 py-1 text-[11px] text-black/62">
          confidence {profile.confidence}%
        </span>
        {profile.needs_review ? (
          <span className="rounded-full border border-[#f9c97a] bg-[#fff8eb] px-3 py-1 text-[11px] text-[#8c5a00]">
            needs review
          </span>
        ) : null}
      </div>

      <h3 className="mt-3 text-[24px] font-semibold tracking-[-0.02em] text-black/88">{profile.headline}</h3>
      <p className="mt-2 text-[14px] leading-[1.65] text-black/68">{profile.positioning_summary}</p>
      <p className="mt-2 text-[13px] leading-[1.6] text-black/56">{profile.subtype_fit_reason}</p>

      <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
        <ListCard title="更适合" items={profile.best_for} tone="green" />
        <ListCard title="不太适合" items={profile.not_ideal_for} tone="amber" />
        <ListCard title="使用建议" items={profile.usage_tips} tone="blue" />
        <ListCard title="注意点" items={profile.watchouts} tone="red" />
      </div>

      <div className="mt-4">
        <div className="text-[13px] font-semibold text-black/82">诊断维度</div>
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
          {diagnosticsEntries.map(([key, value]) => (
            <div key={key} className="rounded-xl border border-black/8 bg-[#fafafa] px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[12px] font-semibold text-black/82">{formatDiagnosticLabel(key)}</div>
                <div className="text-[12px] font-medium text-black/62">{value.score}/5</div>
              </div>
              <div className="mt-1 text-[12px] leading-[1.55] text-black/58">{value.reason}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
        <div className="rounded-xl border border-black/8 bg-[#fafafa] px-3 py-3">
          <div className="text-[13px] font-semibold text-black/82">关键成分</div>
          <ul className="mt-2 space-y-2 text-[12px] text-black/62">
            {profile.key_ingredients.map((item) => (
              <li key={`${item.rank}-${item.ingredient_name_cn}-${item.ingredient_name_en}`}>
                <div className="font-medium text-black/78">
                  #{item.rank} {item.ingredient_name_cn || item.ingredient_name_en}
                </div>
                <div>{item.role}</div>
                <div>{item.impact}</div>
              </li>
            ))}
            {profile.key_ingredients.length === 0 ? <li>-</li> : null}
          </ul>
        </div>
        <div className="rounded-xl border border-black/8 bg-[#fafafa] px-3 py-3">
          <div className="text-[13px] font-semibold text-black/82">证据与缺口</div>
          <div className="mt-2 text-[12px] text-black/62">
            positive {profile.evidence.positive.length} · counter {profile.evidence.counter.length}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {profile.evidence.missing_codes.map((item) => (
              <span key={item} className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-[11px] text-black/58">
                {item}
              </span>
            ))}
            {profile.evidence.missing_codes.length === 0 ? (
              <span className="rounded-full border border-[#d5eadb] bg-[#edf8f0] px-2 py-0.5 text-[11px] text-[#116a3f]">
                no missing codes
              </span>
            ) : null}
          </div>
          <div className="mt-3 text-[12px] leading-[1.55] text-black/58">{profile.confidence_reason}</div>
        </div>
      </div>
    </div>
  );
}

function ListCard({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "green" | "amber" | "blue" | "red";
}) {
  const toneClass =
    tone === "green"
      ? "border-[#d5eadb] bg-[#f4fbf5]"
      : tone === "amber"
        ? "border-[#f4dfb1] bg-[#fffaf0]"
        : tone === "blue"
          ? "border-[#d3e2ff] bg-[#f5f8ff]"
          : "border-[#f0d6d2] bg-[#fff7f6]";
  return (
    <div className={`rounded-xl border px-3 py-3 ${toneClass}`}>
      <div className="text-[13px] font-semibold text-black/82">{title}</div>
      <ul className="mt-2 space-y-1 text-[12px] leading-[1.55] text-black/62">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
        {items.length === 0 ? <li>-</li> : null}
      </ul>
    </div>
  );
}

function categoryLabel(category?: string | null): string {
  if (!category) return "-";
  const key = category.toLowerCase() as keyof typeof CATEGORY_CONFIG;
  return CATEGORY_CONFIG[key]?.zh || category;
}

function parseAnalysisResult(value: Record<string, unknown> | undefined): ProductAnalysisBuildResponse | null {
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
    items: Array.isArray(value.items) ? (value.items as ProductAnalysisBuildResponse["items"]) : [],
    failures: Array.isArray(value.failures) ? (value.failures as string[]) : [],
  };
}

function buildSummary(result: ProductAnalysisBuildResponse): string {
  const lines: string[] = [];
  lines.push(`状态: ${result.status}`);
  lines.push(`扫描产品: ${result.scanned_products}`);
  lines.push(`submitted=${result.submitted_to_model}, created=${result.created}, updated=${result.updated}, skipped=${result.skipped}, failed=${result.failed}`);
  if (result.failures.length > 0) {
    lines.push("");
    lines.push(`失败明细: ${result.failures.length}`);
    for (const failure of result.failures.slice(0, 10)) {
      lines.push(`- ${failure}`);
    }
  }
  return lines.join("\n");
}

function formatDiagnosticLabel(key: string): string {
  return key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatJobHint(job: ProductWorkbenchJob | null): string {
  if (!job) return "待命：可创建新的产品增强分析任务。";
  if (job.status === "queued") return "任务排队中，等待执行。";
  if (job.status === "running") return "任务运行中，刷新页面后可恢复。";
  if (job.status === "cancelling") return "已收到取消请求，当前产品完成后停止。";
  if (job.status === "cancelled") return "任务已取消，可按需重试。";
  if (job.status === "failed") return "任务失败，可查看日志定位并重试。";
  return "任务已完成。";
}
