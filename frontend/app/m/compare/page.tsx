"use client";

import Image from "next/image";
import Link from "next/link";
import { memo, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import {
  fetchMobileCompareBootstrap,
  recordMobileCompareEvent,
  runMobileCompareJobStream,
  type MobileCompareJobTargetInput,
  type MobileCompareProductLibraryItem,
  type MobileSelectionCategory,
  uploadMobileCompareCurrentProduct,
} from "@/lib/api";

const CATEGORY_ORDER: MobileSelectionCategory[] = ["shampoo", "bodywash", "conditioner", "lotion", "cleanser"];
const MAX_TOTAL_SELECTION = 3;
const TOTAL_STEPS = 4;

const WAITING_STAGE_ORDER = [
  "prepare",
  "resolve_targets",
  "resolve_target",
  "stage1_vision",
  "stage2_struct",
  "pair_compare",
  "finalize",
  "done",
] as const;
type WaitingStage = (typeof WAITING_STAGE_ORDER)[number];

type CompareStep = 1 | 2 | 3 | 4;

const WAITING_STAGE_LABEL: Record<WaitingStage, string> = {
  prepare: "准备对比任务",
  resolve_targets: "读取待对比产品",
  resolve_target: "整理产品信息",
  stage1_vision: "识别图片文字",
  stage2_struct: "结构化成分信息",
  pair_compare: "生成两两分析",
  finalize: "整理最终结论",
  done: "对比完成",
};

const STEP_TITLE: Record<CompareStep, string> = {
  1: "选择品类",
  2: "确认信息",
  3: "选择对比对象",
  4: "确认开始",
};

const CATEGORY_LABEL_ZH: Record<MobileSelectionCategory, string> = {
  shampoo: "洗发水",
  bodywash: "沐浴露",
  conditioner: "护发素",
  lotion: "润肤霜",
  cleanser: "洗面奶",
};

export default function MobileComparePage() {
  const router = useRouter();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<CompareStep>(1);
  const [category, setCategory] = useState<MobileSelectionCategory>("shampoo");
  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [bootstrap, setBootstrap] = useState<Awaited<ReturnType<typeof fetchMobileCompareBootstrap>> | null>(null);

  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [brand, setBrand] = useState("");
  const [name, setName] = useState("");

  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [progressHint, setProgressHint] = useState("等待开始");
  const [activeStage, setActiveStage] = useState<WaitingStage>("prepare");
  const [activeStageLabel, setActiveStageLabel] = useState(WAITING_STAGE_LABEL.prepare);
  const [progressPercent, setProgressPercent] = useState(0);
  const [pairProgress, setPairProgress] = useState<{ index: number; total: number } | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const recommendationReady = Boolean(bootstrap?.recommendation?.exists);
  const hasHistoryProfile = Boolean(bootstrap?.profile?.has_history_profile);
  const profileBasis = bootstrap?.profile?.basis || "none";
  const currentCategoryLabel = CATEGORY_LABEL_ZH[category];

  const orderedLibraryItems = useMemo(
    () => orderProductLibraryItems(bootstrap?.product_library?.items || []),
    [bootstrap?.product_library?.items],
  );
  const selectedSet = useMemo(() => new Set(selectedProductIds), [selectedProductIds]);

  const selectedCount = selectedProductIds.length;
  const hasUpload = Boolean(file);
  const totalSelectedCount = selectedCount + (hasUpload ? 1 : 0);
  const maxLibrarySelection = hasUpload ? MAX_TOTAL_SELECTION - 1 : MAX_TOTAL_SELECTION;
  const minLibrarySelection = hasUpload ? 1 : 2;

  const canStart =
    !running &&
    !bootstrapLoading &&
    recommendationReady &&
    hasHistoryProfile &&
    selectedCount >= minLibrarySelection &&
    totalSelectedCount >= 2 &&
    totalSelectedCount <= MAX_TOTAL_SELECTION;

  const uploadValuePoints = useMemo(
    () => (bootstrap?.source_guide?.value_points || []).slice(0, 2),
    [bootstrap?.source_guide?.value_points],
  );

  const profileBasisHint =
    profileBasis === "pinned"
      ? "来源：你置顶的个人选项"
      : profileBasis === "latest"
        ? "来源：该品类最近一次确认"
        : "来源：最近一次可用个人选项";

  const selectedProductSummary = useMemo(() => {
    const titleById = new Map<string, string>();
    for (const item of orderedLibraryItems) {
      titleById.set(item.productId, item.title);
    }
    const names = selectedProductIds.map((id) => titleById.get(id) || "未命名产品");
    if (hasUpload) return ["我在用的产品", ...names];
    return names;
  }, [hasUpload, orderedLibraryItems, selectedProductIds]);

  const selectionStatusText = useMemo(() => {
    if (totalSelectedCount <= 0) return "先选 2 款开始";
    if (totalSelectedCount === 1) return "再选 1 款即可开始";
    if (totalSelectedCount === 2) return "已选 2 款，可直接分析";
    return "已选 3 款，已选满";
  }, [totalSelectedCount]);

  const selectionAssistText = hasUpload
    ? `已包含在用产品；还可从产品库选 ${maxLibrarySelection} 款。`
    : "补充上传在用产品后，可额外判断：继续用 / 建议替换 / 分场景混用。";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = new URLSearchParams(window.location.search).get("category");
    const normalized = (raw || "").trim().toLowerCase() as MobileSelectionCategory;
    if (CATEGORY_ORDER.includes(normalized)) setCategory(normalized);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setBootstrapLoading(true);
    setBootstrapError(null);
    setBootstrap(null);
    setRunError(null);
    setProgressHint("等待开始");
    setActiveStage("prepare");
    setActiveStageLabel(WAITING_STAGE_LABEL.prepare);
    setProgressPercent(0);
    setPairProgress(null);
    setElapsedSeconds(0);
    setSelectedProductIds([]);

    void fetchMobileCompareBootstrap(category)
      .then((data) => {
        if (cancelled) return;
        setBootstrap(data);
        if (data.selected_category && data.selected_category !== category) {
          setCategory(data.selected_category);
          return;
        }
        const recommendationId = String(data.product_library?.recommendation_product_id || "").trim();
        const mostUsedId = String(data.product_library?.most_used_product_id || "").trim();
        const fallbackHistoryId = recommendationId || mostUsedId;
        if (fallbackHistoryId) setSelectedProductIds([fallbackHistoryId]);
      })
      .catch((err) => {
        if (cancelled) return;
        setBootstrapError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setBootstrapLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [category]);

  useEffect(() => {
    if (selectedProductIds.length <= maxLibrarySelection) return;
    setSelectedProductIds((prev) => prev.slice(0, maxLibrarySelection));
  }, [maxLibrarySelection, selectedProductIds.length]);

  useEffect(() => {
    if (!file) {
      setUploadPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUploadPreviewUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  useEffect(() => {
    if (!running) {
      setElapsedSeconds(0);
      return;
    }
    const started = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [running]);

  async function startCompare() {
    if (running) return;
    setRunError(null);
    setRunning(true);
    setProgressHint("开始准备对比产品...");
    setActiveStage("prepare");
    setActiveStageLabel(WAITING_STAGE_LABEL.prepare);
    setProgressPercent(4);
    setPairProgress(null);

    void safeTrack("compare_run_start", {
      category,
      profile_mode: "reuse_latest",
      has_upload: hasUpload,
      selected_library_count: selectedCount,
      total_count: totalSelectedCount,
    });

    try {
      const targets: MobileCompareJobTargetInput[] = [];
      if (file) {
        setProgressHint("正在上传你正在用的产品...");
        const uploaded = await uploadMobileCompareCurrentProduct({
          category,
          image: file,
          brand: brand.trim() || undefined,
          name: name.trim() || undefined,
        });
        targets.push({ source: "upload_new", upload_id: uploaded.upload_id });
        void safeTrack("compare_upload_success", { category, upload_id: uploaded.upload_id });
      }

      for (const productId of selectedProductIds) {
        targets.push({ source: "history_product", product_id: productId });
      }

      if (targets.length < 2 || targets.length > MAX_TOTAL_SELECTION) {
        throw new Error("请选择 2~3 款产品后再开始专业对比。");
      }

      const result = await runMobileCompareJobStream(
        {
          category,
          profile_mode: "reuse_latest",
          targets,
          options: {
            include_inci_order_diff: true,
            include_function_rank_diff: true,
          },
        },
        (event) => {
          if (event.event === "progress") {
            const message = String(event.data.message || "").trim();
            const stage = String(event.data.stage || "").trim();
            const stageLabel = String(event.data.stage_label || "").trim();
            const percent = Number(event.data.percent);
            const pairIndex = Number(event.data.pair_index);
            const pairTotal = Number(event.data.pair_total);
            if (message) setProgressHint(message);
            if (stage) {
              const normalizedStage = WAITING_STAGE_ORDER.includes(stage as WaitingStage)
                ? (stage as WaitingStage)
                : "pair_compare";
              setActiveStage(normalizedStage);
              setActiveStageLabel(stageLabel || WAITING_STAGE_LABEL[normalizedStage]);
            }
            if (Number.isFinite(percent)) {
              setProgressPercent(Math.max(0, Math.min(100, Math.round(percent))));
            }
            if (Number.isFinite(pairIndex) && Number.isFinite(pairTotal) && pairTotal > 0) {
              setPairProgress({ index: Math.max(1, Math.round(pairIndex)), total: Math.max(1, Math.round(pairTotal)) });
            }
            return;
          }
          if (event.event === "heartbeat") {
            const message = String(event.data.message || "").trim();
            if (message) setProgressHint(message);
          }
        },
      );

      void safeTrack("compare_run_success", {
        category,
        compare_id: result.compare_id,
        has_upload: hasUpload,
        selected_library_count: selectedCount,
        total_count: totalSelectedCount,
        pair_count: (result.pair_results || []).length,
      });
      router.push(`/m/compare/result/${encodeURIComponent(result.compare_id)}`);
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      setRunError(text);
      void safeTrack("compare_run_error", {
        category,
        error: text,
        has_upload: hasUpload,
        selected_library_count: selectedCount,
        total_count: totalSelectedCount,
      });
    } finally {
      setRunning(false);
    }
  }

  function toggleSelected(pid: string) {
    setSelectedProductIds((prev) => {
      const exists = prev.includes(pid);
      if (exists) return prev.filter((id) => id !== pid);
      if (prev.length >= maxLibrarySelection) return prev;
      return [...prev, pid];
    });
  }

  function goPrevStep() {
    setStep((prev) => (prev <= 1 ? 1 : ((prev - 1) as CompareStep)));
  }

  function goNextStep() {
    setStep((prev) => (prev >= TOTAL_STEPS ? (TOTAL_STEPS as CompareStep) : ((prev + 1) as CompareStep)));
  }

  async function handlePrimaryAction() {
    if (step === 1) {
      goNextStep();
      return;
    }
    if (step === 2) {
      if (!hasHistoryProfile) {
        router.push(`/m/${category}/start`);
        return;
      }
      goNextStep();
      return;
    }
    if (step === 3) {
      if (totalSelectedCount < 2 || totalSelectedCount > MAX_TOTAL_SELECTION) return;
      goNextStep();
      return;
    }
    await startCompare();
  }

  const primaryActionLabel = (() => {
    if (step === 1) return "下一步";
    if (step === 2) return hasHistoryProfile ? "使用这组信息继续" : "去填写个人选项";
    if (step === 3) return totalSelectedCount < 2 ? "先选够 2 款产品" : "下一步";
    return "开始专业分析";
  })();

  const primaryDisabled =
    (step === 2 && bootstrapLoading) ||
    (step === 3 && (bootstrapLoading || totalSelectedCount < 2 || totalSelectedCount > MAX_TOTAL_SELECTION)) ||
    (step === 4 && !canStart);

  let stepBody: React.ReactNode;
  if (step === 1) {
    stepBody = (
      <div>
        <h2 className="text-[26px] leading-[1.18] font-semibold tracking-[-0.02em] text-black/90">先选本次对比品类</h2>
        <p className="mt-2 text-[14px] leading-[1.55] text-black/62">选一个品类，建议会更贴合。</p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          {CATEGORY_ORDER.map((item) => {
            const active = item === category;
            const label = CATEGORY_LABEL_ZH[item];
            return (
              <button
                key={item}
                type="button"
                disabled={running}
                onClick={() => {
                  setCategory(item);
                  void safeTrack("compare_category_selected", { category: item });
                }}
                className={`inline-flex h-11 items-center rounded-full border px-5 text-[14px] font-medium ${
                  active ? "border-black/20 bg-black text-white" : "border-black/12 text-black/75 active:bg-black/[0.03]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    );
  } else if (step === 2) {
    stepBody = (
      <div>
        <h2 className="text-[24px] leading-[1.2] font-semibold tracking-[-0.02em] text-black/90">本次已带入的信息</h2>
        <p className="mt-2 text-[14px] leading-[1.55] text-black/62">以下个人选项将用于本次分析。</p>

        <div className="mt-4 rounded-[20px] border border-black/10 bg-black/[0.02] p-4">
          {bootstrapLoading ? (
            <div className="text-[13px] text-black/58">正在读取你最近确认的个人选项...</div>
          ) : hasHistoryProfile ? (
            <>
              <div className="text-[12px] font-medium text-black/56">{profileBasisHint}</div>
              <div className="mt-2 text-[12px] text-black/56">当前品类：{currentCategoryLabel}</div>
              {bootstrap?.profile?.summary?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {bootstrap.profile.summary.map((item, idx) => (
                    <span
                      key={`${idx}-${item}`}
                      className="inline-flex rounded-full border border-black/10 bg-white/72 px-3 py-1 text-[12px] text-black/72"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-[13px] text-black/58">暂无可展示的个人标签。</div>
              )}
            </>
          ) : (
            <div className="text-[13px] leading-[1.6] text-[#b53a3a]">
              还没有可沿用的个人选项。先完成一次“{currentCategoryLabel}”问答后再来对比。
            </div>
          )}
        </div>

        <div className="mt-3">
          <Link
            href={`/m/${category}/start`}
            className="inline-flex h-10 items-center rounded-full border border-black/12 px-4 text-[13px] font-medium text-black/72 active:bg-black/[0.03]"
          >
            重新填写个人选项
          </Link>
        </div>
      </div>
    );
  } else if (step === 3) {
    stepBody = (
      <div>
        <h2 className="text-[24px] leading-[1.2] font-semibold tracking-[-0.02em] text-black/90">选择要对比的产品</h2>
        <p className="mt-2 text-[14px] leading-[1.55] text-black/62">2 款最聚焦，最多 3 款。</p>

        <div className="m-compare-selection-tip mt-4 rounded-xl border px-3 py-2 text-[12px]">
          <div>{selectionStatusText}</div>
          <div className="mt-1 text-[11px] opacity-85">{selectionAssistText}</div>
        </div>

        <input
          ref={uploadInputRef}
          id="mobile-compare-file"
          type="file"
          accept="image/*"
          disabled={running}
          onChange={(e) => {
            const picked = e.target.files?.[0] || null;
            setFile(picked);
            if (!picked) {
              setBrand("");
              setName("");
              return;
            }
            void safeTrack("compare_upload_pick", { category, filename: picked.name });
          }}
          className="hidden"
        />

        {bootstrapLoading ? (
          <div className="mt-3 text-[13px] text-black/55">正在加载产品库...</div>
        ) : bootstrapError ? (
          <div className="mt-3 text-[13px] text-[#b53a3a]">{bootstrapError}</div>
        ) : orderedLibraryItems.length === 0 ? (
          <div className="mt-3 text-[13px] text-black/55">该品类暂时还没有可用产品。</div>
        ) : (
          <div className="mt-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-w-max gap-3 pr-2">
              <UploadProductCard
                selected={hasUpload}
                disabled={running}
                fileName={file?.name || ""}
                fileSize={file?.size || 0}
                previewUrl={uploadPreviewUrl}
                onPick={() => uploadInputRef.current?.click()}
                onRemove={() => {
                  setFile(null);
                  setBrand("");
                  setName("");
                }}
              />

              {orderedLibraryItems.map((item) => {
                const pid = item.productId;
                const selected = selectedSet.has(pid);
                const disabled = !selected && selectedCount >= maxLibrarySelection;
                const canToggle = selected || selectedCount < maxLibrarySelection;
                return (
                  <ProductLibraryCard
                    key={pid}
                    item={item}
                    selected={selected}
                    disabled={running || disabled}
                    onPress={() => {
                      if (!canToggle) return;
                      toggleSelected(pid);
                      void safeTrack("compare_library_pick", {
                        category,
                        product_id: pid,
                        is_recommendation: item.isRecommendation,
                        is_most_used: item.isMostUsed,
                        selected: !selected,
                      });
                    }}
                    onToggle={(event) => {
                      event.stopPropagation();
                      if (!canToggle) return;
                      toggleSelected(pid);
                      void safeTrack("compare_library_pick", {
                        category,
                        product_id: pid,
                        is_recommendation: item.isRecommendation,
                        is_most_used: item.isMostUsed,
                        selected: !selected,
                      });
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {hasUpload ? (
          <div className="mt-4 rounded-[20px] border border-black/10 bg-black/[0.02] p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[12px] text-black/56">补充信息（可选，提升识别准确度）</div>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setBrand("");
                  setName("");
                }}
                className="inline-flex h-8 items-center rounded-full border border-black/12 px-3 text-[12px] text-black/65 active:bg-black/[0.04]"
              >
                移除上传
              </button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3">
              <input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                disabled={running}
                placeholder="品牌（可选）"
                className="m-compare-upload-input h-10 rounded-xl border px-3 text-[13px] outline-none"
              />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={running}
                placeholder="产品名（可选）"
                className="m-compare-upload-input h-10 rounded-xl border px-3 text-[13px] outline-none"
              />
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {(uploadValuePoints.length ? uploadValuePoints : ["补充在用产品后，可判断是否继续用", "若不上传，仍可完成产品库专业对比"]).map((item, idx) => (
              <span
                key={`${idx}-${item}`}
                className="m-compare-upload-point inline-flex rounded-full border px-3 py-1 text-[11px] font-medium"
              >
                {item}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  } else {
    stepBody = (
      <div>
        <h2 className="text-[24px] leading-[1.2] font-semibold tracking-[-0.02em] text-black/90">开始前确认</h2>
        <p className="mt-2 text-[14px] leading-[1.55] text-black/62">
          {hasUpload
            ? "将给出：继续用、建议替换，或分场景混用。"
            : "将给出：优先尝试建议、替代建议，和分场景建议。"}
        </p>

        <div className="mt-4 space-y-3">
          <div className="rounded-[18px] border border-black/10 bg-black/[0.02] px-4 py-3">
            <div className="text-[12px] text-black/52">对比品类</div>
            <div className="mt-1 text-[15px] font-semibold text-black/86">{currentCategoryLabel}</div>
          </div>

          <div className="rounded-[18px] border border-black/10 bg-black/[0.02] px-4 py-3">
            <div className="text-[12px] text-black/52">本次已带入信息</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(bootstrap?.profile?.summary?.length
                ? bootstrap.profile.summary
                : ["未找到可沿用信息，请先更新个人选项"]).map((item, idx) => (
                <span key={`${idx}-${item}`} className="inline-flex rounded-full border border-black/10 bg-white/70 px-3 py-1 text-[12px] text-black/72">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-[18px] border border-black/10 bg-black/[0.02] px-4 py-3">
            <div className="text-[12px] text-black/52">本次对比对象（{totalSelectedCount}）</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedProductSummary.length > 0 ? (
                selectedProductSummary.map((item) => (
                  <span key={item} className="inline-flex rounded-full border border-black/10 bg-white/70 px-3 py-1 text-[12px] text-black/72">
                    {item}
                  </span>
                ))
              ) : (
                <span className="text-[13px] text-black/55">还未选择产品</span>
              )}
            </div>
          </div>
        </div>

        {!hasHistoryProfile && (
          <div className="mt-3 rounded-2xl border border-[#ff8f8f]/45 bg-[#ff5f5f]/10 px-4 py-3 text-[13px] text-[#b53a3a]">
            还没有可沿用的个人选项。先完成一次该品类问答，再开始专业对比。
          </div>
        )}
        {!recommendationReady && (
          <div className="mt-3 rounded-2xl border border-[#ff8f8f]/45 bg-[#ff5f5f]/10 px-4 py-3 text-[13px] text-[#b53a3a]">
            当前设备在“{currentCategoryLabel}”下还没有历史首推，请先完成一次对应问答路径。
          </div>
        )}
      </div>
    );
  }

  if (running) {
    return (
      <section className="m-compare-page pb-10">
        <h1 className="text-[30px] leading-[1.12] font-semibold tracking-[-0.02em] text-black/90">专业对比</h1>
        <p className="mt-3 text-[15px] leading-[1.55] text-black/60">
          任务已启动。约 3–5 分钟后将生成完整结论，你现在离开也不会丢失进度。
        </p>

        <CompareWaitingPanel
          stage={activeStage}
          stageLabel={activeStageLabel}
          hint={progressHint}
          percent={progressPercent}
          pairProgress={pairProgress}
          elapsedSeconds={elapsedSeconds}
        />

        <div className="mt-4 rounded-[22px] border border-black/10 bg-white p-4">
          <div className="text-[13px] font-semibold text-black/84">等待时你可以</div>
          <div className="mt-2 grid gap-2">
            <Link
              href="/m/wiki"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-black/12 bg-white px-4 text-[13px] font-medium text-black/78 active:bg-black/[0.03]"
            >
              先去逛成分百科
            </Link>
            <Link
              href="/m/me"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-black/12 bg-white px-4 text-[13px] font-medium text-black/78 active:bg-black/[0.03]"
            >
              去“我的”查看历史记录
            </Link>
          </div>
          <p className="mt-2 text-[12px] leading-[1.5] text-black/55">当前任务会在后台继续进行，完成后可在结果页或“我的”查看。</p>
        </div>
      </section>
    );
  }

  return (
    <section className="m-compare-page pb-10">
      <h1 className="text-[30px] leading-[1.12] font-semibold tracking-[-0.02em] text-black/90">专业对比</h1>
      <p className="mt-3 text-[15px] leading-[1.55] text-black/60">
        这次对比，只为帮你更快选对。你可以直接对比产品库；补充你正在用的产品后，还会额外判断“是否值得继续用”。
      </p>

      <div className="mt-4 rounded-[22px] border border-black/10 bg-white px-4 py-3">
        <div className="flex items-center justify-between text-[12px] text-black/55">
          <span>
            第 {step} 步 / 共 {TOTAL_STEPS} 步
          </span>
          <span>{STEP_TITLE[step]}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/[0.08]">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#78adff_0%,#3c86ff_58%,#1f5ce5_100%)] transition-all duration-300"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>

      {runError ? (
        <div className="mt-3 rounded-2xl border border-[#ff8f8f]/45 bg-[#ff5f5f]/10 px-4 py-3 text-[13px] text-[#b53a3a]">
          {runError}
        </div>
      ) : null}

      <div className="mt-4 rounded-[26px] border border-black/10 bg-white p-4">{stepBody}</div>

      <div className="mt-4 flex items-center gap-2">
        {step > 1 ? (
          <button
            type="button"
            onClick={goPrevStep}
            className="inline-flex h-11 items-center justify-center rounded-full border border-black/12 bg-white px-4 text-[14px] font-medium text-black/72 active:bg-black/[0.03]"
          >
            上一步
          </button>
        ) : null}

        {step === 2 ? (
          <Link
            href={`/m/${category}/start`}
            className="inline-flex h-11 items-center justify-center rounded-full border border-black/12 bg-white px-4 text-[14px] font-medium text-black/72 active:bg-black/[0.03]"
          >
            重新填写
          </Link>
        ) : null}

        <button
          type="button"
          onClick={() => {
            void handlePrimaryAction();
          }}
          disabled={primaryDisabled}
          className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-black px-5 text-[15px] font-semibold text-white disabled:bg-black/25"
        >
          {primaryActionLabel}
        </button>
      </div>

      <div className="mt-3 text-[12px] text-black/55">当前状态：{progressHint}</div>
    </section>
  );
}

function CompareWaitingPanel({
  stage,
  stageLabel,
  hint,
  percent,
  pairProgress,
  elapsedSeconds,
}: {
  stage: WaitingStage;
  stageLabel: string;
  hint: string;
  percent: number;
  pairProgress: { index: number; total: number } | null;
  elapsedSeconds: number;
}) {
  const currentStageIndex = WAITING_STAGE_ORDER.indexOf(stage);
  const showInsight = elapsedSeconds >= 8;
  return (
    <div className="mt-4 overflow-hidden rounded-[26px] border border-black/10 bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_44%,#ffffff_100%)] p-4 shadow-[0_10px_28px_rgba(35,61,102,0.08)]">
      <div className="flex items-center justify-between">
        <span className="inline-flex h-7 items-center rounded-full border border-[#b7cef8] bg-[#eaf2ff] px-3 text-[11px] font-semibold text-[#2d5dbc]">
          豆包正在工作
        </span>
        <span className="text-[11px] font-medium text-black/50">{formatDuration(elapsedSeconds)}</span>
      </div>

      <h3 className="mt-3 text-[20px] font-semibold tracking-[-0.01em] text-black/90">{stageLabel || "正在分析中"}</h3>
      <p className="mt-1 text-[12px] leading-[1.5] text-black/62">{hint || "系统仍在分析中，请稍候。"}</p>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/80">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#82b3ff_0%,#3d7dff_55%,#1f5ce5_100%)] transition-all duration-500"
          style={{ width: `${Math.max(8, Math.min(100, percent || 8))}%` }}
        />
      </div>

      {pairProgress ? (
        <div className="mt-2 text-[11px] text-black/56">
          正在处理第 {pairProgress.index}/{pairProgress.total} 组对比
        </div>
      ) : null}

      {showInsight ? (
        <div className="mt-3 rounded-xl border border-[#bcd2ff] bg-[#edf4ff] px-3 py-2 text-[12px] text-[#305fb8]">
          已识别关键差异维度：清洁力、刺激风险、修护倾向。
        </div>
      ) : null}

      <div className="mt-4 grid gap-2">
        {WAITING_STAGE_ORDER.map((item, idx) => {
          const done = idx < currentStageIndex;
          const active = item === stage;
          return (
            <div
              key={item}
              className={`flex items-center justify-between rounded-xl border px-3 py-2 text-[12px] ${
                active
                  ? "border-[#9cbcff]/70 bg-[#edf4ff] text-[#2d5dbc]"
                  : done
                    ? "border-[#d2dff5] bg-white/85 text-black/66"
                    : "border-black/8 bg-white/70 text-black/45"
              }`}
            >
              <span>{WAITING_STAGE_LABEL[item]}</span>
              <span className="text-[11px]">{active ? "进行中" : done ? "已完成" : "等待中"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return "0 KB";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

type ProductBadge = "recommendation_primary" | "most_used_primary" | "most_used_secondary";

type OrderedProductLibraryItem = {
  item: MobileCompareProductLibraryItem;
  productId: string;
  title: string;
  badges: ProductBadge[];
  emphasized: boolean;
  isRecommendation: boolean;
  isMostUsed: boolean;
};

const UploadProductCard = memo(function UploadProductCard({
  selected,
  disabled,
  fileName,
  fileSize,
  previewUrl,
  onPick,
  onRemove,
}: {
  selected: boolean;
  disabled: boolean;
  fileName: string;
  fileSize: number;
  previewUrl: string | null;
  onPick: () => void;
  onRemove: () => void;
}) {
  return (
    <article
      className={`m-compare-product-card m-compare-product-card-press m-pressable group relative flex w-[clamp(108px,31vw,134px)] shrink-0 flex-col rounded-[22px] border px-2.5 pb-2.5 pt-3 text-left transition-[background-color,border-color,box-shadow,transform] duration-200 ${
        selected ? "m-compare-product-card-selected" : "m-compare-product-card-default"
      } ${disabled ? "opacity-45" : "cursor-pointer active:scale-[0.985]"}`}
      onClick={() => {
        if (disabled) return;
        onPick();
      }}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onPick();
        }
      }}
      role="button"
      tabIndex={disabled ? -1 : 0}
    >
      <div className="relative h-[86px] w-full overflow-hidden rounded-[16px] bg-[linear-gradient(148deg,#f4f6fb,#d9e3f1)]">
        {previewUrl ? (
          <Image src={previewUrl} alt="在用产品" fill sizes="134px" unoptimized className="object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-black/45">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M16 16l-4-4-4 4" />
              <path d="M12 12v8" />
              <path d="M20 16.5a4.5 4.5 0 0 0-1-8.9 6 6 0 0 0-11.6 2.3A4.4 4.4 0 0 0 8 20h11" />
            </svg>
            <span className="text-[10px]">上传在用款</span>
          </div>
        )}

        <button
          type="button"
          disabled={disabled}
          aria-label={selected ? "移除在用产品" : "添加在用产品"}
          onClick={(event) => {
            event.stopPropagation();
            if (selected) {
              onRemove();
              return;
            }
            onPick();
          }}
          className={`m-compare-check absolute right-1 top-1 z-[3] inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
            selected ? "m-compare-check-selected" : "m-compare-check-unselected"
          }`}
        >
          <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full text-[11px] leading-none">✓</span>
        </button>
      </div>

      <div className="mt-2 min-h-[58px]">
        <span className="m-compare-upload-point inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold">在用产品</span>
        <div className="mt-1.5 line-clamp-2 text-[13px] leading-[1.28] font-medium text-black/86">
          {selected ? fileName || "我在用的产品" : "上传我在用的产品"}
        </div>
        {selected && fileSize > 0 ? <div className="mt-1 text-[11px] text-black/52">{formatFileSize(fileSize)}</div> : null}
      </div>
    </article>
  );
});

const ProductLibraryCard = memo(function ProductLibraryCard({
  item,
  selected,
  disabled,
  onPress,
  onToggle,
}: {
  item: OrderedProductLibraryItem;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
  onToggle: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const image = resolveProductImage(item.item.product.image_url);
  return (
    <article
      className={`m-compare-product-card m-compare-product-card-press m-pressable group relative flex w-[clamp(108px,31vw,134px)] shrink-0 flex-col rounded-[22px] border text-left transition-[background-color,border-color,box-shadow,transform] duration-200 ${
        selected ? "m-compare-product-card-selected" : "m-compare-product-card-default"
      } ${item.emphasized ? "m-compare-product-card-emphasized px-2.5 pb-2.5 pt-3" : "px-2 pb-2 pt-2.5"} ${disabled ? "opacity-45" : "cursor-pointer active:scale-[0.985]"}`}
      onClick={() => {
        if (disabled) return;
        onPress();
      }}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onPress();
        }
      }}
      role="button"
      tabIndex={disabled ? -1 : 0}
    >
      <div className="relative h-[86px] w-full overflow-hidden rounded-[16px] bg-[linear-gradient(148deg,#f4f6fb,#d9e3f1)]">
        {image ? (
          <Image src={image} alt={item.title} fill sizes="134px" className="object-contain p-2" />
        ) : (
          <div className="flex h-full items-center justify-center text-[11px] text-black/35">无图</div>
        )}
        <button
          type="button"
          disabled={disabled}
          aria-label={selected ? `取消选择 ${item.title}` : `选择 ${item.title}`}
          onClick={onToggle}
          className={`m-compare-check absolute right-1 top-1 z-[3] inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
            selected ? "m-compare-check-selected" : "m-compare-check-unselected"
          }`}
        >
          <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full text-[11px] leading-none">
            ✓
          </span>
        </button>
      </div>

      <div className="mt-2 min-h-[54px]">
        {item.badges.length > 0 ? (
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {item.badges.map((badge) => (
              <ProductBadgePill key={`${item.productId}-${badge}`} badge={badge} />
            ))}
          </div>
        ) : null}
        <div className="line-clamp-2 text-[13px] leading-[1.28] font-medium text-black/86">{item.title}</div>
      </div>
    </article>
  );
});

function ProductBadgePill({ badge }: { badge: ProductBadge }) {
  if (badge === "recommendation_primary") {
    return (
      <span className="m-compare-badge m-compare-badge-reco inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-semibold">
        与你更匹配
      </span>
    );
  }
  if (badge === "most_used_primary") {
    return (
      <span className="m-compare-badge m-compare-badge-most inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-semibold">
        同类用户常用
      </span>
    );
  }
  return (
    <span className="m-compare-badge m-compare-badge-most-sub inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-semibold">
      同类用户常用
    </span>
  );
}

function orderProductLibraryItems(items: MobileCompareProductLibraryItem[]): OrderedProductLibraryItem[] {
  const normalized = items
    .map((item) => {
      const productId = String(item.product.id || "").trim();
      if (!productId) return null;
      const title = [item.product.brand, item.product.name].filter(Boolean).join(" ").trim() || "未命名产品";
      return { item, productId, title };
    })
    .filter((item): item is { item: MobileCompareProductLibraryItem; productId: string; title: string } => Boolean(item));

  if (normalized.length === 0) return [];

  const recommendation = normalized.find((entry) => entry.item.is_recommendation) || null;
  const mostUsed = normalized.find((entry) => entry.item.is_most_used) || null;
  const used = new Set<string>();
  const ordered: OrderedProductLibraryItem[] = [];

  if (recommendation) {
    used.add(recommendation.productId);
    const sameAsMost = mostUsed && mostUsed.productId === recommendation.productId;
    ordered.push({
      ...recommendation,
      badges: sameAsMost ? ["recommendation_primary", "most_used_secondary"] : ["recommendation_primary"],
      emphasized: true,
      isRecommendation: true,
      isMostUsed: Boolean(sameAsMost),
    });
  }

  if (mostUsed && !used.has(mostUsed.productId)) {
    used.add(mostUsed.productId);
    ordered.push({
      ...mostUsed,
      badges: ["most_used_primary"],
      emphasized: true,
      isRecommendation: false,
      isMostUsed: true,
    });
  }

  for (const entry of normalized) {
    if (used.has(entry.productId)) continue;
    ordered.push({
      ...entry,
      badges: [],
      emphasized: false,
      isRecommendation: false,
      isMostUsed: false,
    });
  }

  return ordered;
}

function resolveProductImage(raw?: string | null): string | null {
  const value = String(raw || "").trim();
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("/")) return value;
  return `/${value}`;
}

async function safeTrack(name: string, props: Record<string, unknown>) {
  try {
    await recordMobileCompareEvent(name, props);
  } catch {
    // 埋点失败不阻塞主流程
  }
}
