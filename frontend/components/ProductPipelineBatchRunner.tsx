"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatErrorDetail } from "@/components/workbench/useProductWorkbenchJobs";
import {
  Product,
  ProductWorkbenchJob,
  IngredientLibraryBuildJob,
  IngredientLibraryPreflightResponse,
  cancelIngredientLibraryBuildJob,
  cancelMobileSelectionResultJob,
  cancelProductAnalysisJob,
  cancelProductDedupJob,
  cancelProductRouteMappingJob,
  createIngredientLibraryBuildJob,
  createMobileSelectionResultJob,
  createProductAnalysisJob,
  createProductDedupJob,
  createProductRouteMappingJob,
  fetchIngredientLibraryBuildJob,
  fetchIngredientLibraryPreflight,
  fetchMobileSelectionResultJob,
  fetchProductAnalysisJob,
  fetchProductDedupJob,
  fetchProductRouteMappingJob,
  listIngredientLibraryBuildJobs,
  listMobileSelectionResultJobs,
  listProductAnalysisJobs,
  listProductDedupJobs,
  listProductRouteMappingJobs,
  retryIngredientLibraryBuildJob,
  retryMobileSelectionResultJob,
  retryProductAnalysisJob,
  retryProductDedupJob,
  retryProductRouteMappingJob,
} from "@/lib/api";
import { CATEGORY_CONFIG } from "@/lib/catalog";

type PipelineStageKey = "dedup" | "ingredient" | "route_mapping" | "analysis" | "selection";
type PipelineRunnerStatus = "idle" | "running" | "cancelling" | "failed" | "done" | "cancelled";
type PipelineStageRunStatus = "pending" | "queued" | "running" | "done" | "failed" | "cancelled" | "skipped";
type ModelTier = "mini" | "lite" | "pro";
type PipelineCategory = "all" | "shampoo" | "bodywash" | "conditioner" | "lotion" | "cleanser";

type PipelineJobSnapshot = {
  jobId: string;
  status: ProductWorkbenchJob["status"] | IngredientLibraryBuildJob["status"];
  percent: number;
  stageLabel: string | null;
  message: string | null;
  updatedAt: string | null;
  errorDetail: string | null;
};

type PipelineStageState = {
  status: PipelineStageRunStatus;
  jobId: string | null;
  percent: number;
  stageLabel: string | null;
  message: string | null;
  updatedAt: string | null;
  errorDetail: string | null;
};

type PersistedPipelineState = {
  version: 1;
  runnerStatus: PipelineRunnerStatus;
  currentStageKey: PipelineStageKey | null;
  selectedCategory: PipelineCategory;
  dedupModelTier: ModelTier;
  forceRegenerateDownstream: boolean;
  onlyUnmapped: boolean;
  onlyUnanalyzed: boolean;
  onlyMissing: boolean;
  selectedNormalizationPackages: string[];
  enabledStages: Record<PipelineStageKey, boolean>;
  stageStates: Record<PipelineStageKey, PipelineStageState>;
  infoMessage: string | null;
  errorMessage: string | null;
};

const STORAGE_KEY = "product-pipeline-batch-runner-state-v1";
const POLL_INTERVAL_MS = 2200;
const DEDUP_AUTO_SELECT_CONFIDENCE_GT = 95;
const SUPPORTED_ROUTE_CATEGORIES = ["shampoo", "bodywash", "conditioner", "lotion", "cleanser"] as const;
const CATEGORY_OPTIONS: PipelineCategory[] = ["all", ...SUPPORTED_ROUTE_CATEGORIES];
const STAGE_ORDER: PipelineStageKey[] = ["dedup", "ingredient", "route_mapping", "analysis", "selection"];
const STAGE_META: Record<PipelineStageKey, { labelZh: string; shortZh: string; href: string }> = {
  dedup: {
    labelZh: "同品归并台",
    shortZh: "同品归并",
    href: "/product/pipeline#product-dedup-manager",
  },
  ingredient: {
    labelZh: "成分分析台",
    shortZh: "成分分析",
    href: "/product/pipeline#ingredient-library-generator",
  },
  route_mapping: {
    labelZh: "产品类型映射台",
    shortZh: "类型映射",
    href: "/product/pipeline#product-route-mapping-generator",
  },
  analysis: {
    labelZh: "产品增强分析台",
    shortZh: "增强分析",
    href: "/product/pipeline#product-analysis-generator",
  },
  selection: {
    labelZh: "测评结果场景生成台",
    shortZh: "场景生成",
    href: "/product/pipeline#mobile-selection-result-generator",
  },
};

const IDLE_STAGE_STATE: PipelineStageState = {
  status: "pending",
  jobId: null,
  percent: 0,
  stageLabel: null,
  message: null,
  updatedAt: null,
  errorDetail: null,
};

const MODEL_TIER_OPTIONS: Array<{ value: ModelTier; label: string }> = [
  { value: "mini", label: "Mini" },
  { value: "lite", label: "Lite" },
  { value: "pro", label: "Pro" },
];

