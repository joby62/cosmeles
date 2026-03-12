"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import WorkbenchTaskSection from "@/components/workbench/WorkbenchTaskSection";
import {
  createEmptyLiveTextState,
  formatErrorDetail,
  WorkbenchLiveTextState,
  useProductWorkbenchJobs,
} from "@/components/workbench/useProductWorkbenchJobs";
import {
  Product,
  IngredientLibraryBuildJob,
  IngredientLibraryBuildJobCancelResponse,
  IngredientLibraryBuildJobCreateRequest,
  IngredientLibraryBuildResponse,
  IngredientLibraryNormalizationPackage,
  IngredientLibraryPreflightResponse,
  IngredientLibraryPreflightUsageTopItem,
  IngredientLibraryListItem,
  cancelIngredientLibraryBuildJob,
  createIngredientLibraryBuildJob,
  deleteIngredientLibraryBatch,
  fetchIngredientLibrary,
  fetchIngredientLibraryBuildJob,
  fetchIngredientLibraryPreflight,
  listIngredientLibraryBuildJobs,
  retryIngredientLibraryBuildJob,
} from "@/lib/api";
import { CATEGORY_CONFIG } from "@/lib/catalog";

const ACTIVE_JOB_STORAGE_KEY = "ingredient-library-active-job-id";