export default function ProductPipelineBatchRunner({
  initialProducts,
}: {
  initialProducts: Product[];
}) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<PipelineCategory>("all");
  const [dedupModelTier, setDedupModelTier] = useState<ModelTier>("pro");
  const [forceRegenerateDownstream, setForceRegenerateDownstream] = useState(false);
  const [onlyUnmapped, setOnlyUnmapped] = useState(true);
  const [onlyUnanalyzed, setOnlyUnanalyzed] = useState(true);
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [selectedNormalizationPackages, setSelectedNormalizationPackages] = useState<string[]>([]);
  const [enabledStages, setEnabledStages] = useState<Record<PipelineStageKey, boolean>>({
    dedup: true,
    ingredient: true,
    route_mapping: true,
    analysis: true,
    selection: true,
  });
  const [runnerStatus, setRunnerStatus] = useState<PipelineRunnerStatus>("idle");
  const [currentStageKey, setCurrentStageKey] = useState<PipelineStageKey | null>(null);
  const [stageStates, setStageStates] = useState<Record<PipelineStageKey, PipelineStageState>>(createInitialStageStates());
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [preflightResult, setPreflightResult] = useState<IngredientLibraryPreflightResponse | null>(null);
  const [preflightError, setPreflightError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const hydratedRef = useRef(false);
  const startLockRef = useRef(false);

  const supportedProducts = useMemo(() => {
    return initialProducts.filter((item) => {
      const category = String(item.category || "").trim().toLowerCase();
      return SUPPORTED_ROUTE_CATEGORIES.includes(category as (typeof SUPPORTED_ROUTE_CATEGORIES)[number]);
    });
  }, [initialProducts]);

  const categoryStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of initialProducts) {
      const key = String(item.category || "unknown").trim().toLowerCase();
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [initialProducts]);

  const canRunRouteStages = supportedProducts.length > 0;
  const selectedStageCount = STAGE_ORDER.filter((stageKey) => enabledStages[stageKey]).length;
  const activeStage = currentStageKey ? STAGE_META[currentStageKey] : null;
  const activeStageState = currentStageKey ? stageStates[currentStageKey] : null;
  const canStartPipeline =
    selectedStageCount > 0 &&
    runnerStatus !== "running" &&
    runnerStatus !== "cancelling" &&
    (!enabledStages.ingredient || !preflightLoading);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as PersistedPipelineState;
        if (parsed.version === 1) {
          setRunnerStatus(parsed.runnerStatus || "idle");
          setCurrentStageKey(parsed.currentStageKey || null);
          setSelectedCategory(parsed.selectedCategory || "all");
          setDedupModelTier(parsed.dedupModelTier || "pro");
          setForceRegenerateDownstream(Boolean(parsed.forceRegenerateDownstream));
          setOnlyUnmapped(parsed.onlyUnmapped !== false);
          setOnlyUnanalyzed(parsed.onlyUnanalyzed !== false);
          setOnlyMissing(parsed.onlyMissing !== false);
          setSelectedNormalizationPackages(Array.isArray(parsed.selectedNormalizationPackages) ? parsed.selectedNormalizationPackages : []);
          setEnabledStages((prev) => ({ ...prev, ...(parsed.enabledStages || {}) }));
          setStageStates(mergeStageStates(parsed.stageStates));
          setInfoMessage(parsed.infoMessage || null);
          setErrorMessage(parsed.errorMessage || null);
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    hydratedRef.current = true;
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    const payload: PersistedPipelineState = {
      version: 1,
      runnerStatus,
      currentStageKey,
      selectedCategory,
      dedupModelTier,
      forceRegenerateDownstream,
      onlyUnmapped,
      onlyUnanalyzed,
      onlyMissing,
      selectedNormalizationPackages,
      enabledStages,
      stageStates,
      infoMessage,
      errorMessage,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [
    currentStageKey,
    dedupModelTier,
    enabledStages,
    errorMessage,
    forceRegenerateDownstream,
    infoMessage,
    onlyMissing,
    onlyUnanalyzed,
    onlyUnmapped,
    runnerStatus,
    selectedCategory,
    selectedNormalizationPackages,
    stageStates,
  ]);

  useEffect(() => {
    let cancelled = false;
    setPreflightLoading(true);
    setPreflightError(null);
    void fetchIngredientLibraryPreflight({
      category: selectedCategory === "all" ? undefined : selectedCategory,
      normalization_packages: selectedNormalizationPackages,
      max_merge_preview: 80,
    })
      .then((resp) => {
        if (cancelled) return;
        setPreflightResult(resp);
        setSelectedNormalizationPackages((prev) => {
          if (prev.length > 0) return prev;
          return normalizePackageIds(resp.selected_packages || []);
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setPreflightError(formatErrorDetail(err));
      })
      .finally(() => {
        if (!cancelled) setPreflightLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCategory]);

  useEffect(() => {
    if (!hydrated) return;
    if (!currentStageKey) return;
    if (runnerStatus !== "running" && runnerStatus !== "cancelling") return;

    let cancelled = false;
    let timer: number | null = null;

    const pull = async () => {
      try {
        const snapshot = await fetchStageJob(currentStageKey, stageStates[currentStageKey]?.jobId);
        if (cancelled) return;
        applyStageSnapshot(currentStageKey, snapshot);
        if (isTerminalJobStatus(snapshot.status)) {
          await handleTerminalStageSnapshot(currentStageKey, snapshot);
          return;
        }
        setErrorMessage(null);
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(formatErrorDetail(err));
      }
      if (cancelled) return;
      timer = window.setTimeout(() => {
        void pull();
      }, POLL_INTERVAL_MS);
    };

    void pull();
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [currentStageKey, hydrated, runnerStatus, stageStates]);

  async function startPipeline() {
    if (!canStartPipeline || startLockRef.current) return;
    startLockRef.current = true;
    try {
      setErrorMessage(null);
      setInfoMessage(null);
      const conflictMessage = await checkStageConflicts();
      if (conflictMessage) {
        setRunnerStatus("idle");
        setCurrentStageKey(null);
        setErrorMessage(conflictMessage);
        return;
      }

      const nextStates = createInitialStageStates();
      for (const stageKey of STAGE_ORDER) {
        if (!enabledStages[stageKey]) {
          nextStates[stageKey] = {
            ...IDLE_STAGE_STATE,
            status: "skipped",
            message: "本次未纳入流水线。",
          };
          continue;
        }
        if (!canStageRun(stageKey)) {
          nextStates[stageKey] = {
            ...IDLE_STAGE_STATE,
            status: "skipped",
            message: stageUnavailableReason(stageKey),
          };
        }
      }
      setStageStates(nextStates);
      setRunnerStatus("running");

      const firstStage = getNextRunnableStage(nextStates, null);
      if (!firstStage) {
        setRunnerStatus("cancelled");
        setInfoMessage("当前没有可执行的流水线步骤。");
        return;
      }
      await launchStage(firstStage, nextStates);
    } finally {
      startLockRef.current = false;
    }
  }

  async function retryFailedStageAndContinue() {
    if (!currentStageKey) return;
    const currentState = stageStates[currentStageKey];
    if (!currentState?.jobId || currentState.status !== "failed") return;
    setErrorMessage(null);
    setInfoMessage(`正在重试 ${STAGE_META[currentStageKey].shortZh}...`);
    setRunnerStatus("running");
    try {
      const snapshot = await retryStageJob(currentStageKey, currentState.jobId);
      applyStageSnapshot(currentStageKey, snapshot);
    } catch (err) {
      setRunnerStatus("failed");
      setErrorMessage(formatErrorDetail(err));
    }
  }

  async function cancelPipeline() {
    if (!currentStageKey) return;
    const currentState = stageStates[currentStageKey];
    if (!currentState?.jobId) return;
    setRunnerStatus("cancelling");
    setErrorMessage(null);
    setInfoMessage(`正在终止 ${STAGE_META[currentStageKey].shortZh}...`);
    try {
      const snapshot = await cancelStageJob(currentStageKey, currentState.jobId);
      applyStageSnapshot(currentStageKey, snapshot);
      if (isTerminalJobStatus(snapshot.status)) {
        await handleTerminalStageSnapshot(currentStageKey, snapshot);
      }
    } catch (err) {
      setRunnerStatus("failed");
      setErrorMessage(formatErrorDetail(err));
    }
  }

  async function refreshCurrentStage() {
    if (!currentStageKey) {
      setInfoMessage("当前没有在跑的流水线步骤。");
      return;
    }
    const currentState = stageStates[currentStageKey];
    if (!currentState?.jobId) {
      setInfoMessage("当前步骤还没有 job 记录。");
      return;
    }
    try {
      const snapshot = await fetchStageJob(currentStageKey, currentState.jobId);
      applyStageSnapshot(currentStageKey, snapshot);
      setErrorMessage(null);
      setInfoMessage(`已刷新 ${STAGE_META[currentStageKey].shortZh} 状态。`);
    } catch (err) {
      setErrorMessage(formatErrorDetail(err));
    }
  }

  async function launchStage(
    stageKey: PipelineStageKey,
    stagedStates: Record<PipelineStageKey, PipelineStageState>,
  ) {
    const label = STAGE_META[stageKey].shortZh;
    setCurrentStageKey(stageKey);
    setInfoMessage(`已开始 ${label}，后续步骤会按顺序自动推进。`);
    const snapshot = await createStageJob(stageKey, {
      category: selectedCategory,
      dedupModelTier,
      forceRegenerateDownstream,
      onlyUnmapped,
      onlyUnanalyzed,
      onlyMissing,
      selectedNormalizationPackages,
      productCount: initialProducts.length,
    });
    const mergedStates = {
      ...stagedStates,
      [stageKey]: toStageState(snapshot),
    };
    setStageStates(mergedStates);
    setCurrentStageKey(stageKey);
  }

  async function handleTerminalStageSnapshot(stageKey: PipelineStageKey, snapshot: PipelineJobSnapshot) {
    const stageLabel = STAGE_META[stageKey].shortZh;
    if (snapshot.status === "done") {
      if (runnerStatus === "cancelling") {
        setRunnerStatus("cancelled");
        setInfoMessage(`${stageLabel} 已结束，流水线按你的终止请求停止。`);
        return;
      }
      const nextStage = getNextRunnableStage(
        {
          ...stageStates,
          [stageKey]: toStageState(snapshot),
        },
        stageKey,
      );
      if (!nextStage) {
        setRunnerStatus("done");
        setCurrentStageKey(null);
        setInfoMessage("流水线已全部完成。单独台面仍可继续做人工复核或重跑。");
        router.refresh();
        return;
      }
      try {
        await launchStage(nextStage, {
          ...stageStates,
          [stageKey]: toStageState(snapshot),
        });
      } catch (err) {
        setRunnerStatus("failed");
        setCurrentStageKey(nextStage);
        setErrorMessage(formatErrorDetail(err));
      }
      return;
    }

    if (snapshot.status === "cancelled") {
      setRunnerStatus("cancelled");
      setCurrentStageKey(stageKey);
      setInfoMessage(`${stageLabel} 已取消，流水线已停止。`);
      return;
    }

    setRunnerStatus("failed");
    setCurrentStageKey(stageKey);
    setErrorMessage(snapshot.errorDetail || `${stageLabel} 失败，请检查对应台面的日志并决定是否重试。`);
  }

  function applyStageSnapshot(stageKey: PipelineStageKey, snapshot: PipelineJobSnapshot) {
    setStageStates((prev) => ({
      ...prev,
      [stageKey]: toStageState(snapshot),
    }));
  }

  function toggleStageEnabled(stageKey: PipelineStageKey, checked: boolean) {
    setEnabledStages((prev) => ({
      ...prev,
      [stageKey]: checked,
    }));
  }

  function canStageRun(stageKey: PipelineStageKey): boolean {
    if (stageKey === "dedup" || stageKey === "ingredient") {
      return initialProducts.length > 0;
    }
    return canRunRouteStages;
  }

  return (
    <section id="product-pipeline-batch-runner" className="mt-8 rounded-[30px] border border-black/10 bg-gradient-to-br from-[#f4fbff] via-white to-[#f4fbf6] p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/62">
          新 Tag · 上传后流水线总控
        </span>
        <span className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/62">
          一次提交，按顺序跑完后续 5 台
        </span>
        <span className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/62">
          刷新可恢复
        </span>
      </div>

      <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.02em] text-black/90">产品流水线总控台</h2>
      <p className="mt-2 text-[14px] leading-[1.6] text-black/65">
        产品上传台保持单独操作；上传完成后，可以在这里把“同品归并 → 成分分析 → 类型映射 → 增强分析 → 测评结果场景生成”按固定顺序一揽子跑完。单独台面仍然保留，方便你中途人工介入、单独重试或复核。
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <span className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] font-medium text-black/72">
          当前产品数：{initialProducts.length}
        </span>
        <span className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] font-medium text-black/72">
          支持后 3 台的产品数：{supportedProducts.length}
        </span>
        {categoryStats.map(([category, count]) => (
          <span key={category} className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] text-black/66">
            {categoryLabel(category)} · {count}
          </span>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-black/10 bg-white p-4">
          <div className="text-[13px] font-semibold text-black/82">流水线范围</div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {CATEGORY_OPTIONS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setSelectedCategory(item)}
                disabled={runnerStatus === "running" || runnerStatus === "cancelling"}
                className={`rounded-full border px-3 py-1 text-[12px] ${
                  selectedCategory === item ? "border-black bg-black text-white" : "border-black/12 bg-white text-black/68"
                } disabled:opacity-45`}
              >
                {item === "all" ? "全部品类" : categoryLabel(item)}
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
            {STAGE_ORDER.map((stageKey) => {
              const meta = STAGE_META[stageKey];
              const enabled = enabledStages[stageKey];
              const disabled = !canStageRun(stageKey);
              return (
                <label key={stageKey} className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 ${disabled ? "border-black/8 bg-[#fafafa]" : "border-black/10 bg-[#fbfcff]"}`}>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(event) => toggleStageEnabled(stageKey, event.target.checked)}
                    disabled={runnerStatus === "running" || runnerStatus === "cancelling" || disabled}
                    className="mt-0.5 h-4 w-4"
                  />
                  <div>
                    <div className="text-[12px] font-semibold text-black/82">{meta.labelZh}</div>
                    <div className="mt-0.5 text-[11px] text-black/58">
                      {disabled ? stageUnavailableReason(stageKey) : `纳入总控顺序：${stageSequenceLabel(stageKey)}`}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[180px_1fr]">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-black/70">同品归并模型档位</span>
              <select
                value={dedupModelTier}
                onChange={(event) => setDedupModelTier(event.target.value as ModelTier)}
                disabled={runnerStatus === "running" || runnerStatus === "cancelling"}
                className="h-10 rounded-xl border border-black/12 bg-white px-3 text-[13px] outline-none focus:border-black/35"
              >
                {MODEL_TIER_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="space-y-2 rounded-xl border border-black/10 bg-[#fbfcff] px-3 py-3">
              <label className="flex items-start gap-2 text-[12px] text-black/66">
                <input
                  type="checkbox"
                  checked={forceRegenerateDownstream}
                  onChange={(event) => setForceRegenerateDownstream(event.target.checked)}
                  disabled={runnerStatus === "running" || runnerStatus === "cancelling"}
                  className="mt-0.5 h-4 w-4"
                />
                <span>下游四台强制重跑，忽略已有指纹与现成结果。</span>
              </label>
              <label className="flex items-start gap-2 text-[12px] text-black/66">
                <input
                  type="checkbox"
                  checked={onlyUnmapped}
                  onChange={(event) => setOnlyUnmapped(event.target.checked)}
                  disabled={runnerStatus === "running" || runnerStatus === "cancelling"}
                  className="mt-0.5 h-4 w-4"
                />
                <span>类型映射默认只补未映射产品。</span>
              </label>
              <label className="flex items-start gap-2 text-[12px] text-black/66">
                <input
                  type="checkbox"
                  checked={onlyUnanalyzed}
                  onChange={(event) => setOnlyUnanalyzed(event.target.checked)}
                  disabled={runnerStatus === "running" || runnerStatus === "cancelling"}
                  className="mt-0.5 h-4 w-4"
                />
                <span>增强分析默认只补未分析产品。</span>
              </label>
              <label className="flex items-start gap-2 text-[12px] text-black/66">
                <input
                  type="checkbox"
                  checked={onlyMissing}
                  onChange={(event) => setOnlyMissing(event.target.checked)}
                  disabled={runnerStatus === "running" || runnerStatus === "cancelling"}
                  className="mt-0.5 h-4 w-4"
                />
                <span>场景生成默认只补缺失结果。</span>
              </label>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-black/10 bg-[#f8fafc] px-3 py-3">
            <div className="text-[12px] font-semibold text-black/76">成分归一包</div>
            <div className="mt-1 text-[11px] leading-[1.55] text-black/58">
              总控台会沿用成分分析台的默认预审包。你可以在这里先勾选；如果后面想人工调参，仍然可以回单独台面重跑。
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(preflightResult?.available_packages || []).map((pkg) => {
                const checked = selectedNormalizationPackages.includes(pkg.id);
                return (
                  <label key={pkg.id} className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] text-black/68">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        setSelectedNormalizationPackages((prev) => {
                          if (event.target.checked) return Array.from(new Set([...prev, pkg.id]));
                          return prev.filter((item) => item !== pkg.id);
                        });
                      }}
                      disabled={runnerStatus === "running" || runnerStatus === "cancelling"}
                      className="h-4 w-4"
                    />
                    <span>{pkg.label}</span>
                  </label>
                );
              })}
              {!preflightResult?.available_packages?.length ? (
                <span className="text-[12px] text-black/52">{preflightLoading ? "正在加载默认归一包..." : "当前没有可选归一包。"}</span>
              ) : null}
            </div>
            {preflightError ? <div className="mt-2 text-[12px] text-[#b42318]">{preflightError}</div> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-black/10 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[13px] font-semibold text-black/82">当前总控状态</div>
              <div className="mt-1 text-[12px] text-black/58">
                {runnerStatusLabel(runnerStatus)}
                {activeStage ? ` · 当前步骤：${activeStage.labelZh}` : ""}
              </div>
            </div>
            {activeStage ? (
              <Link href={activeStage.href} className="rounded-full border border-black/12 bg-white px-3 py-1.5 text-[12px] text-black/68 hover:bg-black/[0.03]">
                打开当前台面
              </Link>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void startPipeline()}
              disabled={!canStartPipeline}
              className="inline-flex h-10 items-center justify-center rounded-full bg-black px-5 text-[13px] font-semibold text-white disabled:bg-black/25"
            >
              {runnerStatus === "done" ? "重新跑整条流水线" : "开始一揽子流水线"}
            </button>
            <button
              type="button"
              onClick={() => void retryFailedStageAndContinue()}
              disabled={runnerStatus !== "failed" || !currentStageKey || stageStates[currentStageKey]?.status !== "failed"}
              className="inline-flex h-10 items-center justify-center rounded-full border border-[#3151d8]/30 bg-[#eef2ff] px-5 text-[13px] font-semibold text-[#3151d8] disabled:opacity-45"
            >
              重试失败步骤并继续
            </button>
            <button
              type="button"
              onClick={() => void cancelPipeline()}
              disabled={(runnerStatus !== "running" && runnerStatus !== "cancelling") || !activeStageState?.jobId}
              className="inline-flex h-10 items-center justify-center rounded-full border border-[#ef4444]/40 bg-[#fff5f5] px-5 text-[13px] font-semibold text-[#b42318] disabled:opacity-45"
            >
              {runnerStatus === "cancelling" ? "终止中..." : "终止当前步骤并停止"}
            </button>
            <button
              type="button"
              onClick={() => void refreshCurrentStage()}
              disabled={!currentStageKey || !activeStageState?.jobId}
              className="inline-flex h-10 items-center justify-center rounded-full border border-black/14 bg-white px-5 text-[13px] font-semibold text-black/78 disabled:opacity-45"
            >
              刷新当前状态
            </button>
          </div>

          <div className="mt-3 rounded-xl border border-black/10 bg-[#fbfcff] px-3 py-3">
            <div className="text-[12px] font-semibold text-black/78">总控说明</div>
            <ul className="mt-2 space-y-1 text-[12px] leading-[1.6] text-black/60">
              <li>1. 上传台仍然单独做，避免把最容易卡住的上传和后续生产线混在一起。</li>
              <li>2. 这里提交后，会按固定顺序串行盯住后台 job，前一步成功才会进下一步。</li>
              <li>3. 页面刷新后会自动恢复当前步骤，不需要重新从头点一遍。</li>
              <li>4. 某一步失败时会停住，你可以直接打开对应单台复核，或在这里重试后继续。</li>
            </ul>
          </div>

          {infoMessage ? <div className="mt-3 text-[13px] text-[#116a3f]">{infoMessage}</div> : null}
          {errorMessage ? <div className="mt-2 whitespace-pre-wrap text-[13px] text-[#b42318]">{errorMessage}</div> : null}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-5">
        {STAGE_ORDER.map((stageKey) => {
          const meta = STAGE_META[stageKey];
          const state = stageStates[stageKey];
          const isCurrent = currentStageKey === stageKey;
          return (
            <div
              key={stageKey}
              className={`rounded-2xl border px-4 py-4 ${
                isCurrent ? "border-black bg-black text-white" : "border-black/10 bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className={`text-[11px] font-semibold tracking-[0.12em] ${isCurrent ? "text-white/72" : "text-black/42"}`}>
                    {stageSequenceLabel(stageKey)}
                  </div>
                  <div className={`mt-1 text-[15px] font-semibold ${isCurrent ? "text-white" : "text-black/84"}`}>{meta.shortZh}</div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${stageBadgeClass(isCurrent, state.status)}`}>
                  {stageStatusLabel(state.status)}
                </span>
              </div>
              <div className={`mt-3 h-2 overflow-hidden rounded-full ${isCurrent ? "bg-white/15" : "bg-black/8"}`}>
                <div
                  className={`h-full rounded-full ${isCurrent ? "bg-white" : "bg-black"}`}
                  style={{ width: `${Math.max(0, Math.min(100, state.percent || 0))}%` }}
                />
              </div>
              <div className={`mt-2 text-[12px] ${isCurrent ? "text-white/74" : "text-black/58"}`}>
                {state.jobId ? `${state.jobId} · ${Math.max(0, Math.min(100, state.percent || 0))}%` : "尚未创建 job"}
              </div>
              <div className={`mt-1 min-h-[40px] text-[12px] leading-[1.55] ${isCurrent ? "text-white/82" : "text-black/66"}`}>
                {state.errorDetail || state.message || "等待前序步骤。"}
              </div>
              <div className="mt-3">
                <Link
                  href={meta.href}
                  className={`inline-flex rounded-full border px-3 py-1.5 text-[12px] ${
                    isCurrent
                      ? "border-white/20 bg-white/10 text-white hover:bg-white/15"
                      : "border-black/12 bg-white text-black/68 hover:bg-black/[0.03]"
                  }`}
                >
                  打开单独台面
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );

  async function checkStageConflicts(): Promise<string | null> {
    const conflicts: string[] = [];
    for (const stageKey of STAGE_ORDER) {
      if (!enabledStages[stageKey] || !canStageRun(stageKey)) continue;
      try {
        const rows = await listStageJobs(stageKey);
        const active = rows.find((item) => isActiveJobStatus(item.status));
        if (active) {
          conflicts.push(`${STAGE_META[stageKey].labelZh}: ${active.jobId} (${active.status})`);
        }
      } catch (err) {
        return `启动前检查 ${STAGE_META[stageKey].labelZh} 时失败：${formatErrorDetail(err)}`;
      }
    }
    if (conflicts.length === 0) return null;
    return `当前已有其他后台任务正在占用这些台面，先不要再开整条流水线：\n${conflicts.map((item) => `- ${item}`).join("\n")}`;
  }
}

function createInitialStageStates(): Record<PipelineStageKey, PipelineStageState> {
  return {
    dedup: { ...IDLE_STAGE_STATE },
    ingredient: { ...IDLE_STAGE_STATE },
    route_mapping: { ...IDLE_STAGE_STATE },
    analysis: { ...IDLE_STAGE_STATE },
    selection: { ...IDLE_STAGE_STATE },
  };
}

function mergeStageStates(
  raw: Partial<Record<PipelineStageKey, PipelineStageState>> | undefined,
): Record<PipelineStageKey, PipelineStageState> {
  const base = createInitialStageStates();
  if (!raw) return base;
  for (const stageKey of STAGE_ORDER) {
    if (!raw[stageKey]) continue;
    base[stageKey] = {
      ...IDLE_STAGE_STATE,
      ...raw[stageKey],
    };
  }
  return base;
}

function normalizePackageIds(values: string[]): string[] {
  return Array.from(new Set((values || []).map((item) => String(item || "").trim()).filter(Boolean)));
}

function categoryLabel(category?: string | null): string {
  if (!category) return "-";
  const key = category.toLowerCase() as keyof typeof CATEGORY_CONFIG;
  return CATEGORY_CONFIG[key]?.zh || category;
}

function stageSequenceLabel(stageKey: PipelineStageKey): string {
  switch (stageKey) {
    case "dedup":
      return "STEP 1";
    case "ingredient":
      return "STEP 2";
    case "route_mapping":
      return "STEP 3";
    case "analysis":
      return "STEP 4";
    case "selection":
      return "STEP 5";
  }
}

function runnerStatusLabel(status: PipelineRunnerStatus): string {
  switch (status) {
    case "running":
      return "运行中";
    case "cancelling":
      return "终止中";
    case "failed":
      return "已停在失败步骤";
    case "done":
      return "全部完成";
    case "cancelled":
      return "已停止";
    default:
      return "待命";
  }
}

function stageStatusLabel(status: PipelineStageRunStatus): string {
  switch (status) {
    case "queued":
      return "排队中";
    case "running":
      return "执行中";
    case "done":
      return "完成";
    case "failed":
      return "失败";
    case "cancelled":
      return "已取消";
    case "skipped":
      return "跳过";
    default:
      return "待执行";
  }
}

function stageBadgeClass(isCurrent: boolean, status: PipelineStageRunStatus): string {
  if (isCurrent) return "bg-white/12 text-white";
  switch (status) {
    case "done":
      return "bg-[#eefbf3] text-[#116a3f]";
    case "failed":
      return "bg-[#fff5f5] text-[#b42318]";
    case "running":
    case "queued":
      return "bg-[#eef2ff] text-[#3151d8]";
    case "cancelled":
      return "bg-[#f6f7f9] text-black/60";
    case "skipped":
      return "bg-[#fafafa] text-black/54";
    default:
      return "bg-[#fafafa] text-black/60";
  }
}

function stageUnavailableReason(stageKey: PipelineStageKey): string {
  switch (stageKey) {
    case "dedup":
    case "ingredient":
      return "当前没有已上传产品。";
    case "route_mapping":
    case "analysis":
    case "selection":
      return "当前产品集合里没有支持的品类。";
  }
}

function getNextRunnableStage(
  stageStates: Record<PipelineStageKey, PipelineStageState>,
  currentStageKey: PipelineStageKey | null,
): PipelineStageKey | null {
  const currentIndex = currentStageKey ? STAGE_ORDER.indexOf(currentStageKey) : -1;
  for (let index = currentIndex + 1; index < STAGE_ORDER.length; index += 1) {
    const stageKey = STAGE_ORDER[index];
    if (stageStates[stageKey].status === "pending") return stageKey;
  }
  return null;
}

function toStageState(snapshot: PipelineJobSnapshot): PipelineStageState {
  return {
    status: mapJobStatus(snapshot.status),
    jobId: snapshot.jobId,
    percent: snapshot.percent,
    stageLabel: snapshot.stageLabel,
    message: snapshot.message,
    updatedAt: snapshot.updatedAt,
    errorDetail: snapshot.errorDetail,
  };
}

function mapJobStatus(
  status: ProductWorkbenchJob["status"] | IngredientLibraryBuildJob["status"],
): PipelineStageRunStatus {
  if (status === "done") return "done";
  if (status === "failed") return "failed";
  if (status === "cancelled") return "cancelled";
  if (status === "queued") return "queued";
  if (status === "running" || status === "cancelling") return "running";
  return "pending";
}

function isActiveJobStatus(status: string): boolean {
  return status === "queued" || status === "running" || status === "cancelling";
}

function isTerminalJobStatus(status: string): boolean {
  return status === "done" || status === "failed" || status === "cancelled";
}

function toJobSnapshot(job: ProductWorkbenchJob | IngredientLibraryBuildJob): PipelineJobSnapshot {
  return {
    jobId: String(job.job_id || "").trim(),
    status: job.status,
    percent: Number(job.percent || 0),
    stageLabel: String(job.stage_label || job.stage || "").trim() || null,
    message: String(job.message || "").trim() || null,
    updatedAt: String(job.updated_at || "").trim() || null,
    errorDetail: typeof job.error?.detail === "string" ? job.error.detail : null,
  };
}

async function listStageJobs(stageKey: PipelineStageKey): Promise<PipelineJobSnapshot[]> {
  switch (stageKey) {
    case "dedup":
      return (await listProductDedupJobs({ limit: 20, offset: 0 })).map(toJobSnapshot);
    case "ingredient":
      return (await listIngredientLibraryBuildJobs({ limit: 20, offset: 0 })).map(toJobSnapshot);
    case "route_mapping":
      return (await listProductRouteMappingJobs({ limit: 20, offset: 0 })).map(toJobSnapshot);
    case "analysis":
      return (await listProductAnalysisJobs({ limit: 20, offset: 0 })).map(toJobSnapshot);
    case "selection":
      return (await listMobileSelectionResultJobs({ limit: 20, offset: 0 })).map(toJobSnapshot);
  }
}

async function fetchStageJob(
  stageKey: PipelineStageKey,
  jobId: string | null | undefined,
): Promise<PipelineJobSnapshot> {
  const value = String(jobId || "").trim();
  if (!value) throw new Error(`${STAGE_META[stageKey].labelZh} 缺少 job_id，无法继续恢复。`);
  switch (stageKey) {
    case "dedup":
      return toJobSnapshot(await fetchProductDedupJob(value));
    case "ingredient":
      return toJobSnapshot(await fetchIngredientLibraryBuildJob(value));
    case "route_mapping":
      return toJobSnapshot(await fetchProductRouteMappingJob(value));
    case "analysis":
      return toJobSnapshot(await fetchProductAnalysisJob(value));
    case "selection":
      return toJobSnapshot(await fetchMobileSelectionResultJob(value));
  }
}

async function cancelStageJob(stageKey: PipelineStageKey, jobId: string): Promise<PipelineJobSnapshot> {
  switch (stageKey) {
    case "dedup":
      return toJobSnapshot((await cancelProductDedupJob(jobId)).job);
    case "ingredient":
      return toJobSnapshot((await cancelIngredientLibraryBuildJob(jobId)).job);
    case "route_mapping":
      return toJobSnapshot((await cancelProductRouteMappingJob(jobId)).job);
    case "analysis":
      return toJobSnapshot((await cancelProductAnalysisJob(jobId)).job);
    case "selection":
      return toJobSnapshot((await cancelMobileSelectionResultJob(jobId)).job);
  }
}

async function retryStageJob(stageKey: PipelineStageKey, jobId: string): Promise<PipelineJobSnapshot> {
  switch (stageKey) {
    case "dedup":
      return toJobSnapshot(await retryProductDedupJob(jobId));
    case "ingredient":
      return toJobSnapshot(await retryIngredientLibraryBuildJob(jobId));
    case "route_mapping":
      return toJobSnapshot(await retryProductRouteMappingJob(jobId));
    case "analysis":
      return toJobSnapshot(await retryProductAnalysisJob(jobId));
    case "selection":
      return toJobSnapshot(await retryMobileSelectionResultJob(jobId));
  }
}

async function createStageJob(
  stageKey: PipelineStageKey,
  config: {
    category: PipelineCategory;
    dedupModelTier: ModelTier;
    forceRegenerateDownstream: boolean;
    onlyUnmapped: boolean;
    onlyUnanalyzed: boolean;
    onlyMissing: boolean;
    selectedNormalizationPackages: string[];
    productCount: number;
  },
): Promise<PipelineJobSnapshot> {
  const category = config.category === "all" ? undefined : config.category;
  switch (stageKey) {
    case "dedup":
      return toJobSnapshot(
        await createProductDedupJob({
          category,
          model_tier: config.dedupModelTier,
          max_scan_products: Math.max(1, Math.min(500, config.productCount || 1)),
          compare_batch_size: 1,
          min_confidence: DEDUP_AUTO_SELECT_CONFIDENCE_GT + 1,
        }),
      );
    case "ingredient":
      return toJobSnapshot(
        await createIngredientLibraryBuildJob({
          category,
          force_regenerate: config.forceRegenerateDownstream,
          normalization_packages: config.selectedNormalizationPackages,
        }),
      );
    case "route_mapping":
      return toJobSnapshot(
        await createProductRouteMappingJob({
          category,
          force_regenerate: config.forceRegenerateDownstream,
          only_unmapped: config.onlyUnmapped,
        }),
      );
    case "analysis":
      return toJobSnapshot(
        await createProductAnalysisJob({
          category,
          force_regenerate: config.forceRegenerateDownstream,
          only_unanalyzed: config.onlyUnanalyzed,
        }),
      );
    case "selection":
      return toJobSnapshot(
        await createMobileSelectionResultJob({
          category,
          force_regenerate: config.forceRegenerateDownstream,
          only_missing: config.onlyMissing,
        }),
      );
  }
}