export default function IngredientLibraryGenerator({
  initialProducts,
  showCleanupConsole = true,
}: {
  initialProducts: Product[];
  showCleanupConsole?: boolean;
}) {
  const router = useRouter();
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [preflightError, setPreflightError] = useState<string | null>(null);
  const [preflightResult, setPreflightResult] = useState<IngredientLibraryPreflightResponse | null>(null);
  const [normalizationPackages, setNormalizationPackages] = useState<IngredientLibraryNormalizationPackage[]>([]);
  const [selectedNormalizationPackages, setSelectedNormalizationPackages] = useState<string[]>([]);
  const bootstrapLoadedRef = useRef(false);
  const preflightBootstrapLoadedRef = useRef(false);

  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchCategory, setSearchCategory] = useState("");
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<IngredientLibraryListItem[]>([]);
  const [selectedIngredientIds, setSelectedIngredientIds] = useState<string[]>([]);
  const [removeArtifacts, setRemoveArtifacts] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteSummary, setDeleteSummary] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const jobService = useMemo(
    () => ({
      listJobs: listIngredientLibraryBuildJobs,
      fetchJob: fetchIngredientLibraryBuildJob,
      createJob: createIngredientLibraryBuildJob,
      cancelJob: cancelIngredientLibraryBuildJob,
      retryJob: retryIngredientLibraryBuildJob,
    }),
    [],
  );

  const {
    jobLoading,
    jobsLoading,
    errorMessage: jobError,
    activeJob,
    activeRunning,
    progressValue,
    countersText,
    liveText,
    prettyText,
    sortedJobs,
    refreshJobs,
    startJob,
    cancelJob,
    cancelActiveJob,
    retryJob,
    selectJob,
  } = useProductWorkbenchJobs<
    IngredientLibraryBuildJobCreateRequest,
    IngredientLibraryBuildResponse,
    IngredientLibraryBuildJob,
    IngredientLibraryBuildJobCancelResponse
  >({
    storageKey: ACTIVE_JOB_STORAGE_KEY,
    service: jobService,
    parseResult: (job) => job.result || null,
    assembleLiveText: assembleIngredientLiveText,
    formatCountersText: buildIngredientCountersText,
    formatPrettyText: ({ activeJob: current, result }) => buildSummary(current?.result || result || null),
  });

  const categoryStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of initialProducts) {
      const key = (item.category || "unknown").trim().toLowerCase();
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [initialProducts]);

  const loadIngredientItems = useCallback(async () => {
    setItemsLoading(true);
    setItemsError(null);
    try {
      const resp = await fetchIngredientLibrary({
        category: searchCategory || undefined,
        q: searchKeyword.trim() || undefined,
        limit: 500,
        offset: 0,
      });
      setIngredients(resp.items || []);
    } catch (err) {
      setItemsError(formatErrorDetail(err));
      setIngredients([]);
    } finally {
      setItemsLoading(false);
    }
  }, [searchCategory, searchKeyword]);

  const runPreflight = useCallback(async () => {
    setPreflightLoading(true);
    setPreflightError(null);
    try {
      const resp = await fetchIngredientLibraryPreflight({
        normalization_packages: selectedNormalizationPackages,
        max_merge_preview: 180,
      });
      setPreflightResult(resp);
      setNormalizationPackages(resp.available_packages || []);
      const selectedFromServer = normalizePackageIds(resp.selected_packages || []);
      setSelectedNormalizationPackages((prev) => (sameStringArray(prev, selectedFromServer) ? prev : selectedFromServer));
    } catch (err) {
      setPreflightError(formatErrorDetail(err));
    } finally {
      setPreflightLoading(false);
    }
  }, [selectedNormalizationPackages]);

  useEffect(() => {
    if (bootstrapLoadedRef.current) return;
    bootstrapLoadedRef.current = true;
    void refreshJobs();
    if (showCleanupConsole) {
      void loadIngredientItems();
    }
  }, [loadIngredientItems, refreshJobs, showCleanupConsole]);

  useEffect(() => {
    if (preflightBootstrapLoadedRef.current) return;
    preflightBootstrapLoadedRef.current = true;
    void runPreflight();
  }, [runPreflight]);

  async function startBuildJob() {
    if (activeRunning) return;
    await startJob({
      normalization_packages: selectedNormalizationPackages,
    });
  }

  function toggleIngredientSelection(ingredientId: string, checked: boolean) {
    setSelectedIngredientIds((prev) => {
      if (checked) return Array.from(new Set([...prev, ingredientId]));
      return prev.filter((id) => id !== ingredientId);
    });
  }

  function toggleNormalizationPackage(packageId: string, checked: boolean) {
    setSelectedNormalizationPackages((prev) => {
      if (checked) return Array.from(new Set([...prev, packageId]));
      return prev.filter((id) => id !== packageId);
    });
  }

  function selectAllCurrentIngredients() {
    setSelectedIngredientIds(Array.from(new Set([...selectedIngredientIds, ...ingredients.map((item) => item.ingredient_id)])));
  }

  function clearIngredientSelection() {
    setSelectedIngredientIds([]);
  }

  async function deleteSelectedIngredients() {
    if (selectedIngredientIds.length === 0) {
      setDeleteSummary("当前没有勾选成分。");
      return;
    }
    setDeleting(true);
    setDeleteSummary(null);
    setDeleteError(null);
    try {
      const result = await deleteIngredientLibraryBatch({
        ingredient_ids: selectedIngredientIds,
        remove_doubao_artifacts: removeArtifacts,
      });
      setDeleteSummary(
        `清理完成：删除 ${result.deleted_ids.length} 条，缺失 ${result.missing_ids.length} 条，失败 ${result.failed_items.length} 条。`,
      );
      if (result.failed_items.length > 0) {
        setDeleteError(result.failed_items.slice(0, 8).map((item) => `${item.ingredient_id}: ${item.error}`).join("\n"));
      }
      setSelectedIngredientIds([]);
      await loadIngredientItems();
      router.refresh();
    } catch (err) {
      setDeleteError(formatErrorDetail(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="mt-8 rounded-[30px] border border-black/10 bg-gradient-to-br from-[#f8fbff] via-white to-[#f2f8f1] p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/62">
          Stage C · 成分分析与成分库生成
        </span>
        <span className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/62">
          后台任务模式（刷新可恢复）
        </span>
      </div>

      <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.02em] text-black/90">成分分析台（生成成分库）</h2>
      <p className="mt-2 text-[14px] leading-[1.6] text-black/65">
        去重后统一扫描产品成分，按“品类+成分名”生成独立成分条目；任务在后台运行，支持刷新恢复、进度追踪、中途关停与失败重试。
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <span className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] font-medium text-black/72">
          当前产品数：{initialProducts.length}
        </span>
        {categoryStats.map(([category, count]) => (
          <span key={category} className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] text-black/66">
            {categoryLabel(category)} · {count}
          </span>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[13px] font-semibold text-black/82">归一预审（dry-run）</div>
            <div className="mt-1 text-[12px] text-black/58">勾选工具包后执行预审，先看新增兼并是否合理，再启动后台任务。</div>
          </div>
          <button
            type="button"
            onClick={() => void runPreflight()}
            disabled={preflightLoading}
            className="inline-flex h-9 items-center justify-center rounded-full border border-black/12 bg-white px-4 text-[12px] font-semibold text-black/78 disabled:opacity-45"
          >
            {preflightLoading ? "预审中..." : "执行预审"}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {normalizationPackages.map((pkg) => (
            <label key={pkg.id} className="flex items-start gap-2 rounded-xl border border-black/10 bg-[#fbfcff] px-3 py-2.5">
              <input
                type="checkbox"
                checked={selectedNormalizationPackages.includes(pkg.id)}
                onChange={(event) => toggleNormalizationPackage(pkg.id, event.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <div>
                <div className="text-[12px] font-semibold text-black/82">{pkg.label}</div>
                <div className="mt-0.5 text-[11px] text-black/58">{pkg.description}</div>
              </div>
            </label>
          ))}
        </div>

        {preflightError ? <div className="mt-2 text-[13px] text-[#b42318]">{preflightError}</div> : null}

        {preflightResult ? (
          <div className="mt-3 space-y-2">
            <div className="text-[12px] text-black/64">
              scanned {preflightResult.summary.scanned_products} · mentions {preflightResult.summary.total_mentions} · raw unique{" "}
              {preflightResult.summary.raw_unique_ingredients} · unique after {preflightResult.summary.unique_ingredients_after} · merged{" "}
              {preflightResult.summary.merged_delta}
            </div>
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
              <div className="rounded-xl border border-black/8 bg-[#f7faff] px-3 py-2">
                <div className="text-[11px] text-black/52">合并候选</div>
                <div className="mt-0.5 text-[18px] font-semibold text-black/86">{preflightResult.new_merges.length}</div>
              </div>
              <div className="rounded-xl border border-black/8 bg-[#f9fff7] px-3 py-2">
                <div className="text-[11px] text-black/52">合并最多（按提及）</div>
                <div className="mt-0.5 truncate text-[13px] font-semibold text-black/86">
                  {formatTopMerge(preflightResult.new_merges[0])}
                </div>
              </div>
              <div className="rounded-xl border border-black/8 bg-[#fffaf4] px-3 py-2">
                <div className="text-[11px] text-black/52">使用最多（全量）</div>
                <div className="mt-0.5 truncate text-[13px] font-semibold text-black/86">
                  {formatUsageTop(preflightResult.usage_top?.[0])}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
              <div className="max-h-56 space-y-1 overflow-auto rounded-xl border border-black/8 bg-[#fafafa] p-2">
                <div className="px-1 text-[11px] font-semibold text-[#3151d8]">合并排行（按提及次数）</div>
                {preflightResult.new_merges.slice(0, 40).map((item, idx) => (
                  <div key={`${item.category}-${item.canonical_key}-${idx}`} className="rounded-lg border border-black/8 bg-white px-2 py-1.5">
                    <div className="truncate text-[12px] font-semibold text-black/82">
                      #{idx + 1} · {categoryLabel(item.category)} · {item.canonical_name}
                    </div>
                    <div className="mt-0.5 text-[11px] text-black/58">
                      提及 {item.mention_count} · 涉及产品 {item.source_product_count} · 兼并名 {item.merged_names.length}
                    </div>
                  </div>
                ))}
                {preflightResult.new_merges.length === 0 ? <div className="text-[12px] text-black/52">当前工具包组合未产生新增兼并。</div> : null}
              </div>

              <div className="max-h-56 space-y-1 overflow-auto rounded-xl border border-black/8 bg-[#fafafa] p-2">
                <div className="px-1 text-[11px] font-semibold text-[#3151d8]">使用频次 Top（全量）</div>
                {(preflightResult.usage_top || []).slice(0, 40).map((item, idx) => (
                  <div key={`${item.category}-${item.ingredient_id}-${idx}`} className="rounded-lg border border-black/8 bg-white px-2 py-1.5">
                    <div className="truncate text-[12px] font-semibold text-black/82">
                      #{idx + 1} · {categoryLabel(item.category)} · {item.ingredient_name}
                      {item.ingredient_name_en ? ` / ${item.ingredient_name_en}` : ""}
                    </div>
                    <div className="mt-0.5 text-[11px] text-black/58">
                      提及 {item.mention_count} · 涉及产品 {item.source_product_count}
                    </div>
                  </div>
                ))}
                {(preflightResult.usage_top || []).length === 0 ? <div className="text-[12px] text-black/52">暂无可展示的成分使用统计。</div> : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void startBuildJob()}
          disabled={jobLoading || activeRunning}
          className="inline-flex h-10 items-center justify-center rounded-full bg-black px-5 text-[13px] font-semibold text-white disabled:bg-black/25"
        >
          {jobLoading ? "提交中..." : "一键生成成分库（后台）"}
        </button>
      </div>

      <WorkbenchTaskSection
        errorMessage={jobError}
        onRefresh={() => {
          void refreshJobs();
          if (showCleanupConsole) {
            void loadIngredientItems();
          }
          void runPreflight();
        }}
        refreshDisabled={jobsLoading || preflightLoading || (showCleanupConsole && itemsLoading)}
        refreshLabel={jobsLoading || preflightLoading || (showCleanupConsole && itemsLoading) ? "刷新中..." : "刷新任务与成分"}
        onCancelActive={
          activeRunning && activeJob
            ? () => {
                void cancelActiveJob();
              }
            : undefined
        }
        cancelActiveDisabled={jobLoading || !activeRunning || !activeJob || activeJob.status === "cancelling"}
        cancelActiveLabel={activeJob?.status === "cancelling" ? "取消中..." : "中止当前任务"}
        consoleProps={{
          activeJob,
          activeRunning,
          progressValue,
          countersText,
          liveText,
          prettyText,
          jobs: sortedJobs,
          jobLoading,
          onSelectJob: selectJob,
          onCancelJob: (jobId) => {
            void cancelJob(jobId);
          },
          onRetryJob: (jobId) => {
            void retryJob(jobId);
          },
          liveTitle: "实时任务日志",
          prettyTitle: "最终结果摘要",
          waitingLogText: "等待任务日志...",
          waitingPrettyText: "分析中...",
          formatActiveMessage: formatIngredientActiveMessage,
          renderActiveMeta: (job) => (
            <div className="space-y-1 text-[12px] text-black/58">
              {job.current_ingredient_name ? <div>当前成分：{job.current_ingredient_name}</div> : null}
              {job.normalization_packages.length > 0 ? <div>归一工具包：{job.normalization_packages.join(" · ")}</div> : null}
            </div>
          ),
        }}
      />

      {showCleanupConsole ? (
        <div className="mt-6 rounded-2xl border border-black/10 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[20px] font-semibold tracking-[-0.02em] text-black/88">成分清理控制台</h3>
            <span className="text-[12px] text-black/56">可批量清理成分条目与可选 doubao 产物</span>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
            <input
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              placeholder="按成分名/摘要检索"
              className="h-10 rounded-xl border border-black/12 bg-white px-3 text-[13px] outline-none focus:border-black/35"
            />
            <select
              value={searchCategory}
              onChange={(event) => setSearchCategory(event.target.value)}
              className="h-10 rounded-xl border border-black/12 bg-white px-3 text-[13px] outline-none focus:border-black/35"
            >
              <option value="">全部品类</option>
              {categoryStats.map(([category]) => (
                <option key={category} value={category}>
                  {categoryLabel(category)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void loadIngredientItems()}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-black/12 bg-white px-4 text-[13px] font-semibold text-black/78"
            >
              查询成分
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={selectAllCurrentIngredients}
              className="inline-flex h-9 items-center justify-center rounded-full border border-black/12 bg-white px-4 text-[12px] font-semibold text-black/75"
            >
              勾选当前列表
            </button>
            <button
              type="button"
              onClick={clearIngredientSelection}
              className="inline-flex h-9 items-center justify-center rounded-full border border-black/12 bg-white px-4 text-[12px] font-semibold text-black/75"
            >
              清空勾选
            </button>
            <label className="inline-flex items-center gap-2 rounded-full border border-black/12 bg-white px-3 py-1.5 text-[12px] text-black/72">
              <input
                type="checkbox"
                checked={removeArtifacts}
                onChange={(event) => setRemoveArtifacts(event.target.checked)}
                className="h-4 w-4"
              />
              删除关联 doubao_runs
            </label>
            <button
              type="button"
              onClick={() => void deleteSelectedIngredients()}
              disabled={deleting || selectedIngredientIds.length === 0}
              className="inline-flex h-9 items-center justify-center rounded-full border border-[#ef4444]/40 bg-[#fff5f5] px-4 text-[12px] font-semibold text-[#b42318] disabled:opacity-50"
            >
              {deleting ? "清理中..." : `删除勾选 (${selectedIngredientIds.length})`}
            </button>
            <span className="text-[12px] text-black/58">当前列表 {ingredients.length} 条</span>
          </div>

          {deleteSummary ? <div className="mt-2 text-[13px] text-[#116a3f]">{deleteSummary}</div> : null}
          {deleteError ? <pre className="mt-2 whitespace-pre-wrap text-[12px] text-[#b42318]">{deleteError}</pre> : null}
          {itemsError ? <div className="mt-2 text-[13px] text-[#b42318]">{itemsError}</div> : null}

          <div className="mt-3 max-h-[360px] space-y-2 overflow-auto pr-1">
            {ingredients.map((item) => {
              const checked = selectedIngredientIds.includes(item.ingredient_id);
              return (
                <label key={item.ingredient_id} className="flex items-start gap-2 rounded-lg border border-black/10 bg-[#fbfcff] p-2.5">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => toggleIngredientSelection(item.ingredient_id, event.target.checked)}
                    className="mt-1 h-4 w-4"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-black/84">
                      {item.ingredient_name}
                      {item.ingredient_name_en ? ` / ${item.ingredient_name_en}` : ""}
                    </div>
                    <div className="truncate text-[12px] text-black/62">
                      {categoryLabel(item.category)} · source {item.source_count} · id: {item.ingredient_id}
                    </div>
                    <div className="truncate text-[12px] text-black/56">{item.summary || "-"}</div>
                  </div>
                </label>
              );
            })}
            {!itemsLoading && ingredients.length === 0 ? <div className="text-[12px] text-black/52">当前筛选无成分数据。</div> : null}
            {itemsLoading ? <div className="text-[12px] text-black/52">加载中...</div> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function assembleIngredientLiveText(
  job: IngredientLibraryBuildJob | null,
  previous: WorkbenchLiveTextState,
): WorkbenchLiveTextState {
  if (!job) return createEmptyLiveTextState();
  if (job.live_text && job.live_text.trim()) {
    return {
      text: job.live_text.trim(),
      meta: { jobId: job.job_id, source: "backend_live_text" },
    };
  }

  const prevJobId = String(previous.meta.jobId || "");
  let logs = prevJobId === job.job_id && Array.isArray(previous.meta.logs) ? [...(previous.meta.logs as string[])] : [];
  let lastStamp = prevJobId === job.job_id ? String(previous.meta.lastStamp || "") : "";
  let modelBuffer = prevJobId === job.job_id ? String(previous.meta.modelBuffer || "") : "";
  let modelIngredient = prevJobId === job.job_id ? String(previous.meta.modelIngredient || "") : "";
  let modelLogIndex =
    prevJobId === job.job_id && typeof previous.meta.modelLogIndex === "number"
      ? (previous.meta.modelLogIndex as number)
      : null;

  const stage = String(job.stage_label || job.stage || "处理中");
  const stageKey = String(job.stage || "").trim().toLowerCase();
  const message = String(job.message || "").trim();
  const stamp = `${job.updated_at}|${job.status}|${stageKey}|${message}`;

  const appendLine = (line: string) => {
    const text = String(line || "").trim();
    if (!text) return;
    if (logs[logs.length - 1] === text) return;
    logs.push(text);
    if (logs.length > 200) {
      const overflow = logs.length - 200;
      logs = logs.slice(overflow);
      if (typeof modelLogIndex === "number") {
        modelLogIndex = Math.max(0, modelLogIndex - overflow);
      }
    }
  };

  const syncModelLine = () => {
    const merged = modelBuffer.replace(/\s+/g, " ").trim();
    if (!merged) return;
    const ingredient = modelIngredient || "-";
    const line = `[${job.updated_at}] 模型输出流 | ${ingredient} | ${merged}`;
    if (typeof modelLogIndex === "number" && modelLogIndex >= 0 && modelLogIndex < logs.length) {
      logs[modelLogIndex] = line;
    } else {
      logs.push(line);
      modelLogIndex = logs.length - 1;
    }
  };

  const flushModelLine = () => {
    syncModelLine();
    modelBuffer = "";
    modelLogIndex = null;
  };

  if (stamp !== lastStamp) {
    if (stageKey === "ingredient_model_delta") {
      const ingredientId = String(job.current_ingredient_id || "").trim();
      if (ingredientId && modelIngredient && modelIngredient !== ingredientId) {
        flushModelLine();
      }
      if (ingredientId) modelIngredient = ingredientId;
      if (message) {
        modelBuffer = `${modelBuffer}${message}`;
        syncModelLine();
      }
    } else {
      flushModelLine();
      if (message) appendLine(`[${job.updated_at}] ${stage} | ${message}`);
    }
    lastStamp = stamp;
  }

  if (job.status === "done" || job.status === "failed" || job.status === "cancelled") {
    flushModelLine();
    modelIngredient = "";
  }

  return {
    text: logs.join("\n"),
    meta: {
      jobId: job.job_id,
      logs,
      lastStamp,
      modelBuffer,
      modelIngredient,
      modelLogIndex,
    },
  };
}

function buildIngredientCountersText(job: IngredientLibraryBuildJob | null): string | null {
  if (!job) return null;
  return [
    `scanned ${job.counters.scanned_products}`,
    `unique ${job.counters.unique_ingredients}`,
    `submitted ${job.counters.submitted_to_model}`,
    `created ${job.counters.created}`,
    `updated ${job.counters.updated}`,
    `skipped ${job.counters.skipped}`,
    `failed ${job.counters.failed}`,
  ].join(" · ");
}

function formatIngredientActiveMessage(job: IngredientLibraryBuildJob | null): string {
  if (!job) return "待命 · 等待创建任务";
  const stage = String(job.stage_label || job.stage || "待命");
  const stageKey = String(job.stage || "").trim().toLowerCase();
  if (stageKey === "ingredient_model_delta") return `${stage} · ${job.message || "流式生成中…"}`;
  return `${stage} · ${job.message || "处理中"}`;
}

function categoryLabel(category?: string | null): string {
  if (!category) return "-";
  const key = category.toLowerCase() as keyof typeof CATEGORY_CONFIG;
  return CATEGORY_CONFIG[key]?.zh || category;
}

function buildSummary(result: IngredientLibraryBuildResponse | null): string {
  if (!result) return "";
  const lines: string[] = [];
  lines.push(`状态: ${result.status}`);
  lines.push(`扫描产品: ${result.scanned_products}`);
  lines.push(`唯一成分: ${result.unique_ingredients}`);
  lines.push(`created=${result.created}, updated=${result.updated}, skipped=${result.skipped}, failed=${result.failed}`);
  if (result.failures.length > 0) {
    lines.push("");
    lines.push(`失败明细: ${result.failures.length}`);
    for (const failure of result.failures.slice(0, 10)) {
      lines.push(`- ${failure}`);
    }
  }
  return lines.join("\n");
}

function normalizePackageIds(value: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    const id = String(raw || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function sameStringArray(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return false;
  }
  return true;
}

function formatTopMerge(item?: { canonical_name: string; mention_count: number } | null): string {
  if (!item) return "-";
  return `${item.canonical_name} · ${item.mention_count} 次`;
}

function formatUsageTop(item?: IngredientLibraryPreflightUsageTopItem | null): string {
  if (!item) return "-";
  const name = item.ingredient_name_en ? `${item.ingredient_name}/${item.ingredient_name_en}` : item.ingredient_name;
  return `${name} · ${item.mention_count} 次`;
}
